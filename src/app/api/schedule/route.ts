import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { normalizeBranchId, getDbStoreId, getBranchDisplayName } from '@/lib/schedule-generator';

export const dynamic = 'force-dynamic';

// GET /api/schedule?storeId=...&month=YYYY-MM
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const month = searchParams.get('month');

    if (!storeId || !month) {
      return NextResponse.json({ error: 'Missing storeId or month' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const targetDbStoreId = getDbStoreId(storeId);
    
    // Try primary canonical ID first
    let docId = `${targetDbStoreId}_${month}`;
    let docSnap = await adminDb.collection('schedules').doc(docId).get();

    // Fallback if saved with raw storeId
    if (!docSnap.exists && storeId !== targetDbStoreId) {
      const fallbackDocId = `${storeId}_${month}`;
      const fallbackSnap = await adminDb.collection('schedules').doc(fallbackDocId).get();
      if (fallbackSnap.exists) {
        docSnap = fallbackSnap;
        docId = fallbackDocId;
      }
    }

    if (!docSnap.exists) {
      return NextResponse.json({ schedule: null });
    }

    return NextResponse.json({ schedule: { id: docSnap.id, ...docSnap.data() } });
  } catch (error: any) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/schedule (Save or update schedule)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeId, month, rules, assignments, isPublished } = body;

    if (!storeId || !month) {
      return NextResponse.json({ error: 'Missing storeId or month' }, { status: 400 });
    }

    const targetDbStoreId = getDbStoreId(storeId);
    const docId = `${targetDbStoreId}_${month}`;
    
    const scheduleData = {
      storeId: targetDbStoreId,
      branchName: getBranchDisplayName(targetDbStoreId),
      month,
      rules: rules || {},
      assignments: assignments || [],
      isPublished: isPublished ?? false,
      updatedAt: new Date().toISOString(),
      ...(isPublished ? { publishedAt: new Date().toISOString() } : {})
    };

    const adminDb = getAdminDb();
    await adminDb.collection('schedules').doc(docId).set(scheduleData, { merge: true });

    // Also write alias doc if storeId differed
    if (storeId !== targetDbStoreId) {
      await adminDb.collection('schedules').doc(`${storeId}_${month}`).set(scheduleData, { merge: true }).catch(() => {});
    }

    return NextResponse.json({ success: true, schedule: { id: docId, ...scheduleData } });
  } catch (error: any) {
    console.error('Error saving schedule:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
