"use client";

import React, { useState, useRef, useEffect } from "react";
import { useBranch } from "@/context/BranchContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getAggregateFromServer, sum, Timestamp } from "firebase/firestore";
import { Printer, Loader2, Calendar, AlertTriangle, ExternalLink, TrendingUp } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { toast } from "sonner";

export default function SafeReportPage() {
  const { currentBranch } = useBranch();
  const [reportType, setReportType] = useState<"date" | "month" | "year">("date");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [missingIndexes, setMissingIndexes] = useState<string[]>([]);
  const [showStickyBar, setShowStickyBar] = useState(false);

  // Quick date shortcuts
  const todayStr = new Date().toISOString().split("T")[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const thisMonthStr = new Date().toISOString().slice(0, 7);
  const lastMonthDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    if (!reportData) { setShowStickyBar(false); return; }
    const handleScroll = () => setShowStickyBar(window.scrollY > 350);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [reportData]);

  const handlePrint = () => { if (reportData) window.print(); };

  const getBranchIds = (): string[] => {
    if (currentBranch === "alamein4") return ["eL-alamein-4"];
    if (currentBranch === "ola") return ["ola-el-koronfol"];
    if (currentBranch !== "all") return [currentBranch];
    return [];
  };

  const getBranchLabel = () => {
    if (currentBranch === "all") return { en: "ALL BRANCHES — CONSOLIDATED", ar: "جميع الفروع — موحد" };
    if (currentBranch === "alamein4") return { en: "EL ALAMEIN 4", ar: "العلمين 4" };
    if (currentBranch === "ola") return { en: "OLA EL KORONFOL", ar: "أولا القرنفل" };
    return { en: String(currentBranch).toUpperCase(), ar: String(currentBranch) };
  };

  const fetchSumsForRange = async (
    startStr: string,
    endStr: string | null,
    branchIds: string[],
    collectedUrls: Set<string>
  ) => {
    const isHistorical = endStr === null;

    const safeSumAgg = async (q: any, sumFields: Record<string, ReturnType<typeof sum>>): Promise<any> => {
      try {
        const agg = await getAggregateFromServer(q, sumFields);
        return agg.data();
      } catch (err: any) {
        if (err.message?.includes("https://console.firebase.google.com")) {
          const urlMatch = err.message.match(/(https:\/\/console\.firebase\.google\.com[^\s]*)/);
          if (urlMatch) collectedUrls.add(urlMatch[0]);
        } else { console.error("Query Error:", err); }
        return null;
      }
    };

    let salesQ: any = collection(db, "sales");
    let cashPaymentsQ: any = query(collection(db, "cash_payments"), where("method", "==", "cash"));
    let depositsToQ: any = query(collection(db, "deposits"), where("to", "==", "safe"));
    let depositsFromQ: any = query(collection(db, "deposits"), where("from", "==", "safe"));
    let payrollsQ: any = collection(db, "payroll_lines");
    let newLoansQ: any = query(collection(db, "adjustments"), where("type", "==", "loan"));
    let oldLoansQ: any = collection(db, "loans");
    let oldCreditsCashQ: any = query(collection(db, "credit_payments"), where("method", "==", "cash"));
    let cashPaymentsVisaQ: any = query(collection(db, "cash_payments"), where("method", "==", "visa"));
    let cashPaymentsBankTransferQ: any = query(collection(db, "cash_payments"), where("method", "==", "bank_transfer"));
    let cashPaymentsBankQ: any = query(collection(db, "cash_payments"), where("method", "==", "bank"));
    let creditPaymentsVisaQ: any = query(collection(db, "credit_payments"), where("method", "==", "visa"));
    let creditPaymentsBankTransferQ: any = query(collection(db, "credit_payments"), where("method", "==", "bank_transfer"));
    let creditPaymentsBankQ: any = query(collection(db, "credit_payments"), where("method", "==", "bank"));
    let depositsToBankQ: any = query(collection(db, "deposits"), where("to", "==", "bank"));
    let depositsFromBankQ: any = query(collection(db, "deposits"), where("from", "==", "bank"));

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

    if (isHistorical) {
      salesQ = query(salesQ, where("date", "<", startStr));
      cashPaymentsQ = query(cashPaymentsQ, where("date", "<", startStr));
      depositsToQ = query(depositsToQ, where("date", "<", startStr));
      depositsFromQ = query(depositsFromQ, where("date", "<", startStr));
      newLoansQ = query(newLoansQ, where("date", "<", startStr));
      oldLoansQ = query(oldLoansQ, where("date", "<", startStr));
      oldCreditsCashQ = query(oldCreditsCashQ, where("date", "<", startStr));
      cashPaymentsVisaQ = query(cashPaymentsVisaQ, where("date", "<", startStr));
      cashPaymentsBankTransferQ = query(cashPaymentsBankTransferQ, where("date", "<", startStr));
      cashPaymentsBankQ = query(cashPaymentsBankQ, where("date", "<", startStr));
      creditPaymentsVisaQ = query(creditPaymentsVisaQ, where("date", "<", startStr));
      creditPaymentsBankTransferQ = query(creditPaymentsBankTransferQ, where("date", "<", startStr));
      creditPaymentsBankQ = query(creditPaymentsBankQ, where("date", "<", startStr));
      depositsToBankQ = query(depositsToBankQ, where("date", "<", startStr));
      depositsFromBankQ = query(depositsFromBankQ, where("date", "<", startStr));
      const startTs = Timestamp.fromDate(new Date(`${startStr}T00:00:00`));
      payrollsQ = query(payrollsQ, where("createdAt", "<", startTs));
    } else {
      salesQ = query(salesQ, where("date", ">=", startStr), where("date", "<=", endStr));
      cashPaymentsQ = query(cashPaymentsQ, where("date", ">=", startStr), where("date", "<=", endStr));
      depositsToQ = query(depositsToQ, where("date", ">=", startStr), where("date", "<=", endStr));
      depositsFromQ = query(depositsFromQ, where("date", ">=", startStr), where("date", "<=", endStr));
      newLoansQ = query(newLoansQ, where("date", ">=", startStr), where("date", "<=", endStr));
      oldLoansQ = query(oldLoansQ, where("date", ">=", startStr), where("date", "<=", endStr));
      oldCreditsCashQ = query(oldCreditsCashQ, where("date", ">=", startStr), where("date", "<=", endStr));
      cashPaymentsVisaQ = query(cashPaymentsVisaQ, where("date", ">=", startStr), where("date", "<=", endStr));
      cashPaymentsBankTransferQ = query(cashPaymentsBankTransferQ, where("date", ">=", startStr), where("date", "<=", endStr));
      cashPaymentsBankQ = query(cashPaymentsBankQ, where("date", ">=", startStr), where("date", "<=", endStr));
      creditPaymentsVisaQ = query(creditPaymentsVisaQ, where("date", ">=", startStr), where("date", "<=", endStr));
      creditPaymentsBankTransferQ = query(creditPaymentsBankTransferQ, where("date", ">=", startStr), where("date", "<=", endStr));
      creditPaymentsBankQ = query(creditPaymentsBankQ, where("date", ">=", startStr), where("date", "<=", endStr));
      depositsToBankQ = query(depositsToBankQ, where("date", ">=", startStr), where("date", "<=", endStr));
      depositsFromBankQ = query(depositsFromBankQ, where("date", ">=", startStr), where("date", "<=", endStr));
      const startTs = Timestamp.fromDate(new Date(`${startStr}T00:00:00`));
      const endTs = Timestamp.fromDate(new Date(`${endStr!}T23:59:59`));
      payrollsQ = query(payrollsQ, where("createdAt", ">=", startTs), where("createdAt", "<=", endTs));
    }

    const [
      salesData, cashPaymentsData, depositsToData, depositsFromData, payrollsData,
      newLoansData, oldLoansData, oldCreditsCashData, visaPaymentsData,
      bankTransferPaymentsData, visaCreditsData, bankTransferCreditsData,
      depositsToBankData, depositsFromBankData, cashPaymentsBankData, creditPaymentsBankData
    ] = await Promise.all([
      safeSumAgg(salesQ, { cash: sum("cash"), overShort: sum("overShort"), visa: sum("visa") }),
      safeSumAgg(cashPaymentsQ, { val: sum("amount"), tax: sum("tax") }),
      safeSumAgg(depositsToQ, { val: sum("amount") }),
      safeSumAgg(depositsFromQ, { val: sum("amount") }),
      safeSumAgg(payrollsQ, { val: sum("netPay") }),
      safeSumAgg(newLoansQ, { val: sum("amount") }),
      safeSumAgg(oldLoansQ, { val: sum("approved") }),
      safeSumAgg(oldCreditsCashQ, { val: sum("amount") }),
      safeSumAgg(cashPaymentsVisaQ, { val: sum("amount"), tax: sum("tax") }),
      safeSumAgg(cashPaymentsBankTransferQ, { val: sum("amount"), tax: sum("tax") }),
      safeSumAgg(creditPaymentsVisaQ, { val: sum("amount") }),
      safeSumAgg(creditPaymentsBankTransferQ, { val: sum("amount") }),
      safeSumAgg(depositsToBankQ, { val: sum("amount") }),
      safeSumAgg(depositsFromBankQ, { val: sum("amount") }),
      safeSumAgg(cashPaymentsBankQ, { val: sum("amount"), tax: sum("tax") }),
      safeSumAgg(creditPaymentsBankQ, { val: sum("amount") }),
    ]);

    const overShort = salesData?.overShort || 0;
    const salesCash = salesData?.cash || 0;
    const visaSales = salesData?.visa || 0;
    const overAmount = overShort > 0 ? overShort : 0;
    const shortAmount = overShort < 0 ? Math.abs(overShort) : 0;
    const totalCashPayments = cashPaymentsData?.val || 0;
    const totalCashTaxes = cashPaymentsData?.tax || 0;
    const depositsToSafe = depositsToData?.val || 0;
    const depositsFromSafe = depositsFromData?.val || 0;
    const totalPayrolls = payrollsData?.val || 0;
    const totalLoans = (newLoansData?.val || 0) + (oldLoansData?.val || 0);
    const totalOldCreditsCash = oldCreditsCashData?.val || 0;
    const bankPayments = (visaPaymentsData?.val || 0) + (bankTransferPaymentsData?.val || 0) + (cashPaymentsBankData?.val || 0);
    const bankTaxes = (visaPaymentsData?.tax || 0) + (bankTransferPaymentsData?.tax || 0) + (cashPaymentsBankData?.tax || 0);
    const bankCredits = (visaCreditsData?.val || 0) + (bankTransferCreditsData?.val || 0) + (creditPaymentsBankData?.val || 0);
    const depositsToBank = depositsToBankData?.val || 0;
    const depositsFromBank = depositsFromBankData?.val || 0;

    return {
      salesCash, overAmount, shortAmount, visaSales,
      totalCashPayments, totalCashTaxes, depositsToSafe, depositsFromSafe, totalPayrolls,
      totalLoans, totalOldCreditsCash,
      bankPayments, bankTaxes, bankCredits, depositsToBank, depositsFromBank,
    };
  };

  const calcBalances = (h: any, p: any) => {
    if (!h || !p) return { openingSafe: 0, openingBank: 0, closingSafe: 0, closingBank: 0 };
    const openingSafe = (h.salesCash + h.overAmount + h.depositsToSafe)
      - (h.shortAmount + h.totalCashPayments + h.totalCashTaxes + h.totalLoans + h.depositsFromSafe + h.totalOldCreditsCash + h.totalPayrolls);
    const openingBank = (h.visaSales + h.depositsToBank)
      - (h.bankPayments + h.bankTaxes + h.bankCredits + h.depositsFromBank);
    const safeIn = p.salesCash + p.overAmount + p.depositsToSafe;
    const safeOut = p.shortAmount + p.totalCashPayments + p.totalCashTaxes + p.totalLoans + p.depositsFromSafe + p.totalOldCreditsCash + p.totalPayrolls;
    const bankIn = p.visaSales + p.depositsFromSafe;
    const bankOut = p.bankPayments + p.bankTaxes + p.bankCredits + p.depositsToSafe;
    return { openingSafe, openingBank, closingSafe: openingSafe + safeIn - safeOut, closingBank: openingBank + bankIn - bankOut };
  };

  const generateReport = async () => {
    setLoading(true);
    setReportData(null);
    setMissingIndexes([]);
    const collectedUrls = new Set<string>();
    const branchIds = getBranchIds();

    try {
      let startDateStr = "", endDateStr = "";
      if (reportType === "date") { startDateStr = selectedDate; endDateStr = selectedDate; }
      else if (reportType === "month") {
        startDateStr = `${selectedMonth}-01`;
        const [yyyy, mm] = selectedMonth.split("-");
        endDateStr = `${selectedMonth}-${new Date(parseInt(yyyy), parseInt(mm), 0).getDate()}`;
      } else { startDateStr = `${selectedYear}-01-01`; endDateStr = `${selectedYear}-12-31`; }

      const [history, period] = await Promise.all([
        fetchSumsForRange(startDateStr, null, branchIds, collectedUrls),
        fetchSumsForRange(startDateStr, endDateStr, branchIds, collectedUrls),
      ]);

      if (collectedUrls.size > 0) { setMissingIndexes(Array.from(collectedUrls)); setLoading(false); return; }

      const { openingSafe: openingSafeBalance, openingBank: openingBankBalance } = calcBalances(history, period);

      // Month-over-month trend (monthly only)
      let trendData: any[] = [];
      if (reportType === "month") {
        const [yyyy, mm] = selectedMonth.split("-").map(Number);
        const trendMonths = [2, 1].map(i => {
          const d = new Date(yyyy, mm - 1 - i, 1);
          const ty = d.getFullYear(), tmm = d.getMonth() + 1;
          const tmmStr = String(tmm).padStart(2, "0");
          return {
            label: d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
            labelAr: d.toLocaleDateString("ar-EG", { month: "long", year: "numeric" }),
            start: `${ty}-${tmmStr}-01`,
            end: `${ty}-${tmmStr}-${new Date(ty, tmm, 0).getDate()}`,
          };
        });

        const trendResults = await Promise.all(
          trendMonths.map(tm => Promise.all([
            fetchSumsForRange(tm.start, null, branchIds, collectedUrls),
            fetchSumsForRange(tm.start, tm.end, branchIds, collectedUrls),
          ]))
        );

        trendData = trendMonths.map((tm, i) => {
          const [th, tp] = trendResults[i];
          const b = calcBalances(th, tp);
          return { label: tm.label, labelAr: tm.labelAr, safeBalance: b.closingSafe, bankBalance: b.closingBank };
        });

        const currBal = calcBalances(history, period);
        const d = new Date(yyyy, mm - 1, 1);
        trendData.push({
          label: d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
          labelAr: d.toLocaleDateString("ar-EG", { month: "long", year: "numeric" }),
          safeBalance: currBal.closingSafe, bankBalance: currBal.closingBank, isCurrent: true,
        });
      }

      setReportData({ openingSafeBalance, openingBankBalance, period, startDateStr, endDateStr, trendData });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate report: " + err.message);
    } finally { setLoading(false); }
  };

  // Computed display values
  const safeInflows  = reportData ? (reportData.period.salesCash + reportData.period.overAmount + reportData.period.depositsToSafe) : 0;
  const safeOutflows = reportData ? (reportData.period.shortAmount + reportData.period.totalCashPayments + reportData.period.totalCashTaxes + reportData.period.totalLoans + reportData.period.depositsFromSafe + reportData.period.totalOldCreditsCash + reportData.period.totalPayrolls) : 0;
  const closingSafe  = reportData ? reportData.openingSafeBalance + safeInflows - safeOutflows : 0;
  const bankInflows  = reportData ? (reportData.period.visaSales + reportData.period.depositsFromSafe) : 0;
  const bankOutflows = reportData ? (reportData.period.bankPayments + reportData.period.bankTaxes + reportData.period.bankCredits + reportData.period.depositsToSafe) : 0;
  const closingBank  = reportData ? reportData.openingBankBalance + bankInflows - bankOutflows : 0;

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2 });
  const branchLabel = getBranchLabel();
  const sectionNum = (n: number) => reportType === "month" ? ["I", "II", "III", "IV"][n] : ["I", "II", "III"][n];

  return (
    <PageTransition>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 pb-32">

        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body * { visibility: hidden; }
            #print-area, #print-area * { visibility: visible; }
            #print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
            .no-print { display: none !important; }
            @page { size: A4; margin: 8mm; }
            #print-area::before {
              content: 'CONFIDENTIAL • سري';
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              font-size: 64px;
              font-weight: 900;
              color: rgba(0,0,0,0.04);
              z-index: 9999;
              pointer-events: none;
              white-space: nowrap;
              letter-spacing: 0.08em;
              font-family: Arial, sans-serif;
            }
          }
        `}} />

        {/* ── STICKY BAR ── */}
        {showStickyBar && reportData && (
          <div className="fixed top-0 left-0 right-0 z-[100] bg-slate-900 text-white shadow-2xl border-b border-slate-700 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 no-print animate-in slide-in-from-top-1 duration-200">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:block">Live Balance</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">🏦 Safe</span>
                <span className={`font-black text-sm tabular-nums ${closingSafe >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(closingSafe)}</span>
              </div>
              <div className="w-px h-4 bg-slate-600" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">💳 Bank</span>
                <span className={`font-black text-sm tabular-nums ${closingBank >= 0 ? "text-blue-400" : "text-red-400"}`}>{fmt(closingBank)}</span>
              </div>
              <div className="w-px h-4 bg-slate-600" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Σ Total</span>
                <span className={`font-black text-sm tabular-nums ${(closingSafe + closingBank) >= 0 ? "text-white" : "text-red-400"}`}>{fmt(closingSafe + closingBank)}</span>
              </div>
            </div>
            <button onClick={handlePrint} className="bg-white text-slate-900 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-slate-100 active:scale-95 transition-all">
              <Printer className="w-3 h-3" /> Print
            </button>
          </div>
        )}

        {/* ── MISSING INDEXES ── */}
        {missingIndexes.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm no-print">
            <div className="flex items-center gap-3 text-red-700 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <div>
                <h2 className="text-xl font-bold">Missing Firebase Indexes ({missingIndexes.length})</h2>
                <p className="text-sm opacity-90 mt-1">Click every button below, wait for them to build, then generate again.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {missingIndexes.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer"
                  className="bg-white border border-red-300 text-red-700 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm">
                  Create Index #{i + 1} <ExternalLink className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── CONTROLS ── */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-border p-4 space-y-4 no-print">

          {/* Quick Shortcuts */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Quick Select:</span>
            {[
              { label: "Today", onClick: () => { setReportType("date"); setSelectedDate(todayStr); }, color: "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700" },
              { label: "Yesterday", onClick: () => { setReportType("date"); setSelectedDate(yesterdayStr); }, color: "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700" },
              { label: "This Month", onClick: () => { setReportType("month"); setSelectedMonth(thisMonthStr); }, color: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700" },
              { label: "Last Month", onClick: () => { setReportType("month"); setSelectedMonth(lastMonthStr); }, color: "bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700" },
            ].map(b => (
              <button key={b.label} onClick={b.onClick} className={`border px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 ${b.color}`}>{b.label}</button>
            ))}
          </div>

          {/* Main Row */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Report Type</label>
              <select
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={reportType} onChange={(e: any) => setReportType(e.target.value)}
              >
                <option value="date">Daily / Specific Date</option>
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Select Period</label>
              {reportType === "date" && <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />}
              {reportType === "month" && <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />}
              {reportType === "year" && <input type="number" min="2020" max="2100" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500" />}
            </div>
            <button onClick={generateReport} disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors disabled:opacity-50 active:scale-95">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {loading ? "Generating…" : "Generate Report"}
            </button>
            {reportData && (
              <button onClick={handlePrint}
                className="ml-auto bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors active:scale-95">
                <Printer className="w-4 h-4" /> Print Report
              </button>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            PRINT AREA
        ══════════════════════════════════════════════════════════════════════ */}
        {reportData && (
          <div id="print-area" className="bg-white text-black max-w-[860px] mx-auto shadow-2xl print:shadow-none border border-slate-300 font-sans text-[12.5px]">

            {/* ── BILINGUAL HEADER ── */}
            <div style={{ background: "#0f172a", padding: "22px 36px 18px" }} className="flex items-center justify-between">
              <div>
                <div className="text-white font-black text-3xl tracking-tight leading-none">CIRCLE K</div>
                <div style={{ color: "#64748b" }} className="text-[10px] font-bold uppercase tracking-[0.2em] mt-1.5">
                  Financial Statement &nbsp;·&nbsp; البيان المالي
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold text-xl leading-tight">Safe Balance Report</div>
                <div style={{ color: "#34d399" }} className="text-[13px] font-bold leading-tight mt-0.5">تقرير رصيد الخزنة</div>
                <div style={{ color: "#64748b" }} className="text-[10px] font-mono mt-2">
                  {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  &nbsp;·&nbsp;
                  {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
            {/* Red accent stripe */}
            <div style={{ background: "linear-gradient(90deg,#dc2626,#ef4444,#dc2626)", height: "3px" }} />

            <div className="px-9 py-6 space-y-7">

              {/* ── META INFO ── */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }} className="grid grid-cols-2 gap-4 rounded-lg p-4 text-[11.5px]">
                {[
                  ["Entity · الجهة", `${branchLabel.en}  ·  ${branchLabel.ar}`],
                  ["Period · الفترة", reportType === "date" ? reportData.startDateStr : `${reportData.startDateStr}  →  ${reportData.endDateStr}`],
                  ["Prepared By · أعده", "SYSTEM ADMIN  ·  إدارة النظام"],
                  ["Currency · العملة", "EGP — الجنيه المصري"],
                ].map(([label, value], i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span style={{ color: "#64748b" }} className="font-black uppercase text-[9px] tracking-wider w-28 shrink-0 pt-0.5">{label}</span>
                    <span className="font-bold">{value}</span>
                  </div>
                ))}
              </div>

              {/* ── SUMMARY CARDS ── */}
              <div>
                <div style={{ color: "#64748b" }} className="text-[9px] font-black uppercase tracking-[0.18em] mb-2">Executive Summary · الملخص التنفيذي</div>
                <div className="grid grid-cols-4 gap-0 border-2 border-slate-900 divide-x-2 divide-slate-900 text-center overflow-hidden rounded-md">
                  <div style={{ background: "#f0fdf4" }} className="p-3">
                    <div style={{ color: "#166534" }} className="text-[8.5px] font-black uppercase tracking-wider mb-1">Safe Balance · رصيد الخزنة</div>
                    <div style={{ color: closingSafe >= 0 ? "#15803d" : "#dc2626" }} className="text-lg font-black tabular-nums">{fmt(closingSafe)}</div>
                  </div>
                  <div style={{ background: "#eff6ff" }} className="p-3">
                    <div style={{ color: "#1e40af" }} className="text-[8.5px] font-black uppercase tracking-wider mb-1">Bank Balance · رصيد البنك</div>
                    <div style={{ color: closingBank >= 0 ? "#1d4ed8" : "#dc2626" }} className="text-lg font-black tabular-nums">{fmt(closingBank)}</div>
                  </div>
                  <div style={{ background: "#fef2f2" }} className="p-3">
                    <div style={{ color: "#991b1b" }} className="text-[8.5px] font-black uppercase tracking-wider mb-1">Total Outflows · إجمالي الخارج</div>
                    <div style={{ color: "#dc2626" }} className="text-lg font-black tabular-nums">{fmt(safeOutflows + bankOutflows)}</div>
                  </div>
                  <div style={{ background: (closingSafe + closingBank) >= 0 ? "#0f172a" : "#7f1d1d" }} className="p-3">
                    <div style={{ color: "#94a3b8" }} className="text-[8.5px] font-black uppercase tracking-wider mb-1">Net Total · الإجمالي الصافي</div>
                    <div className="text-lg font-black text-white tabular-nums">{fmt(closingSafe + closingBank)}</div>
                  </div>
                </div>
              </div>

              {/* ── CASH FLOW BAR CHART ── */}
              <div>
                <div style={{ color: "#64748b" }} className="text-[9px] font-black uppercase tracking-[0.18em] mb-2">Cash Flow Visual · رسم بياني للتدفق النقدي</div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }} className="rounded-lg p-4 space-y-3">
                  {/* Safe bar */}
                  {[
                    { label: "🏦 Safe (الخزنة)", inAmt: safeInflows, outAmt: safeOutflows, inColor: "#16a34a", outColor: "#dc2626" },
                    { label: "💳 Bank (البنك)", inAmt: bankInflows, outAmt: bankOutflows, inColor: "#2563eb", outColor: "#7c3aed" },
                  ].map(bar => {
                    const tot = Math.max(bar.inAmt + bar.outAmt, 1);
                    const inPct = (bar.inAmt / tot * 100).toFixed(1);
                    const outPct = (bar.outAmt / tot * 100).toFixed(1);
                    return (
                      <div key={bar.label}>
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                          <span>{bar.label}</span>
                          <span style={{ color: "#64748b" }}>{inPct}% In · {outPct}% Out</span>
                        </div>
                        <div className="flex h-6 rounded overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                          {bar.inAmt > 0 && (
                            <div style={{ width: `${inPct}%`, background: bar.inColor }} className="flex items-center justify-center text-white text-[8px] font-black overflow-hidden">{fmt(bar.inAmt)}</div>
                          )}
                          {bar.outAmt > 0 && (
                            <div style={{ width: `${outPct}%`, background: bar.outColor }} className="flex items-center justify-center text-white text-[8px] font-black overflow-hidden">{fmt(bar.outAmt)}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-3 text-[9px] font-bold pt-1">
                    {[
                      { color: "#16a34a", label: "Safe In (داخل الخزنة)" },
                      { color: "#dc2626", label: "Safe Out (خارج الخزنة)" },
                      { color: "#2563eb", label: "Bank In (داخل البنك)" },
                      { color: "#7c3aed", label: "Bank Out (خارج البنك)" },
                    ].map(l => (
                      <span key={l.label} className="flex items-center gap-1">
                        <span style={{ background: l.color, width: 10, height: 8, display: "inline-block", borderRadius: 2 }} />
                        {l.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── I. SAFE CASH LEDGER ── */}
              <div className="space-y-3">
                <h3 style={{ background: "#1e3a5f", color: "white" }} className="text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded">
                  {sectionNum(0)}. Safe Cash Ledger · دفتر أستاذ الخزنة النقدية
                </h3>

                {/* A – Inflows */}
                <div>
                  <div style={{ background: "#dcfce7", color: "#166534" }} className="text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded mb-1.5">
                    A. Cash Inflows · التدفقات النقدية الداخلة ↑
                  </div>
                  <table className="w-full text-[11.5px] rounded overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                    <thead>
                      <tr style={{ background: "#f0fdf4" }}>
                        {["Description · البيان", "Notes · ملاحظات", "Amount (EGP) · المبلغ"].map((h, i) => (
                          <th key={i} className={`py-1.5 px-3 font-black uppercase tracking-wider text-[8.5px] ${i === 2 ? "text-right w-36" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr style={{ background: "#fafafa" }}>
                        <td className="py-1.5 px-3 font-semibold" style={{ color: "#475569" }}>Opening Balance · الرصيد الافتتاحي</td>
                        <td className="py-1.5 px-3 text-[10px] italic" style={{ color: "#94a3b8" }}>Carried forward · منقول من السابق</td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold" style={{ color: "#64748b" }}>{fmt(reportData.openingSafeBalance)}</td>
                      </tr>
                      {[
                        ["Sales Cash · المبيعات النقدية", "Physical cash from shifts · نقدية الوردية", reportData.period.salesCash],
                        ["Over Amount · مبلغ الزيادة", "Drawer surplus · زيادة الصندوق", reportData.period.overAmount],
                        ["Deposits to Safe · إيداعات إلى الخزنة", "Cash injected from bank · تحويل من البنك", reportData.period.depositsToSafe],
                      ].map(([d, n, v]) => (
                        <tr key={String(d)}>
                          <td className="py-1.5 px-3">{d}</td>
                          <td className="py-1.5 px-3 text-[10px] italic" style={{ color: "#94a3b8" }}>{n}</td>
                          <td className="py-1.5 px-3 text-right font-mono">{fmt(Number(v))}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "#dcfce7" }}>
                        <td colSpan={2} className="py-2 px-3 text-right font-black uppercase tracking-wider text-[9px]" style={{ color: "#166534" }}>Subtotal Inflows · المجموع الفرعي الداخل</td>
                        <td className="py-2 px-3 text-right font-mono font-black" style={{ color: "#166534" }}>{fmt(safeInflows)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* B – Outflows */}
                <div>
                  <div style={{ background: "#fee2e2", color: "#991b1b" }} className="text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded mb-1.5">
                    B. Cash Outflows · التدفقات النقدية الخارجة ↓
                  </div>
                  <table className="w-full text-[11.5px] rounded overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                    <thead>
                      <tr style={{ background: "#fef2f2" }}>
                        {["Description · البيان", "Notes · ملاحظات", "Amount (EGP) · المبلغ"].map((h, i) => (
                          <th key={i} className={`py-1.5 px-3 font-black uppercase tracking-wider text-[8.5px] ${i === 2 ? "text-right w-36" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        ["Short Amount · مبلغ العجز", "Drawer shortages · عجز الصندوق", reportData.period.shortAmount],
                        ["General Expenses (Cash) · مصاريف عامة (نقدي)", "Direct safe expenditures · مدفوعات من الخزنة", reportData.period.totalCashPayments],
                        ["Taxes Paid (Cash) · الضرائب (نقدي)", "Tax on invoices · ضريبة الفواتير", reportData.period.totalCashTaxes],
                        ["Loans Disbursed · قروض ممنوحة", "Employee loans · قروض الموظفين", reportData.period.totalLoans],
                        ["Deposits (Safe→Bank) · إيداعات (الخزنة←البنك)", "Cash transferred to bank · تحويل للبنك", reportData.period.depositsFromSafe],
                        ["Credit Settlements (Cash) · تسوية ائتمان (نقدي)", "Old debts in cash · ديون قديمة نقداً", reportData.period.totalOldCreditsCash],
                        ["Payroll Disbursements · صرف الرواتب", "Salaries from safe · رواتب من الخزنة", reportData.period.totalPayrolls],
                      ].map(([d, n, v]) => (
                        <tr key={String(d)}>
                          <td className="py-1.5 px-3">{d}</td>
                          <td className="py-1.5 px-3 text-[10px] italic" style={{ color: "#94a3b8" }}>{n}</td>
                          <td className="py-1.5 px-3 text-right font-mono">{fmt(Number(v))}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "#fee2e2" }}>
                        <td colSpan={2} className="py-2 px-3 text-right font-black uppercase tracking-wider text-[9px]" style={{ color: "#991b1b" }}>Subtotal Outflows · المجموع الفرعي الخارج</td>
                        <td className="py-2 px-3 text-right font-mono font-black" style={{ color: "#991b1b" }}>{fmt(safeOutflows)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Closing Safe Balance */}
                <div style={{ background: closingSafe >= 0 ? "#0f172a" : "#7f1d1d" }} className="rounded-lg p-4 text-center">
                  <div className="font-mono text-[9.5px] mb-1.5" style={{ color: "#64748b" }}>
                    {fmt(reportData.openingSafeBalance)} (Opening) + {fmt(safeInflows)} (In) − {fmt(safeOutflows)} (Out) · الرصيد الافتتاحي + الداخل − الخارج
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#94a3b8" }}>Closing Safe Balance · الرصيد الختامي للخزنة = </span>
                    <span className="text-2xl font-black text-white"> {fmt(closingSafe)} EGP</span>
                  </div>
                </div>
              </div>

              {/* ── II. BANK / VISA LEDGER ── */}
              <div className="space-y-3">
                <h3 style={{ background: "#1e3a5f", color: "white" }} className="text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded">
                  {sectionNum(1)}. Bank / Visa Ledger · دفتر أستاذ البنك والفيزا
                </h3>
                <table className="w-full text-[11.5px] rounded overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                  <thead>
                    <tr style={{ background: "#eff6ff" }}>
                      {["Description · البيان", "Notes · ملاحظات", "Amount (EGP) · المبلغ"].map((h, i) => (
                        <th key={i} className={`py-1.5 px-3 font-black uppercase tracking-wider text-[8.5px] ${i === 2 ? "text-right w-36" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr style={{ background: "#dbeafe" }}>
                      <td colSpan={3} className="py-1 px-3 font-black uppercase text-[9px] tracking-widest" style={{ color: "#1e40af" }}>A. Bank Inflows · التدفقات البنكية الداخلة ↑</td>
                    </tr>
                    <tr style={{ background: "#fafafa" }}>
                      <td className="py-1.5 px-3 pl-5 font-semibold" style={{ color: "#475569" }}>Opening Balance · الرصيد الافتتاحي</td>
                      <td className="py-1.5 px-3 text-[10px] italic" style={{ color: "#94a3b8" }}>Carried forward · منقول من السابق</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold" style={{ color: "#64748b" }}>{fmt(reportData.openingBankBalance)}</td>
                    </tr>
                    {[
                      ["Sales Visa · مبيعات الفيزا", "Card terminal settlements · مبيعات البطاقات", reportData.period.visaSales],
                      ["Deposits from Safe · إيداعات من الخزنة", "Cash deposited to bank · نقد أودع في البنك", reportData.period.depositsFromSafe],
                    ].map(([d, n, v]) => (
                      <tr key={String(d)}>
                        <td className="py-1.5 px-3 pl-5">{d}</td>
                        <td className="py-1.5 px-3 text-[10px] italic" style={{ color: "#94a3b8" }}>{n}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{fmt(Number(v))}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#dbeafe" }}>
                      <td colSpan={2} className="py-1.5 px-3 text-right font-bold text-[9px] uppercase tracking-wider" style={{ color: "#1e40af" }}>Subtotal Bank Inflows · مجموع الداخل</td>
                      <td className="py-1.5 px-3 text-right font-mono font-black" style={{ color: "#1e40af" }}>{fmt(bankInflows)}</td>
                    </tr>

                    <tr style={{ background: "#fce7f3" }}>
                      <td colSpan={3} className="py-1 px-3 font-black uppercase text-[9px] tracking-widest" style={{ color: "#9d174d" }}>B. Bank Outflows · التدفقات البنكية الخارجة ↓</td>
                    </tr>
                    {[
                      ["Bank Payments · مدفوعات بنكية", "Transfers & visa expenses · تحويلات ومصاريف", reportData.period.bankPayments],
                      ["Taxes Paid (Bank) · الضرائب (بنك)", "Tax on bank payments · ضريبة المدفوعات البنكية", reportData.period.bankTaxes],
                      ["Credit Payments (Bank) · مدفوعات الائتمان (بنك)", "Debts settled via bank · ديون سددت بالبنك", reportData.period.bankCredits],
                      ["Deposits (Bank→Safe) · إيداعات (البنك←الخزنة)", "Funds withdrawn to safe · سحب للخزنة", reportData.period.depositsToSafe],
                    ].map(([d, n, v]) => (
                      <tr key={String(d)}>
                        <td className="py-1.5 px-3 pl-5">{d}</td>
                        <td className="py-1.5 px-3 text-[10px] italic" style={{ color: "#94a3b8" }}>{n}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{fmt(Number(v))}</td>
                      </tr>
                    ))}
                    <tr style={{ background: closingBank >= 0 ? "#0f172a" : "#7f1d1d", color: "white" }}>
                      <td colSpan={2} className="py-2.5 px-3 text-right font-black uppercase tracking-widest text-[9px]" style={{ color: "#94a3b8" }}>Closing Bank Balance · الرصيد الختامي للبنك</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-xl">{fmt(closingBank)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── III. MONTH-OVER-MONTH TREND (monthly only) ── */}
              {reportType === "month" && reportData.trendData && reportData.trendData.length > 0 && (
                <div className="space-y-3">
                  <h3 style={{ background: "#1e3a5f", color: "white" }} className="text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {sectionNum(2)}. Month-over-Month Trend · الاتجاه الشهري
                  </h3>
                  <table className="w-full text-[11.5px] rounded overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        {["Month · الشهر", "Safe Balance · رصيد الخزنة", "Bank Balance · رصيد البنك", "Total · الإجمالي"].map((h, i) => (
                          <th key={i} className={`py-2 px-3 font-black uppercase tracking-wider text-[8.5px] ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.trendData.map((t: any, i: number) => (
                        <tr key={i} style={t.isCurrent ? { background: "#1e3a5f", color: "white" } : { background: i % 2 === 0 ? "#f8fafc" : "white" }}>
                          <td className="py-2 px-3 font-bold">
                            {t.label}
                            {t.isCurrent && <span style={{ background: "#fbbf24", color: "#000", fontSize: 7, padding: "1px 4px", borderRadius: 3, marginLeft: 4, fontWeight: 900 }}>CURRENT</span>}
                            <div className="text-[9px] font-normal" style={{ color: t.isCurrent ? "#94a3b8" : "#94a3b8" }}>{t.labelAr}</div>
                          </td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${!t.isCurrent ? (t.safeBalance >= 0 ? "text-emerald-700" : "text-red-700") : ""}`}>{fmt(t.safeBalance)}</td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${!t.isCurrent ? (t.bankBalance >= 0 ? "text-blue-700" : "text-red-700") : ""}`}>{fmt(t.bankBalance)}</td>
                          <td className={`py-2 px-3 text-right font-mono font-black ${!t.isCurrent ? ((t.safeBalance + t.bankBalance) >= 0 ? "text-slate-800" : "text-red-700") : ""}`}>{fmt(t.safeBalance + t.bankBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Mini trend bars */}
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }} className="rounded-lg p-3 space-y-2">
                    <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: "#64748b" }}>Balance Trend · اتجاه الرصيد</div>
                    {reportData.trendData.map((t: any, i: number) => {
                      const maxVal = Math.max(...reportData.trendData.map((x: any) => Math.abs(x.safeBalance + x.bankBalance)), 1);
                      const pct = Math.min(Math.abs(t.safeBalance + t.bankBalance) / maxVal * 100, 100).toFixed(1);
                      const isPos = (t.safeBalance + t.bankBalance) >= 0;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[9px] font-bold w-16 shrink-0">{t.label}</span>
                          <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: "#e2e8f0" }}>
                            <div style={{ width: `${pct}%`, background: t.isCurrent ? "#1e3a5f" : isPos ? "#16a34a" : "#dc2626", transition: "width 0.3s" }} className="h-full rounded" />
                          </div>
                          <span className="text-[9px] font-black w-28 text-right tabular-nums">{fmt(t.safeBalance + t.bankBalance)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── SIGNATURES ── */}
              <div className="pt-6 border-t-4 border-slate-900">
                <div className="text-[9px] font-black uppercase tracking-widest mb-5" style={{ color: "#64748b" }}>
                  {sectionNum(reportType === "month" ? 3 : 2)}. Authorization & Signatures · التفويض والتوقيعات
                </div>
                <div className="grid grid-cols-3 gap-8">
                  {[
                    { en: "Safe Custodian", ar: "أمين الخزنة" },
                    { en: "Finance Manager", ar: "مدير المالية" },
                    { en: "Branch Manager", ar: "مدير الفرع" },
                  ].map((sig, i) => (
                    <div key={i}>
                      <div style={{ borderBottom: "2px solid #0f172a", height: 52, marginBottom: 6 }} />
                      <p className="text-[11px] font-black uppercase tracking-wider">{sig.en}</p>
                      <p className="text-[11px] font-bold" style={{ color: "#475569" }}>{sig.ar}</p>
                      <p className="text-[9px] uppercase mt-0.5" style={{ color: "#94a3b8" }}>Name & Signature · الاسم والتوقيع</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-5">
                  <div style={{ width: 140, height: 80, border: "2px dashed #94a3b8", borderRadius: 8 }} className="flex items-center justify-center">
                    <span className="text-[9px] font-bold uppercase text-center" style={{ color: "#94a3b8" }}>Official Stamp<br />الختم الرسمي</span>
                  </div>
                </div>
              </div>

              {/* ── FOOTER ── */}
              <div className="text-center pt-4 border-t border-slate-200 space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "#94a3b8" }}>
                  CONFIDENTIAL · سري &nbsp;—&nbsp; Internal Use Only · للاستخدام الداخلي فقط
                </p>
                <p className="text-[9px]" style={{ color: "#94a3b8" }}>
                  This is a system-generated report · هذا تقرير صادر عن النظام تلقائياً — no manual signature required if system-stamped.
                </p>
                <p className="font-mono text-[9px]" style={{ color: "#94a3b8" }}>
                  Generated: {new Date().toLocaleString("en-GB")} &nbsp;|&nbsp; Circle K Franchise Management System
                </p>
              </div>

            </div>
          </div>
        )}

      </div>
    </PageTransition>
  );
}
