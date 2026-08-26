"use client";

import React, { useState, useEffect } from "react";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getAggregateFromServer, sum, Timestamp } from "firebase/firestore";
import { 
  Printer, 
  Loader2, 
  Calendar, 
  AlertTriangle, 
  ExternalLink, 
  TrendingUp, 
  Building2, 
  Wallet, 
  Landmark, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Receipt, 
  Users, 
  DollarSign, 
  ShieldCheck, 
  CheckCircle2,
  Sparkles,
  FileSpreadsheet
} from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import QRCode from "react-qr-code";
import { toast } from "sonner";

export default function SafeReportPage() {
  const { currentBranch } = useBranch();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [reportType, setReportType] = useState<"date" | "month" | "year">("date");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [missingIndexes, setMissingIndexes] = useState<string[]>([]);
  const [managerName, setManagerName] = useState("Store Manager");

  // Quick date shortcuts
  const todayStr = new Date().toISOString().split("T")[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const thisMonthStr = new Date().toISOString().slice(0, 7);
  const lastMonthDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    const storedName = localStorage.getItem("circlek_user_name");
    if (storedName) {
      setManagerName(storedName);
    } else {
      const u = auth.currentUser;
      if (u) {
        setManagerName(u.displayName || u.email?.split("@")[0] || "Store Manager");
      }
    }
  }, []);

  const handlePrint = () => {
    if (reportData) {
      window.print();
    }
  };

  const getBranchIds = (): string[] => {
    if (currentBranch === "alamein4") return ["alamein4", "eL-alamein-4", "el-alamein-4"];
    if (currentBranch === "ola") return ["ola", "ola-el-koronfol"];
    if (currentBranch !== "all") return [currentBranch];
    return [];
  };

  const getBranchLabel = () => {
    if (currentBranch === "all") return { en: "ALL BRANCHES — CONSOLIDATED", ar: "جميع الفروع — الموقف الموحد" };
    if (currentBranch === "alamein4") return { en: "EL ALAMEIN 4 — FRANCHISE", ar: "فرع العلمين 4" };
    if (currentBranch === "ola") return { en: "OLA EL KORONFOL — FRANCHISE", ar: "فرع أولا القرنفل" };
    return { en: String(currentBranch).toUpperCase(), ar: String(currentBranch) };
  };

  // Safe and Bank account numbers
  const getAccountNumbers = () => {
    if (currentBranch === "ola") {
      return {
        safeCode: "SAFE-OLA-02",
        safeCodeAr: "خزنة فرع أولا القرنفل (رئيسية)",
        bankAccount: "CIB-EGP-992014-OLA",
        bankAccountAr: "البنك التجاري الدولي - CIB (أولا القرنفل)"
      };
    }
    return {
      safeCode: "SAFE-ALAMEIN-01",
      safeCodeAr: "خزنة فرع العلمين 4 (رئيسية)",
      bankAccount: "CIB-EGP-883021-ALM",
      bankAccountAr: "البنك التجاري الدولي - CIB (العلمين 4)"
    };
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
        } else {
          console.error("Query Error:", err);
        }
        return null;
      }
    };

    let salesQ: any = collection(db, "sales");
    let cashPaymentsQ: any = query(collection(db, "cash_payments"), where("method", "==", "cash"));
    let depositsToSafeQ: any = query(collection(db, "deposits"), where("to", "==", "safe"));
    let depositsFromSafeQ: any = query(collection(db, "deposits"), where("from", "==", "safe"));
    let payrollsQ: any = collection(db, "payroll_lines");
    let newLoansQ: any = query(collection(db, "adjustments"), where("type", "==", "loan"));
    let oldLoansQ: any = collection(db, "loans");
    
    // Bank Inflows & Outflows
    let cashPaymentsVisaQ: any = query(collection(db, "cash_payments"), where("method", "==", "visa"));
    let cashPaymentsBankTransferQ: any = query(collection(db, "cash_payments"), where("method", "==", "bank_transfer"));
    let cashPaymentsBankQ: any = query(collection(db, "cash_payments"), where("method", "==", "bank"));
    let depositsToBankQ: any = query(collection(db, "deposits"), where("to", "==", "bank"));
    let depositsFromBankQ: any = query(collection(db, "deposits"), where("from", "==", "bank"));

    if (branchIds.length > 0) {
      salesQ = query(salesQ, where("storeId", "in", branchIds));
      cashPaymentsQ = query(cashPaymentsQ, where("storeId", "in", branchIds));
      depositsToSafeQ = query(depositsToSafeQ, where("storeId", "in", branchIds));
      depositsFromSafeQ = query(depositsFromSafeQ, where("storeId", "in", branchIds));
      payrollsQ = query(payrollsQ, where("storeId", "in", branchIds));
      newLoansQ = query(newLoansQ, where("storeId", "in", branchIds));
      oldLoansQ = query(oldLoansQ, where("storeId", "in", branchIds));
      cashPaymentsVisaQ = query(cashPaymentsVisaQ, where("storeId", "in", branchIds));
      cashPaymentsBankTransferQ = query(cashPaymentsBankTransferQ, where("storeId", "in", branchIds));
      cashPaymentsBankQ = query(cashPaymentsBankQ, where("storeId", "in", branchIds));
      depositsToBankQ = query(depositsToBankQ, where("storeId", "in", branchIds));
      depositsFromBankQ = query(depositsFromBankQ, where("storeId", "in", branchIds));
    }

    if (isHistorical) {
      salesQ = query(salesQ, where("date", "<", startStr));
      cashPaymentsQ = query(cashPaymentsQ, where("date", "<", startStr));
      depositsToSafeQ = query(depositsToSafeQ, where("date", "<", startStr));
      depositsFromSafeQ = query(depositsFromSafeQ, where("date", "<", startStr));
      newLoansQ = query(newLoansQ, where("date", "<", startStr));
      oldLoansQ = query(oldLoansQ, where("date", "<", startStr));
      cashPaymentsVisaQ = query(cashPaymentsVisaQ, where("date", "<", startStr));
      cashPaymentsBankTransferQ = query(cashPaymentsBankTransferQ, where("date", "<", startStr));
      cashPaymentsBankQ = query(cashPaymentsBankQ, where("date", "<", startStr));
      depositsToBankQ = query(depositsToBankQ, where("date", "<", startStr));
      depositsFromBankQ = query(depositsFromBankQ, where("date", "<", startStr));
      const startTs = Timestamp.fromDate(new Date(`${startStr}T00:00:00`));
      payrollsQ = query(payrollsQ, where("createdAt", "<", startTs));
    } else {
      salesQ = query(salesQ, where("date", ">=", startStr), where("date", "<=", endStr));
      cashPaymentsQ = query(cashPaymentsQ, where("date", ">=", startStr), where("date", "<=", endStr));
      depositsToSafeQ = query(depositsToSafeQ, where("date", ">=", startStr), where("date", "<=", endStr));
      depositsFromSafeQ = query(depositsFromSafeQ, where("date", ">=", startStr), where("date", "<=", endStr));
      newLoansQ = query(newLoansQ, where("date", ">=", startStr), where("date", "<=", endStr));
      oldLoansQ = query(oldLoansQ, where("date", ">=", startStr), where("date", "<=", endStr));
      cashPaymentsVisaQ = query(cashPaymentsVisaQ, where("date", ">=", startStr), where("date", "<=", endStr));
      cashPaymentsBankTransferQ = query(cashPaymentsBankTransferQ, where("date", ">=", startStr), where("date", "<=", endStr));
      cashPaymentsBankQ = query(cashPaymentsBankQ, where("date", ">=", startStr), where("date", "<=", endStr));
      depositsToBankQ = query(depositsToBankQ, where("date", ">=", startStr), where("date", "<=", endStr));
      depositsFromBankQ = query(depositsFromBankQ, where("date", ">=", startStr), where("date", "<=", endStr));
      const startTs = Timestamp.fromDate(new Date(`${startStr}T00:00:00`));
      const endTs = Timestamp.fromDate(new Date(`${endStr!}T23:59:59`));
      payrollsQ = query(payrollsQ, where("createdAt", ">=", startTs), where("createdAt", "<=", endTs));
    }

    const [
      salesData, cashPaymentsData, depositsToSafeData, depositsFromSafeData, payrollsData,
      newLoansData, oldLoansData, visaPaymentsData,
      bankTransferPaymentsData, cashPaymentsBankData,
      depositsToBankData, depositsFromBankData
    ] = await Promise.all([
      safeSumAgg(salesQ, { cash: sum("cash"), overShort: sum("overShort"), visa: sum("visa") }),
      safeSumAgg(cashPaymentsQ, { val: sum("amount"), tax: sum("tax") }),
      safeSumAgg(depositsToSafeQ, { val: sum("amount") }),
      safeSumAgg(depositsFromSafeQ, { val: sum("amount") }),
      safeSumAgg(payrollsQ, { val: sum("netPay") }),
      safeSumAgg(newLoansQ, { val: sum("amount") }),
      safeSumAgg(oldLoansQ, { val: sum("approved") }),
      safeSumAgg(cashPaymentsVisaQ, { val: sum("amount"), tax: sum("tax") }),
      safeSumAgg(cashPaymentsBankTransferQ, { val: sum("amount"), tax: sum("tax") }),
      safeSumAgg(cashPaymentsBankQ, { val: sum("amount"), tax: sum("tax") }),
      safeSumAgg(depositsToBankQ, { val: sum("amount") }),
      safeSumAgg(depositsFromBankQ, { val: sum("amount") }),
    ]);

    const overShort = salesData?.overShort || 0;
    const salesCash = salesData?.cash || 0;
    const visaSales = salesData?.visa || 0;
    const overAmount = overShort > 0 ? overShort : 0;
    const shortAmount = overShort < 0 ? Math.abs(overShort) : 0;
    
    const totalCashPayments = cashPaymentsData?.val || 0;
    const totalCashTaxes = cashPaymentsData?.tax || 0;
    const depositsToSafe = depositsToSafeData?.val || 0;
    const depositsFromSafe = depositsFromSafeData?.val || 0;
    const totalPayrolls = payrollsData?.val || 0;
    const totalLoans = (newLoansData?.val || 0) + (oldLoansData?.val || 0);

    const bankPayments = (visaPaymentsData?.val || 0) + (bankTransferPaymentsData?.val || 0) + (cashPaymentsBankData?.val || 0);
    const bankTaxes = (visaPaymentsData?.tax || 0) + (bankTransferPaymentsData?.tax || 0) + (cashPaymentsBankData?.tax || 0);
    const depositsToBank = depositsToBankData?.val || 0;
    const depositsFromBank = depositsFromBankData?.val || 0;

    return {
      salesCash, 
      overAmount, 
      shortAmount, 
      visaSales,
      totalCashPayments, 
      totalCashTaxes, 
      depositsToSafe, 
      depositsFromSafe, 
      totalPayrolls,
      totalLoans, 
      bankPayments, 
      bankTaxes, 
      depositsToBank, 
      depositsFromBank,
    };
  };

  const calcBalances = (h: any, p: any) => {
    if (!h || !p) return { openingSafe: 0, openingBank: 0, closingSafe: 0, closingBank: 0 };
    
    const openingSafe = (h.salesCash + h.overAmount + h.depositsToSafe)
      - (h.shortAmount + h.totalCashPayments + h.totalCashTaxes + h.totalLoans + h.depositsFromSafe + h.totalPayrolls);
      
    const openingBank = (h.visaSales + h.depositsToBank)
      - (h.bankPayments + h.bankTaxes + h.depositsFromBank);

    const safeIn = p.salesCash + p.overAmount + p.depositsToSafe;
    const safeOut = p.shortAmount + p.totalCashPayments + p.totalCashTaxes + p.totalLoans + p.depositsFromSafe + p.totalPayrolls;
    
    const bankIn = p.visaSales + p.depositsToBank;
    const bankOut = p.bankPayments + p.bankTaxes + p.depositsFromBank;
    
    return { 
      openingSafe, 
      openingBank, 
      closingSafe: openingSafe + safeIn - safeOut, 
      closingBank: openingBank + bankIn - bankOut 
    };
  };

  const generateReport = async () => {
    setLoading(true);
    setReportData(null);
    setMissingIndexes([]);
    const collectedUrls = new Set<string>();
    const branchIds = getBranchIds();

    try {
      let startDateStr = "", endDateStr = "";
      if (reportType === "date") { 
        startDateStr = selectedDate; 
        endDateStr = selectedDate; 
      } else if (reportType === "month") {
        startDateStr = `${selectedMonth}-01`;
        const [yyyy, mm] = selectedMonth.split("-");
        endDateStr = `${selectedMonth}-${new Date(parseInt(yyyy), parseInt(mm), 0).getDate()}`;
      } else { 
        startDateStr = `${selectedYear}-01-01`; 
        endDateStr = `${selectedYear}-12-31`; 
      }

      const [history, period] = await Promise.all([
        fetchSumsForRange(startDateStr, null, branchIds, collectedUrls),
        fetchSumsForRange(startDateStr, endDateStr, branchIds, collectedUrls),
      ]);

      if (collectedUrls.size > 0) { 
        setMissingIndexes(Array.from(collectedUrls)); 
        setLoading(false); 
        return; 
      }

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
          safeBalance: currBal.closingSafe, 
          bankBalance: currBal.closingBank, 
          isCurrent: true,
        });
      }

      setReportData({ 
        openingSafeBalance, 
        openingBankBalance, 
        period, 
        startDateStr, 
        endDateStr, 
        trendData 
      });
      toast.success(isAr ? "تم توليد تقرير الخزنة والبنك بنجاح!" : "Safe & Bank report generated successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate report: " + err.message);
    } finally { 
      setLoading(false); 
    }
  };

  // Auto generate on branch change or initial load
  useEffect(() => {
    generateReport();
  }, [currentBranch]);

  // Computed display values
  const safeInflows  = reportData ? (reportData.period.salesCash + reportData.period.overAmount + reportData.period.depositsToSafe) : 0;
  const safeOutflows = reportData ? (reportData.period.shortAmount + reportData.period.totalCashPayments + reportData.period.totalCashTaxes + reportData.period.totalLoans + reportData.period.depositsFromSafe + reportData.period.totalPayrolls) : 0;
  const closingSafe  = reportData ? reportData.openingSafeBalance + safeInflows - safeOutflows : 0;
  
  const bankInflows  = reportData ? (reportData.period.visaSales + reportData.period.depositsToBank) : 0;
  const bankOutflows = reportData ? (reportData.period.bankPayments + reportData.period.bankTaxes + reportData.period.depositsFromBank) : 0;
  const closingBank  = reportData ? reportData.openingBankBalance + bankInflows - bankOutflows : 0;

  const fmt = (n: number) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const branchLabel = getBranchLabel();
  const accounts = getAccountNumbers();

  const qrPayload = JSON.stringify({
    branch: branchLabel.en,
    safeCode: accounts.safeCode,
    closingSafe,
    closingBank,
    period: reportData ? (reportType === "date" ? reportData.startDateStr : `${reportData.startDateStr} to ${reportData.endDateStr}`) : todayStr,
    generatedAt: new Date().toISOString(),
    manager: managerName
  });

  return (
    <PageTransition>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 pb-32" dir={isAr ? "rtl" : "ltr"}>
        
        {/* Printable A4 View Styles */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm !important;
            }
            body, html {
              background: #ffffff !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            main, .custom-scrollbar, #__next, div:not(#safe-printable-a4):not(#safe-printable-a4 *) {
              background: transparent !important;
              background-color: transparent !important;
              border: none !important;
              box-shadow: none !important;
            }
            .print\\:hidden, nav, header, aside, .sidebar, footer, .no-print {
              display: none !important;
            }
            #safe-printable-a4 {
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 0 !important;
              background: #ffffff !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              border: none !important;
            }
            table {
              page-break-inside: auto;
              width: 100% !important;
              border-collapse: collapse !important;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
          }
        `}} />

        {/* ── MISSING INDEXES ── */}
        {missingIndexes.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 shadow-sm no-print">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <div>
                <h2 className="text-xl font-bold">Missing Firebase Indexes ({missingIndexes.length})</h2>
                <p className="text-xs text-slate-400 mt-1">Click every button below, wait for them to build in Firebase Console, then generate again.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {missingIndexes.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer"
                  className="bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-sm">
                  Create Index #{i + 1} <ExternalLink className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── CONTROLS & FILTER BAR ── */}
        <div className="bg-[#0B1121] rounded-3xl shadow-xl border border-slate-800 p-5 sm:p-6 space-y-4 no-print">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                <Wallet className="text-emerald-400" size={24} />
                {isAr ? "تقرير رصيد الخزنة والبنك الرسمي" : "Official Safe & Bank Balance Statement"}
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {isAr 
                  ? "تسوية حسابات الخزينة النقدية ومطابقة إيرادات ومصروفات البنك مع الأرصدة الافتتاحية والختامية."
                  : "Complete cash drawer & bank account reconciliations with verified opening and closing balances."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {reportData && (
                <button 
                  onClick={handlePrint}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <Printer size={16} /> {isAr ? "طباعة التقرير A4" : "Print A4 Statement"}
                </button>
              )}
            </div>
          </div>

          {/* Shortcuts & Date Selectors */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{isAr ? "فترات سريعة:" : "Quick Periods:"}</span>
              {[
                { label: isAr ? "اليوم" : "Today", onClick: () => { setReportType("date"); setSelectedDate(todayStr); } },
                { label: isAr ? "أمس" : "Yesterday", onClick: () => { setReportType("date"); setSelectedDate(yesterdayStr); } },
                { label: isAr ? "هذا الشهر" : "This Month", onClick: () => { setReportType("month"); setSelectedMonth(thisMonthStr); } },
                { label: isAr ? "الشهر السابق" : "Last Month", onClick: () => { setReportType("month"); setSelectedMonth(lastMonthStr); } },
              ].map(b => (
                <button 
                  key={b.label} 
                  onClick={b.onClick} 
                  className="border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                className="bg-[#070C18] border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-indigo-500 outline-none"
                value={reportType} 
                onChange={(e: any) => setReportType(e.target.value)}
              >
                <option value="date">{isAr ? "يومي / تاريخ محدد" : "Daily / Specific Date"}</option>
                <option value="month">{isAr ? "شهري" : "Monthly"}</option>
                <option value="year">{isAr ? "سنوي" : "Yearly"}</option>
              </select>

              {reportType === "date" && (
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={e => setSelectedDate(e.target.value)} 
                  className="bg-[#070C18] border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:border-indigo-500 outline-none" 
                />
              )}
              {reportType === "month" && (
                <input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={e => setSelectedMonth(e.target.value)} 
                  className="bg-[#070C18] border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:border-indigo-500 outline-none" 
                />
              )}
              {reportType === "year" && (
                <input 
                  type="number" 
                  min="2020" 
                  max="2100" 
                  value={selectedYear} 
                  onChange={e => setSelectedYear(e.target.value)} 
                  className="bg-[#070C18] border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white w-24 focus:border-indigo-500 outline-none" 
                />
              )}

              <button 
                onClick={generateReport} 
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition-all disabled:opacity-50 active:scale-95 shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                {loading ? (isAr ? "جاري الحساب..." : "Calculating...") : (isAr ? "تحديث التقرير" : "Update Statement")}
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            REPORT DISPLAY (Screen + Print Friendly)
        ══════════════════════════════════════════════════════════════════════ */}
        {reportData && (
          <div id="safe-printable-a4" className="w-full space-y-6">
            
            {/* Main Statement Card */}
            <div className="bg-[#0B1121] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-200">
              
              {/* Header Box */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-black tracking-tight text-red-500 leading-none">CIRCLE K</h1>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                      FRANCHISE OPERATIONS
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Financial Statement &nbsp;·&nbsp; البيان المالي ومطابقة الخزينة
                  </p>
                </div>

                <div className="text-right">
                  <h2 className="text-xl font-black text-white">Safe & Bank Balance Statement</h2>
                  <p className="text-sm font-bold text-emerald-400">تقرير رصيد الخزنة وحساب البنك</p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    &nbsp;·&nbsp;
                    {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              {/* Meta Grid Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-[#070C18] border border-slate-800 rounded-2xl p-4 text-xs font-medium">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{isAr ? "الجهة / الفرع:" : "Entity / Branch:"}</span>
                  <span className="font-black text-white text-sm mt-0.5 block">{branchLabel.en} · {branchLabel.ar}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{isAr ? "فترة التقرير:" : "Reporting Period:"}</span>
                  <span className="font-bold text-indigo-300 font-mono text-xs mt-0.5 block">
                    {reportType === "date" ? reportData.startDateStr : `${reportData.startDateStr}  →  ${reportData.endDateStr}`}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{isAr ? "المسؤول / أعده:" : "Prepared By / Officer:"}</span>
                  <span className="font-bold text-slate-200 mt-0.5 block">{managerName} (Store Manager)</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{isAr ? "كود الخزنة النقدية:" : "Safe Vault Code:"}</span>
                  <span className="font-mono font-black text-emerald-400 mt-0.5 block">{accounts.safeCode} ({accounts.safeCodeAr})</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{isAr ? "الحساب البنكي المعتمد:" : "Bank Account Reference:"}</span>
                  <span className="font-mono font-black text-blue-400 mt-0.5 block">{accounts.bankAccount}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{isAr ? "العملة الرسمية:" : "Currency:"}</span>
                  <span className="font-bold text-slate-300 mt-0.5 block">EGP — الجنيه المصري</span>
                </div>
              </div>

              {/* Executive Summary 4 Cards Grid */}
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 block">
                  {isAr ? "الملخص التنفيذي للأرصدة" : "Executive Balance Summary"}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  
                  {/* Safe Balance */}
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block flex items-center justify-center gap-1">
                      <Wallet size={12} /> {isAr ? "رصيد الخزنة الفعلي" : "Safe Cash Balance"}
                    </span>
                    <span className={`text-2xl font-black font-mono mt-1.5 block tabular-nums ${closingSafe >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
                      {fmt(closingSafe)} <span className="text-xs font-sans">EGP</span>
                    </span>
                  </div>

                  {/* Bank Balance */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider block flex items-center justify-center gap-1">
                      <Landmark size={12} /> {isAr ? "رصيد البنك والفيزا" : "Bank & Visa Balance"}
                    </span>
                    <span className={`text-2xl font-black font-mono mt-1.5 block tabular-nums ${closingBank >= 0 ? "text-blue-300" : "text-rose-400"}`}>
                      {fmt(closingBank)} <span className="text-xs font-sans">EGP</span>
                    </span>
                  </div>

                  {/* Total Outflows */}
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider block flex items-center justify-center gap-1">
                      <ArrowDownLeft size={12} /> {isAr ? "إجمالي المنصرف" : "Total Outflows"}
                    </span>
                    <span className="text-2xl font-black font-mono text-rose-300 mt-1.5 block tabular-nums">
                      {fmt(safeOutflows + bankOutflows)} <span className="text-xs font-sans">EGP</span>
                    </span>
                  </div>

                  {/* Net Combined Liquidity */}
                  <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-black text-indigo-300 uppercase tracking-wider block flex items-center justify-center gap-1">
                      <ShieldCheck size={12} /> {isAr ? "صافي السيولة المجمعة" : "Net Combined Liquidity"}
                    </span>
                    <span className={`text-2xl font-black font-mono mt-1.5 block tabular-nums ${(closingSafe + closingBank) >= 0 ? "text-white" : "text-rose-400"}`}>
                      {fmt(closingSafe + closingBank)} <span className="text-xs font-sans">EGP</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* ── I. SAFE CASH LEDGER ── */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono">I</span>
                    {isAr ? "دفتر أستاذ الخزنة النقدية (Safe Cash Ledger)" : "Safe Cash Ledger & Drawer Reconciliation"}
                  </h3>
                  <span className="text-xs font-mono font-bold text-emerald-400">{accounts.safeCode}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  
                  {/* Safe Inflows */}
                  <div className="bg-[#070C18] border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-black text-emerald-400 border-b border-slate-800/80 pb-2">
                      <span className="flex items-center gap-1"><ArrowUpRight size={14} /> {isAr ? "أ. الوارد النقدي للخزنة (Inflows)" : "A. Safe Cash Inflows"}</span>
                      <span className="font-mono">{fmt(safeInflows)} EGP</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "الرصيد الافتتاحي المنقول" : "Opening Balance (Carried Over)"}</span>
                        <span className="font-mono font-bold text-slate-300">{fmt(reportData.openingSafeBalance)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "مبيعات الكاش من الورديات" : "Physical Sales Cash"}</span>
                        <span className="font-mono font-bold text-white">{fmt(reportData.period.salesCash)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "مبلغ الزيادة بالصندوق (Over Amount)" : "Drawer Surplus Overages"}</span>
                        <span className="font-mono font-bold text-emerald-400">{fmt(reportData.period.overAmount)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-400">{isAr ? "إيداعات وتغذية نقدية للخزنة" : "Deposits & Cash Injections to Safe"}</span>
                        <span className="font-mono font-bold text-indigo-300">{fmt(reportData.period.depositsToSafe)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Safe Outflows */}
                  <div className="bg-[#070C18] border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-black text-rose-400 border-b border-slate-800/80 pb-2">
                      <span className="flex items-center gap-1"><ArrowDownLeft size={14} /> {isAr ? "ب. المنصرف النقدي من الخزنة (Outflows)" : "B. Safe Cash Outflows"}</span>
                      <span className="font-mono">{fmt(safeOutflows)} EGP</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "مبلغ العجز بالصندوق (Shortage)" : "Drawer Cash Shortages"}</span>
                        <span className="font-mono font-bold text-rose-400">{fmt(reportData.period.shortAmount)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "مصروفات وفواتير نقدية" : "Cash Expenses & Invoices"}</span>
                        <span className="font-mono font-bold text-white">{fmt(reportData.period.totalCashPayments)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "ضريبة القيمة المضافة المسددة نقداً" : "Cash VAT / Taxes"}</span>
                        <span className="font-mono font-bold text-slate-300">{fmt(reportData.period.totalCashTaxes)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "سلف وعهد الموظفين" : "Staff Loans & Advances"}</span>
                        <span className="font-mono font-bold text-amber-300">{fmt(reportData.period.totalLoans)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "مسحوبات الرواتب نقداً" : "Cash Payroll Disbursements"}</span>
                        <span className="font-mono font-bold text-indigo-300">{fmt(reportData.period.totalPayrolls)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-400">{isAr ? "تحويلات نقدية مسحوبة للبنك" : "Cash Transferred from Safe to Bank"}</span>
                        <span className="font-mono font-bold text-blue-300">{fmt(reportData.period.depositsFromSafe)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Closing Safe Result Pill */}
                <div className="bg-[#070C18] border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                  <div className="text-xs text-slate-400">
                    <span className="font-mono">{fmt(reportData.openingSafeBalance)}</span> (Opening) + <span className="font-mono">{fmt(safeInflows)}</span> (In) − <span className="font-mono">{fmt(safeOutflows)}</span> (Out)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                      {isAr ? "الرصيد الختامي للخزنة:" : "Closing Safe Balance:"}
                    </span>
                    <span className="text-xl font-black font-mono text-emerald-400">{fmt(closingSafe)} EGP</span>
                  </div>
                </div>
              </div>

              {/* ── II. BANK & VISA LEDGER ── */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-mono">II</span>
                    {isAr ? "دفتر أستاذ الحساب البنكي والفيزا (Bank & Visa Ledger)" : "Bank Account & Card Terminal Ledger"}
                  </h3>
                  <span className="text-xs font-mono font-bold text-blue-400">{accounts.bankAccount}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  
                  {/* Bank Inflows */}
                  <div className="bg-[#070C18] border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-black text-blue-400 border-b border-slate-800/80 pb-2">
                      <span className="flex items-center gap-1"><ArrowUpRight size={14} /> {isAr ? "أ. الوارد البنكي (Bank Inflows)" : "A. Bank Inflows"}</span>
                      <span className="font-mono">{fmt(bankInflows)} EGP</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "رصيد البنك الافتتاحي المنقول" : "Opening Bank Balance"}</span>
                        <span className="font-mono font-bold text-slate-300">{fmt(reportData.openingBankBalance)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "مبيعات الفيزا وماكينات الدفع" : "POS Card / Visa Sales"}</span>
                        <span className="font-mono font-bold text-white">{fmt(reportData.period.visaSales)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-400">{isAr ? "إيداعات وتحويلات نقدية واردة للبنك" : "Deposits & Transfers into Bank"}</span>
                        <span className="font-mono font-bold text-blue-300">{fmt(reportData.period.depositsToBank)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bank Outflows */}
                  <div className="bg-[#070C18] border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-black text-purple-400 border-b border-slate-800/80 pb-2">
                      <span className="flex items-center gap-1"><ArrowDownLeft size={14} /> {isAr ? "ب. المنصرف البنكي (Bank Outflows)" : "B. Bank Outflows"}</span>
                      <span className="font-mono">{fmt(bankOutflows)} EGP</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "مدفوعات ومصروفات بنكية وفيزا" : "Visa & Bank Transfer Payments"}</span>
                        <span className="font-mono font-bold text-white">{fmt(reportData.period.bankPayments)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "ضرائب مسددة بالبنك والفيزا" : "Taxes Paid via Bank/Visa"}</span>
                        <span className="font-mono font-bold text-slate-300">{fmt(reportData.period.bankTaxes)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-400">{isAr ? "مسحوبات وتحويلات خارجة من البنك" : "Withdrawals / Outward Transfers"}</span>
                        <span className="font-mono font-bold text-purple-300">{fmt(reportData.period.depositsFromBank)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Closing Bank Result Pill */}
                <div className="bg-[#070C18] border border-blue-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                  <div className="text-xs text-slate-400">
                    <span className="font-mono">{fmt(reportData.openingBankBalance)}</span> (Opening) + <span className="font-mono">{fmt(bankInflows)}</span> (In) − <span className="font-mono">{fmt(bankOutflows)}</span> (Out)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                      {isAr ? "الرصيد الختامي للبنك:" : "Closing Bank Balance:"}
                    </span>
                    <span className="text-xl font-black font-mono text-blue-400">{fmt(closingBank)} EGP</span>
                  </div>
                </div>
              </div>

              {/* ── III. MONTH-OVER-MONTH TREND (monthly only) ── */}
              {reportType === "month" && reportData.trendData && reportData.trendData.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <TrendingUp className="text-amber-400" size={18} />
                    {isAr ? "الاتجاه الشهري للسيولة (Month-over-Month Trend)" : "Month-over-Month Balance Trend"}
                  </h3>

                  <div className="overflow-x-auto">
                    <table className={`w-full text-xs ${isAr ? "text-right" : "text-left"}`}>
                      <thead>
                        <tr className="bg-[#070C18] border-b border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          <th className="p-3">{isAr ? "الشهر" : "Month"}</th>
                          <th className="p-3 text-center">{isAr ? "رصيد الخزنة" : "Safe Balance"}</th>
                          <th className="p-3 text-center">{isAr ? "رصيد البنك" : "Bank Balance"}</th>
                          <th className="p-3 text-center">{isAr ? "صافي السيولة" : "Net Total"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {reportData.trendData.map((t: any, i: number) => (
                          <tr key={i} className={t.isCurrent ? "bg-indigo-500/10 font-bold" : "hover:bg-slate-800/30"}>
                            <td className="p-3 font-bold text-white">
                              {t.label} {t.isCurrent && <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono font-black">{isAr ? "الحالي" : "CURRENT"}</span>}
                            </td>
                            <td className={`p-3 text-center font-mono font-bold ${t.safeBalance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {fmt(t.safeBalance)}
                            </td>
                            <td className={`p-3 text-center font-mono font-bold ${t.bankBalance >= 0 ? "text-blue-400" : "text-rose-400"}`}>
                              {fmt(t.bankBalance)}
                            </td>
                            <td className="p-3 text-center font-mono font-black text-white">
                              {fmt(t.safeBalance + t.bankBalance)} EGP
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── OFFICIAL APPROVAL & SIGNATURES ── */}
              <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl">
                    <QRCode value={qrPayload} size={54} level="L" />
                  </div>
                  <div>
                    <p className="font-bold text-white font-mono">{accounts.safeCode} / {accounts.bankAccount}</p>
                    <p className="text-[10px] text-slate-400">AUTHENTICATED BY ANH SYSTEM V2.0</p>
                    <p className="text-[9px] text-slate-500">{new Date().toLocaleString("en-GB")}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8 text-center">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase mb-4">{isAr ? "مدير الفرع المسئول" : "Store Manager"}</p>
                    <p className="text-xs font-bold text-slate-200 border-t border-slate-700 pt-1">{managerName}</p>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-500 uppercase mb-4">{isAr ? "الإدارة المالية" : "Finance Controller"}</p>
                    <p className="text-xs font-bold text-slate-200 border-t border-slate-700 pt-1">Circle K HQ Finance</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </PageTransition>
  );
}
