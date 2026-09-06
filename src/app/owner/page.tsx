"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getAggregateFromServer, sum } from "firebase/firestore";
import {
  TrendingUp, Wallet, CreditCard, Building, Activity, ShieldCheck, Landmark, ExternalLink, AlertTriangle, BellRing
} from "lucide-react";
import { PullToRefresh } from "@/components/MobileUX/PullToRefresh";
import { showIsland } from "@/components/MobileUX/DynamicIsland";
import { SwipeToApprove } from "@/components/MobileUX/SwipeToApprove";
import { useLanguage } from "@/context/LanguageContext";
import { useBranch, BranchId } from "@/context/BranchContext";
import { useLiveSafeBalance } from "@/lib/financial-sync";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { hapticMedium, vibrateSuccess } from "@/lib/haptics";

function AnimatedNumber({ value }: { value: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => new Intl.NumberFormat("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(latest));

  useEffect(() => {
    const controls = animate(count, value, { duration: 1.5, ease: "easeOut" });
    return controls.stop;
  }, [value]);

  return <motion.span className="tabular-nums">{rounded}</motion.span>;
}

// ── Midnight Navy Design Tokens ────────────────
const D = {
  bg: "#0B1121",
  surface: "#151E32",
  surfaceHigh: "#1C2841",
  border: "rgba(34, 211, 238, 0.15)",
  borderMid: "rgba(34, 211, 238, 0.25)",
  red: "#ef4444",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  textDim: "#64748b",
  cyan: "#22d3ee",
  cyanDim: "rgba(34, 211, 238, 0.1)",
  cyanBorder: "rgba(34, 211, 238, 0.25)",
  green: "#10b981", // emerald
  greenDim: "rgba(16,185,129,0.12)",
  greenBorder: "rgba(16,185,129,0.25)",
  amber: "#f59e0b",
  amberDim: "rgba(245,158,11,0.1)",
  amberBorder: "rgba(245,158,11,0.25)",
  indigo: "#6366f1",
  indigoDim: "rgba(99,102,241,0.1)",
  indigoBorder: "rgba(99,102,241,0.25)",
};

export default function OwnerDashboard() {
  const { language: lang } = useLanguage();
  const { currentBranch, setBranch } = useBranch();
  const { safeBalance, bankBalance, stats: liveStats, loading, refresh } = useLiveSafeBalance(currentBranch);

  const stats = {
    safeMoney: safeBalance,
    bankMoney: bankBalance,
    totalSales: liveStats?.totalSales || 0,
    totalCashPayments: liveStats?.totalCashPayments || 0,
    depositsToSafe: liveStats?.depositsToSafe || 0,
    depositsFromSafe: liveStats?.depositsFromSafe || 0,
    totalPayrolls: liveStats?.totalPayrolls || 0,
    totalLoans: liveStats?.totalLoans || 0,
    totalOldCreditsCash: 0,
    totalTaxPaid: liveStats?.totalCashTax || 0,
    totalVisaSales: liveStats?.totalVisaSales || 0,
    totalBankPayments: liveStats?.totalBankPayments || 0,
    depositsToBank: liveStats?.depositsToBank || 0,
    depositsFromBank: liveStats?.depositsFromBank || 0,
    totalBankCredits: 0,
    totalBankTaxPaid: liveStats?.totalBankTax || 0,
  };

  const handleRefresh = async () => {
    if ('vibrate' in navigator) navigator.vibrate(20);
    await refresh();
    showIsland("Dashboard Updated", { type: "success" });
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);

  const chartData = [
    { name: lang === "en" ? "Safe" : "الخزينة", amount: stats.safeMoney, fill: D.green },
    { name: lang === "en" ? "Bank" : "البنك", amount: stats.bankMoney, fill: D.indigo }
  ];

  return (
    <div className="min-h-screen bg-[#0B1121] text-slate-50 selection:bg-cyan-500/30">
      {/* Decorative background blurs */}
      <div className="fixed top-0 left-0 w-full h-96 bg-gradient-to-b from-cyan-900/20 to-transparent pointer-events-none" />
      <div className="fixed top-[-10%] right-[-5%] w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-[800px] mx-auto pb-32 relative z-10">
        {/* ── HEADER ── */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-5 pt-14 pb-4 sticky top-0 bg-[#0B1121]/80 backdrop-blur-xl border-b border-white/5 z-50"
        >
          <div className="text-xs font-bold tracking-widest text-slate-400 uppercase">
            CIRCLE K <span className="font-medium text-slate-500">{lang === "en" ? "Owner" : "المالك"}</span>
          </div>
          <motion.div 
            whileTap={{ scale: 0.9 }}
            className="w-8 h-8 rounded-xl bg-cyan-400 flex items-center justify-center text-[#0B1121] shadow-[0_0_15px_rgba(34,211,238,0.3)] cursor-pointer"
          >
            <Activity size={18} />
          </motion.div>
        </motion.div>

        {/* ── MAIN CONTENT ── */}
        <PullToRefresh onRefresh={handleRefresh}>
          <div className="px-5 mt-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <h1 className="text-3xl font-black m-0 text-white tracking-tight">{lang === "en" ? "Overview" : "الرئيسية"}</h1>
                <p className="text-sm text-slate-400 mt-1">
                  {currentBranch === "all"
                    ? (lang === "en" ? "Consolidated enterprise financials" : "المالية الموحدة لجميع الفروع")
                    : (currentBranch === "alamein4" ? (lang === "en" ? "El Alamein 4 Branch" : "فرع العلمين 4") : (lang === "en" ? "Ola El Koronfol Branch" : "فرع أولا القرنفل"))
                  }
                </p>
              </div>

              {/* Branch Selector Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-2xl">
                {[
                  { id: "all" as BranchId, nameEn: "All Branches", nameAr: "جميع الفروع" },
                  { id: "alamein4" as BranchId, nameEn: "El Alamein 4", nameAr: "العلمين 4" },
                  { id: "ola" as BranchId, nameEn: "Ola Koronfol", nameAr: "أولا القرنفل" },
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      hapticMedium();
                      setBranch(b.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      currentBranch === b.id
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {lang === "en" ? b.nameEn : b.nameAr}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Balances Chart */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="w-full h-48 mb-6 glass-panel p-4 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-[40px] pointer-events-none" />
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={D.cyan} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={D.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: D.textSecondary, fontSize: 12, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: D.textDim, fontSize: 10 }} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
                  <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} contentStyle={{ backgroundColor: D.surfaceHigh, border: `1px solid ${D.border}`, borderRadius: 12, color: '#fff', fontWeight: 700 }} />
                  <Area type="monotone" dataKey="amount" stroke={D.cyan} strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* BENTO BOX GRID */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              
              {/* ---------------- SAFE SECTION ---------------- */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => hapticMedium()}
                className="col-span-1 md:col-span-2 glass-panel p-6 border-emerald-500/20 relative overflow-hidden group cursor-pointer"
              >
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500" />
                
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest">
                        <ShieldCheck size={18} /> {lang === "en" ? (currentBranch === "all" ? "Lifetime Safe Balance" : "Branch Safe Balance") : (currentBranch === "all" ? "رصيد الخزينة الشامل" : "رصيد خزينة الفرع")}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{lang === "en" ? "Live Vault" : "مباشر"}</span>
                    </div>
                </div>
                
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-black text-emerald-500">EGP</span>
                  <span className="text-[2.75rem] font-black text-white tracking-tighter leading-none"><AnimatedNumber value={stats.safeMoney} /></span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-[90%] mb-5">
                  {lang === "en"
                    ? "Cash Sales − Cash Payments (incl. Credits) + Deposits In − Deposits Out − Payrolls & Loans"
                    : "المبيعات النقدية − المدفوعات والآجل + توريدات الخزينة − المسحوبات − الرواتب والسلف"}
                </p>

                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-5">
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{lang === "en" ? "Total Cash Sales" : "إجمالي المبيعات النقدية"}</div>
                        <div className="text-lg text-white font-black"><AnimatedNumber value={stats.totalSales} /></div>
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{lang === "en" ? "Total Outflows" : "إجمالي المصروفات"}</div>
                        <div className="text-lg text-white font-black"><AnimatedNumber value={stats.totalCashPayments + (stats.totalTaxPaid || 0) + stats.totalPayrolls + stats.totalLoans} /></div>
                    </div>
                </div>
              </motion.div>

              {/* ---------------- BANK SECTION ---------------- */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => hapticMedium()}
                className="col-span-1 md:col-span-2 glass-panel p-6 border-indigo-500/20 relative overflow-hidden group cursor-pointer"
              >
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-500" />
                
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest">
                        <Landmark size={18} /> {lang === "en" ? (currentBranch === "all" ? "Lifetime Bank Balance" : "Branch Bank Balance") : (currentBranch === "all" ? "رصيد البنك الشامل" : "رصيد البنك للفرع")}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-black text-cyan-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span>{lang === "en" ? "Verified" : "معتمد"}</span>
                    </div>
                </div>
                
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-black text-indigo-500">EGP</span>
                  <span className="text-[2.75rem] font-black text-white tracking-tighter leading-none"><AnimatedNumber value={stats.bankMoney} /></span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-[90%] mb-5">
                  Visa Sales − Bank Payments − Bank Tax Paid − Bank Credits + Deposits In − Deposits Out
                </p>

                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-5">
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{lang === "en" ? "Total Visa Sales" : "إجمالي مبيعات الفيزا"}</div>
                        <div className="text-lg text-white font-black"><AnimatedNumber value={stats.totalVisaSales} /></div>
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{lang === "en" ? "Total Outflows" : "إجمالي المصروفات"}</div>
                        <div className="text-lg text-white font-black"><AnimatedNumber value={stats.totalBankPayments + stats.totalBankTaxPaid + stats.totalBankCredits} /></div>
                    </div>
                </div>
              </motion.div>

              {/* Quick Metrics Grid */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="col-span-1 md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-3"
              >
                  <motion.div whileTap={{ scale: 0.95 }} className="glass-panel p-5">
                    <div className="text-[10px] text-slate-500 uppercase font-black tracking-wider mb-2">{lang === "en" ? "Bank Payments" : "مدفوعات بنكية"}</div>
                    <div className="text-xl text-white font-black tracking-tight"><AnimatedNumber value={stats.totalBankPayments} /></div>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.95 }} className="glass-panel p-5">
                    <div className="text-[10px] text-slate-500 uppercase font-black tracking-wider mb-2">{lang === "en" ? "Bank Credits" : "ذمم بنكية"}</div>
                    <div className="text-xl text-white font-black tracking-tight"><AnimatedNumber value={stats.totalBankCredits} /></div>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.95 }} className="glass-panel border-emerald-500/20 p-5">
                    <div className="text-[10px] text-emerald-400 uppercase font-black tracking-wider mb-2">{lang === "en" ? "Safe Deposits In" : "إيداعات للخزينة"}</div>
                    <div className="text-xl text-white font-black tracking-tight">+<AnimatedNumber value={stats.depositsToSafe} /></div>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.95 }} className="glass-panel border-rose-500/20 p-5">
                    <div className="text-[10px] text-rose-400 uppercase font-black tracking-wider mb-2">{lang === "en" ? "Safe Deposits Out" : "سحوبات من الخزينة"}</div>
                    <div className="text-xl text-white font-black tracking-tight">-<AnimatedNumber value={stats.depositsFromSafe} /></div>
                  </motion.div>
              </motion.div>

              {/* ---------------- LIVE FEED TICKER ---------------- */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="col-span-1 md:col-span-4 glass-panel p-6 mt-2 relative overflow-hidden"
              >
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-black uppercase tracking-widest mb-4">
                  <BellRing size={18} className="animate-pulse" /> {lang === "en" ? "Live Command Feed" : "الأحداث المباشرة"}
                </div>
                
                <div className="flex flex-col gap-3 max-h-40 overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-[#151E32]/90 to-transparent z-10 pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#151E32]/90 to-transparent z-10 pointer-events-none" />
                  
                  <motion.div 
                    animate={{ y: [0, -100] }} 
                    transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                    className="flex flex-col gap-4 py-8"
                  >
                    {[
                      { time: "Just now", msg: lang === "en" ? "Cashier Ahmed logged into Register 1" : "أحمد سجل دخول في الكاشير ١" },
                      { time: "2 min ago", msg: lang === "en" ? "High-value void ($150) requested by Sarah" : "سارة طلبت إلغاء بقيمة عالية" },
                      { time: "15 min ago", msg: lang === "en" ? "Inventory: Marlboro Red running low (5 packs left)" : "المخزون: مارلبورو أحمر على وشك النفاذ" },
                      { time: "1 hr ago", msg: lang === "en" ? "Shift Report #4022 submitted for approval" : "تقرير الوردية ٤٠٢٢ بانتظار الموافقة" },
                      { time: "2 hrs ago", msg: lang === "en" ? "Safe Cash Drop completed: $2,500" : "تم إيداع ٢٥٠٠ في الخزينة" },
                      { time: "Just now", msg: lang === "en" ? "Cashier Ahmed logged into Register 1" : "أحمد سجل دخول في الكاشير ١" },
                      { time: "2 min ago", msg: lang === "en" ? "High-value void ($150) requested by Sarah" : "سارة طلبت إلغاء بقيمة عالية" },
                    ].map((evt, i) => (
                      <div key={i} className="flex gap-4 items-center bg-black/20 p-3 rounded-xl border border-white/5">
                        <span className="text-xs text-cyan-500 font-bold w-16 shrink-0">{evt.time}</span>
                        <span className="text-sm text-slate-300">{evt.msg}</span>
                      </div>
                    ))}
                  </motion.div>
                </div>
              </motion.div>

              {/* ---------------- SWIPE TO APPROVE DEMO ---------------- */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="col-span-1 md:col-span-4 mt-4 mb-8"
              >
                <div className="mb-2 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {lang === "en" ? "Security Approval Demo" : "عرض تجريبي للموافقة الأمنية"}
                </div>
                <SwipeToApprove onComplete={() => showIsland(lang === "en" ? "Shift Approved Successfully!" : "تمت الموافقة بنجاح", { type: 'success' })} />
              </motion.div>

            </div>
          </div>
        </PullToRefresh>
      </div>
    </div>
  );
}
