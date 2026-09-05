"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Wallet, 
  TrendingUp, 
  FileText, 
  Activity, 
  CalendarDays, 
  PackageMinus, 
  Shield, 
  Truck, 
  ClipboardList, 
  Search, 
  ShoppingCart, 
  Sparkles, 
  Package, 
  Tag, 
  Barcode, 
  Users, 
  DollarSign, 
  Clock, 
  Bot, 
  Monitor, 
  Database, 
  Bell, 
  ArrowUpRight, 
  ArrowRight,
  ArrowLeft,
  CheckCircle2, 
  Layers, 
  Store, 
  BadgeCheck, 
  ChevronRight,
  ChevronLeft,
  Sparkle,
  Briefcase,
  Sliders,
  SendHorizontal
} from "lucide-react";
import { useBranch, BRANCHES, BranchId } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";

export default function StartPage() {
  const { currentBranch, setBranch, availableBranches } = useBranch();
  const { language, setLanguage, t } = useLanguage();
  const isAr = language === "ar";
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const branchObj = BRANCHES.find((b) => b.id === currentBranch) || {
    id: "alamein4",
    name: "El Alamein 4",
  };

  const branchDisplayName = isAr
    ? currentBranch === "alamein4"
      ? "مارينا 4 - العلمين"
      : currentBranch === "ola"
      ? "علا - القرنفل"
      : "جميع الفروع"
    : branchObj.name;

  return (
    <div 
      className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 flex flex-col justify-between relative overflow-hidden bg-background text-foreground select-none"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-rose-600/10 dark:bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-emerald-600/10 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-sky-600/10 dark:bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP HERO HEADER */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 mb-6 sm:mb-8"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-card/75 dark:bg-card/40 backdrop-blur-2xl border border-border/80 shadow-xl shadow-black/5">
          {/* Left: Branding & Greeting */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white font-black text-2xl sm:text-3xl shadow-lg shadow-rose-500/30 border border-rose-400/30 flex-shrink-0">
              K
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2 mb-1">
                <span className="text-xs font-black tracking-widest uppercase text-rose-500">
                  Circle K Franchise
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {branchDisplayName}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-foreground tracking-tight">
                {isAr ? "مركز العمليات الموحد" : "Operations Command Center"}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
                {isAr 
                  ? "البوابة المركزية لإدارة الفرع والتقارير والتشغيل اليومي" 
                  : "Central Launchpad for Store Management, Financials & Daily Operations"}
              </p>
            </div>
          </div>

          {/* Right: Real-time clock & Action shortcuts */}
          <div className="flex items-center flex-wrap gap-2.5 lg:justify-end">
            {time && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-muted/70 border border-border text-xs font-bold">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {time.toLocaleDateString(isAr ? "ar-EG" : "en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="w-px h-3 bg-border mx-0.5" />
                <Clock className="w-3.5 h-3.5 text-rose-500" />
                <span className="font-mono font-black text-foreground">
                  {time.toLocaleTimeString(isAr ? "ar-EG" : "en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
            )}

            {/* AI Assistant Button */}
            <Link
              href="/ai-assistant"
              prefetch={true}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-violet-600/15 via-purple-600/15 to-indigo-600/15 border border-purple-500/30 text-purple-600 dark:text-purple-300 font-bold text-xs hover:bg-purple-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm group"
            >
              <Bot className="w-4 h-4 text-purple-500 group-hover:rotate-12 transition-transform" />
              <span>{isAr ? "إبراهيم AI" : "Ibrahim AI"}</span>
            </Link>

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(isAr ? "en" : "ar")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-muted/60 hover:bg-muted border border-border text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title={isAr ? "Switch to English" : "التحويل للعربية"}
            >
              <span className="font-mono">{isAr ? "EN" : "عربي"}</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* BENTO GRID: 5 PILLARS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 relative z-10 flex-1">
        
        {/* CARD 1: FINANCIALS (HERO WIDE CARD - SPANS 2 COLS ON DESKTOP) */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="lg:col-span-2 rounded-3xl p-6 bg-gradient-to-br from-emerald-500/10 via-card/70 to-card/40 dark:from-emerald-950/20 dark:via-card/40 dark:to-card/20 backdrop-blur-xl border border-emerald-500/25 hover:border-emerald-500/50 transition-all duration-300 shadow-xl shadow-emerald-500/5 hover:shadow-emerald-500/10 flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-inner group-hover:scale-110 transition-transform">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {isAr ? "الماليات والخزينة" : "Core Financials"}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-foreground mt-1">
                    {isAr ? "الماليات والتقارير اليومية" : "Financials & Cash Vault"}
                  </h2>
                </div>
              </div>
              <div className="hidden sm:flex p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6 font-medium">
              {isAr
                ? "تسجيل العهد النقدية، تقفيل الخزائن اليومية، ملخص المبيعات، ومراجعة هوامش الربح والشيفتات."
                : "Daily safe deposits, cash register balancing, sales breakdowns, monthly summaries, and margin strategy."}
            </p>

            {/* Quick Links Sub-Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
              <Link 
                href="/financial-reports" 
                prefetch={true}
                className="flex items-center justify-between p-3 rounded-xl bg-background/60 hover:bg-emerald-500/10 border border-border/80 hover:border-emerald-500/30 text-xs font-bold transition-all text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "التقارير المالية" : "Reports"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/financials/detailed-sales" 
                prefetch={true}
                className="flex items-center justify-between p-3 rounded-xl bg-background/60 hover:bg-emerald-500/10 border border-border/80 hover:border-emerald-500/30 text-xs font-bold transition-all text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <Activity className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "تفاصيل المبيعات" : "Detailed Sales"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/financial-reports/month-summary" 
                prefetch={true}
                className="flex items-center justify-between p-3 rounded-xl bg-background/60 hover:bg-emerald-500/10 border border-border/80 hover:border-emerald-500/30 text-xs font-bold transition-all text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "ملخص الشهر" : "Month Summary"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/shift-reports/manager" 
                prefetch={true}
                className="flex items-center justify-between p-3 rounded-xl bg-background/60 hover:bg-emerald-500/10 border border-border/80 hover:border-emerald-500/30 text-xs font-bold transition-all text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <Shield className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "تدقيق الشيفتات" : "Shift Audit"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/dashboard/margin-calculator" 
                prefetch={true}
                className="flex items-center justify-between p-3 rounded-xl bg-background/60 hover:bg-emerald-500/10 border border-border/80 hover:border-emerald-500/30 text-xs font-bold transition-all text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "استراتيجية الهامش" : "Margin Strategy"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/financials/out-of-stock" 
                prefetch={true}
                className="flex items-center justify-between p-3 rounded-xl bg-background/60 hover:bg-emerald-500/10 border border-border/80 hover:border-emerald-500/30 text-xs font-bold transition-all text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <PackageMinus className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "سجل النواقص" : "Out of Stock"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>
            </div>
          </div>

          {/* Primary Action Button */}
          <Link
            href="/financials/inputs"
            prefetch={true}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-black text-sm transition-all shadow-lg shadow-emerald-600/25 group/btn"
          >
            <span>{isAr ? "تسجيل مدخلات الخزينة اليومية (Safe Report)" : "Open Daily Safe & Inputs"}</span>
            {isAr ? <ArrowLeft className="w-4 h-4 group-hover/btn:-translate-x-1 transition-transform" /> : <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />}
          </Link>
        </motion.div>

        {/* CARD 2: OPERATIONS & STORE */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="rounded-3xl p-6 bg-gradient-to-br from-amber-500/10 via-card/70 to-card/40 dark:from-amber-950/20 dark:via-card/40 dark:to-card/20 backdrop-blur-xl border border-amber-500/25 hover:border-amber-500/50 transition-all duration-300 shadow-xl shadow-amber-500/5 hover:shadow-amber-500/10 flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner group-hover:scale-110 transition-transform">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {isAr ? "التشغيل والفرع" : "Store Ops"}
                  </span>
                  <h2 className="text-xl font-black text-foreground mt-1">
                    {isAr ? "التشغيل وإدارة الفرع" : "Operations & Store"}
                  </h2>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6 font-medium">
              {isAr
                ? "قوائم الفحص والتشيك لست، سجلات النظافة، المستندات الرسمية، والعروض."
                : "Daily operational checklists, facility hygiene logs, official receipts, and promotions."}
            </p>

            {/* Quick Links List */}
            <div className="flex flex-col gap-2 mb-6">
              <Link 
                href="/manager/documents" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-amber-500/10 border border-border/80 hover:border-amber-500/30 text-xs font-bold transition-all text-foreground hover:text-amber-600 dark:hover:text-amber-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "المستندات والإيصالات الرسمية" : "Official Documents"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/admin/cleaning" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-amber-500/10 border border-border/80 hover:border-amber-500/30 text-xs font-bold transition-all text-foreground hover:text-amber-600 dark:hover:text-amber-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "سجلات النظافة" : "Cleaning Logs"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/admin/offers" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-amber-500/10 border border-border/80 hover:border-amber-500/30 text-xs font-bold transition-all text-foreground hover:text-amber-600 dark:hover:text-amber-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <Tag className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "إدارة العروض الترويجية" : "Manage Offers"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/admin/lost-and-found" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-amber-500/10 border border-border/80 hover:border-amber-500/30 text-xs font-bold transition-all text-foreground hover:text-amber-600 dark:hover:text-amber-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <Package className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "سجل المفقودات" : "Lost & Found"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>
            </div>
          </div>

          <Link
            href="/checklists/manager"
            prefetch={true}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-5 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-[0.99] text-white font-black text-sm transition-all shadow-lg shadow-amber-600/25 group/btn"
          >
            <span>{isAr ? "متابعة التشيك لست اليومية" : "Open Store Checklists"}</span>
            {isAr ? <ArrowLeft className="w-4 h-4 group-hover/btn:-translate-x-1 transition-transform" /> : <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />}
          </Link>
        </motion.div>

        {/* CARD 3: PRODUCTS & INVENTORY */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="rounded-3xl p-6 bg-gradient-to-br from-purple-500/10 via-card/70 to-card/40 dark:from-purple-950/20 dark:via-card/40 dark:to-card/20 backdrop-blur-xl border border-purple-500/25 hover:border-purple-500/50 transition-all duration-300 shadow-xl shadow-purple-500/5 hover:shadow-purple-500/10 flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-500 shadow-inner group-hover:scale-110 transition-transform">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    {isAr ? "المخزون والمنتجات" : "Stock & Catalog"}
                  </span>
                  <h2 className="text-xl font-black text-foreground mt-1">
                    {isAr ? "المنتجات والمخزون" : "Products & Stock"}
                  </h2>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6 font-medium">
              {isAr
                ? "تتبع الصلاحيات، الجرد الأعمى، البحث عن الأصناف، وطلبيات ومرتجعات الموردين."
                : "Near-expiry audits, blind stock verification, barcode catalog lookup, and vendor orders."}
            </p>

            {/* Quick Links */}
            <div className="flex flex-col gap-2 mb-6">
              <Link 
                href="/admin/product-lookup" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-purple-500/10 border border-border/80 hover:border-purple-500/30 text-xs font-bold transition-all text-foreground hover:text-purple-600 dark:hover:text-purple-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <Search className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "بحث وتفاصيل الصنف (Lookup)" : "Product Lookup"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/inventory-audit/manager" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-purple-500/10 border border-border/80 hover:border-purple-500/30 text-xs font-bold transition-all text-foreground hover:text-purple-600 dark:hover:text-purple-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <Shield className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "الجرد الأعمى (Blind Audit)" : "Blind Inventory Audit"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/products/supplier-orders" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-purple-500/10 border border-border/80 hover:border-purple-500/30 text-xs font-bold transition-all text-foreground hover:text-purple-600 dark:hover:text-purple-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <ShoppingCart className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "طلب من المورد (Supplier Order)" : "Supplier Orders"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/dashboard/supplier-returns" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-purple-500/10 border border-border/80 hover:border-purple-500/30 text-xs font-bold transition-all text-foreground hover:text-purple-600 dark:hover:text-purple-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <Truck className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "مرتجعات الموردين" : "Supplier Returns"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>
            </div>
          </div>

          <Link
            href="/products/expiries-audit"
            prefetch={true}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-5 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-[0.99] text-white font-black text-sm transition-all shadow-lg shadow-purple-600/25 group/btn"
          >
            <span>{isAr ? "مراجعة الصلاحيات (Expiries)" : "Audit Expiries"}</span>
            {isAr ? <ArrowLeft className="w-4 h-4 group-hover/btn:-translate-x-1 transition-transform" /> : <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />}
          </Link>
        </motion.div>

        {/* CARD 4: HUMAN RESOURCES (HR) */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="rounded-3xl p-6 bg-gradient-to-br from-sky-500/10 via-card/70 to-card/40 dark:from-sky-950/20 dark:via-card/40 dark:to-card/20 backdrop-blur-xl border border-sky-500/25 hover:border-sky-500/50 transition-all duration-300 shadow-xl shadow-sky-500/5 hover:shadow-sky-500/10 flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-500 shadow-inner group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    {isAr ? "فريق العمل" : "Staff & HR"}
                  </span>
                  <h2 className="text-xl font-black text-foreground mt-1">
                    {isAr ? "الموارد البشرية والرواتب" : "Human Resources"}
                  </h2>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6 font-medium">
              {isAr
                ? "قاعدة بيانات الموظفين، العقود الرسمية وإخلاء الطرف، مسير المرتبات، والجدول الذكي."
                : "Staff roster, employment contracts, clearance release forms, payroll, and shift schedules."}
            </p>

            {/* Quick Links */}
            <div className="flex flex-col gap-2 mb-6">
              <Link 
                href="/admin/schedule" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-sky-500/10 border border-border/80 hover:border-sky-500/30 text-xs font-bold transition-all text-foreground hover:text-sky-600 dark:hover:text-sky-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <CalendarDays className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "الجدول الذكي وتوزيع الشيفتات" : "Smart Scheduler"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/admin/payroll" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-sky-500/10 border border-border/80 hover:border-sky-500/30 text-xs font-bold transition-all text-foreground hover:text-sky-600 dark:hover:text-sky-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <DollarSign className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "مسير المرتبات والمستحقات" : "Payroll System"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/admin/adjustments" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-sky-500/10 border border-border/80 hover:border-sky-500/30 text-xs font-bold transition-all text-foreground hover:text-sky-600 dark:hover:text-sky-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "السلف والخصومات والبدلات" : "Adjustments & Loans"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/settings/cashiers" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-sky-500/10 border border-border/80 hover:border-sky-500/30 text-xs font-bold transition-all text-foreground hover:text-sky-600 dark:hover:text-sky-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <Users className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "حسابات وبن كود الكاشير" : "Cashier PINs & Access"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>
            </div>
          </div>

          <Link
            href="/hr/employees"
            prefetch={true}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-5 rounded-2xl bg-sky-600 hover:bg-sky-500 active:scale-[0.99] text-white font-black text-sm transition-all shadow-lg shadow-sky-600/25 group/btn"
          >
            <span>{isAr ? "سجل الموظفين والعقود" : "Open Staff Directory"}</span>
            {isAr ? <ArrowLeft className="w-4 h-4 group-hover/btn:-translate-x-1 transition-transform" /> : <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />}
          </Link>
        </motion.div>

        {/* CARD 5: ADMIN & SYSTEM */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="rounded-3xl p-6 bg-gradient-to-br from-rose-500/10 via-card/70 to-card/40 dark:from-rose-950/20 dark:via-card/40 dark:to-card/20 backdrop-blur-xl border border-rose-500/25 hover:border-rose-500/50 transition-all duration-300 shadow-xl shadow-rose-500/5 hover:shadow-rose-500/10 flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-inner group-hover:scale-110 transition-transform">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    {isAr ? "التحكم والنظام" : "Control & Security"}
                  </span>
                  <h2 className="text-xl font-black text-foreground mt-1">
                    {isAr ? "الإدارة والتحكم بالنظام" : "Administration & Control"}
                  </h2>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6 font-medium">
              {isAr
                ? "إدارة المستخدمين، الأجهزة المتصلة، إرسال المستندات، واستيراد البيانات وسجلات الأمان."
                : "User permissions, live terminal sessions, document dispatch, security logs, and data imports."}
            </p>

            {/* Quick Links */}
            <div className="flex flex-col gap-2 mb-6">
              <Link 
                href="/admin/send-document" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-rose-500/10 border border-border/80 hover:border-rose-500/30 text-xs font-bold transition-all text-foreground hover:text-rose-600 dark:hover:text-rose-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <SendHorizontal className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "إرسال مستند رسمي للمدير" : "Dispatch Document"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/admin/devices" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-rose-500/10 border border-border/80 hover:border-rose-500/30 text-xs font-bold transition-all text-foreground hover:text-rose-600 dark:hover:text-rose-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <Monitor className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "الأجهزة والجلسات المتصلة" : "Device Sessions"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/settings/audit-log" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-rose-500/10 border border-border/80 hover:border-rose-500/30 text-xs font-bold transition-all text-foreground hover:text-rose-600 dark:hover:text-rose-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <Shield className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "سجل الأمان والعمليات" : "Security Audit Log"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>

              <Link 
                href="/admin/import-csv" 
                prefetch={true}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-rose-500/10 border border-border/80 hover:border-rose-500/30 text-xs font-bold transition-all text-foreground hover:text-rose-600 dark:hover:text-rose-400 group/link"
              >
                <div className="flex items-center gap-2 truncate">
                  <Database className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                  <span className="truncate">{isAr ? "استيراد البيانات (CSV)" : "Data Import"}</span>
                </div>
                {isAr ? <ChevronLeft className="w-3.5 h-3.5 opacity-60 group-hover/link:-translate-x-0.5 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover/link:translate-x-0.5 transition-transform" />}
              </Link>
            </div>
          </div>

          <Link
            href="/admin/users"
            prefetch={true}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-black text-sm transition-all shadow-lg shadow-rose-600/25 group/btn"
          >
            <span>{isAr ? "إدارة المستخدمين والصلاحيات" : "Manage User Access"}</span>
            {isAr ? <ArrowLeft className="w-4 h-4 group-hover/btn:-translate-x-1 transition-transform" /> : <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />}
          </Link>
        </motion.div>

      </div>

      {/* FOOTER STRIP */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mt-8 pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground relative z-10"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
            <span className="text-foreground">{isAr ? "النظام متصل ومتزامن لحظياً" : "Live Firebase Cloud Sync"}</span>
          </span>
          <span className="text-border">•</span>
          <span>Circle K Franchise Operations Portal</span>
        </div>

        <div className="flex items-center gap-4">
          <Link 
            href="/cashier" 
            prefetch={true}
            className="hover:text-foreground font-semibold transition-colors"
          >
            {isAr ? "بوابة الكاشير" : "Cashier Portal"}
          </Link>
          <span className="text-border">•</span>
          <Link 
            href="/manager/documents" 
            prefetch={true}
            className="hover:text-foreground font-semibold transition-colors"
          >
            {isAr ? "المستندات" : "Documents"}
          </Link>
          <span className="text-border">•</span>
          <Link 
            href="/ai-assistant" 
            prefetch={true}
            className="hover:text-purple-400 font-semibold transition-colors flex items-center gap-1"
          >
            <Bot className="w-3 h-3" />
            {isAr ? "مساعد إبراهيم" : "Ibrahim AI"}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
