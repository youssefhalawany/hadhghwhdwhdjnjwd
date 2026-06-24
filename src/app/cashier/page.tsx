"use client";

import React, { useState, useEffect } from "react";
import { db, messaging, dbService } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { useRouter } from "next/navigation";
import { Lock, User as UserIcon, ChevronDown, FileText, Shield, Calendar as CalendarIcon, UserCircle, Globe, LogOut, Download, Bell, Fingerprint } from "lucide-react";
import { PinPad } from "@/components/PinPad";
import { playSuccessSound, playErrorSound, getAudioCtx } from "@/lib/sounds";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [hasFaceIdRegistered, setHasFaceIdRegistered] = useState(false);

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

  // Check if selected employee has FaceID enabled
  useEffect(() => {
    if (selectedEmployeeId) {
      setHasFaceIdRegistered(localStorage.getItem(`faceid_enabled_${selectedEmployeeId}`) === "true");
    } else {
      setHasFaceIdRegistered(false);
    }
  }, [selectedEmployeeId]);

  const handleInstallClick = async () => {
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isAndroid = /android/.test(window.navigator.userAgent.toLowerCase());

    if (isIOS) {
      toast.info(lang === "en" 
        ? "To install on iOS: Tap 'Share' at the bottom of Safari, then 'Add to Home Screen'."
        : "للتثبيت على iOS: اضغط على أيقونة 'مشاركة' في أسفل سفاري، ثم اضغط على 'إضافة إلى الشاشة الرئيسية'.");
      return;
    }

    if (isAndroid) {
      // Direct APK download for Android
      const link = document.createElement("a");
      link.href = "/circlek-cashier.apk";
      link.download = "circlek-cashier.apk";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      
      toast.success(lang === "en" 
        ? "Downloading App... Tap the file to install it."
        : "جاري تحميل التطبيق... اضغط على الملف لتثبيته.");
      
      setIsInstalled(true);
      return;
    }

    // Fallback for Desktop/Chrome if not explicitly Android/iOS
    if (!deferredPrompt) {
      toast.warning(lang === "en"
        ? "Your browser doesn't support automatic installation. Use browser menu -> Add to Home screen."
        : "متصفحك لا يدعم التثبيت التلقائي. يمكنك التثبيت من القائمة -> إضافة إلى الشاشة الرئيسية.");
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
      toast.error(lang === "en" ? "This browser does not support notifications." : "هذا المتصفح لا يدعم الإشعارات.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted" && messaging) {
        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const messagingInstance = await messaging;
        if (messagingInstance) {
          const token = await getToken(messagingInstance, { 
            vapidKey: "BHiDvLTbQ2DTED8p7X1BQ8Vu811fuu3dmpVfclmA5P7n-DuRltU7kkai9E2_2VkbLpS7Ns5ekNQClP5CsTeWf7M",
            serviceWorkerRegistration: swReg
          });
          
          if (token && authenticatedUser) {
            await dbService.setDoc("user_tokens", authenticatedUser.id, {
              fcmToken: token,
              name: authenticatedUser.name,
              role: authenticatedUser.role || "cashier",
              updatedAt: new Date().toISOString()
            });
            setIsNotificationEnabled(true);
            toast.success(lang === "en" ? "Notifications enabled successfully!" : "تم تفعيل الإشعارات بنجاح!");
          }
        }
      } else {
        toast.error(lang === "en" ? "Notification permission denied." : "تم رفض إذن الإشعارات.");
      }
    } catch (err: any) {
      console.error("FCM Token generation failed:", err);
      toast.error((lang === "en" ? "Failed to enable notifications. " : "فشل تفعيل الإشعارات. ") + err.message);
    }
  };

  useEffect(() => {
    // Check if already logged in via localStorage
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (savedUserStr) {
      try {
        const user = JSON.parse(savedUserStr);
        if (user.role === "master") {
          setAuthenticatedUser(user);
          setLoading(false);
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
          const empSnap = await getDocs(collection(db, "employees"));
          activeEmployeesNames = new Set(
            empSnap.docs
              .filter(d => d.data().status === "active")
              .map(d => d.data().name)
          );
        } catch (empErr) {
          console.warn("Could not fetch employees collection (unauthenticated device). Falling back to direct cashier list.");
        }

        const snap = await getDocs(collection(db, "cashiers"));
        const allCashiers: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        let activeCashiers = allCashiers;
        if (activeEmployeesNames) {
          activeCashiers = allCashiers.filter(c => activeEmployeesNames!.has(c.name));
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

  const handleLogin = (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    if (!selectedEmployeeId) {
      toast.error(lang === "en" ? "Please select your name." : "يرجى اختيار اسمك.");
      return;
    }
    
    const user = employees.find(x => x.id === selectedEmployeeId);
    if (!user) return;
    
    const correctPin = user.pin;
    const pinToVerify = typeof e === "string" ? e : pinInput;
    
    if (!correctPin || pinToVerify !== correctPin) {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([50, 50, 50]);
      playErrorSound();
      toast.error(lang === "en" ? "Incorrect PIN" : "الرمز السري غير صحيح");
      setPinInput("");
      return;
    }
    
    playSuccessSound();
    const sessionData = {
      id: user.id,
      name: user.name,
      employeeId: user.employeeId || "",
      storeId: user.storeId || "N/A",
      branchId: user.branchId || "alamein4",
      role: user.position || user.role || "cashier",
      loggedInAt: new Date().toISOString()
    };
    
    localStorage.setItem("active_cashier_session", JSON.stringify(sessionData));
    setPinInput("");
    
    setAuthenticatedUser(sessionData);
  };

  const registerFaceId = async () => {
    if (!window.PublicKeyCredential) return;
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "CK Shift App", id: window.location.hostname },
          user: { id: userId, name: selectedEmployeeId, displayName: selectedEmployeeId },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
          timeout: 60000,
        }
      });
      
      if (credential) {
        localStorage.setItem(`faceid_enabled_${selectedEmployeeId}`, "true");
        setHasFaceIdRegistered(true);
        toast.success(lang === "en" ? "FaceID/TouchID Enabled!" : "تم تفعيل البصمة!");
        
        const emp = employees.find(e => e.id === selectedEmployeeId);
        if (emp) {
          handleLogin(emp.pin);
        }
      }
    } catch (e) {
      toast.error(lang === "en" ? "Biometric authentication failed." : "فشل التحقق.");
    }
  };

  const loginWithFaceId = async (empId: string) => {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const assertion = await navigator.credentials.get({
        publicKey: { challenge, rpId: window.location.hostname, userVerification: "required" }
      });
      if (assertion) {
        const user = employees.find(x => x.id === empId);
        if (user) {
          playSuccessSound();
          const sessionData = {
            id: user.id,
            name: user.name,
            role: user.position || user.role || "cashier",
            loggedInAt: new Date().toISOString()
          };
          localStorage.setItem("active_cashier_session", JSON.stringify(sessionData));
          setAuthenticatedUser(sessionData);
        }
      }
    } catch (e) {
      playErrorSound();
      console.error(e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("active_cashier_session");
    setAuthenticatedUser(null);
    setSelectedEmployeeId("");
    setPinInput("");
  };

  const navigateTo = (path: string) => {
    router.push(path);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <Skeleton className="h-16 w-16 rounded-full" />
      </div>
    );
  }

  if (authenticatedUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-red-50/10 dark:from-slate-950 dark:via-slate-900 dark:to-red-950/5 text-slate-900 dark:text-slate-100 transition-colors duration-300" dir={lang === "ar" ? "rtl" : "ltr"}>
        <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-red-600 rounded-full flex items-center justify-center border-2 border-red-500/30 text-white font-black text-xl shadow-lg shadow-red-600/20 animate-pulse">K</div>
              <div>
                <h1 className="font-black text-lg leading-tight text-slate-800 dark:text-white">{lang === "en" ? "Staff Portal" : "بوابة الموظفين"}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {lang === "en" ? "Welcome," : "مرحباً،"} <span className="text-red-600 dark:text-red-400 font-bold">{authenticatedUser.name}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleEnableNotifications} 
                className={`relative flex items-center justify-center p-2 rounded-full border transition-all duration-300 ${
                  isNotificationEnabled 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400" 
                    : "bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                }`}
                title={isNotificationEnabled ? (lang === "en" ? "Notifications On" : "الإشعارات مفعلة") : (lang === "en" ? "Enable Notifications" : "تفعيل الإشعارات")}
              >
                <Bell className={`h-4 w-4 ${!isNotificationEnabled && "animate-pulse"}`} />
                {isNotificationEnabled && <span className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800"></span>}
              </button>
              {!isInstalled && (
                <button onClick={handleInstallClick} className="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 px-3 py-1.5 rounded-full text-xs font-bold text-red-700 dark:text-red-400"><Download className="h-4 w-4" /> {lang === "en" ? "Install App" : "تثبيت التطبيق"}</button>
              )}
              <button onClick={() => setLang(lang === "en" ? "ar" : "en")} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 dark:text-slate-200"><Globe className="h-4 w-4" /> {lang === "en" ? "عربي" : "EN"}</button>
              <button onClick={handleLogout} className="flex items-center gap-1 text-slate-500 hover:text-red-600 dark:hover:text-red-400 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-bold"><LogOut className="h-4 w-4" /> {lang === "en" ? "Logout" : "خروج"}</button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 mt-4 space-y-6">
          <h2 className="text-sm font-black mb-6 uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">
            {lang === "en" ? "Select Action" : "اختر الإجراء"}
          </h2>

          {!hasFaceIdRegistered && typeof window !== "undefined" && window.PublicKeyCredential && (
            <button 
              onClick={registerFaceId}
              className="w-full mb-8 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
            >
              <Fingerprint className="h-5 w-5 text-emerald-400" />
              {lang === "en" ? "Enable FaceID / TouchID" : "تفعيل بصمة الوجه / الإصبع"}
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {authenticatedUser.role === "master" && (
              <button 
                onClick={() => navigateTo('/cashier/master')}
                className="group flex flex-col items-center justify-center bg-red-50 dark:bg-red-950/20 backdrop-blur-md p-8 rounded-3xl border border-red-200 dark:border-red-800/40 hover:border-red-500/80 shadow-xl shadow-red-500/10 hover:shadow-red-500/20 hover:-translate-y-1 transition-all duration-300 active:scale-[0.98] text-slate-900 dark:text-white cursor-pointer col-span-1 sm:col-span-2"
              >
                <div className="h-16 w-16 bg-red-600 text-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-300 shadow-lg shadow-red-500/30">
                  <Bell className="h-8 w-8 animate-pulse" />
                </div>
                <h3 className="font-black text-2xl text-red-600 dark:text-red-400 uppercase tracking-wider">{lang === "en" ? "Master Feed" : "اللوحة الرئيسية"}</h3>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-2 text-center leading-relaxed max-w-[280px]">
                  {lang === "en" ? "View global activity and live notifications." : "عرض النشاط العام والإشعارات المباشرة."}
                </p>
              </button>
            )}

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
              <div className="h-16 w-16 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:blue-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                <CalendarIcon className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl">{lang === "en" ? "Expiry Tracker" : "متابعة تواريخ الصلاحية"}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed max-w-[280px]">
                {lang === "en" ? "Log fresh food deliveries and check for expiring items." : "تسجيل المنتجات الطازجة ومعرفة المنتجات منتهية الصلاحية."}
              </p>
            </button>

            {/* Action: Checklists */}
            <button 
              onClick={() => navigateTo('/checklists/cashier')}
              className="group flex flex-col items-center justify-center bg-white/70 dark:bg-slate-800/40 backdrop-blur-md p-8 rounded-3xl border border-slate-200/60 dark:border-slate-700/40 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 shadow-xl shadow-slate-200/10 dark:shadow-none hover:shadow-emerald-500/5 hover:-translate-y-1 transition-all duration-300 active:scale-[0.98] text-slate-900 dark:text-white cursor-pointer"
            >
              <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                <FileText className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl">{lang === "en" ? "Checklists" : "قوائم المراجعة"}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed max-w-[280px]">
                {lang === "en" ? "Submit daily inspection and branch checklists." : "إرسال قوائم الفحص والمراجعة اليومية للفرع."}
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
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/40 flex flex-col items-center justify-center pt-8 pb-12 px-4 transition-colors duration-300" 
      dir={lang === "ar" ? "rtl" : "ltr"}
      onClick={() => getAudioCtx()}
    >
      <div className="w-full max-w-md space-y-6">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleEnableNotifications} 
              className={`relative flex items-center justify-center p-2 rounded-full border transition-all duration-300 ${
                isNotificationEnabled 
                  ? "bg-emerald-50/80 backdrop-blur-md border-emerald-200/60 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-800/50 dark:text-emerald-400" 
                  : "bg-white/80 backdrop-blur-md border-slate-200/60 text-slate-500 dark:bg-slate-800/80 dark:border-slate-700/50 dark:text-slate-400 hover:bg-white hover:text-blue-600 hover:border-blue-200 hover:shadow-md"
              }`}
              title={isNotificationEnabled ? (lang === "en" ? "Notifications On" : "الإشعارات مفعلة") : (lang === "en" ? "Enable Notifications" : "تفعيل الإشعارات")}
            >
              <Bell className={`h-4 w-4 ${!isNotificationEnabled && "animate-pulse"}`} />
              {isNotificationEnabled && <span className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800"></span>}
            </button>
            {!isInstalled && (
              <button 
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 border border-red-200/60 dark:border-red-800/50 px-4 py-2 rounded-full text-sm font-bold shadow-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-red-700 dark:text-red-400 cursor-pointer"
              >
                <Download className="h-4 w-4" /> {lang === "en" ? "Install App" : "تثبيت التطبيق"}
              </button>
            )}
          </div>
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
                        onClick={() => { 
                          setSelectedEmployeeId(c.id); 
                          setIsDropdownOpen(false); 
                          if (localStorage.getItem(`faceid_enabled_${c.id}`) === "true") {
                            loginWithFaceId(c.id);
                          }
                        }}
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
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-4 flex items-center justify-center gap-1">
              <Lock className="h-4 w-4 text-slate-400" /> {lang === "en" ? "Enter 4-Digit PIN" : "أدخل الرمز السري"}
            </label>
            <PinPad 
              onPinChange={(val) => setPinInput(val)}
              onSubmit={(val) => handleLogin(val as any)}
              maxLength={4}
            />
            
            {hasFaceIdRegistered && (
              <button
                type="button"
                onClick={() => loginWithFaceId(selectedEmployeeId)}
                className="mt-6 w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold text-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 shadow-inner"
              >
                <Fingerprint className="h-6 w-6 text-emerald-500" />
                {lang === "en" ? "Use FaceID / TouchID" : "استخدام البصمة"}
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}
