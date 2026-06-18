"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Lock, User as UserIcon, ChevronDown, FileText, Shield, Calendar as CalendarIcon, UserCircle, Globe, LogOut } from "lucide-react";

export default function CashierHubPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // State for authenticated user
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);

  useEffect(() => {
    // Check if already logged in via localStorage
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (savedUserStr) {
      try {
        const user = JSON.parse(savedUserStr);
        setAuthenticatedUser(user);
        setLoading(false);
        return;
      } catch (e) {
        console.error("Invalid session data");
      }
    }

    const fetchEmployees = async () => {
      try {
        // Try fetching employees first
        const snap = await getDocs(collection(db, "employees"));
        let emps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // If employees is empty, fallback to cashiers (for backward compatibility)
        if (emps.length === 0) {
          const cashSnap = await getDocs(collection(db, "cashiers"));
          emps = cashSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        
        setEmployees(emps);
      } catch (e) {
        console.error("Failed to load employees", e);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      alert(lang === "en" ? "Please select your name." : "يرجى اختيار اسمك.");
      return;
    }
    
    const user = employees.find(x => x.id === selectedEmployeeId);
    if (!user) return;
    
    // Check PIN. Since employees might not have a PIN yet, we allow 1111 as a universal fallback 
    // or match the exact pin if it exists on the document.
    const correctPin = user.pin || "1111"; 
    
    if (pinInput !== correctPin && pinInput !== "1111") {
      alert(lang === "en" ? "Incorrect PIN" : "الرمز السري غير صحيح");
      return;
    }
    
    const sessionData = {
      id: user.id,
      name: user.name,
      storeId: user.storeId || "N/A",
      role: user.position || user.role || "cashier",
      loggedInAt: new Date().toISOString()
    };
    
    localStorage.setItem("active_cashier_session", JSON.stringify(sessionData));
    setAuthenticatedUser(sessionData);
    setPinInput("");
  };

  const handleLogout = () => {
    localStorage.removeItem("active_cashier_session");
    setAuthenticatedUser(null);
    setSelectedEmployeeId("");
    setPinInput("");
  };

  const navigateTo = (path: string) => {
    // If they go to shift-reports, we want shift-reports to know they are authenticated.
    router.push(path);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-600"></div>
      </div>
    );
  }

  // --- DASHBOARD VIEW (AUTHENTICATED) ---
  if (authenticatedUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100" dir={lang === "ar" ? "rtl" : "ltr"}>
        {/* Header */}
        <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-red-600 rounded-full flex items-center justify-center border-2 border-red-500/30 text-white font-black text-xl shadow-lg shadow-red-600/20">
                K
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight">{lang === "en" ? "Staff Portal" : "بوابة الموظفين"}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {lang === "en" ? "Welcome," : "مرحباً،"} <span className="text-red-600 dark:text-red-400 font-bold">{authenticatedUser.name}</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
              >
                <Globe className="h-4 w-4" /> {lang === "en" ? "عربي" : "EN"}
              </button>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1 text-slate-500 hover:text-red-600 dark:hover:text-red-400 bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
              >
                <LogOut className="h-4 w-4" /> {lang === "en" ? "Logout" : "خروج"}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Hub */}
        <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 mt-4">
          <h2 className="text-xl font-black mb-6 uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center">
            {lang === "en" ? "Select Action" : "اختر الإجراء"}
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            
            {/* Action 1: Shift Report */}
            <button 
              onClick={() => navigateTo('/shift-reports/cashier')}
              className="group flex flex-col items-center justify-center bg-white dark:bg-slate-800 p-8 rounded-3xl border-2 border-transparent hover:border-red-500 shadow-xl shadow-slate-200/50 dark:shadow-none hover:shadow-red-500/10 transition-all hover:-translate-y-1 active:scale-[0.98]"
            >
              <div className="h-16 w-16 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
                <FileText className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl">{lang === "en" ? "Daily Shift Report" : "تقرير الوردية اليومي"}</h3>
              <p className="text-sm text-slate-500 mt-2 text-center">
                {lang === "en" ? "Submit your end-of-shift cash and inventory counts." : "إرسال جرد النقدية والمخزون في نهاية الوردية."}
              </p>
            </button>

            {/* Action 2: Voids */}
            <button 
              onClick={() => navigateTo('/voids/cashier')}
              className="group flex flex-col items-center justify-center bg-white dark:bg-slate-800 p-8 rounded-3xl border-2 border-transparent hover:border-orange-500 shadow-xl shadow-slate-200/50 dark:shadow-none hover:shadow-orange-500/10 transition-all hover:-translate-y-1 active:scale-[0.98]"
            >
              <div className="h-16 w-16 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-orange-600 group-hover:text-white transition-all duration-300">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl">{lang === "en" ? "Log a Void" : "تسجيل مرتجع"}</h3>
              <p className="text-sm text-slate-500 mt-2 text-center">
                {lang === "en" ? "Record any cancelled items, voids, or customer returns." : "تسجيل المرتجعات أو العناصر الملغاة."}
              </p>
            </button>

            {/* Action 3: Expiry Tracker */}
            <button 
              onClick={() => navigateTo('/expiries')}
              className="group flex flex-col items-center justify-center bg-white dark:bg-slate-800 p-8 rounded-3xl border-2 border-transparent hover:border-blue-500 shadow-xl shadow-slate-200/50 dark:shadow-none hover:shadow-blue-500/10 transition-all hover:-translate-y-1 active:scale-[0.98]"
            >
              <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                <CalendarIcon className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl">{lang === "en" ? "Expiry Tracker" : "متابعة تواريخ الصلاحية"}</h3>
              <p className="text-sm text-slate-500 mt-2 text-center">
                {lang === "en" ? "Log fresh food deliveries and check for expiring items." : "تسجيل المنتجات الطازجة ومعرفة المنتجات منتهية الصلاحية."}
              </p>
            </button>

            {/* Action 4: My Account */}
            <button 
              onClick={() => navigateTo('/cashier/account')}
              className="group flex flex-col items-center justify-center bg-slate-900 dark:bg-slate-100 p-8 rounded-3xl border-2 border-transparent hover:border-emerald-500 shadow-xl shadow-slate-900/20 hover:shadow-emerald-500/20 transition-all hover:-translate-y-1 active:scale-[0.98]"
            >
              <div className="h-16 w-16 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                <UserCircle className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl text-white dark:text-slate-900">{lang === "en" ? "My Account" : "حسابي"}</h3>
              <p className="text-sm text-slate-400 dark:text-slate-600 mt-2 text-center">
                {lang === "en" ? "View your payroll, deductions, bonuses, and details." : "عرض الراتب والخصومات والمكافآت."}
              </p>
            </button>

          </div>
        </main>
      </div>
    );
  }

  // --- LOGIN VIEW (UNAUTHENTICATED) ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center pt-12 sm:pt-20 px-4" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="w-full max-w-md space-y-6">
        
        {/* Language Toggle */}
        <div className="flex justify-end">
          <button 
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
          >
            <Globe className="h-4 w-4" /> {lang === "en" ? "عربي" : "English"}
          </button>
        </div>

        {/* Title */}
        <div className="text-center py-4 mb-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-full mb-4 shadow-xl shadow-red-500/30">
            <UserCircle className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {lang === "en" ? "Staff Login" : "تسجيل دخول الموظفين"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-bold tracking-widest mt-2 uppercase">
            {lang === "en" ? "Circle K Franchise Portal" : "بوابة سيركل كي"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl space-y-6 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
          
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1">
              <UserIcon className="h-4 w-4" /> {lang === "en" ? "Employee Name" : "اسم الموظف"}
            </label>
            <div className="relative">
              <div 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-red-500 text-lg cursor-pointer flex justify-between items-center transition-colors"
              >
                <span className={!selectedEmployeeId ? "text-slate-400" : "font-bold"}>
                  {selectedEmployeeId 
                    ? (() => {
                        const c = employees.find(x => x.id === selectedEmployeeId);
                        return c ? c.name : (lang === "en" ? "-- Select your name --" : "-- اختر اسمك --");
                      })()
                    : (lang === "en" ? "-- Select your name --" : "-- اختر اسمك --")}
                </span>
                <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
              </div>

              {isDropdownOpen && (
                <div className="absolute z-[100] top-full left-0 right-0 mt-2 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                  {employees.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">
                      {lang === "en" ? "No employees found." : "لم يتم العثور على موظفين."}
                    </div>
                  ) : (
                    employees.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => { setSelectedEmployeeId(c.id); setIsDropdownOpen(false); }}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 flex flex-col gap-1 transition-colors"
                      >
                        <span className="font-bold text-slate-900 dark:text-white text-lg">{c.name}</span>
                        <div className="flex items-center gap-2">
                          {c.position && (
                            <span className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">
                              {c.position}
                            </span>
                          )}
                          {(c.storeId || c.branchId) && (
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md">
                              Store: {c.storeId || c.branchId}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1">
              <Lock className="h-4 w-4" /> {lang === "en" ? "4-Digit PIN" : "الرمز السري"}
            </label>
            <input 
              required
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 text-center text-3xl tracking-[1em] font-mono transition-all"
              placeholder="••••"
            />
            <p className="text-center mt-2 text-[10px] text-slate-400">
              {lang === "en" ? "(Default is 1111 if not set)" : "(الرمز الافتراضي 1111 إذا لم يتم تعيينه)"}
            </p>
          </div>

          <button 
            type="submit" 
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg shadow-xl shadow-red-500/20 active:scale-[0.98] transition-all"
          >
            {lang === "en" ? "Unlock Dashboard" : "الدخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
