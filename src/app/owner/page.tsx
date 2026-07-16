"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getAggregateFromServer, sum } from "firebase/firestore";
import {
  TrendingUp, Wallet, CreditCard, Building, Activity, ShieldCheck, Landmark, ExternalLink, AlertTriangle
} from "lucide-react";
import { PullToRefresh } from "@/components/MobileUX/PullToRefresh";
import { showIsland } from "@/components/MobileUX/DynamicIsland";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { hapticMedium, vibrateSuccess } from "@/lib/haptics";

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
  const [loading, setLoading] = useState(true);
  const [missingIndexes, setMissingIndexes] = useState<string[]>([]);
  
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

  const loadData = async () => {
    setLoading(true);
    setMissingIndexes([]);
    const collectedUrls = new Set<string>();

    try {
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
  };

  useEffect(() => { loadData(); }, []);

  const handleRefresh = async () => {
    if (navigator.vibrate) navigator.vibrate(50);
    await loadData();
    showIsland("Dashboard Updated", { type: "success" });
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);

  if (loading) {
    return (
        <div style={{ padding: "54px 20px 20px" }}>
            <div style={{ height: 30, width: 120, backgroundColor: D.surfaceHigh, borderRadius: 8, marginBottom: 40, animation: "pulse 2s infinite" }} />
            <div style={{ height: 40, width: 200, backgroundColor: D.surfaceHigh, borderRadius: 8, marginBottom: 20, animation: "pulse 2s infinite" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                <div style={{ height: 180, backgroundColor: D.surface, borderRadius: 24, animation: "pulse 2s infinite" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div style={{ height: 120, backgroundColor: D.surface, borderRadius: 24, animation: "pulse 2s infinite" }} />
                    <div style={{ height: 120, backgroundColor: D.surface, borderRadius: 24, animation: "pulse 2s infinite" }} />
                </div>
                <div style={{ height: 100, backgroundColor: D.surface, borderRadius: 24, animation: "pulse 2s infinite" }} />
            </div>
        </div>
    );
  }

  if (missingIndexes.length > 0) {
    return (
      <div style={{ padding: "54px 20px 20px", color: D.red, textAlign: "center" }}>
        <AlertTriangle size={48} style={{ margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>Missing Indexes</h2>
        <p style={{ fontSize: 14, color: D.textSecondary, marginBottom: 24 }}>
          Please create the required Firebase indexes to view these metrics.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {missingIndexes.map((url, i) => (
            <a 
              key={i}
              href={url} 
              target="_blank" 
              rel="noreferrer"
              style={{ background: D.surfaceHigh, padding: "12px 16px", borderRadius: 12, color: D.red, textDecoration: "none", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              Create Index #{i + 1}
              <ExternalLink size={16} />
            </a>
          ))}
        </div>
      </div>
    );
  }

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
              className="mb-8"
            >
                <h1 className="text-3xl font-black m-0 text-white tracking-tight">{lang === "en" ? "Overview" : "الرئيسية"}</h1>
                <p className="text-sm text-slate-400 mt-1">{lang === "en" ? "Lifetime enterprise financials" : "المالية الشاملة للمؤسسة"}</p>
            </motion.div>

            {/* Balances Chart */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="w-full h-40 mb-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-[40px] pointer-events-none" />
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: D.textSecondary, fontSize: 12, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: D.textDim, fontSize: 10 }} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: D.surfaceHigh, border: `1px solid ${D.border}`, borderRadius: 12, color: '#fff', fontWeight: 700 }} />
                  <Bar dataKey="amount" radius={[8, 8, 8, 8]} barSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            <div className="grid grid-cols-1 gap-5">
              
              {/* ---------------- SAFE SECTION ---------------- */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => hapticMedium()}
                className="bg-[#151E32]/60 backdrop-blur-2xl rounded-[2rem] p-6 border border-emerald-500/20 shadow-[0_8px_32px_rgba(16,185,129,0.05)] relative overflow-hidden group cursor-pointer"
              >
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500" />
                
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest">
                        <ShieldCheck size={18} /> {lang === "en" ? "Lifetime Safe Balance" : "رصيد الخزينة الشامل"}
                    </div>
                </div>
                
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-black text-emerald-500">EGP</span>
                  <span className="text-[2.75rem] font-black text-white tracking-tighter leading-none">{fmt(stats.safeMoney)}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-[90%] mb-5">
                  Cash Sales − Cash Payments (incl. Credits & Tax) + Deposits In − Deposits Out − Payrolls & Loans
                </p>

                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-5">
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{lang === "en" ? "Total Cash Sales" : "إجمالي المبيعات النقدية"}</div>
                        <div className="text-lg text-white font-black">{fmt(stats.totalSales)}</div>
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{lang === "en" ? "Total Outflows" : "إجمالي المصروفات"}</div>
                        <div className="text-lg text-white font-black">{fmt(stats.totalCashPayments + stats.totalOldCreditsCash + stats.totalTaxPaid + stats.totalPayrolls + stats.totalLoans)}</div>
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
                className="bg-[#151E32]/60 backdrop-blur-2xl rounded-[2rem] p-6 border border-indigo-500/20 shadow-[0_8px_32px_rgba(99,102,241,0.05)] relative overflow-hidden group cursor-pointer"
              >
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-500" />
                
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest">
                        <Landmark size={18} /> {lang === "en" ? "Lifetime Bank Balance" : "رصيد البنك الشامل"}
                    </div>
                </div>
                
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-black text-indigo-500">EGP</span>
                  <span className="text-[2.75rem] font-black text-white tracking-tighter leading-none">{fmt(stats.bankMoney)}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-[90%] mb-5">
                  Visa Sales − Bank Payments − Bank Tax Paid − Bank Credits + Deposits In − Deposits Out
                </p>

                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-5">
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{lang === "en" ? "Total Visa Sales" : "إجمالي مبيعات الفيزا"}</div>
                        <div className="text-lg text-white font-black">{fmt(stats.totalVisaSales)}</div>
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{lang === "en" ? "Total Outflows" : "إجمالي المصروفات"}</div>
                        <div className="text-lg text-white font-black">{fmt(stats.totalBankPayments + stats.totalBankTaxPaid + stats.totalBankCredits)}</div>
                    </div>
                </div>
              </motion.div>

              {/* Quick Metrics Grid */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-2 gap-3"
              >
                  <motion.div whileTap={{ scale: 0.95 }} className="bg-[#151E32]/40 backdrop-blur-xl rounded-3xl p-5 border border-white/5">
                    <div className="text-[10px] text-slate-500 uppercase font-black tracking-wider mb-2">{lang === "en" ? "Bank Payments" : "مدفوعات بنكية"}</div>
                    <div className="text-xl text-white font-black tracking-tight">{fmt(stats.totalBankPayments)}</div>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.95 }} className="bg-[#151E32]/40 backdrop-blur-xl rounded-3xl p-5 border border-white/5">
                    <div className="text-[10px] text-slate-500 uppercase font-black tracking-wider mb-2">{lang === "en" ? "Bank Credits" : "ذمم بنكية"}</div>
                    <div className="text-xl text-white font-black tracking-tight">{fmt(stats.totalBankCredits)}</div>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.95 }} className="bg-emerald-900/10 backdrop-blur-xl rounded-3xl p-5 border border-emerald-500/20">
                    <div className="text-[10px] text-emerald-400 uppercase font-black tracking-wider mb-2">{lang === "en" ? "Safe Deposits In" : "إيداعات للخزينة"}</div>
                    <div className="text-xl text-white font-black tracking-tight">+{fmt(stats.depositsToSafe)}</div>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.95 }} className="bg-rose-900/10 backdrop-blur-xl rounded-3xl p-5 border border-rose-500/20">
                    <div className="text-[10px] text-rose-400 uppercase font-black tracking-wider mb-2">{lang === "en" ? "Safe Deposits Out" : "سحوبات من الخزينة"}</div>
                    <div className="text-xl text-white font-black tracking-tight">-{fmt(stats.depositsFromSafe)}</div>
                  </motion.div>
              </motion.div>

            </div>
          </div>
        </PullToRefresh>
      </div>
    </div>
  );
}
