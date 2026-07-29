"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Zap,
  Plus,
  PackageCheck,
  Bot,
  X,
  Wallet,
  Clock,
  FileCheck2,
  PackageX,
  CreditCard,
  Search,
  Camera,
  Mic,
  ChevronUp,
  Wifi,
  WifiOff,
  AlertTriangle,
  TrendingUp,
  Users,
  Store
} from "lucide-react";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { useLanguage } from "@/context/LanguageContext";
import { useBranch } from "@/context/BranchContext";
import { playPopSound } from "@/lib/sounds";

interface ManagerBottomNavProps {
  pendingShiftsCount?: number;
  pendingVoidsCount?: number;
  pendingExpiriesCount?: number;
}

export function ManagerBottomNav({
  pendingShiftsCount = 0,
  pendingVoidsCount = 0,
  pendingExpiriesCount = 0,
}: ManagerBottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useLanguage();
  const { currentBranch } = useBranch();
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState("overview");
  const [fabOpen, setFabOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const totalPending = pendingShiftsCount + pendingVoidsCount + pendingExpiriesCount;

  // Track online/offline network state for PWA IndexedDB status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update active tab based on current pathname
  useEffect(() => {
    if (pathname === "/" || pathname === "/owner") setActiveTab("overview");
    else if (pathname.includes("/shift-reports/manager") || pathname.includes("/voids/manager")) setActiveTab("approvals");
    else if (pathname.includes("/expiries") || pathname.includes("/checklists") || pathname.includes("/inventory-audit")) setActiveTab("floor");
    else if (pathname.includes("/ai-assistant")) setActiveTab("ai");
  }, [pathname]);

  const handleNavClick = (tabId: string, path: string) => {
    triggerHapticFeedback(12);
    playPopSound();
    setActiveTab(tabId);
    setFabOpen(false);
    setStatusSheetOpen(false);
    router.push(path);
  };

  const toggleFab = () => {
    triggerHapticFeedback(fabOpen ? 15 : [20, 30, 20]);
    playPopSound();
    setFabOpen(!fabOpen);
    if (statusSheetOpen) setStatusSheetOpen(false);
  };

  const toggleStatusSheet = () => {
    triggerHapticFeedback(10);
    playPopSound();
    setStatusSheetOpen(!statusSheetOpen);
    if (fabOpen) setFabOpen(false);
  };

  // 8 Tools inside the Quick Action Drawer
  const QUICK_ACTIONS = [
    {
      id: "payments",
      titleEn: "Payments",
      titleAr: "المدفوعات",
      subtitleEn: "Log vendor payment",
      subtitleAr: "تسجيل مدفوعات الموردين",
      icon: Wallet,
      color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
      path: "/financials/inputs/payments",
    },
    {
      id: "expiries",
      titleEn: "Expiries Log",
      titleAr: "سجل الصلاحيات",
      subtitleEn: "Log near-expiry shelf items",
      subtitleAr: "تسجيل المنتجات قريبة الانتهاء",
      icon: Clock,
      color: "bg-amber-500/15 text-amber-500 border-amber-500/20",
      path: "/expiries",
    },
    {
      id: "shift-audit",
      titleEn: "Shift Audit",
      titleAr: "مراجعة الورديات",
      subtitleEn: "Reconcile cash & safe drops",
      subtitleAr: "تدقيق السلف واغلاق الخزينة",
      icon: FileCheck2,
      color: "bg-sky-500/15 text-sky-500 border-sky-500/20",
      path: "/shift-reports/manager",
    },
    {
      id: "voids",
      titleEn: "Voids / Returns",
      titleAr: "إلغاءات المبيعات",
      subtitleEn: "Approve POS item returns",
      subtitleAr: "اعتماد مرتجعات ورجوع الاصناف",
      icon: PackageX,
      color: "bg-rose-500/15 text-rose-500 border-rose-500/20",
      path: "/voids/manager",
    },
    {
      id: "credits",
      titleEn: "Credits Input",
      titleAr: "تسجيل الذمم",
      subtitleEn: "Record vendor credit notes",
      subtitleAr: "إدخال كشوفات الآجل والموردين",
      icon: CreditCard,
      color: "bg-purple-500/15 text-purple-500 border-purple-500/20",
      path: "/financials/inputs/credits",
    },
    {
      id: "lookup",
      titleEn: "Product Search",
      titleAr: "البحث عن صنف",
      subtitleEn: "Rapid price & SKU check",
      subtitleAr: "استعلام الأسعار والباركود",
      icon: Search,
      color: "bg-indigo-500/15 text-indigo-500 border-indigo-500/20",
      path: "/cashier/lookup",
    },
    {
      id: "scan",
      titleEn: "Scan Invoice",
      titleAr: "مسح الفاتورة",
      subtitleEn: "Camera receipt & PO OCR",
      subtitleAr: "مسح ضوئي للفواتير بالكاميرا",
      icon: Camera,
      color: "bg-red-500/15 text-red-500 border-red-500/20",
      path: "/cashier/upload-invoice/new",
    },
    {
      id: "voice-ai",
      titleEn: "Voice AI Query",
      titleAr: "المساعد الصوتي",
      subtitleEn: "Ask floor AI assistant",
      subtitleAr: "استفسار المساعد الذكي",
      icon: Mic,
      color: "bg-cyan-500/15 text-cyan-500 border-cyan-500/20",
      path: "/ai-assistant",
    },
  ];

  return (
    <>
      {/* 1. Backdrop Overlay for FAB & Quick Sheet */}
      <AnimatePresence>
        {(fabOpen || statusSheetOpen) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setFabOpen(false);
              setStatusSheetOpen(false);
            }}
            className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-md md:hidden"
          />
        )}
      </AnimatePresence>

      {/* 2. Store Status Quick Sheet (Swipe-Up Drawer) */}
      <AnimatePresence>
        {statusSheetOpen && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-24 left-3 right-3 z-50 p-4 rounded-3xl bg-slate-900/95 border border-slate-800 text-white shadow-2xl backdrop-blur-2xl md:hidden"
            dir={isAr ? "rtl" : "ltr"}
          >
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-3 cursor-pointer" onClick={toggleStatusSheet} />
            
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-extrabold flex items-center gap-2 text-slate-100">
                  <Store className="w-4 h-4 text-red-500" />
                  {currentBranch === "all" ? (isAr ? "جميع الفروع" : "All Branches") : currentBranch === "ola" ? "Ola El Koronfol" : "El Alamein 4"}
                </h3>
                <p className="text-xs text-slate-400">
                  {isAr ? "ملخص النشاط والتنبيهات المباشرة" : "Real-time store metrics & floor alerts"}
                </p>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 border border-slate-700">
                {isOnline ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-400">{isAr ? "متصل" : "Online"}</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-amber-400">{isAr ? "محلي offline" : "Offline"}</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" /> {isAr ? "مبيعات اليوم" : "Today Sales"}
                </span>
                <span className="text-base font-extrabold text-white mt-1 block">Live Sync</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <Users className="w-3 h-3 text-sky-400" /> {isAr ? "الورديات المعلقة" : "Pending Shifts"}
                </span>
                <span className="text-base font-extrabold text-sky-400 mt-1 block">{pendingShiftsCount} {isAr ? "وردية" : "Shifts"}</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-amber-400">{isAr ? "التنبيهات الميدانية" : "Floor Alerts"}</p>
                <p className="text-amber-200/80">
                  {totalPending > 0
                    ? isAr
                      ? `يوجد ${totalPending} إجراءات تنتظر اعتماد المدير`
                      : `You have ${totalPending} items pending manager sign-off`
                    : isAr
                    ? "جميع البيانات متزنة ولا يوجد تنبيهات"
                    : "All shifts balanced & clear"}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Center FAB Quick Action Drawer */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-24 left-3 right-3 z-50 p-4 rounded-3xl bg-slate-900/95 border border-slate-800 text-white shadow-2xl backdrop-blur-2xl md:hidden max-h-[70vh] overflow-y-auto"
            dir={isAr ? "rtl" : "ltr"}
          >
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-red-500 fill-red-500" />
                  {isAr ? "مركز أفعال المدير الميدانية" : "Manager Command Hub"}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isAr ? "اختر أداة لإنجاز المهام فوراً" : "Quick floor actions & inputs"}
                </p>
              </div>
              <button
                onClick={toggleFab}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleNavClick(action.id, action.path)}
                    className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 flex items-start gap-3 text-left transition-all active:scale-95 group"
                  >
                    <div className={`p-2.5 rounded-xl border ${action.color} shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-extrabold text-slate-100 group-hover:text-white truncate">
                        {isAr ? action.titleAr : action.titleEn}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {isAr ? action.subtitleAr : action.subtitleEn}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Floating Glass Island Bottom Navigation Bar */}
      <div
        className="fixed bottom-3 left-3 right-3 z-50 md:hidden"
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="relative flex items-center justify-between px-3 py-2 rounded-3xl bg-slate-950/85 border border-slate-800/90 shadow-2xl backdrop-blur-2xl text-slate-400">
          
          {/* Top Swipe-Up Drawer Trigger Handle Pill */}
          <button
            onClick={toggleStatusSheet}
            className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-300 flex items-center gap-1 shadow-md"
          >
            <ChevronUp className={`w-3 h-3 transition-transform ${statusSheetOpen ? "rotate-180" : ""}`} />
            <span>{isAr ? "الحالة المباشرة" : "Live Pulse"}</span>
            {isOnline ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          {/* Left Tab 1: Overview */}
          <button
            onClick={() => handleNavClick("overview", "/owner")}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              activeTab === "overview" ? "text-white font-extrabold" : "hover:text-slate-200"
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === "overview" ? "bg-red-500/20 text-red-500" : ""}`}>
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5">{isAr ? "الرئيسية" : "Overview"}</span>
          </button>

          {/* Left Tab 2: Approvals */}
          <button
            onClick={() => handleNavClick("approvals", "/shift-reports/manager")}
            className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-all ${
              activeTab === "approvals" ? "text-white font-extrabold" : "hover:text-slate-200"
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === "approvals" ? "bg-sky-500/20 text-sky-400" : ""}`}>
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5">{isAr ? "الاعتمادات" : "Approvals"}</span>

            {/* Pulsing Badge */}
            {totalPending > 0 && (
              <span className="absolute top-1 right-3 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-600 text-white shadow-lg animate-pulse border border-rose-400">
                {totalPending}
              </span>
            )}
          </button>

          {/* Center Elevated FAB (Rotates 45° into X when open) */}
          <div className="relative -top-5 flex justify-center flex-1">
            <motion.button
              onClick={toggleFab}
              animate={{ rotate: fabOpen ? 45 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="w-13 h-13 rounded-full bg-gradient-to-tr from-red-600 via-red-500 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 border-2 border-slate-900 active:scale-90"
              style={{ width: "52px", height: "52px" }}
            >
              <Plus className="w-6 h-6 stroke-[3]" />
            </motion.button>
          </div>

          {/* Right Tab 3: Financials */}
          <button
            onClick={() => handleNavClick("financials", "/financial-reports")}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              activeTab === "financials" ? "text-white font-extrabold" : "hover:text-slate-200"
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === "financials" ? "bg-emerald-500/20 text-emerald-400" : ""}`}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5">{isAr ? "التقارير" : "Financials"}</span>
          </button>

          {/* Right Tab 4: AI Assistant */}
          <button
            onClick={() => handleNavClick("ai", "/ai-assistant")}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              activeTab === "ai" ? "text-white font-extrabold" : "hover:text-slate-200"
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === "ai" ? "bg-purple-500/20 text-purple-400" : ""}`}>
              <Bot className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5">{isAr ? "المساعد" : "Ask AI"}</span>
          </button>
        </div>
      </div>
    </>
  );
}
