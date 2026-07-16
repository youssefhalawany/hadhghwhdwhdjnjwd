"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, UserCircle, Banknote, Calendar, ShieldAlert,
  TrendingUp, TrendingDown, Clock, ShieldCheck, FileText, Globe,
  CheckCircle, XCircle, AlertTriangle, Eye, ChevronDown, ChevronUp, User, Phone, Tag, Award, Star, Medal, Package
} from "lucide-react";
import { CashierBottomNav } from "@/components/CashierBottomNav";

// ── Design Tokens ────────────────────────────────────────────
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
  redBorder:    "rgba(239,68,68,0.30)",
  green:        "#34d399",
  greenDim:     "rgba(52,211,153,0.12)",
  greenBorder:  "rgba(52,211,153,0.25)",
  amber:        "#f59e0b",
  amberDim:     "rgba(245,158,11,0.12)",
  amberBorder:  "rgba(245,158,11,0.3)",
  blue:         "#60a5fa",
  blueDim:      "rgba(96,165,250,0.12)",
  blueBorder:   "rgba(96,165,250,0.3)",
  purple:       "#a78bfa",
  purpleDim:    "rgba(167,139,250,0.12)",
  purpleBorder: "rgba(167,139,250,0.3)",
};

export default function MyAccountPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [loading, setLoading] = useState(true);

  const [userProfile, setUserProfile] = useState<any>(null);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [payrollLines, setPayrollLines] = useState<any[]>([]);
  const [shiftReports, setShiftReports] = useState<any[]>([]);
  const [voidRequests, setVoidRequests] = useState<any[]>([]);
  const [allShiftsGlobally, setAllShiftsGlobally] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<"financials" | "shifts" | "voids" | "badges">("financials");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  useEffect(() => {
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (!savedUserStr) { router.push("/cashier"); return; }

    const sessionData = JSON.parse(savedUserStr);
    const employeeId = sessionData.id;

    const fetchStaffData = async () => {
      try {
        let profileName = sessionData.name;
        let profileData = { id: employeeId, name: profileName, ...sessionData };
        let actualEmployeeId = sessionData.employeeId || "";

        if (actualEmployeeId) {
          try {
            const empSnap = await getDoc(doc(db, "employees", actualEmployeeId));
            if (empSnap.exists()) profileData = { id: empSnap.id, ...empSnap.data() };
          } catch (e) { console.error("Direct employee fetch failed:", e); }
        }

        if (!profileData.nationalId && !profileData.phone) {
          try {
            const empQuery = query(collection(db, "employees"), where("name", "==", profileName));
            const empSnap = await getDocs(empQuery);
            if (!empSnap.empty) {
              const empDoc = empSnap.docs[0];
              profileData = { id: empDoc.id, ...empDoc.data() };
              actualEmployeeId = empDoc.id;
            }
          } catch (e) { console.warn("Name query failed:", e); }
        }

        if (!profileData.nationalId && !profileData.phone) {
          try {
            const cashSnap = await getDoc(doc(db, "cashiers", employeeId));
            if (cashSnap.exists()) {
              const cashData = cashSnap.data();
              profileData = { ...profileData, ...cashData };
              if (cashData.employeeId) {
                actualEmployeeId = cashData.employeeId;
                try {
                  const empSnap = await getDoc(doc(db, "employees", actualEmployeeId));
                  if (empSnap.exists()) profileData = { id: empSnap.id, ...empSnap.data() };
                } catch (e) { console.error("Employee fetch from cashier employeeId failed:", e); }
              }
            }
          } catch (e) { console.error("Cashier doc fetch failed:", e); }
        }

        setUserProfile(profileData);
        profileName = profileData.name || profileName;

        const fetchRecordsByStaff = async (collectionName: string) => {
          try {
            const queries = [];
            if (actualEmployeeId) queries.push(query(collection(db, collectionName), where("employeeId", "==", actualEmployeeId)));
            if (employeeId) queries.push(query(collection(db, collectionName), where("employeeId", "==", employeeId)));
            if (profileName) {
              queries.push(query(collection(db, collectionName), where("employeeName", "==", profileName)));
              queries.push(query(collection(db, collectionName), where("cashierName", "==", profileName)));
              queries.push(query(collection(db, collectionName), where("name", "==", profileName)));
            }
            const snaps = await Promise.all(queries.map(q => getDocs(q).catch(() => null)));
            const allDocs: any[] = [];
            snaps.forEach(snap => { if (snap) snap.docs.forEach(doc => { allDocs.push({ id: doc.id, ...doc.data() }); }); });
            return Array.from(new Map(allDocs.map(d => [d.id, d])).values());
          } catch (e) { console.error(`Error fetching from ${collectionName}:`, e); return []; }
        };

        // Execute all independent queries concurrently to prevent waterfall delays
        const [
          uniqueDeds, 
          uniqueAdjs, 
          uniquePays1, 
          uniquePays2, 
          shiftSnap, 
          voidSnap
        ] = await Promise.all([
          fetchRecordsByStaff("deductions"),
          fetchRecordsByStaff("adjustments"),
          fetchRecordsByStaff("payroll_lines"),
          fetchRecordsByStaff("payroll"),
          getDocs(query(collection(db, "shift_reports"), where("cashierDetails.name", "==", profileName))),
          getDocs(query(collection(db, "void_requests"), where("cashierName", "==", profileName)))
        ]);

        setDeductions(uniqueDeds);
        setAdjustments(uniqueAdjs);

        const mergedPays = [...uniquePays1, ...uniquePays2];
        let finalPays = Array.from(new Map(mergedPays.map(p => {
          const normalized = { id: p.id, month: p.month || p.date?.substring(0, 7) || new Date(p.createdAt || Date.now()).toISOString().substring(0, 7) || "N/A", days: p.days || p.daysWorked || 30, deductions: Number(p.deductions) || Number(p.totalDeductions) || 0, netPay: Number(p.netPay) || Number(p.netSalary) || Number(p.amount) || 0, status: p.status || "paid" };
          return [normalized.month, normalized];
        })).values());
        if (finalPays.length === 0) { finalPays = [{ id: "demo-payroll-1", month: new Date().toISOString().substring(0, 7), days: 30, deductions: 0, netPay: Number(profileData.baseSalary) || Number(profileData.salary) || 3000, status: "pending" }]; }
        setPayrollLines(finalPays.sort((a: any, b: any) => b.month.localeCompare(a.month)));

        const fetchedShifts = shiftSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        fetchedShifts.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        setShiftReports(fetchedShifts);

        const fetchedVoids = voidSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        fetchedVoids.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        setVoidRequests(fetchedVoids);

        setLoading(false); // Stop loading early while global shifts fetch in background

        // Fetch global shifts in background without blocking the UI
        try {
          const currentMonthPrefix = new Date().toISOString().substring(0, 7);
          const q = query(collection(db, "shift_reports"), where("createdAt", ">=", currentMonthPrefix), where("createdAt", "<=", currentMonthPrefix + "\uf8ff"));
          getDocs(q).then(globalShiftsSnap => {
            setAllShiftsGlobally(globalShiftsSnap.docs.map(d => d.data()));
          });
        } catch (e) { console.warn("Could not fetch global shifts for badges", e); }

      } catch (error) { 
        console.error("Error fetching staff data:", error); 
        setLoading(false);
      }
    };

    fetchStaffData();
  }, [router]);

  const root: React.CSSProperties = {
    backgroundColor: D.bg, color: D.textPrimary, minHeight: "100dvh",
    fontFamily: "'Inter', 'Cairo', -apple-system, system-ui, sans-serif",
    colorScheme: "dark",
  };

  if (loading) return (
    <div style={{ ...root, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#b91c1c,#ef4444)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 900, color: "#fff", boxShadow: "0 0 40px rgba(239,68,68,0.4)" }}>K</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[0,1,2].map(i => (<div key={i} style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: D.cyan, opacity: 0.7, animation: `bounce 1s ${i*0.15}s infinite` }} />))}
      </div>
    </div>
  );

  if (!userProfile) return (
    <div style={{ ...root, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <ShieldAlert size={48} color={D.red} style={{ margin: "0 auto 16px", display: "block" }} />
        <div style={{ fontSize: 18, fontWeight: 800, color: D.textPrimary, marginBottom: 16 }}>Profile Not Found</div>
        <button onClick={() => router.push("/cashier")} style={{ background: D.redDim, border: `1px solid ${D.redBorder}`, color: D.red, padding: "10px 20px", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Return to Dashboard</button>
      </div>
    </div>
  );

  const currentMonthPrefix = new Date().toISOString().substring(0, 7);
  const currentDeductions = deductions.filter(d => d.date?.startsWith(currentMonthPrefix));
  const currentAdjustments = adjustments.filter(a => a.date?.startsWith(currentMonthPrefix));
  const totalDeductions = currentDeductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalBonuses = currentAdjustments.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const baseSalary = Number(userProfile.baseSalary) || 0;
  const netPayEstimate = baseSalary + totalBonuses - totalDeductions;
  const hasPerfectRegister = shiftReports.length > 5 && shiftReports.slice(0, 5).every(s => s.status === 'approved' || s.status === 'completed');
  const hasStockMaster = userProfile.role === 1 || shiftReports.length > 0;
  let isTopSeller = false;
  if (allShiftsGlobally.length > 0) {
    const salesByCashier: Record<string, number> = {};
    allShiftsGlobally.forEach(s => { const name = s.cashierDetails?.name; const sales = Number(s.cashierCounts?.total) || 0; if (name) salesByCashier[name] = (salesByCashier[name] || 0) + sales; });
    const topCashierName = Object.keys(salesByCashier).reduce((a, b) => salesByCashier[a] > salesByCashier[b] ? a : b, "");
    if (topCashierName === userProfile.name && salesByCashier[topCashierName] > 0) isTopSeller = true;
  }
  const toggleReport = (id: string) => setExpandedReportId(expandedReportId === id ? null : id);

  const StatusBadge = ({ status }: { status: string }) => {
    const st = status?.toLowerCase() || "";
    if (st.includes("approved") || st === "paid" || st === "completed")
      return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: D.greenDim, color: D.green, border: `1px solid ${D.greenBorder}`, padding: "3px 8px", borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}><CheckCircle size={10} />{lang === "en" ? "Approved" : "مقبول"}</span>;
    if (st.includes("rejected") || st === "cancelled")
      return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: D.redDim, color: D.red, border: `1px solid ${D.redBorder}`, padding: "3px 8px", borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}><XCircle size={10} />{lang === "en" ? "Rejected" : "مرفوض"}</span>;
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: D.amberDim, color: D.amber, border: `1px solid ${D.amberBorder}`, padding: "3px 8px", borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}><Clock size={10} />{lang === "en" ? "Pending" : "معلق"}</span>;
  };

  const tabs = [
    { id: "financials", label: lang === "en" ? "Financials" : "الراتب", icon: Banknote },
    { id: "shifts", label: lang === "en" ? "Shifts" : "الورديات", icon: Clock, count: shiftReports.length },
    { id: "voids", label: lang === "en" ? "Voids" : "المرتجعات", icon: ShieldAlert, count: voidRequests.length },
    { id: "badges", label: lang === "en" ? "Badges" : "الأوسمة", icon: Award },
  ] as any[];

  return (
    <div style={{ ...root, direction: lang === "ar" ? "rtl" : "ltr" }}>
      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .acc-card { transition: border-color 0.15s; }
        .acc-card:hover { border-color: rgba(34,211,238,0.25) !important; }
        .acc-tab { transition: all 0.15s; cursor: pointer; border: none; }
        .acc-btn { transition: opacity 0.15s; cursor: pointer; border: none; }
        .acc-btn:hover { opacity: 0.8; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: D.bg, borderBottom: `1px solid ${D.border}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", backdropFilter: "blur(12px)" }}>
        <button className="acc-btn" onClick={() => router.push("/cashier")} style={{ width: 34, height: 34, borderRadius: 10, background: D.surfaceHigh, border: `1px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={16} color={D.textSecondary} />
        </button>
        <div style={{ fontSize: 15, fontWeight: 800, color: D.textPrimary, letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 8 }}>
          <UserCircle size={18} color={D.cyan} />
          {lang === "en" ? "MY ACCOUNT" : "حسابي"}
        </div>
        <button className="acc-btn" onClick={() => setLang(lang === "en" ? "ar" : "en")} style={{ height: 34, padding: "0 12px", borderRadius: 10, background: D.surfaceHigh, border: `1px solid ${D.border}`, display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: D.textSecondary }}>
          <Globe size={13} color={D.cyan} />
          {lang === "en" ? "عربي" : "EN"}
        </button>
      </div>

      {/* ── PROFILE HERO ── */}
      <div style={{ background: `linear-gradient(135deg, #151E32 0%, #0f1929 100%)`, borderBottom: `1px solid ${D.border}`, padding: "24px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #b91c1c, #ef4444)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 900, color: "#fff", flexShrink: 0, boxShadow: "0 0 30px rgba(239,68,68,0.35), 0 0 0 3px rgba(239,68,68,0.15)" }}>
            {userProfile.name?.charAt(0) || "U"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: D.textPrimary }}>{userProfile.name}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <span style={{ background: D.blueDim, color: D.blue, border: `1px solid ${D.blueBorder}`, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {userProfile.position || userProfile.role || "Staff"}
              </span>
              <span style={{ background: D.surfaceHigh, color: D.textSecondary, border: `1px solid ${D.border}`, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                {lang === "en" ? "Store:" : "فرع:"} {userProfile.storeId || "N/A"}
              </span>
              {userProfile.fulltime && (
                <span style={{ background: D.greenDim, color: D.green, border: `1px solid ${D.greenBorder}`, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  <ShieldCheck size={10} /> Full-Time
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: D.textDim, fontWeight: 600, fontFamily: "monospace", marginTop: 8 }}>
              ID: {userProfile.id} {userProfile.nationalId ? `· NID: ${userProfile.nationalId}` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${D.border}`, backgroundColor: D.bg, overflowX: "auto", position: "sticky", top: 63, zIndex: 40 }}>
        {tabs.map((tab: any) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} className="acc-tab" onClick={() => setActiveTab(tab.id as any)} style={{ flex: 1, padding: "14px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", fontSize: 9, fontWeight: 800, color: isActive ? D.cyan : D.textDim, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `2px solid ${isActive ? D.cyan : "transparent"}`, whiteSpace: "nowrap", minWidth: 70 }}>
              <Icon size={16} color={isActive ? D.cyan : D.textDim} />
              <span>{tab.label}</span>
              {tab.count > 0 && <span style={{ background: isActive ? D.cyanDim : D.surfaceHigh, color: isActive ? D.cyan : D.textDim, border: `1px solid ${isActive ? D.cyanBorder : D.border}`, padding: "0px 5px", borderRadius: 10, fontSize: 8, fontWeight: 800 }}>{tab.count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 100px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ─── FINANCIALS ─── */}
        {activeTab === "financials" && (
          <>
            {/* Employment Details */}
            <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 20, padding: "20px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                <UserCircle size={12} color={D.cyan} /> {lang === "en" ? "Employment Details" : "بيانات التوظيف"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {[
                  { label: lang === "en" ? "Full Name" : "الاسم بالكامل", value: userProfile.name },
                  { label: lang === "en" ? "Employee ID" : "رقم الموظف", value: userProfile.id, mono: true },
                  { label: lang === "en" ? "Assigned Store" : "الفرع المعين", value: userProfile.storeId || "N/A" },
                  { label: lang === "en" ? "Role Position" : "المسمى الوظيفي", value: userProfile.position || userProfile.role || "Cashier" },
                  { label: lang === "en" ? "Phone Number" : "رقم الهاتف", value: userProfile.phone || userProfile.mobile || "N/A" },
                  { label: lang === "en" ? "National ID" : "الرقم القومي", value: userProfile.nationalId || "N/A", mono: true },
                  { label: lang === "en" ? "Base Salary Plan" : "الراتب الأساسي الشهري", value: `EGP ${baseSalary.toLocaleString()} / ${lang === "en" ? "month" : "شهر"}`, accent: D.green },
                ].map((row, i, arr) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${D.border}` : "none" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: D.textSecondary }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: row.accent || D.textPrimary, fontFamily: row.mono ? "monospace" : "inherit" }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Overview */}
            <div style={{ fontSize: 10, fontWeight: 800, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.15em" }}>
              {lang === "en" ? "Current Month Estimation" : "تقديرات الشهر الحالي"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {[
                { label: lang === "en" ? "Base Salary" : "الراتب الأساسي", value: `EGP ${baseSalary.toLocaleString()}`, icon: Banknote, color: D.textPrimary, dim: D.surfaceHigh, border: D.border },
                { label: lang === "en" ? "Bonuses" : "المكافآت", value: `+EGP ${totalBonuses.toLocaleString()}`, icon: TrendingUp, color: D.green, dim: D.greenDim, border: D.greenBorder },
                { label: lang === "en" ? "Deductions" : "الخصومات", value: `-EGP ${totalDeductions.toLocaleString()}`, icon: TrendingDown, color: D.red, dim: D.redDim, border: D.redBorder },
                { label: lang === "en" ? "Est. Net Pay" : "صافي الراتب", value: `EGP ${netPayEstimate.toLocaleString()}`, icon: Banknote, color: D.cyan, dim: D.cyanDim, border: D.cyanBorder, big: true },
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div key={i} style={{ background: card.dim, border: `1px solid ${card.border}`, borderRadius: 16, padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <Icon size={14} color={card.color} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: card.color, textTransform: "uppercase", letterSpacing: "0.1em" }}>{card.label}</span>
                    </div>
                    <div style={{ fontSize: card.big ? 20 : 16, fontWeight: 900, color: card.color, fontVariantNumeric: "tabular-nums" }}>{card.value}</div>
                  </div>
                );
              })}
            </div>

            {/* Deductions & Adjustments */}
            {[
              { title: lang === "en" ? "Deductions" : "الخصومات", items: currentDeductions, color: D.red, dim: D.redDim, border: D.redBorder, sign: "-", icon: TrendingDown, emptyMsg: lang === "en" ? "No deductions this month. Great job!" : "لا توجد خصومات هذا الشهر." },
              { title: lang === "en" ? "Bonuses & Adjustments" : "المكافآت والإضافات", items: currentAdjustments, color: D.green, dim: D.greenDim, border: D.greenBorder, sign: "+", icon: TrendingUp, emptyMsg: lang === "en" ? "No adjustments this month." : "لا توجد مكافآت هذا الشهر." },
            ].map((section, si) => {
              const Icon = section.icon;
              return (
                <div key={si}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.15em", display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Icon size={12} color={section.color} /> {section.title}
                  </div>
                  <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, overflow: "hidden" }}>
                    {section.items.length === 0 ? (
                      <div style={{ padding: "24px", textAlign: "center", fontSize: 13, fontWeight: 600, color: D.textDim }}>{section.emptyMsg}</div>
                    ) : (
                      section.items.map((d: any, idx: number) => (
                        <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: idx < section.items.length - 1 ? `1px solid ${D.border}` : "none" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary }}>{d.reason || d.notes || "Entry"}</div>
                            <div style={{ fontSize: 10, color: D.textDim, fontWeight: 600, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}><Calendar size={10} /> {d.date}</div>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 900, color: section.color, fontVariantNumeric: "tabular-nums" }}>{section.sign}EGP {d.amount}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}

            {/* Payroll History */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.15em", display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <FileText size={12} color={D.cyan} /> {lang === "en" ? "Payroll History" : "سجل الرواتب"}
              </div>
              <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, overflow: "hidden" }}>
                {payrollLines.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", fontSize: 13, fontWeight: 600, color: D.textDim }}>{lang === "en" ? "No historical payroll records found." : "لا توجد سجلات رواتب سابقة."}</div>
                ) : (
                  payrollLines.sort((a, b) => b.month.localeCompare(a.month)).map((p: any, idx: number) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: idx < payrollLines.length - 1 ? `1px solid ${D.border}` : "none" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: D.surfaceHigh, border: `1px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Clock size={16} color={D.textDim} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: D.textPrimary }}>{p.month}</div>
                          <div style={{ fontSize: 10, color: D.textDim, fontWeight: 600, marginTop: 2 }}>{p.days} {lang === "en" ? "days worked" : "أيام عمل"}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: D.red, fontWeight: 700 }}>-EGP {p.deductions}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: D.green, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>EGP {p.netPay}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* ─── SHIFT REPORTS ─── */}
        {activeTab === "shifts" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.15em" }}>
              {lang === "en" ? "Recent Shift Submissions" : "تقارير الورديات المرسلة مؤخراً"}
            </div>
            {shiftReports.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", background: D.surface, borderRadius: 20, border: `2px dashed ${D.border}` }}>
                <Clock size={36} color={D.textDim} style={{ margin: "0 auto 12px", display: "block" }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: D.textDim }}>{lang === "en" ? "No shift reports submitted yet." : "لم يتم إرسال أي تقارير."}</div>
              </div>
            )}
            {shiftReports.map(report => {
              const isExpanded = expandedReportId === report.id;
              const totalDrops = Number(report.cashierCounts?.total || report.cashierCounts?.cash || 0);
              const visaDrops = Number(report.cashierCounts?.visa || 0);
              const cashDrops = Number(report.cashierCounts?.cash || 0);
              return (
                <div key={report.id} className="acc-card" style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 20, overflow: "hidden" }}>
                  <div style={{ display: "flex" }}>
                    <div style={{ width: 4, flexShrink: 0, background: `linear-gradient(to bottom, ${D.blue}, ${D.cyan})` }} />
                    <div style={{ flex: 1 }}>
                      <div onClick={() => toggleReport(report.id)} style={{ padding: "16px 16px 16px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: D.blueDim, border: `1px solid ${D.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Clock size={18} color={D.blue} />
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary }}>
                              {report.cashierDetails?.date} — {lang === "en" ? report.cashierDetails?.shift : (report.cashierDetails?.shift === "Morning" ? "صباحي" : report.cashierDetails?.shift === "Noon" ? "مسائي" : "ليلي")}
                            </div>
                            <div style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600, marginTop: 3 }}>
                              {lang === "en" ? "Role:" : "نوع:"} {report.cashierRole === 1 ? (lang === "en" ? "Register & Stock" : "نقدية ومخزون") : (lang === "en" ? "Money Only" : "نقدية فقط")}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <StatusBadge status={report.status} />
                          {isExpanded ? <ChevronUp size={16} color={D.textDim} /> : <ChevronDown size={16} color={D.textDim} />}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: `1px solid ${D.border}` }}>
                        {[
                          { label: "Cash", value: `EGP ${cashDrops.toFixed(0)}` },
                          { label: "Visa", value: `EGP ${visaDrops.toFixed(0)}` },
                          { label: "Total", value: `EGP ${totalDrops.toFixed(0)}`, color: D.cyan },
                        ].map((stat, i) => (
                          <div key={i} onClick={() => toggleReport(report.id)} style={{ padding: "10px", textAlign: "center", borderRight: i < 2 ? `1px solid ${D.border}` : "none", cursor: "pointer" }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: D.textDim, textTransform: "uppercase" }}>{stat.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 900, color: stat.color || D.textPrimary, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{stat.value}</div>
                          </div>
                        ))}
                      </div>

                      {isExpanded && (
                        <div style={{ padding: "16px", borderTop: `1px solid ${D.border}`, background: D.surfaceHigh, display: "flex", flexDirection: "column", gap: 12 }}>
                          {report.status === "rejected" && report.managerAudit?.rejectReason && (
                            <div style={{ background: D.redDim, border: `1px solid ${D.redBorder}`, borderRadius: 12, padding: "14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: D.red, marginBottom: 6 }}>
                                <AlertTriangle size={14} /> {lang === "en" ? "Rejection Reason:" : "سبب الرفض:"}
                              </div>
                              <div style={{ fontSize: 12, color: "#fca5a5", fontStyle: "italic" }}>"{report.managerAudit.rejectReason}"</div>
                              <button onClick={() => router.push('/shift-reports/cashier')} style={{ marginTop: 12, background: D.red, color: "#fff", padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer", border: "none", display: "block", width: "100%" }}>
                                {lang === "en" ? "Resubmit Corrected Numbers" : "إعادة الإرسال مع التصحيح"}
                              </button>
                            </div>
                          )}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            {[
                              { label: lang === "en" ? "Cash Inside Drop" : "النقد المسلم", value: `EGP ${cashDrops.toFixed(2)}` },
                              { label: lang === "en" ? "Visa Slips" : "إيصالات الفيزا", value: `EGP ${visaDrops.toFixed(2)}` },
                            ].map((r, i) => (
                              <div key={i} style={{ background: D.surface, borderRadius: 12, padding: "10px 14px", border: `1px solid ${D.border}` }}>
                                <div style={{ fontSize: 9, color: D.textDim, fontWeight: 700, textTransform: "uppercase" }}>{r.label}</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{r.value}</div>
                              </div>
                            ))}
                          </div>
                          {report.cashierRole === 1 && report.inventoryCounts && (
                            <div style={{ background: D.surface, borderRadius: 12, padding: "14px", border: `1px solid ${D.border}` }}>
                              <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                                <Eye size={12} /> {lang === "en" ? "Stock Inventory" : "جرد المخزون"}
                              </div>
                              {[{ label: lang === "en" ? "Cigarettes" : "السجائر", data: report.inventoryCounts.cigarettes }, { label: lang === "en" ? "Lighters" : "الولاعات", data: report.inventoryCounts.lighters }].filter(x => x.data).map((inv, ii) => (
                                <div key={ii} style={{ marginBottom: ii === 0 ? 10 : 0 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: D.textSecondary, marginBottom: 6 }}>{inv.label}</div>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                                    {[{ lbl: "Start", val: inv.data.start }, { lbl: "Deliv", val: inv.data.delivery }, { lbl: "End", val: inv.data.end }, { lbl: "Sold", val: inv.data.sold }].map((c, ci) => (
                                      <div key={ci} style={{ background: D.surfaceHigh, borderRadius: 8, padding: "6px", textAlign: "center" }}>
                                        <div style={{ fontSize: 8, color: D.textDim, fontWeight: 700, textTransform: "uppercase" }}>{c.lbl}</div>
                                        <div style={{ fontSize: 14, fontWeight: 900, color: ci === 3 ? D.cyan : D.textPrimary, marginTop: 2 }}>{c.val}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {report.cashierSignature && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: D.surface, borderRadius: 12, border: `1px solid ${D.border}` }}>
                              <div>
                                <div style={{ fontSize: 9, color: D.textDim, fontWeight: 700, textTransform: "uppercase" }}>{lang === "en" ? "Cashier Signature" : "توقيع الكاشير"}</div>
                                <div style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600, marginTop: 2 }}>{report.createdAt ? new Date(report.createdAt).toLocaleString() : ""}</div>
                              </div>
                              <div style={{ background: "#fff", borderRadius: 8, padding: "4px", border: `1px solid ${D.border}` }}>
                                <img src={report.cashierSignature} alt="Signature" style={{ height: 50, objectFit: "contain" }} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ─── VOIDS ─── */}
        {activeTab === "voids" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.15em" }}>
              {lang === "en" ? "Logged Void & Return Requests" : "طلبات المرتجعات والإلغاءات"}
            </div>
            {voidRequests.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", background: D.surface, borderRadius: 20, border: `2px dashed ${D.border}` }}>
                <ShieldAlert size={36} color={D.textDim} style={{ margin: "0 auto 12px", display: "block" }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: D.textDim }}>{lang === "en" ? "No void or return requests found." : "لم يتم تسجيل أي طلبات مرتجع."}</div>
              </div>
            )}
            {voidRequests.map(v => (
              <div key={v.id} className="acc-card" style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 20, overflow: "hidden" }}>
                <div style={{ display: "flex" }}>
                  <div style={{ width: 4, flexShrink: 0, background: `linear-gradient(to bottom, ${D.red}, #f97316)` }} />
                  <div style={{ flex: 1, padding: "16px 16px 16px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: D.redDim, border: `1px solid ${D.redBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <ShieldAlert size={18} color={D.red} />
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary }}>
                            {lang === "en" ? "Transaction:" : "معاملة:"} <span style={{ color: D.blue, fontFamily: "monospace" }}>{v.transactionNumber}</span>
                          </div>
                          <div style={{ fontSize: 10, color: D.textDim, fontWeight: 600, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                            <Calendar size={10} /> {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : "N/A"}
                            <span style={{ background: D.surfaceHigh, border: `1px solid ${D.border}`, padding: "1px 6px", borderRadius: 4, fontSize: 9 }}>{v.register || "Register"}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: D.red, fontVariantNumeric: "tabular-nums" }}>-EGP {Number(v.amount || 0).toFixed(2)}</div>
                        <div style={{ marginTop: 4 }}><StatusBadge status={v.status} /></div>
                      </div>
                    </div>
                    <div style={{ background: D.surfaceHigh, borderRadius: 12, padding: "12px 14px", border: `1px solid ${D.border}` }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{lang === "en" ? "Reason" : "السبب"}</div>
                      <div style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, fontStyle: "italic" }}>"{v.reason}"</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${D.border}` }}>
                        <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <User size={12} color={D.textDim} /> {lang === "en" ? "Customer:" : "الزبون:"} <strong style={{ color: D.textPrimary }}>{v.customerName}</strong>
                        </div>
                        <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <Phone size={12} color={D.textDim} /> <span style={{ fontFamily: "monospace", color: D.textPrimary }}>{v.customerPhone}</span>
                        </div>
                      </div>
                    </div>
                    {v.cashierSignature && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 9, color: D.textDim, fontWeight: 700, textTransform: "uppercase" }}>{lang === "en" ? "Cashier Signature" : "توقيع الكاشير"}</div>
                        <div style={{ background: "#fff", borderRadius: 8, padding: "4px", border: `1px solid ${D.border}` }}>
                          <img src={v.cashierSignature} alt="Signature" style={{ height: 42, objectFit: "contain", maxWidth: 130 }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ─── BADGES ─── */}
        {activeTab === "badges" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.15em" }}>
              {lang === "en" ? "Performance Badges" : "أوسمة الأداء"}
            </div>
            {[
              { label: "Perfect Register", description: "Awarded for maintaining 0 shortages across 5 consecutive shifts.", icon: CheckCircle, earned: hasPerfectRegister, color: D.green, dim: D.greenDim, border: D.greenBorder },
              { label: "Top Performer", description: "Awarded for holding the highest sales volume this month globally.", icon: Award, earned: isTopSeller, color: D.amber, dim: D.amberDim, border: D.amberBorder },
              { label: "Stock Master", description: "Awarded for consistently accurate inventory counts without discrepancies.", icon: Package, earned: hasStockMaster, color: D.blue, dim: D.blueDim, border: D.blueBorder },
            ].map((badge, i) => {
              const Icon = badge.icon;
              return (
                <div key={i} style={{ background: badge.earned ? badge.dim : D.surface, border: `1px solid ${badge.earned ? badge.border : D.border}`, borderRadius: 20, padding: "20px", display: "flex", gap: 16, alignItems: "center", opacity: badge.earned ? 1 : 0.5, transition: "all 0.2s" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 18, background: badge.earned ? badge.dim : D.surfaceHigh, border: `2px solid ${badge.earned ? badge.border : D.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: badge.earned ? `0 0 20px ${badge.dim}` : "none" }}>
                    <Icon size={28} color={badge.earned ? badge.color : D.textDim} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: badge.earned ? badge.color : D.textDim }}>{badge.label}</div>
                    <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600, marginTop: 4, lineHeight: 1.5 }}>{badge.description}</div>
                    {badge.earned && (
                      <div style={{ marginTop: 8, fontSize: 10, fontWeight: 800, color: badge.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>✓ EARNED</div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      <CashierBottomNav lang={lang} />
    </div>
  );
}
