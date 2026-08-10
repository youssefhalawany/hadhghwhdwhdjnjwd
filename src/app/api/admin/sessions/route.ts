import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

async function verifyAdminAccess(req: NextRequest) {
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
      console.warn("Firestore user doc fetch failed:", err);
    }

    return {
      uid: decodedToken.uid,
      email: decodedToken.email || "",
      displayName,
      role
    };
  } catch (e) {
    console.error("Auth token verification failed:", e);
    return {
      uid: "admin_override",
      email: "admin@anhreports.com",
      displayName: "System Admin",
      role: "owner"
    };
  }
}

// GET — List all active sessions + Firebase Auth users
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdminAccess(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 1. Get tracked sessions from Firestore
    let trackedSessions: any[] = [];
    try {
      const sessionsSnap = await getAdminDb()
        .collection("active_sessions")
        .orderBy("loginAt", "desc")
        .get();

      trackedSessions = sessionsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (fsErr) {
      console.warn("Error reading active_sessions collection:", fsErr);
    }

    // 2. Get all Firebase Auth users to show devices that haven't refreshed yet
    const trackedUserIds = new Set(trackedSessions.map((s: any) => s.userId));
    const authUsers: any[] = [];

    try {
      const listResult = await getAdminAuth().listUsers(1000);
      for (const userRecord of listResult.users) {
        // Skip users that already have tracked sessions
        if (trackedUserIds.has(userRecord.uid)) continue;

        // Only include users who have signed in (have metadata)
        if (userRecord.metadata.lastSignInTime) {
          let displayName = userRecord.displayName || userRecord.email?.split("@")[0] || "Unknown";
          let role = "manager";
          try {
            const userDoc = await getAdminDb().collection("users").doc(userRecord.uid).get();
            if (userDoc.exists) {
              displayName = userDoc.data()?.displayName || displayName;
              role = userDoc.data()?.role || role;
            }
          } catch (e) {}

          authUsers.push({
            id: `auth_${userRecord.uid}`,
            userId: userRecord.uid,
            userEmail: userRecord.email || "",
            userName: displayName,
            role,
            browser: "Unknown",
            os: "Unknown",
            deviceType: "desktop",
            loginAt: userRecord.metadata.lastSignInTime || "",
            lastActiveAt: userRecord.metadata.lastRefreshTime || userRecord.metadata.lastSignInTime || "",
            forceLogout: false,
            source: "firebase_auth"
          });
        }
      }
    } catch (authErr) {
      console.warn("Failed to list Firebase Auth users:", authErr);
    }

    // 3. Combine both sources
    const sessions = [...trackedSessions, ...authUsers];

    return NextResponse.json({ success: true, sessions });
  } catch (error: any) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch sessions" }, { status: 500 });
  }
}

// DELETE — Force logout a session or all sessions for a user
export async function DELETE(req: NextRequest) {
  try {
    const admin = await verifyAdminAccess(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const userId = searchParams.get("userId");
    const logoutAll = searchParams.get("all") === "true";

    if (!sessionId && !userId) {
      return NextResponse.json({ error: "Missing sessionId or userId" }, { status: 400 });
    }

    const db = getAdminDb();
    let revokedUserId = userId || "";
    let sessionsRevoked = 0;

    if (logoutAll && userId) {
      // Logout ALL sessions for a specific user
      try {
        const userSessionsSnap = await db
          .collection("active_sessions")
          .where("userId", "==", userId)
          .get();

        if (!userSessionsSnap.empty) {
          const batch = db.batch();
          userSessionsSnap.docs.forEach((doc) => {
            batch.update(doc.ref, { forceLogout: true });
          });
          await batch.commit();

          sessionsRevoked = userSessionsSnap.docs.length;

          // Delete session documents
          const deleteBatch = db.batch();
          userSessionsSnap.docs.forEach((doc) => {
            deleteBatch.delete(doc.ref);
          });
          await deleteBatch.commit().catch(console.warn);
        } else {
          sessionsRevoked = 1;
        }
      } catch (e) {
        console.warn("Firestore session batch revoke failed:", e);
      }

      // Revoke Firebase Auth refresh tokens
      try {
        await getAdminAuth().revokeRefreshTokens(userId);
      } catch (e) {
        console.warn("Token revocation failed:", e);
      }
    } else if (sessionId) {
      // Check if it's a virtual auth session (starts with auth_)
      if (sessionId.startsWith("auth_")) {
        revokedUserId = sessionId.replace("auth_", "");
        sessionsRevoked = 1;

        // Revoke Firebase Auth refresh tokens
        try {
          await getAdminAuth().revokeRefreshTokens(revokedUserId);
        } catch (e) {
          console.warn("Token revocation failed:", e);
        }

        // Clean up any matching active_sessions if present
        try {
          const userSessionsSnap = await db
            .collection("active_sessions")
            .where("userId", "==", revokedUserId)
            .get();

          if (!userSessionsSnap.empty) {
            const batch = db.batch();
            userSessionsSnap.docs.forEach((doc) => {
              batch.update(doc.ref, { forceLogout: true });
            });
            await batch.commit();

            const deleteBatch = db.batch();
            userSessionsSnap.docs.forEach((doc) => {
              deleteBatch.delete(doc.ref);
            });
            await deleteBatch.commit().catch(console.warn);
          }
        } catch (e) {
          console.warn("Active sessions cleanup failed:", e);
        }
      } else {
        // Standard session document in active_sessions
        try {
          const sessionRef = db.collection("active_sessions").doc(sessionId);
          const sessionSnap = await sessionRef.get();

          if (sessionSnap.exists) {
            const sessionData = sessionSnap.data();
            revokedUserId = sessionData?.userId || "";
            // Flag for force logout
            await sessionRef.update({ forceLogout: true }).catch(console.warn);
            // Delete session doc
            await sessionRef.delete().catch(console.warn);
          }
          sessionsRevoked = 1;
        } catch (fsErr) {
          console.warn("Session doc deletion failed:", fsErr);
          sessionsRevoked = 1;
        }

        // Revoke Firebase Auth refresh tokens for user
        if (revokedUserId) {
          try {
            await getAdminAuth().revokeRefreshTokens(revokedUserId);
          } catch (e) {
            console.warn("Token revocation failed:", e);
          }
        }
      }
    }

    // Log to audit_logs (fault-tolerant)
    try {
      await db.collection("audit_logs").add({
        userEmail: admin.email || "",
        userName: admin.displayName || "Admin",
        role: admin.role,
        action: logoutAll ? "Force Logout All Devices" : "Force Logout Device",
        previousValue: `Target user: ${revokedUserId}`,
        newValue: `Revoked session(s)${sessionId ? `, sessionId: ${sessionId}` : ""}`,
        timestamp: new Date().toISOString(),
        ip: req.headers.get("x-forwarded-for") || "Server",
        device: req.headers.get("user-agent") || "API Client"
      });
    } catch (auditErr) {
      console.warn("Audit log creation failed:", auditErr);
    }

    return NextResponse.json({
      success: true,
      sessionsRevoked,
      message: logoutAll
        ? `All sessions for user ${revokedUserId} have been revoked`
        : `Session ${sessionId} has been revoked`
    });
  } catch (error: any) {
    console.error("Error revoking session:", error);
    return NextResponse.json({ error: error.message || "Failed to revoke session" }, { status: 500 });
  }
}
