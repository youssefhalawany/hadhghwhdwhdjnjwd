import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { paymentId, invoiceDataUrl } = await req.json();

    if (!invoiceDataUrl || !paymentId) {
      return NextResponse.json({ error: "Missing invoiceDataUrl or paymentId" }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Firebase Admin not initialized" }, { status: 500 });
    }

    // Update Firestore document directly with the compressed base64 string
    await adminDb.collection("cash_payments").doc(paymentId).update({
      invoiceUrl: invoiceDataUrl,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true, invoiceUrl: invoiceDataUrl });
  } catch (error: any) {
    console.error("Upload API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get("paymentId");
  
  if (!paymentId) return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });

  if (!adminDb) {
    return NextResponse.json({ error: "Firebase Admin not initialized" }, { status: 500 });
  }
  
  try {
    const docSnap = await adminDb.collection("cash_payments").doc(paymentId).get();
    if (docSnap.exists) {
      return NextResponse.json(docSnap.data());
    } else {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch (error: any) {
    console.error("Get API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
