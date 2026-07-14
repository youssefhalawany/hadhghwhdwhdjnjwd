import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

async function verifyAdminEditor(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const userDoc = await getAdminDb().collection("users").doc(decodedToken.uid).get();
    console.log("User doc:", userDoc.data());
    
    if (userDoc.data()?.role !== "admin_editor") {
      console.log("Not an admin editor. Role is:", userDoc.data()?.role);
      return null;
    }
    return decodedToken.uid;
  } catch (e) {
    console.error("Auth verification failed", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUid = await verifyAdminEditor(req);
    if (!adminUid) {
      return NextResponse.json({ error: "Unauthorized. Admin Editor required." }, { status: 403 });
    }

    const body = await req.json();
    const { email, password, displayName, role, storeIds, isActive } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Create user in Firebase Auth
    const userRecord = await getAdminAuth().createUser({
      email,
      password,
      displayName,
      disabled: isActive === false
    });

    // 2. Create user document in Firestore
    await getAdminDb().collection("users").doc(userRecord.uid).set({
      email,
      displayName: displayName || "",
      role,
      storeIds: storeIds || [],
      isActive: isActive !== false,
      createdAt: new Date().toISOString(),
      createdBy: adminUid
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const adminUid = await verifyAdminEditor(req);
    if (!adminUid) {
      return NextResponse.json({ error: "Unauthorized. Admin Editor required." }, { status: 403 });
    }

    const body = await req.json();
    const { uid, email, password, displayName, role, storeIds, isActive } = body;

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

    // 2. Update in Firestore
    const firestoreData: any = {};
    if (email) firestoreData.email = email;
    if (displayName !== undefined) firestoreData.displayName = displayName;
    if (role) firestoreData.role = role;
    if (storeIds) firestoreData.storeIds = storeIds;
    if (isActive !== undefined) firestoreData.isActive = isActive;
    firestoreData.updatedAt = new Date().toISOString();
    firestoreData.updatedBy = adminUid;

    await getAdminDb().collection("users").doc(uid).update(firestoreData);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}
