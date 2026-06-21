"use client";

import React, { useState, useEffect, useRef } from "react";
import { dbService } from "@/lib/firebase";
import { TrendingUp, DollarSign, CreditCard, Wallet, Activity, Download, PackageOpen } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
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

  // Chart Data: Sales Trend
  const salesByDate = sales.reduce((acc, sale) => {
    const date = new Date(sale.date || sale.createdAt).toLocaleDateString('en-GB');
    const dayTotal = (Number(sale.cash) || 0) + (Number(sale.visa) || 0) + (Number(sale.overShort) || 0);
    acc[date] = (acc[date] || 0) + dayTotal;
    return acc;
  }, {} as Record<string, number>);

  const trendLabels = Object.keys(salesByDate).slice(-10); // Last 10 days
  const trendData = trendLabels.map(d => salesByDate[d]);

  const salesTrendChartData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Daily Revenue (EGP)',
        data: trendData,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#ef4444',
        borderWidth: 3,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: isDark ? '#a1a1aa' : '#475569' } },
      tooltip: {
        backgroundColor: isDark ? '#18181b' : '#ffffff',
        titleColor: isDark ? '#fafafa' : '#0f172a',
        bodyColor: isDark ? '#a1a1aa' : '#475569',
        borderColor: isDark ? '#27272a' : '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
      }
    },
    scales: {
      y: {
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        ticks: { color: isDark ? '#a1a1aa' : '#64748b' }
      },
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#a1a1aa' : '#64748b' }
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
      backgroundColor: ['#22c55e', '#3b82f6'],
      borderColor: isDark ? '#09090b' : '#ffffff',
      borderWidth: 2,
    }]
  };

  // Chart Data: Shift Variance (Over vs Short)
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
        backgroundColor: '#22c55e',
        borderRadius: 4,
      },
      {
        label: 'Total Short',
        data: [totalShort],
        backgroundColor: '#ef4444',
        borderRadius: 4,
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
      backgroundColor: ['#3b82f6', '#22c55e', '#ef4444'],
      borderColor: isDark ? '#09090b' : '#ffffff',
      borderWidth: 2,
    }]
  };

  // Smart Expiry Heatmap Helper
  const getExpiryColor = (dateStr: string, status: string) => {
    if (status === "pulled") return "bg-gray-500/10 border-gray-500 text-gray-500 opacity-50";
    
    const expDate = new Date(dateStr);
    expDate.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return "animate-pulse bg-red-500/20 border-red-500 text-red-600 dark:text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
    if (diffDays <= 2) return "bg-orange-500/20 border-orange-500 text-orange-600 dark:text-orange-400";
    return "bg-green-500/10 border-green-500 text-green-600 dark:text-green-400";
  };

  const kpis = [
    { title: "Total Revenue", value: `EGP ${(Number(totalSales) || 0).toLocaleString()}`, icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
    { title: "Outstanding Credit", value: `EGP ${(Number(totalCredits) || 0).toLocaleString()}`, icon: CreditCard, color: "text-amber-500", bg: "bg-amber-500/10" },
    { title: "Cash Expenses", value: `EGP ${(Number(totalExpenses) || 0).toLocaleString()}`, icon: Activity, color: "text-red-500", bg: "bg-red-500/10" },
    { title: "Safe Balance", value: `EGP ${(Number(safeBalance) || 0).toLocaleString()}`, icon: Wallet, color: "text-blue-500", bg: "bg-blue-500/10" }
  ];

  const generatePDF = async () => {
    setGeneratingPDF(true);
    try {
      const element = document.getElementById("dashboard-pdf-capture");
      if (!element) return;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: isDark ? "#09090b" : "#ffffff" });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-foreground tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-red-400">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-2">Real-time overview of your franchise financial health & analytics.</p>
        </div>
        <button
          onClick={generatePDF}
          disabled={generatingPDF}
          className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 transition-all hover:-translate-y-1 disabled:opacity-50"
        >
          {generatingPDF ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Download className="h-5 w-5" />}
          Download PDF Report
        </button>
      </div>

      <div id="dashboard-pdf-capture" className="space-y-6 pt-2">
        {/* BENTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-max">
          
          {/* Main Trend Chart - Spans 3 columns */}
          <div className="lg:col-span-3 lg:row-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <h3 className="text-xl font-black mb-6 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-500" /> Revenue Trend (Last 10 Days)
            </h3>
            <div className="flex-1 min-h-[350px] w-full">
              <Line data={salesTrendChartData} options={chartOptions} />
            </div>
          </div>

          {/* 4 KPIs stacked in the 4th column */}
          <div className="lg:col-span-1 lg:row-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-6">
            {kpis.map((kpi, index) => {
              const Icon = kpi.icon;
              return (
                <div key={index} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center gap-4 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xl transition-all transform hover:-translate-y-1">
                  <div className={`p-4 rounded-2xl ${kpi.bg} ${kpi.color} shadow-inner`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{kpi.title}</p>
                    <h3 className="text-xl font-black mt-0.5 text-slate-800 dark:text-white leading-none">{kpi.value}</h3>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sales Breakdown */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <h3 className="text-xl font-black mb-4 flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-green-500" /> Sales Breakdown
            </h3>
            <div className="h-[250px] w-full flex items-center justify-center">
              <Doughnut data={breakdownChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#a1a1aa' : '#475569', padding: 20 } } } }} />
            </div>
          </div>

          {/* Shift Variance */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <h3 className="text-xl font-black mb-4 flex items-center gap-2">
              <Activity className="h-6 w-6 text-blue-500" /> Variance
            </h3>
            <div className="h-[250px] w-full">
              <Bar data={varianceChartData} options={{ ...chartOptions, scales: { y: { beginAtZero: true, grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }, ticks: { color: isDark ? '#a1a1aa' : '#64748b' } }, x: { grid: { display: false }, ticks: { color: isDark ? '#a1a1aa' : '#64748b' } } } }} />
            </div>
          </div>

          {/* Expiry Tracking */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <h3 className="text-xl font-black mb-4 flex items-center gap-2">
              <PackageOpen className="h-6 w-6 text-orange-500" /> Expiry Track Records
            </h3>
            <div className="h-[250px] w-full flex items-center justify-center">
              <Pie data={expiryChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: isDark ? '#a1a1aa' : '#475569', padding: 20 } } } }} />
            </div>
          </div>
        </div>

        {/* Smart Expiry Heatmap */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-xl font-black mb-6 flex items-center gap-2">
            <PackageOpen className="h-6 w-6 text-orange-500" /> Smart Expiry Heatmap
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {expiries.filter(e => e.status !== "pulled").sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()).map(item => {
              const colorClass = getExpiryColor(item.expiryDate, item.status);
              return (
                <div key={item.id} className={`p-4 rounded-xl border-2 flex flex-col justify-between ${colorClass} transition-all`}>
                  <div>
                    <h4 className="font-bold text-lg truncate">{item.productName || item.item}</h4>
                    <p className="text-xs opacity-80 mt-1 uppercase tracking-wider">{item.category || 'Item'}</p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-current/20 flex justify-between items-end">
                    <div>
                      <span className="text-2xl font-black">{item.quantity}</span>
                      <span className="text-xs ml-1 opacity-80">qty</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold opacity-80">Expires</p>
                      <p className="text-sm font-bold">{new Date(item.expiryDate).toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {expiries.filter(e => e.status !== "pulled").length === 0 && (
              <div className="col-span-full py-8 text-center text-muted-foreground">
                No active expiries tracked.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
