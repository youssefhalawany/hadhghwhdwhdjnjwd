import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const adminDb = getAdminDb();
    const docRef = adminDb.collection("audited_checklists").doc(id);
    const snapshot = await docRef.get();
    
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      id: snapshot.id,
      ...snapshot.data()
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch checklist", details: error.message }, { status: 500 });
  }
}
