"use client";

import React, { useEffect, useState } from "react";
import { collection, query, where, getAggregateFromServer, sum } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Wallet, Landmark, Loader2, AlertTriangle, ShieldCheck, ExternalLink } from "lucide-react";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";

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

        const [
          salesData, cashPaymentsData, depositsToData, depositsFromData, payrollsData,
          newLoansData, oldLoansData, oldCreditsCashData, visaPaymentsData,
          bankTransferPaymentsData, visaCreditsData, bankTransferCreditsData, depositsToBankData, depositsFromBankData, visaTaxData, bankTransferTaxData, cashTaxData, cashPaymentsBankData, creditPaymentsBankData, bankTaxData] = await Promise.all([
          safeSumAgg(salesQ, { cash: sum("cash"), overShort: sum("overShort"), visa: sum("visa") }),
          safeSumAgg(cashPaymentsQ, { val: sum("amount") }),
          safeSumAgg(depositsToQ, { val: sum("amount") }),
          safeSumAgg(depositsFromQ, { val: sum("amount") }),
          safeSumAgg(payrollsQ, { val: sum("netPay") }),
          safeSumAgg(newLoansQ, { val: sum("amount") }),
          safeSumAgg(oldLoansQ, { val: sum("approved") }),
          safeSumAgg(oldCreditsCashQ, { val: sum("amount") }),
          safeSumAgg(cashPaymentsVisaQ, { val: sum("amount") }),
          safeSumAgg(cashPaymentsBankTransferQ, { val: sum("amount") }),
          safeSumAgg(creditPaymentsVisaQ, { val: sum("amount") }),
          safeSumAgg(creditPaymentsBankTransferQ, { val: sum("amount") }),
          safeSumAgg(depositsToBankQ, { val: sum("amount") }),
          safeSumAgg(depositsFromBankQ, { val: sum("amount") }),
          safeSumAgg(cashPaymentsVisaQ, { val: sum("tax") }),
          safeSumAgg(cashPaymentsBankTransferQ, { val: sum("tax") }),
          safeSumAgg(cashPaymentsQ, { val: sum("tax") }),
          safeSumAgg(cashPaymentsBankQ, { val: sum("amount") }),
          safeSumAgg(creditPaymentsBankQ, { val: sum("amount") }),
          safeSumAgg(cashPaymentsBankQ, { val: sum("tax") })
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

  return (
    <div className="space-y-10 pb-12">
      
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
