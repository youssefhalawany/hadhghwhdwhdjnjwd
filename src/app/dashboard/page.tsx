"use client";

import React, { useState, useEffect } from "react";
import { useBranch } from "@/context/BranchContext";
import { fetchDashboardData } from "@/lib/dashboard-queries";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { 
  TrendingUp, TrendingDown, DollarSign, Wallet, ShieldAlert, Package, 
  Activity, AlertTriangle, ChevronRight, CheckCircle
} from "lucide-react";
import Link from "next/link";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";

export default function DashboardOverview() {
  const { currentBranch } = useBranch();
  const [data, setData] = useState<any>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const result = await fetchDashboardData(currentBranch);
        if (active) setData(result);
      } catch (e) {
        console.error("Dashboard fetch error", e);
      }
      if (active) setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [currentBranch]);

  useEffect(() => {
    // Listen to live activity feed
    let q = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(10));
    const unsubscribe = onSnapshot(q, (snap) => {
      let notifs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      if (currentBranch !== "all") {
        notifs = notifs.filter(n => {
          const sId = (n.storeId || n.branchId || "").toLowerCase();
          const inferred = sId.includes("ola") || sId.includes("koronfol") ? "ola" : "alamein4";
          return inferred === currentBranch;
        });
      }
      setFeed(notifs.slice(0, 5));
    });
    return () => unsubscribe();
  }, [currentBranch]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  const { kpis, chartData, needsAttention } = data || {};

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex justify-between items-end border-b border-border pb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <Activity className="h-8 w-8 text-red-600" />
              Overview
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Real-time snapshot of your franchise operations.
            </p>
          </div>
        </div>

        {/* The Pulse: KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Sales */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-6 rounded-2xl border border-border flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl">
                <DollarSign className="h-6 w-6 text-emerald-500" />
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Live
              </span>
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Today's Sales</p>
            <h3 className="text-3xl font-black text-foreground">{kpis?.totalSales?.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">EGP</span></h3>
          </motion.div>

          {/* Card 2: Shortage */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-6 rounded-2xl border border-border flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${Number(kpis?.totalShortage) < -100 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                <Wallet className={`h-6 w-6 ${Number(kpis?.totalShortage) < -100 ? 'text-red-500' : 'text-emerald-500'}`} />
              </div>
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Net Shortage</p>
            <h3 className={`text-3xl font-black ${Number(kpis?.totalShortage) < -100 ? 'text-red-500' : 'text-foreground'}`}>
              {kpis?.totalShortage?.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">EGP</span>
            </h3>
          </motion.div>

          {/* Card 3: Voids */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel p-6 rounded-2xl border border-border flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-amber-500/10 rounded-xl">
                <ShieldAlert className="h-6 w-6 text-amber-500" />
              </div>
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Voids Today</p>
            <h3 className="text-3xl font-black text-foreground">{kpis?.totalVoids?.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">EGP</span></h3>
          </motion.div>

          {/* Card 4: Expiries */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-panel p-6 rounded-2xl border border-border flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Package className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Expiring Tomorrow</p>
            <h3 className="text-3xl font-black text-foreground">{kpis?.expiringTomorrow} <span className="text-sm font-medium text-muted-foreground">Items</span></h3>
          </motion.div>
        </div>

        {/* Main Grid: Chart & Action Center */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* 7-Day Trend Chart */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="xl:col-span-2 glass-panel p-6 rounded-2xl border border-border">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" /> 7-Day Revenue Trend
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} tickMargin={10} />
                  <YAxis stroke="#888" fontSize={12} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="alamein4" name="El Alamein 4" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="ola" name="Ola Koronfol" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Action Center & Feed */}
          <div className="space-y-6 flex flex-col">
            
            {/* Needs Attention */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="glass-panel border border-red-500/30 rounded-2xl p-6 flex-grow">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-500">
                <AlertTriangle className="h-5 w-5" /> Needs Attention
              </h3>
              
              <div className="space-y-3">
                {needsAttention && needsAttention.length > 0 ? (
                  needsAttention.map((item: any, idx: number) => (
                    <Link href={item.link || '#'} key={idx} className="block p-4 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                      <p className="text-sm font-semibold text-red-400">{item.message}</p>
                    </Link>
                  ))
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center text-center h-32">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                    <p className="text-sm font-semibold text-emerald-500">All caught up! No active alerts.</p>
                  </div>
                )}
              </div>
            </motion.div>

          </div>
        </div>

        {/* Live Activity Feed */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="glass-panel border border-border rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" /> Live Activity Feed
          </h3>
          <div className="space-y-4">
            {feed && feed.length > 0 ? (
              feed.map((notif: any, idx: number) => (
                <div key={idx} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'} 
                      &nbsp;&bull;&nbsp; {notif.storeId}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
