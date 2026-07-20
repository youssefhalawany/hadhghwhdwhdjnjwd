"use client";

import React, { useMemo, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TrendingDown, Package, Calendar, AlertTriangle, BarChart2 } from "lucide-react";

interface WasteItem {
  id: string;
  name: string;
  barcode?: string;
  category?: string;
  quantity: number;
  storeId?: string;
  date?: string;
  createdAt?: string;
  sellingPrice?: number;
  price?: number;
}

interface Props {
  alreadyExpired: WasteItem[];
  currentBranch: string;
}

const PRICE_FALLBACK = 15; // EGP default per unit if no price data

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toISOString().split("T")[0];
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function WasteAnalyticsPanel({ alreadyExpired, currentBranch }: Props) {
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [productPrices, setProductPrices] = React.useState<Map<string, number>>(new Map());

  // Fetch prices from products collection
  React.useEffect(() => {
    const q = query(collection(db, "products"), limit(500));
    const unsub = onSnapshot(q, (snap) => {
      const map = new Map<string, number>();
      snap.docs.forEach(doc => {
        const data = doc.data();
        const barcode = data.barcode || data.code;
        const price = Number(data.currentPrice || data.price || data.sellingPrice || 0);
        if (barcode && price > 0) {
          map.set(String(barcode), price);
        }
      });
      setProductPrices(map);
    });
    return () => unsub();
  }, []);

  const filteredItems = useMemo(() => {
    return alreadyExpired.filter(i => {
      if (currentBranch === "all") return true;
      const s = (i.storeId || "").toLowerCase();
      if (currentBranch === "ola") return s.includes("ola") || s.includes("koronfol");
      return s.includes("alamein");
    });
  }, [alreadyExpired, currentBranch]);

  const analytics = useMemo(() => {
    const now = new Date();

    // Calculate cost for each item
    const withCost = filteredItems.map(item => {
      const price = productPrices.get(String(item.barcode || "")) || item.sellingPrice || item.price || PRICE_FALLBACK;
      const qty = Number(item.quantity) || 0;
      const cost = price * qty;
      const dateStr = item.date || (item.createdAt ? item.createdAt.split("T")[0] : null) || now.toISOString().split("T")[0];
      return { ...item, price, cost, dateStr };
    });

    // Period grouping
    const groupMap = new Map<string, { label: string; cost: number; qty: number }>();

    withCost.forEach(item => {
      const key = period === "week" ? getWeekKey(item.dateStr) : getMonthKey(item.dateStr);
      if (!groupMap.has(key)) {
        const d = new Date(key + (period === "week" ? "" : "-01"));
        const label = period === "week"
          ? `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        groupMap.set(key, { label, cost: 0, qty: 0 });
      }
      const g = groupMap.get(key)!;
      g.cost += item.cost;
      g.qty += item.quantity || 0;
    });

    const periods = Array.from(groupMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([key, v]) => ({ key, ...v }));

    // Category breakdown
    const catMap = new Map<string, { cost: number; qty: number }>();
    withCost.forEach(item => {
      const cat = item.category || "Uncategorized";
      const prev = catMap.get(cat) || { cost: 0, qty: 0 };
      catMap.set(cat, { cost: prev.cost + item.cost, qty: prev.qty + (Number(item.quantity) || 0) });
    });
    const topCategories = Array.from(catMap.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 6)
      .map(([cat, data]) => ({ cat, ...data }));

    // Top wasted items
    const itemMap = new Map<string, { name: string; cost: number; qty: number }>();
    withCost.forEach(item => {
      const key = item.barcode || item.name;
      const prev = itemMap.get(key) || { name: item.name, cost: 0, qty: 0 };
      itemMap.set(key, { name: item.name || prev.name, cost: prev.cost + item.cost, qty: prev.qty + (Number(item.quantity) || 0) });
    });
    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8);

    const totalCost = withCost.reduce((s, i) => s + i.cost, 0);
    const totalQty = withCost.reduce((s, i) => s + (Number(i.quantity) || 0), 0);

    // This month
    const thisMonth = getMonthKey(now.toISOString());
    const thisMonthCost = withCost
      .filter(i => getMonthKey(i.dateStr) === thisMonth)
      .reduce((s, i) => s + i.cost, 0);

    // Last month
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = getMonthKey(lastMonthDate.toISOString());
    const lastMonthCost = withCost
      .filter(i => getMonthKey(i.dateStr) === lastMonth)
      .reduce((s, i) => s + i.cost, 0);

    const trend = lastMonthCost > 0 ? ((thisMonthCost - lastMonthCost) / lastMonthCost) * 100 : 0;

    return { periods, topCategories, topItems, totalCost, totalQty, thisMonthCost, lastMonthCost, trend };
  }, [filteredItems, productPrices, period]);

  const maxPeriodCost = Math.max(...analytics.periods.map(p => p.cost), 1);
  const maxCatCost = Math.max(...analytics.topCategories.map(c => c.cost), 1);

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200/50 dark:border-orange-700/30 rounded-2xl p-4">
          <div className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Total Waste Cost</div>
          <div className="text-2xl font-black text-orange-700 dark:text-orange-300">EGP {analytics.totalCost.toFixed(0)}</div>
          <div className="text-xs text-orange-500 mt-1">{analytics.totalQty} units destroyed</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-700/30 rounded-2xl p-4">
          <div className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">This Month</div>
          <div className="text-2xl font-black text-red-700 dark:text-red-300">EGP {analytics.thisMonthCost.toFixed(0)}</div>
          <div className={`text-xs mt-1 font-bold ${analytics.trend > 0 ? "text-red-500" : "text-emerald-500"}`}>
            {analytics.trend > 0 ? "▲" : "▼"} {Math.abs(analytics.trend).toFixed(1)}% vs last month
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border border-border rounded-2xl p-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Last Month</div>
          <div className="text-2xl font-black text-slate-700 dark:text-slate-200">EGP {analytics.lastMonthCost.toFixed(0)}</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-700/30 rounded-2xl p-4">
          <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Avg. Unit Price Used</div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
            EGP {analytics.totalQty > 0 ? (analytics.totalCost / analytics.totalQty).toFixed(1) : "0"}
          </div>
          <div className="text-xs text-amber-500 mt-1">per unit average</div>
        </div>
      </div>

      {/* Period Toggle + Chart */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Waste Cost Over Time
          </h3>
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setPeriod("week")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${period === "week" ? "bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-white" : "text-slate-500"}`}
            >
              Weekly
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${period === "month" ? "bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-white" : "text-slate-500"}`}
            >
              Monthly
            </button>
          </div>
        </div>

        {analytics.periods.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm font-medium italic">No waste data recorded yet.</div>
        ) : (
          <div className="flex items-end gap-2 h-44">
            {analytics.periods.map((p, i) => (
              <div key={p.key} className="flex-1 flex flex-col items-center gap-1 group relative">
                {/* Tooltip */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  EGP {p.cost.toFixed(0)} · {p.qty} units
                </div>
                <div className="text-[9px] font-bold text-orange-500">{p.cost > 0 ? `${p.cost.toFixed(0)}` : ""}</div>
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-orange-500 to-red-400 transition-all"
                  style={{ height: `${Math.max((p.cost / maxPeriodCost) * 100, p.cost > 0 ? 6 : 1)}%`, minHeight: p.cost > 0 ? 8 : 2 }}
                />
                <div className="text-[9px] font-bold text-slate-400 text-center leading-tight mt-1 max-w-[40px] truncate" title={p.label}>
                  {p.label.split(" ").slice(0, 2).join(" ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2-col: Category + Top Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-5">
            Waste by Category
          </h3>
          {analytics.topCategories.length === 0 ? (
            <p className="text-slate-400 text-sm italic">No category data yet.</p>
          ) : (
            <div className="space-y-3">
              {analytics.topCategories.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize">{item.cat}</span>
                    <span className="text-xs font-black text-orange-500">EGP {item.cost.toFixed(0)}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-red-400"
                      style={{ width: `${(item.cost / maxCatCost) * 100}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{item.qty} units</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Wasted Items */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-5">
            Highest Waste Items
          </h3>
          {analytics.topItems.length === 0 ? (
            <p className="text-slate-400 text-sm italic">No items recorded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {analytics.topItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-black w-5 text-center shrink-0 ${i === 0 ? "text-red-500" : i === 1 ? "text-orange-500" : "text-slate-400"}`}>
                      #{i + 1}
                    </span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{item.name}</span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-sm font-black text-orange-600 dark:text-orange-400">EGP {item.cost.toFixed(0)}</div>
                    <div className="text-[10px] text-slate-400">{item.qty} units</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center italic">
        * Prices are pulled from the products database. Items with no price on record use a default of EGP {PRICE_FALLBACK}/unit.
      </p>
    </div>
  );
}
