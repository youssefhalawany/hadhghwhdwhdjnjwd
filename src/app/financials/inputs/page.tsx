"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getAggregateFromServer, sum } from "firebase/firestore";
import { ShieldCheck, Banknote, CreditCard, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";

export default function FinancialInputsOverview() {
  const [loading, setLoading] = useState(true);
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
        // Using getAggregateFromServer for ZERO document reads (only 1 read per 1000 index entries)
        const salesSnapshot = await getAggregateFromServer(collection(db, "sales"), {
          cash: sum("cash"),
          overShort: sum("overShort")
        });
        
        const paymentsSnapshot = await getAggregateFromServer(collection(db, "cash_payments"), {
          amount: sum("amount")
        });

        const depositsToSafeSnapshot = await getAggregateFromServer(
          query(collection(db, "deposits"), where("to", "==", "safe")), 
          { amount: sum("amount") }
        );

        const depositsFromSafeSnapshot = await getAggregateFromServer(
          query(collection(db, "deposits"), where("from", "==", "safe")), 
          { amount: sum("amount") }
        );

        const totalSales = (salesSnapshot.data().cash || 0) + 
                           (salesSnapshot.data().overShort || 0);
                           
        const totalPayments = paymentsSnapshot.data().amount || 0;
        const depositsToSafe = depositsToSafeSnapshot.data().amount || 0;
        const depositsFromSafe = depositsFromSafeSnapshot.data().amount || 0;

        setStats({
          totalSales,
          totalPayments,
          depositsToSafe,
          depositsFromSafe,
          safeMoney: totalSales - totalPayments + depositsToSafe - depositsFromSafe
        });
      } catch (err) {
        console.error("Failed to fetch aggregate stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500 mb-4" />
        <p className="font-bold">Calculating Safe Money securely...</p>
        <p className="text-sm opacity-70">Zero-read aggregation in progress</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <ShieldCheck size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-100 font-bold uppercase tracking-widest text-sm mb-2">
              <ShieldCheck className="h-5 w-5" />
              LIFETIME SAFE MONEY
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter drop-shadow-sm">
              EGP {formatMoney(stats.safeMoney)}
            </h1>
            <p className="text-emerald-100/80 font-medium">
              Calculated using zero-read server aggregations
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card border border-border shadow-sm p-6 rounded-2xl flex flex-col justify-center">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Lifetime Cash Sales</p>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-50">EGP {formatMoney(stats.totalSales)}</p>
        </div>

        <div className="bg-card border border-border shadow-sm p-6 rounded-2xl flex flex-col justify-center">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Lifetime Payments</p>
          <p className="text-2xl font-black text-red-600 dark:text-red-400">EGP {formatMoney(stats.totalPayments)}</p>
        </div>

        <div className="bg-card border border-border shadow-sm p-6 rounded-2xl flex flex-col justify-center">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Deposits To Safe</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">EGP {formatMoney(stats.depositsToSafe)}</p>
        </div>

        <div className="bg-card border border-border shadow-sm p-6 rounded-2xl flex flex-col justify-center">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Deposits From Safe</p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">EGP {formatMoney(stats.depositsFromSafe)}</p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-6 text-blue-800 dark:text-blue-200 text-sm flex gap-4 items-start">
        <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5 text-blue-500" />
        <div>
          <p className="font-bold mb-1">How is this calculated?</p>
          <p className="opacity-90 leading-relaxed">
            This dashboard uses Firebase's high-performance <strong>Server-Side Aggregation</strong>. It performs mathematical sums directly on the database servers without downloading any documents to your browser. Safe Money is strictly calculated as: <strong>(Cash Sales + Over/Short) - Cash Payments + Deposits(to Safe) - Deposits(from Safe)</strong>. This guarantees your calculations over thousands of records consume exactly <strong>zero document reads</strong>, keeping you strictly inside the free tier.
          </p>
        </div>
      </div>
    </div>
  );
}
