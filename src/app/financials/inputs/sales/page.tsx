"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getAggregateFromServer, sum } from "firebase/firestore";
import { Banknote, CreditCard, Trash2, Edit, AlertTriangle, X, Sun, Moon, CalendarDays, Loader2, FileText } from "lucide-react";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import { PageTransition } from "@/components/PageTransition";

export default function SalesManagementPage() {
  const { currentBranch } = useBranch();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"day" | "month" | "year">("month");
  const [filterValue, setFilterValue] = useState(new Date().toISOString().substring(0, 10));
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
          ) : sales.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border border-dashed">
              <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground font-medium">No sales recorded for this month.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sales.map((sale) => {
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
