"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  CalendarDays, ArrowLeft, Clock, CalendarX2, CheckCircle, Clock3, XCircle, ChevronLeft, ChevronRight, Moon, Sun, Globe
} from "lucide-react";
import ClientLayoutWrapper from "@/components/ClientLayoutWrapper";
import { motion, AnimatePresence } from "framer-motion";

const DICT = {
  en: {
    title: "My Schedule & Leaves",
    currentMonth: "Current Month",
    nextMonth: "Next Month",
    noSchedule: "No schedule published yet.",
    requestOff: "Request Time Off",
    date: "Date",
    type: "Type",
    vacation: "Vacation / Day Off",
    sick: "Sick Leave",
    submit: "Submit Request",
    submitting: "Submitting...",
    myRequests: "My Requests",
    noRequests: "You have no leave requests.",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    successMsg: "Leave request submitted successfully!",
    failMsg: "Failed to submit request."
  },
  ar: {
    title: "جدول العمل والإجازات",
    currentMonth: "الشهر الحالي",
    nextMonth: "الشهر القادم",
    noSchedule: "لم يتم نشر جدول حتى الآن.",
    requestOff: "طلب إجازة",
    date: "التاريخ",
    type: "النوع",
    vacation: "إجازة اعتيادية / يوم راحة",
    sick: "إجازة مرضية",
    submit: "تقديم الطلب",
    submitting: "جاري التقديم...",
    myRequests: "طلباتي",
    noRequests: "ليس لديك طلبات إجازة.",
    pending: "قيد المراجعة",
    approved: "تمت الموافقة",
    rejected: "مرفوض",
    successMsg: "تم تقديم طلب الإجازة بنجاح!",
    failMsg: "فشل في تقديم الطلب."
  }
};

