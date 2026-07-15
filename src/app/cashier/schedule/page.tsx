"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  CalendarDays, ArrowLeft, Clock, CalendarX2, CheckCircle, Clock3, XCircle, ChevronLeft, ChevronRight, Moon, Sun, Globe
} from "lucide-react";
import { CashierBottomNav } from "@/components/CashierBottomNav";

// ── Design Tokens ─────────────────────────────────────────────
const D = {
  bg:           "#0B1121",
  surface:      "#151E32",
  surfaceHigh:  "#1C2841",
  border:       "rgba(34, 211, 238, 0.15)",
  borderMid:    "rgba(34, 211, 238, 0.25)",
  textPrimary:  "#f8fafc",
  textSecondary:"#94a3b8",
  textDim:      "#64748b",
  cyan:         "#22d3ee",
  cyanDim:      "rgba(34, 211, 238, 0.1)",
  cyanBorder:   "rgba(34, 211, 238, 0.25)",
  red:          "#ef4444",
  redDim:       "rgba(239,68,68,0.12)",
  amber:        "#f59e0b",
  amberDim:     "rgba(245,158,11,0.12)",
  blue:         "#60a5fa",
  blueDim:      "rgba(96,165,250,0.12)",
  green:        "#34d399",
  greenDim:     "rgba(52,211,153,0.12)",
  indigo:       "#818cf8",
  indigoDim:    "rgba(129,140,248,0.12)",
  orange:       "#fb923c",
  orangeDim:    "rgba(251,146,60,0.12)",
};

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
    noRequests: "No leave requests yet.",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    successMsg: "Leave request submitted!",
    failMsg: "Failed to submit request.",
    syncCalendar: "Sync to Calendar",
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
    failMsg: "فشل في تقديم الطلب.",
    syncCalendar: "مزامنة التقويم",
  }
};

const getShiftStyle = (shiftTime: string): { bg: string; color: string; border: string } => {
  if (!shiftTime) return { bg: D.surfaceHigh, color: D.textSecondary, border: D.border };
  const lower = shiftTime.toLowerCase();
  if (lower.includes("off"))     return { bg: D.redDim,    color: D.red,    border: "rgba(239,68,68,0.25)" };
  if (lower.includes("morning")) return { bg: D.amberDim,  color: D.amber,  border: "rgba(245,158,11,0.25)" };
  if (lower.includes("night"))   return { bg: D.indigoDim, color: D.indigo, border: "rgba(129,140,248,0.25)" };
  if (lower.includes("noon"))    return { bg: D.orangeDim, color: D.orange, border: "rgba(251,146,60,0.25)" };
  return { bg: D.blueDim, color: D.blue, border: "rgba(96,165,250,0.25)" };
};

