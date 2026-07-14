"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getAggregateFromServer,
  sum,
  count
} from "firebase/firestore";
import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { useBranch } from "@/context/BranchContext";

/**
 * ZERO-READ OVERVIEW
 * ------------------
 * All data fetching here uses getAggregateFromServer() which performs
 * SUM/COUNT operations directly on Firebase servers and counts as
 * ZERO document reads against the daily quota.
 *
 * DO NOT replace these with getDocs() - that would read every document.
 */
export default function FinancialInputsOverview() {
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalPayments: 0,
    depositsToSafe: 0,
    depositsFromSafe: 0,
    safeMoney: 0
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);

        // Helper to get correct branch ID format based on store logic
        const branchIds = [];
        if (currentBranch === "all") {
          // Admins can see everything, no filter needed
        } else if (currentBranch === "alamein4") {
          branchIds.push("eL-alamein-4");
        } else if (currentBranch === "ola") {
          branchIds.push("ola-el-koronfol");
        } else {
          branchIds.push(currentBranch);
        }

        // --- ZERO READ: aggregate sums on the server ---
        
        let salesQ: any = collection(db, "sales");
        let allPaymentsQ: any = collection(db, "cash_payments");
        let cashPaymentsQ: any = query(collection(db, "cash_payments"), where("method", "==", "cash"));
        let depositsToQ: any = query(collection(db, "deposits"), where("to", "==", "safe"));
        let depositsFromQ: any = query(collection(db, "deposits"), where("from", "==", "safe"));

        // If manager, we MUST filter by storeId or Firestore rules will reject with Permission Denied
        if (branchIds.length > 0) {
          salesQ = query(salesQ, where("storeId", "in", branchIds));
          allPaymentsQ = query(allPaymentsQ, where("storeId", "in", branchIds));
          cashPaymentsQ = query(cashPaymentsQ, where("storeId", "in", branchIds));
          depositsToQ = query(depositsToQ, where("storeId", "in", branchIds));
          depositsFromQ = query(depositsFromQ, where("storeId", "in", branchIds));
        }

        // 1. Sales: sum of cash + overShort
        const salesAgg = await getAggregateFromServer(salesQ, { cash: sum("cash"), overShort: sum("overShort") });
        const totalSales = (salesAgg.data().cash || 0) + (salesAgg.data().overShort || 0);

        // 2. All payments (display only)
        const allPaymentsAgg = await getAggregateFromServer(allPaymentsQ, { amount: sum("amount") });
        const totalPayments = allPaymentsAgg.data().amount || 0;

        // 3. Cash-only payments (for safe deduction)
        const cashPaymentsAgg = await getAggregateFromServer(cashPaymentsQ, { amount: sum("amount") });
        const totalCashPayments = cashPaymentsAgg.data().amount || 0;

        // 4. Deposits into safe
        const depositsToAgg = await getAggregateFromServer(depositsToQ, { amount: sum("amount") });
        const depositsToSafe = depositsToAgg.data().amount || 0;

        // 5. Deposits out of safe
        const depositsFromAgg = await getAggregateFromServer(depositsFromQ, { amount: sum("amount") });
        const depositsFromSafe = depositsFromAgg.data().amount || 0;

        setStats({
          totalSales,
          totalPayments,
          depositsToSafe,
          depositsFromSafe,
          safeMoney: totalSales - totalCashPayments + depositsToSafe - depositsFromSafe
        });
      } catch (err: any) {
        console.error("Aggregate fetch error:", err);
        setError(err?.message || "Unknown error");
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
        <p className="font-bold">Loading overview...</p>
        <p className="text-xs opacity-60 mt-1">Using zero-read server aggregations</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-red-500 gap-4">
        <AlertTriangle className="h-12 w-12" />
        <p className="font-bold text-lg">Failed to load data</p>
        <p className="text-sm font-mono bg-red-50 dark:bg-red-900/20 p-4 rounded-xl max-w-xl text-center break-words">
          {error}
        </p>
        <p className="text-sm text-slate-500 max-w-md text-center">
          This may be caused by a missing Firestore index. Check the browser console for an index creation link.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Safe Balance Hero */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <ShieldCheck size={120} />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 text-emerald-100 font-bold uppercase tracking-widest text-sm">
            <ShieldCheck className="h-5 w-5" />
            LIFETIME SAFE BALANCE
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter drop-shadow-sm">
            EGP {fmt(stats.safeMoney)}
          </h1>
          <p className="text-emerald-100/80 font-medium text-sm">
            Cash Sales − Cash Payments + Deposits In − Deposits Out
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card border border-border shadow-sm p-6 rounded-2xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
            Lifetime Cash Sales
          </p>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-50">
            EGP {fmt(stats.totalSales)}
          </p>
        </div>
        <div className="bg-card border border-border shadow-sm p-6 rounded-2xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
            Lifetime Payments
          </p>
          <p className="text-2xl font-black text-red-600 dark:text-red-400">
            EGP {fmt(stats.totalPayments)}
          </p>
        </div>
        <div className="bg-card border border-border shadow-sm p-6 rounded-2xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
            Deposits To Safe
          </p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            EGP {fmt(stats.depositsToSafe)}
          </p>
        </div>
        <div className="bg-card border border-border shadow-sm p-6 rounded-2xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
            Deposits From Safe
          </p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
            EGP {fmt(stats.depositsFromSafe)}
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-emerald-800 dark:text-emerald-200 text-sm flex gap-4 items-start">
        <ShieldCheck className="h-6 w-6 shrink-0 mt-0.5 text-emerald-500" />
        <div>
          <p className="font-bold mb-1">Zero-Read Aggregations Active</p>
          <p className="opacity-90 leading-relaxed">
            This page uses <strong>getAggregateFromServer()</strong> — Firebase performs all
            SUM calculations on its servers without sending a single document to the browser.
            This costs <strong>0 document reads</strong> regardless of how many records exist.
            Safe balance formula:{" "}
            <strong>
              (Cash Sales + Over/Short) − Cash Payments − Bank/Visa Payments + Deposits(to Safe) −
              Deposits(from Safe)
            </strong>
            . Bank and Visa payments do <strong>not</strong> reduce the physical safe.
          </p>
        </div>
      </div>
    </div>
  );
}
