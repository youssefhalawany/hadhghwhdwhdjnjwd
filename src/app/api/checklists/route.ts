import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const adminDb = getAdminDb();
    const snapshot = await adminDb.collection("audited_checklists").orderBy("createdAt", "desc").limit(50).get();
    
    const checklists = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return NextResponse.json({ checklists });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch checklists", details: error.message }, { status: 500 });
  }
}
