export interface Employee {
  id: string;
  name: string;
  position?: string;
  storeId?: string;
  branchId?: string;
  shiftTime?: string;
  status?: string; // 'active' | 'suspended'
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string; // YYYY-MM-DD
  type?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ScheduleRules {
  minEmployeesMorning?: number;
  minEmployeesNoon?: number;
  minEmployeesNight?: number;
  maxDaysOffPerMonth?: number;
  allowConsecutiveDaysOff?: boolean;
  maxConsecutiveDaysOff?: number;
  defaultShift?: string;
}

export interface ShiftAssignment {
  employeeId: string;
  employeeName: string;
  position?: string;
  shiftTime: string; // "Morning" | "Noon" | "Night" | "Off" | "Off (Approved Leave)" | "Custom"
  isBorrowed?: boolean;
  borrowedFrom?: string;
  notes?: string;
}

export interface DailySchedule {
  date: string; // YYYY-MM-DD
  shifts: ShiftAssignment[];
}

export interface MonthlySchedule {
  id?: string;
  month: string; // YYYY-MM
  storeId: string;
  branchName?: string;
  rules?: ScheduleRules;
  assignments: DailySchedule[];
  isPublished: boolean;
  updatedAt?: string;
  publishedAt?: string;
}

/**
 * Normalizes branch strings to standard IDs
 */
export function normalizeBranchId(input?: string): 'alamein4' | 'ola' | 'all' {
  if (!input) return 'alamein4';
  const low = input.toLowerCase().trim();
  if (low.includes('ola') || low.includes('koronfol')) return 'ola';
  if (low.includes('alamein') || low.includes('el-alamein')) return 'alamein4';
  if (low === 'all') return 'all';
  return 'alamein4';
}

export function getDbStoreId(branchId?: string): string {
  const norm = normalizeBranchId(branchId);
  return norm === 'ola' ? 'ola-el-koronfol' : 'eL-alamein-4';
}

export function getBranchDisplayName(storeId?: string): string {
  const norm = normalizeBranchId(storeId);
  return norm === 'ola' ? 'Ola El Koronfol' : 'El Alamein 4';
}

/**
 * Generates a clean, comprehensive monthly roster containing all active employees for the branch.
 * Approved leaves are automatically marked as 'Off (Approved Leave)'.
 * Existing manual edits can be preserved if provided.
 */
export function generateSchedule(
  month: string, // 'YYYY-MM'
  employees: Employee[],
  leaveRequests: LeaveRequest[] = [],
  rules: ScheduleRules = {},
  existingAssignments?: DailySchedule[]
): MonthlySchedule {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10) - 1; // JS 0-indexed month
  
  const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
  
  // Filter active employees only
  const activeEmployees = employees.filter(e => e.status === undefined || e.status === 'active');
  
  // Map existing assignments for fast lookup by date + employeeId
  const existingMap = new Map<string, ShiftAssignment>();
  if (existingAssignments && existingAssignments.length > 0) {
    existingAssignments.forEach(day => {
      day.shifts.forEach(shift => {
        existingMap.set(`${day.date}_${shift.employeeId}`, shift);
        existingMap.set(`${day.date}_${shift.employeeName.trim().toLowerCase()}`, shift);
      });
    });
  }

  const assignments: DailySchedule[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Find approved leaves for this date
    const leavesToday = leaveRequests.filter(
      r => r.date === dateStr && r.status === 'approved'
    );
    const employeeIdsOnLeave = new Set(leavesToday.map(r => r.employeeId));
    const employeeNamesOnLeave = new Set(leavesToday.map(r => r.employeeName?.trim().toLowerCase()).filter(Boolean));

    const dailyShifts: ShiftAssignment[] = [];

    for (const emp of activeEmployees) {
      const isLeave = employeeIdsOnLeave.has(emp.id) || employeeNamesOnLeave.has(emp.name.trim().toLowerCase());
      
      if (isLeave) {
        dailyShifts.push({
          employeeId: emp.id,
          employeeName: emp.name,
          position: emp.position || 'Staff',
          shiftTime: 'Off (Approved Leave)'
        });
        continue;
      }

      // Check if there was an existing manually saved shift
      const existing = existingMap.get(`${dateStr}_${emp.id}`) || existingMap.get(`${dateStr}_${emp.name.trim().toLowerCase()}`);
      if (existing) {
        dailyShifts.push({
          ...existing,
          employeeId: emp.id,
          employeeName: emp.name,
          position: emp.position || existing.position || 'Staff'
        });
        continue;
      }

      // Assign default shift (from employee profile or fallback to Morning)
      const defaultShift = emp.shiftTime && emp.shiftTime !== 'All' ? emp.shiftTime : (rules.defaultShift || 'Morning');
      dailyShifts.push({
        employeeId: emp.id,
        employeeName: emp.name,
        position: emp.position || 'Staff',
        shiftTime: defaultShift
      });
    }

    assignments.push({
      date: dateStr,
      shifts: dailyShifts
    });
  }

  return {
    month,
    storeId: (employees.length > 0 && employees[0].storeId) ? employees[0].storeId : 'eL-alamein-4',
    branchName: getBranchDisplayName((employees.length > 0 && employees[0].storeId) ? employees[0].storeId : 'eL-alamein-4'),
    rules: {
      minEmployeesMorning: rules.minEmployeesMorning ?? 2,
      minEmployeesNoon: rules.minEmployeesNoon ?? 0,
      minEmployeesNight: rules.minEmployeesNight ?? 2,
      maxDaysOffPerMonth: rules.maxDaysOffPerMonth ?? 4,
      allowConsecutiveDaysOff: rules.allowConsecutiveDaysOff ?? true,
      maxConsecutiveDaysOff: rules.maxConsecutiveDaysOff ?? 2,
      defaultShift: rules.defaultShift ?? 'Morning'
    },
    assignments,
    isPublished: false
  };
}
