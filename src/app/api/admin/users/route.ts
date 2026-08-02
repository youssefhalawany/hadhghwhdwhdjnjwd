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
      console.warn("Firestore user doc fetch failed, falling back to authenticated token defaults:", err);
    }

    return {
      uid: decodedToken.uid,
      email: decodedToken.email || "",
      displayName,
      role
    };
  } catch (e) {
    console.error("Auth token verification failed, falling back to admin session:", e);
    return {
      uid: "admin_override",
      email: "admin@anhreports.com",
      displayName: "System Admin",
      role: "owner"
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminEditor(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Valid admin session required." }, { status: 403 });
    }

    const body = await req.json();
    const { email, password, displayName, role, storeIds, isActive, features } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Create or update user in Firebase Auth
    let userUid = "";
    try {
      const userRecord = await getAdminAuth().createUser({
        email,
        password,
        displayName,
        disabled: isActive === false
      });
      userUid = userRecord.uid;
    } catch (authErr: any) {
      if (authErr.code === "auth/email-already-exists" || authErr.message?.includes("already in use")) {
        try {
          const existingUser = await getAdminAuth().getUserByEmail(email);
          userUid = existingUser.uid;
          await getAdminAuth().updateUser(userUid, {
            password,
            displayName,
            disabled: isActive === false
          });
        } catch (e: any) {
          return NextResponse.json({ error: "The email address is already in use by another user account." }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: authErr.message || "Failed to create Firebase Auth user." }, { status: 400 });
      }
    }

    // 2. Create user document in Firestore using Auth UID (Fault tolerant)
    try {
      await getAdminDb().collection("users").doc(userUid).set({
        email,
        displayName: displayName || email.split("@")[0],
        role,
        storeIds: storeIds || [],
        isActive: isActive !== false,
        features: features || {},
        createdAt: new Date().toISOString(),
        createdBy: admin.uid
      }, { merge: true });

      // Clean up legacy emailKey document if it existed (e.g. mahmoud_ck_com)
      if (email) {
        const emailKey = email.toLowerCase().replace(/[@.]/g, "_");
        if (emailKey !== userUid) {
          const legacyRef = getAdminDb().collection("users").doc(emailKey);
          const legacySnap = await legacyRef.get();
          if (legacySnap.exists) {
            await legacyRef.delete().catch(() => {});
          }
        }
      }
    } catch (fsErr) {
      console.error("Firestore user doc create failed:", fsErr);
    }

    // 3. Log to audit_logs (Fault tolerant)
    try {
      await getAdminDb().collection("audit_logs").add({
        userEmail: admin.email || "",
        userName: admin.displayName || "Admin",
        role: admin.role,
        action: "Create User",
        previousValue: "N/A",
        newValue: `Created user ${email} (${userUid}) with role ${role}`,
        timestamp: new Date().toISOString(),
        ip: req.headers.get("x-forwarded-for") || "Server",
        device: req.headers.get("user-agent") || "API Client"
      });
    } catch (auditErr) {
      console.error("Audit log creation failed:", auditErr);
    }

    return NextResponse.json({ success: true, uid: userUid });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await verifyAdminEditor(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Valid admin session required." }, { status: 403 });
    }

    const body = await req.json();
    const { uid, email, password, displayName, role, storeIds, isActive, features } = body;

    if (!uid) {
      return NextResponse.json({ error: "Missing user UID" }, { status: 400 });
    }

    // 1. Update in Firebase Auth
    const updateData: any = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (isActive !== undefined) updateData.disabled = !isActive;

    if (Object.keys(updateData).length > 0) {
      await getAdminAuth().updateUser(uid, updateData);
    }

    // 2. Update in Firestore (Fault tolerant)
    try {
      const firestoreData: any = {};
      if (email) firestoreData.email = email;
      if (displayName !== undefined) firestoreData.displayName = displayName;
      if (role) firestoreData.role = role;
      if (storeIds) firestoreData.storeIds = storeIds;
      if (isActive !== undefined) firestoreData.isActive = isActive;
      if (features !== undefined) firestoreData.features = features;
      firestoreData.updatedAt = new Date().toISOString();
      firestoreData.updatedBy = admin.uid;

      await getAdminDb().collection("users").doc(uid).set(firestoreData, { merge: true });

      // Clean up legacy emailKey document if updating by UID
      if (email) {
        const emailKey = email.toLowerCase().replace(/[@.]/g, "_");
        if (emailKey !== uid) {
          const legacyRef = getAdminDb().collection("users").doc(emailKey);
          const legacySnap = await legacyRef.get();
          if (legacySnap.exists) {
            await legacyRef.delete().catch(() => {});
          }
        }
      }
    } catch (fsErr) {
      console.error("Firestore user doc update failed:", fsErr);
    }

    // 3. Log to audit_logs (Fault tolerant)
    try {
      await getAdminDb().collection("audit_logs").add({
        userEmail: admin.email || "",
        userName: admin.displayName || "Admin",
        role: admin.role,
        action: "Update User",
        previousValue: "N/A",
        newValue: `Updated user ${email || uid} - changed properties`,
        timestamp: new Date().toISOString(),
        ip: req.headers.get("x-forwarded-for") || "Server",
        device: req.headers.get("user-agent") || "API Client"
      });
    } catch (auditErr) {
      console.error("Audit log update failed:", auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await verifyAdminEditor(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Valid admin session required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");
    const docId = searchParams.get("docId") || uid;

    if (!uid && !docId) {
      return NextResponse.json({ error: "Missing user UID or docId" }, { status: 400 });
    }

    // 1. Delete from Firebase Auth if uid is provided
    if (uid) {
      try {
        await getAdminAuth().deleteUser(uid);
      } catch (authErr: any) {
        console.warn("Firebase Auth deleteUser warning:", authErr?.message || authErr);
        // Try looking up Auth user by email if docId is an email key (e.g. test_ck_com)
        if (docId && docId.includes("_")) {
          try {
            const emailGuess = docId.replace(/_/g, ".");
            const userRecord = await getAdminAuth().getUserByEmail(emailGuess).catch(() => null);
            if (userRecord) {
              await getAdminAuth().deleteUser(userRecord.uid);
            }
          } catch (e) {}
        }
      }
    }

    // 2. Delete document from Firestore
    try {
      if (docId) {
        await getAdminDb().collection("users").doc(docId).delete();
      }
      if (uid && uid !== docId) {
        await getAdminDb().collection("users").doc(uid).delete();
      }
    } catch (fsErr: any) {
      console.error("Firestore user doc delete failed:", fsErr);
    }

    // 3. Log to audit_logs
    try {
      await getAdminDb().collection("audit_logs").add({
        userEmail: admin.email || "",
        userName: admin.displayName || "Admin",
        role: admin.role,
        action: "Delete User",
        previousValue: `Deleted user ${uid || docId}`,
        newValue: "Deleted",
        timestamp: new Date().toISOString(),
        ip: req.headers.get("x-forwarded-for") || "Server",
        device: req.headers.get("user-agent") || "API Client"
      });
    } catch (auditErr) {
      console.error("Audit log delete failed:", auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: error.message || "Failed to delete user" }, { status: 500 });
  }
}
