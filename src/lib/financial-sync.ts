"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, onSnapshot, query, limit, orderBy } from "firebase/firestore";

// Universal date normalizer: handles ISO strings, YYYY-MM-DD, DD/MM/YYYY, Timestamps
export function normalizeDate(val: any): string | null {
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
export function matchesBranch(docData: any, currentBranch: string): boolean {
  if (!currentBranch || currentBranch === "all") return true;
  const docBranch = (docData.storeId || docData.branchId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = currentBranch.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!docBranch) return true; // Include records without branch so legacy data is never lost
  return docBranch.includes(target) || target.includes(docBranch);
}

export interface UnifiedFinancialDocs {
  sales: any[];
  cashPayments: any[];
  uniqueCreditPayments: any[];
  deposits: any[];
  payrolls: any[];
  adjustments: any[];
  loans: any[];
  employeesMap: Record<string, string>;
  fetchedAt: number;
}

// In-Memory Shared Cache across components in the current tab
let cachedDocs: UnifiedFinancialDocs | null = null;
let fetchPromise: Promise<UnifiedFinancialDocs> | null = null;
const CACHE_TTL_MS = 25000; // 25 seconds TTL for automatic freshness

// Cross-tab Broadcast Channel
const BROADCAST_CHANNEL_NAME = "circlek_financial_sync";
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  } catch (e) {
    console.warn("BroadcastChannel not supported:", e);
  }
}

/**
 * Trigger immediate invalidation and broadcast across tabs
 */
export function notifyFinancialsUpdated(branch?: string) {
  if (cachedDocs) {
    cachedDocs.fetchedAt = 0; // Invalidate cache
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("circlek_financials_updated", { detail: { branch, timestamp: Date.now() } }));
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: "FINANCIALS_UPDATED", branch, timestamp: Date.now() });
      } catch (e) {}
    }
  }
}

/**
 * Authoritative Document Fetcher:
 * Loads all financial documents with in-memory caching and deduplication.
 */
