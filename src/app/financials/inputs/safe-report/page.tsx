"use client";

import React, { useState, useRef } from "react";
import { useBranch } from "@/context/BranchContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getAggregateFromServer, sum, Timestamp } from "firebase/firestore";
import { Printer, Loader2, Calendar, AlertTriangle, ExternalLink } from "lucide-react";
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
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!reportData) return;
    window.print();
  };

  const generateReport = async () => {
    setLoading(true);
    setReportData(null);
    setMissingIndexes([]);
    
    const collectedUrls = new Set<string>();

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

    try {
      let startDateStr = "";
      let endDateStr = "";

      if (reportType === "date") {
        startDateStr = selectedDate;
        endDateStr = selectedDate;
      } else if (reportType === "month") {
        startDateStr = `${selectedMonth}-01`;
        const [yyyy, mm] = selectedMonth.split("-");
        const lastDay = new Date(parseInt(yyyy), parseInt(mm), 0).getDate();
        endDateStr = `${selectedMonth}-${lastDay}`;
      } else if (reportType === "year") {
        startDateStr = `${selectedYear}-01-01`;
        endDateStr = `${selectedYear}-12-31`;
      }

      const branchIds: string[] = [];
      if (currentBranch === "alamein4") branchIds.push("eL-alamein-4");
      else if (currentBranch === "ola") branchIds.push("ola-el-koronfol");
      else if (currentBranch !== "all") branchIds.push(currentBranch);

      const fetchSums = async (isHistorical: boolean) => {
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
          salesQ = query(salesQ, where("date", "<", startDateStr));
          cashPaymentsQ = query(cashPaymentsQ, where("date", "<", startDateStr));
          depositsToQ = query(depositsToQ, where("date", "<", startDateStr));
          depositsFromQ = query(depositsFromQ, where("date", "<", startDateStr));
          newLoansQ = query(newLoansQ, where("date", "<", startDateStr));
          oldLoansQ = query(oldLoansQ, where("date", "<", startDateStr));
          oldCreditsCashQ = query(oldCreditsCashQ, where("date", "<", startDateStr));

          cashPaymentsVisaQ = query(cashPaymentsVisaQ, where("date", "<", startDateStr));
          cashPaymentsBankTransferQ = query(cashPaymentsBankTransferQ, where("date", "<", startDateStr));
          cashPaymentsBankQ = query(cashPaymentsBankQ, where("date", "<", startDateStr));
          creditPaymentsVisaQ = query(creditPaymentsVisaQ, where("date", "<", startDateStr));
          creditPaymentsBankTransferQ = query(creditPaymentsBankTransferQ, where("date", "<", startDateStr));
          creditPaymentsBankQ = query(creditPaymentsBankQ, where("date", "<", startDateStr));
          depositsToBankQ = query(depositsToBankQ, where("date", "<", startDateStr));
          depositsFromBankQ = query(depositsFromBankQ, where("date", "<", startDateStr));

          const startTs = Timestamp.fromDate(new Date(`${startDateStr}T00:00:00`));
          payrollsQ = query(payrollsQ, where("createdAt", "<", startTs));
        } else {
          salesQ = query(salesQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
          cashPaymentsQ = query(cashPaymentsQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
          depositsToQ = query(depositsToQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
          depositsFromQ = query(depositsFromQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
          newLoansQ = query(newLoansQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
          oldLoansQ = query(oldLoansQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
          oldCreditsCashQ = query(oldCreditsCashQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));

          cashPaymentsVisaQ = query(cashPaymentsVisaQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
          cashPaymentsBankTransferQ = query(cashPaymentsBankTransferQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
          cashPaymentsBankQ = query(cashPaymentsBankQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
          creditPaymentsVisaQ = query(creditPaymentsVisaQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
          creditPaymentsBankTransferQ = query(creditPaymentsBankTransferQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
          creditPaymentsBankQ = query(creditPaymentsBankQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
          depositsToBankQ = query(depositsToBankQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
          depositsFromBankQ = query(depositsFromBankQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));

          const startTs = Timestamp.fromDate(new Date(`${startDateStr}T00:00:00`));
          const endTs = Timestamp.fromDate(new Date(`${endDateStr}T23:59:59`));
          payrollsQ = query(payrollsQ, where("createdAt", ">=", startTs), where("createdAt", "<=", endTs));
        }

        // Fire all queries simultaneously
        const [
          salesData, cashPaymentsData, depositsToData, depositsFromData, payrollsData,
          newLoansData, oldLoansData, oldCreditsCashData, visaPaymentsData,
          bankTransferPaymentsData, visaCreditsData, bankTransferCreditsData, depositsToBankData, depositsFromBankData, cashPaymentsBankData, creditPaymentsBankData] = await Promise.all([
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
          safeSumAgg(creditPaymentsBankQ, { val: sum("amount") })
        ]);

        const salesCash = salesData?.cash || 0;
        const overShort = salesData?.overShort || 0;
        const visaSales = salesData?.visa || 0;
        
        const overAmount = overShort > 0 ? overShort : 0;
        const shortAmount = overShort < 0 ? Math.abs(overShort) : 0;

        const totalCashPayments = cashPaymentsData?.val || 0;
        const totalCashTaxes = cashPaymentsData?.tax || 0;
        const depositsToSafe = depositsToData?.val || 0;
        const depositsFromSafe = depositsFromData?.val || 0;
        const totalPayrolls = payrollsData?.val || 0;
        
        const totalNewLoans = newLoansData?.val || 0;
        const totalOldLoans = oldLoansData?.val || 0;
        const totalLoans = totalNewLoans + totalOldLoans;
        const totalOldCreditsCash = oldCreditsCashData?.val || 0;

        const totalVisaPayments = visaPaymentsData?.val || 0;
        const totalBankTransferPayments = bankTransferPaymentsData?.val || 0;
        const totalBankOnlyPayments = cashPaymentsBankData?.val || 0;
        const bankPayments = totalVisaPayments + totalBankTransferPayments + totalBankOnlyPayments;
        const bankTaxes = (visaPaymentsData?.tax || 0) + (bankTransferPaymentsData?.tax || 0) + (cashPaymentsBankData?.tax || 0);

        const totalVisaCredits = visaCreditsData?.val || 0;
        const totalBankTransferCredits = bankTransferCreditsData?.val || 0;
        const totalBankOnlyCredits = creditPaymentsBankData?.val || 0;
        const bankCredits = totalVisaCredits + totalBankTransferCredits + totalBankOnlyCredits;

        const depositsToBank = depositsToBankData?.val || 0;
        const depositsFromBank = depositsFromBankData?.val || 0;

        return {
          salesCash, overAmount, shortAmount, visaSales,
          totalCashPayments, totalCashTaxes, depositsToSafe, depositsFromSafe, totalPayrolls,
          totalLoans, totalOldCreditsCash,
          bankPayments, bankTaxes, bankCredits, depositsToBank, depositsFromBank
        };
      };

      // Fire both history and period queries at the exact same time
      const [history, period] = await Promise.all([
        fetchSums(true),
        fetchSums(false)
      ]);

      if (collectedUrls.size > 0) {
        setMissingIndexes(Array.from(collectedUrls));
        setLoading(false);
        return;
      }

      const histSafeInflows = history.salesCash + history.overAmount + history.depositsToSafe;
      const histSafeOutflows = history.shortAmount + history.totalCashPayments + history.totalCashTaxes + history.totalLoans + history.depositsFromSafe + history.totalOldCreditsCash + history.totalPayrolls;
      const openingSafeBalance = histSafeInflows - histSafeOutflows;

      const histBankInflows = history.visaSales + history.depositsToBank;
      const histBankOutflows = history.bankPayments + history.bankTaxes + history.bankCredits + history.depositsFromBank;
      const openingBankBalance = histBankInflows - histBankOutflows;

      setReportData({
        openingSafeBalance,
        openingBankBalance,
        period,
        startDateStr,
        endDateStr,
      });

    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate report: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 pb-32">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            #print-area, #print-area * { visibility: visible; }
            #print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; }
            .no-print { display: none !important; }
            @page { size: A4; margin: 0; }
          }
        `}} />

        {/* Missing Indexes Warning UI */}
        {missingIndexes.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm no-print mb-6">
            <div className="flex items-center gap-3 text-red-700 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <div>
                <h2 className="text-xl font-bold">Missing Firebase Indexes ({missingIndexes.length})</h2>
                <p className="text-sm opacity-90 mt-1">Please click every single button below to create all required indexes at once. Once they finish building in Firebase, click Generate Report again.</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {missingIndexes.map((url, i) => (
                <a 
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white border border-red-300 text-red-700 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                >
                  Create Index #{i + 1}
                  <ExternalLink className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-border p-4 flex flex-wrap items-end gap-4 no-print">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Report Type</label>
            <select 
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={reportType}
              onChange={(e: any) => setReportType(e.target.value)}
            >
              <option value="date">Daily / Specific Date</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Select Period</label>
            {reportType === "date" && (
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
            {reportType === "month" && (
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
            {reportType === "year" && (
              <input type="number" min="2020" max="2100" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
          </div>

          <button 
            onClick={generateReport}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Generate Report
          </button>

          {reportData && (
            <button 
              onClick={handlePrint}
              className="ml-auto bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
          )}
        </div>

        {/* Report Preview */}
        {reportData && (
          <div className="bg-white text-black max-w-[850px] mx-auto min-h-[1100px] shadow-2xl overflow-hidden print:shadow-none print:border-none border border-slate-300 font-sans" id="print-area">
            
            {/* Header / Letterhead */}
            <div className="p-10 pb-6 border-b-4 border-black flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">CIRCLE K</h1>
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-widest">Financial Statement</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold uppercase tracking-tight">Safe Balance Report</h2>
                <p className="text-xs text-gray-500 font-mono mt-1">Generated: {new Date().toLocaleString()}</p>
              </div>
            </div>

            <div className="px-10 py-6 space-y-8">
              
              {/* Meta Info Grid */}
              <div className="grid grid-cols-2 gap-8 text-sm">
                <div className="space-y-2">
                  <div className="flex border-b border-gray-300 pb-1">
                    <span className="w-32 font-bold uppercase text-xs text-gray-600 tracking-wider">Entity</span>
                    <span className="font-bold">{currentBranch === "all" ? "ALL BRANCHES - CONSOLIDATED" : currentBranch === "alamein4" ? "EL ALAMEIN 4" : currentBranch === "ola" ? "OLA EL KORONFOL" : String(currentBranch).toUpperCase()}</span>
                  </div>
                  <div className="flex border-b border-gray-300 pb-1">
                    <span className="w-32 font-bold uppercase text-xs text-gray-600 tracking-wider">Report Period</span>
                    <span className="font-bold">{reportType === 'date' ? reportData.startDateStr : reportData.startDateStr + " to " + reportData.endDateStr}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex border-b border-gray-300 pb-1">
                    <span className="w-32 font-bold uppercase text-xs text-gray-600 tracking-wider">Prepared By</span>
                    <span className="font-bold">SYSTEM ADMIN</span>
                  </div>
                  <div className="flex border-b border-gray-300 pb-1">
                    <span className="w-32 font-bold uppercase text-xs text-gray-600 tracking-wider">Currency</span>
                    <span className="font-bold">EGYPTIAN POUND (EGP)</span>
                  </div>
                </div>
              </div>

              {/* Summary Cards - Corporate Style */}
              <div className="grid grid-cols-3 gap-0 border-2 border-black divide-x-2 divide-black text-center">
                <div className="p-4 bg-gray-50">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Total Cash Inflows</span>
                  <span className="text-xl font-black">{(reportData.period.salesCash + reportData.period.overAmount + reportData.period.depositsToSafe).toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                </div>
                <div className="p-4 bg-gray-50">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Total Cash Outflows</span>
                  <span className="text-xl font-black">{(reportData.period.shortAmount + reportData.period.totalCashPayments + reportData.period.totalCashTaxes + reportData.period.totalLoans + reportData.period.depositsFromSafe + reportData.period.totalOldCreditsCash + reportData.period.totalPayrolls).toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                </div>
                <div className="p-4 bg-black text-white">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Closing Safe Balance</span>
                  <span className="text-xl font-black">{(reportData.openingSafeBalance + (reportData.period.salesCash + reportData.period.overAmount + reportData.period.depositsToSafe) - (reportData.period.shortAmount + reportData.period.totalCashPayments + reportData.period.totalCashTaxes + reportData.period.totalLoans + reportData.period.depositsFromSafe + reportData.period.totalOldCreditsCash + reportData.period.totalPayrolls)).toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                </div>
              </div>

              {/* CASH LEDGER */}
              <div className="space-y-4">
                <h3 className="text-lg font-black uppercase tracking-widest border-b-2 border-black pb-2">I. Safe Cash Ledger</h3>
                
                {/* Inflows */}
                <div className="pl-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider mb-2 text-gray-700">A. Cash Inflows</h4>
                  <table className="w-full text-sm mb-4 border border-gray-300">
                    <thead className="bg-gray-100 border-b border-gray-300">
                      <tr>
                        <th className="py-1.5 px-3 text-left font-bold uppercase tracking-wider text-[10px]">Description</th>
                        <th className="py-1.5 px-3 text-left font-bold uppercase tracking-wider text-[10px]">Notes</th>
                        <th className="py-1.5 px-3 text-right font-bold uppercase tracking-wider text-[10px] w-32">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="py-1.5 px-3 font-semibold text-gray-700">Opening Balance</td>
                        <td className="py-1.5 px-3 text-xs text-gray-500 italic">Previous carried forward</td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-gray-500">{reportData.openingSafeBalance.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">Sales Cash</td>
                        <td className="py-1.5 px-3 text-xs text-gray-500 italic">Total physical cash from shifts</td>
                        <td className="py-1.5 px-3 text-right font-mono">{reportData.period.salesCash.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">Over Amount</td>
                        <td className="py-1.5 px-3 text-xs text-gray-500 italic">Recorded surplus in drawers</td>
                        <td className="py-1.5 px-3 text-right font-mono">{reportData.period.overAmount.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">Deposits (Bank to Safe)</td>
                        <td className="py-1.5 px-3 text-xs text-gray-500 italic">Liquid injections from bank</td>
                        <td className="py-1.5 px-3 text-right font-mono">{reportData.period.depositsToSafe.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                      </tr>
                      <tr className="bg-gray-50 border-t-2 border-gray-300">
                        <td colSpan={2} className="py-2 px-3 text-right font-bold uppercase tracking-widest text-[10px]">Subtotal Inflows</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">{(reportData.period.salesCash + reportData.period.overAmount + reportData.period.depositsToSafe).toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Outflows */}
                <div className="pl-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider mb-2 text-gray-700">B. Cash Outflows</h4>
                  <table className="w-full text-sm mb-4 border border-gray-300">
                    <thead className="bg-gray-100 border-b border-gray-300">
                      <tr>
                        <th className="py-1.5 px-3 text-left font-bold uppercase tracking-wider text-[10px]">Description</th>
                        <th className="py-1.5 px-3 text-left font-bold uppercase tracking-wider text-[10px]">Notes</th>
                        <th className="py-1.5 px-3 text-right font-bold uppercase tracking-wider text-[10px] w-32">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="py-1.5 px-3">Short Amount</td>
                        <td className="py-1.5 px-3 text-xs text-gray-500 italic">Recorded drawer shortages</td>
                        <td className="py-1.5 px-3 text-right font-mono">{reportData.period.shortAmount.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">General Expenses (Cash)</td>
                        <td className="py-1.5 px-3 text-xs text-gray-500 italic">Direct safe expenditures</td>
                        <td className="py-1.5 px-3 text-right font-mono">{reportData.period.totalCashPayments.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">Taxes Paid (Cash)</td>
                        <td className="py-1.5 px-3 text-xs text-gray-500 italic">Taxes on invoices/expenses</td>
                        <td className="py-1.5 px-3 text-right font-mono">{reportData.period.totalCashTaxes.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">Loans Disbursed</td>
                        <td className="py-1.5 px-3 text-xs text-gray-500 italic">Employee loans paid from safe</td>
                        <td className="py-1.5 px-3 text-right font-mono">{reportData.period.totalLoans.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">Deposits (Safe to Bank)</td>
                        <td className="py-1.5 px-3 text-xs text-gray-500 italic">Cash removed for bank/owner</td>
                        <td className="py-1.5 px-3 text-right font-mono">{reportData.period.depositsFromSafe.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">Credit Settlements (Cash)</td>
                        <td className="py-1.5 px-3 text-xs text-gray-500 italic">Old debts paid in cash</td>
                        <td className="py-1.5 px-3 text-right font-mono">{reportData.period.totalOldCreditsCash.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">Payroll Disbursements</td>
                        <td className="py-1.5 px-3 text-xs text-gray-500 italic">Salaries paid from safe</td>
                        <td className="py-1.5 px-3 text-right font-mono">{reportData.period.totalPayrolls.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                      </tr>
                      <tr className="bg-gray-50 border-t-2 border-gray-300">
                        <td colSpan={2} className="py-2 px-3 text-right font-bold uppercase tracking-widest text-[10px]">Subtotal Outflows</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">{(reportData.period.shortAmount + reportData.period.totalCashPayments + reportData.period.totalCashTaxes + reportData.period.totalLoans + reportData.period.depositsFromSafe + reportData.period.totalOldCreditsCash + reportData.period.totalPayrolls).toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Safe Reconciliation Formula */}
                <div className="bg-gray-50 p-3 border border-gray-300 text-center text-xs font-mono text-gray-600 rounded">
                  {reportData.openingSafeBalance.toLocaleString('en-US', {minimumFractionDigits:2})} (Open) + {(reportData.period.salesCash + reportData.period.overAmount + reportData.period.depositsToSafe).toLocaleString('en-US', {minimumFractionDigits:2})} (In) - {(reportData.period.shortAmount + reportData.period.totalCashPayments + reportData.period.totalCashTaxes + reportData.period.totalLoans + reportData.period.depositsFromSafe + reportData.period.totalOldCreditsCash + reportData.period.totalPayrolls).toLocaleString('en-US', {minimumFractionDigits:2})} (Out) = {(reportData.openingSafeBalance + (reportData.period.salesCash + reportData.period.overAmount + reportData.period.depositsToSafe) - (reportData.period.shortAmount + reportData.period.totalCashPayments + reportData.period.totalCashTaxes + reportData.period.totalLoans + reportData.period.depositsFromSafe + reportData.period.totalOldCreditsCash + reportData.period.totalPayrolls)).toLocaleString('en-US', {minimumFractionDigits:2})}
                </div>
              </div>

              {/* BANK LEDGER */}
              <div className="space-y-4 pt-6">
                <h3 className="text-lg font-black uppercase tracking-widest border-b-2 border-black pb-2">II. Bank / Visa Ledger</h3>
                
                <table className="w-full text-sm border border-gray-300">
                  <thead className="bg-gray-100 border-b border-gray-300">
                    <tr>
                      <th className="py-1.5 px-3 text-left font-bold uppercase tracking-wider text-[10px]">Description</th>
                      <th className="py-1.5 px-3 text-left font-bold uppercase tracking-wider text-[10px]">Notes</th>
                      <th className="py-1.5 px-3 text-right font-bold uppercase tracking-wider text-[10px] w-32">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td colSpan={3} className="py-1 px-3 bg-gray-50 font-bold uppercase text-[10px] tracking-widest text-gray-600">A. Bank Inflows</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 font-semibold text-gray-700 pl-6">Opening Balance</td>
                      <td className="py-1.5 px-3 text-xs text-gray-500 italic">Previous carried forward</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-gray-500">{reportData.openingBankBalance.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 pl-6">Sales Visa</td>
                      <td className="py-1.5 px-3 text-xs text-gray-500 italic">Visa card terminal settlements</td>
                      <td className="py-1.5 px-3 text-right font-mono">{reportData.period.visaSales.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 pl-6">Deposits from Safe</td>
                      <td className="py-1.5 px-3 text-xs text-gray-500 italic">Cash deposited into bank</td>
                      <td className="py-1.5 px-3 text-right font-mono">{reportData.period.depositsFromSafe.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                    </tr>
                    
                    <tr>
                      <td colSpan={3} className="py-1 px-3 bg-gray-50 font-bold uppercase text-[10px] tracking-widest text-gray-600 border-t-2 border-gray-300">B. Bank Outflows</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 pl-6">Bank Payments</td>
                      <td className="py-1.5 px-3 text-xs text-gray-500 italic">Direct transfers & visa expenses</td>
                      <td className="py-1.5 px-3 text-right font-mono">{reportData.period.bankPayments.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 pl-6">Taxes Paid (Bank)</td>
                      <td className="py-1.5 px-3 text-xs text-gray-500 italic">Taxes on bank payments</td>
                      <td className="py-1.5 px-3 text-right font-mono">{reportData.period.bankTaxes.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 pl-6">Credit Payments (Bank)</td>
                      <td className="py-1.5 px-3 text-xs text-gray-500 italic">Debts settled via bank transfer</td>
                      <td className="py-1.5 px-3 text-right font-mono">{reportData.period.bankCredits.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 pl-6">Deposits (Bank to Safe)</td>
                      <td className="py-1.5 px-3 text-xs text-gray-500 italic">Funds withdrawn to safe</td>
                      <td className="py-1.5 px-3 text-right font-mono">{reportData.period.depositsToSafe.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                    </tr>
                    <tr className="bg-gray-100 border-t-2 border-black">
                      <td colSpan={2} className="py-2 px-3 text-right font-bold uppercase tracking-widest text-[10px]">Closing Bank Balance</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{(reportData.openingBankBalance + (reportData.period.visaSales + reportData.period.depositsFromSafe) - (reportData.period.bankPayments + reportData.period.bankTaxes + reportData.period.bankCredits + reportData.period.depositsToSafe)).toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signatures & Approvals */}
              <div className="pt-10 mt-10 border-t-4 border-black">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-8">III. Authorization & Signatures</h3>
                <div className="grid grid-cols-3 gap-8">
                  <div>
                    <div className="border-b border-black h-12 mb-2"></div>
                    <p className="text-xs font-bold uppercase tracking-wider text-black">Safe Custodian</p>
                    <p className="text-[10px] text-gray-500 uppercase mt-1">Name & Signature</p>
                  </div>
                  <div>
                    <div className="border-b border-black h-12 mb-2"></div>
                    <p className="text-xs font-bold uppercase tracking-wider text-black">Finance Manager</p>
                    <p className="text-[10px] text-gray-500 uppercase mt-1">Name & Signature</p>
                  </div>
                  <div>
                    <div className="border-b border-black h-12 mb-2"></div>
                    <p className="text-xs font-bold uppercase tracking-wider text-black">Branch Manager</p>
                    <p className="text-[10px] text-gray-500 uppercase mt-1">Name & Signature</p>
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div className="text-center pt-8 opacity-50">
                <p className="text-[9px] font-bold uppercase tracking-widest">Confidential - Internal Use Only</p>
              </div>

            </div>
          </div>
        )}

      </div>
    </PageTransition>
  );
}
