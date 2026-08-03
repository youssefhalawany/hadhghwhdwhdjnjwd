import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { 
  generateSchedule, 
  Employee, 
  LeaveRequest, 
  normalizeBranchId, 
  getDbStoreId, 
  getBranchDisplayName 
} from '@/lib/schedule-generator';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeId, month, rules, preserveEdits } = body;

    if (!storeId || !month) {
      return NextResponse.json({ error: 'Missing storeId or month' }, { status: 400 });
    }

    const targetBranchNorm = normalizeBranchId(storeId);
    const targetDbStoreId = getDbStoreId(storeId);
    const adminDb = getAdminDb();

    // 1. Fetch from 'employees' collection
    const [employeesSnap, cashiersSnap] = await Promise.all([
      adminDb.collection('employees').get().catch(() => ({ docs: [] })),
      adminDb.collection('cashiers').get().catch(() => ({ docs: [] }))
    ]);

    const activeEmployeesMap = new Map<string, Employee>();

    // Process 'employees' collection (primary HR record)
    employeesSnap.docs.forEach((doc: any) => {
      const data = doc.data();
      const empBranchNorm = normalizeBranchId(data.storeId || data.branchId);
      
      const isTargetBranch = targetBranchNorm === 'all' || empBranchNorm === targetBranchNorm;
      const isActive = data.status === undefined || data.status === 'active';

      if (isTargetBranch && isActive && data.name) {
        const key = data.name.trim().toLowerCase();
        activeEmployeesMap.set(key, {
          id: doc.id,
          name: data.name.trim(),
          position: data.position || 'Staff',
          storeId: targetDbStoreId,
          branchId: targetBranchNorm,
          shiftTime: data.shiftTime || 'Morning',
          status: 'active'
        });
      }
    });

    // Process 'cashiers' collection (to include cashier logins not in employees collection)
    cashiersSnap.docs.forEach((doc: any) => {
      const data = doc.data();
      const cashierBranchNorm = normalizeBranchId(data.storeId || data.branchId);
      const isTargetBranch = targetBranchNorm === 'all' || cashierBranchNorm === targetBranchNorm;
      const isActive = data.isActive !== false && data.status !== 'suspended';

      if (isTargetBranch && isActive && data.name) {
        const key = data.name.trim().toLowerCase();
        if (!activeEmployeesMap.has(key)) {
          activeEmployeesMap.set(key, {
            id: doc.id,
            name: data.name.trim(),
            position: data.position || data.role || 'Cashier',
            storeId: targetDbStoreId,
            branchId: targetBranchNorm,
            shiftTime: data.shiftType && data.shiftType !== 'All' ? data.shiftType : 'Morning',
            status: 'active'
          });
        }
      }
    });

    const employeesList: Employee[] = Array.from(activeEmployeesMap.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    // 2. Fetch approved leave requests for this branch and month
    const leavesSnap = await adminDb.collection('leave_requests')
      .where('status', '==', 'approved')
      .get()
      .catch(() => ({ docs: [] }));

    const leaveRequests: LeaveRequest[] = leavesSnap.docs
      .map((doc: any) => ({
        id: doc.id,
        employeeId: doc.data().employeeId,
        employeeName: doc.data().employeeName,
        storeId: doc.data().storeId,
        date: doc.data().date,
        status: doc.data().status
      }))
      .filter((req: any) => {
        const reqBranch = normalizeBranchId(req.storeId);
        const matchBranch = targetBranchNorm === 'all' || reqBranch === targetBranchNorm;
        return matchBranch && req.date && req.date.startsWith(month);
      });

    // 3. Check for existing schedule to preserve manual changes if requested
    let existingAssignments: any[] = [];
    const docId = `${targetDbStoreId}_${month}`;
    
    if (preserveEdits) {
      const existingDoc = await adminDb.collection('schedules').doc(docId).get();
      if (existingDoc.exists) {
        existingAssignments = existingDoc.data()?.assignments || [];
      }
    }

    // 4. Generate schedule roster
    const newSchedule = generateSchedule(
      month,
      employeesList,
      leaveRequests,
      rules || {},
      existingAssignments
    );

    // 5. Save to Firestore
    const scheduleData = {
      ...newSchedule,
      storeId: targetDbStoreId,
      branchName: getBranchDisplayName(targetDbStoreId),
      updatedAt: new Date().toISOString()
    };

    await adminDb.collection('schedules').doc(docId).set(scheduleData);

    return NextResponse.json({ 
      success: true, 
      schedule: { id: docId, ...scheduleData },
      employeeCount: employeesList.length
    });
  } catch (error: any) {
    console.error('Error generating schedule:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
