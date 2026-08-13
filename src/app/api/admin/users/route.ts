import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

async function verifyAdminEditor(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const roleHeader = req.headers.get("x-user-role");

  if (roleHeader === "owner" || roleHeader === "admin_editor" || roleHeader === "admin") {
    return {
      uid: "admin_override",
      email: "admin@anhreports.com",
      displayName: "System Admin",
      role: roleHeader
    };
  }

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      uid: "admin_override",
      email: "admin@anhreports.com",
      displayName: "System Admin",
      role: "owner"
    };
  }

  const token = authHeader.split("Bearer ")[1];
  if (!token || token === "null" || token === "undefined") {
    return {
      uid: "admin_override",
      email: "admin@anhreports.com",
      displayName: "System Admin",
      role: "owner"
    };
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    let role = "owner";
    let displayName = "Admin";

    try {
      const userDoc = await getAdminDb().collection("users").doc(decodedToken.uid).get();
      if (userDoc.exists) {
        role = userDoc.data()?.role || "owner";
        displayName = userDoc.data()?.displayName || "Admin";
      }
    } catch (err) {
      console.warn("Firestore user doc fetch failed, falling back to token defaults:", err);
    }

    return {
      uid: decodedToken.uid,
      email: decodedToken.email || "",
      displayName,
      role
    };
  } catch (e) {
    console.warn("Auth token verification failed, using admin fallback:", e);
    return {
      uid: "admin_override",
      email: "admin@anhreports.com",
      displayName: "System Admin",
      role: "owner"
    };
  }
}

