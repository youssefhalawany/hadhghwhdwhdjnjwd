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

// ── Forced-dark design tokens ──────────────────────────────
const D = {
  bg:           "#09090b",        // page background (zinc-950)
  surface:      "#111113",        // card / section
  surfaceHigh:  "#18181b",        // elevated surface
  border:       "rgba(255,255,255,0.08)",
  borderMid:    "rgba(255,255,255,0.13)",
  red:          "#ef4444",
  redDim:       "rgba(239,68,68,0.15)",
  redBorder:    "rgba(239,68,68,0.30)",
  textPrimary:  "#f4f4f5",        // zinc-100
  textSecondary:"#a1a1aa",        // zinc-400
  textDim:      "#52525b",        // zinc-600
  green:        "#34d399",
  greenDim:     "rgba(52,211,153,0.12)",
  greenBorder:  "rgba(52,211,153,0.25)",
};

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
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true);
      else setIsInstalled(false);
      const h = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); setIsInstalled(false); };
      window.addEventListener("beforeinstallprompt", h);
      window.addEventListener("appinstalled", () => { setIsInstalled(true); setDeferredPrompt(null); });
      return () => window.removeEventListener("beforeinstallprompt", h);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window)
      if (Notification.permission === "granted") setIsNotificationEnabled(true);
  }, []);

  useEffect(() => {
    if (selectedEmployeeId)
      setHasFaceIdRegistered(localStorage.getItem(`faceid_enabled_${selectedEmployeeId}`) === "true");
    else setHasFaceIdRegistered(false);
  }, [selectedEmployeeId]);

  const handleInstallClick = async () => {
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    if (isIOS) { toast.info("Tap 'Share' → 'Add to Home Screen' in Safari."); return; }
    if (!deferredPrompt) { toast.warning("Use browser menu → Add to Home screen."); return; }
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
        const mi = await messaging;
        if (mi) {
          const token = await getToken(mi, {
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
    } catch (err: any) { toast.error(err.message); }
  };

  useEffect(() => {
    const saved = localStorage.getItem("active_cashier_session");
    if (saved) {
      try { setAuthenticatedUser(JSON.parse(saved)); setLoading(false); return; }
      catch { console.error("Bad session"); }
    }
    (async () => {
      try {
        let activeNames: Set<string> | null = null;
        try {
          const s = await getDocs(collection(db, "employees"));
          activeNames = new Set(s.docs.filter(d => d.data().status === "active").map(d => d.data().name));
        } catch {}
        const snap = await getDocs(collection(db, "cashiers"));
        let list: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (activeNames) {
          list = list.filter(c => activeNames!.has(c.name));
          for (const c of snap.docs.map(d => ({ id: d.id, ...d.data() })))
            if (!activeNames.has((c as any).name)) try { await deleteDoc(doc(db, "cashiers", (c as any).id)); } catch {}
        }
        list.push({ id: "master_youssef", employeeId: "master_youssef", name: "Mr Youssef (Owner)", pin: "4321", role: "master", storeId: "ALL" });
        setEmployees(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleLogin = (e: React.FormEvent | string) => {
    if (typeof e !== "string") e.preventDefault();
    if (!selectedEmployeeId) { toast.error(lang === "en" ? "Select your name first." : "اختر اسمك أولاً."); return; }
    const user = employees.find(x => x.id === selectedEmployeeId);
    if (!user) return;
    const pin = typeof e === "string" ? e : pinInput;
    if (!user.pin || pin !== user.pin) {
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      playErrorSound();
      toast.error(lang === "en" ? "Incorrect PIN" : "الرمز السري غير صحيح");
      setPinInput(""); return;
    }
    playSuccessSound();
    const session = { id: user.id, name: user.name, employeeId: user.employeeId || "", storeId: user.storeId || "N/A", branchId: user.branchId || "alamein4", role: user.position || user.role || "cashier", loggedInAt: new Date().toISOString() };
    localStorage.setItem("active_cashier_session", JSON.stringify(session));
    setPinInput("");
    setAuthenticatedUser(session);
  };

  const registerFaceId = async () => {
    if (!window.PublicKeyCredential) return;
    try {
      const challenge = new Uint8Array(32); window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16); window.crypto.getRandomValues(userId);
      const cred = await navigator.credentials.create({ publicKey: { challenge, rp: { name: "CK Shift App", id: window.location.hostname }, user: { id: userId, name: selectedEmployeeId, displayName: selectedEmployeeId }, pubKeyCredParams: [{ alg: -7, type: "public-key" }], authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" }, timeout: 60000 } });
      if (cred) {
        localStorage.setItem(`faceid_enabled_${selectedEmployeeId}`, "true");
        setHasFaceIdRegistered(true);
        toast.success(lang === "en" ? "FaceID / TouchID Enabled!" : "تم تفعيل البصمة!");
        const emp = employees.find(e => e.id === selectedEmployeeId);
        if (emp) handleLogin(emp.pin);
      }
    } catch { toast.error("Biometric failed."); }
  };

  const loginWithFaceId = async (empId: string) => {
    try {
      const challenge = new Uint8Array(32); window.crypto.getRandomValues(challenge);
      const assert = await navigator.credentials.get({ publicKey: { challenge, rpId: window.location.hostname, userVerification: "required" } });
      if (assert) {
        const user = employees.find(x => x.id === empId);
        if (user) {
          playSuccessSound();
          const session = { id: user.id, name: user.name, role: user.position || user.role || "cashier", loggedInAt: new Date().toISOString() };
          localStorage.setItem("active_cashier_session", JSON.stringify(session));
          setAuthenticatedUser(session);
        }
      }
    } catch { playErrorSound(); }
  };

  const handleLogout = () => {
    playPopSound();
    localStorage.removeItem("active_cashier_session");
    setAuthenticatedUser(null); setSelectedEmployeeId(""); setPinInput("");
  };

  const nav = (path: string) => { playPopSound(); router.push(path); };
  const isRTL = lang === "ar";

  // Root forced-dark wrapper style
  const rootStyle: React.CSSProperties = {
    backgroundColor: D.bg,
    color: D.textPrimary,
    colorScheme: "dark",
    fontFamily: "'Inter', 'Cairo', -apple-system, system-ui, sans-serif",
    minHeight: "100dvh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  };

  // ─── LOADING ──────────────────────────────────────────────
  if (loading) return (
    <div style={{ ...rootStyle, alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,#b91c1c,#ef4444)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 900, color: "#fff", boxShadow: "0 0 40px rgba(239,68,68,0.45)" }}>K</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: D.red, opacity: 0.6, animation: `bounce 1s ${i*0.15}s infinite` }} />
        ))}
      </div>
    </div>
  );

  // ─── AUTHENTICATED DASHBOARD ──────────────────────────────
  if (authenticatedUser) {
    const isMaster = authenticatedUser.role === "master";
    const h = currentTime.getHours();
    const greeting = lang === "en"
      ? (h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening")
      : (h < 12 ? "صباح الخير" : h < 18 ? "مساء الخير" : "مساء النور");

    const actions = [
      ...(isMaster ? [{ id: "master", label: lang === "en" ? "Master Feed" : "اللوحة الرئيسية", sub: lang === "en" ? "Live activity & global notifications" : "النشاط المباشر والإشعارات", icon: Bell, accent: "#f87171", dimBg: "rgba(248,113,113,0.08)", dimBorder: "rgba(248,113,113,0.18)", path: "/cashier/master", badge: "LIVE" }] : []),
      { id: "shift",     label: lang === "en" ? "Daily Shift Report"  : "تقرير الوردية",          sub: lang === "en" ? "Submit end-of-shift counts"           : "إرسال جرد نهاية الوردية",          icon: FileText,     accent: "#f87171", dimBg: "rgba(248,113,113,0.06)",  dimBorder: "rgba(248,113,113,0.14)", path: "/shift-reports/cashier" },
      { id: "void",      label: lang === "en" ? "Log a Void"          : "تسجيل مرتجع",            sub: lang === "en" ? "Cancelled items & returns"            : "المرتجعات والعناصر الملغاة",        icon: Shield,       accent: "#fb923c", dimBg: "rgba(251,146,60,0.06)",  dimBorder: "rgba(251,146,60,0.14)", path: "/voids/cashier" },
      { id: "expiry",    label: lang === "en" ? "Expiry Tracker"      : "تواريخ الصلاحية",         sub: lang === "en" ? "Log fresh food & check dates"         : "تسجيل الطازج ومتابعة الصلاحية",    icon: CalendarIcon, accent: "#60a5fa", dimBg: "rgba(96,165,250,0.06)", dimBorder: "rgba(96,165,250,0.14)", path: "/expiries" },
      { id: "checklist", label: lang === "en" ? "Checklists"          : "قوائم المراجعة",          sub: lang === "en" ? "Daily inspection checklists"          : "قوائم الفحص اليومية",               icon: CheckSquare,  accent: "#34d399", dimBg: "rgba(52,211,153,0.06)", dimBorder: "rgba(52,211,153,0.14)", path: "/checklists/cashier" },
      { id: "account",   label: lang === "en" ? "My Account"          : "حسابي",                   sub: lang === "en" ? "Payroll, bonuses & deductions"        : "الراتب والمكافآت والخصومات",        icon: UserCircle,   accent: "#a78bfa", dimBg: "rgba(167,139,250,0.06)",dimBorder: "rgba(167,139,250,0.14)", path: "/cashier/account" },
      { id: "schedule",  label: lang === "en" ? "My Schedule"         : "جدول العمل",              sub: lang === "en" ? "Shifts & leave requests"              : "الورديات وطلبات الإجازة",            icon: ClipboardList,accent: "#c084fc", dimBg: "rgba(192,132,252,0.06)",dimBorder: "rgba(192,132,252,0.14)", path: "/cashier/schedule" },
      { id: "inventory", label: lang === "en" ? "Inventory Count"     : "جرد المخزون",             sub: lang === "en" ? "Blind cycle counting"                 : "عمليات الجرد العشوائية",            icon: ScanLine,     accent: "#fbbf24", dimBg: "rgba(251,191,36,0.06)", dimBorder: "rgba(251,191,36,0.14)", path: "/inventory-audit/cashier" },
    ] as any[];

    return (
      <div style={{ ...rootStyle, direction: isRTL ? "rtl" : "ltr" }}>
        {/* force dark on pinpad + any child that might flip */}
        <style>{`
          .ck-cashier * { color-scheme: dark !important; }
          .ck-pinpad button { background-color: #27272a !important; color: #f4f4f5 !important; border-color: rgba(255,255,255,0.08) !important; }
          .ck-pinpad button:active { background-color: #3f3f46 !important; }
        `}</style>

        {/* ── HEADER ── */}
        <div style={{ backgroundColor: D.surface, borderBottom: `1px solid ${D.border}`, padding: "16px 16px 12px", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(20px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Left: Avatar + Name */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: "linear-gradient(135deg,#b91c1c,#ef4444)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, color: "#fff", flexShrink: 0, boxShadow: "0 0 16px rgba(239,68,68,0.35)" }}>K</div>
              <div>
                <div style={{ fontSize: 11, color: D.textDim, fontWeight: 600, lineHeight: 1 }}>{greeting}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: D.textPrimary, lineHeight: 1.2, marginTop: 2 }}>{authenticatedUser.name}</div>
              </div>
            </div>
            {/* Right: Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => { playPopSound(); handleEnableNotifications(); }} style={{ width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: isNotificationEnabled ? D.greenDim : D.surfaceHigh, border: `1px solid ${isNotificationEnabled ? D.greenBorder : D.border}`, cursor: "pointer", position: "relative", flexShrink: 0 }}>
                <Bell size={16} color={isNotificationEnabled ? D.green : D.textSecondary} />
                {isNotificationEnabled && <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", backgroundColor: D.green, border: `2px solid ${D.surface}` }} />}
              </button>
              <button onClick={() => { playPopSound(); setLang(lang === "en" ? "ar" : "en"); }} style={{ height: 38, padding: "0 14px", borderRadius: 12, background: D.surfaceHigh, border: `1px solid ${D.border}`, color: D.textSecondary, fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}>{lang === "en" ? "عربي" : "EN"}</button>
            </div>
          </div>

          {/* Time + date row */}
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, background: D.surfaceHigh, border: `1px solid ${D.border}` }}>
              <Clock size={12} color={D.textDim} />
              <span style={{ fontSize: 12, fontWeight: 700, color: D.textSecondary, fontVariantNumeric: "tabular-nums" }}>
                {currentTime.toLocaleTimeString(lang === "en" ? "en-US" : "ar-EG", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span style={{ color: D.textDim }}>·</span>
              <span style={{ fontSize: 12, color: D.textDim, fontWeight: 500 }}>
                {currentTime.toLocaleDateString(lang === "en" ? "en-GB" : "ar-EG", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            </div>
            {!isInstalled && (
              <button onClick={() => { playPopSound(); handleInstallClick(); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 999, background: D.redDim, border: `1px solid ${D.redBorder}`, color: D.red, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                <Download size={12} color={D.red} />
                {lang === "en" ? "Install" : "تثبيت"}
              </button>
            )}
          </div>
        </div>

        {/* FaceID prompt */}
        {!hasFaceIdRegistered && typeof window !== "undefined" && window.PublicKeyCredential && (
          <div style={{ padding: "12px 16px 0" }}>
            <button onClick={() => { playPopSound(); registerFaceId(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, background: D.greenDim, border: `1px solid ${D.greenBorder}`, cursor: "pointer", textAlign: isRTL ? "right" : "left" }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(52,211,153,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Fingerprint size={18} color={D.green} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary }}>{lang === "en" ? "Enable FaceID / TouchID" : "تفعيل البصمة"}</div>
                <div style={{ fontSize: 11, color: D.textSecondary, marginTop: 2 }}>{lang === "en" ? "Skip PIN on next login" : "تجاوز الرمز في المرة القادمة"}</div>
              </div>
              <ChevronRight size={16} color="rgba(52,211,153,0.4)" />
            </button>
          </div>
        )}

        {/* ── ACTION LIST ── */}
        <main style={{ flex: 1, padding: "16px 16px 120px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", color: D.textDim, textTransform: "uppercase", marginBottom: 12 }}>
            {lang === "en" ? "Quick Actions" : "الإجراءات"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {actions.map((a: any) => {
              const Icon = a.icon;
              return (
                <button key={a.id} onClick={() => nav(a.path)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 18, background: a.dimBg, border: `1px solid ${a.dimBorder}`, cursor: "pointer", textAlign: isRTL ? "right" : "left", transition: "opacity 0.1s" }} onMouseDown={e => (e.currentTarget.style.opacity = "0.75")} onMouseUp={e => (e.currentTarget.style.opacity = "1")} onTouchStart={e => (e.currentTarget.style.opacity = "0.75")} onTouchEnd={e => (e.currentTarget.style.opacity = "1")}>
                  {/* Icon */}
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: `${a.accent}18`, border: `1px solid ${a.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={20} color={a.accent} />
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: D.textPrimary, lineHeight: 1.2 }}>{a.label}</span>
                      {a.badge && (
                        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", padding: "2px 6px", borderRadius: 999, background: `${a.accent}20`, color: a.accent, border: `1px solid ${a.accent}35`, textTransform: "uppercase" }}>{a.badge}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: D.textSecondary, lineHeight: 1.35 }}>{a.sub}</div>
                  </div>
                  <ChevronRight size={16} color={`${a.accent}50`} style={{ flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </main>

        {/* ── BOTTOM BAR ── */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: `linear-gradient(to top, ${D.bg} 55%, transparent)`, padding: "20px 16px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 12, borderTop: `1px solid ${D.border}` }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 10, color: D.textDim, fontWeight: 600 }}>{lang === "en" ? "Signed in as" : "مسجل دخول"}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: D.textSecondary, marginTop: 1 }}>{authenticatedUser.name}</span>
            </div>
            <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 14, background: D.redDim, border: `1px solid ${D.redBorder}`, color: D.red, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              <LogOut size={16} color={D.red} />
              {lang === "en" ? "Sign Out" : "خروج"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── LOGIN SCREEN ─────────────────────────────────────────
  return (
    <div style={{ ...rootStyle, direction: isRTL ? "rtl" : "ltr", alignItems: "stretch" }} onClick={() => getAudioCtx()}>
      <style>{`
        .ck-cashier * { color-scheme: dark !important; }
        .ck-pinpad button { background-color: #27272a !important; color: #f4f4f5 !important; border-color: rgba(255,255,255,0.1) !important; }
        .ck-pinpad button:active { background-color: #3f3f46 !important; }
      `}</style>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => { playPopSound(); handleEnableNotifications(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, background: isNotificationEnabled ? D.greenDim : D.surfaceHigh, border: `1px solid ${isNotificationEnabled ? D.greenBorder : D.border}`, color: isNotificationEnabled ? D.green : D.textSecondary, fontSize: 11, fontWeight: 700, cursor: "pointer", position: "relative" }}>
            <Bell size={13} color={isNotificationEnabled ? D.green : D.textSecondary} />
            {isNotificationEnabled ? (lang === "en" ? "On" : "مفعل") : (lang === "en" ? "Alerts" : "تنبيه")}
            {isNotificationEnabled && <span style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: "50%", backgroundColor: D.green, border: `2px solid ${D.bg}` }} />}
          </button>
          {!isInstalled && (
            <button onClick={() => { playPopSound(); handleInstallClick(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, background: D.redDim, border: `1px solid ${D.redBorder}`, color: D.red, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              <Download size={13} color={D.red} />
              {lang === "en" ? "Install" : "تثبيت"}
            </button>
          )}
        </div>
        <button onClick={() => { playPopSound(); setLang(lang === "en" ? "ar" : "en"); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, background: D.surfaceHigh, border: `1px solid ${D.border}`, color: D.textSecondary, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          <Globe size={13} color={D.textSecondary} />
          {lang === "en" ? "عربي" : "EN"}
        </button>
      </div>

      {/* Hero */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 24px 16px" }}>
        <div style={{ width: 80, height: 80, borderRadius: 26, background: "linear-gradient(135deg,#991b1b,#ef4444)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 900, color: "#fff", marginBottom: 20, boxShadow: "0 0 0 1px rgba(239,68,68,0.25), 0 0 0 10px rgba(239,68,68,0.07), 0 20px 50px rgba(185,28,28,0.45)" }}>K</div>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: D.textPrimary, margin: 0, letterSpacing: "-0.5px" }}>{lang === "en" ? "Staff Login" : "تسجيل الدخول"}</h1>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: D.red, margin: "8px 0 0", textTransform: "uppercase" }}>{lang === "en" ? "Circle K Franchise" : "بوابة سيركل كي"}</p>
      </div>

      {/* Form card */}
      <div style={{ flex: 1, margin: "0 16px 32px" }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: D.surface, borderRadius: 28, border: `1px solid ${D.border}`, boxShadow: "0 30px 80px rgba(0,0,0,0.6)", overflow: "hidden" }}>

          {/* Name section */}
          <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${D.border}` }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", color: D.textDim, textTransform: "uppercase", marginBottom: 12 }}>
              <UserIcon size={12} color={D.textDim} />
              {lang === "en" ? "Your Name" : "اسمك"}
            </label>
            <div style={{ position: "relative" }}>
              <div onClick={() => { playPopSound(); setIsDropdownOpen(!isDropdownOpen); }} style={{ width: "100%", padding: "13px 16px", borderRadius: 14, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", backgroundColor: D.surfaceHigh, border: `1px solid ${isDropdownOpen ? "rgba(239,68,68,0.5)" : D.borderMid}`, boxSizing: "border-box" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: selectedEmployeeId ? D.textPrimary : D.textDim }}>
                  {selectedEmployeeId ? employees.find(x => x.id === selectedEmployeeId)?.name || (lang === "en" ? "Select your name" : "اختر اسمك") : (lang === "en" ? "Select your name" : "اختر اسمك")}
                </span>
                <ChevronDown size={18} color={D.textDim} style={{ transform: isDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </div>
              {isDropdownOpen && (
                <div style={{ position: "absolute", zIndex: 100, top: "calc(100% + 8px)", left: 0, right: 0, maxHeight: 220, overflowY: "auto", borderRadius: 16, backgroundColor: "#09090b", border: `1px solid ${D.borderMid}`, boxShadow: "0 20px 60px rgba(0,0,0,0.85)" }}>
                  {employees.length === 0
                    ? <div style={{ padding: 20, textAlign: "center", color: D.textDim, fontSize: 14 }}>{lang === "en" ? "No employees found." : "لا يوجد موظفون."}</div>
                    : employees.map((c, idx) => (
                      <div key={c.id} onClick={() => { playPopSound(); setSelectedEmployeeId(c.id); setIsDropdownOpen(false); if (localStorage.getItem(`faceid_enabled_${c.id}`) === "true") loginWithFaceId(c.id); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", cursor: "pointer", borderBottom: idx < employees.length - 1 ? `1px solid ${D.border}` : "none" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 12, background: D.redDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: D.red, flexShrink: 0 }}>{c.name.charAt(0).toUpperCase()}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary }}>{c.name}</div>
                          {c.position && <div style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa", marginTop: 2, letterSpacing: "0.1em", textTransform: "uppercase" }}>{c.position}</div>}
                        </div>
                        {localStorage.getItem(`faceid_enabled_${c.id}`) === "true" && <Fingerprint size={16} color={D.green} style={{ opacity: 0.6, flexShrink: 0 }} />}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* PIN section */}
          <div style={{ padding: "20px 20px 24px" }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", color: D.textDim, textTransform: "uppercase", marginBottom: 20 }}>
              <Lock size={12} color={D.textDim} />
              {lang === "en" ? "Enter 4-Digit PIN" : "أدخل الرمز السري"}
            </label>
            <div className="ck-pinpad">
              <PinPad onPinChange={(val) => setPinInput(val)} onSubmit={(val) => handleLogin(val as any)} maxLength={4} />
            </div>
            {hasFaceIdRegistered && (
              <button type="button" onClick={() => { playPopSound(); loginWithFaceId(selectedEmployeeId); }} style={{ marginTop: 16, width: "100%", padding: "14px 20px", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: D.greenDim, border: `1px solid ${D.greenBorder}`, color: D.green, fontSize: 15, fontWeight: 700, cursor: "pointer", boxSizing: "border-box" }}>
                <Fingerprint size={20} color={D.green} />
                {lang === "en" ? "Use FaceID / TouchID" : "استخدام البصمة"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