export default function CashierSchedulePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [monthOffset, setMonthOffset] = useState<0 | 1>(0);
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveType, setLeaveType] = useState("Vacation");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (savedUserStr) {
      const parsedUser = JSON.parse(savedUserStr);
      setUser(parsedUser);
      fetchData(parsedUser, 0);
    } else {
      router.push("/cashier");
    }
  }, []);

  const resolveStoreId = (u: any) => {
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
      const targetMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const sId = resolveStoreId(currentUser);
      const ALL_BRANCH_IDS = ["eL-alamein-4", "ola-el-koronfol"];

      const allSchedulesData = await Promise.all(
        ALL_BRANCH_IDS.map((bId) =>
          fetch(`/api/schedule?storeId=${bId}&month=${targetMonth}`).then((r) => r.json())
        )
      );

      const publishedSchedules = allSchedulesData
        .map((d) => d.schedule)
        .filter((s) => s && s.isPublished);

      if (publishedSchedules.length > 0) {
        const baseSchedule = publishedSchedules.find((s) => s.storeId === sId) || publishedSchedules[0];
        const combinedSchedule = { ...baseSchedule };
        combinedSchedule.assignments = combinedSchedule.assignments.map((day: any) => {
          const userShifts: any[] = [];
          publishedSchedules.forEach((ps) => {
            const psDay = ps.assignments.find((d: any) => d.date === day.date);
            if (psDay) {
              const myS = psDay.shifts.find((s: any) =>
                s.employeeId === currentUser.id ||
                s.employeeName === currentUser.name ||
                s.employeeId === currentUser.employeeId
              );
              if (myS) userShifts.push({ ...myS, scheduledBranch: ps.storeId });
            }
          });
          return { ...day, shifts: userShifts };
        });
        setSchedule(combinedSchedule);
      } else {
        setSchedule(null);
      }

      const leaveRes = await fetch(`/api/schedule/leave-requests?storeId=${resolveStoreId(currentUser)}`);
      const leaveData = await leaveRes.json();
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
      await fetch("/api/schedule/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: user.id,
          employeeName: user.name,
          storeId: resolveStoreId(user),
          date: leaveDate,
          type: leaveType,
        }),
      });
      alert(DICT[lang].successMsg);
      setLeaveDate("");
      fetchData(user, monthOffset);
    } catch {
      alert(DICT[lang].failMsg);
    }
    setSubmitting(false);
  };

  const t = DICT[lang];
  const isRtl = lang === "ar";

  const root: React.CSSProperties = {
    backgroundColor: D.bg,
    color: D.textPrimary,
    minHeight: "100dvh",
    colorScheme: "dark" as any,
    fontFamily: "'Inter','Cairo',-apple-system,system-ui,sans-serif",
    direction: isRtl ? "rtl" : "ltr",
  };

  if (loading && !user) {
    return (
      <div style={{ ...root, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Clock3 style={{ width: 40, height: 40, color: D.cyan, animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <>
    <div style={root}>

      {/* ── HEADER ── */}
      <header style={{
        backgroundColor: D.surface, borderBottom: `1px solid ${D.border}`,
        padding: "14px 20px", position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        backdropFilter: "blur(16px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.push("/cashier")}
            style={{
              width: 36, height: 36, borderRadius: 10, background: D.surfaceHigh,
              border: `1px solid ${D.border}`, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer",
            }}
          >
            <ArrowLeft size={16} color={D.textSecondary} style={{ transform: isRtl ? "scaleX(-1)" : "none" }} />
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarDays size={16} color={D.cyan} />
              <h1 style={{ fontSize: 16, fontWeight: 800, color: D.textPrimary, margin: 0 }}>{t.title}</h1>
            </div>
            {user && <p style={{ fontSize: 11, color: D.textSecondary, margin: 0, marginTop: 2 }}>{user.name}</p>}
          </div>
        </div>
        <button
          onClick={() => setLang(lang === "en" ? "ar" : "en")}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
            borderRadius: 8, background: D.surfaceHigh, border: `1px solid ${D.border}`,
            color: D.textSecondary, fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}
        >
          <Globe size={12} color={D.textSecondary} />
          {lang === "en" ? "عربي" : "EN"}
        </button>
      </header>

      <div style={{ padding: "20px 16px 24px", maxWidth: 700, margin: "0 auto" }}>

        {/* Month Toggle */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20, gap: 12,
        }}>
          {/* Sync to Calendar - hidden on mobile, shown on wider screens */}
          <div style={{
            display: "inline-flex", background: D.surface,
            border: `1px solid ${D.border}`, borderRadius: 12, padding: 4, gap: 2,
          }}>
            {([0, 1] as const).map((offset) => (
              <button
                key={offset}
                onClick={() => handleToggleMonth(offset)}
                style={{
                  padding: "8px 18px", borderRadius: 9, fontSize: 12, fontWeight: 700,
                  border: "none", cursor: "pointer", transition: "all 0.15s",
                  background: monthOffset === offset ? D.cyan : "transparent",
                  color: monthOffset === offset ? "#0B1121" : D.textSecondary,
                }}
              >
                {offset === 0 ? t.currentMonth : t.nextMonth}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (!schedule?.assignments) return;
              let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Circle K//Schedule//EN\n";
              schedule.assignments.forEach((day: any) => {
                const myShift = day.shifts.find((s: any) =>
                  s.employeeId === user?.id || s.employeeName === user?.name || s.employeeId === user?.employeeId
                );
                if (myShift && !myShift.shiftTime?.toLowerCase().includes("off")) {
                  const [yyyy, mm, dd] = day.date.split("-");
                  let startHour = "090000", endHour = "170000";
                  if (myShift.shiftTime === "Morning") { startHour = "080000"; endHour = "160000"; }
                  if (myShift.shiftTime === "Noon")    { startHour = "160000"; endHour = "235900"; }
                  if (myShift.shiftTime === "Night")   { startHour = "235900"; endHour = "080000"; }
                  ics += `BEGIN:VEVENT\nDTSTART;TZID=Africa/Cairo:${yyyy}${mm}${dd}T${startHour}\nDTEND;TZID=Africa/Cairo:${yyyy}${mm}${dd}T${endHour}\nSUMMARY:Shift - ${myShift.shiftTime}\nEND:VEVENT\n`;
                }
              });
              ics += "END:VCALENDAR";
              const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "Schedule.ics"; a.click();
              URL.revokeObjectURL(url);
            }}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
              borderRadius: 10, background: D.surfaceHigh, border: `1px solid ${D.border}`,
              color: D.textSecondary, fontSize: 11, fontWeight: 700, cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <CalendarDays size={13} color={D.cyan} />
            {t.syncCalendar}
          </button>
        </div>

        {/* Schedule List */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 20, padding: 16, marginBottom: 20 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 160 }}>
              <Clock3 size={28} color={D.cyan} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : !schedule ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px", gap: 12 }}>
              <CalendarX2 size={40} color={D.textDim} />
              <p style={{ color: D.textSecondary, fontWeight: 600, fontSize: 14, margin: 0 }}>{t.noSchedule}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
              {schedule.assignments.map((day: any) => {
                const myShift = day.shifts.find((s: any) =>
                  s.employeeId === user?.id || s.employeeName === user?.name || s.employeeId === user?.employeeId
                );
                if (!myShift) return null;
                const shiftStyle = getShiftStyle(myShift.shiftTime);
                const isOff = myShift.shiftTime?.toLowerCase().includes("off");
                const dateObj = new Date(day.date);
                const isToday = new Date().toDateString() === dateObj.toDateString();
                return (
                  <div key={day.date} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 14,
                    background: isToday ? "rgba(34,211,238,0.06)" : D.surfaceHigh,
                    border: `1px solid ${isToday ? D.cyanBorder : D.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                        background: isOff ? D.redDim : D.cyanDim,
                        border: `1px solid ${isOff ? "rgba(239,68,68,0.25)" : D.cyanBorder}`,
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: isOff ? D.red : D.cyan, textTransform: "uppercase" }}>
                          {dateObj.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { month: "short" })}
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: isOff ? D.red : D.textPrimary, lineHeight: 1 }}>
                          {dateObj.getDate()}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>
                          {dateObj.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { weekday: "long" })}
                        </div>
                        {isToday && (
                          <span style={{ fontSize: 9, fontWeight: 800, color: D.cyan, textTransform: "uppercase", letterSpacing: "0.08em" }}>TODAY</span>
                        )}
                      </div>
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 12px", borderRadius: 10, flexShrink: 0,
                      background: shiftStyle.bg, border: `1px solid ${shiftStyle.border}`,
                      color: shiftStyle.color, fontSize: 12, fontWeight: 800,
                    }}>
                      {isOff ? <Sun size={13} /> : <Clock size={13} />}
                      {myShift.shiftTime}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Request Time Off Form */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 20, padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: D.textPrimary, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: D.amberDim, border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Clock size={13} color={D.amber} />
            </span>
            {t.requestOff}
          </h2>
          <form onSubmit={handleSubmitLeave} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{t.date}</label>
              <input
                type="date" required value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 12, boxSizing: "border-box",
                  background: D.surfaceHigh, border: `1px solid ${D.borderMid}`,
                  color: D.textPrimary, fontSize: 14, outline: "none", colorScheme: "dark",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{t.type}</label>
              <select
                value={leaveType} onChange={(e) => setLeaveType(e.target.value)}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 12, boxSizing: "border-box",
                  background: D.surfaceHigh, border: `1px solid ${D.borderMid}`,
                  color: D.textPrimary, fontSize: 14, outline: "none", colorScheme: "dark", cursor: "pointer",
                }}
              >
                <option value="Vacation">{t.vacation}</option>
                <option value="Sick">{t.sick}</option>
              </select>
            </div>
            <button
              type="submit" disabled={submitting}
              style={{
                width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: submitting ? "not-allowed" : "pointer",
                background: submitting ? D.surfaceHigh : D.cyan, color: submitting ? D.textDim : "#0B1121",
                fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.15s",
              }}
            >
              {submitting ? <Clock3 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}
              {submitting ? t.submitting : t.submit}
            </button>
          </form>
        </div>

        {/* Leave Request History */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 20, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary, margin: "0 0 14px" }}>{t.myRequests}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {leaveRequests.length === 0 ? (
              <p style={{ fontSize: 13, color: D.textDim, textAlign: "center", padding: "20px 0", margin: 0 }}>{t.noRequests}</p>
            ) : (
              leaveRequests
                .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                .map((req) => {
                  const statusColor = req.status === "approved" ? D.green : req.status === "rejected" ? D.red : D.amber;
                  const statusBg   = req.status === "approved" ? D.greenDim : req.status === "rejected" ? D.redDim : D.amberDim;
                  const statusLabel = req.status === "approved" ? t.approved : req.status === "rejected" ? t.rejected : t.pending;
                  const StatusIcon  = req.status === "approved" ? CheckCircle : req.status === "rejected" ? XCircle : Clock3;
                  return (
                    <div key={req.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: 12,
                      background: D.surfaceHigh, border: `1px solid ${D.border}`,
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{req.date}</div>
                        <div style={{ fontSize: 11, color: D.textSecondary, marginTop: 2 }}>{req.type}</div>
                      </div>
                      <span style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 800,
                        background: statusBg, color: statusColor,
                      }}>
                        <StatusIcon size={12} />
                        {statusLabel}
                      </span>
                    </div>
                  );
                })
            )}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { color-scheme: dark; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
      `}</style>
    </div>
    <CashierBottomNav lang={lang} />
    </>
  );
}
