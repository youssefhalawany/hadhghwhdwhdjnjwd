"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getAggregateFromServer, sum } from "firebase/firestore";
import { Banknote, CreditCard, Trash2, Edit, AlertTriangle, X, Sun, Moon, CalendarDays, Loader2, FileText, TrendingUp, Target, Activity } from "lucide-react";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import { PageTransition } from "@/components/PageTransition";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, Cell } from "recharts";

export default function SalesManagementPage() {
  const { currentBranch } = useBranch();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"day" | "month" | "year">("month");
  const [filterValue, setFilterValue] = useState(new Date().toISOString().substring(0, 10));
  const [viewMode, setViewMode] = useState<"detailed" | "grouped">("detailed");
  const [allTimeStats, setAllTimeStats] = useState({ cash: 0, visa: 0, overShort: 0 });

  useEffect(() => {
    async function fetchAllTime() {
      try {
        // Using getAggregateFromServer costs only 1 read per 1000 index entries, vastly reducing reads.
        const q = collection(db, "sales");
        const snapshot = await getAggregateFromServer(q, {
          cash: sum("cash"),
          visa: sum("visa"),
          overShort: sum("overShort")
        });
        setAllTimeStats({
          cash: snapshot.data().cash || 0,
          visa: snapshot.data().visa || 0,
          overShort: snapshot.data().overShort || 0
        });
      } catch (err) {
        console.error("Failed to fetch aggregate:", err);
      }
    }
    fetchAllTime();
  }, []);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editData, setEditData] = useState({
    cashierName: "",
    shift: "morning",
    date: "",
    cash: "",
    visa: "",
    overShort: "",
    notes: ""
  });

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<any>(null);

  useEffect(() => {
    if (!filterValue) return;
    setLoading(true);

    let q = collection(db, "sales") as any;

    if (filterType === "day" && filterValue) {
      q = query(q, where("date", "==", filterValue));
    } else if (filterType === "month" && filterValue) {
      const monthPrefix = filterValue.substring(0, 7);
      const startOfMonth = monthPrefix + "-01";
      const endOfMonth = monthPrefix + "-31";
      q = query(q, where("date", ">=", startOfMonth), where("date", "<=", endOfMonth));
    } else if (filterType === "year" && filterValue) {
      const year = filterValue.substring(0, 4);
      const startOfYear = year + "-01-01";
      const endOfYear = year + "-12-31";
      q = query(q, where("date", ">=", startOfYear), where("date", "<=", endOfYear));
    }

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      let data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as any[];
      
      // Client-side filtering for branch to avoid complex compound indexes if not available
      if (currentBranch && currentBranch !== "all") {
        data = data.filter(item => {
          const bId = item.branchId || item.storeId?.toLowerCase() || "";
          
          let itemBranch = "alamein4"; // Default fallback like in other files
          if (bId.includes("ola") || bId.includes("koronfol")) itemBranch = "ola";

          return itemBranch === currentBranch;
        });
      }
      
      data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setSales(data);
      setLoading(false);
    }, (err: any) => {
      console.error(err);
      toast.error("Failed to load sales data.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filterType, filterValue, currentBranch]);

  const nightSales = sales.filter(s => s.shift?.toLowerCase() === "night");
  const morningSales = sales.filter(s => s.shift?.toLowerCase() === "morning");

  const calcTotals = (list: any[]) => {
    return list.reduce((acc, curr) => {
      acc.cash += Number(curr.cash) || 0;
      acc.visa += Number(curr.visa) || 0;
      acc.overShort += Number(curr.overShort) || 0;
      return acc;
    }, { cash: 0, visa: 0, overShort: 0 });
  };

  const nightTotals = calcTotals(nightSales);
  const morningTotals = calcTotals(morningSales);

  // --- NEW: Data Processing for Insights ---
  const { trendData, radarData, heatmapData, shiftBattle, averageDailySales } = useMemo(() => {
    if (!sales || sales.length === 0) return { trendData: [], radarData: [], heatmapData: [], shiftBattle: { morning: 50, night: 50, totalMorning: 0, totalNight: 0 }, averageDailySales: 0 };

    // 1. Trend Data (Cash vs Visa per day) & Heatmap Data (Total per day)
    const dailyMap = new Map<string, { cash: number, visa: number, total: number, morning: number, night: number }>();
    let totalAllSales = 0;
    let totalMorning = 0;
    let totalNight = 0;

    sales.forEach(s => {
      const sDate = typeof s.date === 'string' && s.date.length >= 10 ? s.date.substring(0, 10) : "Unknown";
      if (!dailyMap.has(sDate)) {
        dailyMap.set(sDate, { cash: 0, visa: 0, total: 0, morning: 0, night: 0 });
      }
      const dayData = dailyMap.get(sDate)!;
      const sCash = Number(s.cash) || 0;
      const sVisa = Number(s.visa) || 0;
      const sTotal = sCash + sVisa;
      
      dayData.cash += sCash;
      dayData.visa += sVisa;
      dayData.total += sTotal;
      totalAllSales += sTotal;
      if (s.shift?.toLowerCase() === 'morning') {
        dayData.morning += sTotal;
        totalMorning += sTotal;
      }
      if (s.shift?.toLowerCase() === 'night') {
        dayData.night += sTotal;
        totalNight += sTotal;
      }
    });

    const sortedDates = Array.from(dailyMap.keys()).sort();
    const averageDailySales = sortedDates.length > 0 ? totalAllSales / sortedDates.length : 0;

    const trendData = sortedDates.map(date => {
      const d = dailyMap.get(date)!;
      return {
        date: date.length >= 10 ? date.substring(8, 10) + "/" + date.substring(5, 7) : date, // DD/MM format
        fullDate: date,
        cash: d.cash,
        visa: d.visa,
        total: d.total
      };
    });

    const heatmapData = sortedDates.map(date => {
      const d = dailyMap.get(date)!;
      return {
        date: date.length >= 10 ? date.substring(8, 10) + "/" + date.substring(5, 7) : date,
        total: d.total,
        morning: d.morning,
        night: d.night,
        isAboveAverage: d.total >= averageDailySales
      };
    });

    // 2. Busiest Day Radar Data
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayTotals = new Array(7).fill(0);
    
    sales.forEach(s => {
      const dateObj = new Date(s.date);
      if (!isNaN(dateObj.getTime())) {
        dayTotals[dateObj.getDay()] += (Number(s.cash) || 0) + (Number(s.visa) || 0);
      }
    });

    const radarData = daysOfWeek.map((day, index) => ({
      subject: day,
      A: dayTotals[index],
      fullMark: Math.max(...dayTotals) || 100
    }));

    const totalCombined = totalMorning + totalNight;
    
    const morningPercent = totalCombined > 0 ? Math.round((totalMorning / totalCombined) * 100) : 50;
    const nightPercent = totalCombined > 0 ? Math.round((totalNight / totalCombined) * 100) : 50;

    return {
      trendData,
      radarData,
      heatmapData,
      averageDailySales,
      shiftBattle: { morning: morningPercent, night: nightPercent, totalMorning, totalNight }
    };
  }, [sales]);

  const groupedSales = useMemo(() => {
    const groups: Record<string, any> = {};
    sales.forEach(s => {
      const d = s.date || "Unknown Date";
      if (!groups[d]) {
        groups[d] = {
          id: `group-${d}`,
          date: d,
          cash: 0,
          visa: 0,
          overShort: 0,
          isGrouped: true,
          count: 0
        };
      }
      groups[d].cash += (Number(s.cash) || 0);
      groups[d].visa += (Number(s.visa) || 0);
      groups[d].overShort += (Number(s.overShort) || 0);
      groups[d].count += 1;
    });
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [sales]);

  const displayedSales = viewMode === "grouped" ? groupedSales : sales;

  const formatMoney = (val: number) => {
    return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const openEditModal = (sale: any) => {
    setSelectedSale(sale);
    setEditData({
      cashierName: sale.cashierName || "",
      shift: sale.shift || "morning",
      date: sale.date || "",
      cash: sale.cash?.toString() || "0",
      visa: sale.visa?.toString() || "0",
      overShort: sale.overShort?.toString() || "0",
      notes: sale.notes || ""
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "sales", selectedSale.id), {
        cashierName: editData.cashierName,
        shift: editData.shift,
        date: editData.date,
        cash: Number(editData.cash) || 0,
        visa: Number(editData.visa) || 0,
        overShort: Number(editData.overShort) || 0,
        notes: editData.notes,
      });
      toast.success("Sales record updated successfully!");
      setEditModalOpen(false);
    } catch (err: any) {
      toast.error("Failed to update record: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!saleToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "sales", saleToDelete.id));
      toast.success("Sales record deleted.");
      setDeleteModalOpen(false);
      setSaleToDelete(null);
    } catch (err: any) {
      toast.error("Failed to delete record: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const duplicateIds = new Set<string>();
  const salesMap = new Map<string, string[]>();

  sales.forEach((s) => {
    // Basic fields that define a duplicate
    const key = `${s.date}_${s.shift?.toLowerCase()}_${s.cashierName}_${s.cash}_${s.visa}_${s.overShort}`;
    if (!salesMap.has(key)) {
      salesMap.set(key, []);
    }
    salesMap.get(key)!.push(s.id);
  });

  salesMap.forEach((ids) => {
    if (ids.length > 1) {
      ids.forEach(id => duplicateIds.add(id));
    }
  });

  return (
    <PageTransition>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 pb-32">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center bg-card p-4 rounded-2xl border border-border shadow-sm">
          <div className="flex-1 w-full flex flex-col sm:flex-row gap-3">
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full sm:w-auto p-3 bg-muted border border-border rounded-xl font-bold text-lg text-foreground focus:ring-2 focus:ring-slate-500 outline-none"
            >
              <option value="day">Daily</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>

            {filterType === "day" && (
              <input 
                type="date" 
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-full sm:w-auto p-3 bg-muted border border-border rounded-xl font-bold text-lg text-foreground focus:ring-2 focus:ring-slate-500 outline-none"
              />
            )}

            {filterType === "month" && (
              <input 
                type="month" 
                value={filterValue.substring(0, 7)}
                onChange={(e) => setFilterValue(e.target.value + "-01")}
                className="w-full sm:w-auto p-3 bg-muted border border-border rounded-xl font-bold text-lg text-foreground focus:ring-2 focus:ring-slate-500 outline-none"
              />
            )}

            {filterType === "year" && (
              <input 
                type="number" 
                min="2020" max="2100"
                value={filterValue.substring(0, 4)}
                onChange={(e) => setFilterValue(e.target.value + "-01-01")}
                className="w-full sm:w-auto p-3 bg-muted border border-border rounded-xl font-bold text-lg text-foreground focus:ring-2 focus:ring-slate-500 outline-none"
              />
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none px-4 py-2 border border-border rounded-lg text-sm font-bold hover:bg-muted text-foreground flex items-center justify-center gap-2">
              Export Sales
            </button>
            <button className="flex-1 sm:flex-none px-4 py-2 border border-border rounded-lg text-sm font-bold hover:bg-muted text-foreground flex items-center justify-center gap-2">
              Export All
            </button>
          </div>
        </div>

        {/* Grand Total Bar */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-800/50 rounded-xl">
              <Banknote className="text-emerald-600 dark:text-emerald-400 h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-emerald-800/70 dark:text-emerald-200/70 uppercase tracking-widest">SELECTED PERIOD TOTAL</h2>
              <p className="text-2xl font-black text-emerald-900 dark:text-emerald-50">
                EGP {formatMoney((nightTotals.cash + nightTotals.visa + nightTotals.overShort) + (morningTotals.cash + morningTotals.visa + morningTotals.overShort))}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 md:gap-8 text-sm font-bold text-emerald-800 dark:text-emerald-200">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest opacity-70">Total Cash</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-black text-lg">EGP {formatMoney(nightTotals.cash + morningTotals.cash)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest opacity-70">Total Visa</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-black text-lg">EGP {formatMoney(nightTotals.visa + morningTotals.visa)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest opacity-70">Total O/S</span>
              <span className={`${(nightTotals.overShort + morningTotals.overShort) < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'} font-black text-lg`}>
                EGP {formatMoney(nightTotals.overShort + morningTotals.overShort)}
              </span>
            </div>
          </div>
        </div>

        {/* All-Time Stats Box */}
        <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner flex justify-between items-center gap-4">
          <div>
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Lifetime Company Sales</h3>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">EGP {formatMoney(allTimeStats.cash + allTimeStats.visa + allTimeStats.overShort)}</p>
          </div>
          <div className="flex gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <div>Cash: <span className="text-slate-700 dark:text-slate-300">EGP {formatMoney(allTimeStats.cash)}</span></div>
            <div>Visa: <span className="text-slate-700 dark:text-slate-300">EGP {formatMoney(allTimeStats.visa)}</span></div>
          </div>
        </div>

        {/* --- SALES INSIGHTS DASHBOARD --- */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Activity className="text-indigo-500" size={24} />
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Sales Insights</h2>
          </div>

          {/* Shift Battle (Tug of War) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Sun size={16} className="text-amber-500"/> Morning Shift</h3>
                <p className="text-2xl font-black text-amber-600">{shiftBattle.morning}%</p>
              </div>
              <div className="text-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">Shift Battle</span>
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 justify-end">Night Shift <Moon size={16} className="text-blue-500"/></h3>
                <p className="text-2xl font-black text-blue-600">{shiftBattle.night}%</p>
              </div>
            </div>
            <div className="h-6 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex relative border border-slate-200 dark:border-slate-700 shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${shiftBattle.morning}%` }}
                transition={{ duration: 1, type: "spring" }}
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 relative"
              >
                {shiftBattle.morning > 0 && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/80">EGP {formatMoney(shiftBattle.totalMorning)}</span>}
              </motion.div>
              <div className="w-1 h-full bg-white z-10 skew-x-12"></div>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${shiftBattle.night}%` }}
                transition={{ duration: 1, type: "spring" }}
                className="h-full bg-gradient-to-l from-blue-600 to-blue-500 relative"
              >
                 {shiftBattle.night > 0 && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/80">EGP {formatMoney(shiftBattle.totalNight)}</span>}
              </motion.div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Cash vs Visa Trendline */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm h-80 flex flex-col">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-500" /> Cash vs. Visa Trend
              </h3>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorVisa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} tickFormatter={(value) => `EGP ${value/1000}k`} />
                    <RechartsTooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                      formatter={(value: any) => [`EGP ${Number(value).toLocaleString()}`, undefined]}
                    />
                    <Area type="monotone" dataKey="cash" name="Cash" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCash)" />
                    <Area type="monotone" dataKey="visa" name="Visa" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVisa)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Busiest Day Radar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm h-80 flex flex-col">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Target size={16} className="text-violet-500" /> Busiest Day Radar
              </h3>
              <div className="flex-1 w-full min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{fill: '#64748b', fontSize: 11, fontWeight: 'bold'}} />
                    <PolarRadiusAxis angle={90} domain={[0, 'auto']} tick={false} axisLine={false} />
                    <Radar name="Total Sales" dataKey="A" stroke="#8b5cf6" strokeWidth={2} fill="#8b5cf6" fillOpacity={0.5} />
                    <RechartsTooltip 
                      formatter={(value: any) => [`EGP ${Number(value).toLocaleString()}`, "Sales"]}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Sales Heatmap (Bar Chart) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm h-80 flex flex-col lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <CalendarDays size={16} className="text-rose-500" /> Daily Sales Heatmap
                </h3>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                  Daily Average: EGP {formatMoney(averageDailySales)}
                </span>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={heatmapData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} tickFormatter={(value) => `EGP ${value/1000}k`} />
                    <RechartsTooltip 
                      cursor={{fill: 'rgba(0,0,0,0.05)'}}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                      formatter={(value: any, name: any) => [`EGP ${Number(value).toLocaleString()}`, name === 'total' ? 'Total' : String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
                      labelStyle={{ color: '#1e293b' }}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {heatmapData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.isAboveAverage ? '#10b981' : '#cbd5e1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Moon size={100} />
            </div>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2">
                <Moon className="text-blue-500 fill-current h-6 w-6" />
                <h2 className="text-xl font-black text-blue-900 dark:text-blue-100 tracking-tight">NIGHT</h2>
              </div>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-3 py-1 rounded-full">
                {nightSales.length} entries
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-xs font-bold text-blue-600/70 dark:text-blue-400/70 mb-1">Cash</p>
                <p className="text-sm font-bold text-green-600 dark:text-green-400">EGP {formatMoney(nightTotals.cash)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-blue-600/70 dark:text-blue-400/70 mb-1">Visa</p>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">EGP {formatMoney(nightTotals.visa)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-blue-600/70 dark:text-blue-400/70 mb-1">O/S</p>
                <p className={`text-sm font-bold ${nightTotals.overShort < 0 ? "text-red-500" : "text-green-500"}`}>
                  EGP {formatMoney(nightTotals.overShort)}
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-blue-200/50 dark:border-blue-800/50">
              <p className="text-lg font-black text-blue-950 dark:text-blue-50">
                Total: EGP {formatMoney(nightTotals.cash + nightTotals.visa + nightTotals.overShort)}
              </p>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-100 dark:border-amber-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sun size={100} />
            </div>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2">
                <Sun className="text-amber-500 fill-current h-6 w-6" />
                <h2 className="text-xl font-black text-amber-900 dark:text-amber-100 tracking-tight">MORNING</h2>
              </div>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-3 py-1 rounded-full">
                {morningSales.length} entries
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-xs font-bold text-amber-600/70 dark:text-amber-400/70 mb-1">Cash</p>
                <p className="text-sm font-bold text-green-600 dark:text-green-400">EGP {formatMoney(morningTotals.cash)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-amber-600/70 dark:text-amber-400/70 mb-1">Visa</p>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">EGP {formatMoney(morningTotals.visa)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-amber-600/70 dark:text-amber-400/70 mb-1">O/S</p>
                <p className={`text-sm font-bold ${morningTotals.overShort < 0 ? "text-red-500" : "text-green-500"}`}>
                  EGP {formatMoney(morningTotals.overShort)}
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-amber-200/50 dark:border-amber-800/50">
              <p className="text-lg font-black text-amber-950 dark:text-amber-50">
                Total: EGP {formatMoney(morningTotals.cash + morningTotals.visa + morningTotals.overShort)}
              </p>
            </div>
          </div>
        </div>

        {/* All Records Section */}
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">ALL RECORDS</h3>
          
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl border border-border"></div>
              ))}
            </div>
          ) : displayedSales.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border border-dashed">
              <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground font-medium">No sales recorded for this month.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2 mb-6">
                <button 
                  onClick={() => setViewMode("detailed")}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-colors ${viewMode === "detailed" ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  Detailed View
                </button>
                <button 
                  onClick={() => setViewMode("grouped")}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-colors ${viewMode === "grouped" ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  Grouped by Day
                </button>
              </div>

              {displayedSales.map((sale) => {
                if (sale.isGrouped) {
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={sale.id} 
                      className="bg-card rounded-2xl border border-emerald-500/30 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-5">
                        <CalendarDays size={80} className="text-emerald-500" />
                      </div>
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                            <CalendarDays className="text-emerald-600 dark:text-emerald-400 h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-black text-foreground tracking-tight uppercase text-emerald-600 dark:text-emerald-400">
                              DAILY TOTAL
                            </h4>
                            <p className="text-xs text-muted-foreground font-medium mt-0.5 flex items-center gap-1">
                              <FileText size={12} /> {sale.count} Transactions • {sale.date}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/50 p-4 rounded-xl relative z-10 border border-emerald-500/10">
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">TOTAL (CASH + VISA)</p>
                          <p className="text-xl font-black text-foreground">
                            EGP {formatMoney((Number(sale.cash) || 0) + (Number(sale.visa) || 0))}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">CASH</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            EGP {formatMoney(Number(sale.cash) || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">VISA</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            EGP {formatMoney(Number(sale.visa) || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">OVER/SHORT</p>
                          <p className={`text-lg font-bold ${(Number(sale.overShort) || 0) < 0 ? "text-red-500" : "text-green-500"}`}>
                            EGP {formatMoney(Number(sale.overShort) || 0)}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                const isDuplicate = duplicateIds.has(sale.id);
                return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={sale.id} 
                  className={`bg-card rounded-2xl border ${isDuplicate ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' : 'border-border'} p-5 shadow-sm hover:shadow-md transition-shadow relative`}
                >
                  {isDuplicate && (
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      Duplicate Detected
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      {sale.shift?.toLowerCase() === "night" ? (
                        <Moon className="text-blue-500 fill-current h-5 w-5" />
                      ) : (
                        <Sun className="text-amber-500 fill-current h-5 w-5" />
                      )}
                      <div>
                        <h4 className="font-bold text-foreground tracking-tight uppercase">
                          {sale.shift?.toUpperCase() || "UNKNOWN"} Shift
                        </h4>
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">
                          {sale.cashierName || "Unknown Cashier"} • {sale.date}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => openEditModal(sale)}
                        className="p-2 border border-border rounded-full text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Edit Record"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => { setSaleToDelete(sale); setDeleteModalOpen(true); }}
                        className="p-2 border border-red-200 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">CASH</p>
                      <p className="font-bold text-green-600 dark:text-green-400">EGP {formatMoney(Number(sale.cash) || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">VISA</p>
                      <p className="font-bold text-blue-600 dark:text-blue-400">EGP {formatMoney(Number(sale.visa) || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">OVER/SHORT</p>
                      <p className={`font-bold ${Number(sale.overShort) < 0 ? "text-red-500" : "text-green-500"}`}>
                        EGP {formatMoney(Number(sale.overShort) || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">TOTAL</p>
                      <p className="font-bold text-foreground">
                        EGP {formatMoney((Number(sale.cash) || 0) + (Number(sale.visa) || 0) + (Number(sale.overShort) || 0))}
                      </p>
                    </div>
                  </div>

                  {sale.notes && sale.notes.trim() !== "" && (
                    <div className="mt-4 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800/30">
                      <p className="text-[10px] font-bold text-blue-600/70 dark:text-blue-400/70 uppercase tracking-wider mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> AUDIT NOTES</p>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 whitespace-pre-wrap">{sale.notes}</p>
                    </div>
                  )}
                </motion.div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="text-xl font-bold tracking-tight">Edit Sales Record</h2>
              <button onClick={() => setEditModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Cashier Name</label>
                  <input type="text" value={editData.cashierName} onChange={(e) => setEditData({...editData, cashierName: e.target.value})} className="w-full p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-slate-500 outline-none" required />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Date</label>
                  <input type="date" value={editData.date} onChange={(e) => setEditData({...editData, date: e.target.value})} className="w-full p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-slate-500 outline-none" required />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Shift</label>
                  <select value={editData.shift} onChange={(e) => setEditData({...editData, shift: e.target.value})} className="w-full p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-slate-500 outline-none" required>
                    <option value="morning">Morning</option>
                    <option value="night">Night</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Cash (EGP)</label>
                  <input type="number" step="0.01" value={editData.cash} onChange={(e) => setEditData({...editData, cash: e.target.value})} className="w-full p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-slate-500 outline-none" required />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Visa (EGP)</label>
                  <input type="number" step="0.01" value={editData.visa} onChange={(e) => setEditData({...editData, visa: e.target.value})} className="w-full p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-slate-500 outline-none" required />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Over/Short (EGP)</label>
                  <input type="number" step="0.01" value={editData.overShort} onChange={(e) => setEditData({...editData, overShort: e.target.value})} className="w-full p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-slate-500 outline-none" required />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Notes</label>
                  <textarea value={editData.notes} onChange={(e) => setEditData({...editData, notes: e.target.value})} className="w-full p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-slate-500 outline-none min-h-[80px]" />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-border">
                <button type="button" onClick={() => setEditModalOpen(false)} className="px-5 py-2.5 border border-border text-foreground rounded-lg font-bold hover:bg-muted">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-black rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-red-200 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-foreground">Delete Record?</h3>
              <p className="text-muted-foreground text-sm mb-6">Are you sure you want to completely delete this sales record? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteModalOpen(false)} className="flex-1 px-4 py-2.5 bg-muted text-foreground rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-800">Cancel</button>
                <button onClick={handleDelete} disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 flex justify-center items-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </PageTransition>
  );
}
