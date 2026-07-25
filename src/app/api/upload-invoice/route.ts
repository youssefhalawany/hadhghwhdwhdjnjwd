import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { paymentId, invoiceDataUrl, type } = await req.json();

    if (!invoiceDataUrl || !paymentId) {
      return NextResponse.json({ error: "Missing invoiceDataUrl or paymentId" }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Firebase Admin not initialized" }, { status: 500 });
    }

    const collectionName = type === "credit" ? "credits" : "cash_payments";
    const updateField = type === "credit" ? { poUrl: invoiceDataUrl } : { invoiceUrl: invoiceDataUrl };

    // Update Firestore document directly with the compressed base64 string
    await adminDb.collection(collectionName).doc(paymentId).update({
      ...updateField,
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
  const type = searchParams.get("type");
  
  if (!paymentId) return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });

  if (!adminDb) {
    return NextResponse.json({ error: "Firebase Admin not initialized" }, { status: 500 });
  }
  
  try {
    const collectionName = type === "credit" ? "credits" : "cash_payments";
    const docSnap = await adminDb.collection(collectionName).doc(paymentId).get();
    
    if (docSnap.exists) {
      const data = docSnap.data();
      // Normalize returned data so frontend can just check `invoiceUrl`
      if (type === "credit" && data?.poUrl) {
        return NextResponse.json({ ...data, invoiceUrl: data.poUrl });
      }
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch (error: any) {
    console.error("Get API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
