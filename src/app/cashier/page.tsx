"use client";

import React, { useState, useEffect } from "react";
import { db, messaging, dbService } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { useRouter } from "next/navigation";
import { Lock, User as UserIcon, ChevronDown, FileText, Shield, Calendar as CalendarIcon, UserCircle, Globe, LogOut, Download, Bell, Fingerprint, ScanLine } from "lucide-react";
import { PinPad } from "@/components/PinPad";
import { playSuccessSound, playErrorSound, playPopSound, getAudioCtx } from "@/lib/sounds";
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

    if (isIOS) {
      toast.info(lang === "en" 
        ? "To install on iOS: Tap 'Share' at the bottom of Safari, then 'Add to Home Screen'."
        : "للتثبيت على iOS: اضغط على أيقونة 'مشاركة' في أسفل سفاري، ثم اضغط على 'إضافة إلى الشاشة الرئيسية'.");
      return;
    }

    // Rely entirely on PWA for Android & Desktop
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
    playPopSound();
    localStorage.removeItem("active_cashier_session");
    setAuthenticatedUser(null);
    setSelectedEmployeeId("");
    setPinInput("");
  };

  const navigateTo = (path: string) => {
    playPopSound();
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
      <div className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-950 to-black text-slate-100 transition-colors duration-500 overflow-y-auto w-full flex flex-col" dir={lang === "ar" ? "rtl" : "ltr"}>
        <header className="bg-slate-900/60 backdrop-blur-xl shadow-lg border-b border-white/10 p-4 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-gradient-to-tr from-red-600 to-rose-400 rounded-2xl flex items-center justify-center border border-white/20 text-white font-black text-2xl shadow-[0_0_20px_rgba(225,29,72,0.4)] animate-pulse">K</div>
              <div>
                <h1 className="font-black text-xl tracking-tight text-white drop-shadow-md">{lang === "en" ? "Staff Portal" : "بوابة الموظفين"}</h1>
                <p className="text-xs text-slate-400 font-medium">
                  {lang === "en" ? "Welcome," : "مرحباً،"} <span className="text-red-400 font-bold">{authenticatedUser.name}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { playPopSound(); handleEnableNotifications(); }} 
                className={`relative flex items-center gap-2 justify-center px-4 py-2 rounded-full border transition-all duration-300 font-bold shadow-sm active:scale-95 ${
                  isNotificationEnabled 
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                    : "bg-gradient-to-r from-red-600 to-rose-500 border-red-500/50 text-white shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:scale-105"
                }`}
                title={isNotificationEnabled ? (lang === "en" ? "Notifications On" : "الإشعارات مفعلة") : (lang === "en" ? "Enable Notifications" : "تفعيل الإشعارات")}
              >
                <Bell className={`h-4 w-4 ${!isNotificationEnabled && "animate-pulse"}`} />
                <span className="hidden sm:inline text-xs uppercase tracking-wider">{isNotificationEnabled ? (lang === "en" ? "Alerts On" : "إشعارات") : (lang === "en" ? "Get Alerts" : "تفعيل")}</span>
                {isNotificationEnabled && <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>}
              </button>
              {!isInstalled && (
                <button onClick={() => { playPopSound(); handleInstallClick(); }} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold text-white transition-all active:scale-95 border border-white/5"><Download className="h-4 w-4" /> {lang === "en" ? "Install" : "تثبيت"}</button>
              )}
              <button onClick={() => { playPopSound(); setLang(lang === "en" ? "ar" : "en"); }} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold text-white transition-all active:scale-95 border border-white/5"><Globe className="h-4 w-4" /> {lang === "en" ? "عربي" : "EN"}</button>
              <button onClick={handleLogout} className="flex items-center gap-1.5 text-white/70 hover:text-red-400 bg-white/5 hover:bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95 border border-white/5"><LogOut className="h-4 w-4" /> {lang === "en" ? "Logout" : "خروج"}</button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 mt-2 space-y-8 w-full pb-32">
          <h2 className="text-xs font-black tracking-[0.2em] text-white/40 text-center uppercase">
            {lang === "en" ? "Select Action" : "اختر الإجراء"}
          </h2>

          {!hasFaceIdRegistered && typeof window !== "undefined" && window.PublicKeyCredential && (
            <button 
              onClick={() => { playPopSound(); registerFaceId(); }}
              className="w-full mb-8 py-4 bg-white/5 backdrop-blur-xl border border-emerald-500/30 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/10 transition-all shadow-[0_0_30px_rgba(16,185,129,0.15)] active:scale-95"
            >
              <Fingerprint className="h-6 w-6 text-emerald-400 animate-pulse" />
              {lang === "en" ? "Enable FaceID / TouchID" : "تفعيل بصمة الوجه / الإصبع"}
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {authenticatedUser.role === "master" && (
              <button 
                onClick={() => navigateTo('/cashier/master')}
                className="group flex flex-col items-center justify-center bg-white/5 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 hover:border-red-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_0_40px_rgba(225,29,72,0.2)] transition-all duration-300 active:scale-[0.96] text-white cursor-pointer col-span-1 sm:col-span-2 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="h-20 w-20 bg-gradient-to-br from-red-500 to-rose-600 text-white rounded-[1.5rem] flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-[0_0_25px_rgba(225,29,72,0.5)] z-10">
                  <Bell className="h-10 w-10 animate-pulse" />
                </div>
                <h3 className="font-black text-3xl tracking-tight z-10 mb-2">{lang === "en" ? "Master Feed" : "اللوحة الرئيسية"}</h3>
                <p className="text-sm font-medium text-white/60 text-center leading-relaxed max-w-[280px] z-10">
                  {lang === "en" ? "View global activity and live notifications." : "عرض النشاط العام والإشعارات المباشرة."}
                </p>
              </button>
            )}

            {/* Action 1: Shift Report */}
            <button 
              onClick={() => navigateTo('/shift-reports/cashier')}
              className="group flex flex-col items-center justify-center bg-white/5 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 hover:border-red-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_0_40px_rgba(225,29,72,0.15)] transition-all duration-300 active:scale-[0.96] text-white cursor-pointer relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="h-16 w-16 bg-white/10 text-red-400 rounded-[1.25rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500 group-hover:bg-red-500 group-hover:text-white shadow-inner border border-white/5 z-10">
                <FileText className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl z-10">{lang === "en" ? "Daily Shift Report" : "تقرير الوردية اليومي"}</h3>
              <p className="text-sm text-white/50 mt-2 text-center leading-relaxed max-w-[280px] z-10">
                {lang === "en" ? "Submit your end-of-shift cash and inventory counts." : "إرسال جرد النقدية والمخزون في نهاية الوردية."}
              </p>
            </button>

            {/* Action 2: Voids */}
            <button 
              onClick={() => navigateTo('/voids/cashier')}
              className="group flex flex-col items-center justify-center bg-white/5 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 hover:border-orange-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_0_40px_rgba(249,115,22,0.15)] transition-all duration-300 active:scale-[0.96] text-white cursor-pointer relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="h-16 w-16 bg-white/10 text-orange-400 rounded-[1.25rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500 group-hover:bg-orange-500 group-hover:text-white shadow-inner border border-white/5 z-10">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl z-10">{lang === "en" ? "Log a Void" : "تسجيل مرتجع"}</h3>
              <p className="text-sm text-white/50 mt-2 text-center leading-relaxed max-w-[280px] z-10">
                {lang === "en" ? "Record any cancelled items, voids, or customer returns." : "تسجيل المرتجعات أو العناصر الملغاة."}
              </p>
            </button>

            {/* Action 3: Expiry Tracker */}
            <button 
              onClick={() => navigateTo('/expiries')}
              className="group flex flex-col items-center justify-center bg-white/5 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 hover:border-blue-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] transition-all duration-300 active:scale-[0.96] text-white cursor-pointer relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="h-16 w-16 bg-white/10 text-blue-400 rounded-[1.25rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500 group-hover:bg-blue-500 group-hover:text-white shadow-inner border border-white/5 z-10">
                <CalendarIcon className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl z-10">{lang === "en" ? "Expiry Tracker" : "متابعة تواريخ الصلاحية"}</h3>
              <p className="text-sm text-white/50 mt-2 text-center leading-relaxed max-w-[280px] z-10">
                {lang === "en" ? "Log fresh food deliveries and check for expiring items." : "تسجيل المنتجات الطازجة ومعرفة المنتجات منتهية الصلاحية."}
              </p>
            </button>

            {/* Action: Checklists */}
            <button 
              onClick={() => navigateTo('/checklists/cashier')}
              className="group flex flex-col items-center justify-center bg-white/5 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 hover:border-emerald-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] transition-all duration-300 active:scale-[0.96] text-white cursor-pointer relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="h-16 w-16 bg-white/10 text-emerald-400 rounded-[1.25rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500 group-hover:bg-emerald-500 group-hover:text-white shadow-inner border border-white/5 z-10">
                <FileText className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl z-10">{lang === "en" ? "Checklists" : "قوائم المراجعة"}</h3>
              <p className="text-sm text-white/50 mt-2 text-center leading-relaxed max-w-[280px] z-10">
                {lang === "en" ? "Submit daily inspection and branch checklists." : "إرسال قوائم الفحص والمراجعة اليومية للفرع."}
              </p>
            </button>

            {/* Action 4: My Account */}
            <button 
              onClick={() => navigateTo('/cashier/account')}
              className="group flex flex-col items-center justify-center bg-white/5 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 hover:border-emerald-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] transition-all duration-300 active:scale-[0.96] text-white cursor-pointer relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="h-16 w-16 bg-white/10 text-emerald-400 rounded-[1.25rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500 group-hover:bg-emerald-500 group-hover:text-white shadow-inner border border-white/5 z-10">
                <UserCircle className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl z-10">{lang === "en" ? "My Account" : "حسابي"}</h3>
              <p className="text-sm text-white/50 mt-2 text-center leading-relaxed max-w-[280px] z-10">
                {lang === "en" ? "View your payroll, deductions, bonuses, and details." : "عرض الراتب والخصومات والمكافآت."}
              </p>
            </button>

            {/* Action 5: Schedule & Leaves */}
            <button 
              onClick={() => navigateTo('/cashier/schedule')}
              className="group flex flex-col items-center justify-center bg-white/5 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 hover:border-purple-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_0_40px_rgba(168,85,247,0.15)] transition-all duration-300 active:scale-[0.96] text-white cursor-pointer relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="h-16 w-16 bg-white/10 text-purple-400 rounded-[1.25rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500 group-hover:bg-purple-500 group-hover:text-white shadow-inner border border-white/5 z-10">
                <CalendarIcon className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl z-10">{lang === "en" ? "My Schedule" : "جدول العمل"}</h3>
              <p className="text-sm text-white/50 mt-2 text-center leading-relaxed max-w-[280px] z-10">
                {lang === "en" ? "View your shifts and request days off." : "عرض وردياتك وطلب إجازات."}
              </p>
            </button>
            
            {/* Action 6: Inventory Audit */}
            <button 
              onClick={() => navigateTo('/inventory-audit/cashier')}
              className="group flex flex-col items-center justify-center bg-white/5 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 hover:border-amber-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_0_40px_rgba(245,158,11,0.15)] transition-all duration-300 active:scale-[0.96] text-white cursor-pointer relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="h-16 w-16 bg-white/10 text-amber-400 rounded-[1.25rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500 group-hover:bg-amber-500 group-hover:text-white shadow-inner border border-white/5 z-10">
                <ScanLine className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-xl z-10">{lang === "en" ? "Inventory Count" : "جرد المخزون"}</h3>
              <p className="text-sm text-white/50 mt-2 text-center leading-relaxed max-w-[280px] z-10">
                {lang === "en" ? "Scan items for live blind cycle counting." : "مسح الأصناف لعمليات الجرد العشوائية."}
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
      className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black flex flex-col items-center justify-center pt-8 pb-12 px-4 transition-colors duration-500 text-slate-100 w-full overflow-y-auto" 
      dir={lang === "ar" ? "rtl" : "ltr"}
      onClick={() => getAudioCtx()}
    >
      <div className="w-full max-w-md space-y-6 relative z-10">
        
        {/* Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-red-600/20 blur-[100px] rounded-full pointer-events-none -z-10"></div>

        {/* Header Actions */}
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { playPopSound(); handleEnableNotifications(); }} 
              className={`relative flex items-center gap-1.5 px-3 py-1.5 transition-all rounded-full active:scale-95 border ${
                isNotificationEnabled 
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]" 
                  : "text-white bg-white/10 border-white/10 hover:bg-white/20 animate-pulse shadow-sm"
              }`}
              title={isNotificationEnabled ? (lang === "en" ? "Notifications On" : "الإشعارات مفعلة") : (lang === "en" ? "Enable Notifications" : "تفعيل الإشعارات")}
            >
              <div className="relative">
                <Bell className="h-4 w-4" />
                {isNotificationEnabled && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-slate-900 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">{isNotificationEnabled ? (lang === "en" ? "Alerts On" : "تنبيهات") : (lang === "en" ? "Get Alerts" : "تفعيل")}</span>
            </button>
            {!isInstalled && (
              <button 
                type="button"
                onClick={() => { playPopSound(); handleInstallClick(); }}
                className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:bg-red-500/30 transition-all active:scale-95 text-red-400 uppercase tracking-wider cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> {lang === "en" ? "Install" : "تثبيت"}
              </button>
            )}
          </div>
          <button 
            type="button"
            onClick={() => { playPopSound(); setLang(lang === "en" ? "ar" : "en"); }}
            className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm hover:bg-white/20 transition-all active:scale-95 text-white uppercase tracking-wider cursor-pointer"
          >
            <Globe className="h-3.5 w-3.5" /> {lang === "en" ? "عربي" : "English"}
          </button>
        </div>

        {/* Title */}
        <div className="text-center py-4 mb-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-red-600 to-rose-500 rounded-[2rem] mb-6 shadow-[0_0_30px_rgba(225,29,72,0.4)] rotate-3">
            <UserCircle className="h-10 w-10 text-white animate-pulse" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-md">
            {lang === "en" ? "Staff Login" : "تسجيل الدخول"}
          </h1>
          <p className="text-xs text-red-400 font-bold tracking-[0.2em] mt-3 uppercase">
            {lang === "en" ? "Circle K Franchise" : "بوابة سيركل كي"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-white/5 backdrop-blur-3xl p-6 sm:p-8 rounded-[2.5rem] space-y-6 border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
          
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UserIcon className="h-4 w-4 text-white/40" /> {lang === "en" ? "Employee Name" : "اسم الموظف"}
            </label>
            <div className="relative">
              <div 
                onClick={() => { playPopSound(); setIsDropdownOpen(!isDropdownOpen); }}
                className="w-full p-4.5 py-4 rounded-2xl border border-white/10 bg-white/5 text-white outline-none focus:border-red-500/50 text-base cursor-pointer flex justify-between items-center transition-all hover:bg-white/10 active:scale-[0.98]"
              >
                <span className={!selectedEmployeeId ? "text-white/40 font-medium" : "font-bold text-white"}>
                  {selectedEmployeeId 
                    ? (() => {
                        const c = employees.find(x => x.id === selectedEmployeeId);
                        return c ? c.name : (lang === "en" ? "Select your name" : "اختر اسمك");
                      })()
                    : (lang === "en" ? "Select your name" : "اختر اسمك")}
                </span>
                <ChevronDown className={`h-5 w-5 text-white/40 transition-transform duration-300 ${isDropdownOpen ? "rotate-180" : ""}`} />
              </div>

              {isDropdownOpen && (
                <div className="absolute z-[100] top-full left-0 right-0 mt-3 max-h-64 overflow-y-auto bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {employees.length === 0 ? (
                    <div className="p-5 text-center text-white/50 text-sm font-medium">
                      {lang === "en" ? "No employees found." : "لم يتم العثور على موظفين."}
                    </div>
                  ) : (
                    employees.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => { 
                          playPopSound();
                          setSelectedEmployeeId(c.id); 
                          setIsDropdownOpen(false); 
                          if (localStorage.getItem(`faceid_enabled_${c.id}`) === "true") {
                            loginWithFaceId(c.id);
                          }
                        }}
                        className="p-4.5 py-4 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0 flex flex-col gap-1 transition-colors active:bg-white/20"
                      >
                        <span className="font-bold text-white text-base">{c.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          {c.position && (
                            <span className="text-[9px] font-black text-blue-300 bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              {c.position}
                            </span>
                          )}
                          {(c.storeId || c.branchId) && (
                            <span className="text-[9px] font-black text-white/60 bg-white/10 border border-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
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

          <div className="pt-2">
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-4 flex items-center justify-center gap-1.5">
              <Lock className="h-4 w-4 text-white/40" /> {lang === "en" ? "Enter 4-Digit PIN" : "أدخل الرمز السري"}
            </label>
            <div className="transform transition-transform scale-100 sm:scale-105 origin-top">
              <PinPad 
                onPinChange={(val) => setPinInput(val)}
                onSubmit={(val) => handleLogin(val as any)}
                maxLength={4}
              />
            </div>
            
            {hasFaceIdRegistered && (
              <button
                type="button"
                onClick={() => { playPopSound(); loginWithFaceId(selectedEmployeeId); }}
                className="mt-6 w-full py-4 bg-white/10 text-white rounded-2xl font-bold text-lg hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center gap-3 border border-white/10 shadow-lg"
              >
                <Fingerprint className="h-6 w-6 text-emerald-400" />
                {lang === "en" ? "Use FaceID / TouchID" : "استخدام البصمة"}
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}
