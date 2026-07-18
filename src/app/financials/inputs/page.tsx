"use client";

import React, { useEffect, useState } from "react";
import { collection, query, where, getAggregateFromServer, sum, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Wallet, Landmark, Loader2, AlertTriangle, ShieldCheck, ExternalLink, TrendingUp, DollarSign, ShieldAlert, Package, Activity, CheckCircle } from "lucide-react";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { fetchDashboardData } from "@/lib/dashboard-queries";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import Link from "next/link";
import { motion } from "framer-motion";

export default function FinancialInputsOverview() {
  const { currentBranch } = useBranch();
  const { t } = useLanguage();
  
  const [stats, setStats] = useState({
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
  });

  const [loading, setLoading] = useState(true);
  const [missingIndexes, setMissingIndexes] = useState<string[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [feed, setFeed] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        const result = await fetchDashboardData(currentBranch);
        if (active) {
          setDashboardData(result);
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

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      setMissingIndexes([]);
      
      const collectedUrls = new Set<string>();

      try {
        const branchIds: string[] = [];
        if (currentBranch === "all") {
          // No filter
        } else if (currentBranch === "alamein4") {
          branchIds.push("eL-alamein-4");
        } else if (currentBranch === "ola") {
          branchIds.push("ola-el-koronfol");
        } else {
          branchIds.push(currentBranch);
        }

        // --- ZERO READ: aggregate sums on the server ---
        
        let salesQ: any = collection(db, "sales");
        let cashPaymentsQ: any = query(collection(db, "cash_payments"), where("method", "==", "cash"));
        let depositsToQ: any = query(collection(db, "deposits"), where("to", "==", "safe"));
        let depositsFromQ: any = query(collection(db, "deposits"), where("from", "==", "safe"));
        let payrollsQ: any = collection(db, "payroll_lines");
        let newLoansQ: any = query(collection(db, "adjustments"), where("type", "==", "loan"));
        let oldLoansQ: any = collection(db, "loans");
        let oldCreditsCashQ: any = query(collection(db, "credit_payments"), where("method", "==", "cash"));
        
        // Bank Queries
        let cashPaymentsVisaQ: any = query(collection(db, "cash_payments"), where("method", "==", "visa"));
        let cashPaymentsBankTransferQ: any = query(collection(db, "cash_payments"), where("method", "==", "bank_transfer"));
        let cashPaymentsBankQ: any = query(collection(db, "cash_payments"), where("method", "==", "bank"));
        let creditPaymentsVisaQ: any = query(collection(db, "credit_payments"), where("method", "==", "visa"));
        let creditPaymentsBankTransferQ: any = query(collection(db, "credit_payments"), where("method", "==", "bank_transfer"));
        let creditPaymentsBankQ: any = query(collection(db, "credit_payments"), where("method", "==", "bank"));
        let depositsToBankQ: any = query(collection(db, "deposits"), where("to", "==", "bank"));
        let depositsFromBankQ: any = query(collection(db, "deposits"), where("from", "==", "bank"));

        // If manager, we MUST filter by storeId or Firestore rules will reject with Permission Denied
        if (branchIds.length > 0) {
          salesQ = query(salesQ, where("storeId", "in", branchIds));
          cashPaymentsQ = query(cashPaymentsQ, where("storeId", "in", branchIds));
          depositsToQ = query(depositsToQ, where("storeId", "in", branchIds));
          depositsFromQ = query(depositsFromQ, where("storeId", "in", branchIds));
          payrollsQ = query(payrollsQ, where("storeId", "in", branchIds));
          oldCreditsCashQ = query(oldCreditsCashQ, where("storeId", "in", branchIds));
          newLoansQ = query(newLoansQ, where("storeId", "in", branchIds));
          oldLoansQ = query(oldLoansQ, where("storeId", "in", branchIds));
          
          cashPaymentsVisaQ = query(cashPaymentsVisaQ, where("storeId", "in", branchIds));
          cashPaymentsBankTransferQ = query(cashPaymentsBankTransferQ, where("storeId", "in", branchIds));
          cashPaymentsBankQ = query(cashPaymentsBankQ, where("storeId", "in", branchIds));
          creditPaymentsVisaQ = query(creditPaymentsVisaQ, where("storeId", "in", branchIds));
          creditPaymentsBankTransferQ = query(creditPaymentsBankTransferQ, where("storeId", "in", branchIds));
          creditPaymentsBankQ = query(creditPaymentsBankQ, where("storeId", "in", branchIds));
          depositsToBankQ = query(depositsToBankQ, where("storeId", "in", branchIds));
          depositsFromBankQ = query(depositsFromBankQ, where("storeId", "in", branchIds));
        }

        // Helper for safe fetching
        const safeSumAgg = async (q: any, sumFields: Record<string, ReturnType<typeof sum>>, name: string): Promise<any> => {
          try {
            const agg = await getAggregateFromServer(q, sumFields);
            return agg.data();
          } catch (err: any) {
            if (err.message?.includes("https://console.firebase.google.com")) {
              const urlMatch = err.message.match(/(https:\/\/console\.firebase\.google\.com[^\s]*)/);
              if (urlMatch) collectedUrls.add(urlMatch[0]);
            } else {
              console.error(`Query Error [${name}]:`, err);
            }
            return null;
          }
        };

        const [
          salesData, cashPaymentsData, depositsToData, depositsFromData, payrollsData,
          newLoansData, oldLoansData, oldCreditsCashData, visaPaymentsData,
          bankTransferPaymentsData, visaCreditsData, bankTransferCreditsData, depositsToBankData, depositsFromBankData, visaTaxData, bankTransferTaxData, cashTaxData, cashPaymentsBankData, creditPaymentsBankData, bankTaxData] = await Promise.all([
          safeSumAgg(salesQ, { cash: sum("cash"), overShort: sum("overShort"), visa: sum("visa") }, "sales"),
          safeSumAgg(cashPaymentsQ, { val: sum("amount") }, "cash_payments"),
          safeSumAgg(depositsToQ, { val: sum("amount") }, "deposits_to_safe"),
          safeSumAgg(depositsFromQ, { val: sum("amount") }, "deposits_from_safe"),
          safeSumAgg(payrollsQ, { val: sum("netPay") }, "payroll_lines"),
          safeSumAgg(newLoansQ, { val: sum("amount") }, "adjustments_loans"),
          safeSumAgg(oldLoansQ, { val: sum("approved") }, "loans"),
          safeSumAgg(oldCreditsCashQ, { val: sum("amount") }, "credit_payments_cash"),
          safeSumAgg(cashPaymentsVisaQ, { val: sum("amount") }, "cash_payments_visa"),
          safeSumAgg(cashPaymentsBankTransferQ, { val: sum("amount") }, "cash_payments_bank_transfer"),
          safeSumAgg(creditPaymentsVisaQ, { val: sum("amount") }, "credit_payments_visa"),
          safeSumAgg(creditPaymentsBankTransferQ, { val: sum("amount") }, "credit_payments_bank_transfer"),
          safeSumAgg(depositsToBankQ, { val: sum("amount") }, "deposits_to_bank"),
          safeSumAgg(depositsFromBankQ, { val: sum("amount") }, "deposits_from_bank"),
          safeSumAgg(cashPaymentsVisaQ, { val: sum("tax") }, "cash_payments_visa_tax"),
          safeSumAgg(cashPaymentsBankTransferQ, { val: sum("tax") }, "cash_payments_bank_transfer_tax"),
          safeSumAgg(cashPaymentsQ, { val: sum("tax") }, "cash_payments_tax"),
          safeSumAgg(cashPaymentsBankQ, { val: sum("amount") }, "cash_payments_bank"),
          safeSumAgg(creditPaymentsBankQ, { val: sum("amount") }, "credit_payments_bank"),
          safeSumAgg(cashPaymentsBankQ, { val: sum("tax") }, "cash_payments_bank_tax")
        ]);

        if (collectedUrls.size > 0) {
          setMissingIndexes(Array.from(collectedUrls));
          setLoading(false);
          return;
        }

        const totalSales = (salesData?.cash || 0) + (salesData?.overShort || 0);
        const totalVisaSales = salesData?.visa || 0;

        const totalCashPayments = cashPaymentsData?.val || 0;
        const depositsToSafe = depositsToData?.val || 0;
        const depositsFromSafe = depositsFromData?.val || 0;
        const totalPayrolls = payrollsData?.val || 0;
        const totalNewLoans = newLoansData?.val || 0;
        const totalOldLoans = oldLoansData?.val || 0;
        const totalLoans = totalNewLoans + totalOldLoans;
        const totalOldCreditsCash = oldCreditsCashData?.val || 0;
        const totalTaxPaid = cashTaxData?.val || 0;

        const totalVisaPayments = visaPaymentsData?.val || 0;
        const totalBankTransferPayments = bankTransferPaymentsData?.val || 0;
        const totalBankOnlyPayments = cashPaymentsBankData?.val || 0;
        const totalBankPayments = totalVisaPayments + totalBankTransferPayments + totalBankOnlyPayments;

        const totalVisaTax = visaTaxData?.val || 0;
        const totalBankTransferTax = bankTransferTaxData?.val || 0;
        const totalBankOnlyTax = bankTaxData?.val || 0;
        const totalBankTaxPaid = totalVisaTax + totalBankTransferTax + totalBankOnlyTax;

        const totalVisaCredits = visaCreditsData?.val || 0;
        const totalBankTransferCredits = bankTransferCreditsData?.val || 0;
        const totalBankOnlyCredits = creditPaymentsBankData?.val || 0;
        const totalBankCredits = totalVisaCredits + totalBankTransferCredits + totalBankOnlyCredits;

        const depositsToBank = depositsToBankData?.val || 0;
        const depositsFromBank = depositsFromBankData?.val || 0;

        const safeMoney = totalSales - totalCashPayments + depositsToSafe - depositsFromSafe - totalPayrolls - totalLoans - totalOldCreditsCash - totalTaxPaid;
        const bankMoney = totalVisaSales - totalBankPayments - totalBankTaxPaid - totalBankCredits + depositsToBank - depositsFromBank;

        setStats({
          totalSales,
          totalCashPayments,
          depositsToSafe,
          depositsFromSafe,
          totalPayrolls,
          totalLoans,
          totalOldCreditsCash,
          totalTaxPaid,
          safeMoney,
          totalVisaSales,
          totalBankPayments,
          depositsToBank,
          depositsFromBank,
          totalBankCredits,
          totalBankTaxPaid,
          bankMoney
        });
      } catch (err: any) {
        console.error("Aggregate fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [currentBranch]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500 mb-4" />
        <p className="font-bold">{t("admin.financials_inputs.loading")}</p>
        <p className="text-xs opacity-60 mt-1">{t("admin.financials_inputs.loading_desc")}</p>
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
    <div className="space-y-10 pb-12">
      
      {/* ---------------- NEW DASHBOARD OVERVIEW ---------------- */}
      <div className="space-y-8 mb-12 bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
        {/* Header Section */}
        <div className="flex justify-between items-end border-b border-border pb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <Activity className="h-8 w-8 text-red-600" />
              Overview
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Real-time snapshot of your franchise operations.
            </p>
          </div>
        </div>

        {/* The Pulse: KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Sales */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-border flex flex-col shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl">
                <DollarSign className="h-6 w-6 text-emerald-500" />
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Live
              </span>
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Today's Sales</p>
            <h3 className="text-3xl font-black text-foreground">{kpis?.totalSales?.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">EGP</span></h3>
          </motion.div>

          {/* Card 2: Shortage */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-border flex flex-col shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${Number(kpis?.totalShortage) < -100 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                <Wallet className={`h-6 w-6 ${Number(kpis?.totalShortage) < -100 ? 'text-red-500' : 'text-emerald-500'}`} />
              </div>
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Net Shortage</p>
            <h3 className={`text-3xl font-black ${Number(kpis?.totalShortage) < -100 ? 'text-red-500' : 'text-foreground'}`}>
              {kpis?.totalShortage?.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">EGP</span>
            </h3>
          </motion.div>

          {/* Card 3: Voids */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-border flex flex-col shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-amber-500/10 rounded-xl">
                <ShieldAlert className="h-6 w-6 text-amber-500" />
              </div>
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Voids Today</p>
            <h3 className="text-3xl font-black text-foreground">{kpis?.totalVoids?.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">EGP</span></h3>
          </motion.div>

          {/* Card 4: Expiries */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-border flex flex-col shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Package className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Expiring Tomorrow</p>
            <h3 className="text-3xl font-black text-foreground">{kpis?.expiringTomorrow} <span className="text-sm font-medium text-muted-foreground">Items</span></h3>
          </motion.div>
        </div>

        {/* Main Grid: Chart & Action Center */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* 7-Day Trend Chart */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="xl:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-border shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" /> 7-Day Revenue Trend
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} tickMargin={10} />
                  <YAxis stroke="#888" fontSize={12} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  {currentBranch === 'all' ? (
                    <>
                      <Line type="monotone" dataKey="alamein4" name="El Alamein 4" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="ola" name="Ola Koronfol" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </>
                  ) : (
                    <Line type="monotone" dataKey="total" name={`${currentBranch === 'ola' ? 'Ola Koronfol' : 'El Alamein 4'} Revenue`} stroke="#10b981" strokeWidth={4} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Action Center & Feed */}
          <div className="space-y-6 flex flex-col">
            
            {/* Needs Attention */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="bg-white dark:bg-slate-900 border border-red-500/30 rounded-2xl p-6 flex-grow shadow-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-500">
                <AlertTriangle className="h-5 w-5" /> Needs Attention
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
                    <p className="text-sm font-semibold text-emerald-500">All caught up! No active alerts.</p>
                  </div>
                )}
              </div>
            </motion.div>

          </div>
        </div>

        {/* Live Activity Feed */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" /> Live Activity Feed
          </h3>
          <div className="space-y-4">
            {feed && feed.length > 0 ? (
              feed.map((notif: any, idx: number) => (
                <div key={idx} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'} 
                      &nbsp;&bull;&nbsp; {notif.storeId}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            )}
          </div>
        </motion.div>
      </div>

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
