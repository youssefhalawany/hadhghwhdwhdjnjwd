export interface Employee {
  id: string;
  name: string;
  storeId: string;
  shiftTime?: string;
  status: string; // 'active' or something else
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: 'pending' | 'approved' | 'rejected';
}

export interface ScheduleRules {
  minEmployeesPerShift: number;
  maxDaysOffPerMonth: number;
  allowConsecutiveDaysOff: boolean;
  maxConsecutiveDaysOff: number;
}

export interface DailySchedule {
  date: string; // YYYY-MM-DD
  shifts: {
    employeeId: string;
    employeeName: string;
    shiftTime: string; // e.g. "Night", "9-5", or "Off"
  }[];
}

export interface MonthlySchedule {
  month: string; // YYYY-MM
  storeId: string;
  rules: ScheduleRules;
  assignments: DailySchedule[];
  isPublished: boolean;
}

export function generateSchedule(
  month: string, // 'YYYY-MM'
  employees: Employee[],
  leaveRequests: LeaveRequest[],
  rules: ScheduleRules
): MonthlySchedule {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10) - 1; // JS months are 0-indexed
  
  const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
  
  const activeEmployees = employees.filter(e => e.status === 'active');
  
  // Initialize schedule structure
  const assignments: DailySchedule[] = [];
  
  // Track days off per employee
  const daysOffCount: Record<string, number> = {};
  const consecutiveDaysOff: Record<string, number> = {};
  activeEmployees.forEach(e => {
    daysOffCount[e.id] = 0;
    consecutiveDaysOff[e.id] = 0;
  });

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Find approved leaves for today
    const leavesToday = leaveRequests.filter(
      r => r.date === dateStr && r.status === 'approved'
    );
    const employeesOnLeave = leavesToday.map(r => r.employeeId);
    
    const dailyShifts: DailySchedule['shifts'] = [];
    
    let scheduledCount = 0;
    // Sort available employees: 
    // Prioritize those who have the LEAST days off so far, to distribute days off evenly.
    const availableEmployees = [...activeEmployees].sort((a, b) => daysOffCount[a.id] - daysOffCount[b.id]);
    
    // First, assign "Off" to everyone who has an approved leave request
    for (const emp of availableEmployees) {
      const isOnLeave = employeesOnLeave.includes(emp.id);
      if (isOnLeave) {
        dailyShifts.push({
          employeeId: emp.id,
          employeeName: emp.name,
          shiftTime: 'Off (Approved Leave)'
        });
        daysOffCount[emp.id]++;
        consecutiveDaysOff[emp.id]++;
      }
    }
    
    // Now, see who else we can give a day off to, based on rules
    for (const emp of availableEmployees) {
      if (employeesOnLeave.includes(emp.id)) continue; // Already handled
      
      const scheduledCount = dailyShifts.filter(s => s.shiftTime !== 'Off (Approved Leave)' && s.shiftTime !== 'Off').length;
      const remainingToSchedule = availableEmployees.length - dailyShifts.length;
      
      let assignOff = false;
      
      // Can they take a day off?
      const canTakeDayOff = daysOffCount[emp.id] < rules.maxDaysOffPerMonth;
      
      // Consecutive days off check
      let consecutiveCheckPass = true;
      if (!rules.allowConsecutiveDaysOff && consecutiveDaysOff[emp.id] >= 1) {
        consecutiveCheckPass = false;
      }
      if (rules.allowConsecutiveDaysOff && consecutiveDaysOff[emp.id] >= rules.maxConsecutiveDaysOff) {
        consecutiveCheckPass = false;
      }
      
      // Check if assigning this person "Off" breaks the minimum staff rule
      // If we give them off, the maximum possible staff scheduled today would be scheduledCount + remainingToSchedule - 1
      const maxPossibleStaffIfOff = scheduledCount + remainingToSchedule - 1;
      const minStaffMet = maxPossibleStaffIfOff >= rules.minEmployeesPerShift;
      
      // "only 1 employee can take a day off a time or if i have the right amout its okay"
      // If we assign off, will we still have enough? minStaffMet answers this.
      
      if (canTakeDayOff && consecutiveCheckPass && minStaffMet) {
        assignOff = true;
      }
      
      if (assignOff) {
        dailyShifts.push({
          employeeId: emp.id,
          employeeName: emp.name,
          shiftTime: 'Off'
        });
        daysOffCount[emp.id]++;
        consecutiveDaysOff[emp.id]++;
      } else {
        dailyShifts.push({
          employeeId: emp.id,
          employeeName: emp.name,
          shiftTime: emp.shiftTime || 'Scheduled'
        });
        consecutiveDaysOff[emp.id] = 0;
      }
    }
    
    assignments.push({
      date: dateStr,
      shifts: dailyShifts
    });
  }

  return {
    month,
    storeId: employees.length > 0 ? employees[0].storeId : '',
    rules,
    assignments,
    isPublished: false
  };
}
