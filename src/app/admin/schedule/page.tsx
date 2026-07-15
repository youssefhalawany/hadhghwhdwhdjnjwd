"use client";

import { useState, useEffect } from "react";
import { 
  CalendarDays, Settings, Users, CheckCircle, 
  XCircle, Printer, Send, RefreshCw, AlertCircle, BarChart3, Plus 
} from "lucide-react";
import { useBranch } from "@/context/BranchContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, doc, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";

export default function AdminSchedulePage() {
  const { currentBranch } = useBranch();
  const [storeId, setStoreId] = useState("eL-alamein-4");
  const [month, setMonth] = useState("");
  const [schedule, setSchedule] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'analytics' | 'requests'>('roster');
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [showBorrowModal, setShowBorrowModal] = useState<number | null>(null); // dayIndex
  const [borrowSelectedEmp, setBorrowSelectedEmp] = useState<any>(null);
  const [borrowShiftTime, setBorrowShiftTime] = useState("Morning");
  const [borrowRequests, setBorrowRequests] = useState<any[]>([]);
  const [borrowType, setBorrowType] = useState<"days" | "forever">("days");
  const [borrowDates, setBorrowDates] = useState<string[]>([]);
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
    if (currentBranch === "alamein4") setStoreId("eL-alamein-4");
    else if (currentBranch === "ola") setStoreId("ola-el-koronfol");
    // if "all", we keep whatever was selected
  }, [currentBranch]);

  const isStoreMatch = (id: string) => storeId === "all" || id === storeId || !storeId;

  useEffect(() => {
    if (!storeId) return;
    const unsub = onSnapshot(query(collection(db, "borrow_requests"), limit(100)), (snap) => {
      const reqs = snap.docs.map(d => ({id: d.id, ...d.data()}))
        .filter((r: any) => isStoreMatch(r.sourceStoreId) || isStoreMatch(r.targetStoreId))
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBorrowRequests(reqs);
    });
    return () => unsub();
  }, [storeId]);

  useEffect(() => {
    if (showBorrowModal !== null && schedule?.assignments[showBorrowModal]) {
      setBorrowDates([schedule.assignments[showBorrowModal].date]);
    } else {
      setBorrowDates([]);
    }
  }, [showBorrowModal, schedule]);

  useEffect(() => {
    if (storeId && month) {
      fetchData();
    }
  }, [storeId, month]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Schedule with cache busting
      const res = await fetch(`/api/schedule?storeId=${storeId}&month=${month}&t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      setSchedule(data.schedule);

      if (data.schedule?.rules) {
        setRules(data.schedule.rules);
      }

      // Fetch Leave Requests with cache busting
      const leaveRes = await fetch(`/api/schedule/leave-requests?storeId=${storeId}&t=${Date.now()}`, { cache: 'no-store' });
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
      <div className="p-6 max-w-7xl mx-auto min-h-screen">
        {/* Header - Hidden on Print */}
        <div className="print:hidden mb-8 flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-200/60 dark:border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="relative z-10 mb-4 md:mb-0">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <CalendarDays className="w-8 h-8 text-blue-500" />
              Smart Scheduler
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Generate & manage employee rosters automatically.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 relative z-10 w-full md:w-auto">
            <div className="relative group">
              <select 
                value={storeId} 
                onChange={(e) => setStoreId(e.target.value)}
                className={`w-full sm:w-auto appearance-none bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3 pr-10 font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer ${currentBranch !== "all" ? "opacity-75 cursor-not-allowed" : "hover:border-blue-400"}`}
                disabled={currentBranch !== "all"}
              >
                {(currentBranch === "all" || currentBranch === "alamein4") && <option value="eL-alamein-4">El Alamein 4</option>}
                {(currentBranch === "all" || currentBranch === "ola") && <option value="ola-el-koronfol">Ola El Koronfol</option>}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-blue-500 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            <input 
              type="month" 
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3 font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all hover:border-blue-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
          
          {/* Left Column: Rules & Requests (Hidden on Print) */}
          <div className="lg:col-span-1 space-y-6 print:hidden">
            
            {/* Rules Builder */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-200/60 dark:border-slate-800 p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none transition-transform group-hover:scale-110"></div>
              <div className="flex items-center space-x-3 mb-6 relative z-10">
                <div className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 p-2 rounded-xl">
                  <Settings className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Generation Rules</h2>
              </div>
              
              <div className="space-y-6 relative z-10">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 block">Min Employees Per Shift</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block text-center">Morning</label>
                      <input 
                        type="number" min={0}
                        value={rules.minEmployeesMorning || 0}
                        onChange={(e) => setRules({...rules, minEmployeesMorning: parseInt(e.target.value) || 0})}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                      />
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block text-center">Noon</label>
                      <input 
                        type="number" min={0}
                        value={rules.minEmployeesNoon || 0}
                        onChange={(e) => setRules({...rules, minEmployeesNoon: parseInt(e.target.value) || 0})}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                      />
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block text-center">Night</label>
                      <input 
                        type="number" min={0}
                        value={rules.minEmployeesNight || 0}
                        onChange={(e) => setRules({...rules, minEmployeesNight: parseInt(e.target.value) || 0})}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Max Days Off / Month</label>
                    <input 
                      type="number" min={0}
                      value={rules.maxDaysOffPerMonth}
                      onChange={(e) => setRules({...rules, maxDaysOffPerMonth: parseInt(e.target.value)})}
                      className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  
                  <div className="w-full h-px bg-slate-200 dark:bg-slate-700 my-3"></div>

                  <div className="flex items-center justify-between py-1">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Allow Consecutive Off</label>
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${rules.allowConsecutiveDaysOff ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} onClick={() => setRules({...rules, allowConsecutiveDaysOff: !rules.allowConsecutiveDaysOff})}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rules.allowConsecutiveDaysOff ? 'translate-x-6' : 'translate-x-1'}`} />
                    </div>
                  </div>
                  
                  {rules.allowConsecutiveDaysOff && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 border-dashed">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Max Consecutive Days</label>
                      <input 
                        type="number" min={1}
                        value={rules.maxConsecutiveDaysOff}
                        onChange={(e) => setRules({...rules, maxConsecutiveDaysOff: parseInt(e.target.value)})}
                        className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full mt-2 flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] shadow-lg shadow-blue-500/25 text-white py-3.5 rounded-xl font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CalendarDays className="w-5 h-5" />}
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
              <div className="print:hidden flex flex-col md:flex-row justify-between items-start md:items-center mb-6 px-6 pt-6 md:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-2xl mb-4 md:mb-0 overflow-x-auto w-full md:w-auto shadow-inner border border-slate-200/80 dark:border-slate-700">
                  <button 
                    onClick={() => setActiveTab('roster')}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'roster' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Schedule Roster
                  </button>
                  <button 
                    onClick={() => setActiveTab('analytics')}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'analytics' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Employee Analytics
                  </button>
                  <button 
                    onClick={() => setActiveTab('requests')}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center whitespace-nowrap ${activeTab === 'requests' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Staff Requests
                    {borrowRequests.filter(r => isStoreMatch(r.sourceStoreId) && r.status === 'pending').length > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm">
                        {borrowRequests.filter(r => isStoreMatch(r.sourceStoreId) && r.status === 'pending').length}
                      </span>
                    )}
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm print:text-black">
                      <thead className="bg-slate-50 dark:bg-slate-900 print:bg-gray-100">
                        <tr>
                          <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs border-y border-slate-200 dark:border-slate-800 print:border-black">Date</th>
                          <th className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs border-y border-slate-200 dark:border-slate-800 print:border-black">Assigned Employees & Shifts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.assignments.map((day: any, dayIndex: number) => {
                          const dateObj = new Date(day.date);
                          const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6; // Fri/Sat in some regions
                          
                          return (
                            <tr key={day.date} className={`border-b border-slate-100 dark:border-slate-800/50 print:border-black transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/20 ${isWeekend ? 'bg-orange-50/30 dark:bg-orange-900/10' : ''}`}>
                              <td className="p-4 border-r border-slate-100 dark:border-slate-800 print:border-black w-40 whitespace-nowrap align-top">
                                <div className={`font-bold text-base ${isWeekend ? 'text-orange-600 dark:text-orange-400' : 'text-slate-800 dark:text-slate-200'}`}>{dateObj.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                                <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1 print:text-gray-600">{dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                              </td>
                              <td className="p-4 align-top">
                                <div className="flex flex-wrap gap-3 items-start">
                                  {day.shifts.map((shift: any, i: number) => {
                                    const lower = shift.shiftTime.toLowerCase();
                                    const isOff = lower.includes('off');
                                    const isMorning = lower.includes('morning');
                                    const isNoon = lower.includes('noon');
                                    const isNight = lower.includes('night');

                                    let badgeColors = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
                                    if (isOff) badgeColors = 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50';
                                    else if (isMorning) badgeColors = 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50';
                                    else if (isNight) badgeColors = 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50';
                                    else if (isNoon) badgeColors = 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/50';

                                    return (
                                      <div key={i} className={`p-2.5 rounded-xl border flex flex-col print:border-black backdrop-blur-sm shadow-sm transition-all w-36 ${badgeColors}`}>
                                        <span className="font-bold text-[13px] tracking-tight leading-tight mb-2 flex items-start justify-between">
                                          {shift.employeeName}
                                          {shift.isBorrowed && <span className="text-[9px] bg-purple-500/20 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-sm ml-1 uppercase tracking-wider font-black">Borrowed</span>}
                                        </span>
                                        
                                        <div className="relative group">
                                          <select 
                                            value={shift.shiftTime}
                                            onChange={(e) => {
                                              const newSchedule = JSON.parse(JSON.stringify(schedule));
                                              newSchedule.assignments[dayIndex].shifts[i].shiftTime = e.target.value;
                                              setSchedule(newSchedule);
                                              
                                              if (schedule.isPublished) {
                                                fetch('/api/schedule', {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify(newSchedule)
                                                }).catch(console.error);
                                              }
                                            }}
                                            className={`appearance-none rounded-lg px-2 py-1.5 text-xs font-bold focus:ring-2 focus:ring-blue-500/50 outline-none print:hidden w-full cursor-pointer transition-colors border
                                              ${schedule.isPublished ? 'bg-black/5 dark:bg-white/5 border-transparent hover:bg-black/10 dark:hover:bg-white/10' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-inner'}`}
                                          >
                                            <option value="Off">Off</option>
                                            <option value="Scheduled">Scheduled</option>
                                            <option value="Morning">Morning</option>
                                            <option value="Noon">Noon</option>
                                            <option value="Night">Night</option>
                                            <option value="Off (Approved Leave)">Off (Approved Leave)</option>
                                          </select>
                                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 print:hidden">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                          </div>
                                        </div>
                                        <span className="hidden print:block opacity-80 mt-1 text-xs font-bold">{shift.shiftTime}</span>
                                      </div>
                                    );
                                  })}
                                  
                                  {/* Borrow Button */}
                                  <button 
                                    onClick={() => setShowBorrowModal(dayIndex)} 
                                    className="p-2 h-[82px] w-20 flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50 dark:bg-slate-800/30 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-500 border border-dashed border-slate-300 hover:border-blue-400 dark:border-slate-700 dark:hover:border-blue-500 rounded-xl transition-colors print:hidden group"
                                    title="Borrow employee"
                                  >
                                    <Plus className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform"/>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Borrow</span>
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
                                      {isOvertimeWarning && <span title="High hours warning"><AlertCircle className="w-3 h-3 inline ml-1" /></span>}
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

                  {activeTab === 'requests' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Incoming Requests */}
                        <div className="bg-card border border-border rounded-xl p-4">
                          <h3 className="font-bold text-lg mb-4 flex items-center">
                            <span className="bg-blue-100 text-blue-700 p-1.5 rounded-lg mr-2">
                              <Users className="w-4 h-4" />
                            </span>
                            Incoming Requests
                          </h3>
                          <div className="space-y-3">
                            {borrowRequests.filter(r => isStoreMatch(r.sourceStoreId)).length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">No incoming requests.</p>
                            ) : (
                              borrowRequests.filter(r => isStoreMatch(r.sourceStoreId)).map((req) => (
                                <div key={req.id} className="bg-background border border-border rounded-xl p-3">
                                  <div className="flex justify-between items-start mb-2">
                                    <p className="font-bold text-sm">{req.employeeName}</p>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold
                                      ${req.status === 'approved' ? 'bg-green-500/20 text-green-500' : 
                                        req.status === 'rejected' ? 'bg-red-500/20 text-red-500' : 
                                        'bg-yellow-500/20 text-yellow-500'}`}>
                                      {req.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-1">
                                    Requested by: <span className="font-semibold text-foreground">{req.targetStoreId}</span>
                                  </p>
                                  {req.type === 'forever' ? (
                                    <p className="text-xs text-purple-500 font-medium mb-3 border border-purple-200 bg-purple-50 inline-block px-2 py-0.5 rounded">Permanent Transfer</p>
                                  ) : (
                                    <div className="text-xs text-muted-foreground mb-3">
                                      <p>Temporary Borrow: {req.dates?.length} day(s)</p>
                                      <p className="line-clamp-1">{req.dates?.join(', ')}</p>
                                    </div>
                                  )}
                                  
                                  {req.status === 'pending' && (
                                    <div className="flex space-x-2">
                                      <button 
                                        onClick={async () => {
                                          try {
                                            await updateDoc(doc(db, "borrow_requests", req.id), { status: "approved" });
                                            if (req.type === "forever") {
                                              await updateDoc(doc(db, "cashiers", req.employeeId), {
                                                branchId: req.targetStoreId,
                                                storeId: req.targetStoreId
                                              });
                                              alert("Employee permanently transferred!");
                                            } else {
                                              // Auto-inject into target schedule
                                              const firstDate = req.dates[0];
                                              const reqMonth = firstDate.substring(0, 7);
                                              const targetRes = await fetch(`/api/schedule?storeId=${req.targetStoreId}&month=${reqMonth}`);
                                              const targetData = await targetRes.json();
                                              
                                              if (targetData.schedule) {
                                                const newTargetSchedule = JSON.parse(JSON.stringify(targetData.schedule));
                                                req.dates.forEach((dateStr: string) => {
                                                  const dayIndex = newTargetSchedule.assignments.findIndex((a: any) => a.date === dateStr);
                                                  if (dayIndex !== -1) {
                                                    newTargetSchedule.assignments[dayIndex].shifts.push({
                                                      employeeId: req.employeeId,
                                                      employeeName: req.employeeName,
                                                      shiftTime: req.shiftTime || 'Morning',
                                                      isBorrowed: true,
                                                      borrowedFrom: req.sourceStoreId
                                                    });
                                                  }
                                                });
                                                await fetch('/api/schedule', {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify(newTargetSchedule)
                                                });
                                              }
                                              alert("Request approved and added to their schedule!");
                                            }
                                          } catch(e) {
                                            alert("Error approving request");
                                          }
                                        }}
                                        className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 rounded-lg transition-colors text-xs font-bold"
                                      >
                                        Approve
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          await updateDoc(doc(db, "borrow_requests", req.id), { status: "rejected" });
                                        }}
                                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-lg transition-colors text-xs font-bold"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Outgoing Requests */}
                        <div className="bg-card border border-border rounded-xl p-4">
                          <h3 className="font-bold text-lg mb-4 flex items-center">
                            <span className="bg-orange-100 text-orange-700 p-1.5 rounded-lg mr-2">
                              <Send className="w-4 h-4" />
                            </span>
                            Outgoing Requests
                          </h3>
                          <div className="space-y-3">
                            {borrowRequests.filter(r => isStoreMatch(r.targetStoreId)).length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">No outgoing requests.</p>
                            ) : (
                              borrowRequests.filter(r => isStoreMatch(r.targetStoreId)).map((req) => (
                                <div key={req.id} className="bg-background border border-border rounded-xl p-3">
                                  <div className="flex justify-between items-start mb-2">
                                    <p className="font-bold text-sm">{req.employeeName}</p>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold
                                      ${req.status === 'approved' ? 'bg-green-500/20 text-green-500' : 
                                        req.status === 'rejected' ? 'bg-red-500/20 text-red-500' : 
                                        'bg-yellow-500/20 text-yellow-500'}`}>
                                      {req.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-1">
                                    Request to: <span className="font-semibold text-foreground">{req.sourceStoreId}</span>
                                  </p>
                                  {req.type === 'forever' ? (
                                    <p className="text-xs text-purple-500 font-medium mb-1 border border-purple-200 bg-purple-50 inline-block px-2 py-0.5 rounded">Permanent Transfer</p>
                                  ) : (
                                    <div className="text-xs text-muted-foreground mb-1">
                                      <p>Temporary Borrow: {req.dates?.length} day(s)</p>
                                      <p className="line-clamp-1">{req.dates?.join(', ')}</p>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
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
            <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <h3 className="text-xl font-bold mb-1">Request Staff</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Request an employee from another branch.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Request Type</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setBorrowType("days")}
                      className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${borrowType === "days" ? "bg-blue-50 border-blue-200 text-blue-700 font-bold" : "bg-card border-border hover:bg-secondary"}`}
                    >
                      Temporary Borrow
                    </button>
                    <button 
                      onClick={() => setBorrowType("forever")}
                      className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${borrowType === "forever" ? "bg-purple-50 border-purple-200 text-purple-700 font-bold" : "bg-card border-border hover:bg-secondary"}`}
                    >
                      Permanent Transfer
                    </button>
                  </div>
                </div>

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

                {borrowType === "days" ? (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Select Days</label>
                      <div className="max-h-32 overflow-y-auto border border-border rounded-xl p-2 bg-background/50 grid grid-cols-2 gap-2 custom-scrollbar">
                        {schedule?.assignments.map((assignment: any, idx: number) => (
                          <label key={idx} className="flex items-center space-x-2 text-sm cursor-pointer p-1 hover:bg-secondary rounded">
                            <input 
                              type="checkbox" 
                              checked={borrowDates.includes(assignment.date)} 
                              onChange={(e) => {
                                if (e.target.checked) setBorrowDates([...borrowDates, assignment.date]);
                                else setBorrowDates(borrowDates.filter(d => d !== assignment.date));
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{assignment.date}</span>
                          </label>
                        ))}
                      </div>
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
                  </>
                ) : (
                  <div className="bg-purple-50 text-purple-700 p-4 rounded-xl text-sm border border-purple-100">
                    <strong>Note:</strong> This will send a request to permanently move this employee to <strong>{storeId}</strong>. They will no longer appear on their original branch's schedule.
                  </div>
                )}
              </div>

              <div className="flex space-x-3 mt-6">
                <button 
                  onClick={() => {
                    setShowBorrowModal(null);
                    setBorrowSelectedEmp(null);
                    setBorrowDates([]);
                  }}
                  className="flex-1 px-4 py-2 bg-secondary text-foreground rounded-xl hover:bg-secondary/80 font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (!borrowSelectedEmp) return;
                    
                    const requestData = {
                      type: borrowType,
                      employeeId: borrowSelectedEmp.id,
                      employeeName: borrowSelectedEmp.name,
                      sourceStoreId: borrowSelectedEmp.branchId || borrowSelectedEmp.storeId || "Unknown",
                      targetStoreId: storeId,
                      status: "pending",
                      createdAt: new Date().toISOString(),
                      ...(borrowType === "days" ? {
                        dates: borrowDates.length > 0 ? borrowDates : [schedule?.assignments[showBorrowModal]?.date].filter(Boolean),
                        shiftTime: borrowShiftTime
                      } : {})
                    };

                    try {
                      await addDoc(collection(db, "borrow_requests"), requestData);
                      alert("Request sent successfully to the other manager!");
                    } catch (e) {
                      console.error("Error creating request", e);
                      alert("Failed to send request.");
                    }
                    
                    setShowBorrowModal(null);
                    setBorrowSelectedEmp(null);
                    setBorrowDates([]);
                  }}
                  disabled={!borrowSelectedEmp}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send Request
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
  );
}
