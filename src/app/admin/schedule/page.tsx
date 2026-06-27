"use client";

import { useState, useEffect } from "react";
import { 
  CalendarDays, Settings, Users, CheckCircle, 
  XCircle, Printer, Send, RefreshCw, AlertCircle, BarChart3, Plus 
} from "lucide-react";
import ClientLayoutWrapper from "@/components/ClientLayoutWrapper";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function AdminSchedulePage() {
  const [storeId, setStoreId] = useState("eL-alamein-4");
  const [month, setMonth] = useState("");
  const [schedule, setSchedule] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'analytics'>('roster');
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [showBorrowModal, setShowBorrowModal] = useState<number | null>(null); // dayIndex
  const [borrowSelectedEmp, setBorrowSelectedEmp] = useState<any>(null);
  const [borrowShiftTime, setBorrowShiftTime] = useState("Morning");
  const [rules, setRules] = useState({
    minEmployeesMorning: 2,
    minEmployeesNoon: 0,
    minEmployeesNight: 2,
    maxDaysOffPerMonth: 4,
    allowConsecutiveDaysOff: true,
    maxConsecutiveDaysOff: 2
  });

  useEffect(() => {
    // Set default month to next month
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);

    // Fetch all employees for borrowing feature
    const fetchAllEmps = async () => {
      try {
        const snap = await getDocs(collection(db, "cashiers"));
        const emps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllEmployees(emps);
      } catch (err) {
        console.error("Failed to load cashiers", err);
      }
    };
    fetchAllEmps();
  }, []);

  useEffect(() => {
    if (storeId && month) {
      fetchData();
    }
  }, [storeId, month]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Schedule
      const res = await fetch(`/api/schedule?storeId=${storeId}&month=${month}`);
      const data = await res.json();
      setSchedule(data.schedule);

      if (data.schedule?.rules) {
        setRules(data.schedule.rules);
      }

      // Fetch Leave Requests
      const leaveRes = await fetch(`/api/schedule/leave-requests?storeId=${storeId}`);
      const leaveData = await leaveRes.json();
      // Filter for this month
      const monthRequests = leaveData.requests.filter((r: any) => r.date.startsWith(month));
      setLeaveRequests(monthRequests);

    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, month, rules })
      });
      const data = await res.json();
      if (data.success) {
        setSchedule(data.schedule);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handlePublish = async () => {
    if (!schedule) return;
    setLoading(true);
    try {
      const updated = { ...schedule, isPublished: true };
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      setSchedule(updated);
      alert('Schedule Published successfully!');
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleLeaveAction = async (requestId: string, status: string) => {
    try {
      await fetch('/api/schedule/leave-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <ClientLayoutWrapper>
      <div className="p-6 max-w-7xl mx-auto min-h-screen">
        {/* Header - Hidden on Print */}
        <div className="print:hidden mb-8 flex justify-between items-center bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              Smart Scheduler
            </h1>
            <p className="text-muted-foreground mt-1">Generate & manage employee rosters automatically.</p>
          </div>
          <div className="flex space-x-4">
            <select 
              value={storeId} 
              onChange={(e) => setStoreId(e.target.value)}
              className="bg-background border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="eL-alamein-4">El Alamein 4</option>
              <option value="ola-el-koronfol">Ola El Koronfol</option>
            </select>
            <input 
              type="month" 
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-background border border-border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
          
          {/* Left Column: Rules & Requests (Hidden on Print) */}
          <div className="lg:col-span-1 space-y-6 print:hidden">
            
            {/* Rules Builder */}
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <div className="flex items-center space-x-2 mb-4">
                <Settings className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold">Generation Rules</h2>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-3">
                    <label className="text-sm text-muted-foreground mb-1 block">Min Employees Per Shift</label>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block text-center">Morning</label>
                    <input 
                      type="number" min={0}
                      value={rules.minEmployeesMorning || 0}
                      onChange={(e) => setRules({...rules, minEmployeesMorning: parseInt(e.target.value) || 0})}
                      className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-center focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block text-center">Noon</label>
                    <input 
                      type="number" min={0}
                      value={rules.minEmployeesNoon || 0}
                      onChange={(e) => setRules({...rules, minEmployeesNoon: parseInt(e.target.value) || 0})}
                      className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-center focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block text-center">Night</label>
                    <input 
                      type="number" min={0}
                      value={rules.minEmployeesNight || 0}
                      onChange={(e) => setRules({...rules, minEmployeesNight: parseInt(e.target.value) || 0})}
                      className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-center focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Max Days Off/Month</label>
                  <input 
                    type="number" min={0}
                    value={rules.maxDaysOffPerMonth}
                    onChange={(e) => setRules({...rules, maxDaysOffPerMonth: parseInt(e.target.value)})}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-muted-foreground">Consecutive Days Off</label>
                  <input 
                    type="checkbox"
                    checked={rules.allowConsecutiveDaysOff}
                    onChange={(e) => setRules({...rules, allowConsecutiveDaysOff: e.target.checked})}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                </div>
                {rules.allowConsecutiveDaysOff && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Max Consecutive</label>
                    <input 
                      type="number" min={1}
                      value={rules.maxConsecutiveDaysOff}
                      onChange={(e) => setRules({...rules, maxConsecutiveDaysOff: parseInt(e.target.value)})}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}
                
                <button 
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full mt-4 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                  <span>Auto-Generate Schedule</span>
                </button>
              </div>
            </div>

            {/* Leave Requests Inbox */}
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-orange-400" />
                  <h2 className="text-lg font-semibold">Leave Requests</h2>
                </div>
                <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-1 rounded-full">
                  {leaveRequests.filter(r => r.status === 'pending').length} Pending
                </span>
              </div>
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {leaveRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No requests this month.</p>
                ) : (
                  leaveRequests.map(req => (
                    <div key={req.id} className="bg-background border border-border rounded-lg p-3 text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-foreground">{req.employeeName}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold
                          ${req.status === 'approved' ? 'bg-green-500/20 text-green-400' : 
                            req.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 
                            'bg-yellow-500/20 text-yellow-400'}`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs mb-2">
                        {req.date} ({req.type})
                      </p>
                      {req.status === 'pending' && (
                        <div className="flex space-x-2 mt-2">
                          <button onClick={() => handleLeaveAction(req.id, 'approved')} className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 py-1 rounded transition-colors flex items-center justify-center space-x-1">
                            <CheckCircle className="w-3 h-3" /> <span>Approve</span>
                          </button>
                          <button onClick={() => handleLeaveAction(req.id, 'rejected')} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-1 rounded transition-colors flex items-center justify-center space-x-1">
                            <XCircle className="w-3 h-3" /> <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Calendar View (Printable) */}
          <div className="lg:col-span-3">
            <div className="bg-card rounded-2xl shadow-sm border border-border p-1 md:p-6 print:border-none print:shadow-none print:p-0">
              
              {/* Toolbar */}
              <div className="print:hidden flex justify-between items-center mb-6 px-4 pt-4 md:p-0 border-b border-border pb-4">
                <div className="flex space-x-6">
                  <button 
                    onClick={() => setActiveTab('roster')}
                    className={`pb-4 -mb-4 font-bold text-lg border-b-2 transition-colors ${activeTab === 'roster' ? 'border-blue-500 text-blue-500' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  >
                    Schedule Roster
                  </button>
                  <button 
                    onClick={() => setActiveTab('analytics')}
                    className={`pb-4 -mb-4 font-bold text-lg border-b-2 transition-colors ${activeTab === 'analytics' ? 'border-blue-500 text-blue-500' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  >
                    Employee Analytics
                  </button>
                </div>
                
                {schedule && activeTab === 'roster' && (
                  <div className="flex space-x-3 items-center">
                    {schedule?.isPublished ? (
                      <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full flex items-center mr-2"><CheckCircle className="w-3 h-3 mr-1"/> Published</span>
                    ) : (
                      <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full flex items-center mr-2"><AlertCircle className="w-3 h-3 mr-1"/> Draft Mode</span>
                    )}
                    <button onClick={handlePrint} className="flex items-center space-x-2 bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-lg transition-colors text-sm">
                      <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Print A4</span>
                    </button>
                    {!schedule.isPublished && (
                      <button onClick={handlePublish} className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm">
                        <Send className="w-4 h-4" /> <span className="hidden sm:inline">Publish to App</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Print Header (Only visible when printing) */}
              <div className="hidden print:block text-center mb-6 text-black">
                <h1 className="text-3xl font-bold">Monthly Schedule - {storeId}</h1>
                <p className="text-xl mt-2">{month}</p>
              </div>

              {/* Main Content Area */}
              {activeTab === 'roster' ? (
                loading && !schedule ? (
                  <div className="flex flex-col items-center justify-center h-64">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                    <p className="text-muted-foreground">Loading Schedule...</p>
                  </div>
                ) : !schedule ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-border rounded-xl m-4">
                    <CalendarDays className="w-12 h-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No schedule generated for this month yet.</p>
                    <p className="text-xs text-muted-foreground mt-2">Adjust your rules on the left and click Auto-Generate.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border print:border-black">
                    <table className="w-full text-left text-sm print:text-black">
                      <thead className="bg-secondary/50 print:bg-gray-100">
                        <tr>
                          <th className="p-3 font-semibold border-b border-border print:border-black">Date</th>
                          <th className="p-3 font-semibold border-b border-border print:border-black">Assigned Employees & Shifts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.assignments.map((day: any, dayIndex: number) => {
                          const dateObj = new Date(day.date);
                          const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6; // Fri/Sat in some regions
                          
                          return (
                            <tr key={day.date} className={`border-b border-border/50 print:border-black ${isWeekend ? 'bg-secondary/20' : ''}`}>
                              <td className="p-3 border-r border-border/50 print:border-black w-32 whitespace-nowrap">
                                <div className="font-medium">{dateObj.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                <div className="text-xs text-muted-foreground print:text-gray-600">{day.date}</div>
                              </td>
                              <td className="p-3">
                                <div className="flex flex-wrap gap-2 items-center">
                                  {day.shifts.map((shift: any, i: number) => {
                                    const isOff = shift.shiftTime.includes('Off');
                                    return (
                                      <div key={i} className={`px-3 py-1.5 rounded-xl border text-xs flex flex-col print:border-black backdrop-blur-sm transition-all
                                        ${isOff 
                                          ? 'bg-red-500/10 border-red-500/20 text-red-400 print:text-black print:bg-gray-100 hover:bg-red-500/15' 
                                          : 'bg-blue-500/10 border-blue-500/20 text-blue-400 print:text-black print:bg-white hover:bg-blue-500/15 shadow-sm'}`}>
                                        <span className="font-bold tracking-wide">
                                          {shift.employeeName}
                                          {shift.isBorrowed && <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1 rounded ml-1">Borrowed</span>}
                                        </span>
                                        
                                        <select 
                                          value={shift.shiftTime}
                                          onChange={(e) => {
                                            const newSchedule = JSON.parse(JSON.stringify(schedule));
                                            newSchedule.assignments[dayIndex].shifts[i].shiftTime = e.target.value;
                                            setSchedule(newSchedule);
                                            
                                            // Auto-save if it's already published
                                            if (schedule.isPublished) {
                                              fetch('/api/schedule', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(newSchedule)
                                              }).catch(console.error);
                                            }
                                          }}
                                          className={`mt-1.5 rounded-md px-1.5 py-1 text-[10px] font-medium focus:ring-2 focus:ring-blue-500/50 outline-none print:hidden w-full cursor-pointer transition-colors shadow-sm
                                            ${schedule.isPublished ? 'bg-background/40 border border-border/30 hover:bg-background/60 text-foreground/80' : 'bg-background/80 border border-border/80 text-foreground'}`}
                                        >
                                          <option value="Off">Off</option>
                                          <option value="Scheduled">Scheduled</option>
                                          <option value="Morning">Morning</option>
                                          <option value="Noon">Noon</option>
                                          <option value="Night">Night</option>
                                          <option value="Off (Approved Leave)">Off (Approved Leave)</option>
                                        </select>
                                        <span className="hidden print:block opacity-80 mt-0.5">{shift.shiftTime}</span>
                                      </div>
                                    );
                                  })}
                                  
                                  {/* Borrow Button */}
                                  <button 
                                    onClick={() => setShowBorrowModal(dayIndex)} 
                                    className="px-2 py-1.5 bg-secondary/30 text-xs rounded-lg border border-dashed border-border hover:bg-secondary/70 transition-colors flex items-center print:hidden"
                                    title="Borrow employee from another branch"
                                  >
                                    <Plus className="w-3 h-3 text-muted-foreground mr-1"/>
                                    <span className="text-muted-foreground font-medium">Borrow</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                /* Analytics Tab */
                <div className="p-4">
                  {!schedule ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <BarChart3 className="w-12 h-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">Generate a schedule first to view analytics.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center space-x-2 mb-4">
                        <BarChart3 className="w-5 h-5 text-blue-500" />
                        <h3 className="text-lg font-bold">Employee Workload & Fairness</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-secondary/20 border border-border rounded-xl p-4">
                          <p className="text-sm text-muted-foreground mb-1">Total Shifts Scheduled</p>
                          <p className="text-2xl font-black text-foreground">
                            {schedule.assignments.reduce((sum: number, day: any) => sum + day.shifts.filter((s:any) => !s.shiftTime.includes('Off')).length, 0)}
                          </p>
                        </div>
                        <div className="bg-secondary/20 border border-border rounded-xl p-4">
                          <p className="text-sm text-muted-foreground mb-1">Total Estimated Hours</p>
                          <p className="text-2xl font-black text-blue-500">
                            {schedule.assignments.reduce((sum: number, day: any) => sum + day.shifts.filter((s:any) => !s.shiftTime.includes('Off')).length, 0) * 9} hrs
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Based on 9hr shifts</p>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-border rounded-xl">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-secondary/50">
                            <tr>
                              <th className="p-3 font-semibold">Employee</th>
                              <th className="p-3 font-semibold text-center">Worked Days</th>
                              <th className="p-3 font-semibold text-center">Days Off</th>
                              <th className="p-3 font-semibold text-center">Morning</th>
                              <th className="p-3 font-semibold text-center">Noon</th>
                              <th className="p-3 font-semibold text-center">Night</th>
                              <th className="p-3 font-semibold text-right">Total Hours</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              // Compute stats
                              const stats: Record<string, any> = {};
                              schedule.assignments.forEach((day: any) => {
                                day.shifts.forEach((shift: any) => {
                                  if (!stats[shift.employeeName]) {
                                    stats[shift.employeeName] = { worked: 0, off: 0, morning: 0, noon: 0, night: 0, id: shift.employeeId };
                                  }
                                  if (shift.shiftTime.includes('Off')) {
                                    stats[shift.employeeName].off += 1;
                                  } else {
                                    stats[shift.employeeName].worked += 1;
                                    if (shift.shiftTime === 'Morning') stats[shift.employeeName].morning += 1;
                                    else if (shift.shiftTime === 'Noon') stats[shift.employeeName].noon += 1;
                                    else if (shift.shiftTime === 'Night') stats[shift.employeeName].night += 1;
                                  }
                                });
                              });

                              return Object.entries(stats).sort((a: any, b: any) => b[1].worked - a[1].worked).map(([name, data]: any) => {
                                const totalHours = data.worked * 9;
                                const isOvertimeWarning = totalHours > 200; // Arbitrary warning threshold
                                
                                return (
                                  <tr key={name} className="border-t border-border/50 hover:bg-secondary/10">
                                    <td className="p-3 font-medium">{name}</td>
                                    <td className="p-3 text-center">{data.worked}</td>
                                    <td className="p-3 text-center text-red-400">{data.off}</td>
                                    <td className="p-3 text-center text-orange-400">{data.morning}</td>
                                    <td className="p-3 text-center text-yellow-500">{data.noon}</td>
                                    <td className="p-3 text-center text-blue-400">{data.night}</td>
                                    <td className={`p-3 text-right font-bold ${isOvertimeWarning ? 'text-orange-500' : 'text-green-500'}`}>
                                      {totalHours}
                                      {isOvertimeWarning && <AlertCircle className="w-3 h-3 inline ml-1" title="High hours warning"/>}
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Borrow Employee Modal */}
        {showBorrowModal !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-bold mb-1">Borrow Employee</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Assign an employee from another branch for {schedule?.assignments[showBorrowModal]?.date}.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Select Employee</label>
                  <select 
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => {
                      const emp = allEmployees.find(x => x.id === e.target.value);
                      setBorrowSelectedEmp(emp || null);
                    }}
                    value={borrowSelectedEmp?.id || ""}
                  >
                    <option value="">-- Choose an employee --</option>
                    {allEmployees
                      .filter(emp => emp.branchId !== storeId && emp.storeId !== storeId) // Only from other branches
                      .map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.branchId || emp.storeId || 'Unknown'})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Shift Time</label>
                  <select 
                    value={borrowShiftTime}
                    onChange={(e) => setBorrowShiftTime(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Noon">Noon</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button 
                  onClick={() => {
                    setShowBorrowModal(null);
                    setBorrowSelectedEmp(null);
                  }}
                  className="flex-1 px-4 py-2 bg-secondary text-foreground rounded-xl hover:bg-secondary/80 font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (!borrowSelectedEmp) return;
                    const newSchedule = JSON.parse(JSON.stringify(schedule));
                    newSchedule.assignments[showBorrowModal].shifts.push({
                      employeeId: borrowSelectedEmp.id,
                      employeeName: borrowSelectedEmp.name,
                      shiftTime: borrowShiftTime,
                      isBorrowed: true,
                      borrowedFrom: borrowSelectedEmp.branchId || borrowSelectedEmp.storeId
                    });
                    
                    setSchedule(newSchedule);
                    setShowBorrowModal(null);
                    setBorrowSelectedEmp(null);
                    
                    if (schedule.isPublished) {
                      fetch('/api/schedule', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newSchedule)
                      }).catch(console.error);
                    }
                  }}
                  disabled={!borrowSelectedEmp}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Borrow
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </ClientLayoutWrapper>
  );
}
