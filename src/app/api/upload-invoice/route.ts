import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { paymentId, invoiceDataUrls, type, invoiceDataUrl } = await req.json();

    const urls = invoiceDataUrls || (invoiceDataUrl ? [invoiceDataUrl] : []);

    if (!urls || urls.length === 0 || !paymentId) {
      return NextResponse.json({ error: "Missing invoice data or paymentId" }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Firebase Admin not initialized" }, { status: 500 });
    }

    const collectionName = type === "credit" ? "credits" : "cash_payments";
    
    // We update both invoiceUrls and poUrls for credits for full compatibility across all views
    const updateField = type === "credit" 
      ? { poUrls: urls, poUrl: urls[0], invoiceUrls: urls, invoiceUrl: urls[0] } 
      : { invoiceUrls: urls, invoiceUrl: urls[0] };

    // Update Firestore document directly with the compressed base64 strings
    await adminDb.collection(collectionName).doc(paymentId).set({
      ...updateField,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ success: true, invoiceUrls: urls });
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
      // Normalize returned data so frontend can just check `invoiceUrls`
      if (type === "credit") {
        return NextResponse.json({ ...data, invoiceUrls: data?.poUrls || (data?.poUrl ? [data.poUrl] : []) });
      }
      return NextResponse.json({ ...data, invoiceUrls: data?.invoiceUrls || (data?.invoiceUrl ? [data.invoiceUrl] : []) });
    } else {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch (error: any) {
    console.error("Get API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