export default function CashierSchedulePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [monthOffset, setMonthOffset] = useState<0 | 1>(0); // 0 = current month, 1 = next month
  
  // Form State
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveType, setLeaveType] = useState("Vacation");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (savedUserStr) {
      const parsedUser = JSON.parse(savedUserStr);
      setUser(parsedUser);
      // Attempt to load lang from somewhere or default
      setLang("en"); // Defaulting to english first, can be toggled
      fetchData(parsedUser, 0);
    } else {
      router.push('/cashier');
    }
  }, []);

  const resolveStoreId = (u: any) => {
    // Ensure we map the standard branch IDs to the ones used by the schedule generator
    const sid = u.storeId && u.storeId !== "N/A" && u.storeId !== "ALL" ? u.storeId : u.branchId;
    if (sid === "alamein4" || !sid) return "eL-alamein-4";
    if (sid === "ola") return "ola-el-koronfol";
    return sid;
  };

  const fetchData = async (currentUser: any, offset: number) => {
    setLoading(true);
    setSchedule(null);
    try {
      const d = new Date();
      d.setMonth(d.getMonth() + offset);
      const targetMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      const sId = resolveStoreId(currentUser);
      const ALL_BRANCH_IDS = ["eL-alamein-4", "ola-el-koronfol"];
      
      const allSchedulesData = await Promise.all(
        ALL_BRANCH_IDS.map(bId => 
          fetch(`/api/schedule?storeId=${bId}&month=${targetMonth}`).then(r => r.json())
        )
      );
      
      const publishedSchedules = allSchedulesData
        .map(d => d.schedule)
        .filter(s => s && s.isPublished);

      if (publishedSchedules.length > 0) {
        // Use home schedule as base, or first available if home isn't published
        const baseSchedule = publishedSchedules.find(s => s.storeId === sId) || publishedSchedules[0];
        const combinedSchedule = { ...baseSchedule };
        
        // Aggregate shifts for this user from all branches
        combinedSchedule.assignments = combinedSchedule.assignments.map((day: any) => {
          const userShifts: any[] = [];
          publishedSchedules.forEach(ps => {
            const psDay = ps.assignments.find((d: any) => d.date === day.date);
            if (psDay) {
              const myS = psDay.shifts.find((s: any) => 
                s.employeeId === currentUser.id || 
                s.employeeName === currentUser.name || 
                s.employeeId === currentUser.employeeId
              );
              if (myS) {
                userShifts.push({ ...myS, scheduledBranch: ps.storeId });
              }
            }
          });
          return { ...day, shifts: userShifts }; // Replace generic shifts with ONLY user's shifts
        });
        
        setSchedule(combinedSchedule);
      } else {
        setSchedule(null);
      }

      // Fetch requests
      const leaveRes = await fetch(`/api/schedule/leave-requests?storeId=${sId}`);
      const leaveData = await leaveRes.json();
      
      // Filter for this user's requests only
      if (leaveData.requests) {
        const userReqs = leaveData.requests.filter((r: any) => 
          r.employeeId === currentUser.id || r.employeeId === currentUser.employeeId || r.employeeName === currentUser.name
        );
        setLeaveRequests(userReqs);
      }
      
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleToggleMonth = (offset: 0 | 1) => {
    if (offset !== monthOffset) {
      setMonthOffset(offset);
      fetchData(user, offset);
    }
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
          storeId: resolveStoreId(user),
          date: leaveDate,
          type: leaveType
        })
      });
      
      alert(DICT[lang].successMsg);
      setLeaveDate("");
      fetchData(user, monthOffset); // Refresh
    } catch (err) {
      console.error(err);
      alert(DICT[lang].failMsg);
    }
    setSubmitting(false);
  };

  if (loading && !user) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 dark:bg-slate-900">
        <Clock3 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  const t = DICT[lang];
  const isRtl = lang === "ar";

  const getShiftColor = (shiftTime: string) => {
    if (!shiftTime) return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    const lower = shiftTime.toLowerCase();
    if (lower.includes('off')) return 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-800/50 shadow-sm';
    if (lower.includes('morning')) return 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 shadow-sm';
    if (lower.includes('night')) return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 shadow-sm';
    if (lower.includes('noon')) return 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50 shadow-sm';
    return 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 shadow-sm';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12 transition-colors duration-300" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <button 
              onClick={() => router.push('/cashier')} 
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <ArrowLeft className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
            <div>
              <h1 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-500" /> {t.title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{user?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full text-xs font-bold transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {lang === 'en' ? 'عربي' : 'EN'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 mt-4">
        
        {/* Actions & Month Toggle */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <button
            onClick={() => {
              if (!schedule || !schedule.assignments) return;
              let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Circle K//Schedule//EN\n";
              
              schedule.assignments.forEach((day: any) => {
                const myShift = day.shifts.find((s: any) => 
                  s.employeeId === user?.id || 
                  s.employeeName === user?.name || 
                  s.employeeId === user?.employeeId
                );
                
                if (myShift && !myShift.shiftTime.includes('Off')) {
                  const [yyyy, mm, dd] = day.date.split("-");
                  let startHour = "090000";
                  let endHour = "170000";
                  
                  if (myShift.shiftTime === 'Morning') { startHour = "080000"; endHour = "160000"; }
                  if (myShift.shiftTime === 'Noon') { startHour = "160000"; endHour = "235900"; }
                  if (myShift.shiftTime === 'Night') { startHour = "235900"; endHour = "080000"; }
                  
                  const dtStart = `${yyyy}${mm}${dd}T${startHour}`;
                  // Quick logic to calculate dtEnd (roughly)
                  let dtEnd = `${yyyy}${mm}${dd}T${endHour}`;
                  if (myShift.shiftTime === 'Night') {
                    // For night shift, add 1 day to end date
                    const nextD = new Date(day.date);
                    nextD.setDate(nextD.getDate() + 1);
                    const [ny, nm, nd] = nextD.toISOString().split("T")[0].split("-");
                    dtEnd = `${ny}${nm}${nd}T${endHour}`;
                  }
                  
                  const location = myShift.scheduledBranch ? myShift.scheduledBranch : resolveStoreId(user);

                  ics += "BEGIN:VEVENT\n";
                  ics += `DTSTART;TZID=Africa/Cairo:${dtStart}\n`;
                  ics += `DTEND;TZID=Africa/Cairo:${dtEnd}\n`;
                  ics += `SUMMARY:Shift - ${myShift.shiftTime}\n`;
                  ics += `LOCATION:${location}\n`;
                  ics += "END:VEVENT\n";
                }
              });
              ics += "END:VCALENDAR";

              const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Schedule_${resolveStoreId(user)}_${schedule.month || 'Current'}.ics`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg hover:shadow-xl"
          >
            <CalendarDays className="w-4 h-4" />
            Sync to Calendar
          </button>

          <div className="inline-flex bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-sm p-1.5 rounded-full shadow-inner border border-slate-200 dark:border-slate-700">
            <button 
              onClick={() => handleToggleMonth(0)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${monthOffset === 0 ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {t.currentMonth}
            </button>
            <button 
              onClick={() => handleToggleMonth(1)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${monthOffset === 1 ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {t.nextMonth}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left: Schedule Calendar View */}
          <div className="lg:col-span-7 space-y-4">
            
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-slate-800 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
              
              {loading ? (
                <div className="flex flex-col justify-center items-center h-64 opacity-50">
                   <Clock3 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                </div>
              ) : !schedule ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400"
                >
                  <CalendarX2 className="w-16 h-16 mb-4 opacity-30 text-blue-500" />
                  <p className="font-semibold text-lg">{t.noSchedule}</p>
                </motion.div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  <AnimatePresence>
                    {schedule.assignments.map((day: any, i: number) => {
                      // Match user by name OR id
                      const myShift = day.shifts.find((s: any) => 
                        s.employeeId === user?.id || 
                        s.employeeName === user?.name || 
                        s.employeeId === user?.employeeId
                      );
                      
                      if (!myShift) return null;
                      
                      const isOff = myShift.shiftTime?.toLowerCase().includes('off');
                      const dateObj = new Date(day.date);
                      const isToday = new Date().toDateString() === dateObj.toDateString();
                      
                      // Use proper locale formatting based on lang
                      const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
                      const formattedDate = dateObj.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', dateOptions);
                      
                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          key={day.date} 
                          className={`flex items-center justify-between p-4 rounded-2xl transition-colors
                            ${isToday ? 'bg-blue-50/80 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-slate-50/50 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-700/50'}
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl text-white font-bold shadow-sm
                              ${isOff ? 'bg-gradient-to-br from-red-400 to-red-500' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}
                            `}>
                              <span className="text-xs opacity-90">{dateObj.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short' })}</span>
                              <span className="text-lg leading-none">{dateObj.getDate()}</span>
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                {dateObj.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long' })}
                              </div>
                              {isToday && (
                                <span className="text-[10px] uppercase font-black tracking-wider text-blue-500">Today</span>
                              )}
                            </div>
                          </div>

                          <div className={`text-sm font-bold px-4 py-2 rounded-xl flex flex-col items-end gap-1 ${getShiftColor(myShift.shiftTime)}`}>
                            <div className="flex items-center gap-2">
                              {isOff ? <Sun className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                              {myShift.shiftTime}
                            </div>
                            {myShift.scheduledBranch && myShift.scheduledBranch !== resolveStoreId(user) && (
                              <span className="text-[9px] bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                                At {myShift.scheduledBranch.replace('eL-', '').replace('ola-el-', 'Ola ')}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions & Leave Requests */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Request Form */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-black/20"
            >
              <h2 className="font-black text-xl flex items-center mb-6 text-slate-800 dark:text-slate-100">
                <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-500 p-2 rounded-xl mr-3 rtl:mr-0 rtl:ml-3">
                  <Clock className="w-5 h-5" />
                </div>
                {t.requestOff}
              </h2>
              
              <form onSubmit={handleSubmitLeave} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t.date}</label>
                  <input 
                    type="date" 
                    required
                    value={leaveDate}
                    onChange={e => setLeaveDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t.type}</label>
                  <select 
                    value={leaveType}
                    onChange={e => setLeaveType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="Vacation">{t.vacation}</option>
                    <option value="Sick">{t.sick}</option>
                  </select>
                </div>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/30 active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2"
                >
                  {submitting ? <Clock3 className="w-5 h-5 animate-spin" /> : null}
                  {submitting ? t.submitting : t.submit}
                </button>
              </form>
            </motion.div>

            {/* Request History */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-black/20"
            >
              <h3 className="font-black text-lg mb-4 text-slate-800 dark:text-slate-100">{t.myRequests}</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {leaveRequests.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">{t.noRequests}</p>
                ) : (
                  leaveRequests.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).map((req) => (
                    <div key={req.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex justify-between items-center transition-all hover:shadow-md">
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">{req.date}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium bg-white dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-700">{req.type}</div>
                      </div>
                      <div className="flex items-center">
                        {req.status === 'pending' && <span className="flex items-center text-yellow-600 bg-yellow-100 border border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800/50 dark:text-yellow-400 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm"><Clock3 className="w-3.5 h-3.5 mr-1 rtl:mr-0 rtl:ml-1" /> {t.pending}</span>}
                        {req.status === 'approved' && <span className="flex items-center text-emerald-600 bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800/50 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm"><CheckCircle className="w-3.5 h-3.5 mr-1 rtl:mr-0 rtl:ml-1" /> {t.approved}</span>}
                        {req.status === 'rejected' && <span className="flex items-center text-red-600 bg-red-100 border border-red-200 dark:bg-red-900/30 dark:border-red-800/50 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm"><XCircle className="w-3.5 h-3.5 mr-1 rtl:mr-0 rtl:ml-1" /> {t.rejected}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

          </div>

        </div>
      </div>
    </div>
  );
}
