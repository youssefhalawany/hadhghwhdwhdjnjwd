"use client";

import React, { useState, useEffect } from "react";
import { db, messaging, dbService } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { useRouter } from "next/navigation";
import { Lock, User as UserIcon, ChevronDown, FileText, Shield, Calendar as CalendarIcon, UserCircle, Globe, LogOut, Download, Bell } from "lucide-react";

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

  // State for PWA Install
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(true);

  useEffect(() => {
    // PWA Install Checks
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
      } else {
        setIsInstalled(false);
      }

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setIsInstalled(false);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.addEventListener("appinstalled", () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
      });

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIOS) {
      alert(lang === "en" 
        ? "To install on iOS: Tap the 'Share' icon at the bottom of Safari, then scroll down and tap 'Add to Home Screen'."
        : "للتثبيت على iOS: اضغط على أيقونة 'مشاركة' في أسفل سفاري، ثم مرر لأسفل واضغط على 'إضافة إلى الشاشة الرئيسية'.");
      return;
    }

    if (!deferredPrompt) {
      alert(lang === "en"
        ? "Your browser doesn't support automatic installation. You can install it from your browser's menu (three dots -> Add to Home screen)."
        : "متصفحك لا يدعم التثبيت التلقائي. يمكنك تثبيته من قائمة المتصفح (الثلاث نقاط -> إضافة إلى الشاشة الرئيسية).");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
  };

  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);

  useEffect(() => {
    // Check if permission already granted
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        setIsNotificationEnabled(true);
      }
    }
  }, []);

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) {
      alert(lang === "en" ? "This browser does not support notifications." : "هذا المتصفح لا يدعم الإشعارات.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted" && messaging) {
        const messagingInstance = await messaging;
        if (messagingInstance) {
          const token = await getToken(messagingInstance, { 
            vapidKey: "BHiDvLTbQ2DTED8p7X1BQ8Vu811fuu3dmpVfclmA5P7n-DuRltU7kkai9E2_2VkbLpS7Ns5ekNQClP5CsTeWf7M" 
          });
          
          if (token && authenticatedUser) {
            await dbService.setDoc("user_tokens", authenticatedUser.id, {
              fcmToken: token,
              name: authenticatedUser.name,
              role: authenticatedUser.role || "cashier",
              updatedAt: new Date().toISOString()
            });
            setIsNotificationEnabled(true);
            alert(lang === "en" ? "Notifications enabled successfully!" : "تم تفعيل الإشعارات بنجاح!");
          }
        }
      } else {
        alert(lang === "en" ? "Notification permission denied." : "تم رفض إذن الإشعارات.");
      }
    } catch (err) {
      console.error("FCM Token generation failed:", err);
      alert(lang === "en" ? "Failed to enable notifications." : "فشل تفعيل الإشعارات.");
    }
  };

  useEffect(() => {
    // Check if already logged in via localStorage
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (savedUserStr) {
      try {
        const user = JSON.parse(savedUserStr);
        if (user.role === "master") {
          router.push("/cashier/master");
          return;
        }
        setAuthenticatedUser(user);
        setLoading(false);
        return;
      } catch (e) {
        console.error("Invalid session data");
      }
    }

    const fetchEmployees = async () => {
      try {
        let activeEmployeesNames: Set<string> | null = null;
        try {
          // Fetch all employees to verify status
          const empSnap = await getDocs(collection(db, "employees"));
          activeEmployeesNames = new Set(
            empSnap.docs
              .filter(d => d.data().status === "active")
              .map(d => d.data().name)
          );
        } catch (empErr) {
          console.warn("Could not fetch employees collection (unauthenticated device). Falling back to direct cashier list.");
        }

        // Fetch registered cashiers
        const snap = await getDocs(collection(db, "cashiers"));
        const allCashiers: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        let activeCashiers = allCashiers;
        if (activeEmployeesNames) {
          // Filter: only keep cashiers whose employee record is active
          activeCashiers = allCashiers.filter(c => activeEmployeesNames!.has(c.name));

          // Auto-delete inactive cashier credentials to prevent login
          for (const c of allCashiers) {
            if (!activeEmployeesNames.has(c.name)) {
              try {
                await deleteDoc(doc(db, "cashiers", c.id));
              } catch (err) {
                console.error("Failed to auto-delete inactive cashier:", c.name, err);
              }
            }
          }
        }

        // Inject Master Account
        activeCashiers.push({
          id: "master_youssef",
          employeeId: "master_youssef",
          name: "Mr Youssef (Owner)",
          pin: "4321",
          role: "master",
          storeId: "ALL"
        });

        setEmployees(activeCashiers);
      } catch (e) {
        console.error("Failed to load cashiers", e);
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
    
    const correctPin = user.pin;
    
    if (!correctPin || pinInput !== correctPin) {
      alert(lang === "en" ? "Incorrect PIN" : "الرمز السري غير صحيح");
      return;
    }
    
    const sessionData = {
      id: user.id,
      name: user.name,
      employeeId: user.employeeId || "",
      storeId: user.storeId || "N/A",
      role: user.position || user.role || "cashier",
      loggedInAt: new Date().toISOString()
    };
    
    localStorage.setItem("active_cashier_session", JSON.stringify(sessionData));
    setPinInput("");
    
    if (sessionData.role === "master") {
      router.push("/cashier/master");
    } else {
      setAuthenticatedUser(sessionData);
    }
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-red-50/10 dark:from-slate-950 dark:via-slate-900 dark:to-red-950/5 text-slate-900 dark:text-slate-100 transition-colors duration-300" dir={lang === "ar" ? "rtl" : "ltr"}>
        {/* Header */}
        <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-red-600 rounded-full flex items-center justify-center border-2 border-red-500/30 text-white font-black text-xl shadow-lg shadow-red-600/20 animate-pulse">
                K
              </div>
              <div>
                <h1 className="font-black text-lg leading-tight text-slate-800 dark:text-white">{lang === "en" ? "Staff Portal" : "بوابة الموظفين"}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {lang === "en" ? "Welcome," : "مرحباً،"} <span className="text-red-600 dark:text-red-400 font-bold">{authenticatedUser.name}</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {!isNotificationEnabled && (
                <button 
                  onClick={handleEnableNotifications}
                  className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-full text-xs font-bold transition-colors text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40"
                >
                  <Bell className="h-4 w-4" /> {lang === "en" ? "Enable Notifications" : "تفعيل الإشعارات"}
                </button>
              )}
              {!isInstalled && (
                <button 
                  onClick={handleInstallClick}
                  className="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 px-3 py-1.5 rounded-full text-xs font-bold transition-colors text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/40"
                >
                  <Download className="h-4 w-4" /> {lang === "en" ? "Install App" : "تثبيت التطبيق"}
                </button>
              )}
              <button 
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-1.5 rounded-full text-xs font-bold transition-colors text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-slate-600/40"
              >
                <Globe className="h-4 w-4" /> {lang === "en" ? "عربي" : "EN"}
              </button>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1 text-slate-500 hover:text-red-600 dark:hover:text-red-400 bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border border-slate-200/50 dark:border-slate-600/40"
              >
                <LogOut className="h-4 w-4" /> {lang === "en" ? "Logout" : "خروج"}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Hub */}
        <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 mt-4 space-y-6">
          <h2 className="text-sm font-black mb-6 uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">
            {lang === "en" ? "Select Action" : "اختر الإجراء"}
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            
            {/* Action 1: Shift Report */}
            <button 
              onClick={() => navigateTo('/shift-reports/cashier')}
              className="group flex flex-col items-center justify-center bg-white/70 dark:bg-slate-800/40 backdrop-blur-md p-8 rounded-3xl border border-slate-200/60 dark:border-slate-700/40 hover:border-red-500/50 dark:hover:border-red-500/40 shadow-xl shadow-slate-200/10 dark:shadow-none hover:shadow-red-500/5 hover:-translate-y-1 transition-all duration-300 active:scale-[0.98] text-slate-900 dark:text-white cursor-pointer"
            >
              <div className="h-16 w-16 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
                <FileText className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl">{lang === "en" ? "Daily Shift Report" : "تقرير الوردية اليومي"}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed max-w-[280px]">
                {lang === "en" ? "Submit your end-of-shift cash and inventory counts." : "إرسال جرد النقدية والمخزون في نهاية الوردية."}
              </p>
            </button>

            {/* Action 2: Voids */}
            <button 
              onClick={() => navigateTo('/voids/cashier')}
              className="group flex flex-col items-center justify-center bg-white/70 dark:bg-slate-800/40 backdrop-blur-md p-8 rounded-3xl border border-slate-200/60 dark:border-slate-700/40 hover:border-orange-500/50 dark:hover:border-orange-500/40 shadow-xl shadow-slate-200/10 dark:shadow-none hover:shadow-orange-500/5 hover:-translate-y-1 transition-all duration-300 active:scale-[0.98] text-slate-900 dark:text-white cursor-pointer"
            >
              <div className="h-16 w-16 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-orange-600 group-hover:text-white transition-all duration-300">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl">{lang === "en" ? "Log a Void" : "تسجيل مرتجع"}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed max-w-[280px]">
                {lang === "en" ? "Record any cancelled items, voids, or customer returns." : "تسجيل المرتجعات أو العناصر الملغاة."}
              </p>
            </button>

            {/* Action 3: Expiry Tracker */}
            <button 
              onClick={() => navigateTo('/expiries')}
              className="group flex flex-col items-center justify-center bg-white/70 dark:bg-slate-800/40 backdrop-blur-md p-8 rounded-3xl border border-slate-200/60 dark:border-slate-700/40 hover:border-blue-500/50 dark:hover:border-blue-500/40 shadow-xl shadow-slate-200/10 dark:shadow-none hover:shadow-blue-500/5 hover:-translate-y-1 transition-all duration-300 active:scale-[0.98] text-slate-900 dark:text-white cursor-pointer"
            >
              <div className="h-16 w-16 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                <CalendarIcon className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl">{lang === "en" ? "Expiry Tracker" : "متابعة تواريخ الصلاحية"}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed max-w-[280px]">
                {lang === "en" ? "Log fresh food deliveries and check for expiring items." : "تسجيل المنتجات الطازجة ومعرفة المنتجات منتهية الصلاحية."}
              </p>
            </button>

            {/* Action 4: My Account */}
            <button 
              onClick={() => navigateTo('/cashier/account')}
              className="group flex flex-col items-center justify-center bg-white/70 dark:bg-slate-800/40 backdrop-blur-md p-8 rounded-3xl border border-slate-200/60 dark:border-slate-700/40 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 shadow-xl shadow-slate-200/10 dark:shadow-none hover:shadow-emerald-500/5 hover:-translate-y-1 transition-all duration-300 active:scale-[0.98] text-slate-900 dark:text-white cursor-pointer"
            >
              <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                <UserCircle className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl">{lang === "en" ? "My Account" : "حسابي"}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed max-w-[280px]">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/40 flex flex-col items-center justify-center pt-8 pb-12 px-4 transition-colors duration-300" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="w-full max-w-md space-y-6">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center w-full">
          {!isInstalled ? (
            <button 
              type="button"
              onClick={handleInstallClick}
              className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 border border-red-200/60 dark:border-red-800/50 px-4 py-2 rounded-full text-sm font-bold shadow-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-red-700 dark:text-red-400 cursor-pointer"
            >
              <Download className="h-4 w-4" /> {lang === "en" ? "Install App" : "تثبيت التطبيق"}
            </button>
          ) : <div></div>}
          <button 
            type="button"
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/50 px-4 py-2 rounded-full text-sm font-bold shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Globe className="h-4 w-4" /> {lang === "en" ? "عربي" : "English"}
          </button>
        </div>

        {/* Title */}
        <div className="text-center py-2 mb-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-full mb-4 shadow-xl shadow-red-500/30">
            <UserCircle className="h-8 w-8 text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {lang === "en" ? "Staff Login" : "تسجيل دخول الموظفين"}
          </h1>
          <p className="text-xs text-red-600 dark:text-red-400 font-bold tracking-widest mt-2 uppercase">
            {lang === "en" ? "Circle K Franchise Portal" : "بوابة سيركل كي"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md p-6 sm:p-8 rounded-3xl space-y-6 border border-slate-200/70 dark:border-slate-800/60 shadow-2xl">
          
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1">
              <UserIcon className="h-4 w-4 text-slate-400" /> {lang === "en" ? "Employee Name" : "اسم الموظف"}
            </label>
            <div className="relative">
              <div 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white outline-none focus:border-red-500 text-base cursor-pointer flex justify-between items-center transition-all"
              >
                <span className={!selectedEmployeeId ? "text-slate-400 dark:text-slate-500" : "font-bold"}>
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
                <div className="absolute z-[100] top-full left-0 right-0 mt-2 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {employees.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">
                      {lang === "en" ? "No employees found." : "لم يتم العثور على موظفين."}
                    </div>
                  ) : (
                    employees.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => { setSelectedEmployeeId(c.id); setIsDropdownOpen(false); }}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700/60 last:border-0 flex flex-col gap-1 transition-colors"
                      >
                        <span className="font-bold text-slate-900 dark:text-white text-base">{c.name}</span>
                        <div className="flex items-center gap-2">
                          {c.position && (
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md uppercase tracking-wider">
                              {c.position}
                            </span>
                          )}
                          {(c.storeId || c.branchId) && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-900/50 px-2 py-0.5 rounded-md">
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
              <Lock className="h-4 w-4 text-slate-400" /> {lang === "en" ? "4-Digit PIN" : "الرمز السري"}
            </label>
            <input 
              required
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white outline-none focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 text-center text-3xl tracking-[1em] font-mono transition-all"
              placeholder="••••"
            />
          </div>

          <button 
            type="submit" 
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg shadow-xl shadow-red-500/20 active:scale-[0.98] hover:scale-[1.01] transition-all duration-200 cursor-pointer"
          >
            {lang === "en" ? "Unlock Dashboard" : "الدخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
