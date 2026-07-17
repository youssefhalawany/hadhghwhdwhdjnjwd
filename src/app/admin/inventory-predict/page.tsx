"use client";

import React, { useState } from "react";
import { useBranch } from "@/context/BranchContext";
import { PackageSearch, TrendingUp, AlertCircle, ShoppingCart } from "lucide-react";

export default function InventoryPredictionPage() {
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(false);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-sm font-semibold mb-3">
            <TrendingUp className="h-4 w-4" />
            AI Predictive Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight">
            Automated Reorder Alerts
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Analyze expiries and supplier deliveries to predict when critical inventory will run out.
          </p>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-6 rounded-2xl">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-2">Pending Configuration</h3>
            <p className="text-amber-700 dark:text-amber-400/80 mb-4">
              To accurately generate a "Reorder List" for items like water, cigarettes, and coffee, the system needs a baseline of expiries and supplier orders. Currently, the shift reports track total generic revenue instead of itemized metrics.
            </p>
            <p className="text-amber-700 dark:text-amber-400/80">
              Please choose a method to ingest itemized orders and expiries (e.g. logging supplier deliveries, or syncing from the receipt extraction API) to activate these predictions.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-50 pointer-events-none">
        <div className="bg-white dark:bg-slate-900 border rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600">
              <PackageSearch className="h-6 w-6" />
            </div>
            <span className="text-xs font-bold px-2 py-1 bg-red-100 text-red-600 rounded-lg">Critical Low</span>
          </div>
          <h3 className="font-bold text-lg">Marlboro Red</h3>
          <p className="text-slate-500 text-sm mb-4">Current est. stock: 4 cartons</p>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-red-500 w-[15%] h-full" />
          </div>
          <p className="text-xs text-slate-400 mt-2">Predicted to run out in 2 days</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <span className="text-xs font-bold px-2 py-1 bg-amber-100 text-amber-600 rounded-lg">Reorder Soon</span>
          </div>
          <h3 className="font-bold text-lg">Dasani Water 1.5L</h3>
          <p className="text-slate-500 text-sm mb-4">Current est. stock: 12 packs</p>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-amber-500 w-[30%] h-full" />
          </div>
          <p className="text-xs text-slate-400 mt-2">Predicted to run out in 5 days</p>
        </div>
      </div>
    </div>
  );
}
