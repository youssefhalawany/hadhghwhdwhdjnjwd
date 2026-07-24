import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET() {
  if (!adminDb) return NextResponse.json({ error: "No admin db" });

  try {
    const usersSnap = await adminDb.collection("users").get();
    let ibrahimDoc: any = null;
    let found: any[] = [];

    usersSnap.forEach(doc => {
      const data = doc.data();
      const email = (data.email || "").toLowerCase();
      const name = (data.displayName || data.name || "").toLowerCase();
      
      if (email.includes("ibrahim") || name.includes("ibrahim")) {
        found.push({ id: doc.id, email, name, role: data.role });
        ibrahimDoc = doc;
      }
    });

    if (found.length === 1) {
      await ibrahimDoc.ref.update({ role: "admin_viewer" });
      return NextResponse.json({ success: true, message: "Updated exactly one ibrahim", user: found[0] });
    } else if (found.length > 1) {
      return NextResponse.json({ success: false, message: "Multiple ibrahims found", users: found });
    } else {
      return NextResponse.json({ success: false, message: "No ibrahim found" });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
