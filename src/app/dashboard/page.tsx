"use client";

import React, { useState, useEffect, useRef } from "react";
import { dbService } from "@/lib/firebase";
import { TrendingUp, DollarSign, CreditCard, Wallet, Activity, Download, PackageOpen, LayoutDashboard, Calendar, AlertTriangle, AlertCircle, Clock, Bell, User, ArrowRight } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { motion } from "framer-motion";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from "chart.js";
import { Line, Bar, Doughnut, Pie } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

// Framer Motion Variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

export default function DashboardPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [safeLogs, setSafeLogs] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [creditPayments, setCreditPayments] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [expiries, setExpiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

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
    let unsubExpiries = () => {};

    const loadData = async () => {
      setLoading(true);
      unsubSales = dbService.onSnapshot("sales", setSales);
      unsubCredits = dbService.onSnapshot("credits", setCredits);
      unsubSafe = dbService.onSnapshot("safe_balance", setSafeLogs);
      unsubCash = dbService.onSnapshot("cash_payments", setExpenses);
      unsubCreditPayments = dbService.onSnapshot("credit_payments", setCreditPayments);
      unsubPayroll = dbService.onSnapshot("payroll", setPayroll);
      unsubExpiries = dbService.onSnapshot("expiries", setExpiries);
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
      unsubExpiries();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600 opacity-20"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-red-600 absolute top-0 left-0"></div>
        </div>
      </div>
    );
  }

  // Calculate KPIs
  const totalSales = sales.reduce((acc, curr) => acc + (Number(curr.cash) || 0) + (Number(curr.visa) || 0) + (Number(curr.overShort) || 0), 0);
  const totalCredits = credits.reduce((acc, curr) => acc + (curr.total || curr.amountDue || 0), 0);
  const rawCashExpenses = expenses.reduce((acc, curr) => acc + (curr.total || curr.amount || 0), 0);
  const totalCreditPayments = creditPayments.reduce((acc, curr) => acc + (Number(curr.amount) || Number(curr.total) || 0), 0);
  const totalPaidPayroll = payroll.filter(p => p.status === 'paid').reduce((acc, curr) => acc + (Number(curr.netSalary) || 0), 0);
  const totalExpenses = rawCashExpenses + totalCreditPayments + totalPaidPayroll;
  const lastSafeLog = safeLogs.length > 0 ? safeLogs[safeLogs.length - 1] : null;
  const safeBalance = lastSafeLog ? (Number(lastSafeLog.balance) || Number(lastSafeLog.amount) || Number(lastSafeLog.total) || 0) : 0;

  // Calculate Critical Exceptions for Top Row
  const today = new Date();
  today.setHours(0,0,0,0);

  const pendingDestructions = expiries.filter(e => e.status === "pulled" && !e.isDestroyed).length;

  const todaySales = sales.filter(s => {
    const d = new Date(s.date || s.createdAt);
    d.setHours(0,0,0,0);
    return d.getTime() === today.getTime();
  });
  
  const totalShortagesToday = todaySales.reduce((acc, sale) => {
    const os = Number(sale.overShort) || 0;
    return os < 0 ? acc + Math.abs(os) : acc;
  }, 0);

  const expiringTomorrow = expiries.filter(e => {
    if (e.status === "pulled") return false;
    const exp = new Date(e.expiryDate);
    exp.setHours(0,0,0,0);
    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays === 1;
  }).length;

  // Real-Time Store Pulse Feed
  const feedItems: any[] = [];
  expiries.forEach(e => {
    if (e.status === "pulled" && !e.isDestroyed) {
      feedItems.push({
        id: `exp-${e.id}`,
        type: 'expiry',
        timestamp: new Date(e.pulledAt || e.createdAt || new Date()).getTime(),
        title: `Expiry Warning`,
        message: `${e.quantity}x ${e.productName || e.itemName || e.item} pulled. Needs destruction review.`,
        color: 'text-orange-500',
        bg: 'bg-orange-500/10 border-orange-500/20',
        icon: PackageOpen
      });
    }
  });

  sales.forEach(s => {
    const os = Number(s.overShort) || 0;
    if (os < -20) {
      feedItems.push({
        id: `short-${s.id}`,
        type: 'shortage',
        timestamp: new Date(s.date || s.createdAt).getTime(),
        title: `High-Value Shortage`,
        message: `Shift closed with a shortage of EGP ${Math.abs(os).toLocaleString()}.`,
        color: 'text-red-500',
        bg: 'bg-red-500/10 border-red-500/20',
        icon: AlertCircle
      });
    }
  });

  feedItems.sort((a, b) => b.timestamp - a.timestamp);
  const recentFeed = feedItems.slice(0, 8);

  // Cashier Performance Sparklines
  const cashierData: Record<string, number[]> = {};
  sales.forEach(s => {
    const name = s.cashierName || s.userName || "Shift Terminal";
    if (!cashierData[name]) cashierData[name] = [];
    const os = Number(s.overShort) || 0;
    cashierData[name].push(os);
  });

  const cashierRows = Object.keys(cashierData).map(name => {
    const history = cashierData[name].slice(-7); // Last 7 shifts
    const totalShort = history.reduce((a,b) => a + (b < 0 ? b : 0), 0);
    const latest = history[history.length - 1] || 0;
    return { name, history, totalShort, latest };
  }).sort((a, b) => a.totalShort - b.totalShort); // sort by worst shortage

  const sparklineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } },
    elements: { point: { radius: 0, hitRadius: 0, hoverRadius: 0 } },
    animation: false as const
  };

  // Chart Data: Sales Trend
  const salesByDate = sales.reduce((acc, sale) => {
    const date = new Date(sale.date || sale.createdAt).toLocaleDateString('en-GB');
    const dayTotal = (Number(sale.cash) || 0) + (Number(sale.visa) || 0) + (Number(sale.overShort) || 0);
    acc[date] = (acc[date] || 0) + dayTotal;
    return acc;
  }, {} as Record<string, number>);

  const trendLabels = Object.keys(salesByDate).slice(-10);
  const trendData = trendLabels.map(d => salesByDate[d]);

  const salesTrendChartData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Daily Revenue (EGP)',
        data: trendData,
        borderColor: '#ef4444',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, isDark ? 'rgba(239, 68, 68, 0.5)' : 'rgba(239, 68, 68, 0.3)');
          gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#ef4444',
        pointBorderColor: isDark ? '#1e293b' : '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 3,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 2000,
      easing: 'easeOutQuart' as const
    },
    plugins: {
      legend: { labels: { color: isDark ? '#94a3b8' : '#475569', font: { family: 'inherit', weight: 'bold' as const } } },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#334155',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        cornerRadius: 8,
        titleFont: { size: 14, weight: 'bold' as const },
        bodyFont: { size: 13 }
      }
    },
    scales: {
      y: {
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', drawBorder: false },
        ticks: { color: isDark ? '#64748b' : '#94a3b8', font: { family: 'inherit' } },
        border: { display: false }
      },
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#64748b' : '#94a3b8', font: { family: 'inherit' } },
        border: { display: false }
      }
    }
  };

  // Chart Data: Sales Breakdown
  const totalCash = sales.reduce((acc, curr) => acc + (Number(curr.cash) || 0), 0);
  const totalVisa = sales.reduce((acc, curr) => acc + (Number(curr.visa) || 0), 0);
  const breakdownChartData = {
    labels: ['Cash Sales', 'Visa Sales'],
    datasets: [{
      data: [totalCash, totalVisa],
      backgroundColor: ['#10b981', '#3b82f6'],
      borderColor: isDark ? '#0f172a' : '#ffffff',
      borderWidth: 4,
      hoverOffset: 4
    }]
  };

  // Chart Data: Shift Variance
  let totalOver = 0;
  let totalShort = 0;
  sales.forEach(sale => {
    const os = Number(sale.overShort) || 0;
    if (os > 0) totalOver += os;
    if (os < 0) totalShort += Math.abs(os);
  });
  
  const varianceChartData = {
    labels: ['Shift Variance'],
    datasets: [
      {
        label: 'Total Over',
        data: [totalOver],
        backgroundColor: '#10b981',
        borderRadius: 6,
        barPercentage: 0.6,
      },
      {
        label: 'Total Short',
        data: [totalShort],
        backgroundColor: '#ef4444',
        borderRadius: 6,
        barPercentage: 0.6,
      }
    ]
  };

  // Chart Data: Expiry Statistics
  const activeExpiries = expiries.filter(e => e.status !== "pulled").length;
  const pulledExpiries = expiries.filter(e => e.status === "pulled").length;
  let expiredCount = 0;
  expiries.forEach(e => {
    if (e.status === "pulled") return;
    const exp = new Date(e.expiryDate);
    exp.setHours(0,0,0,0);
    const t = new Date();
    t.setHours(0,0,0,0);
    if (exp < t) expiredCount++;
  });
  
  const expiryChartData = {
    labels: ['Active', 'Pulled', 'Expired'],
    datasets: [{
      data: [Math.max(activeExpiries - expiredCount, 0), pulledExpiries, expiredCount],
      backgroundColor: ['#3b82f6', '#10b981', '#ef4444'],
      borderColor: isDark ? '#0f172a' : '#ffffff',
      borderWidth: 4,
      hoverOffset: 4
    }]
  };

  const getExpiryColor = (dateStr: string, status: string) => {
    if (status === "pulled") return "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-60";
    
    const expDate = new Date(dateStr);
    expDate.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return "animate-pulse bg-red-50 dark:bg-red-900/20 border-red-500/50 dark:border-red-500/50 text-red-700 dark:text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]";
    if (diffDays <= 2) return "bg-orange-50 dark:bg-orange-900/20 border-orange-400/50 dark:border-orange-500/50 text-orange-700 dark:text-orange-400";
    return "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400/50 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-400";
  };

  const kpis = [
    { title: "Total Revenue", value: `EGP ${(Number(totalSales) || 0).toLocaleString()}`, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { title: "Outstanding Credit", value: `EGP ${(Number(totalCredits) || 0).toLocaleString()}`, icon: CreditCard, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    { title: "Cash Expenses", value: `EGP ${(Number(totalExpenses) || 0).toLocaleString()}`, icon: Activity, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
    { title: "Safe Balance", value: `EGP ${(Number(safeBalance) || 0).toLocaleString()}`, icon: Wallet, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" }
  ];

  const generatePDF = async () => {
    setGeneratingPDF(true);
    try {
      const element = document.getElementById("dashboard-pdf-capture");
      if (!element) return;
      
      // Temporarily remove animations for PDF capture
      element.classList.add("print-mode");
      
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: isDark ? "#020617" : "#f8fafc",
        logging: false
      });
      
      element.classList.remove("print-mode");

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Financial_Report_${new Date().toLocaleDateString('en-GB')}.pdf`);
    } catch (error) {
      console.error("PDF Generate Error:", error);
      alert("Failed to generate PDF Report.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={containerVariants} 
      className="space-y-8 pb-10"
    >
      {/* Header Section */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 text-red-500 font-bold tracking-widest text-xs uppercase">
            <LayoutDashboard className="h-4 w-4" /> Operations Control Center
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Executive <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-red-400">Overview</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" /> {todayStr} — Real-time franchise analytics.
          </p>
        </div>
        <button
          onClick={generatePDF}
          disabled={generatingPDF}
          className="relative z-10 flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-2xl font-bold shadow-lg shadow-red-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 overflow-hidden group"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
          {generatingPDF ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent relative z-10" /> : <Download className="h-5 w-5 relative z-10" />}
          <span className="relative z-10">Generate Report</span>
        </button>
      </motion.div>

      <div id="dashboard-pdf-capture" className="space-y-8">
        
        {/* CRITICAL EXCEPTIONS ROW */}
        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Pending Destruction */}
          <motion.div variants={itemVariants} className="bg-red-50 dark:bg-red-900/20 p-5 rounded-[1.5rem] border border-red-200 dark:border-red-800 flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 ease-out"></div>
            <div className="p-3 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl relative z-10">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl font-black text-red-700 dark:text-red-400 leading-none">{pendingDestructions}</h2>
              <p className="text-xs font-bold text-red-600/80 dark:text-red-400/80 uppercase mt-1">Pending Destruction Reports</p>
            </div>
          </motion.div>

          {/* Cash Shortages */}
          <motion.div variants={itemVariants} className="bg-orange-50 dark:bg-orange-900/20 p-5 rounded-[1.5rem] border border-orange-200 dark:border-orange-800 flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 ease-out"></div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded-xl relative z-10">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl font-black text-orange-700 dark:text-orange-400 leading-none">EGP {totalShortagesToday.toLocaleString()}</h2>
              <p className="text-xs font-bold text-orange-600/80 dark:text-orange-400/80 uppercase mt-1">Total Cash Shortages Today</p>
            </div>
          </motion.div>

          {/* Expiring Tomorrow */}
          <motion.div variants={itemVariants} className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-[1.5rem] border border-amber-200 dark:border-amber-800 flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 ease-out"></div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-xl relative z-10">
              <Clock className="h-8 w-8" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl font-black text-amber-700 dark:text-amber-400 leading-none">{expiringTomorrow}</h2>
              <p className="text-xs font-bold text-amber-600/80 dark:text-amber-400/80 uppercase mt-1">Items Expiring Tomorrow</p>
            </div>
          </motion.div>
        </motion.div>

        {/* KPI Row */}
        <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {kpis.map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <motion.div 
                key={index} 
                variants={itemVariants}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none relative overflow-hidden group"
              >
                <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${kpi.bg} blur-2xl group-hover:scale-150 transition-transform duration-500 ease-out`}></div>
                <div className="relative z-10 flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${kpi.bg} ${kpi.color} ${kpi.border} border shadow-inner`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{kpi.title}</p>
                    <h3 className="text-2xl font-black mt-1 text-slate-800 dark:text-white leading-none">{kpi.value}</h3>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* Main Trend Chart */}
          <motion.div variants={itemVariants} className="lg:col-span-2 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-transparent"></div>
            <h3 className="text-xl font-black mb-6 flex items-center gap-2 text-slate-800 dark:text-white">
              <TrendingUp className="h-6 w-6 text-red-500" /> Revenue Timeline
            </h3>
            <div className="flex-1 min-h-[350px] w-full">
              <Line data={salesTrendChartData} options={chartOptions} />
            </div>
          </motion.div>

          {/* Side Charts Stack */}
          <div className="lg:col-span-1 flex flex-col gap-6 lg:gap-8">
            {/* Sales Breakdown */}
            <motion.div variants={itemVariants} className="flex-1 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col">
              <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
                <DollarSign className="h-5 w-5 text-emerald-500" /> Payment Distribution
              </h3>
              <div className="flex-1 min-h-[200px] w-full flex items-center justify-center">
                <Doughnut data={breakdownChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#94a3b8' : '#475569', padding: 20, font: { family: 'inherit', weight: 'bold' as const } } } }, cutout: '70%' }} />
              </div>
            </motion.div>

            {/* Expiry Tracking */}
            <motion.div variants={itemVariants} className="flex-1 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col">
              <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
                <PackageOpen className="h-5 w-5 text-blue-500" /> Inventory Health
              </h3>
              <div className="flex-1 min-h-[200px] w-full flex items-center justify-center">
                <Pie data={expiryChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: isDark ? '#94a3b8' : '#475569', padding: 15, font: { family: 'inherit', weight: 'bold' as const } } } } }} />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Pulse Feed & Cashier Sparklines Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* Real-Time Store Pulse Feed */}
          <motion.div variants={itemVariants} className="lg:col-span-1 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
            <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-slate-800 dark:text-white relative z-10">
              <Bell className="h-5 w-5 text-blue-500 animate-pulse" /> Live Store Pulse
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 relative z-10 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
              {recentFeed.length > 0 ? recentFeed.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.div 
                    key={item.id + idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`p-4 rounded-xl border ${item.bg} backdrop-blur-sm flex gap-3`}
                  >
                    <div className={`mt-0.5 ${item.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={`text-sm font-bold ${item.color}`}>{item.title}</h4>
                        <span className="text-[10px] font-bold opacity-60">
                          {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-xs mt-1 text-slate-700 dark:text-slate-300 font-medium">{item.message}</p>
                    </div>
                  </motion.div>
                );
              }) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 pb-10">
                  <Activity className="h-10 w-10 mb-2" />
                  <p className="text-sm font-bold">No active anomalies.</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Cashier Sparklines Table */}
          <motion.div variants={itemVariants} className="lg:col-span-2 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col relative overflow-hidden">
            <h3 className="text-xl font-black mb-6 flex items-center gap-2 text-slate-800 dark:text-white">
              <User className="h-6 w-6 text-purple-500" /> Cashier Performance & Anomalies
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <th className="pb-3 font-bold px-2">Cashier</th>
                    <th className="pb-3 font-bold px-2">7-Day Shortage Trend</th>
                    <th className="pb-3 font-bold px-2 text-right">Latest Shift</th>
                    <th className="pb-3 font-bold px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cashierRows.slice(0, 5).map((row, idx) => {
                    const sparkData = {
                      labels: row.history.map((_, i) => i),
                      datasets: [{
                        data: row.history,
                        borderColor: row.totalShort < -100 ? '#ef4444' : (row.totalShort < -20 ? '#f59e0b' : '#10b981'),
                        borderWidth: 2,
                        tension: 0.3
                      }]
                    };
                    const statusColor = row.totalShort < -100 ? 'text-red-500 bg-red-500/10 border-red-500/20' : (row.totalShort < -20 ? 'text-orange-500 bg-orange-500/10 border-orange-500/20' : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20');
                    const statusText = row.totalShort < -100 ? 'Critical' : (row.totalShort < -20 ? 'Warning' : 'Optimal');

                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="py-4 px-2 font-bold text-slate-800 dark:text-white">{row.name}</td>
                        <td className="py-4 px-2">
                          <div className="h-8 w-32">
                            <Line data={sparkData} options={sparklineOptions} />
                          </div>
                        </td>
                        <td className={`py-4 px-2 text-right font-bold ${row.latest < 0 ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                          {row.latest < 0 ? `EGP ${Math.abs(row.latest)} Short` : 'Balanced'}
                        </td>
                        <td className="py-4 px-2 text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wider border ${statusColor}`}>
                            {statusText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {cashierRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-400 font-medium">No cashier history available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* Smart Expiry Heatmap */}
        <motion.div variants={itemVariants} className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black flex items-center gap-2 text-slate-800 dark:text-white">
                <Activity className="h-6 w-6 text-orange-500" /> Actionable Expiries Radar
              </h3>
              <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-500 flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span> Live Sync
              </div>
            </div>
            
            <motion.div variants={containerVariants} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {expiries.filter(e => e.status !== "pulled").sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()).map(item => {
                const colorClass = getExpiryColor(item.expiryDate, item.status);
                return (
                  <motion.div 
                    key={item.id} 
                    variants={itemVariants}
                    whileHover={{ scale: 1.05, y: -2 }}
                    className={`p-4 rounded-2xl border flex flex-col justify-between ${colorClass} backdrop-blur-sm transition-shadow`}
                  >
                    <div>
                      <h4 className="font-bold text-sm leading-tight line-clamp-2">{item.productName || item.itemName || item.item}</h4>
                      <p className="text-[10px] opacity-70 mt-1 uppercase tracking-wider font-bold">{item.barcode || 'N/A'}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-current/10 flex justify-between items-end">
                      <div>
                        <span className="text-2xl font-black leading-none">{item.quantity}</span>
                        <span className="text-[10px] ml-0.5 opacity-80 font-bold uppercase">qty</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase font-bold opacity-70 tracking-widest">Expires</p>
                        <p className="text-xs font-bold">{new Date(item.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {expiries.filter(e => e.status !== "pulled").length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 border-dashed">
                  <PackageOpen className="h-10 w-10 text-emerald-500 mx-auto mb-3 opacity-80" />
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">Perfect Health! No active expiries tracked.</p>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}
