"use client";

import React, { useState, useEffect } from "react";
import { db, messaging, dbService } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { useRouter } from "next/navigation";
import {
  Lock, User as UserIcon, ChevronDown, FileText, Shield,
  Calendar as CalendarIcon, UserCircle, Globe, LogOut,
  Download, Bell, Fingerprint, ScanLine, ChevronRight,
  ClipboardList, Clock, CheckSquare
} from "lucide-react";
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

  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);
  const [hasFaceIdRegistered, setHasFaceIdRegistered] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(true);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true);
      else setIsInstalled(false);
      const handleBIP = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); setIsInstalled(false); };
      window.addEventListener("beforeinstallprompt", handleBIP);
      window.addEventListener("appinstalled", () => { setIsInstalled(true); setDeferredPrompt(null); });
      return () => window.removeEventListener("beforeinstallprompt", handleBIP);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") setIsNotificationEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (selectedEmployeeId)
      setHasFaceIdRegistered(localStorage.getItem(`faceid_enabled_${selectedEmployeeId}`) === "true");
    else setHasFaceIdRegistered(false);
  }, [selectedEmployeeId]);

  const handleInstallClick = async () => {
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIOS) {
      toast.info(lang === "en"
        ? "To install on iOS: Tap 'Share' at the bottom of Safari, then 'Add to Home Screen'."
        : "للتثبيت على iOS: اضغط على أيقونة 'مشاركة' في أسفل سفاري، ثم اضغط على 'إضافة إلى الشاشة الرئيسية'.");
      return;
    }
    if (!deferredPrompt) {
      toast.warning(lang === "en"
        ? "Use browser menu → Add to Home screen."
        : "استخدم قائمة المتصفح → إضافة إلى الشاشة الرئيسية.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") { setDeferredPrompt(null); setIsInstalled(true); }
  };

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) { toast.error("Notifications not supported."); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted" && messaging) {
        const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        const messagingInstance = await messaging;
        if (messagingInstance) {
          const token = await getToken(messagingInstance, {
            vapidKey: "BHiDvLTbQ2DTED8p7X1BQ8Vu811fuu3dmpVfclmA5P7n-DuRltU7kkai9E2_2VkbLpS7Ns5ekNQClP5CsTeWf7M",
            serviceWorkerRegistration: swReg,
          });
          if (token && authenticatedUser) {
            await dbService.setDoc("user_tokens", authenticatedUser.id, {
              fcmToken: token, name: authenticatedUser.name,
              role: authenticatedUser.role || "cashier", updatedAt: new Date().toISOString(),
            });
            setIsNotificationEnabled(true);
            toast.success(lang === "en" ? "Notifications enabled!" : "تم تفعيل الإشعارات!");
          }
        }
      } else toast.error(lang === "en" ? "Permission denied." : "تم رفض الإذن.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (savedUserStr) {
      try {
        setAuthenticatedUser(JSON.parse(savedUserStr));
        setLoading(false);
        return;
      } catch (e) { console.error("Invalid session"); }
    }
    const fetchEmployees = async () => {
      try {
        let activeEmployeesNames: Set<string> | null = null;
        try {
          const empSnap = await getDocs(collection(db, "employees"));
          activeEmployeesNames = new Set(
            empSnap.docs.filter(d => d.data().status === "active").map(d => d.data().name)
          );
        } catch (empErr) { console.warn("Could not fetch employees."); }

        const snap = await getDocs(collection(db, "cashiers"));
        const allCashiers: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        let activeCashiers = allCashiers;
        if (activeEmployeesNames) {
          activeCashiers = allCashiers.filter(c => activeEmployeesNames!.has(c.name));
          for (const c of allCashiers) {
            if (!activeEmployeesNames.has(c.name)) {
              try { await deleteDoc(doc(db, "cashiers", c.id)); } catch {}
            }
          }
        }
        activeCashiers.push({
          id: "master_youssef", employeeId: "master_youssef",
          name: "Mr Youssef (Owner)", pin: "4321", role: "master", storeId: "ALL",
        });
        setEmployees(activeCashiers);
      } catch (e) { console.error("Failed to load cashiers", e); }
      finally { setLoading(false); }
    };
    fetchEmployees();
  }, []);

  const handleLogin = (e: React.FormEvent | string) => {
    if (typeof e !== "string") e.preventDefault();
    if (!selectedEmployeeId) {
      toast.error(lang === "en" ? "Please select your name." : "يرجى اختيار اسمك.");
      return;
    }
    const user = employees.find(x => x.id === selectedEmployeeId);
    if (!user) return;
    const pinToVerify = typeof e === "string" ? e : pinInput;
    if (!user.pin || pinToVerify !== user.pin) {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([50, 50, 50]);
      playErrorSound();
      toast.error(lang === "en" ? "Incorrect PIN" : "الرمز السري غير صحيح");
      setPinInput("");
      return;
    }
    playSuccessSound();
    const sessionData = {
      id: user.id, name: user.name, employeeId: user.employeeId || "",
      storeId: user.storeId || "N/A", branchId: user.branchId || "alamein4",
      role: user.position || user.role || "cashier", loggedInAt: new Date().toISOString(),
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
          challenge, rp: { name: "CK Shift App", id: window.location.hostname },
          user: { id: userId, name: selectedEmployeeId, displayName: selectedEmployeeId },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
          timeout: 60000,
        },
      });
      if (credential) {
        localStorage.setItem(`faceid_enabled_${selectedEmployeeId}`, "true");
        setHasFaceIdRegistered(true);
        toast.success(lang === "en" ? "FaceID / TouchID Enabled!" : "تم تفعيل البصمة!");
        const emp = employees.find(e => e.id === selectedEmployeeId);
        if (emp) handleLogin(emp.pin);
      }
    } catch { toast.error(lang === "en" ? "Biometric failed." : "فشل التحقق."); }
  };

  const loginWithFaceId = async (empId: string) => {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const assertion = await navigator.credentials.get({
        publicKey: { challenge, rpId: window.location.hostname, userVerification: "required" },
      });
      if (assertion) {
        const user = employees.find(x => x.id === empId);
        if (user) {
          playSuccessSound();
          const sessionData = {
            id: user.id, name: user.name,
            role: user.position || user.role || "cashier", loggedInAt: new Date().toISOString(),
          };
          localStorage.setItem("active_cashier_session", JSON.stringify(sessionData));
          setAuthenticatedUser(sessionData);
        }
      }
    } catch (e) { playErrorSound(); console.error(e); }
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

  const isRTL = lang === "ar";

  // ─────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[100dvh] bg-black gap-4">
        <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-red-600 to-rose-500 flex items-center justify-center text-white font-black text-3xl shadow-[0_0_40px_rgba(225,29,72,0.5)] animate-pulse">K</div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-red-500/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // AUTHENTICATED DASHBOARD
  // ─────────────────────────────────────────────────────────
  if (authenticatedUser) {
    const isMaster = authenticatedUser.role === "master";
    const greeting = () => {
      const h = currentTime.getHours();
      if (h < 12) return lang === "en" ? "Good Morning" : "صباح الخير";
      if (h < 18) return lang === "en" ? "Good Afternoon" : "مساء الخير";
      return lang === "en" ? "Good Evening" : "مساء النور";
    };

    const actions = [
      ...(isMaster ? [{
        id: "master",
        label: lang === "en" ? "Master Feed" : "اللوحة الرئيسية",
        sub: lang === "en" ? "Live activity & notifications" : "النشاط المباشر والإشعارات",
        icon: Bell,
        accent: "#ef4444",
        accentBg: "rgba(239,68,68,0.12)",
        path: "/cashier/master",
        badge: "LIVE",
      }] : []),
      {
        id: "shift",
        label: lang === "en" ? "Daily Shift Report" : "تقرير الوردية",
        sub: lang === "en" ? "Submit your end-of-shift counts" : "إرسال جرد نهاية الوردية",
        icon: FileText,
        accent: "#f87171",
        accentBg: "rgba(248,113,113,0.10)",
        path: "/shift-reports/cashier",
      },
      {
        id: "void",
        label: lang === "en" ? "Log a Void" : "تسجيل مرتجع",
        sub: lang === "en" ? "Cancelled items & returns" : "المرتجعات والعناصر الملغاة",
        icon: Shield,
        accent: "#fb923c",
        accentBg: "rgba(251,146,60,0.10)",
        path: "/voids/cashier",
      },
      {
        id: "expiry",
        label: lang === "en" ? "Expiry Tracker" : "تواريخ الصلاحية",
        sub: lang === "en" ? "Log fresh food & check dates" : "تسجيل الطازج ومتابعة الصلاحية",
        icon: CalendarIcon,
        accent: "#60a5fa",
        accentBg: "rgba(96,165,250,0.10)",
        path: "/expiries",
      },
      {
        id: "checklist",
        label: lang === "en" ? "Checklists" : "قوائم المراجعة",
        sub: lang === "en" ? "Daily inspection checklists" : "قوائم الفحص اليومية",
        icon: CheckSquare,
        accent: "#34d399",
        accentBg: "rgba(52,211,153,0.10)",
        path: "/checklists/cashier",
      },
      {
        id: "account",
        label: lang === "en" ? "My Account" : "حسابي",
        sub: lang === "en" ? "Payroll, bonuses & deductions" : "الراتب والمكافآت والخصومات",
        icon: UserCircle,
        accent: "#a78bfa",
        accentBg: "rgba(167,139,250,0.10)",
        path: "/cashier/account",
      },
      {
        id: "schedule",
        label: lang === "en" ? "My Schedule" : "جدول العمل",
        sub: lang === "en" ? "Shifts & leave requests" : "الورديات وطلبات الإجازة",
        icon: ClipboardList,
        accent: "#c084fc",
        accentBg: "rgba(192,132,252,0.10)",
        path: "/cashier/schedule",
      },
      {
        id: "inventory",
        label: lang === "en" ? "Inventory Count" : "جرد المخزون",
        sub: lang === "en" ? "Blind cycle counting" : "عمليات الجرد العشوائية",
        icon: ScanLine,
        accent: "#fbbf24",
        accentBg: "rgba(251,191,36,0.10)",
        path: "/inventory-audit/cashier",
      },
    ];

    return (
      <div
        className="min-h-[100dvh] bg-black text-white flex flex-col overflow-y-auto w-full"
        dir={isRTL ? "rtl" : "ltr"}
        style={{ fontFamily: "'Inter', 'Cairo', system-ui, sans-serif" }}
      >
        {/* ── TOP STATUS BAR ── */}
        <div className="bg-black/80 backdrop-blur-xl border-b border-white/[0.06] px-4 pt-4 pb-3 sticky top-0 z-50">
          <div className="flex items-center justify-between">
            {/* Left: Logo + name */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xl text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #dc2626, #f87171)", boxShadow: "0 0 20px rgba(220,38,38,0.4)" }}
              >K</div>
              <div>
                <div className="text-[11px] text-white/40 font-medium leading-none">
                  {greeting()}
                </div>
                <div className="font-black text-[15px] leading-tight mt-0.5 text-white">{authenticatedUser.name}</div>
              </div>
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { playPopSound(); handleEnableNotifications(); }}
                className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-90 relative"
                style={{ background: isNotificationEnabled ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.07)", border: `1px solid ${isNotificationEnabled ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.1)"}` }}
              >
                <Bell className="w-4 h-4" style={{ color: isNotificationEnabled ? "#34d399" : "#9ca3af" }} />
                {isNotificationEnabled && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-black" />
                )}
              </button>
              <button
                onClick={() => { playPopSound(); setLang(lang === "en" ? "ar" : "en"); }}
                className="h-9 px-3 rounded-2xl text-[11px] font-black text-white/60 transition-all active:scale-90"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {lang === "en" ? "عربي" : "EN"}
              </button>
            </div>
          </div>

          {/* Time & date pill */}
          <div className="mt-3 flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <Clock className="w-3 h-3 text-white/40" />
              <span className="text-white/60 tabular-nums">
                {currentTime.toLocaleTimeString(lang === "en" ? "en-US" : "ar-EG", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-white/20">·</span>
              <span className="text-white/40">
                {currentTime.toLocaleDateString(lang === "en" ? "en-GB" : "ar-EG", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            </div>
            {!isInstalled && (
              <button
                onClick={() => { playPopSound(); handleInstallClick(); }}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold text-red-400 transition-all active:scale-90"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}
              >
                <Download className="w-3 h-3" />
                {lang === "en" ? "Install App" : "تثبيت"}
              </button>
            )}
          </div>
        </div>

        {/* ── FaceID prompt ── */}
        {!hasFaceIdRegistered && typeof window !== "undefined" && window.PublicKeyCredential && (
          <div className="mx-4 mt-4">
            <button
              onClick={() => { playPopSound(); registerFaceId(); }}
              className="w-full py-3.5 rounded-2xl flex items-center gap-3 px-4 transition-all active:scale-[0.98]"
              style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(52,211,153,0.15)" }}>
                <Fingerprint className="w-5 h-5 text-emerald-400" />
              </div>
              <div className={isRTL ? "text-right" : "text-left"}>
                <div className="text-[13px] font-bold text-white">{lang === "en" ? "Enable FaceID / TouchID" : "تفعيل البصمة"}</div>
                <div className="text-[11px] text-white/40 mt-0.5">{lang === "en" ? "Skip PIN next time" : "تجاوز الرقم السري في المرة القادمة"}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-400/50 ms-auto" />
            </button>
          </div>
        )}

        {/* ── ACTION LIST ── */}
        <main className="flex-1 px-4 py-4 space-y-2.5 pb-28">
          <div className="text-[10px] font-black tracking-[0.2em] text-white/20 uppercase mb-3">
            {lang === "en" ? "Quick Actions" : "الإجراءات"}
          </div>

          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => navigateTo(action.path)}
                className="w-full flex items-center gap-4 rounded-2xl px-4 py-4 transition-all active:scale-[0.97] text-left"
                style={{
                  background: action.accentBg,
                  border: `1px solid ${action.accent}22`,
                }}
              >
                {/* Icon */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${action.accent}18`, border: `1px solid ${action.accent}30` }}
                >
                  <Icon className="w-5 h-5" style={{ color: action.accent }} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0" style={{ textAlign: isRTL ? "right" : "left" }}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[15px] text-white leading-tight">{action.label}</span>
                    {action.badge && (
                      <span
                        className="text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: `${action.accent}25`, color: action.accent, border: `1px solid ${action.accent}40` }}
                      >
                        {action.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-white/40 mt-0.5 leading-tight">{action.sub}</div>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: `${action.accent}60` }} />
              </button>
            );
          })}
        </main>

        {/* ── BOTTOM BAR ── */}
        <div
          className="fixed bottom-0 left-0 right-0 px-4 pb-safe-area-inset-bottom"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.98) 70%, transparent)",
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          }}
        >
          <div className="flex items-center gap-3 pt-4">
            <div
              className="flex-1 text-center py-1"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="text-[10px] text-white/20 font-medium">
                {lang === "en" ? "Logged in as" : "مسجل دخول بحساب"}
              </div>
              <div className="text-[12px] font-bold text-white/50 mt-0.5">{authenticatedUser.name}</div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 py-3 px-5 rounded-2xl font-bold text-[13px] transition-all active:scale-95"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
            >
              <LogOut className="w-4 h-4" />
              {lang === "en" ? "Sign Out" : "خروج"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // LOGIN SCREEN
  // ─────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-[100dvh] bg-black text-white flex flex-col overflow-y-auto w-full"
      dir={isRTL ? "rtl" : "ltr"}
      style={{ fontFamily: "'Inter', 'Cairo', system-ui, sans-serif" }}
      onClick={() => getAudioCtx()}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-safe-area-inset-top pt-4 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { playPopSound(); handleEnableNotifications(); }}
            className="flex items-center gap-1.5 py-2 px-3 rounded-full text-[11px] font-bold transition-all active:scale-95 relative"
            style={{
              background: isNotificationEnabled ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${isNotificationEnabled ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.1)"}`,
              color: isNotificationEnabled ? "#34d399" : "#9ca3af",
            }}
          >
            <Bell className="w-3.5 h-3.5" />
            {isNotificationEnabled ? (lang === "en" ? "On" : "مفعل") : (lang === "en" ? "Alerts" : "تنبيه")}
            {isNotificationEnabled && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-black" />
            )}
          </button>
          {!isInstalled && (
            <button
              onClick={() => { playPopSound(); handleInstallClick(); }}
              className="flex items-center gap-1.5 py-2 px-3 rounded-full text-[11px] font-bold transition-all active:scale-95"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
            >
              <Download className="w-3.5 h-3.5" />
              {lang === "en" ? "Install" : "تثبيت"}
            </button>
          )}
        </div>
        <button
          onClick={() => { playPopSound(); setLang(lang === "en" ? "ar" : "en"); }}
          className="flex items-center gap-1.5 py-2 px-3 rounded-full text-[11px] font-bold transition-all active:scale-95"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}
        >
          <Globe className="w-3.5 h-3.5" />
          {lang === "en" ? "عربي" : "EN"}
        </button>
      </div>

      {/* Hero identity block */}
      <div className="flex flex-col items-center px-6 pt-6 pb-4">
        <div
          className="w-20 h-20 rounded-[1.75rem] flex items-center justify-center text-white font-black text-4xl mb-5 select-none"
          style={{
            background: "linear-gradient(135deg, #b91c1c, #ef4444)",
            boxShadow: "0 0 0 1px rgba(239,68,68,0.3), 0 20px 60px rgba(185,28,28,0.5), 0 0 0 8px rgba(239,68,68,0.06)",
          }}
        >
          K
        </div>
        <h1 className="text-[28px] font-black tracking-tight text-white">
          {lang === "en" ? "Staff Login" : "تسجيل الدخول"}
        </h1>
        <p className="text-[12px] font-bold tracking-[0.2em] uppercase mt-1.5" style={{ color: "#ef4444" }}>
          {lang === "en" ? "Circle K Franchise" : "بوابة سيركل كي"}
        </p>
      </div>

      {/* Form card */}
      <div className="flex-1 mx-4 mb-6">
        <form
          onSubmit={handleLogin}
          className="rounded-[2rem] overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.035)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          }}
        >
          {/* ── Name selector ── */}
          <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
              <UserIcon className="w-3.5 h-3.5" />
              {lang === "en" ? "Your Name" : "اسمك"}
            </label>
            <div className="relative">
              <div
                onClick={() => { playPopSound(); setIsDropdownOpen(!isDropdownOpen); }}
                className="w-full py-3.5 px-4 rounded-xl flex justify-between items-center cursor-pointer transition-all active:scale-[0.98]"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${isDropdownOpen ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                }}
              >
                <span className={`text-[15px] font-bold ${!selectedEmployeeId ? "text-white/30" : "text-white"}`}>
                  {selectedEmployeeId
                    ? employees.find(x => x.id === selectedEmployeeId)?.name || (lang === "en" ? "Select name" : "اختر الاسم")
                    : (lang === "en" ? "Select your name" : "اختر اسمك")}
                </span>
                <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} style={{ color: "rgba(255,255,255,0.3)" }} />
              </div>

              {isDropdownOpen && (
                <div
                  className="absolute z-[100] top-full mt-2 left-0 right-0 max-h-56 overflow-y-auto rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
                  style={{
                    background: "rgba(10,10,10,0.97)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                    backdropFilter: "blur(20px)",
                  }}
                >
                  {employees.length === 0 ? (
                    <div className="p-5 text-center text-white/40 text-sm">
                      {lang === "en" ? "No employees found." : "لا يوجد موظفون."}
                    </div>
                  ) : employees.map((c, idx) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        playPopSound();
                        setSelectedEmployeeId(c.id);
                        setIsDropdownOpen(false);
                        if (localStorage.getItem(`faceid_enabled_${c.id}`) === "true") loginWithFaceId(c.id);
                      }}
                      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors active:bg-white/10"
                      style={{
                        borderBottom: idx < employees.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-[13px] font-black flex-shrink-0"
                        style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[14px] font-bold text-white">{c.name}</div>
                        {c.position && (
                          <div className="text-[10px] font-bold mt-0.5 uppercase tracking-wider" style={{ color: "#60a5fa" }}>{c.position}</div>
                        )}
                      </div>
                      {localStorage.getItem(`faceid_enabled_${c.id}`) === "true" && (
                        <Fingerprint className="w-4 h-4 ms-auto text-emerald-400/60 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── PIN pad ── */}
          <div className="px-5 pt-5 pb-6">
            <label className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
              <Lock className="w-3.5 h-3.5" />
              {lang === "en" ? "4-Digit PIN" : "الرمز السري"}
            </label>

            <PinPad
              onPinChange={(val) => setPinInput(val)}
              onSubmit={(val) => handleLogin(val as any)}
              maxLength={4}
            />

            {hasFaceIdRegistered && (
              <button
                type="button"
                onClick={() => { playPopSound(); loginWithFaceId(selectedEmployeeId); }}
                className="mt-5 w-full py-4 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-3 transition-all active:scale-95"
                style={{
                  background: "rgba(52,211,153,0.08)",
                  border: "1px solid rgba(52,211,153,0.2)",
                  color: "#34d399",
                }}
              >
                <Fingerprint className="w-5 h-5" />
                {lang === "en" ? "Use FaceID / TouchID" : "استخدام البصمة"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
