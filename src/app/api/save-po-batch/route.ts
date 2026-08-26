import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      batchId, 
      supplier, 
      invoiceNumber, 
      invoiceDate, 
      items, 
      branchId, 
      storeId, 
      createdBy, 
      poImage 
    } = body;

    if (!supplier || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required supplier or items data" }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Firebase Admin DB not initialized" }, { status: 500 });
    }

    const nowIso = new Date().toISOString();
    const effectiveBatchId = batchId || `BATCH-${supplier.slice(0,6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const effectiveBranch = branchId || "alamein4";
    const effectiveStore = storeId || (effectiveBranch === "ola" ? "ola-el-koronfol" : "eL-alamein-4");

    // 1. Create the master batch document in `expiry_batches`
    const batchDocRef = await adminDb.collection("expiry_batches").add({
      batchId: effectiveBatchId,
      supplier: supplier.trim(),
      invoiceNumber: invoiceNumber || "N/A",
      invoiceDate: invoiceDate || nowIso.split("T")[0],
      totalItemsCount: items.length,
      totalQuantityCount: items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0),
      branchId: effectiveBranch,
      storeId: effectiveStore,
      createdBy: createdBy || "Store Manager",
      createdAt: nowIso,
      poImageUrl: poImage ? "has_image" : null,
      status: "active"
    });

    // 2. Batch write all items to `expiries` collection
    const batch = adminDb.batch();
    
    items.forEach((item: any) => {
      const docRef = adminDb.collection("expiries").doc();
      batch.set(docRef, {
        itemName: (item.itemName || item.description || "Unnamed Item").trim(),
        barcode: item.barcode?.trim() || "N/A",
        quantity: Math.max(1, Number(item.quantity) || 1),
        initialQuantity: Math.max(1, Number(item.quantity) || 1),
        soldQuantity: 0,
        unitPrice: Number(item.unitPrice) || 0,
        expiryDate: item.expiryDate || nowIso.split("T")[0],
        supplier: supplier.trim(),
        batchId: effectiveBatchId,
        batchDocId: batchDocRef.id,
        invoiceNumber: invoiceNumber || "N/A",
        poDate: invoiceDate || nowIso.split("T")[0],
        branchId: effectiveBranch,
        storeId: effectiveStore,
        status: "active",
        createdBy: createdBy || "Store Manager",
        createdAt: nowIso,
        notes: `Received via PO batch: ${effectiveBatchId}`
      });
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      batchId: effectiveBatchId,
      batchDocId: batchDocRef.id,
      itemsCount: items.length
    });
  } catch (error: any) {
    console.error("Save PO Batch API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to save PO batch" }, { status: 500 });
  }
}
