"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, UserCircle, Banknote, Calendar, ShieldAlert, 
  TrendingUp, TrendingDown, Clock, ShieldCheck, FileText, Globe,
  CheckCircle, XCircle, AlertTriangle, Eye, ChevronDown, ChevronUp, User, Phone, Tag
} from "lucide-react";

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
  
  const [activeTab, setActiveTab] = useState<"financials" | "shifts" | "voids">("financials");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  useEffect(() => {
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (!savedUserStr) {
      router.push("/cashier");
      return;
    }

    const sessionData = JSON.parse(savedUserStr);
    const employeeId = sessionData.id;

    const fetchStaffData = async () => {
      try {
        let profileName = sessionData.name;
        let profileData = { id: employeeId, name: profileName, ...sessionData };
        
        // 1. Fetch exact employee profile
        const empRef = doc(db, "employees", employeeId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          profileData = { id: empSnap.id, ...empSnap.data() };
        } else {
          const cashRef = doc(db, "cashiers", employeeId);
          const cashSnap = await getDoc(cashRef);
          if (cashSnap.exists()) {
            profileData = { id: cashSnap.id, ...cashSnap.data() };
          }
        }
        setUserProfile(profileData);
        profileName = profileData.name || profileName; // Crucial: use the exact name to link to payrolls

        // Helper to query records by employeeId or employeeName or cashierName or name
        const fetchRecordsByStaff = async (collectionName: string) => {
          try {
            const queries = [
              query(collection(db, collectionName), where("employeeId", "==", employeeId)),
              query(collection(db, collectionName), where("employeeName", "==", profileName)),
              query(collection(db, collectionName), where("cashierName", "==", profileName)),
              query(collection(db, collectionName), where("name", "==", profileName))
            ];
            const snaps = await Promise.all(queries.map(q => getDocs(q).catch(() => null)));
            const allDocs: any[] = [];
            snaps.forEach(snap => {
              if (snap) {
                snap.docs.forEach(doc => {
                  allDocs.push({ id: doc.id, ...doc.data() });
                });
              }
            });
            // Deduplicate by doc ID
            return Array.from(new Map(allDocs.map(d => [d.id, d])).values());
          } catch (e) {
            console.error(`Error fetching from ${collectionName}:`, e);
            return [];
          }
        };

        // 2. Fetch Deductions
        const uniqueDeds = await fetchRecordsByStaff("deductions");
        setDeductions(uniqueDeds);

        // 3. Fetch Adjustments
        const uniqueAdjs = await fetchRecordsByStaff("adjustments");
        setAdjustments(uniqueAdjs);

        // 4. Fetch Payroll History from both collections
        const uniquePays1 = await fetchRecordsByStaff("payroll_lines");
        const uniquePays2 = await fetchRecordsByStaff("payroll");
        
        const mergedPays = [...uniquePays1, ...uniquePays2];
        const normalizedPays = Array.from(new Map(mergedPays.map(p => {
          const normalized = {
            id: p.id,
            month: p.month || p.date?.substring(0, 7) || new Date(p.createdAt || Date.now()).toISOString().substring(0, 7) || "N/A",
            days: p.days || p.daysWorked || 30,
            deductions: Number(p.deductions) || Number(p.totalDeductions) || 0,
            netPay: Number(p.netPay) || Number(p.netSalary) || Number(p.amount) || 0,
            status: p.status || "paid"
          };
          return [normalized.month, normalized];
        })).values());
        
        setPayrollLines(normalizedPays);

        // 5. Fetch Shift Reports
        const shiftSnap = await getDocs(
          query(collection(db, "shift_reports"), where("cashierDetails.name", "==", profileName))
        );
        const fetchedShifts = shiftSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort shift reports in memory
        fetchedShifts.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        setShiftReports(fetchedShifts);

        // 6. Fetch Void Requests
        const voidSnap = await getDocs(
          query(collection(db, "void_requests"), where("cashierName", "==", profileName))
        );
        const fetchedVoids = voidSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort voids in memory
        fetchedVoids.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        setVoidRequests(fetchedVoids);

      } catch (error) {
        console.error("Error fetching staff data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStaffData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-600"></div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="h-screen flex items-center justify-center p-4 text-center">
        <div>
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Profile Not Found</h2>
          <button onClick={() => router.push("/cashier")} className="mt-4 text-red-600 dark:text-red-400 font-bold underline">Return to Dashboard</button>
        </div>
      </div>
    );
  }

  // Calculate current month's totals
  const currentMonthPrefix = new Date().toISOString().substring(0, 7); // e.g., "2026-06"
  
  const currentDeductions = deductions.filter(d => d.date?.startsWith(currentMonthPrefix));
  const currentAdjustments = adjustments.filter(a => a.date?.startsWith(currentMonthPrefix));
  
  const totalDeductions = currentDeductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalBonuses = currentAdjustments.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  
  const baseSalary = Number(userProfile.baseSalary) || 0;
  const netPayEstimate = baseSalary + totalBonuses - totalDeductions;

  // Toggle report expansion
  const toggleReport = (id: string) => {
    setExpandedReportId(expandedReportId === id ? null : id);
  };

  const getStatusBadge = (status: string) => {
    const st = status?.toLowerCase() || "";
    if (st.includes("approved") || st === "paid" || st === "completed") {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
          <CheckCircle className="h-3 w-3" /> {lang === "en" ? "Approved" : "مقبول"}
        </span>
      );
    } else if (st.includes("rejected") || st === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-900/30 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
          <XCircle className="h-3 w-3" /> {lang === "en" ? "Rejected" : "مرفوض"}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-450 border border-amber-200/50 dark:border-amber-900/30 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
          <Clock className="h-3 w-3" /> {lang === "en" ? "Pending" : "معلق"}
        </span>
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 pb-20 transition-colors duration-300" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => router.push("/cashier")}
            className="flex items-center gap-1 text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
          >
            <ArrowLeft className={`h-5 w-5 ${lang === "ar" ? "rotate-180" : ""}`} />
            <span className="font-bold text-sm">{lang === "en" ? "Back" : "رجوع"}</span>
          </button>
          
          <h1 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-red-500" />
            {lang === "en" ? "My Account" : "حسابي"}
          </h1>
          
          <button 
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-1.5 rounded-full text-xs font-bold transition-colors text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-slate-600/40 cursor-pointer"
          >
            <Globe className="h-4 w-4" /> {lang === "en" ? "عربي" : "EN"}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Profile Identity Card */}
        <div className="bg-white/70 dark:bg-slate-800/40 backdrop-blur-md rounded-3xl p-6 border border-slate-200/60 dark:border-slate-700/40 shadow-xl shadow-slate-200/10 dark:shadow-none flex flex-col sm:flex-row items-center gap-6 animate-in fade-in duration-300">
          <div className="h-20 w-20 sm:h-24 sm:w-24 bg-gradient-to-br from-red-600 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 flex-shrink-0">
            <span className="text-white font-black text-3xl sm:text-4xl">
              {userProfile.name?.charAt(0) || "U"}
            </span>
          </div>
          <div className="text-center sm:text-left flex-1">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{userProfile.name}</h2>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
              <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                {userProfile.position || userProfile.role || "Staff"}
              </span>
              <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold">
                {lang === "en" ? "Store:" : "فرع:"} {userProfile.storeId || "N/A"}
              </span>
              {userProfile.fulltime && (
                <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Full-Time
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-mono font-semibold">
              ID: {userProfile.id} {userProfile.nationalId ? `| NID: ${userProfile.nationalId}` : ""}
            </p>
          </div>
        </div>

        {/* Tab Buttons Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 sm:gap-2">
          <button 
            onClick={() => setActiveTab("financials")}
            className={`py-3 px-3 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "financials" 
                ? "border-red-500 text-red-600 dark:text-red-400 font-black" 
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <Banknote className="h-4 w-4" />
            {lang === "en" ? "Financials" : "الراتب والماليات"}
          </button>
          
          <button 
            onClick={() => setActiveTab("shifts")}
            className={`py-3 px-3 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "shifts" 
                ? "border-red-500 text-red-600 dark:text-red-400 font-black" 
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <Clock className="h-4 w-4" />
            {lang === "en" ? "Shift Reports" : "تقارير الوردية"}
            {shiftReports.length > 0 && (
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] px-1.5 py-0.5 rounded-full font-black">
                {shiftReports.length}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab("voids")}
            className={`py-3 px-3 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "voids" 
                ? "border-red-500 text-red-600 dark:text-red-400 font-black" 
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            {lang === "en" ? "Voids / Returns" : "المرتجعات الملغاة"}
            {voidRequests.length > 0 && (
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] px-1.5 py-0.5 rounded-full font-black">
                {voidRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* --- TAB CONTENT: FINANCIALS --- */}
        {activeTab === "financials" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Detailed Personal & Employment Details */}
            <div className="bg-white/70 dark:bg-slate-800/40 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-slate-200/60 dark:border-slate-700/40 shadow-sm space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-red-500" />
                {lang === "en" ? "Employment Details" : "بيانات التوظيف"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">{lang === "en" ? "Full Name" : "الاسم بالكامل"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{userProfile.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">{lang === "en" ? "Employee ID" : "رقم الموظف"}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{userProfile.id}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">{lang === "en" ? "Assigned Store" : "الفرع المعين"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{userProfile.storeId || "N/A"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">{lang === "en" ? "Role Position" : "المسمى الوظيفي"}</span>
                  <span className="font-bold text-slate-900 dark:text-white capitalize">{userProfile.position || userProfile.role || "Cashier"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">{lang === "en" ? "Phone Number" : "رقم الهاتف"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{userProfile.phone || userProfile.mobile || "N/A"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">{lang === "en" ? "National ID" : "الرقم القومي"}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{userProfile.nationalId || "N/A"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2 sm:col-span-2">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">{lang === "en" ? "Base Salary Plan" : "الراتب الأساسي الشهري"}</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">EGP {baseSalary.toLocaleString()} / {lang === "en" ? "month" : "شهر"}</span>
                </div>
              </div>
            </div>

            {/* Current Month Financial Overview */}
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {lang === "en" ? "Current Month Estimation" : "تقديرات الراتب للشهر الحالي"}
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/70 dark:bg-slate-800/40 backdrop-blur-md p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/40 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Banknote className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{lang === "en" ? "Base Salary" : "الراتب الأساسي"}</span>
                  </div>
                  <p className="text-xl font-black text-slate-900 dark:text-white">EGP {baseSalary.toLocaleString()}</p>
                </div>
                
                <div className="bg-white/70 dark:bg-slate-800/40 backdrop-blur-md p-5 rounded-2xl border border-emerald-200/30 dark:border-emerald-950/30 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-650 dark:text-emerald-450 mb-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{lang === "en" ? "Bonuses" : "المكافآت"}</span>
                  </div>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">+EGP {totalBonuses.toLocaleString()}</p>
                </div>
                
                <div className="bg-white/70 dark:bg-slate-800/40 backdrop-blur-md p-5 rounded-2xl border border-red-200/30 dark:border-red-950/30 shadow-sm">
                  <div className="flex items-center gap-2 text-red-650 dark:text-red-400 mb-2">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{lang === "en" ? "Deductions" : "الخصومات"}</span>
                  </div>
                  <p className="text-xl font-black text-red-600 dark:text-red-400">-EGP {totalDeductions.toLocaleString()}</p>
                </div>
                
                <div className="bg-gradient-to-br from-red-600 to-orange-500 p-5 rounded-2xl shadow-xl text-white border border-red-500/20">
                  <div className="flex items-center gap-2 text-red-100/90 mb-2">
                    <Banknote className="h-4 w-4 text-amber-300" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{lang === "en" ? "Est. Net Pay" : "صافي الراتب المتوقع"}</span>
                  </div>
                  <p className="text-2xl font-black">EGP {netPayEstimate.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Detailed Logs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Deductions Column */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  {lang === "en" ? "Recent Deductions" : "الخصومات الأخيرة"}
                </h3>
                
                <div className="bg-white/70 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden shadow-sm">
                  {currentDeductions.length === 0 ? (
                    <div className="p-8 text-center text-sm font-bold text-slate-400 dark:text-slate-500">
                      {lang === "en" ? "No deductions this month. Great job!" : "لا توجد خصومات هذا الشهر. عمل ممتاز!"}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {currentDeductions.map(d => (
                        <div key={d.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm">{d.reason || "Shortage"}</p>
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-1 font-semibold">
                              <Calendar className="h-3 w-3" /> {d.date}
                            </p>
                          </div>
                          <div className="font-black text-red-600 dark:text-red-400">
                            -EGP {d.amount}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Adjustments Column */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  {lang === "en" ? "Recent Adjustments" : "المكافآت والإضافات الأخيرة"}
                </h3>
                
                <div className="bg-white/70 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden shadow-sm">
                  {currentAdjustments.length === 0 ? (
                    <div className="p-8 text-center text-sm font-bold text-slate-400 dark:text-slate-500">
                      {lang === "en" ? "No adjustments this month." : "لا توجد مكافآت هذا الشهر."}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {currentAdjustments.map(a => (
                        <div key={a.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm">
                              {a.notes || "Bonus"}
                              {a.type === "overtime" && <span className="ml-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase">OT</span>}
                            </p>
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-1 font-semibold">
                              <Calendar className="h-3 w-3" /> {a.date}
                            </p>
                          </div>
                          <div className="font-black text-emerald-600 dark:text-emerald-400">
                            +EGP {a.amount}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
            </div>

            {/* Historical Payroll History */}
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {lang === "en" ? "Payroll History" : "سجل الرواتب السابقة"}
              </h3>
              
              <div className="bg-white/70 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden shadow-sm">
                {payrollLines.length === 0 ? (
                  <div className="p-8 text-center text-sm font-bold text-slate-400 dark:text-slate-500">
                    {lang === "en" ? "No historical payroll records found." : "لا توجد سجلات رواتب سابقة مسجلة."}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payrollLines.sort((a,b) => b.month.localeCompare(a.month)).map(p => (
                      <div key={p.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-slate-105 dark:bg-slate-900 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-800">
                            <Clock className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                          </div>
                          <div>
                            <p className="font-black text-slate-900 dark:text-white text-base">
                              {lang === "en" ? "Month:" : "شهر:"} {p.month}
                            </p>
                            <p className="text-xs text-slate-400 font-bold mt-1">
                              {p.days} {lang === "en" ? "Days Worked" : "أيام العمل"}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6 sm:gap-8 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-3 sm:pt-0">
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Total Deductions</p>
                            <p className="text-sm font-bold text-red-500">-EGP {p.deductions}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Net Pay Distributed</p>
                            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">EGP {p.netPay}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB CONTENT: SHIFT REPORTS --- */}
        {activeTab === "shifts" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {lang === "en" ? "Recent Shift Submissions" : "تقارير الورديات المرسلة مؤخراً"}
            </h3>

            <div className="space-y-4">
              {shiftReports.map(report => {
                const isExpanded = expandedReportId === report.id;
                const totalDrops = Number(report.cashierCounts?.total || report.cashierCounts?.cash || 0);
                const visaDrops = Number(report.cashierCounts?.visa || 0);
                const cashDrops = Number(report.cashierCounts?.cash || 0);
                
                return (
                  <div key={report.id} className="bg-white/70 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden shadow-sm">
                    {/* Summary Header */}
                    <div 
                      onClick={() => toggleReport(report.id)}
                      className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Clock className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-white text-sm sm:text-base">
                            {report.cashierDetails?.date} - {lang === "en" ? report.cashierDetails?.shift : (report.cashierDetails?.shift === "Morning" ? "صباحي" : report.cashierDetails?.shift === "Noon" ? "مسائي" : "ليلي")}
                          </p>
                          <p className="text-xs text-slate-400 mt-1 font-semibold">
                            {lang === "en" ? "Role:" : "نوع الكاشير:"} <span className="font-bold text-slate-700 dark:text-slate-300">{report.cashierRole === 1 ? (lang === "en" ? "Register & Stock" : "نقدية ومخزون") : (lang === "en" ? "Money Only" : "نقدية فقط")}</span>
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 sm:gap-6">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Total Drops</p>
                          <p className="text-sm font-black font-mono text-slate-800 dark:text-white">EGP {totalDrops.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(report.status)}
                          {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Dropdown content */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 dark:border-slate-800 p-5 bg-slate-50/40 dark:bg-slate-900/20 space-y-5 animate-in slide-in-from-top-2 duration-250">
                        {/* Manager audit notes if rejected */}
                        {report.status === "rejected" && report.managerAudit?.rejectReason && (
                          <div className="bg-red-50 dark:bg-red-950/15 border border-red-200 dark:border-red-900/50 p-4 rounded-xl text-xs sm:text-sm">
                            <p className="text-red-700 dark:text-red-400 font-bold flex items-center gap-1.5">
                              <AlertTriangle className="h-4 w-4 animate-pulse" />
                              {lang === "en" ? "Manager's rejection reason:" : "سبب رفض المدير للتقرير:"}
                            </p>
                            <p className="text-red-600 dark:text-red-300 font-semibold mt-1 italic">"{report.managerAudit.rejectReason}"</p>
                            <button 
                              onClick={() => router.push('/shift-reports/cashier')}
                              className="mt-3.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-red-500/10 transition-all cursor-pointer block"
                            >
                              {lang === "en" ? "Resubmit Corrected Numbers" : "تعديل الأرقام وإعادة الإرسال"}
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Financials breakdown */}
                          <div className="space-y-3">
                            <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                              <Banknote className="h-3.5 w-3.5" />
                              {lang === "en" ? "Financial breakdown" : "تفاصيل المبالغ المسلمة"}
                            </h4>
                            
                            <div className="bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs sm:text-sm font-semibold">
                              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                <span className="text-slate-400 font-bold">{lang === "en" ? "Cash (Inside Drop)" : "النقد المسلم (كاش)"}</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">EGP {cashDrops.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                <span className="text-slate-400 font-bold">{lang === "en" ? "Visa Slips" : "إيصالات الفيزا"}</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">EGP {visaDrops.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between pt-1">
                                <span className="font-black text-slate-700 dark:text-slate-300">{lang === "en" ? "Total Money" : "الإجمالي الكلي"}</span>
                                <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">EGP {totalDrops.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Inventory breakdown */}
                          {report.cashierRole === 1 && report.inventoryCounts && (
                            <div className="space-y-3">
                              <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                                <Eye className="h-3.5 w-3.5" />
                                {lang === "en" ? "Stock inventory check" : "جرد المخزون والتبغ"}
                              </h4>
                              
                              <div className="bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3 text-xs sm:text-sm font-semibold">
                                {report.inventoryCounts.cigarettes && (
                                  <div>
                                    <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1">{lang === "en" ? "Cigarettes (Packs)" : "علب السجائر"}</p>
                                    <div className="grid grid-cols-4 gap-2 text-center mt-2 font-mono font-bold text-[11px]">
                                      <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-medium">{lang === "en" ? "Start" : "بدء"}</p>
                                        <p className="mt-0.5">{report.inventoryCounts.cigarettes.start}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-medium text-emerald-500">{lang === "en" ? "Deliv" : "استلام"}</p>
                                        <p className="mt-0.5 text-emerald-600">{report.inventoryCounts.cigarettes.delivery}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-medium text-red-500">{lang === "en" ? "End" : "نهاية"}</p>
                                        <p className="mt-0.5 text-red-500">{report.inventoryCounts.cigarettes.end}</p>
                                      </div>
                                      <div className="bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                        <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-medium">{lang === "en" ? "Sold" : "مباع"}</p>
                                        <p className="mt-0.5 text-slate-900 dark:text-white font-black">{report.inventoryCounts.cigarettes.sold}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {report.inventoryCounts.lighters && (
                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1">{lang === "en" ? "Lighters (Units)" : "الولاعات (حبات)"}</p>
                                    <div className="grid grid-cols-4 gap-2 text-center mt-2 font-mono font-bold text-[11px]">
                                      <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-medium">{lang === "en" ? "Start" : "بدء"}</p>
                                        <p className="mt-0.5">{report.inventoryCounts.lighters.start}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-medium text-emerald-500">{lang === "en" ? "Deliv" : "استلام"}</p>
                                        <p className="mt-0.5 text-emerald-600">{report.inventoryCounts.lighters.delivery}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-medium text-red-500">{lang === "en" ? "End" : "نهاية"}</p>
                                        <p className="mt-0.5 text-red-500">{report.inventoryCounts.lighters.end}</p>
                                      </div>
                                      <div className="bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                        <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-medium">{lang === "en" ? "Sold" : "مباع"}</p>
                                        <p className="mt-0.5 text-slate-900 dark:text-white font-black">{report.inventoryCounts.lighters.sold}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Signature Render */}
                        {report.cashierSignature && (
                          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="text-center sm:text-left">
                              <p className="text-[10px] uppercase font-bold text-slate-400">{lang === "en" ? "Cashier verification signature" : "توقيع تحقق الكاشير"}</p>
                              <p className="text-xs font-bold text-slate-500 mt-1">{report.createdAt ? new Date(report.createdAt).toLocaleString() : ""}</p>
                            </div>
                            <div className="border border-slate-200 rounded-xl p-2 bg-white flex items-center justify-center max-w-[200px] h-[75px]">
                              <img src={report.cashierSignature} alt="Cashier signature preview" className="max-h-[60px] object-contain" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {shiftReports.length === 0 && (
                <div className="p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                  <Clock className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                  <p className="font-bold text-slate-500">{lang === "en" ? "No shift reports submitted yet." : "لم يتم إرسال أي تقارير وردية حتى الآن."}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB CONTENT: VOIDS --- */}
        {activeTab === "voids" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {lang === "en" ? "Logged Void & Return Requests" : "طلبات المرتجعات والإلغاءات المسجلة"}
            </h3>

            <div className="space-y-4">
              {voidRequests.map(v => (
                <div key={v.id} className="bg-white/70 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 p-5 shadow-sm space-y-4 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-orange-50 dark:bg-orange-950/20 text-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white text-base">
                          {lang === "en" ? "Transaction:" : "معاملة:"} <span className="font-mono text-blue-600 dark:text-blue-400">{v.transactionNumber}</span>
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1 font-semibold">
                          <Calendar className="h-3 w-3" /> {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : "N/A"}
                          <span className="mx-2 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">{v.register || "Register"}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400">{lang === "en" ? "Refund" : "المبلغ"}</p>
                        <p className="text-base font-black text-red-600 dark:text-red-400 font-mono">-EGP {Number(v.amount || 0).toFixed(2)}</p>
                      </div>
                      {getStatusBadge(v.status)}
                    </div>
                  </div>

                  <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-3 text-xs sm:text-sm">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">{lang === "en" ? "Reason" : "السبب للتسجيل"}</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 italic">"{v.reason}"</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>{lang === "en" ? "Customer:" : "الزبون:"} <strong className="text-slate-700 dark:text-slate-300 font-bold">{v.customerName}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{lang === "en" ? "Phone:" : "هاتف:"} <strong className="text-slate-700 dark:text-slate-300 font-bold font-mono">{v.customerPhone}</strong></span>
                      </div>
                    </div>
                  </div>

                  {v.cashierSignature && (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-center sm:text-left">
                        <p className="text-[9px] uppercase font-bold text-slate-400">{lang === "en" ? "Cashier Verification Signature" : "توقيع التحقق للكاشير"}</p>
                      </div>
                      <div className="border border-slate-200 rounded-lg p-2 bg-white flex items-center justify-center max-w-[150px] h-[55px]">
                        <img src={v.cashierSignature} alt="Signature preview" className="max-h-[45px] object-contain" />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {voidRequests.length === 0 && (
                <div className="p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                  <ShieldAlert className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                  <p className="font-bold text-slate-500">{lang === "en" ? "No void or return requests found." : "لم يتم تسجيل أي طلبات مرتجع أو إلغاء بعد."}</p>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
