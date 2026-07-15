import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

// GET /api/schedule/leave-requests?storeId=... (or employeeId=...)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const employeeId = searchParams.get('employeeId');

    const adminDb = getAdminDb();
    let query: FirebaseFirestore.Query = adminDb.collection('leave_requests');

    if (storeId) {
      query = query.where('storeId', '==', storeId);
    }
    if (employeeId) {
      query = query.where('employeeId', '==', employeeId);
    }

    // Usually we would sort by date, but simple where is fine for now
    const snapshot = await query.get();
    
    const requests = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/schedule/leave-requests (Submit a new request)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, storeId, date, type, employeeName } = body;

    if (!employeeId || !storeId || !date || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const requestData = {
      employeeId,
      employeeName,
      storeId,
      date,
      type,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const adminDb = getAdminDb();
    const docRef = await adminDb.collection('leave_requests').add(requestData);

    return NextResponse.json({ success: true, request: { id: docRef.id, ...requestData } });
  } catch (error) {
    console.error('Error submitting leave request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/schedule/leave-requests (Approve/Reject)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { requestId, status } = body;

    if (!requestId || !status) {
      return NextResponse.json({ error: 'Missing requestId or status' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    await adminDb.collection('leave_requests').doc(requestId).update({
      status,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating leave request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
