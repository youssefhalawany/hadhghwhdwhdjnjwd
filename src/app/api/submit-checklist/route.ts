import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Add server timestamp to the data
    const checklistData = {
      ...data,
      serverTimestamp: new Date().toISOString()
    };

    const adminDb = getAdminDb();
    const docRef = await adminDb.collection("audited_checklists").add(checklistData);

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error: any) {
    console.error("Error submitting checklist via API:", error);
    return NextResponse.json(
      { error: "Failed to submit checklist", details: error.message },
      { status: 500 }
    );
  }
}
