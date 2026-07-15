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

  return (
    <div style={{ direction: "ltr", color: D.textPrimary }}>
      <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: 100 }}>
        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "54px 20px 10px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: D.textSecondary, textTransform: "uppercase" }}>
            CIRCLE K <span style={{ color: D.textDim, fontWeight: 500 }}>{lang === "en" ? "Owner" : "المالك"}</span>
          </div>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: D.cyan, display: "flex", alignItems: "center", justifyContent: "center", color: D.bg, boxShadow: `0 0 10px ${D.cyanDim}` }}>
            <Activity size={16} />
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <PullToRefresh onRefresh={handleRefresh}>
        <div style={{ padding: "0 20px" }}>
          <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: D.textPrimary }}>{lang === "en" ? "Overview" : "الرئيسية"}</h1>
              <p style={{ fontSize: 14, color: D.textSecondary, marginTop: 4 }}>{lang === "en" ? "Lifetime enterprise financials" : "المالية الشاملة للمؤسسة"}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            
            {/* ---------------- SAFE SECTION ---------------- */}
            <div style={{ backgroundColor: D.surface, borderRadius: 24, padding: "24px 20px", border: `1px solid ${D.greenBorder}`, boxShadow: "0 8px 32px rgba(16, 185, 129, 0.1)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -40, right: -40, width: 150, height: 150, background: D.greenDim, borderRadius: "50%", filter: "blur(30px)", pointerEvents: "none" }} />
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: D.green, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      <ShieldCheck size={16} /> {lang === "en" ? "Lifetime Safe Balance" : "رصيد الخزينة الشامل"}
                  </div>
              </div>
              
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: D.green }}>EGP</span>
                <span style={{ fontSize: 42, fontWeight: 900, color: D.textPrimary, letterSpacing: "-0.02em" }}>{fmt(stats.safeMoney)}</span>
              </div>
              <p style={{ fontSize: 11, color: D.textDim, lineHeight: 1.4, maxWidth: "90%" }}>
                Cash Sales − Cash Payments (incl. Credits & Tax) + Deposits In − Deposits Out − Payrolls & Loans
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: `1px solid ${D.borderMid}`, paddingTop: 16, marginTop: 16 }}>
                  <div>
                      <div style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Total Cash Sales" : "إجمالي المبيعات النقدية"}</div>
                      <div style={{ fontSize: 16, color: D.textPrimary, fontWeight: 800 }}>{fmt(stats.totalSales)}</div>
                  </div>
                  <div>
                      <div style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Total Outflows" : "إجمالي المصروفات"}</div>
                      <div style={{ fontSize: 16, color: D.textPrimary, fontWeight: 800 }}>{fmt(stats.totalCashPayments + stats.totalOldCreditsCash + stats.totalTaxPaid + stats.totalPayrolls + stats.totalLoans)}</div>
                  </div>
              </div>
            </div>

            {/* ---------------- BANK SECTION ---------------- */}
            <div style={{ backgroundColor: D.surface, borderRadius: 24, padding: "24px 20px", border: `1px solid ${D.indigoBorder}`, boxShadow: "0 8px 32px rgba(99, 102, 241, 0.1)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -40, right: -40, width: 150, height: 150, background: D.indigoDim, borderRadius: "50%", filter: "blur(30px)", pointerEvents: "none" }} />
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: D.indigo, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      <Landmark size={16} /> {lang === "en" ? "Lifetime Bank Balance" : "رصيد البنك الشامل"}
                  </div>
              </div>
              
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: D.indigo }}>EGP</span>
                <span style={{ fontSize: 42, fontWeight: 900, color: D.textPrimary, letterSpacing: "-0.02em" }}>{fmt(stats.bankMoney)}</span>
              </div>
              <p style={{ fontSize: 11, color: D.textDim, lineHeight: 1.4, maxWidth: "90%" }}>
                Visa Sales − Bank Payments − Bank Tax Paid − Bank Credits + Deposits In − Deposits Out
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: `1px solid ${D.borderMid}`, paddingTop: 16, marginTop: 16 }}>
                  <div>
                      <div style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Total Visa Sales" : "إجمالي مبيعات الفيزا"}</div>
                      <div style={{ fontSize: 16, color: D.textPrimary, fontWeight: 800 }}>{fmt(stats.totalVisaSales)}</div>
                  </div>
                  <div>
                      <div style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Total Outflows" : "إجمالي المصروفات"}</div>
                      <div style={{ fontSize: 16, color: D.textPrimary, fontWeight: 800 }}>{fmt(stats.totalBankPayments + stats.totalBankTaxPaid + stats.totalBankCredits)}</div>
                  </div>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ backgroundColor: D.surface, borderRadius: 20, padding: "16px", border: `1px solid ${D.border}` }}>
                  <div style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 800, marginBottom: 4 }}>{lang === "en" ? "Bank Payments" : "مدفوعات بنكية"}</div>
                  <div style={{ fontSize: 18, color: D.textPrimary, fontWeight: 900 }}>{fmt(stats.totalBankPayments)}</div>
                </div>
                <div style={{ backgroundColor: D.surface, borderRadius: 20, padding: "16px", border: `1px solid ${D.border}` }}>
                  <div style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 800, marginBottom: 4 }}>{lang === "en" ? "Bank Credits" : "ذمم بنكية"}</div>
                  <div style={{ fontSize: 18, color: D.textPrimary, fontWeight: 900 }}>{fmt(stats.totalBankCredits)}</div>
                </div>
                <div style={{ backgroundColor: D.surface, borderRadius: 20, padding: "16px", border: `1px solid ${D.greenBorder}` }}>
                  <div style={{ fontSize: 10, color: D.green, textTransform: "uppercase", fontWeight: 800, marginBottom: 4 }}>{lang === "en" ? "Safe Deposits In" : "إيداعات للخزينة"}</div>
                  <div style={{ fontSize: 18, color: D.textPrimary, fontWeight: 900 }}>+ {fmt(stats.depositsToSafe)}</div>
                </div>
                <div style={{ backgroundColor: D.surface, borderRadius: 20, padding: "16px", border: `1px solid ${D.border}` }}>
                  <div style={{ fontSize: 10, color: D.red, textTransform: "uppercase", fontWeight: 800, marginBottom: 4 }}>{lang === "en" ? "Safe Deposits Out" : "سحوبات من الخزينة"}</div>
                  <div style={{ fontSize: 18, color: D.textPrimary, fontWeight: 900 }}>- {fmt(stats.depositsFromSafe)}</div>
                </div>
            </div>

          </div>
        </div>
      </PullToRefresh>
      </div>
    </div>
  );
}
