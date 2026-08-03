"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Calendar as CalendarIcon, Clock, CheckCircle2, 
  XCircle, Clock3, CalendarDays, Globe, Sun, Moon, Sunrise,
  Coffee, CalendarCheck, Users, ChevronLeft, ChevronRight,
  Sparkles, CheckCircle, AlertCircle
} from "lucide-react";
import { CashierBottomNav } from "@/components/CashierBottomNav";
import { PullToRefresh } from "@/components/MobileUX/PullToRefresh";
import { SkeletonSchedule } from "@/components/MobileUX/SkeletonLoader";
import { normalizeBranchId, getDbStoreId, getBranchDisplayName } from "@/lib/schedule-generator";

// Design Tokens (Circle K Cashier Theme)
const D = {
  bg: "#0B1121",
  surface: "#151E32",
  surfaceHigh: "#1E293B",
  border: "rgba(255,255,255,0.08)",
  borderMid: "rgba(255,255,255,0.14)",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textDim: "#64748B",
  cyan: "#22D3EE",
  cyanDim: "rgba(34,211,238,0.12)",
  cyanBorder: "rgba(34,211,238,0.3)",
  red: "#EF4444",
  redDim: "rgba(239,68,68,0.12)",
  green: "#10B981",
  greenDim: "rgba(16,185,129,0.12)",
  amber: "#F59E0B",
  amberDim: "rgba(245,158,11,0.12)",
  purple: "#A855F7",
  purpleDim: "rgba(168,85,247,0.12)",
  blue: "#3B82F6",
  blueDim: "rgba(59,130,246,0.12)",
  orange: "#F97316",
  orangeDim: "rgba(249,115,22,0.12)",
};

const DICT = {
  en: {
    title: "My Work Schedule",
    currentMonth: "Current Month",
    nextMonth: "Next Month",
    noSchedule: "No published schedule available for this month.",
    publishedNotice: "Schedule is active and verified by management.",
    requestOff: "Request Time Off",
    date: "Date",
    type: "Reason / Type",
    vacation: "Annual Vacation",
    sick: "Sick Leave",
    personal: "Personal Emergency",
    submit: "Submit Request",
    submitting: "Submitting...",
    myRequests: "My Time-Off Requests",
    noRequests: "No pending or past leave requests.",
    pending: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
    successMsg: "Leave request submitted to branch manager!",
    failMsg: "Failed to submit request.",
    myShiftsTab: "My Shifts",
    branchTeamTab: "Today's Branch Team",
    syncCalendar: "Sync to Calendar",
    totalShifts: "Scheduled Shifts",
    workedDays: "Work Days",
    offDays: "Days Off",
    morning: "Morning (08:00 - 16:00)",
    noon: "Noon (16:00 - 00:00)",
    night: "Night (00:00 - 08:00)",
    off: "Day Off",
    today: "TODAY",
  },
  ar: {
    title: "جدول مواعيد العمل",
    currentMonth: "الشهر الحالي",
    nextMonth: "الشهر القادم",
    noSchedule: "لم يتم نشر جدول معتمد لهذا الشهر حتى الآن.",
    publishedNotice: "الجدول معتمد وساري من إدارة الفرع.",
    requestOff: "طلب إجازة / إذن غياب",
    date: "التاريخ",
    type: "نوع الإجازة",
    vacation: "إجازة سنوية / اعتيادية",
    sick: "إجازة مرضية",
    personal: "ظرف طارئ",
    submit: "إرسال الطلب للمدير",
    submitting: "جاري الإرسال...",
    myRequests: "طلبات الإجازات الخاصة بي",
    noRequests: "لا توجد طلبات إجازة سابقة.",
    pending: "قيد المراجعة",
    approved: "تمت الموافقة",
    rejected: "مرفوض",
    successMsg: "تم إرسال طلب الإجازة لمدير الفرع بنجاح!",
    failMsg: "حدث خطأ أثناء إرسال الطلب.",
    myShiftsTab: "وردياتي",
    branchTeamTab: "فريق عمل اليوم بالفرع",
    syncCalendar: "حفظ في التقويم",
    totalShifts: "إجمالي الشيفتات",
    workedDays: "أيام العمل",
    offDays: "أيام الراحة",
    morning: "صباحي (08:00 - 16:00)",
    noon: "مسائي (16:00 - 00:00)",
    night: "ليلي (00:00 - 08:00)",
    off: "راحة أسبوعية",
    today: "اليوم",
  },
};

