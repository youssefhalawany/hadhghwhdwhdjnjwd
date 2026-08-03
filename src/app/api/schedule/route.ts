import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { normalizeBranchId, getDbStoreId, getBranchDisplayName } from '@/lib/schedule-generator';

export const dynamic = 'force-dynamic';

// GET /api/schedule?storeId=...&month=YYYY-MM
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const month = searchParams.get('month') || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const adminDb = getAdminDb();
    
    // Fetch all schedule documents from Firestore admin
    const snapshot = await adminDb.collection('schedules').get();
    const allDocs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const monthDocs = allDocs.filter((d: any) => d.id.endsWith(`_${month}`));
    const docsToReturn = monthDocs.length > 0 ? monthDocs : allDocs;

    if (docsToReturn.length === 0) {
      return NextResponse.json({ schedule: null, schedules: [] });
    }

    let targetSchedule = null;
    if (storeId && storeId !== 'ALL' && storeId !== 'N/A') {
      const targetDbStoreId = getDbStoreId(storeId);
      targetSchedule = docsToReturn.find((s: any) =>
        s.id === `${targetDbStoreId}_${month}` ||
        s.id === `${storeId}_${month}` ||
        normalizeBranchId(s.storeId) === normalizeBranchId(storeId)
      );
    }

    if (!targetSchedule) {
      targetSchedule = docsToReturn[0];
    }

    return NextResponse.json({
      schedule: targetSchedule,
      schedules: monthDocs,
    });
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
