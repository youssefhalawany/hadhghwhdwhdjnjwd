"use client";

import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Wallet, Landmark, Loader2, AlertTriangle, ShieldCheck, ExternalLink, TrendingUp, DollarSign, ShieldAlert, Package, Activity, CheckCircle, Clock } from "lucide-react";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { fetchDashboardData } from "@/lib/dashboard-queries";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import Link from "next/link";
import { motion } from "framer-motion";
import { fetchUnifiedFinancialDocs, calculateFinancialLedger } from "@/lib/financial-sync";

export default function FinancialInputsOverview() {
  const { currentBranch } = useBranch();
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  
  const [stats, setStats] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`cached_fin_stats_${currentBranch}`);
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return {
      safeMoney: 0,
      totalSales: 0,
      totalCashPayments: 0,
      depositsToSafe: 0,
      depositsFromSafe: 0,
      totalPayrolls: 0,
      totalLoans: 0,
      totalOldCreditsCash: 0,
      totalTaxPaid: 0,

      bankMoney: 0,
      totalVisaSales: 0,
      totalBankPayments: 0,
      depositsToBank: 0,
      depositsFromBank: 0,
      totalBankCredits: 0,
      totalBankTaxPaid: 0,
    };
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`cached_fin_stats_${currentBranch}`);
        if (cached) return false;
      } catch (e) {}
    }
    return true;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [missingIndexes, setMissingIndexes] = useState<string[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`cached_dashboard_data_${currentBranch}`);
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return null;
  });
  const [feed, setFeed] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userName, setUserName] = useState("Manager");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const storedName = localStorage.getItem("circlek_user_name");
    if (storedName) setUserName(storedName);

    const handleUserChanged = (e: CustomEvent) => {
      if (e.detail) setUserName(e.detail);
    };
    window.addEventListener("circlek_user_changed", handleUserChanged as any);

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const name = localStorage.getItem("circlek_user_name") || user.displayName || user.email?.split("@")[0] || "Manager";
        setUserName(name);
      }
    });

    return () => {
      window.removeEventListener("circlek_user_changed", handleUserChanged as any);
      unsubscribe();
    };
  }, []);

  const getShiftName = (hour: number) => {
    if (hour >= 6 && hour < 14) return isAr ? "الصباحية" : "Morning";
    if (hour >= 14 && hour < 22) return isAr ? "المسائية" : "Evening";
    return isAr ? "الليلية" : "Night";
  };

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        const result = await fetchDashboardData(currentBranch);
        if (active) {
          setDashboardData(result);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(`cached_dashboard_data_${currentBranch}`, JSON.stringify(result));
            } catch (e) {}
          }
          if (result.missingIndexes && result.missingIndexes.length > 0) {
            setMissingIndexes(prev => Array.from(new Set([...prev, ...result.missingIndexes])));
          }
        }
      } catch (e) {
        console.error("Dashboard fetch error", e);
      }
    };
    loadDashboard();
    return () => { active = false; };
  }, [currentBranch]);

  useEffect(() => {
    // Listen to live activity feed
    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(10));
    const unsubscribe = onSnapshot(q, (snap) => {
      let notifs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      if (currentBranch !== "all") {
        notifs = notifs.filter(n => {
          const sId = (n.storeId || n.branchId || "").toLowerCase();
          const inferred = sId.includes("ola") || sId.includes("koronfol") ? "ola" : "alamein4";
          return inferred === currentBranch;
        });
      }
      setFeed(notifs.slice(0, 5));
    });
    return () => unsubscribe();
  }, [currentBranch]);

  // Helper function to normalize dates from timestamps/strings
  const normalizeDate = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
      const dmy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (dmy) {
        const [_, d, m, y] = dmy;
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    }
    if (val && typeof val.toDate === "function") return val.toDate().toISOString().slice(0, 10);
    if (val && typeof val._seconds === "number") return new Date(val._seconds * 1000).toISOString().slice(0, 10);
    if (val && typeof val.seconds === "number") return new Date(val.seconds * 1000).toISOString().slice(0, 10);
    if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString().slice(0, 10);
    return null;
  };

  // Branch matching identical to Safe Report
  const matchesBranch = (docData: any, targetBranch: string): boolean => {
    if (!targetBranch || targetBranch === "all") return true;
    const docBranch = (docData.storeId || docData.branchId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = targetBranch.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!docBranch) return true;
    return docBranch.includes(target) || target.includes(docBranch);
  };

  useEffect(() => {
    async function fetchStats(forceRefresh = false) {
      const hasCached = typeof window !== "undefined" && !!localStorage.getItem(`cached_fin_stats_${currentBranch}`);
      if (!hasCached) {
        setLoading(true);
      } else {
        setIsSyncing(true);
      }
      setMissingIndexes([]);

      try {
        const docs = await fetchUnifiedFinancialDocs(forceRefresh);
        const ledger = calculateFinancialLedger(docs, currentBranch);

        const finalStats = {
          totalSales: ledger.totalSales,
          totalCashPayments: ledger.totalCashPayments,
          depositsToSafe: ledger.depositsToSafe,
          depositsFromSafe: ledger.depositsFromSafe,
          totalPayrolls: ledger.totalPayrolls,
          totalLoans: ledger.totalLoans,
          totalOldCreditsCash: 0,
          totalTaxPaid: ledger.totalCashTax,
          safeMoney: ledger.closingSafe,
          totalVisaSales: ledger.totalVisaSales,
          totalBankPayments: ledger.totalBankPayments,
          depositsToBank: ledger.depositsToBank,
          depositsFromBank: ledger.depositsFromBank,
          totalBankCredits: 0,
          totalBankTaxPaid: ledger.totalBankTax,
          bankMoney: ledger.closingBank
        };

        if (typeof window !== "undefined") {
          localStorage.setItem(`cached_safe_balance_${currentBranch}`, ledger.closingSafe.toString());
          localStorage.setItem(`cached_bank_balance_${currentBranch}`, ledger.closingBank.toString());
          localStorage.setItem(`cached_total_cash_payments_${currentBranch}`, ledger.totalCashPayments.toString());
          localStorage.setItem(`cached_total_bank_payments_${currentBranch}`, ledger.totalBankPayments.toString());
          localStorage.setItem(`cached_total_payrolls_loans_${currentBranch}`, (ledger.totalPayrolls + ledger.totalLoans).toString());
          localStorage.setItem(`cached_deposits_out_safe_${currentBranch}`, ledger.depositsFromSafe.toString());
          localStorage.setItem(`cached_deposits_in_safe_${currentBranch}`, ledger.depositsToSafe.toString());
          localStorage.setItem(`cached_deposits_out_bank_${currentBranch}`, ledger.depositsFromBank.toString());
          localStorage.setItem(`cached_deposits_in_bank_${currentBranch}`, ledger.depositsToBank.toString());
          localStorage.setItem(`cached_fin_stats_${currentBranch}`, JSON.stringify(finalStats));
        }
        setStats(finalStats);
      } catch (err: any) {
        console.error("Ledger calculation error:", err);
      } finally {
        setLoading(false);
        setIsSyncing(false);
      }
    }

    fetchStats(false);

    const handleUpdate = () => {
      fetchStats(true);
    };

    window.addEventListener("circlek_financials_updated", handleUpdate);
    return () => {
      window.removeEventListener("circlek_financials_updated", handleUpdate);
    };
  }, [currentBranch]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        {/* Shimmering Skeleton Loader */}
        <div className="w-16 h-16 relative flex items-center justify-center mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
          <Activity className="h-6 w-6 text-emerald-500 animate-pulse" />
        </div>
        <p className="font-bold text-lg animate-pulse">{t("admin.financials_inputs.loading")}</p>
        <p className="text-sm opacity-60 mt-2">{t("admin.financials_inputs.loading_desc")}</p>
      </div>
    );
  }

  if (missingIndexes.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-red-500 gap-4">
        <AlertTriangle className="h-12 w-12" />
        <p className="font-bold text-xl">{t("admin.financials_inputs.action_required")} ({missingIndexes.length})</p>
        <div className="bg-red-50 border border-red-200 p-6 rounded-xl max-w-2xl text-center shadow-sm">
          <p className="text-sm text-red-800 mb-4 font-medium">
            {t("admin.financials_inputs.action_desc")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {missingIndexes.map((url, i) => (
              <a 
                key={i}
                href={url} 
                target="_blank" 
                rel="noreferrer"
                className="bg-white border border-red-300 text-red-700 hover:bg-red-100 font-bold py-2 px-4 rounded-lg text-sm shadow-sm transition-colors flex items-center gap-2"
              >
                {t("admin.financials_inputs.create_index")} #{i + 1}
                <ExternalLink className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { kpis, chartData, needsAttention } = dashboardData || {};

  return (
    <div className="space-y-4 sm:space-y-8 pb-12 relative">
      {isSyncing && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A101D]/90 border border-cyan-500/30 text-cyan-400 text-xs font-bold shadow-2xl backdrop-blur-md animate-pulse pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>{isAr ? "مزامنة لحظية..." : "Live cloud sync..."}</span>
        </div>
      )}
      
      {/* ---------------- COMMAND CENTER DASHBOARD ---------------- */}
      
      {/* Welcome Screen & Live Clock */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative bg-[#0A101D] backdrop-blur-xl border border-cyan-500/20 rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 md:p-10 shadow-[0_0_40px_rgba(34,211,238,0.05)] overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:bg-cyan-500/20 transition-colors duration-700"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-2 sm:mb-4">
              <Activity className="w-3.5 h-3.5" /> {isAr ? "مركز التحكم" : "Command Center"}
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-1 sm:mb-2">
              {currentTime.getHours() < 12 ? (isAr ? "صباح الخير" : "Good morning") : currentTime.getHours() < 18 ? (isAr ? "مساء الخير" : "Good afternoon") : (isAr ? "مساء الخير" : "Good evening")}، <span className="text-cyan-400">{userName}</span>.
            </h1>
            <p className="text-slate-400 text-xs sm:text-base flex items-center gap-2">
              {isAr ? "نظرة عامة ومباشرة على عمليات ومبيعات الفرع الخاص بك." : "Real-time operational snapshot of your franchise branch."}
            </p>
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto bg-[#0A101D]/80 backdrop-blur-md border border-slate-700/50 px-4 py-2.5 sm:p-4 rounded-xl sm:rounded-2xl gap-2">
            <div className="text-xl sm:text-3xl font-black text-white tracking-tighter font-mono">
              {currentTime.toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span className="text-xs sm:text-sm font-bold text-emerald-400 uppercase tracking-widest">
                {isAr ? "الوردية:" : "Shift:"} {getShiftName(currentTime.getHours())}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* The Pulse: KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {/* Card 1: Sales */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#0A101D] backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-emerald-500/20 flex flex-col shadow-[0_0_20px_rgba(16,185,129,0.05)] hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all group">
            <div className="flex justify-between items-start mb-2 sm:mb-4">
              <div className="p-2 sm:p-3 bg-emerald-500/10 rounded-xl">
                <DollarSign className="h-4 w-4 sm:h-6 sm:w-6 text-emerald-500" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:py-1 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center gap-1">
                <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {isAr ? "مباشر" : "Live"}
              </span>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-emerald-500/70 uppercase tracking-widest mb-1">{isAr ? "مبيعات اليوم" : "Today's Sales"}</p>
            <h3 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tighter">{kpis?.totalSales?.toLocaleString()} <span className="text-xs sm:text-base font-bold text-emerald-500/50">{isAr ? "ج.م" : "EGP"}</span></h3>
          </motion.div>

          {/* Card 2: Shortage */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#0A101D] backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-800 flex flex-col shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:shadow-[0_0_30px_rgba(239,68,68,0.1)] transition-all group">
            <div className="flex justify-between items-start mb-2 sm:mb-4">
              <div className={`p-2 sm:p-3 rounded-xl ${Number(kpis?.totalShortage) < -100 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                <Wallet className={`h-4 w-4 sm:h-6 sm:w-6 ${Number(kpis?.totalShortage) < -100 ? 'text-red-500' : 'text-emerald-500'}`} />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{isAr ? "صافي العجز" : "Net Shortage"}</p>
            <h3 className={`text-xl sm:text-3xl md:text-4xl font-black tracking-tighter ${Number(kpis?.totalShortage) < -100 ? 'text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.5)]' : 'text-white'}`}>
              {kpis?.totalShortage?.toLocaleString()} <span className="text-xs sm:text-base font-bold text-slate-600">{isAr ? "ج.م" : "EGP"}</span>
            </h3>
          </motion.div>

          {/* Card 3: Voids */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#0A101D] backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-amber-500/20 flex flex-col shadow-[0_0_20px_rgba(245,158,11,0.05)] hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] transition-all group">
            <div className="flex justify-between items-start mb-2 sm:mb-4">
              <div className="p-2 sm:p-3 bg-amber-500/10 rounded-xl">
                <ShieldAlert className="h-4 w-4 sm:h-6 sm:w-6 text-amber-500" />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-amber-500/70 uppercase tracking-widest mb-1">{isAr ? "إلغاءات اليوم" : "Voids Today"}</p>
            <h3 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tighter drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]">{kpis?.totalVoids?.toLocaleString()} <span className="text-xs sm:text-base font-bold text-amber-500/50">{isAr ? "ج.م" : "EGP"}</span></h3>
          </motion.div>

          {/* Card 4: Expiries */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-[#0A101D] backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-blue-500/20 flex flex-col shadow-[0_0_20px_rgba(59,130,246,0.05)] hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all group">
            <div className="flex justify-between items-start mb-2 sm:mb-4">
              <div className="p-2 sm:p-3 bg-blue-500/10 rounded-xl">
                <Package className="h-4 w-4 sm:h-6 sm:w-6 text-blue-500" />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-blue-500/70 uppercase tracking-widest mb-1">{isAr ? "ينتهي غداً" : "Expiring Tomorrow"}</p>
            <h3 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tighter drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">{kpis?.expiringTomorrow} <span className="text-xs sm:text-base font-bold text-blue-500/50">{isAr ? "صنف" : "Items"}</span></h3>
          </motion.div>
        </div>

        {/* Main Grid: Chart & Action Center */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          
          {/* 7-Day Trend Chart & Heatmap */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="xl:col-span-2 bg-[#0A101D] backdrop-blur-md p-6 sm:p-8 rounded-[2rem] border border-slate-800 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
              <TrendingUp className="h-5 w-5 text-muted-foreground" /> {isAr ? "مؤشر الإيرادات لـ ٧ أيام" : "7-Day Revenue Trend"}
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#888" strokeOpacity={0.2} vertical={false} />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} tickMargin={10} />
                  <YAxis stroke="#888" fontSize={12} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0A101D', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  {currentBranch === 'all' ? (
                    <>
                      <Line type="monotone" dataKey="alamein4" name={isAr ? "العلمين ٤" : "El Alamein 4"} stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="ola" name={isAr ? "علا قرنفل" : "Ola Koronfol"} stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </>
                  ) : (
                    <Line type="monotone" dataKey="total" name={currentBranch === 'ola' ? (isAr ? "إيراد علا قرنفل" : "Ola Koronfol Revenue") : (isAr ? "إيراد العلمين ٤" : "El Alamein 4 Revenue")} stroke="#10b981" strokeWidth={4} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Action Center */}
          <div className="space-y-6 flex flex-col">
            
            {/* Needs Attention */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="bg-[#0A101D] backdrop-blur-md border border-red-500/20 rounded-[2rem] p-6 flex-grow shadow-[0_0_20px_rgba(239,68,68,0.05)]">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-500">
                <AlertTriangle className="h-5 w-5" /> {isAr ? "يحتاج إلى انتباه" : "Needs Attention"}
              </h3>
              
              <div className="space-y-3">
                {needsAttention && needsAttention.length > 0 ? (
                  needsAttention.map((item: any, idx: number) => (
                    <Link href={item.link || '#'} key={idx} className="block p-4 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                      <p className="text-sm font-semibold text-red-400">{item.message}</p>
                    </Link>
                  ))
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center text-center h-32">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                    <p className="text-sm font-semibold text-emerald-500">{isAr ? "ممتاز! لا توجد تنبيهات عاجلة." : "All caught up! No active alerts."}</p>
                  </div>
                )}
              </div>
            </motion.div>

          </div>
        </div>

        {/* Live Activity Feed Heatmap style */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="bg-[#0A101D] backdrop-blur-md border border-slate-800 rounded-[2rem] p-6 sm:p-8 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
            <Activity className="h-5 w-5 text-muted-foreground" /> {isAr ? "سجل النشاط المباشر" : "Live Activity Feed"}
          </h3>
          <div className="space-y-4">
            {feed && feed.length > 0 ? (
              feed.map((notif: any, idx: number) => (
                <div key={idx} className="flex items-start gap-4 p-3 rounded-lg hover:bg-[#0A101D] transition-colors">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                  <div>
                    <p className="text-sm font-medium text-white">{notif.message}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString(isAr ? 'ar-EG' : [], {hour: '2-digit', minute:'2-digit'}) : (isAr ? 'الآن' : 'Just now')} 
                      &nbsp;&bull;&nbsp; {notif.storeId}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">{isAr ? "لا توجد أنشطة حديثة." : "No recent activity."}</p>
            )}
          </div>
        </motion.div>

      {/* ---------------- SAFE SECTION ---------------- */}
      <div className="space-y-4">
        {/* Safe Balance Hero */}
        <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-8 md:p-10 rounded-[2rem] shadow-2xl shadow-teal-900/20 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:opacity-10 transition-opacity duration-700"></div>
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-300 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
          
          <div className="absolute top-1/2 right-8 -translate-y-1/2 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <ShieldCheck size={160} />
          </div>

          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2 text-teal-100 font-bold uppercase tracking-[0.2em] text-xs">
              <ShieldCheck className="h-4 w-4" />
              {t("admin.financials_inputs.lifetime_safe_balance")}
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter drop-shadow-sm flex items-baseline gap-2">
              <span className="text-3xl md:text-4xl text-teal-100 font-bold tracking-normal">EGP</span>
              {fmt(stats.safeMoney)}
            </h1>
            <p className="text-teal-50/80 font-medium text-sm max-w-2xl leading-relaxed">
              {t("admin.financials_inputs.safe_formula")}
            </p>
          </div>
        </div>

        {/* Safe Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md p-6 rounded-[1.5rem] hover:-translate-y-1 transition-all duration-300 group">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-emerald-500 transition-colors">
              {t("admin.financials_inputs.cash_sales")}
            </p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">EGP {fmt(stats.totalSales)}</p>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md p-6 rounded-[1.5rem] hover:-translate-y-1 transition-all duration-300 group">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-emerald-500 transition-colors">
              {t("admin.financials_inputs.cash_payments_tax")}
            </p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">EGP {fmt(stats.totalCashPayments + stats.totalOldCreditsCash)}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-1.5 bg-slate-50 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md">
              + {t("admin.financials_inputs.tax")}: EGP {fmt(stats.totalTaxPaid)}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md p-6 rounded-[1.5rem] hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 group-hover:text-emerald-500 transition-colors">
              {t("admin.financials_inputs.deposits_bank_owner")}
            </p>
            <div className="flex flex-col gap-3 mt-1">
              <div>
                <p className="text-emerald-600 font-black text-xl tracking-tight">+ {fmt(stats.depositsToSafe)}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{t("admin.financials_inputs.to_safe")}</p>
              </div>
              <div className="h-px w-full bg-slate-100 dark:bg-slate-800"></div>
              <div>
                <p className="text-rose-500 font-black text-xl tracking-tight">- {fmt(stats.depositsFromSafe)}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{t("admin.financials_inputs.from_safe")}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md p-6 rounded-[1.5rem] hover:-translate-y-1 transition-all duration-300 group">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-emerald-500 transition-colors">
              {t("admin.financials_inputs.payrolls_loans")}
            </p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">EGP {fmt(stats.totalPayrolls + stats.totalLoans)}</p>
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent my-8"></div>

      {/* ---------------- BANK SECTION ---------------- */}
      <div className="space-y-4">
        {/* Bank Balance Hero */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-8 md:p-10 rounded-[2rem] shadow-2xl shadow-indigo-900/20 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:opacity-10 transition-opacity duration-700"></div>
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-300 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
          
          <div className="absolute top-1/2 right-8 -translate-y-1/2 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Landmark size={160} />
          </div>

          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2 text-indigo-200 font-bold uppercase tracking-[0.2em] text-xs">
              <Landmark className="h-4 w-4" />
              {t("admin.financials_inputs.lifetime_bank_balance")}
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter drop-shadow-sm flex items-baseline gap-2">
              <span className="text-3xl md:text-4xl text-indigo-200 font-bold tracking-normal">EGP</span>
              {fmt(stats.bankMoney)}
            </h1>
            <p className="text-indigo-100/80 font-medium text-sm max-w-2xl leading-relaxed">
              {t("admin.financials_inputs.bank_formula")}
            </p>
          </div>
        </div>

        {/* Bank Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md p-5 rounded-[1.25rem] hover:-translate-y-1 transition-all duration-300 group">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 group-hover:text-blue-500 transition-colors">{t("admin.financials_inputs.visa_sales")}</p>
            <p className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">EGP {fmt(stats.totalVisaSales)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md p-5 rounded-[1.25rem] hover:-translate-y-1 transition-all duration-300 group">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 group-hover:text-blue-500 transition-colors">{t("admin.financials_inputs.bank_payments")}</p>
            <p className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">EGP {fmt(stats.totalBankPayments)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md p-5 rounded-[1.25rem] hover:-translate-y-1 transition-all duration-300 group">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 group-hover:text-blue-500 transition-colors">{t("admin.financials_inputs.bank_tax_paid")}</p>
            <p className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">EGP {fmt(stats.totalBankTaxPaid)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md p-5 rounded-[1.25rem] hover:-translate-y-1 transition-all duration-300 group">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 group-hover:text-blue-500 transition-colors">{t("admin.financials_inputs.bank_credits")}</p>
            <p className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">EGP {fmt(stats.totalBankCredits)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md p-5 rounded-[1.25rem] hover:-translate-y-1 transition-all duration-300 group">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 group-hover:text-emerald-500 transition-colors">{t("admin.financials_inputs.deposits_in")}</p>
            <p className="text-lg font-black text-emerald-600 tracking-tight">+ EGP {fmt(stats.depositsToBank)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md p-5 rounded-[1.25rem] hover:-translate-y-1 transition-all duration-300 group">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 group-hover:text-rose-500 transition-colors">{t("admin.financials_inputs.deposits_out")}</p>
            <p className="text-lg font-black text-rose-500 tracking-tight">- EGP {fmt(stats.depositsFromBank)}</p>
          </div>
        </div>
      </div>

    </div>
  );
}
