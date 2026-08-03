import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { normalizeBranchId, getDbStoreId } from '@/lib/schedule-generator';

export const dynamic = 'force-dynamic';

// GET /api/schedule/leave-requests?storeId=... (or employeeId=...)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const employeeId = searchParams.get('employeeId');

    const adminDb = getAdminDb();
    let query: FirebaseFirestore.Query = adminDb.collection('leave_requests');

    if (employeeId) {
      query = query.where('employeeId', '==', employeeId);
    }

    const snapshot = await query.get();
    let requests = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    // Filter by branch normalization in memory if storeId is provided
    if (storeId && !employeeId) {
      const targetNorm = normalizeBranchId(storeId);
      requests = requests.filter((r: any) => {
        if (!r.storeId) return true;
        const reqNorm = normalizeBranchId(r.storeId);
        return targetNorm === 'all' || reqNorm === targetNorm;
      });
    }

    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error('Error fetching leave requests:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
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

    const targetDbStoreId = getDbStoreId(storeId);
    const requestData = {
      employeeId,
      employeeName: employeeName || 'Employee',
      storeId: targetDbStoreId,
      branchId: normalizeBranchId(storeId),
      date,
      type,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const adminDb = getAdminDb();
    const docRef = await adminDb.collection('leave_requests').add(requestData);

    return NextResponse.json({ success: true, request: { id: docRef.id, ...requestData } });
  } catch (error: any) {
    console.error('Error submitting leave request:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
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
  } catch (error: any) {
    console.error('Error updating leave request:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
