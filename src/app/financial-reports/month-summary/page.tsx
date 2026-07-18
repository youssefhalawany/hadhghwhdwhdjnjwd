"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getAggregateFromServer, sum, Timestamp } from "firebase/firestore";
import { Banknote, CreditCard, CalendarDays, Loader2, FileText, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, Printer, LayoutDashboard, Search, Package, ShieldAlert, X } from "lucide-react";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import { PageTransition } from "@/components/PageTransition";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, BarChart, Bar, Cell } from "recharts";
import dynamic from "next/dynamic";

export default function MonthSummaryPage() {
  const { currentBranch } = useBranch();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "sales" | "payments" | "credits" | "deposits" | "tmt">("overview");

  // Data State
  const [safeMath, setSafeMath] = useState<any>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [paymentsData, setPaymentsData] = useState<any[]>([]);
  const [creditsData, setCreditsData] = useState<any[]>([]);
  const [depositsData, setDepositsData] = useState<any[]>([]);
  const [tmtData, setTmtData] = useState<any[]>([]);
  
  // Search
  const [searchTerm, setSearchTerm] = useState("");

  const getBranchIds = (): string[] => {
    const branchIds: string[] = [];
    if (currentBranch === "all") {
      // No filter
    } else if (currentBranch === "alamein4") {
      branchIds.push("alamein4", "eL-alamein-4");
    } else if (currentBranch === "ola") {
      branchIds.push("ola", "ola-el-koronfol");
    } else {
      branchIds.push(currentBranch);
    }
    return branchIds;
  };

  const getBranchLabel = () => {
    if (currentBranch === "all") return { en: "ALL BRANCHES — CONSOLIDATED", ar: "جميع الفروع — موحد" };
    if (currentBranch === "alamein4") return { en: "EL ALAMEIN 4", ar: "العلمين 4" };
    if (currentBranch === "ola") return { en: "OLA EL KORONFOL", ar: "أولا القرنفل" };
    return { en: String(currentBranch).toUpperCase(), ar: String(currentBranch) };
  };

  const fetchMonthData = async () => {
    if (!selectedMonth) return;
    setLoading(true);
    setSearchTerm("");
    try {
      const branchIds = getBranchIds();
      const startStr = `${selectedMonth}-01`;
      const [yyyy, mm] = selectedMonth.split("-");
      const endStr = `${selectedMonth}-${new Date(parseInt(yyyy), parseInt(mm), 0).getDate()}`;

      // 1. Fetch Aggregates for Safe Math (Like Safe Report)
      const safeSumAgg = async (q: any, sumFields: Record<string, ReturnType<typeof sum>>): Promise<any> => {
        try {
          const agg = await getAggregateFromServer(q, sumFields);
          return agg.data();
        } catch (err) {
          return null;
        }
      };

      // Aggregate Queries
      let aggSalesQ: any = collection(db, "sales");
      let aggCashPaymentsQ: any = query(collection(db, "cash_payments"), where("method", "==", "cash"));
      let aggDepositsToQ: any = query(collection(db, "deposits"), where("to", "==", "safe"));
      let aggDepositsFromQ: any = query(collection(db, "deposits"), where("from", "==", "safe"));
      let aggPayrollsQ: any = collection(db, "payroll_lines");
      let aggNewLoansQ: any = query(collection(db, "adjustments"), where("type", "==", "loan"));
      let aggOldLoansQ: any = collection(db, "loans");
      let aggOldCreditsCashQ: any = query(collection(db, "credit_payments"), where("method", "==", "cash"));
      
      let aggVisaPaymentsQ: any = query(collection(db, "cash_payments"), where("method", "==", "visa"));
      let aggBankTransferPaymentsQ: any = query(collection(db, "cash_payments"), where("method", "==", "bank_transfer"));

      if (branchIds.length > 0) {
        aggSalesQ = query(aggSalesQ, where("storeId", "in", branchIds));
        aggCashPaymentsQ = query(aggCashPaymentsQ, where("storeId", "in", branchIds));
        aggDepositsToQ = query(aggDepositsToQ, where("storeId", "in", branchIds));
        aggDepositsFromQ = query(aggDepositsFromQ, where("storeId", "in", branchIds));
        aggPayrollsQ = query(aggPayrollsQ, where("storeId", "in", branchIds));
        aggOldCreditsCashQ = query(aggOldCreditsCashQ, where("storeId", "in", branchIds));
        aggNewLoansQ = query(aggNewLoansQ, where("storeId", "in", branchIds));
        aggOldLoansQ = query(aggOldLoansQ, where("storeId", "in", branchIds));
        aggVisaPaymentsQ = query(aggVisaPaymentsQ, where("storeId", "in", branchIds));
        aggBankTransferPaymentsQ = query(aggBankTransferPaymentsQ, where("storeId", "in", branchIds));
      }

      // We need History (before month) and Period (this month)
      const fetchAggForRange = async (isHistory: boolean) => {
        let sQ = aggSalesQ, cpQ = aggCashPaymentsQ, dtQ = aggDepositsToQ, dfQ = aggDepositsFromQ;
        let nlQ = aggNewLoansQ, olQ = aggOldLoansQ, occQ = aggOldCreditsCashQ, prQ = aggPayrollsQ;
        let vpQ = aggVisaPaymentsQ, btQ = aggBankTransferPaymentsQ;

        if (isHistory) {
          sQ = query(sQ, where("date", "<", startStr));
          cpQ = query(cpQ, where("date", "<", startStr));
          dtQ = query(dtQ, where("date", "<", startStr));
          dfQ = query(dfQ, where("date", "<", startStr));
          nlQ = query(nlQ, where("date", "<", startStr));
          olQ = query(olQ, where("date", "<", startStr));
          occQ = query(occQ, where("date", "<", startStr));
          vpQ = query(vpQ, where("date", "<", startStr));
          btQ = query(btQ, where("date", "<", startStr));
          const startTs = Timestamp.fromDate(new Date(`${startStr}T00:00:00`));
          prQ = query(prQ, where("createdAt", "<", startTs));
        } else {
          sQ = query(sQ, where("date", ">=", startStr), where("date", "<=", endStr));
          cpQ = query(cpQ, where("date", ">=", startStr), where("date", "<=", endStr));
          dtQ = query(dtQ, where("date", ">=", startStr), where("date", "<=", endStr));
          dfQ = query(dfQ, where("date", ">=", startStr), where("date", "<=", endStr));
          nlQ = query(nlQ, where("date", ">=", startStr), where("date", "<=", endStr));
          olQ = query(olQ, where("date", ">=", startStr), where("date", "<=", endStr));
          occQ = query(occQ, where("date", ">=", startStr), where("date", "<=", endStr));
          vpQ = query(vpQ, where("date", ">=", startStr), where("date", "<=", endStr));
          btQ = query(btQ, where("date", ">=", startStr), where("date", "<=", endStr));
          const startTs = Timestamp.fromDate(new Date(`${startStr}T00:00:00`));
          const endTs = Timestamp.fromDate(new Date(`${endStr}T23:59:59`));
          prQ = query(prQ, where("createdAt", ">=", startTs), where("createdAt", "<=", endTs));
        }

        const safeSumAggWrap = async (q: any, aggFields: any, name: string) => {
          try {
            return await safeSumAgg(q, aggFields);
          } catch (err: any) {
            console.error(`Permission Error on aggregation for ${name}:`, err);
            return null;
          }
        };

        const [sD, cpD, dtD, dfD, prD, nlD, olD, occD, vpD, btD] = await Promise.all([
          safeSumAggWrap(sQ, { cash: sum("cash"), overShort: sum("overShort"), visa: sum("visa") }, "sales"),
          safeSumAggWrap(cpQ, { val: sum("amount"), tax: sum("tax") }, "cash_payments (cash)"),
          safeSumAggWrap(dtQ, { val: sum("amount") }, "deposits (to)"),
          safeSumAggWrap(dfQ, { val: sum("amount") }, "deposits (from)"),
          safeSumAggWrap(prQ, { val: sum("netPay") }, "payroll_lines"),
          safeSumAggWrap(nlQ, { val: sum("amount") }, "adjustments (loans)"),
          safeSumAggWrap(olQ, { val: sum("approved") }, "loans"),
          safeSumAggWrap(occQ, { val: sum("amount") }, "credit_payments (cash)"),
          safeSumAggWrap(vpQ, { val: sum("amount") }, "cash_payments (visa)"),
          safeSumAggWrap(btQ, { val: sum("amount") }, "cash_payments (bank)")
        ]);

        return {
          salesCash: sD?.cash || 0, overShort: sD?.overShort || 0, visaSales: sD?.visa || 0,
          totalCashPayments: (cpD?.val || 0) + (cpD?.tax || 0),
          totalVisaPayments: (vpD?.val || 0) + (btD?.val || 0),
          depositsToSafe: dtD?.val || 0, depositsFromSafe: dfD?.val || 0,
          totalPayrolls: prD?.val || 0, totalLoans: (nlD?.val || 0) + (olD?.val || 0),
          totalOldCreditsCash: occD?.val || 0
        };
      };

      const [history, period] = await Promise.all([fetchAggForRange(true), fetchAggForRange(false)]);
      
      const openingSafe = (history.salesCash + (history.overShort > 0 ? history.overShort : 0) + history.depositsToSafe)
        - ((history.overShort < 0 ? Math.abs(history.overShort) : 0) + history.totalCashPayments + history.totalLoans + history.depositsFromSafe + history.totalOldCreditsCash + history.totalPayrolls);
      
      const safeIn = period.salesCash + (period.overShort > 0 ? period.overShort : 0) + period.depositsToSafe;
      const safeOut = (period.overShort < 0 ? Math.abs(period.overShort) : 0) + period.totalCashPayments + period.totalLoans + period.depositsFromSafe + period.totalOldCreditsCash + period.totalPayrolls;
      
      setSafeMath({
        openingSafe,
        period,
        closingSafe: openingSafe + safeIn - safeOut
      });

      // 2. Fetch Deep Dive Documents for the Month
      let docSalesQ: any = query(collection(db, "sales"), where("date", ">=", startStr), where("date", "<=", endStr));
      let docPaymentsQ: any = query(collection(db, "cash_payments"), where("date", ">=", startStr), where("date", "<=", endStr));
      let docCreditsQ: any = query(collection(db, "credits"));
      let docDepositsQ: any = query(collection(db, "deposits"), where("date", ">=", startStr), where("date", "<=", endStr));
      let docTmtQ: any = query(collection(db, "tmt_invoices")); 

      if (branchIds.length > 0) {
        docSalesQ = query(docSalesQ, where("storeId", "in", branchIds));
        docPaymentsQ = query(docPaymentsQ, where("storeId", "in", branchIds));
        docCreditsQ = query(docCreditsQ, where("storeId", "in", branchIds));
        docDepositsQ = query(docDepositsQ, where("storeId", "in", branchIds));
        docTmtQ = query(docTmtQ, where("storeId", "in", branchIds));
      }

      const getDocsWrap = async (q: any, name: string) => {
        try {
          return await getDocs(q);
        } catch (err: any) {
          console.error(`Permission Error on getDocs for ${name}:`, err);
          return { docs: [] };
        }
      };

      const [sDocs, pDocs, cDocs, dDocs, tDocs] = await Promise.all([
        getDocsWrap(docSalesQ, "sales (docs)"), 
        getDocsWrap(docPaymentsQ, "payments (docs)"), 
        getDocsWrap(docCreditsQ, "credits (docs)"), 
        getDocsWrap(docDepositsQ, "deposits (docs)"), 
        getDocsWrap(docTmtQ, "tmt_invoices (docs)")
      ]);

      const mapDocs = (snapshot: any) => snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      
      const rawSales = mapDocs(sDocs).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const rawPayments = mapDocs(pDocs).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const rawDeposits = mapDocs(dDocs).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Filter credits and tmt locally since their date fields might vary (createdAt Timestamp vs date string)
      const rawCredits = mapDocs(cDocs).filter((c: any) => {
        let dStr = "";
        if (c.createdAt?.toDate) dStr = c.createdAt.toDate().toISOString();
        else if (c.date) dStr = c.date;
        else if (typeof c.createdAt === 'string') dStr = c.createdAt;
        return dStr >= startStr && dStr <= endStr + "T23:59:59";
      }).sort((a: any, b: any) => new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt).getTime() - new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt).getTime());

      const rawTmt = mapDocs(tDocs).filter((c: any) => {
        const dStr = c.invoiceDate || c.date || "";
        return dStr >= startStr && dStr <= endStr;
      }).sort((a: any, b: any) => new Date(b.invoiceDate || b.date).getTime() - new Date(a.invoiceDate || a.date).getTime());

      setSalesData(rawSales);
      setPaymentsData(rawPayments);
      setDepositsData(rawDeposits);
      setCreditsData(rawCredits);
      setTmtData(rawTmt);

    } catch (error) {
      console.error("Error fetching month summary:", error);
      toast.error("Failed to load month summary data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthData();
  }, [selectedMonth, currentBranch]);

  // Chart Data Calculations
  const chartData = useMemo(() => {
    if (!salesData.length) return [];
    
    // Group sales by day
    const grouped = salesData.reduce((acc, sale) => {
      const d = sale.date;
      if (!acc[d]) acc[d] = { date: d, cash: 0, visa: 0, total: 0 };
      acc[d].cash += (sale.cash || 0);
      acc[d].visa += (sale.visa || 0);
      acc[d].total += (sale.cash || 0) + (sale.visa || 0);
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [salesData]);

  const handlePrint = () => window.print();

  return (
    <PageTransition>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 pb-24">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
                <LayoutDashboard className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                  Month Summary Dashboard
                </h1>
                <p className="text-xs text-slate-500 font-medium">Advanced Monthly Financial Breakdown</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-semibold shadow-sm hover:scale-105 transition-all flex items-center gap-2 text-sm"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
              <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
              <p className="text-slate-500 font-medium animate-pulse">Aggregating Monthly Data...</p>
            </div>
          ) : !safeMath ? (
            <div className="text-center py-20 text-slate-500">No data found or select a month to begin.</div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              
              {/* Top Level Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Banknote className="h-16 w-16 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Sales (Cash + Visa)</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {(safeMath.period.salesCash + safeMath.period.visaSales).toLocaleString()} <span className="text-sm font-normal text-slate-500">EGP</span>
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <ArrowDownRight className="h-16 w-16 text-rose-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Payments (Cash + Visa)</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {(safeMath.period.totalCashPayments + safeMath.period.totalVisaPayments).toLocaleString()} <span className="text-sm font-normal text-slate-500">EGP</span>
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <ArrowUpRight className="h-16 w-16 text-indigo-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Safe Deposits (IN)</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {safeMath.period.depositsToSafe.toLocaleString()} <span className="text-sm font-normal text-slate-500">EGP</span>
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 dark:from-indigo-900 dark:to-violet-900 shadow-md relative overflow-hidden">
                  <p className="text-sm font-medium text-indigo-100 mb-1">Ending Safe Balance</p>
                  <p className="text-3xl font-bold text-white">
                    {safeMath.closingSafe.toLocaleString()} <span className="text-sm font-normal text-indigo-200">EGP</span>
                  </p>
                </div>
              </div>

              {/* Chart Section */}
              {chartData.length > 0 && (
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-500" /> Sales Trend this Month
                  </h3>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(val) => val.split("-")[2]} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                        <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Deep Dive Tabs */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800 scrollbar-hide no-print">
                  {[
                    { id: "overview", label: "Safe Math Overview", icon: LayoutDashboard },
                    { id: "sales", label: `Sales (${salesData.length})`, icon: Banknote },
                    { id: "payments", label: `Payments (${paymentsData.length})`, icon: CreditCard },
                    { id: "credits", label: `Credits (${creditsData.length})`, icon: FileText },
                    { id: "deposits", label: `Deposits (${depositsData.length})`, icon: ArrowUpRight },
                    { id: "tmt", label: `TMT Invoices (${tmtData.length})`, icon: Package },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold whitespace-nowrap transition-colors ${
                        activeTab === tab.id 
                          ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/10" 
                          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      <tab.icon className="h-4 w-4" /> {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {/* OVERVIEW TAB */}
                  {activeTab === "overview" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">Cash IN (To Safe)</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Opening Safe Balance</span><span className="font-semibold">{safeMath.openingSafe.toLocaleString()} EGP</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Sales Cash</span><span className="font-semibold text-emerald-500">+{safeMath.period.salesCash.toLocaleString()} EGP</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Overage (Over)</span><span className="font-semibold text-emerald-500">+{safeMath.period.overShort > 0 ? safeMath.period.overShort.toLocaleString() : 0} EGP</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Deposits To Safe</span><span className="font-semibold text-emerald-500">+{safeMath.period.depositsToSafe.toLocaleString()} EGP</span></div>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">Cash OUT (From Safe)</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Shortage (Short)</span><span className="font-semibold text-rose-500">-{safeMath.period.overShort < 0 ? Math.abs(safeMath.period.overShort).toLocaleString() : 0} EGP</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Cash Payments</span><span className="font-semibold text-rose-500">-{safeMath.period.totalCashPayments.toLocaleString()} EGP</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Loans & Payrolls</span><span className="font-semibold text-rose-500">-{(safeMath.period.totalLoans + safeMath.period.totalPayrolls).toLocaleString()} EGP</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Deposits From Safe</span><span className="font-semibold text-rose-500">-{safeMath.period.depositsFromSafe.toLocaleString()} EGP</span></div>
                            <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Old Credits Paid in Cash</span><span className="font-semibold text-rose-500">-{safeMath.period.totalOldCreditsCash.toLocaleString()} EGP</span></div>
                          </div>
                        </div>
                      </div>
                      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                        <span className="text-lg font-bold">Calculated Closing Safe Balance</span>
                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{safeMath.closingSafe.toLocaleString()} EGP</span>
                      </div>
                    </div>
                  )}

                  {/* SALES TAB */}
                  {activeTab === "sales" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg max-w-sm no-print">
                        <Search className="h-4 w-4 text-slate-400" />
                        <input type="text" placeholder="Search sales by cashier or date..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" />
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium">
                            <tr>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">Shift</th>
                              <th className="px-4 py-3">Cashier</th>
                              <th className="px-4 py-3 text-right">Cash</th>
                              <th className="px-4 py-3 text-right">Visa</th>
                              <th className="px-4 py-3 text-right">Over/Short</th>
                              <th className="px-4 py-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {salesData.filter(s => (s.cashierName?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || s.date.includes(searchTerm)).map((sale, i) => (
                              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-4 py-3 font-medium">{sale.date}</td>
                                <td className="px-4 py-3 capitalize">{sale.shift}</td>
                                <td className="px-4 py-3">{sale.cashierName}</td>
                                <td className="px-4 py-3 text-right">{sale.cash?.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right">{sale.visa?.toLocaleString()}</td>
                                <td className={`px-4 py-3 text-right font-bold ${sale.overShort > 0 ? 'text-emerald-500' : sale.overShort < 0 ? 'text-rose-500' : ''}`}>{sale.overShort?.toLocaleString() || 0}</td>
                                <td className="px-4 py-3 text-right font-bold">{(sale.cash + sale.visa).toLocaleString()}</td>
                              </tr>
                            ))}
                            {salesData.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No sales recorded for this month.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* PAYMENTS TAB */}
                  {activeTab === "payments" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg max-w-sm no-print">
                        <Search className="h-4 w-4 text-slate-400" />
                        <input type="text" placeholder="Search payments by name or category..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" />
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium">
                            <tr>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">Payee / Vendor</th>
                              <th className="px-4 py-3">Category</th>
                              <th className="px-4 py-3">Method</th>
                              <th className="px-4 py-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {paymentsData.filter(p => `${p.name} ${p.category} ${p.method}`.toLowerCase().includes(searchTerm.toLowerCase())).map((pay, i) => (
                              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-4 py-3">{pay.date}</td>
                                <td className="px-4 py-3 font-medium">{pay.name}</td>
                                <td className="px-4 py-3"><span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs">{pay.category}</span></td>
                                <td className="px-4 py-3 uppercase text-xs font-bold text-slate-500">{pay.method}</td>
                                <td className="px-4 py-3 text-right font-bold">{pay.amount?.toLocaleString()}</td>
                              </tr>
                            ))}
                            {paymentsData.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No payments recorded for this month.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* DEPOSITS TAB */}
                  {activeTab === "deposits" && (
                    <div className="space-y-4">
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium">
                            <tr>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">From</th>
                              <th className="px-4 py-3">To</th>
                              <th className="px-4 py-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {depositsData.map((dep, i) => (
                              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-4 py-3">{dep.date}</td>
                                <td className="px-4 py-3 capitalize font-medium text-rose-500">{dep.from}</td>
                                <td className="px-4 py-3 capitalize font-medium text-emerald-500">{dep.to}</td>
                                <td className="px-4 py-3 text-right font-bold">{dep.amount?.toLocaleString()}</td>
                              </tr>
                            ))}
                            {depositsData.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No deposits recorded for this month.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* CREDITS TAB */}
                  {activeTab === "credits" && (
                    <div className="space-y-4">
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium">
                            <tr>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">Client</th>
                              <th className="px-4 py-3 text-right">Total Amount</th>
                              <th className="px-4 py-3 text-right">Paid</th>
                              <th className="px-4 py-3 text-right">Remaining</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {creditsData.map((cred, i) => {
                              const date = cred.createdAt?.toDate ? cred.createdAt.toDate().toISOString().split("T")[0] : cred.date || cred.createdAt;
                              const remaining = (cred.totalAmount || 0) - (cred.paidAmount || 0);
                              return (
                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                  <td className="px-4 py-3">{date}</td>
                                  <td className="px-4 py-3 font-medium">{cred.clientName}</td>
                                  <td className="px-4 py-3 text-right">{cred.totalAmount?.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-emerald-500">{cred.paidAmount?.toLocaleString()}</td>
                                  <td className={`px-4 py-3 text-right font-bold ${remaining > 0 ? 'text-rose-500' : ''}`}>{remaining.toLocaleString()}</td>
                                </tr>
                              );
                            })}
                            {creditsData.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No credits recorded for this month.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TMT INVOICES TAB */}
                  {activeTab === "tmt" && (
                    <div className="space-y-4">
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium">
                            <tr>
                              <th className="px-4 py-3">Invoice Date</th>
                              <th className="px-4 py-3">Invoice #</th>
                              <th className="px-4 py-3">Supplier</th>
                              <th className="px-4 py-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {tmtData.map((tmt, i) => (
                              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-4 py-3">{tmt.invoiceDate || tmt.date}</td>
                                <td className="px-4 py-3 font-medium text-indigo-500">#{tmt.invoiceNumber}</td>
                                <td className="px-4 py-3">{tmt.supplierName}</td>
                                <td className="px-4 py-3 text-right font-bold">{tmt.invoiceTotal?.toLocaleString()}</td>
                              </tr>
                            ))}
                            {tmtData.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No TMT invoices recorded for this month.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
