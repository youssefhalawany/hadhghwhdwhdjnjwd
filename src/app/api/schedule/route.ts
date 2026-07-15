import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

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

    const docId = `${storeId}_${month}`;
    const adminDb = getAdminDb();
    const doc = await adminDb.collection('schedules').doc(docId).get();

    if (!doc.exists) {
      return NextResponse.json({ schedule: null });
    }

    return NextResponse.json({ schedule: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
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

    const docId = `${storeId}_${month}`;
    const scheduleData = {
      storeId,
      month,
      rules,
      assignments,
      isPublished: isPublished || false,
      updatedAt: new Date().toISOString()
    };

    const adminDb = getAdminDb();
    await adminDb.collection('schedules').doc(docId).set(scheduleData, { merge: true });

    return NextResponse.json({ success: true, schedule: { id: docId, ...scheduleData } });
  } catch (error) {
    console.error('Error saving schedule:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