const getShiftBadgeStyle = (shiftTime: string = "") => {
  const lower = shiftTime.toLowerCase();
  if (lower.includes("leave")) {
    return { bg: D.greenDim, color: D.green, border: "rgba(16,185,129,0.3)", icon: CalendarCheck, label: "Leave" };
  }
  if (lower.includes("off")) {
    return { bg: "rgba(100,116,139,0.15)", color: "#94A3B8", border: "rgba(100,116,139,0.3)", icon: Coffee, label: "Off" };
  }
  if (lower.includes("night")) {
    return { bg: D.purpleDim, color: D.purple, border: "rgba(168,85,247,0.3)", icon: Moon, label: "Night" };
  }
  if (lower.includes("noon")) {
    return { bg: D.orangeDim, color: D.orange, border: "rgba(249,115,22,0.3)", icon: Sun, label: "Noon" };
  }
  return { bg: D.cyanDim, color: D.cyan, border: D.cyanBorder, icon: Sunrise, label: "Morning" };
};

export default function CashierSchedulePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [monthOffset, setMonthOffset] = useState<0 | 1>(0);
  const [activeTab, setActiveTab] = useState<"personal" | "team">("personal");
  
  // Leave request form
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveType, setLeaveType] = useState("Vacation");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (savedUserStr) {
      try {
        const parsedUser = JSON.parse(savedUserStr);
        setUser(parsedUser);
        fetchData(parsedUser, 0);
      } catch {
        router.push("/cashier");
      }
    } else {
      router.push("/cashier");
    }
  }, []);

  const resolveStoreId = (u: any) => {
    if (!u) return "eL-alamein-4";
    const sid = u.storeId && u.storeId !== "N/A" && u.storeId !== "ALL" ? u.storeId : u.branchId;
    return getDbStoreId(sid);
  };

  const fetchData = async (currentUser: any, offset: number) => {
    setLoading(true);
    setSchedule(null);
    try {
      const d = new Date();
      d.setMonth(d.getMonth() + offset);
      const targetMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const storeId = resolveStoreId(currentUser);

      const ALL_STORES = ["eL-alamein-4", "ola-el-koronfol"];
      const results = await Promise.all(
        ALL_STORES.map((sId) =>
          fetch(`/api/schedule?storeId=${sId}&month=${targetMonth}&t=${Date.now()}`, { cache: "no-store" })
            .then((r) => r.json())
            .catch(() => ({ schedule: null }))
        )
      );

      const published = results
        .map((r) => r.schedule)
        .filter((s) => s && s.isPublished);

      if (published.length > 0) {
        // Pick store schedule matching user's branch or fallback
        const primary = published.find((s) => normalizeBranchId(s.storeId) === normalizeBranchId(storeId)) || published[0];
        setSchedule(primary);
      } else {
        setSchedule(null);
      }

      // Fetch leave requests
      const leaveRes = await fetch(`/api/schedule/leave-requests?storeId=${storeId}&t=${Date.now()}`, { cache: "no-store" });
      const leaveData = await leaveRes.json();
      if (leaveData.requests) {
        const userReqs = leaveData.requests.filter((r: any) =>
          r.employeeId === currentUser.id ||
          r.employeeId === currentUser.employeeId ||
          (r.employeeName && r.employeeName.trim().toLowerCase() === currentUser.name?.trim().toLowerCase())
        );
        setLeaveRequests(userReqs);
      }
    } catch (e) {
      console.error("Error fetching cashier schedule", e);
    } finally {
      setLoading(false);
    }
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
    } finally {
      setSubmitting(false);
    }
  };

  // Find user's shift for a given day with robust matching
  const findUserShift = (day: any) => {
    if (!day || !day.shifts || !user) return null;
    return day.shifts.find((s: any) =>
      s.employeeId === user.id ||
      s.employeeId === user.employeeId ||
      (s.employeeName && s.employeeName.trim().toLowerCase() === user.name?.trim().toLowerCase())
    );
  };

  // Calculate personal month metrics
  const personalStats = React.useMemo(() => {
    if (!schedule || !schedule.assignments || !user) {
      return { totalDays: 0, workedDays: 0, morning: 0, noon: 0, night: 0, off: 0, leave: 0 };
    }
    let worked = 0, m = 0, n = 0, nt = 0, off = 0, leave = 0;
    schedule.assignments.forEach((day: any) => {
      const shift = findUserShift(day);
      if (shift) {
        const time = shift.shiftTime || "";
        if (time.includes("Morning")) { worked++; m++; }
        else if (time.includes("Noon")) { worked++; n++; }
        else if (time.includes("Night")) { worked++; nt++; }
        else if (time.includes("Approved Leave")) { leave++; }
        else { off++; }
      }
    });
    return { totalDays: schedule.assignments.length, workedDays: worked, morning: m, noon: n, night: nt, off, leave };
  }, [schedule, user]);

  const t = DICT[lang];
  const isRtl = lang === "ar";

  // Today's date string YYYY-MM-DD
  const todayStr = new Date().toISOString().split("T")[0];
  const todayDayObj = schedule?.assignments?.find((d: any) => d.date === todayStr);

  const rootStyle: React.CSSProperties = {
    backgroundColor: D.bg,
    color: D.textPrimary,
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    direction: isRtl ? "rtl" : "ltr",
  };

  if (loading) {
    return (
      <div style={rootStyle} className="ck-cashier">
        <style>{`.ck-cashier * { color-scheme: dark !important; }`}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "24px 20px 10px" }}>
          <button
            onClick={() => router.push("/cashier")}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: 12, background: D.surface,
              border: `1px solid ${D.border}`, color: D.textPrimary, cursor: "pointer",
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: D.textPrimary, margin: 0 }}>{t.title}</h1>
        </div>
        <SkeletonSchedule />
      </div>
    );
  }

  return (
    <>
      <div style={rootStyle} className="ck-cashier">
        <style>{`
          .ck-cashier * { color-scheme: dark !important; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
        `}</style>

        {/* ── HEADER ── */}
        <header
          style={{
            backgroundColor: D.surface, borderBottom: `1px solid ${D.border}`,
            padding: "14px 20px", position: "sticky", top: 0, zIndex: 50,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            backdropFilter: "blur(16px)",
          }}
        >
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
              {user && (
                <p style={{ fontSize: 11, color: D.textSecondary, margin: 0, marginTop: 2 }}>
                  {user.name} • {getBranchDisplayName(user.storeId || user.branchId)}
                </p>
              )}
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

        {/* ── MAIN CONTENT ── */}
        <main style={{ flex: 1, paddingBottom: "100px" }}>
          <PullToRefresh onRefresh={async () => { await fetchData(user, monthOffset); }}>
            <div style={{ padding: "20px 16px 24px", maxWidth: 700, margin: "0 auto" }}>

              {/* Month Toggle & Calendar Sync */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10 }}>
                <div style={{ display: "inline-flex", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: 4, gap: 2 }}>
                  {([0, 1] as const).map((offset) => (
                    <button
                      key={offset}
                      onClick={() => handleToggleMonth(offset)}
                      style={{
                        padding: "8px 16px", borderRadius: 9, fontSize: 12, fontWeight: 700,
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
                      const myShift = findUserShift(day);
                      if (myShift && !myShift.shiftTime?.toLowerCase().includes("off")) {
                        const [yyyy, mm, dd] = day.date.split("-");
                        let startHour = "080000", endHour = "160000";
                        if (myShift.shiftTime === "Noon") { startHour = "160000"; endHour = "235900"; }
                        if (myShift.shiftTime === "Night") { startHour = "235900"; endHour = "080000"; }
                        ics += `BEGIN:VEVENT\nDTSTART;TZID=Africa/Cairo:${yyyy}${mm}${dd}T${startHour}\nDTEND;TZID=Africa/Cairo:${yyyy}${mm}${dd}T${endHour}\nSUMMARY:Circle K Shift: ${myShift.shiftTime}\nEND:VEVENT\n`;
                      }
                    });
                    ics += "END:VCALENDAR";
                    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "CircleK_Schedule.ics";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                    borderRadius: 10, background: D.surfaceHigh, border: `1px solid ${D.border}`,
                    color: D.cyan, fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <CalendarDays size={13} color={D.cyan} />
                  {t.syncCalendar}
                </button>
              </div>

              {/* Personal Monthly Stat Overview */}
              {schedule && (
                <div
                  style={{
                    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, padding: "12px", textAlign: "center" }}>
                    <p style={{ fontSize: 10, color: D.textSecondary, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{t.workedDays}</p>
                    <p style={{ fontSize: 18, fontWeight: 900, color: D.cyan, margin: "4px 0 0" }}>{personalStats.workedDays}</p>
                  </div>
                  <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, padding: "12px", textAlign: "center" }}>
                    <p style={{ fontSize: 10, color: D.textSecondary, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{t.offDays}</p>
                    <p style={{ fontSize: 18, fontWeight: 900, color: D.textSecondary, margin: "4px 0 0" }}>{personalStats.off}</p>
                  </div>
                  <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, padding: "12px", textAlign: "center" }}>
                    <p style={{ fontSize: 10, color: D.textSecondary, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Morning / Night</p>
                    <p style={{ fontSize: 18, fontWeight: 900, color: D.purple, margin: "4px 0 0" }}>
                      {personalStats.morning}M • {personalStats.night}Nt
                    </p>
                  </div>
                </div>
              )}

              {/* View Switcher: My Shifts vs Branch Team */}
              <div style={{ display: "flex", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: 3, marginBottom: 16 }}>
                <button
                  onClick={() => setActiveTab("personal")}
                  style={{
                    flex: 1, padding: "9px", borderRadius: 11, fontSize: 12, fontWeight: 800,
                    border: "none", cursor: "pointer", transition: "all 0.15s",
                    background: activeTab === "personal" ? D.surfaceHigh : "transparent",
                    color: activeTab === "personal" ? D.textPrimary : D.textSecondary,
                  }}
                >
                  {t.myShiftsTab}
                </button>
                <button
                  onClick={() => setActiveTab("team")}
                  style={{
                    flex: 1, padding: "9px", borderRadius: 11, fontSize: 12, fontWeight: 800,
                    border: "none", cursor: "pointer", transition: "all 0.15s",
                    background: activeTab === "team" ? D.surfaceHigh : "transparent",
                    color: activeTab === "team" ? D.textPrimary : D.textSecondary,
                  }}
                >
                  {t.branchTeamTab}
                </button>
              </div>

              {/* TAB 1: PERSONAL SHIFTS */}
              {activeTab === "personal" && (
                <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 20, padding: 16, marginBottom: 20 }}>
                  {!schedule ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px", gap: 12 }}>
                      <CalendarIcon size={40} color={D.textDim} />
                      <p style={{ color: D.textSecondary, fontWeight: 600, fontSize: 14, margin: 0 }}>{t.noSchedule}</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflowY: "auto" }}>
                      {schedule.assignments.map((day: any) => {
                        const myShift = findUserShift(day);
                        const shiftTime = myShift ? myShift.shiftTime : "Off";
                        const badge = getShiftBadgeStyle(shiftTime);
                        const isOff = shiftTime.toLowerCase().includes("off");
                        const dateObj = new Date(day.date);
                        const isToday = new Date().toISOString().split("T")[0] === day.date;
                        const ShiftIcon = badge.icon;

                        return (
                          <div
                            key={day.date}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "12px 14px", borderRadius: 14,
                              background: isToday ? "rgba(34,211,238,0.07)" : D.surfaceHigh,
                              border: `1px solid ${isToday ? D.cyanBorder : D.border}`,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div
                                style={{
                                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                  background: isOff ? "rgba(100,116,139,0.12)" : D.cyanDim,
                                  border: `1px solid ${isOff ? "rgba(100,116,139,0.25)" : D.cyanBorder}`,
                                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                }}
                              >
                                <span style={{ fontSize: 9, fontWeight: 800, color: isOff ? D.textSecondary : D.cyan, textTransform: "uppercase" }}>
                                  {dateObj.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { month: "short" })}
                                </span>
                                <span style={{ fontSize: 16, fontWeight: 900, color: isOff ? D.textSecondary : D.textPrimary, lineHeight: 1 }}>
                                  {dateObj.getDate()}
                                </span>
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: D.textPrimary }}>
                                  {dateObj.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { weekday: "long" })}
                                </div>
                                {isToday && (
                                  <span style={{ fontSize: 9, fontWeight: 900, color: D.cyan, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                    {t.today}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex", alignItems: "center", gap: 6,
                                padding: "6px 12px", borderRadius: 10, flexShrink: 0,
                                background: badge.bg, border: `1px solid ${badge.border}`,
                                color: badge.color, fontSize: 12, fontWeight: 800,
                              }}
                            >
                              <ShiftIcon size={14} />
                              {shiftTime}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TODAY'S BRANCH TEAM */}
              {activeTab === "team" && (
                <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 20, padding: 18, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                      <Users size={16} color={D.cyan} />
                      {t.branchTeamTab}
                    </h3>
                    <span style={{ fontSize: 11, color: D.cyan, fontWeight: 700 }}>
                      {new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { weekday: "long", month: "short", day: "numeric" })}
                    </span>
                  </div>

                  {!todayDayObj || !todayDayObj.shifts?.length ? (
                    <p style={{ fontSize: 13, color: D.textDim, textAlign: "center", padding: "24px 0" }}>
                      No on-duty team data found for today.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {todayDayObj.shifts.map((s: any) => {
                        const badge = getShiftBadgeStyle(s.shiftTime);
                        const isMe = s.employeeId === user?.id || s.employeeName === user?.name;
                        const ShiftIcon = badge.icon;
                        return (
                          <div
                            key={s.employeeId}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "10px 14px", borderRadius: 12,
                              background: isMe ? "rgba(34,211,238,0.08)" : D.surfaceHigh,
                              border: `1px solid ${isMe ? D.cyanBorder : D.border}`,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: D.textPrimary }}>
                                {s.employeeName} {isMe && <span style={{ color: D.cyan, fontSize: 11 }}>(You)</span>}
                              </div>
                              <div style={{ fontSize: 10, color: D.textSecondary, marginTop: 1 }}>{s.position || "Staff"}</div>
                            </div>
                            <div
                              style={{
                                display: "flex", alignItems: "center", gap: 5,
                                padding: "4px 10px", borderRadius: 8,
                                background: badge.bg, color: badge.color,
                                border: `1px solid ${badge.border}`,
                                fontSize: 11, fontWeight: 800,
                              }}
                            >
                              <ShiftIcon size={12} />
                              {s.shiftTime}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

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
                      <option value="Personal">{t.personal}</option>
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
                        const statusBg = req.status === "approved" ? D.greenDim : req.status === "rejected" ? D.redDim : D.amberDim;
                        const statusLabel = req.status === "approved" ? t.approved : req.status === "rejected" ? t.rejected : t.pending;
                        const StatusIcon = req.status === "approved" ? CheckCircle : req.status === "rejected" ? XCircle : Clock3;
                        return (
                          <div
                            key={req.id}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "10px 14px", borderRadius: 12,
                              background: D.surfaceHigh, border: `1px solid ${D.border}`,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{req.date}</div>
                              <div style={{ fontSize: 11, color: D.textSecondary, marginTop: 2 }}>{req.type}</div>
                            </div>
                            <span
                              style={{
                                display: "flex", alignItems: "center", gap: 5,
                                padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 800,
                                background: statusBg, color: statusColor,
                              }}
                            >
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
          </PullToRefresh>
        </main>
      </div>
      <CashierBottomNav lang={lang} />
    </>
  );
}
