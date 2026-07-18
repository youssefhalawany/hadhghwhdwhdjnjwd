"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { useLanguage } from "@/context/LanguageContext";
import { 
  PackageMinus, Hash, Search, Filter, Calendar as CalendarIcon, 
  MapPin, User as UserIcon, CheckCircle2, Clock
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function OutOfStockManagerPage() {
  const { language: lang } = useLanguage();
  const isRTL = lang === "ar";

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterResolved, setFilterResolved] = useState<"all" | "pending" | "resolved">("all");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "out_of_stock_logs"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  const toggleResolved = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "out_of_stock_logs", id), {
        resolved: !currentStatus
      });
      setLogs(prev => prev.map(l => l.id === id ? { ...l, resolved: !currentStatus } : l));
      toast.success(isRTL ? "تم تحديث الحالة" : "Status updated");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update status");
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.code || "").includes(searchTerm) || 
      (log.cashierName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.branchId || "").toLowerCase().includes(searchTerm.toLowerCase());
      
    if (filterResolved === "pending") return !log.resolved && matchesSearch;
    if (filterResolved === "resolved") return log.resolved && matchesSearch;
    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500 mb-2 font-bold text-sm">
            <PackageMinus size={18} />
            {isRTL ? "الماليات / النواقص" : "Financials / Out of Stock"}
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">
            {isRTL ? "مراجعة النواقص" : "Out of Stock Review"}
          </h1>
          <p className="text-slate-500 mt-1">
            {isRTL ? "مطابقة الأكواد الورقية من الخزينة مع السجلات الإلكترونية." : "Cross-reference paper codes from the safe with digital logs."}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder={isRTL ? "ابحث بالكود، الكاشير..." : "Search by code, cashier..."}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
            />
          </div>
          <select 
            value={filterResolved}
            onChange={e => setFilterResolved(e.target.value as any)}
            className="w-full sm:w-auto px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none cursor-pointer"
          >
            <option value="all">{isRTL ? "الكل" : "All"}</option>
            <option value="pending">{isRTL ? "قيد المراجعة" : "Pending"}</option>
            <option value="resolved">{isRTL ? "تمت المراجعة" : "Resolved"}</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl h-64 animate-pulse" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <PackageMinus size={32} className="text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{isRTL ? "لا توجد نواقص" : "No out of stock logs"}</h3>
          <p className="text-slate-500">{isRTL ? "لم يتم العثور على أي سجلات نواقص تطابق بحثك." : "We couldn't find any out of stock logs matching your criteria."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredLogs.map(log => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={log.id} 
              className={`bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border ${log.resolved ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-yellow-500/30 shadow-[0_0_15px_rgba(250,204,21,0.1)]'} transition-all`}
            >
              {/* Header */}
              <div className={`p-4 border-b flex items-center justify-between ${log.resolved ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800/50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-sm border ${log.resolved ? 'bg-emerald-100 dark:bg-emerald-800 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300' : 'bg-yellow-100 dark:bg-yellow-800 border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300'}`}>
                    {log.code || "---"}
                  </div>
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest ${log.resolved ? 'text-emerald-600 dark:text-emerald-400' : 'text-yellow-600 dark:text-yellow-500'}`}>
                      {isRTL ? "كود الخزينة" : "Vault Code"}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric", hour12: true }) : log.date}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => toggleResolved(log.id, log.resolved)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1 ${log.resolved ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/30'}`}
                >
                  {log.resolved ? (
                    <><CheckCircle2 size={14} /> {isRTL ? "تمت المراجعة" : "Resolved"}</>
                  ) : (
                    <><Clock size={14} /> {isRTL ? "قيد المراجعة" : "Pending"}</>
                  )}
                </button>
              </div>

              {/* Body */}
              <div className="p-5">
                <div className="flex items-center gap-6 mb-6">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <UserIcon size={16} className="text-slate-400" />
                    <span className="font-medium">{log.cashierName || "Unknown"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <MapPin size={16} className="text-slate-400" />
                    <span className="font-medium capitalize">{log.branchId || "N/A"}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {isRTL ? "الأصناف الناقصة" : "Missing Items"} ({log.totalMissingQuantity || 0})
                    </div>
                    {log.totalValue !== undefined && (
                      <div className="text-sm font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                        EGP {log.totalValue.toFixed(2)}
                      </div>
                    )}
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
                    {(log.items || []).map((item: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {item.name || "Unknown Item"}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                            <Hash size={10} /> {item.barcode}
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg flex flex-col items-center justify-center min-w-[50px]">
                          <span className="text-[10px] text-slate-400 font-bold uppercase leading-none mb-1">
                            {isRTL ? "الكمية" : "Qty"}
                          </span>
                          <span className="text-sm font-black text-slate-900 dark:text-white leading-none">
                            {item.missingQty || 0}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
