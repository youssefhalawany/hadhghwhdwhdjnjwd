import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const paymentId = formData.get("paymentId") as string;

    if (!file || !paymentId) {
      return NextResponse.json({ error: "Missing file or paymentId" }, { status: 400 });
    }

    if (!adminDb || !adminStorage) {
      return NextResponse.json({ error: "Firebase Admin not initialized" }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Upload to Firebase Storage using the default bucket
    const bucket = adminStorage.bucket('ckkk-576e7.firebasestorage.app');
    const fileRef = bucket.file(`invoices/${paymentId}_${Date.now()}`);
    
    await fileRef.save(buffer, {
      metadata: { contentType: file.type }
    });
    
    // Make the file publicly readable
    await fileRef.makePublic();
    const invoiceUrl = fileRef.publicUrl();

    // Update Firestore document
    await adminDb.collection("cash_payments").doc(paymentId).update({
      invoiceUrl,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true, invoiceUrl });
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
