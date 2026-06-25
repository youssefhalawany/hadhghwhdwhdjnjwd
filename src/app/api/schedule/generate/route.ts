import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { generateSchedule, Employee, LeaveRequest } from '@/lib/schedule-generator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { storeId, month, rules } = body;

    if (!storeId || !month || !rules) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch active employees for this store
    const adminDb = getAdminDb();
    const employeesSnapshot = await adminDb.collection('employees')
      .where('storeId', '==', storeId)
      .where('status', '==', 'active')
      .get();
      
    const employees: Employee[] = employeesSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      name: doc.data().name || 'Unknown',
      storeId: doc.data().storeId,
      shiftTime: doc.data().shiftTime,
      status: doc.data().status
    }));

    // Fetch approved leave requests for this store in this month
    // For simplicity we fetch all for the store and filter in memory since we need prefix matching on month
    const leavesSnapshot = await adminDb.collection('leave_requests')
      .where('storeId', '==', storeId)
      .where('status', '==', 'approved')
      .get();
      
    const leaveRequests: LeaveRequest[] = leavesSnapshot.docs
      .map((doc: any) => ({
        id: doc.id,
        employeeId: doc.data().employeeId,
        date: doc.data().date,
        status: doc.data().status as any
      }))
      .filter((req: any) => req.date.startsWith(month));

    // Generate schedule
    const newSchedule = generateSchedule(month, employees, leaveRequests, rules);

    // Save to Firestore
    const docId = `${storeId}_${month}`;
    const scheduleData = {
      ...newSchedule,
      updatedAt: new Date().toISOString()
    };
    
    await adminDb.collection('schedules').doc(docId).set(scheduleData);

    return NextResponse.json({ success: true, schedule: { id: docId, ...scheduleData } });
  } catch (error) {
    console.error('Error generating schedule:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
