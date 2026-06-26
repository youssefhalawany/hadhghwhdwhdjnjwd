"use client";

import { useState, useEffect } from "react";
import { 
  CalendarDays, Settings, Users, CheckCircle, 
  XCircle, Printer, Send, RefreshCw, AlertCircle 
} from "lucide-react";
import ClientLayoutWrapper from "@/components/ClientLayoutWrapper";

export default function AdminSchedulePage() {
  const [storeId, setStoreId] = useState("eL-alamein-4");
  const [month, setMonth] = useState("");
  const [schedule, setSchedule] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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
              <div className="print:hidden flex justify-between items-center mb-6 px-4 pt-4 md:p-0">
                <div className="flex items-center space-x-3">
                  <h2 className="text-xl font-bold">Schedule Roster</h2>
                  {schedule?.isPublished ? (
                    <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Published</span>
                  ) : schedule ? (
                    <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> Draft Mode</span>
                  ) : null}
                </div>
                
                {schedule && (
                  <div className="flex space-x-3">
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

              {/* Table */}
              {loading && !schedule ? (
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
                              <div className="flex flex-wrap gap-2">
                                {day.shifts.map((shift: any, i: number) => {
                                  const isOff = shift.shiftTime.includes('Off');
                                  return (
                                    <div key={i} className={`px-3 py-1.5 rounded-lg border text-xs flex flex-col print:border-black
                                      ${isOff 
                                        ? 'bg-red-500/10 border-red-500/20 text-red-400 print:text-black print:bg-gray-100' 
                                        : 'bg-blue-500/10 border-blue-500/20 text-blue-400 print:text-black print:bg-white'}`}>
                                      <span className="font-bold">{shift.employeeName}</span>
                                      
                                      {!schedule.isPublished ? (
                                        <select 
                                          value={shift.shiftTime}
                                          onChange={(e) => {
                                            const newSchedule = JSON.parse(JSON.stringify(schedule));
                                            newSchedule.assignments[dayIndex].shifts[i].shiftTime = e.target.value;
                                            setSchedule(newSchedule);
                                          }}
                                          className="mt-1 bg-background/80 border border-border/80 rounded px-1.5 py-1 text-[10px] font-medium focus:ring-1 focus:ring-blue-500 outline-none print:hidden w-full cursor-pointer transition-colors"
                                        >
                                          <option value="Off">Off</option>
                                          <option value="Scheduled">Scheduled</option>
                                          <option value="Morning">Morning</option>
                                          <option value="Noon">Noon</option>
                                          <option value="Night">Night</option>
                                          <option value="Off (Approved Leave)">Off (Approved Leave)</option>
                                        </select>
                                      ) : (
                                        <span className="opacity-80 mt-0.5 block">{shift.shiftTime}</span>
                                      )}
                                      <span className="hidden print:block opacity-80 mt-0.5">{shift.shiftTime}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </ClientLayoutWrapper>
  );
}
