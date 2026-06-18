"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, UserCircle, Banknote, Calendar, ShieldAlert, 
  TrendingUp, TrendingDown, Clock, ShieldCheck, FileText, Globe
} from "lucide-react";

export default function MyAccountPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [loading, setLoading] = useState(true);
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [payrollLines, setPayrollLines] = useState<any[]>([]);

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
        // 1. Fetch exact employee profile
        const empRef = doc(db, "employees", employeeId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          setUserProfile({ id: empSnap.id, ...empSnap.data() });
        } else {
          // Fallback if they logged in via 'cashiers' collection and don't exist in 'employees'
          const cashRef = doc(db, "cashiers", employeeId);
          const cashSnap = await getDoc(cashRef);
          if (cashSnap.exists()) {
            setUserProfile({ id: cashSnap.id, ...cashSnap.data() });
          }
        }

        // 2. Fetch Deductions
        const dedQuery = query(collection(db, "deductions"), where("employeeId", "==", employeeId));
        const dedSnap = await getDocs(dedQuery);
        setDeductions(dedSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // 3. Fetch Adjustments (Bonuses, Overtime)
        const adjQuery = query(collection(db, "adjustments"), where("employeeId", "==", employeeId));
        const adjSnap = await getDocs(adjQuery);
        setAdjustments(adjSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // 4. Fetch Payroll Lines
        const payQuery = query(collection(db, "payroll_lines"), where("employeeId", "==", employeeId));
        const paySnap = await getDocs(payQuery);
        setPayrollLines(paySnap.docs.map(d => ({ id: d.id, ...d.data() })));

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
          <h2 className="text-xl font-bold">Profile Not Found</h2>
          <button onClick={() => router.push("/cashier")} className="mt-4 text-red-600 font-bold underline">Return to Dashboard</button>
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 pb-20" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => router.push("/cashier")}
            className="flex items-center gap-1 text-slate-500 hover:text-red-600 transition-colors"
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
            className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
          >
            <Globe className="h-4 w-4" /> {lang === "en" ? "عربي" : "EN"}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Profile Identity Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/40 dark:shadow-none flex flex-col sm:flex-row items-center gap-6">
          <div className="h-24 w-24 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 flex-shrink-0">
            <span className="text-white font-black text-3xl">
              {userProfile.name?.charAt(0) || "U"}
            </span>
          </div>
          <div className="text-center sm:text-left flex-1">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{userProfile.name}</h2>
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-mono">
              ID: {userProfile.id} {userProfile.nationalId ? `| NID: ${userProfile.nationalId}` : ""}
            </p>
          </div>
        </div>

        {/* Current Month Financial Overview */}
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-8 mb-2">
          {lang === "en" ? "Current Month Estimation" : "تقديرات الشهر الحالي"}
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
              <Banknote className="h-4 w-4" />
              <span className="text-xs font-bold uppercase">{lang === "en" ? "Base Salary" : "الراتب الأساسي"}</span>
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white">EGP {baseSalary.toLocaleString()}</p>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-bold uppercase">{lang === "en" ? "Bonuses" : "المكافآت"}</span>
            </div>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">+EGP {totalBonuses.toLocaleString()}</p>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-red-100 dark:border-red-900/30">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-500 mb-2">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-bold uppercase">{lang === "en" ? "Deductions" : "الخصومات"}</span>
            </div>
            <p className="text-xl font-black text-red-600 dark:text-red-400">-EGP {totalDeductions.toLocaleString()}</p>
          </div>
          
          <div className="bg-slate-900 dark:bg-white p-5 rounded-2xl border border-slate-900 dark:border-white shadow-lg">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-2">
              <Banknote className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-bold uppercase">{lang === "en" ? "Est. Net Pay" : "الصافي المتوقع"}</span>
            </div>
            <p className="text-xl font-black text-white dark:text-slate-900">EGP {netPayEstimate.toLocaleString()}</p>
          </div>
        </div>

        {/* Detailed Logs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          
          {/* Deductions Column */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              {lang === "en" ? "Recent Deductions" : "الخصومات الأخيرة"}
            </h3>
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {currentDeductions.length === 0 ? (
                <div className="p-6 text-center text-sm font-medium text-slate-500">
                  {lang === "en" ? "No deductions this month. Great job!" : "لا يوجد خصومات هذا الشهر."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {currentDeductions.map(d => (
                    <div key={d.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{d.reason || "Shortage"}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
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
              {lang === "en" ? "Recent Adjustments" : "المكافآت والإضافات"}
            </h3>
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {currentAdjustments.length === 0 ? (
                <div className="p-6 text-center text-sm font-medium text-slate-500">
                  {lang === "en" ? "No adjustments this month." : "لا يوجد إضافات هذا الشهر."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {currentAdjustments.map(a => (
                    <div key={a.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">
                          {a.notes || "Bonus"}
                          {a.type === "overtime" && <span className="ml-2 bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded">OT</span>}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
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
        <div className="mt-8 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {lang === "en" ? "Payroll History" : "سجل الرواتب السابقة"}
          </h3>
          
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {payrollLines.length === 0 ? (
              <div className="p-6 text-center text-sm font-medium text-slate-500">
                {lang === "en" ? "No historical payroll records found." : "لا توجد سجلات رواتب سابقة."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {payrollLines.sort((a,b) => b.month.localeCompare(a.month)).map(p => (
                  <div key={p.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700">
                        <Clock className="h-5 w-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white text-base">
                          {lang === "en" ? "Month:" : "شهر:"} {p.month}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                          {p.days} {lang === "en" ? "Days Worked" : "أيام العمل"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 sm:gap-8 border-t sm:border-t-0 border-slate-100 dark:border-slate-700 pt-3 sm:pt-0">
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

      </main>
    </div>
  );
}
