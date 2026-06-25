"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  CalendarDays, ArrowLeft, Clock, CalendarX2, CheckCircle, Clock3, XCircle
} from "lucide-react";
import ClientLayoutWrapper from "@/components/ClientLayoutWrapper";

export default function CashierSchedulePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveType, setLeaveType] = useState("Vacation");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (savedUserStr) {
      const parsedUser = JSON.parse(savedUserStr);
      setUser(parsedUser);
      fetchData(parsedUser);
    } else {
      router.push('/cashier');
    }
  }, []);

  const fetchData = async (currentUser: any) => {
    setLoading(true);
    try {
      const d = new Date();
      // Fetch current month and next month just to be safe, but let's just do next month for now
      d.setMonth(d.getMonth() + 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      const res = await fetch(`/api/schedule?storeId=${currentUser.storeId || currentUser.branchId}&month=${month}`);
      const data = await res.json();
      
      if (data.schedule?.isPublished) {
        setSchedule(data.schedule);
      }

      // Fetch requests
      const leaveRes = await fetch(`/api/schedule/leave-requests?employeeId=${currentUser.id}`);
      const leaveData = await leaveRes.json();
      setLeaveRequests(leaveData.requests || []);
      
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveDate || !user) return;
    
    setSubmitting(true);
    try {
      await fetch('/api/schedule/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: user.id,
          employeeName: user.name,
          storeId: user.storeId || user.branchId,
          date: leaveDate,
          type: leaveType
        })
      });
      
      alert('Leave request submitted successfully!');
      setLeaveDate("");
      fetchData(user); // Refresh
    } catch (err) {
      console.error(err);
      alert('Failed to submit request.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <ClientLayoutWrapper>
        <div className="flex justify-center items-center h-screen">
          <Clock3 className="w-10 h-10 animate-spin text-blue-500" />
        </div>
      </ClientLayoutWrapper>
    );
  }

  return (
    <ClientLayoutWrapper>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-12">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-border p-4 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button onClick={() => router.push('/cashier')} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-bold text-lg">My Schedule & Leaves</h1>
                <p className="text-xs text-muted-foreground">{user?.name}</p>
              </div>
            </div>
            <CalendarDays className="w-6 h-6 text-blue-500" />
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4 mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left: Schedule */}
          <div className="space-y-4">
            <h2 className="font-bold text-xl flex items-center">
              <CalendarDays className="w-5 h-5 mr-2 text-blue-500" /> Next Month Schedule
            </h2>
            
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              {!schedule ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarX2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No schedule published yet.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {schedule.assignments.map((day: any) => {
                    const myShift = day.shifts.find((s: any) => s.employeeId === user?.id);
                    if (!myShift) return null; // Not scheduled at all this day
                    
                    const isOff = myShift.shiftTime.includes('Off');
                    const dateObj = new Date(day.date);
                    
                    return (
                      <div key={day.date} className={`flex items-center justify-between p-3 rounded-xl border ${isOff ? 'bg-red-50/50 border-red-100 dark:bg-red-950/20 dark:border-red-900' : 'bg-background border-border'}`}>
                        <div>
                          <div className="font-semibold text-sm">{dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                        </div>
                        <div className={`text-sm font-bold px-3 py-1 rounded-lg ${isOff ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'}`}>
                          {myShift.shiftTime}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Leave Requests */}
          <div className="space-y-6">
            
            {/* Form */}
            <div>
              <h2 className="font-bold text-xl flex items-center mb-4">
                <Clock className="w-5 h-5 mr-2 text-orange-500" /> Request Time Off
              </h2>
              <form onSubmit={handleSubmitLeave} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Date</label>
                  <input 
                    type="date" 
                    required
                    value={leaveDate}
                    onChange={e => setLeaveDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Type</label>
                  <select 
                    value={leaveType}
                    onChange={e => setLeaveType(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2"
                  >
                    <option value="Vacation">Vacation / Day Off</option>
                    <option value="Sick">Sick Leave</option>
                  </select>
                </div>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </div>

            {/* Request History */}
            <div>
              <h3 className="font-bold text-lg mb-3">My Requests</h3>
              <div className="space-y-3">
                {leaveRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">You have no leave requests.</p>
                ) : (
                  leaveRequests.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((req) => (
                    <div key={req.id} className="bg-card border border-border rounded-xl p-3 flex justify-between items-center text-sm">
                      <div>
                        <div className="font-semibold">{req.date}</div>
                        <div className="text-xs text-muted-foreground">{req.type}</div>
                      </div>
                      <div className="flex items-center">
                        {req.status === 'pending' && <span className="flex items-center text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded text-xs font-bold"><Clock3 className="w-3 h-3 mr-1" /> Pending</span>}
                        {req.status === 'approved' && <span className="flex items-center text-green-500 bg-green-500/10 px-2 py-1 rounded text-xs font-bold"><CheckCircle className="w-3 h-3 mr-1" /> Approved</span>}
                        {req.status === 'rejected' && <span className="flex items-center text-red-500 bg-red-500/10 px-2 py-1 rounded text-xs font-bold"><XCircle className="w-3 h-3 mr-1" /> Rejected</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </ClientLayoutWrapper>
  );
}
