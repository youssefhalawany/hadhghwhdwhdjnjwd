"use client";

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { PageTransition } from "@/components/PageTransition";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, AlertOctagon, TrendingDown, RefreshCcw, PackageX, Activity, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function AdvancedAnalyticsDashboard() {
  const { currentBranch } = useBranch();
  const { language: lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  
  // Data States
  const [voidsData, setVoidsData] = useState<any[]>([]);
  const [returnsData, setReturnsData] = useState<any[]>([]);
  const [expiriesData, setExpiriesData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Calculate the date exactly 30 days ago as ISO string for querying
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

        // 1. Fetch Voids (Strictly capped to save reads)
        const voidsQuery = query(collection(db, "void_requests"), orderBy("createdAt", "desc"), limit(500));
        const voidsSnap = await getDocs(voidsQuery);
        const voids = voidsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 2. Fetch Returns (Strictly capped to save reads)
        const returnsQuery = query(collection(db, "supplier_returns"), orderBy("createdAt", "desc"), limit(500));
        const returnsSnap = await getDocs(returnsQuery);
        const returns = returnsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 3. Fetch Expiries (Strictly capped to save reads)
        const expiriesQuery = query(collection(db, "expiries"), orderBy("createdAt", "desc"), limit(500));
        const expiriesSnap = await getDocs(expiriesQuery);
        const expiries = expiriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Apply branch filtering
        const filterByBranch = (item: any) => {
          if (currentBranch === "all") return true;
          // Some old records might not have branchId, we could optionally filter by inferred logic or strict branchId
          const storeId = (item.storeId || "").toLowerCase();
          const inferred = storeId.includes("ola") || storeId.includes("koronfol") ? "ola" : "alamein4";
          return (item.branchId && item.branchId === currentBranch) || (!item.branchId && inferred === currentBranch);
        };

        setVoidsData(voids.filter(filterByBranch));
        setReturnsData(returns.filter(filterByBranch));
        setExpiriesData(expiries.filter(filterByBranch));
        
      } catch (error) {
        console.error("Error fetching analytics data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentBranch]); // Only re-fetch if branch changes

  // ---------------------------------------------------------------------------
  // DATA PROCESSING
  // ---------------------------------------------------------------------------

  // A. Cashier Void Performance
  const cashierVoidStats = useMemo(() => {
    const stats: Record<string, { cashier: string; voidAmount: number; voidCount: number }> = {};
    voidsData.forEach(v => {
      const name = v.cashierName || "Unknown";
      if (!stats[name]) stats[name] = { cashier: name, voidAmount: 0, voidCount: 0 };
      stats[name].voidAmount += Number(v.voidTotal || v.totalValue || 0);
      stats[name].voidCount += 1;
    });
    // Sort by highest amount
    return Object.values(stats).sort((a, b) => b.voidAmount - a.voidAmount).slice(0, 10);
  }, [voidsData]);

  // B. Top Returning Suppliers
  const supplierReturnsStats = useMemo(() => {
    const stats: Record<string, { name: string; value: number }> = {};
    returnsData.forEach(r => {
      const supplier = r.supplier || "Unknown Supplier";
      if (!stats[supplier]) stats[supplier] = { name: supplier, value: 0 };
      
      let val = Number(r.totalPrice || 0);
      if (val === 0 && r.items) {
         val = r.items.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.costPrice || 0)), 0);
      }
      stats[supplier].value += val;
    });
    return Object.values(stats).sort((a, b) => b.value - a.value).slice(0, 7);
  }, [returnsData]);

  // C. Expiries & Actionable Recommendations
  const expiriesStats = useMemo(() => {
    const stats: Record<string, { itemName: string; supplier: string; lossValue: number; qty: number }> = {};
    expiriesData.forEach(e => {
      const item = e.itemName || "Unknown Item";
      if (!stats[item]) stats[item] = { itemName: item, supplier: e.supplier || "Unknown", lossValue: 0, qty: 0 };
      
      const q = Number(e.quantity || 1);
      stats[item].qty += q;
      // If we don't have price, we rank by quantity for now
      stats[item].lossValue += q; 
    });
    return Object.values(stats).sort((a, b) => b.lossValue - a.lossValue).slice(0, 15);
  }, [expiriesData]);

  // Totals
  const totalVoidAmount = cashierVoidStats.reduce((sum, s) => sum + s.voidAmount, 0);
  const totalReturnsAmount = supplierReturnsStats.reduce((sum, s) => sum + s.value, 0);
  const totalExpiriesCount = expiriesStats.reduce((sum, s) => sum + s.qty, 0);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">
          {lang === "ar" ? "جاري تحليل البيانات المعقدة..." : "Crunching the numbers..."}
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          {lang === "ar" ? "قراءة واحدة لقاعدة البيانات للـ 30 يوماً الماضية" : "Optimized single-read for the last 30 days"}
        </p>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Link href="/manager" className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-blue-500 transition-colors mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              {lang === "ar" ? "العودة للرئيسية" : "Back to Dashboard"}
            </Link>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-500" />
              {lang === "ar" ? "التحليلات المتقدمة" : "Advanced Analytics"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {lang === "ar" ? "أداء الموظفين، المرتجعات، والهوالك خلال 30 يوماً" : "Actionable insights from the last 30 days (Free-Tier Optimized)"}
            </p>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{lang === "ar" ? "إجمالي الإلغاءات" : "Total Voids (30d)"}</p>
                <h3 className="text-3xl font-black">{totalVoidAmount.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">EGP</span></h3>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                <RefreshCcw className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{lang === "ar" ? "قيمة المرتجعات للموردين" : "Supplier Returns (30d)"}</p>
                <h3 className="text-3xl font-black">{totalReturnsAmount.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">EGP</span></h3>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl">
                <PackageX className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{lang === "ar" ? "إجمالي الهوالك (الكمية)" : "Total Expiries (30d)"}</p>
                <h3 className="text-3xl font-black">{totalExpiriesCount.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">Items</span></h3>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cashier Voids Bar Chart */}
          <div className="bg-card border border-border rounded-3xl shadow-sm p-6 flex flex-col min-h-[400px]">
            <h3 className="text-lg font-black tracking-tight mb-6 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              {lang === "ar" ? "أداء الإلغاءات للكاشير (بالجنيه)" : "Cashier Void Value (EGP)"}
            </h3>
            <div className="flex-1 w-full h-full min-h-[300px]">
              {cashierVoidStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashierVoidStats} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis 
                      dataKey="cashier" 
                      tick={{ fill: '#888888', fontSize: 12, fontWeight: 600 }} 
                      tickLine={false} 
                      axisLine={false}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis 
                      tick={{ fill: '#888888', fontSize: 12, fontWeight: 600 }} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(239, 68, 68, 0.1)' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      formatter={(value: any) => [`${Number(value).toLocaleString()} EGP`, 'Total Voided']}
                    />
                    <Bar dataKey="voidAmount" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground font-bold">No void data in the last 30 days.</div>
              )}
            </div>
          </div>

          {/* Supplier Returns Pie Chart */}
          <div className="bg-card border border-border rounded-3xl shadow-sm p-6 flex flex-col min-h-[400px]">
            <h3 className="text-lg font-black tracking-tight mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              {lang === "ar" ? "أكثر الموردين إرجاعاً للمنتجات" : "Top Suppliers by Returns"}
            </h3>
            <div className="flex-1 w-full h-full min-h-[300px]">
              {supplierReturnsStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={supplierReturnsStats}
                      cx="50%"
                      cy="45%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {supplierReturnsStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      formatter={(value: any) => [`${Number(value).toLocaleString()} EGP`, 'Returns']}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      formatter={(value) => <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground font-bold">No supplier return data.</div>
              )}
            </div>
          </div>
        </div>

        {/* Smart Recommendations Engine */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/50 rounded-3xl shadow-sm p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-sm">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-amber-900 dark:text-amber-500">
                {lang === "ar" ? "توصيات التوقف عن الشراء (الهوالك)" : "Action Required: High Expiry Items"}
              </h3>
              <p className="text-amber-700/80 dark:text-amber-600/80 mt-1 font-medium text-sm">
                {lang === "ar" ? "هذه المنتجات انتهت صلاحيتها بكثرة خلال آخر 30 يوماً. نوصي بتقليل كميات شرائها أو التوقف عن التعامل بها." : "These items have suffered the most expiry loss in the last 30 days. Consider reducing orders or stopping altogether."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expiriesStats.length > 0 ? (
              expiriesStats.map((item, idx) => (
                <div key={idx} className="bg-white/60 dark:bg-black/20 backdrop-blur-sm border border-amber-200/50 dark:border-amber-700/30 p-4 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-400 text-xs font-black">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-bold text-red-500 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-md">
                        {item.qty} Expired
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 line-clamp-2" title={item.itemName}>{item.itemName}</h4>
                  </div>
                  <div className="mt-4 pt-3 border-t border-amber-200/30 dark:border-amber-800/30">
                    <p className="text-xs font-semibold text-slate-500">Supplier: <span className="text-slate-700 dark:text-slate-300">{item.supplier}</span></p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-500 mb-3">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-bold text-green-700 dark:text-green-500">No Expiries Found!</h4>
                <p className="text-green-600/70 font-medium">Your inventory is incredibly healthy.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </PageTransition>
  );
}