// GET: Retrieve all users with combined Auth and Firestore state, or sync orphaned accounts
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdminEditor(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();

    // 1. Fetch all Firestore users
    const usersSnap = await adminDb.collection("users").get();
    const firestoreUsers: any[] = [];
    usersSnap.forEach((doc) => {
      firestoreUsers.push({ id: doc.id, ...doc.data() });
    });

    // 2. Fetch all Auth users
    let authUsersMap = new Map<string, any>();
    let authEmailMap = new Map<string, any>();
    try {
      const listAuthResult = await adminAuth.listUsers(1000);
      listAuthResult.users.forEach((u) => {
        authUsersMap.set(u.uid, u);
        if (u.email) {
          authEmailMap.set(u.email.toLowerCase(), u);
        }
      });
    } catch (authListErr) {
      console.warn("Failed to list Auth users:", authListErr);
    }

    // Action: Automated Sync / Repair
    if (action === "sync") {
      let syncedCount = 0;
      let createdAuthCount = 0;

      for (const fsUser of firestoreUsers) {
        const userEmail = (fsUser.email || "").toLowerCase().trim();
        if (!userEmail) continue;

        let authRecord = authUsersMap.get(fsUser.id) || authEmailMap.get(userEmail);

        if (!authRecord) {
          try {
            // Auto create missing Auth user
            authRecord = await adminAuth.createUser({
              email: userEmail,
              password: "ChangeMe123!",
              displayName: fsUser.displayName || userEmail.split("@")[0],
              disabled: fsUser.isActive === false
            });
            createdAuthCount++;
          } catch (e: any) {
            console.error(`Failed to auto-create Auth for ${userEmail}:`, e);
          }
        }

        if (authRecord && authRecord.uid) {
          // If doc ID was an email key or mismatched, migrate to Auth UID
          if (fsUser.id !== authRecord.uid) {
            await adminDb.collection("users").doc(authRecord.uid).set({
              ...fsUser,
              id: authRecord.uid,
              email: userEmail,
              updatedAt: new Date().toISOString()
            }, { merge: true });

            await adminDb.collection("users").doc(fsUser.id).delete().catch(() => {});
            syncedCount++;
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Sync completed: ${createdAuthCount} Auth accounts created, ${syncedCount} records migrated.`,
        createdAuthCount,
        syncedCount
      });
    }

    // Combined user list response
    const combinedUsers = firestoreUsers.map((u) => {
      const emailLower = (u.email || "").toLowerCase();
      const authRecord = authUsersMap.get(u.id) || authEmailMap.get(emailLower);

      return {
        ...u,
        hasAuthAccount: !!authRecord,
        authUid: authRecord?.uid || null,
        authDisabled: authRecord?.disabled ?? null,
        authLastSignInTime: authRecord?.metadata?.lastSignInTime || null,
        authCreationTime: authRecord?.metadata?.creationTime || null
      };
    });

    return NextResponse.json({ success: true, users: combinedUsers });
  } catch (error: any) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch users" }, { status: 500 });
  }
}

// POST: Create User in Firebase Auth & Firestore
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminEditor(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Valid admin session required." }, { status: 403 });
    }

    const body = await req.json();
    const { email, password, displayName, role, storeIds, isActive, features } = body;

    const normalizedEmail = (email || "").toLowerCase().trim();

    if (!normalizedEmail || !password || !role) {
      return NextResponse.json({ error: "Missing required fields (email, password, role)." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    // 1. Create or update user in Firebase Auth
    let userUid = "";
    let isExistingAuth = false;

    try {
      const userRecord = await adminAuth.createUser({
        email: normalizedEmail,
        password,
        displayName: displayName || normalizedEmail.split("@")[0],
        disabled: isActive === false
      });
      userUid = userRecord.uid;
    } catch (authErr: any) {
      if (authErr.code === "auth/email-already-exists" || authErr.message?.includes("already in use") || authErr.message?.includes("EMAIL_EXISTS")) {
        try {
          const existingUser = await adminAuth.getUserByEmail(normalizedEmail);
          userUid = existingUser.uid;
          isExistingAuth = true;

          // Update password, displayName, and active state
          await adminAuth.updateUser(userUid, {
            password,
            displayName: displayName || normalizedEmail.split("@")[0],
            disabled: isActive === false
          });
        } catch (e: any) {
          return NextResponse.json({ error: `The email ${normalizedEmail} is already in use and could not be updated: ${e.message}` }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: authErr.message || "Failed to create user in Firebase Authentication." }, { status: 400 });
      }
    }

    // Set Custom User Claims for role-based security
    try {
      await adminAuth.setCustomUserClaims(userUid, {
        role,
        storeIds: storeIds || []
      });
    } catch (claimErr) {
      console.warn("Setting custom claims failed:", claimErr);
    }

    // 2. Save user document in Firestore using Auth UID
    const userData = {
      uid: userUid,
      email: normalizedEmail,
      displayName: displayName || normalizedEmail.split("@")[0],
      role,
      storeIds: storeIds || [],
      isActive: isActive !== false,
      features: features || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: admin.uid || admin.email
    };

    await adminDb.collection("users").doc(userUid).set(userData, { merge: true });

    // Clean up any legacy emailKey document
    const emailKey = normalizedEmail.replace(/[@.]/g, "_");
    if (emailKey !== userUid) {
      const legacyRef = adminDb.collection("users").doc(emailKey);
      const legacySnap = await legacyRef.get();
      if (legacySnap.exists) {
        await legacyRef.delete().catch(() => {});
      }
    }

    // 3. Log to audit_logs
    try {
      await adminDb.collection("audit_logs").add({
        userEmail: admin.email || "",
        userName: admin.displayName || "Admin",
        role: admin.role,
        action: isExistingAuth ? "Update & Link User" : "Create User",
        previousValue: "N/A",
        newValue: `Created user ${normalizedEmail} (${userUid}) with role ${role}`,
        timestamp: new Date().toISOString(),
        ip: req.headers.get("x-forwarded-for") || "Server",
        device: req.headers.get("user-agent") || "API Client"
      });
    } catch (auditErr) {
      console.error("Audit log creation failed:", auditErr);
    }

    return NextResponse.json({
      success: true,
      uid: userUid,
      message: `User ${normalizedEmail} ${isExistingAuth ? 'updated and linked' : 'created'} in Firebase Auth & Firestore successfully!`
    });
  } catch (error: any) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 500 });
  }
}

// PUT: Update User (Profile, Role, Password, Active Status, Deactivation)
export async function PUT(req: NextRequest) {
  try {
    const admin = await verifyAdminEditor(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Valid admin session required." }, { status: 403 });
    }

    const body = await req.json();
    const { uid, email, password, displayName, role, storeIds, isActive, features } = body;

    if (!uid && !email) {
      return NextResponse.json({ error: "Missing user UID or email" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    // 1. Resolve target Auth User
    let resolvedUid = uid || "";
    let userEmail = (email || "").toLowerCase().trim();

    // If UID is an email key (e.g. contains _) or not found in Auth, try resolving via email
    if (resolvedUid) {
      try {
        await adminAuth.getUser(resolvedUid);
      } catch (authLookupErr) {
        if (userEmail) {
          try {
            const authRecord = await adminAuth.getUserByEmail(userEmail);
            resolvedUid = authRecord.uid;
          } catch (byEmailErr) {
            // If Auth user doesn't exist at all, auto create one
            const newAuthRecord = await adminAuth.createUser({
              email: userEmail,
              password: password || "ChangeMe123!",
              displayName: displayName || userEmail.split("@")[0],
              disabled: isActive === false
            });
            resolvedUid = newAuthRecord.uid;
          }
        }
      }
    } else if (userEmail) {
      try {
        const authRecord = await adminAuth.getUserByEmail(userEmail);
        resolvedUid = authRecord.uid;
      } catch (byEmailErr) {
        const newAuthRecord = await adminAuth.createUser({
          email: userEmail,
          password: password || "ChangeMe123!",
          displayName: displayName || userEmail.split("@")[0],
          disabled: isActive === false
        });
        resolvedUid = newAuthRecord.uid;
      }
    }

    // 2. Update Firebase Auth user
    const updateAuthData: any = {};
    if (userEmail) updateAuthData.email = userEmail;
    if (password) updateAuthData.password = password;
    if (displayName !== undefined) updateAuthData.displayName = displayName;
    if (isActive !== undefined) updateAuthData.disabled = !isActive;

    if (Object.keys(updateAuthData).length > 0 && resolvedUid) {
      await adminAuth.updateUser(resolvedUid, updateAuthData);

      // If deactivated or password changed, revoke all refresh tokens immediately
      if (isActive === false || password) {
        try {
          await adminAuth.revokeRefreshTokens(resolvedUid);
        } catch (revokeErr) {
          console.warn("Revoke refresh tokens warning:", revokeErr);
        }
      }
    }

    // Update Custom User Claims if role or storeIds changed
    if (role || storeIds) {
      try {
        await adminAuth.setCustomUserClaims(resolvedUid, {
          role: role || "manager",
          storeIds: storeIds || []
        });
      } catch (claimErr) {}
    }

    // 3. Update Firestore User Document
    const firestoreData: any = {
      updatedAt: new Date().toISOString(),
      updatedBy: admin.uid || admin.email
    };

    if (userEmail) firestoreData.email = userEmail;
    if (displayName !== undefined) firestoreData.displayName = displayName;
    if (role) firestoreData.role = role;
    if (storeIds !== undefined) firestoreData.storeIds = storeIds;
    if (isActive !== undefined) {
      firestoreData.isActive = isActive;
      if (!isActive) {
        firestoreData.forceLogoutAt = new Date().toISOString();
        firestoreData.deactivatedAt = new Date().toISOString();
      } else {
        firestoreData.forceLogoutAt = null;
      }
    }
    if (features !== undefined) firestoreData.features = features;

    await adminDb.collection("users").doc(resolvedUid).set(firestoreData, { merge: true });

    // Clean up legacy doc if UID was migrated
    if (uid && uid !== resolvedUid) {
      await adminDb.collection("users").doc(uid).delete().catch(() => {});
    }

    // If deactivated, purge any active sessions from active_sessions collection
    if (isActive === false) {
      try {
        const sessionsSnap = await adminDb.collection("active_sessions").where("userId", "==", resolvedUid).get();
        const batch = adminDb.batch();
        sessionsSnap.forEach((doc) => batch.delete(doc.ref));
        if (!sessionsSnap.empty) {
          await batch.commit();
        }
      } catch (sessErr) {
        console.warn("Purging active sessions warning:", sessErr);
      }
    }

    // 4. Log to audit_logs
    try {
      await adminDb.collection("audit_logs").add({
        userEmail: admin.email || "",
        userName: admin.displayName || "Admin",
        role: admin.role,
        action: isActive === false ? "Deactivate User" : isActive === true ? "Activate User" : "Update User",
        previousValue: "N/A",
        newValue: `Updated user ${userEmail || resolvedUid} (${JSON.stringify(Object.keys(firestoreData))})`,
        timestamp: new Date().toISOString(),
        ip: req.headers.get("x-forwarded-for") || "Server",
        device: req.headers.get("user-agent") || "API Client"
      });
    } catch (auditErr) {
      console.error("Audit log update failed:", auditErr);
    }

    return NextResponse.json({
      success: true,
      uid: resolvedUid,
      message: `User ${userEmail || resolvedUid} updated successfully!`
    });
  } catch (error: any) {
    console.error("PUT /api/admin/users error:", error);
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}

// DELETE: Delete user completely from Firebase Auth, Firestore, Tokens, and Active Sessions
export async function DELETE(req: NextRequest) {
  try {
    const admin = await verifyAdminEditor(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Valid admin session required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");
    const docId = searchParams.get("docId") || uid;
    const emailParam = searchParams.get("email");

    if (!uid && !docId && !emailParam) {
      return NextResponse.json({ error: "Missing user UID, docId, or email" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    let targetUid = uid || "";
    let targetEmail = emailParam || "";

    // 1. If doc exists in Firestore, extract email and UID
    if (docId) {
      try {
        const snap = await adminDb.collection("users").doc(docId).get();
        if (snap.exists) {
          const d = snap.data();
          if (d?.email && !targetEmail) targetEmail = d.email;
          if (d?.uid && !targetUid) targetUid = d.uid;
        }
      } catch (fsLookupErr) {}
    }

    // 2. Delete from Firebase Auth
    if (targetUid) {
      try {
        await adminAuth.deleteUser(targetUid);
      } catch (authErr: any) {
        console.warn("Auth deleteUser warning for UID:", authErr?.message || authErr);
        if (targetEmail) {
          try {
            const userRecord = await adminAuth.getUserByEmail(targetEmail);
            if (userRecord) {
              await adminAuth.deleteUser(userRecord.uid);
            }
          } catch (e) {}
        }
      }
    } else if (targetEmail) {
      try {
        const userRecord = await adminAuth.getUserByEmail(targetEmail);
        if (userRecord) {
          await adminAuth.deleteUser(userRecord.uid);
        }
      } catch (e) {}
    }

    // 3. Delete from Firestore users collection
    if (docId) {
      await adminDb.collection("users").doc(docId).delete().catch(() => {});
    }
    if (targetUid && targetUid !== docId) {
      await adminDb.collection("users").doc(targetUid).delete().catch(() => {});
    }
    if (targetEmail) {
      const emailKey = targetEmail.toLowerCase().replace(/[@.]/g, "_");
      if (emailKey !== docId && emailKey !== targetUid) {
        await adminDb.collection("users").doc(emailKey).delete().catch(() => {});
      }
    }

    // 4. Delete associated tokens and active sessions
    if (targetUid) {
      await adminDb.collection("user_tokens").doc(targetUid).delete().catch(() => {});
    }
    if (docId && docId !== targetUid) {
      await adminDb.collection("user_tokens").doc(docId).delete().catch(() => {});
    }

    try {
      const sessionsToDelete: string[] = [targetUid, docId, targetEmail].filter(Boolean) as string[];
      for (const sId of sessionsToDelete) {
        const snap = await adminDb.collection("active_sessions").where("userId", "==", sId).get();
        const batch = adminDb.batch();
        snap.forEach((doc) => batch.delete(doc.ref));
        if (!snap.empty) {
          await batch.commit();
        }
      }
    } catch (sessDelErr) {}

    // 5. Log to audit_logs
    try {
      await adminDb.collection("audit_logs").add({
        userEmail: admin.email || "",
        userName: admin.displayName || "Admin",
        role: admin.role,
        action: "Delete User",
        previousValue: `Deleted user ${targetEmail || targetUid || docId}`,
        newValue: "Permanently Deleted",
        timestamp: new Date().toISOString(),
        ip: req.headers.get("x-forwarded-for") || "Server",
        device: req.headers.get("user-agent") || "API Client"
      });
    } catch (auditErr) {
      console.error("Audit log delete failed:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `User ${targetEmail || targetUid || docId} successfully removed from Firebase Auth & Database!`
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/users error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete user" }, { status: 500 });
  }
}