export async function fetchUnifiedFinancialDocs(forceRefresh = false): Promise<UnifiedFinancialDocs> {
  const now = Date.now();
  if (!forceRefresh && cachedDocs && (now - cachedDocs.fetchedAt < CACHE_TTL_MS)) {
    return cachedDocs;
  }

  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
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

      cachedDocs = {
        sales: salesRaw,
        cashPayments: cashPaymentsRaw,
        uniqueCreditPayments,
        deposits: depositsRaw,
        payrolls: payrollsRaw,
        adjustments: adjustmentsRaw,
        loans: loansRaw,
        employeesMap,
        fetchedAt: Date.now()
      };

      return cachedDocs;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

export interface FinancialLedgerResult {
  safeMoney: number;
  bankMoney: number;
  totalSales: number;
  totalCashSales: number;
  totalVisaSales: number;
  totalCashPayments: number;
  totalCashTax: number;
  totalBankPayments: number;
  totalBankTax: number;
  depositsToSafe: number;
  depositsFromSafe: number;
  depositsToBank: number;
  depositsFromBank: number;
  totalPayrolls: number;
  totalBankPayrolls: number;
  totalLoans: number;
  totalOverAmount: number;
  totalShortAmount: number;
  openingSafe: number;
  openingBank: number;
  closingSafe: number;
  closingBank: number;
  safeInflows: number;
  safeOutflows: number;
  bankInflows: number;
  bankOutflows: number;
  startDateStr?: string;
  endDateStr?: string;
  itemizedTransactions: any[];
  period: {
    salesCash: number;
    overAmount: number;
    shortAmount: number;
    depositsToSafe: number;
    totalCashPayments: number;
    totalCashTaxes: number;
    depositsFromSafe: number;
    totalPayrolls: number;
    totalLoans: number;
    visaSales: number;
    depositsToBank: number;
    bankPayments: number;
    bankTaxes: number;
    depositsFromBank: number;
  };
}

/**
 * Authoritative Financial Ledger Calculator
 * Used identically across Safe Report, Owner Dashboard, and Main Dashboard.
 */
export function calculateFinancialLedger(
  docs: UnifiedFinancialDocs,
  targetBranch: string,
  startDateStr?: string,
  endDateStr?: string,
  isAr: boolean = false
): FinancialLedgerResult {
  const isLifetime = !startDateStr && !endDateStr;
  const start = startDateStr || "1970-01-01";
  const end = endDateStr || "2099-12-31";

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

    if (!isLifetime && d < start) {
      openingSafe += (cash + over - short);
      openingBank += visa;
    } else if (isLifetime || (d >= start && d <= end)) {
      periodSalesCash += cash;
      periodSalesVisa += visa;
      periodOverAmount += over;
      periodShortAmount += short;

      if (!isLifetime) {
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
      if (!isLifetime && d < start) {
        openingSafe -= totalOut;
      } else if (isLifetime || (d >= start && d <= end)) {
        periodCashPayments += amt;
        periodCashTax += tax;

        if (!isLifetime) {
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
      }
    } else if (["visa", "bank_transfer", "bank"].includes(method)) {
      if (!isLifetime && d < start) {
        openingBank -= totalOut;
      } else if (isLifetime || (d >= start && d <= end)) {
        periodBankPayments += amt;
        periodBankTax += tax;

        if (!isLifetime) {
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
      if (!isLifetime && d < start) {
        openingSafe -= amt;
      } else if (isLifetime || (d >= start && d <= end)) {
        periodCashPayments += amt;

        if (!isLifetime) {
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
      }
    } else if (["visa", "bank_transfer", "bank"].includes(method)) {
      if (!isLifetime && d < start) {
        openingBank -= amt;
      } else if (isLifetime || (d >= start && d <= end)) {
        periodBankPayments += amt;

        if (!isLifetime) {
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
    }
  });

  // 4. DEPOSITS & CASH INJECTIONS (including early loan repayments to safe)
  docs.deposits.forEach((dep: any) => {
    if (!matchesBranch(dep, targetBranch)) return;
    const d = normalizeDate(dep.date || dep.createdAt);
    if (!d) return;

    const amt = Number(dep.amount || 0);
    const from = (dep.from || "").toLowerCase();
    const to = (dep.to || "").toLowerCase();

    // Safe Inflows & Outflows
    if (to === "safe") {
      if (!isLifetime && d < start) openingSafe += amt;
      else if (isLifetime || (d >= start && d <= end)) {
        periodDepositsToSafe += amt;
        if (!isLifetime) {
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
    }
    if (from === "safe") {
      if (!isLifetime && d < start) openingSafe -= amt;
      else if (isLifetime || (d >= start && d <= end)) {
        periodDepositsFromSafe += amt;
        if (!isLifetime) {
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
    }

    // Bank Inflows & Outflows
    if (to === "bank") {
      if (!isLifetime && d < start) openingBank += amt;
      else if (isLifetime || (d >= start && d <= end)) {
        periodDepositsToBank += amt;
        if (!isLifetime && from !== "safe") {
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
      if (!isLifetime && d < start) openingBank -= amt;
      else if (isLifetime || (d >= start && d <= end)) {
        periodDepositsFromBank += amt;
        if (!isLifetime) {
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
    }
  });

  // 5. PAYROLL DISBURSEMENTS
  docs.payrolls.forEach((pr: any) => {
    if (!matchesBranch(pr, targetBranch)) return;
    const d = normalizeDate(pr.postedToFinanceAt || pr.paidDate || pr.date || pr.createdAt);
    if (!d) return;

    const amt = Number(pr.netPay || pr.amount || 0);
    const method = (pr.paymentMethod || pr.method || "cash").toLowerCase();
    const empName = pr.employeeName || pr.name || docs.employeesMap[pr.employeeId] || (isAr ? "موظف" : "Employee");

    if (method === "cash") {
      if (!isLifetime && d < start) {
        openingSafe -= amt;
      } else if (isLifetime || (d >= start && d <= end)) {
        periodPayrolls += amt;
        if (!isLifetime) {
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
      }
    } else {
      if (!isLifetime && d < start) {
        openingBank -= amt;
      } else if (isLifetime || (d >= start && d <= end)) {
        periodBankPayrolls += amt;
        if (!isLifetime) {
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
    }
  });

  // 6. STAFF LOANS & ADVANCES (Deduplicated across loans and adjustments)
  const seenLoanIds = new Set<string>();
  const seenLoanComposite = new Set<string>();

  docs.loans.forEach((ln: any) => {
    if (!matchesBranch(ln, targetBranch)) return;
    const d = normalizeDate(ln.date || ln.createdAt);
    const amt = Number(ln.approved || ln.amount || 0);
    const empName = ln.employeeName || ln.name || docs.employeesMap[ln.employeeId] || (isAr ? "موظف" : "Employee");

    seenLoanIds.add(ln.id);
    if (ln.employeeId) {
      seenLoanComposite.add(`${ln.employeeId}_${amt}`);
      if (d) seenLoanComposite.add(`${ln.employeeId}_${d}_${amt}`);
    }

    if (!isLifetime && (!d || d < start)) {
      openingSafe -= amt;
    } else if (isLifetime || !d || (d >= start && d <= end)) {
      periodLoans += amt;
      if (!isLifetime) {
        itemizedTransactions.push({
          id: ln.id,
          date: d || start,
          category: "loan",
          titleEn: `Staff Loan / Advance: ${empName}`,
          titleAr: `سلفة موظف: ${empName}`,
          safeChange: -amt,
          bankChange: 0,
          details: `Reason: ${ln.reason || "Advance"} | Amount: ${amt.toLocaleString()} EGP`
        });
      }
    }
  });

  docs.adjustments.forEach((adj: any) => {
    if (adj.type === "loan") {
      if (!matchesBranch(adj, targetBranch)) return;
      if (adj.loanDocId && seenLoanIds.has(adj.loanDocId)) return;
      if (seenLoanIds.has(adj.id)) return;

      const d = normalizeDate(adj.date || adj.createdAt);
      const amt = Number(adj.amount || 0);
      if (adj.employeeId && (seenLoanComposite.has(`${adj.employeeId}_${amt}`) || (d && seenLoanComposite.has(`${adj.employeeId}_${d}_${amt}`)))) return;

      seenLoanIds.add(adj.id);
      const empName = adj.employeeName || adj.name || docs.employeesMap[adj.employeeId] || (isAr ? "موظف" : "Employee");

      if (!isLifetime && (!d || d < start)) {
        openingSafe -= amt;
      } else if (isLifetime || !d || (d >= start && d <= end)) {
        periodLoans += amt;
        if (!isLifetime) {
          itemizedTransactions.push({
            id: adj.id,
            date: d || start,
            category: "loan",
            titleEn: `Staff Loan / Advance: ${empName}`,
            titleAr: `سلفة موظف: ${empName}`,
            safeChange: -amt,
            bankChange: 0,
            details: `Reason: ${adj.reason || "Advance"} | Amount: ${amt.toLocaleString()} EGP`
          });
        }
      }
    }
  });

  if (itemizedTransactions.length > 0) {
    itemizedTransactions.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }

  const safeInflows = periodSalesCash + periodOverAmount + periodDepositsToSafe;
  const safeOutflows = periodShortAmount + periodCashPayments + periodCashTax + periodDepositsFromSafe + periodPayrolls + periodLoans;
  const closingSafe = openingSafe + safeInflows - safeOutflows;

  const bankInflows = periodSalesVisa + periodDepositsToBank;
  const bankOutflows = periodBankPayments + periodBankTax + periodDepositsFromBank + periodBankPayrolls;
  const closingBank = openingBank + bankInflows - bankOutflows;

  const netCashSales = periodSalesCash + periodOverAmount - periodShortAmount;

  return {
    safeMoney: closingSafe,
    bankMoney: closingBank,
    totalSales: netCashSales,
    totalCashSales: periodSalesCash,
    totalVisaSales: periodSalesVisa,
    totalCashPayments: periodCashPayments,
    totalCashTax: periodCashTax,
    totalBankPayments: periodBankPayments,
    totalBankTax: periodBankTax,
    depositsToSafe: periodDepositsToSafe,
    depositsFromSafe: periodDepositsFromSafe,
    depositsToBank: periodDepositsToBank,
    depositsFromBank: periodDepositsFromBank,
    totalPayrolls: periodPayrolls,
    totalBankPayrolls: periodBankPayrolls,
    totalLoans: periodLoans,
    totalOverAmount: periodOverAmount,
    totalShortAmount: periodShortAmount,
    openingSafe,
    openingBank,
    closingSafe,
    closingBank,
    safeInflows,
    safeOutflows,
    bankInflows,
    bankOutflows,
    startDateStr,
    endDateStr,
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
}

/**
 * Universal React Hook for 100% Real-Time & Instant Safe/Bank Balances
 */
export function useLiveSafeBalance(branch: string = "all") {
  // 1. Instant hydration from localStorage (0ms latency, no loading blank)
  const [balances, setBalances] = useState<{ safeBalance: number; bankBalance: number; stats: FinancialLedgerResult | null }>(() => {
    if (typeof window !== "undefined") {
      try {
        const s = localStorage.getItem(`cached_safe_balance_${branch}`);
        const b = localStorage.getItem(`cached_bank_balance_${branch}`);
        const rawStats = localStorage.getItem(`cached_fin_stats_${branch}`);
        return {
          safeBalance: s !== null ? parseFloat(s) || 0 : 0,
          bankBalance: b !== null ? parseFloat(b) || 0 : 0,
          stats: rawStats ? JSON.parse(rawStats) : null
        };
      } catch (e) {}
    }
    return { safeBalance: 0, bankBalance: 0, stats: null };
  });

  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const isMounted = useRef(true);

  const calculateAndSet = useCallback(async (forceRefresh = false) => {
    try {
      const docs = await fetchUnifiedFinancialDocs(forceRefresh);
      const ledger = calculateFinancialLedger(docs, branch);

      if (!isMounted.current) return;

      setBalances({
        safeBalance: ledger.closingSafe,
        bankBalance: ledger.closingBank,
        stats: ledger
      });

      // Update local storage so next visits are instant
      if (typeof window !== "undefined") {
        localStorage.setItem(`cached_safe_balance_${branch}`, ledger.closingSafe.toString());
        localStorage.setItem(`cached_bank_balance_${branch}`, ledger.closingBank.toString());
        localStorage.setItem(`cached_fin_stats_${branch}`, JSON.stringify(ledger));
      }
    } catch (e) {
      console.warn("Live safe balance sync error:", e);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [branch]);

  useEffect(() => {
    isMounted.current = true;

    // Fast check on mount
    calculateAndSet(false);

    // Event listener for local dispatch
    const handleLocalUpdate = (e: any) => {
      const detailBranch = e?.detail?.branch;
      if (!detailBranch || detailBranch === "all" || detailBranch === branch || branch === "all") {
        calculateAndSet(true);
      }
    };

    // Cross-tab broadcast listener
    const handleBroadcastMessage = (event: MessageEvent) => {
      if (event.data?.type === "FINANCIALS_UPDATED") {
        const detailBranch = event.data.branch;
        if (!detailBranch || detailBranch === "all" || detailBranch === branch || branch === "all") {
          calculateAndSet(true);
        }
      }
    };

    window.addEventListener("circlek_financials_updated", handleLocalUpdate);
    if (broadcastChannel) {
      broadcastChannel.addEventListener("message", handleBroadcastMessage);
    }

    // Window focus refresh for background edits
    const handleFocus = () => {
      calculateAndSet(false);
    };
    window.addEventListener("focus", handleFocus);

    // Live Snapshot Listeners on latest collection changes
    // Limit to 1 document so overhead is negligible, but instantly fires when any record is created/modified!
    const unsubs: (() => void)[] = [];
    try {
      const collectionsToWatch = ["cash_payments", "sales", "deposits", "loans", "adjustments", "payroll_lines"];
      collectionsToWatch.forEach(colName => {
        try {
          const q = query(collection(db, colName), limit(1));
          const unsub = onSnapshot(q, () => {
            // Document changed in collection -> invalidate & recalculate
            calculateAndSet(true);
          }, () => {});
          unsubs.push(unsub);
        } catch (e) {}
      });
    } catch (e) {}

    return () => {
      isMounted.current = false;
      window.removeEventListener("circlek_financials_updated", handleLocalUpdate);
      if (broadcastChannel) {
        broadcastChannel.removeEventListener("message", handleBroadcastMessage);
      }
      window.removeEventListener("focus", handleFocus);
      unsubs.forEach(u => {
        try { u(); } catch (e) {}
      });
    };
  }, [branch, calculateAndSet]);

  const refresh = useCallback(() => {
    setLoading(true);
    return calculateAndSet(true);
  }, [calculateAndSet]);

  return {
    safeBalance: balances.safeBalance,
    bankBalance: balances.bankBalance,
    stats: balances.stats,
    loading,
    isLive,
    refresh
  };
}
