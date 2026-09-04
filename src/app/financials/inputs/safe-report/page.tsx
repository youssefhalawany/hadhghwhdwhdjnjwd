"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { 
  Printer, 
  Loader2, 
  Calendar, 
  TrendingUp, 
  Wallet, 
  Landmark, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Receipt, 
  Users, 
  DollarSign, 
  ShieldCheck, 
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Info,
  Layers,
  Sparkles
} from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import QRCode from "react-qr-code";
import { toast } from "sonner";

// Universal date normalizer: handles ISO strings, YYYY-MM-DD, DD/MM/YYYY, Timestamps
function normalizeDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
      return val.slice(0, 10);
    }
    const dmy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy) {
      const [_, d, m, y] = dmy;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  if (val && typeof val.toDate === "function") {
    return val.toDate().toISOString().slice(0, 10);
  }
  if (val && typeof val._seconds === "number") {
    return new Date(val._seconds * 1000).toISOString().slice(0, 10);
  }
  if (val && typeof val.seconds === "number") {
    return new Date(val.seconds * 1000).toISOString().slice(0, 10);
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  return null;
}

// Case-insensitive branch matcher that handles all alias formats
function matchesBranch(docData: any, currentBranch: string): boolean {
  if (!currentBranch || currentBranch === "all") return true;
  const docBranch = (docData.storeId || docData.branchId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = currentBranch.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!docBranch) return true; // Include records without branch so legacy data is never lost
  return docBranch.includes(target) || target.includes(docBranch);
}

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
  const [showItemized, setShowItemized] = useState(false);
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

  const getBranchLabel = () => {
    if (currentBranch === "all") return { en: "ALL BRANCHES — CONSOLIDATED", ar: "جميع الفروع — الموقف الموحد" };
    if (currentBranch === "alamein4") return { en: "EL ALAMEIN 4 — FRANCHISE", ar: "فرع العلمين 4" };
    if (currentBranch === "ola") return { en: "OLA EL KORONFOL — FRANCHISE", ar: "فرع أولا القرنفل" };
    return { en: String(currentBranch).toUpperCase(), ar: String(currentBranch) };
  };

  const getAccountNumbers = () => {
    if (currentBranch === "ola") {
      return {
        safeCode: "SAFE-OLA-02",
        safeCodeAr: "خزنة فرع أولا القرنفل (رئيسية)",
        bankAccount: "BM-EGP-992014-OLA",
        bankName: "Banque Misr",
        bankAccountAr: "بنك مصر - Banque Misr (فرع أولا القرنفل)"
      };
    }
    return {
      safeCode: "SAFE-ALAMEIN-01",
      safeCodeAr: "خزنة فرع العلمين 4 (رئيسية)",
      bankAccount: "BM-EGP-883021-ALM",
      bankName: "Banque Misr",
      bankAccountAr: "بنك مصر - Banque Misr (فرع العلمين 4)"
    };
  };

  // Safe Document Fetching: avoids fragile compound indexes
  const fetchAllFinancialDocs = async () => {
    const safeGetDocs = async (collectionName: string) => {
      try {
        const snap = await getDocs(collection(db, collectionName));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e: any) {
        console.warn(`Could not read ${collectionName}:`, e?.message);
        return [];
      }
    };

    const [
      salesRaw,
      cashPaymentsRaw,
      creditPaymentsRaw,
      depositsRaw,
      payrollsRaw,
      adjustmentsRaw,
      loansRaw,
      employeesRaw
    ] = await Promise.all([
      safeGetDocs("sales"),
      safeGetDocs("cash_payments"),
      safeGetDocs("credit_payments"),
      safeGetDocs("deposits"),
      safeGetDocs("payroll_lines"),
      safeGetDocs("adjustments"),
      safeGetDocs("loans"),
      safeGetDocs("employees")
    ]);

    // Build employees map by ID
    const employeesMap: Record<string, string> = {};
    employeesRaw.forEach((emp: any) => {
      if (emp.id && emp.name) {
        employeesMap[emp.id] = emp.name;
      }
    });

    // Deduplicate credit_payments against cash_payments (so neither missed nor double counted)
    const uniqueCreditPayments: any[] = [];
    creditPaymentsRaw.forEach((cp: any) => {
      const cpAmt = Math.round(Number(cp.amount || cp.total || 0));
      const cpDate = normalizeDate(cp.date || cp.createdAt);
      const cpMethod = (cp.method || "cash").toLowerCase();
      const isDup = cashPaymentsRaw.some((cash: any) => {
        const kAmt = Math.round(Number(cash.amount || cash.total || 0));
        const kDate = normalizeDate(cash.date || cash.createdAt);
        const kMethod = (cash.method || "cash").toLowerCase();
        return (
          (cash.creditId && cash.creditId === cp.creditId) ||
          (cp.invoiceNumber && cash.invoiceNumber && cp.invoiceNumber === cash.invoiceNumber) ||
          (kAmt === cpAmt && kDate === cpDate && kMethod === cpMethod)
        );
      });
      if (!isDup) uniqueCreditPayments.push(cp);
    });

    return {
      sales: salesRaw,
      cashPayments: cashPaymentsRaw,
      uniqueCreditPayments,
      deposits: depositsRaw,
      payrolls: payrollsRaw,
      adjustments: adjustmentsRaw,
      loans: loansRaw,
      employeesMap
    };
  };

  const calculateLedger = (
    docs: any,
    startDateStr: string,
    endDateStr: string,
    targetBranch: string
  ) => {
    let openingSafe = 0;
    let openingBank = 0;

    let periodSalesCash = 0;
    let periodSalesVisa = 0;
    let periodOverAmount = 0;
    let periodShortAmount = 0;

    let periodCashPayments = 0;
    let periodCashTax = 0;
    let periodBankPayments = 0;
    let periodBankTax = 0;

    let periodDepositsToSafe = 0;
    let periodDepositsFromSafe = 0;
    let periodDepositsToBank = 0;
    let periodDepositsFromBank = 0;

    let periodPayrolls = 0;
    let periodBankPayrolls = 0;
    let periodLoans = 0;

    // Itemized list of period transactions for auditability
    const itemizedTransactions: any[] = [];

    // 1. SALES
    docs.sales.forEach((s: any) => {
      if (!matchesBranch(s, targetBranch)) return;
      const d = normalizeDate(s.date || s.createdAt);
      if (!d) return;

      const cash = Number(s.cash || 0);
      const visa = Number(s.visa || 0);
      const os = Number(s.overShort || 0);
      const over = os > 0 ? os : 0;
      const short = os < 0 ? Math.abs(os) : 0;

      if (d < startDateStr) {
        openingSafe += (cash + over - short);
        openingBank += visa;
      } else if (d >= startDateStr && d <= endDateStr) {
        periodSalesCash += cash;
        periodSalesVisa += visa;
        periodOverAmount += over;
        periodShortAmount += short;

        itemizedTransactions.push({
          id: s.id,
          date: d,
          category: "sales",
          titleEn: `Shift Sales Cash (${s.shift || "Day"})`,
          titleAr: `مبيعات وردية نقدية (${s.shift || "يومي"})`,
          safeChange: cash + over - short,
          bankChange: visa,
          details: `Cash: ${cash.toLocaleString()} | Visa: ${visa.toLocaleString()}${os !== 0 ? ` | Over/Short: ${os}` : ""}`
        });
      }
    });

    // 2. CASH & EXPENSE PAYMENTS
    docs.cashPayments.forEach((p: any) => {
      if (!matchesBranch(p, targetBranch)) return;
      const d = normalizeDate(p.date || p.createdAt);
      if (!d) return;

      const method = (p.method || "cash").toLowerCase();
      const amt = Number(p.amount || p.total || 0);
      const tax = Number(p.tax || 0);
      const totalOut = amt + tax;

      if (method === "cash") {
        if (d < startDateStr) {
          openingSafe -= totalOut;
        } else if (d >= startDateStr && d <= endDateStr) {
          periodCashPayments += amt;
          periodCashTax += tax;

          itemizedTransactions.push({
            id: p.id,
            date: d,
            category: "expense_cash",
            titleEn: p.companyName || p.description || p.category || "Cash Expense",
            titleAr: p.companyName || p.description || "مصروف نقدي",
            safeChange: -totalOut,
            bankChange: 0,
            details: `Invoice: ${p.invoiceNumber || "N/A"} | Amt: ${amt.toLocaleString()}${tax > 0 ? ` + Tax: ${tax}` : ""}`
          });
        }
      } else if (["visa", "bank_transfer", "bank"].includes(method)) {
        if (d < startDateStr) {
          openingBank -= totalOut;
        } else if (d >= startDateStr && d <= endDateStr) {
          periodBankPayments += amt;
          periodBankTax += tax;

          itemizedTransactions.push({
            id: p.id,
            date: d,
            category: "expense_bank",
            titleEn: p.companyName || p.description || p.category || "Bank Payment",
            titleAr: p.companyName || p.description || "مدفوعات بنكية",
            safeChange: 0,
            bankChange: -totalOut,
            details: `Method: ${method} | Invoice: ${p.invoiceNumber || "N/A"} | Amt: ${amt.toLocaleString()}`
          });
        }
      }
    });

    // 3. UNIQUE CREDIT SETTLEMENTS (Deduplicated)
    docs.uniqueCreditPayments.forEach((p: any) => {
      if (!matchesBranch(p, targetBranch)) return;
      const d = normalizeDate(p.date || p.createdAt);
      if (!d) return;

      const method = (p.method || "cash").toLowerCase();
      const amt = Number(p.amount || p.total || 0);

      if (method === "cash") {
        if (d < startDateStr) {
          openingSafe -= amt;
        } else if (d >= startDateStr && d <= endDateStr) {
          periodCashPayments += amt;

          itemizedTransactions.push({
            id: p.id,
            date: d,
            category: "credit_settlement_cash",
            titleEn: p.companyName || "Supplier Credit Settlement (Cash)",
            titleAr: p.companyName || "سداد آجل نقدي",
            safeChange: -amt,
            bankChange: 0,
            details: `Credit ID: ${p.creditId || "N/A"} | Amt: ${amt.toLocaleString()}`
          });
        }
      } else if (["visa", "bank_transfer", "bank"].includes(method)) {
        if (d < startDateStr) {
          openingBank -= amt;
        } else if (d >= startDateStr && d <= endDateStr) {
          periodBankPayments += amt;

          itemizedTransactions.push({
            id: p.id,
            date: d,
            category: "credit_settlement_bank",
            titleEn: p.companyName || "Supplier Credit Settlement (Bank)",
            titleAr: p.companyName || "سداد آجل بنكي",
            safeChange: 0,
            bankChange: -amt,
            details: `Method: ${method} | Credit ID: ${p.creditId || "N/A"} | Amt: ${amt.toLocaleString()}`
          });
        }
      }
    });

    // 4. DEPOSITS & FUND MOVEMENTS
    docs.deposits.forEach((dep: any) => {
      if (!matchesBranch(dep, targetBranch)) return;
      const d = normalizeDate(dep.date || dep.createdAt);
      if (!d) return;

      const amt = Number(dep.amount || 0);
      const from = (dep.from || "").toLowerCase();
      const to = (dep.to || "").toLowerCase();

      // Safe Movements
      if (to === "safe") {
        if (d < startDateStr) openingSafe += amt;
        else if (d >= startDateStr && d <= endDateStr) {
          periodDepositsToSafe += amt;
          itemizedTransactions.push({
            id: dep.id,
            date: d,
            category: "deposit_in_safe",
            titleEn: `Cash Injection to Safe (From: ${dep.from || "Owner"})`,
            titleAr: `تغذية نقدية بالخزنة (من: ${dep.from || "المالك"})`,
            safeChange: amt,
            bankChange: 0,
            details: `Deposit: ${amt.toLocaleString()} EGP`
          });
        }
      }
      if (from === "safe") {
        if (d < startDateStr) openingSafe -= amt;
        else if (d >= startDateStr && d <= endDateStr) {
          periodDepositsFromSafe += amt;
          itemizedTransactions.push({
            id: dep.id,
            date: d,
            category: "deposit_out_safe",
            titleEn: `Cash Transferred from Safe (To: ${dep.to || "Bank/Owner"})`,
            titleAr: `تحويل نقدي خارج من الخزنة (إلى: ${dep.to || "البنك/المالك"})`,
            safeChange: -amt,
            bankChange: to === "bank" ? amt : 0,
            details: `Transfer: ${amt.toLocaleString()} EGP`
          });
        }
      }

      // Bank Movements
      if (to === "bank") {
        if (d < startDateStr) openingBank += amt;
        else if (d >= startDateStr && d <= endDateStr) {
          periodDepositsToBank += amt;
          if (from !== "safe") {
            itemizedTransactions.push({
              id: dep.id,
              date: d,
              category: "deposit_in_bank",
              titleEn: `Deposit into Bank Account (From: ${dep.from || "Owner"})`,
              titleAr: `إيداع بنكي وارد (من: ${dep.from || "المالك"})`,
              safeChange: 0,
              bankChange: amt,
              details: `Deposit: ${amt.toLocaleString()} EGP`
            });
          }
        }
      }
      if (from === "bank") {
        if (d < startDateStr) openingBank -= amt;
        else if (d >= startDateStr && d <= endDateStr) {
          periodDepositsFromBank += amt;
          itemizedTransactions.push({
            id: dep.id,
            date: d,
            category: "deposit_out_bank",
            titleEn: `Withdrawal / Transfer from Bank (To: ${dep.to || "Owner"})`,
            titleAr: `مسحوبات / تحويل من البنك (إلى: ${dep.to || "المالك"})`,
            safeChange: to === "safe" ? amt : 0,
            bankChange: -amt,
            details: `Withdrawal: ${amt.toLocaleString()} EGP`
          });
        }
      }
    });

    // 5. PAYROLL DISBURSEMENTS (PRIORITIZE postedToFinanceAt, with employee names)
    docs.payrolls.forEach((pr: any) => {
      if (!matchesBranch(pr, targetBranch)) return;
      // Critical fix: The actual safe disbursement date is postedToFinanceAt / paidDate, NOT the draft createdAt
      const d = normalizeDate(pr.postedToFinanceAt || pr.paidDate || pr.date || pr.createdAt);
      if (!d) return;

      const amt = Number(pr.netPay || pr.amount || 0);
      const method = (pr.paymentMethod || pr.method || "cash").toLowerCase();
      const empName = pr.employeeName || pr.name || docs.employeesMap[pr.employeeId] || (isAr ? "موظف" : "Employee");

      if (method === "cash") {
        if (d < startDateStr) {
          openingSafe -= amt;
        } else if (d >= startDateStr && d <= endDateStr) {
          periodPayrolls += amt;
          itemizedTransactions.push({
            id: pr.id,
            date: d,
            category: "payroll",
            titleEn: `Staff Payroll (Cash): ${empName}`,
            titleAr: `راتب موظف (نقداً): ${empName}`,
            safeChange: -amt,
            bankChange: 0,
            details: `Month: ${pr.month || "N/A"} | Net Pay: ${amt.toLocaleString()} EGP`
          });
        }
      } else {
        // Paid via Bank Transfer / Visa
        if (d < startDateStr) {
          openingBank -= amt;
        } else if (d >= startDateStr && d <= endDateStr) {
          periodBankPayrolls += amt;
          itemizedTransactions.push({
            id: pr.id,
            date: d,
            category: "payroll_bank",
            titleEn: `Staff Payroll (Bank): ${empName}`,
            titleAr: `راتب موظف (بنكي): ${empName}`,
            safeChange: 0,
            bankChange: -amt,
            details: `Month: ${pr.month || "N/A"} | Net Pay: ${amt.toLocaleString()} EGP`
          });
        }
      }
    });

    // 6. STAFF LOANS & ADVANCES
    docs.adjustments.forEach((adj: any) => {
      if (adj.type === "loan") {
        if (!matchesBranch(adj, targetBranch)) return;
        const d = normalizeDate(adj.date || adj.createdAt);
        const amt = Number(adj.amount || 0);
        const empName = adj.employeeName || adj.name || docs.employeesMap[adj.employeeId] || (isAr ? "موظف" : "Employee");

        if (!d || d < startDateStr) {
          openingSafe -= amt;
        } else if (d >= startDateStr && d <= endDateStr) {
          periodLoans += amt;
          itemizedTransactions.push({
            id: adj.id,
            date: d || startDateStr,
            category: "loan",
            titleEn: `Staff Loan / Advance: ${empName}`,
            titleAr: `سلفة موظف: ${empName}`,
            safeChange: -amt,
            bankChange: 0,
            details: `Reason: ${adj.reason || "Advance"} | Amount: ${amt.toLocaleString()} EGP`
          });
        }
      }
    });

    docs.loans.forEach((ln: any) => {
      if (!matchesBranch(ln, targetBranch)) return;
      const d = normalizeDate(ln.date || ln.createdAt);
      const amt = Number(ln.approved || ln.amount || 0);
      const empName = ln.employeeName || ln.name || docs.employeesMap[ln.employeeId] || (isAr ? "موظف" : "Employee");

      if (!d || d < startDateStr) {
        openingSafe -= amt;
      } else if (d >= startDateStr && d <= endDateStr) {
        periodLoans += amt;
        itemizedTransactions.push({
          id: ln.id,
          date: d || startDateStr,
          category: "loan",
          titleEn: `Staff Loan / Advance: ${empName}`,
          titleAr: `سلفة موظف: ${empName}`,
          safeChange: -amt,
          bankChange: 0,
          details: `Reason: ${ln.reason || "Advance"} | Amount: ${amt.toLocaleString()} EGP`
        });
      }
    });

    // Sort itemized transactions by date descending
    itemizedTransactions.sort((a, b) => b.date.localeCompare(a.date));

    // Calculate Final Balanced Sums
    const safeInflows = periodSalesCash + periodOverAmount + periodDepositsToSafe;
    const safeOutflows = periodShortAmount + periodCashPayments + periodCashTax + periodDepositsFromSafe + periodPayrolls + periodLoans;
    const closingSafe = openingSafe + safeInflows - safeOutflows;

    const bankInflows = periodSalesVisa + periodDepositsToBank;
    const bankOutflows = periodBankPayments + periodBankTax + periodDepositsFromBank + periodBankPayrolls;
    const closingBank = openingBank + bankInflows - bankOutflows;

    return {
      startDateStr,
      endDateStr,
      openingSafe,
      openingBank,
      safeInflows,
      safeOutflows,
      closingSafe,
      bankInflows,
      bankOutflows,
      closingBank,
      itemizedTransactions,
      period: {
        salesCash: periodSalesCash,
        overAmount: periodOverAmount,
        shortAmount: periodShortAmount,
        depositsToSafe: periodDepositsToSafe,
        totalCashPayments: periodCashPayments,
        totalCashTaxes: periodCashTax,
        depositsFromSafe: periodDepositsFromSafe,
        totalPayrolls: periodPayrolls,
        totalLoans: periodLoans,
        visaSales: periodSalesVisa,
        depositsToBank: periodDepositsToBank,
        bankPayments: periodBankPayments,
        bankTaxes: periodBankTax,
        depositsFromBank: periodDepositsFromBank
      }
    };
  };

  const generateReport = async () => {
    setLoading(true);
    setReportData(null);

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

      const allDocs = await fetchAllFinancialDocs();
      const result = calculateLedger(allDocs, startDateStr, endDateStr, currentBranch);

      // Month-over-month trend (monthly view only)
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

        trendData = trendMonths.map(tm => {
          const mRes = calculateLedger(allDocs, tm.start, tm.end, currentBranch);
          return {
            label: tm.label,
            labelAr: tm.labelAr,
            safeBalance: mRes.closingSafe,
            bankBalance: mRes.closingBank
          };
        });

        const d = new Date(yyyy, mm - 1, 1);
        trendData.push({
          label: d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
          labelAr: d.toLocaleDateString("ar-EG", { month: "long", year: "numeric" }),
          safeBalance: result.closingSafe,
          bankBalance: result.closingBank,
          isCurrent: true
        });
      }

      setReportData({
        ...result,
        trendData
      });

      toast.success(isAr ? "تم إعداد تقرير الخزنة والبنك بدقة تامة!" : "Safe & Bank statement generated accurately!");
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

  const fmt = (n: number) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const branchLabel = getBranchLabel();
  const accounts = getAccountNumbers();

  const closingSafe = reportData ? reportData.closingSafe : 0;
  const closingBank = reportData ? reportData.closingBank : 0;
  const safeInflows = reportData ? reportData.safeInflows : 0;
  const safeOutflows = reportData ? reportData.safeOutflows : 0;
  const bankInflows = reportData ? reportData.bankInflows : 0;
  const bankOutflows = reportData ? reportData.bankOutflows : 0;

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
              margin: 10mm 12mm 10mm 12mm !important;
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
              text-shadow: none !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body, html {
              background: #ffffff !important;
              background-color: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
            }
            main, .custom-scrollbar, #__next, div:not(#safe-printable-a4):not(#safe-printable-a4 *) {
              background: transparent !important;
              background-color: transparent !important;
              border: none !important;
              box-shadow: none !important;
            }
            .print\\:hidden, nav, header, aside, .sidebar, footer, .no-print, button {
              display: none !important;
            }
            #safe-printable-a4 {
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              background-color: #ffffff !important;
              color: #0f172a !important;
              border: none !important;
            }
            /* Corporate container reset for printing */
            .corporate-sheet {
              background: #ffffff !important;
              background-color: #ffffff !important;
              border: 1.5px solid #0f172a !important;
              border-radius: 8px !important;
              box-shadow: none !important;
              padding: 16px 20px !important;
              color: #0f172a !important;
            }
            .corporate-header {
              border-bottom: 2px solid #0f172a !important;
              padding-bottom: 12px !important;
              margin-bottom: 14px !important;
            }
            .corporate-box {
              background-color: #f8fafc !important;
              border: 1px solid #cbd5e1 !important;
              border-radius: 6px !important;
              color: #0f172a !important;
            }
            .corporate-kpi {
              border: 1px solid #94a3b8 !important;
              border-radius: 6px !important;
              background-color: #f8fafc !important;
              padding: 10px 8px !important;
            }
            .corporate-kpi.safe-card {
              border-top: 3px solid #059669 !important;
              background-color: #f0fdf4 !important;
            }
            .corporate-kpi.bank-card {
              border-top: 3px solid #2563eb !important;
              background-color: #eff6ff !important;
            }
            .corporate-kpi.outflow-card {
              border-top: 3px solid #dc2626 !important;
              background-color: #fef2f2 !important;
            }
            .corporate-kpi.net-card {
              border-top: 3px solid #0f172a !important;
              background-color: #f8fafc !important;
            }
            /* Text overrides for crisp printing */
            .text-white {
              color: #0f172a !important;
            }
            .text-slate-200, .text-slate-300, .text-slate-400 {
              color: #334155 !important;
            }
            .text-slate-500 {
              color: #64748b !important;
            }
            .text-emerald-400, .text-emerald-300 {
              color: #047857 !important;
            }
            .text-blue-400, .text-blue-300 {
              color: #1d4ed8 !important;
            }
            .text-indigo-400, .text-indigo-300 {
              color: #4338ca !important;
            }
            .text-rose-400, .text-rose-300 {
              color: #b91c1c !important;
            }
            .text-amber-400, .text-amber-300 {
              color: #b45309 !important;
            }
            .text-purple-400, .text-purple-300 {
              color: #6b21a8 !important;
            }
            /* Borders inside corporate sheet */
            .border-slate-800, .border-slate-800\\/80, .border-slate-800\\/50, .divide-slate-800\\/50 {
              border-color: #cbd5e1 !important;
            }
            /* Table formatting */
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
            th {
              color: #0f172a !important;
              background-color: #f1f5f9 !important;
              border-bottom: 1.5px solid #94a3b8 !important;
            }
            td {
              color: #1e293b !important;
              border-bottom: 1px solid #e2e8f0 !important;
            }
            .print-avoid-break {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        `}} />

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
                  ? "تسوية نقدية شاملة ومطابقة دقيقة لكافة الإيرادات، المصروفات، السلف، مسحوبات الرواتب، وحساب البنك لكل يوم."
                  : "Verified cash drawer & bank account reconciliations with accurate opening & closing balances for all days."}
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
                {loading ? (isAr ? "جاري الحساب بدقة..." : "Calculating...") : (isAr ? "تحديث التقرير" : "Update Statement")}
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
            <div className="corporate-sheet bg-[#0B1121] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-200">
              
              {/* Header Box */}
              <div className="corporate-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
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
              <div className="corporate-box grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-[#070C18] border border-slate-800 rounded-2xl p-4 text-xs font-medium">
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
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{isAr ? "الحساب البنكي المعتمد (بنك مصر):" : "Bank Account (Banque Misr):"}</span>
                  <span className="font-mono font-black text-blue-400 mt-0.5 block">{accounts.bankAccount} ({accounts.bankName})</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{isAr ? "العملة الرسمية:" : "Currency:"}</span>
                  <span className="font-bold text-slate-300 mt-0.5 block">EGP — الجنيه المصري</span>
                </div>
              </div>

              {/* Executive Summary 4 Cards Grid */}
              <div className="print-avoid-break">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 block">
                  {isAr ? "الملخص التنفيذي للأرصدة" : "Executive Balance Summary"}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  
                  {/* Safe Balance */}
                  <div className="corporate-kpi safe-card bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block flex items-center justify-center gap-1">
                      <Wallet size={12} /> {isAr ? "رصيد الخزنة الفعلي" : "Safe Cash Balance"}
                    </span>
                    <span className={`text-2xl font-black font-mono mt-1.5 block tabular-nums ${closingSafe >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
                      {fmt(closingSafe)} <span className="text-xs font-sans">EGP</span>
                    </span>
                  </div>

                  {/* Bank Balance */}
                  <div className="corporate-kpi bank-card bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider block flex items-center justify-center gap-1">
                      <Landmark size={12} /> {isAr ? "رصيد بنك مصر والفيزا" : "Bank & Visa Balance (Banque Misr)"}
                    </span>
                    <span className={`text-2xl font-black font-mono mt-1.5 block tabular-nums ${closingBank >= 0 ? "text-blue-300" : "text-rose-400"}`}>
                      {fmt(closingBank)} <span className="text-xs font-sans">EGP</span>
                    </span>
                  </div>

                  {/* Total Outflows */}
                  <div className="corporate-kpi outflow-card bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider block flex items-center justify-center gap-1">
                      <ArrowDownLeft size={12} /> {isAr ? "إجمالي المنصرف" : "Total Outflows"}
                    </span>
                    <span className="text-2xl font-black font-mono text-rose-300 mt-1.5 block tabular-nums">
                      {fmt(safeOutflows + bankOutflows)} <span className="text-xs font-sans">EGP</span>
                    </span>
                  </div>

                  {/* Net Combined Liquidity */}
                  <div className="corporate-kpi net-card bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 text-center">
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
              <div className="space-y-4 pt-2 print-avoid-break">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono">I</span>
                    {isAr ? "دفتر أستاذ الخزنة النقدية (Safe Cash Ledger)" : "Safe Cash Ledger & Drawer Reconciliation"}
                  </h3>
                  <span className="text-xs font-mono font-bold text-emerald-400">{accounts.safeCode}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  
                  {/* Safe Inflows */}
                  <div className="corporate-box bg-[#070C18] border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-black text-emerald-400 border-b border-slate-800/80 pb-2">
                      <span className="flex items-center gap-1"><ArrowUpRight size={14} /> {isAr ? "أ. الوارد النقدي للخزنة (Inflows)" : "A. Safe Cash Inflows"}</span>
                      <span className="font-mono">{fmt(safeInflows)} EGP</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "الرصيد الافتتاحي المنقول" : "Opening Balance (Carried Over)"}</span>
                        <span className="font-mono font-bold text-slate-300">{fmt(reportData.openingSafe)}</span>
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
                  <div className="corporate-box bg-[#070C18] border border-slate-800 rounded-2xl p-4 space-y-3">
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
                        <span className="text-slate-400">{isAr ? "مصروفات وفواتير وسداد نقدي" : "Cash Expenses & Settlements"}</span>
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
                        <span className="text-slate-400">{isAr ? "تحويلات نقدية مسحوبة للبنك والمالك" : "Cash Transferred Out of Safe"}</span>
                        <span className="font-mono font-bold text-blue-300">{fmt(reportData.period.depositsFromSafe)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Closing Safe Result Pill */}
                <div className="corporate-box bg-[#070C18] border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                  <div className="text-xs text-slate-400">
                    <span className="font-mono">{fmt(reportData.openingSafe)}</span> (Opening) + <span className="font-mono">{fmt(safeInflows)}</span> (In) − <span className="font-mono">{fmt(safeOutflows)}</span> (Out)
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
              <div className="space-y-4 pt-4 border-t border-slate-800 print-avoid-break">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-mono">II</span>
                    {isAr ? "دفتر أستاذ حساب بنك مصر والفيزا (Banque Misr Ledger)" : "Banque Misr & Card Terminal Ledger"}
                  </h3>
                  <span className="text-xs font-mono font-bold text-blue-400">{accounts.bankAccount} (Banque Misr)</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  
                  {/* Bank Inflows */}
                  <div className="corporate-box bg-[#070C18] border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-black text-blue-400 border-b border-slate-800/80 pb-2">
                      <span className="flex items-center gap-1"><ArrowUpRight size={14} /> {isAr ? "أ. الوارد البنكي (Bank Inflows)" : "A. Bank Inflows"}</span>
                      <span className="font-mono">{fmt(bankInflows)} EGP</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{isAr ? "رصيد البنك الافتتاحي المنقول" : "Opening Bank Balance"}</span>
                        <span className="font-mono font-bold text-slate-300">{fmt(reportData.openingBank)}</span>
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
                  <div className="corporate-box bg-[#070C18] border border-slate-800 rounded-2xl p-4 space-y-3">
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
                <div className="corporate-box bg-[#070C18] border border-blue-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                  <div className="text-xs text-slate-400">
                    <span className="font-mono">{fmt(reportData.openingBank)}</span> (Opening) + <span className="font-mono">{fmt(bankInflows)}</span> (In) − <span className="font-mono">{fmt(bankOutflows)}</span> (Out)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                      {isAr ? "الرصيد الختامي للبنك (بنك مصر):" : "Closing Bank Balance (Banque Misr):"}
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

              {/* ── IV. AUDIT DRILL-DOWN: ITEMIZED TRANSACTIONS FOR SELECTED PERIOD ── */}
              {reportData.itemizedTransactions && reportData.itemizedTransactions.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-800 no-print">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setShowItemized(!showItemized)}
                      className="flex items-center gap-2 text-sm font-extrabold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                    >
                      <Layers size={16} />
                      <span>
                        {isAr 
                          ? (showItemized ? "إخفاء التفاصيل والعمليات الفردية للفترة" : `عرض كشف العمليات التفصيلي (${reportData.itemizedTransactions.length} عملية)`)
                          : (showItemized ? "Hide Itemized Period Transactions" : `View Itemized Period Transactions (${reportData.itemizedTransactions.length} items)`)
                        }
                      </span>
                      {showItemized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {reportData.itemizedTransactions.length} records in {reportType === "date" ? reportData.startDateStr : `${reportData.startDateStr} → ${reportData.endDateStr}`}
                    </span>
                  </div>

                  {showItemized && (
                    <div className="bg-[#070C18] border border-slate-800 rounded-2xl p-4 overflow-x-auto space-y-2">
                      <table className={`w-full text-xs ${isAr ? "text-right" : "text-left"}`}>
                        <thead>
                          <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="p-2.5">{isAr ? "التاريخ" : "Date"}</th>
                            <th className="p-2.5">{isAr ? "البيان / المعاملة" : "Transaction / Description"}</th>
                            <th className="p-2.5">{isAr ? "تفاصيل إضافية" : "Details"}</th>
                            <th className="p-2.5 text-right">{isAr ? "حركة الخزنة" : "Safe Impact"}</th>
                            <th className="p-2.5 text-right">{isAr ? "حركة البنك" : "Bank Impact"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 font-medium text-slate-300">
                          {reportData.itemizedTransactions.map((tx: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                              <td className="p-2.5 font-mono text-slate-400 whitespace-nowrap">{tx.date}</td>
                              <td className="p-2.5 font-bold text-white whitespace-nowrap">
                                {isAr ? tx.titleAr : tx.titleEn}
                              </td>
                              <td className="p-2.5 text-[11px] text-slate-400 whitespace-nowrap">{tx.details}</td>
                              <td className={`p-2.5 text-right font-mono font-bold whitespace-nowrap ${
                                tx.safeChange > 0 ? "text-emerald-400" : tx.safeChange < 0 ? "text-rose-400" : "text-slate-500"
                              }`}>
                                {tx.safeChange !== 0 ? `${tx.safeChange > 0 ? "+" : ""}${fmt(tx.safeChange)}` : "—"}
                              </td>
                              <td className={`p-2.5 text-right font-mono font-bold whitespace-nowrap ${
                                tx.bankChange > 0 ? "text-blue-400" : tx.bankChange < 0 ? "text-purple-400" : "text-slate-500"
                              }`}>
                                {tx.bankChange !== 0 ? `${tx.bankChange > 0 ? "+" : ""}${fmt(tx.bankChange)}` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
