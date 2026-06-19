"use client";

import React, { useState, useEffect } from "react";
import { dbService } from "@/lib/firebase";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, CreditCard, Wallet, Activity, Users, ShoppingCart } from "lucide-react";

export default function DashboardPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [safeLogs, setSafeLogs] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [creditPayments, setCreditPayments] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let unsubSales = () => {};
    let unsubCredits = () => {};
    let unsubSafe = () => {};
    let unsubCash = () => {};
    let unsubCreditPayments = () => {};
    let unsubPayroll = () => {};

    const loadData = async () => {
      setLoading(true);
      unsubSales = dbService.onSnapshot("sales", setSales);
      unsubCredits = dbService.onSnapshot("credits", setCredits);
      unsubSafe = dbService.onSnapshot("safe_balance", setSafeLogs);
      unsubCash = dbService.onSnapshot("cash_payments", setExpenses);
      unsubCreditPayments = dbService.onSnapshot("credit_payments", setCreditPayments);
      unsubPayroll = dbService.onSnapshot("payroll", setPayroll);
      setLoading(false);
    };

    loadData();

    return () => {
      unsubSales();
      unsubCredits();
      unsubSafe();
      unsubCash();
      unsubCreditPayments();
      unsubPayroll();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  // Calculate KPIs
  const totalSales = sales.reduce((acc, curr) => acc + (Number(curr.cash) || 0) + (Number(curr.visa) || 0) + (Number(curr.overShort) || 0), 0);
  const totalCredits = credits.reduce((acc, curr) => acc + (curr.total || 0), 0);
  
  const rawCashExpenses = expenses.reduce((acc, curr) => acc + (curr.total || curr.amount || 0), 0);
  const totalCreditPayments = creditPayments.reduce((acc, curr) => acc + (Number(curr.amount) || Number(curr.total) || 0), 0);
  const totalPaidPayroll = payroll.filter(p => p.status === 'paid').reduce((acc, curr) => acc + (Number(curr.netSalary) || 0), 0);
  const totalExpenses = rawCashExpenses + totalCreditPayments + totalPaidPayroll;
  
  // Safe Balance (assuming chronological, take the last one or sum based on logic, but for simple KPI we sum 'in' and subtract 'out', or just find latest balance)
  const lastSafeLog = safeLogs.length > 0 ? safeLogs[safeLogs.length - 1] : null;
  const safeBalance = lastSafeLog ? (Number(lastSafeLog.balance) || Number(lastSafeLog.amount) || Number(lastSafeLog.total) || 0) : 0;

  // Chart Data preparation
  const salesByDate = sales.reduce((acc, sale) => {
    const date = new Date(sale.date).toLocaleDateString();
    const dayTotal = (Number(sale.cash) || 0) + (Number(sale.visa) || 0) + (Number(sale.overShort) || 0);
    acc[date] = (acc[date] || 0) + dayTotal;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.keys(salesByDate).map(date => ({
    date,
    sales: salesByDate[date],
  }));

  const kpis = [
    { title: "Total Revenue", value: `EGP ${(Number(totalSales) || 0).toFixed(2)}`, icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
    { title: "Outstanding Credit", value: `EGP ${(Number(totalCredits) || 0).toFixed(2)}`, icon: CreditCard, color: "text-amber-500", bg: "bg-amber-500/10" },
    { title: "Cash Expenses", value: `EGP ${(Number(totalExpenses) || 0).toFixed(2)}`, icon: Activity, color: "text-red-500", bg: "bg-red-500/10" },
    { title: "Safe Balance", value: `EGP ${(Number(safeBalance) || 0).toFixed(2)}`, icon: Wallet, color: "text-blue-500", bg: "bg-blue-500/10" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time overview of your franchise financial health.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <div key={index} className="glass-panel p-6 rounded-xl border border-border flex items-center gap-4 hover:border-red-500/50 transition-colors">
              <div className={`p-4 rounded-full ${kpi.bg} ${kpi.color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">{kpi.title}</p>
                <h3 className="text-2xl font-bold mt-1 text-foreground">{kpi.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-xl border border-border">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-red-500" /> Revenue Trend
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#27272a" : "#e2e8f0"} vertical={false} />
                <XAxis dataKey="date" stroke={isDark ? "#a1a1aa" : "#64748b"} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={isDark ? "#a1a1aa" : "#64748b"} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `EGP ${value}`} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#18181b' : '#ffffff', 
                    border: isDark ? '1px solid #27272a' : '1px solid #e2e8f0', 
                    borderRadius: '8px',
                    color: isDark ? '#fafafa' : '#0f172a'
                  }}
                  itemStyle={{ color: '#ef4444' }}
                />
                <Line type="monotone" dataKey="sales" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-red-500" /> Sales vs Expenses
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: "Current Period", Sales: totalSales, Expenses: totalExpenses }]}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#27272a" : "#e2e8f0"} vertical={false} />
                <XAxis dataKey="name" stroke={isDark ? "#a1a1aa" : "#64748b"} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={isDark ? "#a1a1aa" : "#64748b"} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `EGP ${value}`} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#18181b' : '#ffffff', 
                    border: isDark ? '1px solid #27272a' : '1px solid #e2e8f0', 
                    borderRadius: '8px',
                    color: isDark ? '#fafafa' : '#0f172a'
                  }}
                  cursor={{ fill: 'transparent' }}
                />
                <Legend />
                <Bar dataKey="Sales" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={60} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
