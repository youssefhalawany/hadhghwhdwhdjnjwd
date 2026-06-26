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
  minEmployeesMorning: number;
  minEmployeesNoon: number;
  minEmployeesNight: number;
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
  
  const assignments: DailySchedule[] = [];
  
  const daysOffCount: Record<string, number> = {};
  const consecutiveDaysOff: Record<string, number> = {};
  
  activeEmployees.forEach(e => {
    daysOffCount[e.id] = 0;
    consecutiveDaysOff[e.id] = 0;
  });

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const remainingDaysInMonth = daysInMonth - day;
    
    // Find approved leaves for today
    const leavesToday = leaveRequests.filter(
      r => r.date === dateStr && r.status === 'approved'
    );
    const employeesOnLeave = leavesToday.map(r => r.employeeId);
    
    const dailyShifts: DailySchedule['shifts'] = [];
    
    // 1. Assign approved leaves
    for (const emp of activeEmployees) {
      if (employeesOnLeave.includes(emp.id)) {
        dailyShifts.push({
          employeeId: emp.id,
          employeeName: emp.name,
          shiftTime: 'Off (Approved Leave)'
        });
        daysOffCount[emp.id]++;
        consecutiveDaysOff[emp.id]++;
      }
    }
    
    // 2. Sort available employees by priority for a day off
    const availableEmployees = activeEmployees.filter(e => !employeesOnLeave.includes(e.id));
    
    availableEmployees.sort((a, b) => {
      // Priority 1: Force day off if they are running out of days in the month to take their required days off
      const aNeedsForce = (rules.maxDaysOffPerMonth - daysOffCount[a.id]) >= remainingDaysInMonth + 1;
      const bNeedsForce = (rules.maxDaysOffPerMonth - daysOffCount[b.id]) >= remainingDaysInMonth + 1;
      if (aNeedsForce !== bNeedsForce) return aNeedsForce ? -1 : 1;
      
      // Priority 2: Stagger consecutive days off
      // If rules allow consecutive, prioritize someone who already has a consecutive streak started
      // but hasn't reached the max yet.
      if (rules.allowConsecutiveDaysOff) {
        const aWantsConsecutive = consecutiveDaysOff[a.id] > 0 && consecutiveDaysOff[a.id] < rules.maxConsecutiveDaysOff;
        const bWantsConsecutive = consecutiveDaysOff[b.id] > 0 && consecutiveDaysOff[b.id] < rules.maxConsecutiveDaysOff;
        if (aWantsConsecutive !== bWantsConsecutive) return aWantsConsecutive ? -1 : 1;
      }
      
      // Priority 3: Least total days off
      return daysOffCount[a.id] - daysOffCount[b.id];
    });
    
    // 3. Assign Off or Scheduled based on rules
    const totalAvailableByShift: Record<string, number> = { Morning: 0, Noon: 0, Night: 0, Scheduled: 0 };
    availableEmployees.forEach(emp => {
      const shift = emp.shiftTime || 'Scheduled';
      totalAvailableByShift[shift] = (totalAvailableByShift[shift] || 0) + 1;
    });

    const givenOffByShift: Record<string, number> = { Morning: 0, Noon: 0, Night: 0, Scheduled: 0 };
    
    for (const emp of availableEmployees) {
      const shift = emp.shiftTime || 'Scheduled';
      const canTakeDayOff = daysOffCount[emp.id] < rules.maxDaysOffPerMonth;
      
      let consecutiveCheckPass = true;
      if (!rules.allowConsecutiveDaysOff && consecutiveDaysOff[emp.id] >= 1) {
        consecutiveCheckPass = false;
      }
      if (rules.allowConsecutiveDaysOff && consecutiveDaysOff[emp.id] >= rules.maxConsecutiveDaysOff) {
        consecutiveCheckPass = false;
      }
      
      // Will we drop below minEmployees for THIS specific shift if we give this person off?
      const workingIfGivenOff = totalAvailableByShift[shift] - givenOffByShift[shift] - 1;
      
      let minStaffMet = true;
      if (shift === 'Morning') {
        minStaffMet = workingIfGivenOff >= rules.minEmployeesMorning;
      } else if (shift === 'Noon') {
        minStaffMet = workingIfGivenOff >= rules.minEmployeesNoon;
      } else if (shift === 'Night') {
        minStaffMet = workingIfGivenOff >= rules.minEmployeesNight;
      } else {
        minStaffMet = workingIfGivenOff >= 1; // Generic fallback
      }
      
      const needsForce = (rules.maxDaysOffPerMonth - daysOffCount[emp.id]) >= remainingDaysInMonth + 1;
      let preferredMaxOffMet = true;
      // Prefer giving only 1 person off per shift, UNLESS they are running out of days in the month
      if (!needsForce && givenOffByShift[shift] >= 1) {
        preferredMaxOffMet = false;
      }
      
      if (canTakeDayOff && consecutiveCheckPass && minStaffMet && preferredMaxOffMet) {
        // Give day off
        dailyShifts.push({
          employeeId: emp.id,
          employeeName: emp.name,
          shiftTime: 'Off'
        });
        daysOffCount[emp.id]++;
        consecutiveDaysOff[emp.id]++;
        givenOffByShift[shift]++;
      } else {
        // Must work
        dailyShifts.push({
          employeeId: emp.id,
          employeeName: emp.name,
          shiftTime: shift
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
