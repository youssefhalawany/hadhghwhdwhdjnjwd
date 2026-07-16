"use client";

import React, { useState, useEffect } from "react";
import { productsDb } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { PageWrapper } from "@/components/PageWrapper";
import { Sparkles, Calendar, User, Search, MapPin, Eye, Share2, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface CleaningLog {
  id: string;
  areaId: string;
  areaNameEn: string;
  areaNameAr: string;
  photoUrl: string;
  signatureUrl: string;
  cashierName: string;
  timestamp: string;
  localTime?: string;
}

export default function ManagerCleaningLogsPage() {
  const { language } = useLanguage();
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all_time"); // all_time, today, yesterday, this_week, this_month
  const [cashierFilter, setCashierFilter] = useState("all");
  
  const [selectedLog, setSelectedLog] = useState<CleaningLog | null>(null);

  const shareToWhatsApp = async (log: CleaningLog) => {
    try {
      const formattedDate = formatDate(log.timestamp, log.localTime);
      const text = language === 'en' 
        ? `*Cleaning Report*\nArea: ${log.areaNameEn}\nCashier: ${log.cashierName}\nDate: ${formattedDate}`
        : `*تقرير النظافة*\nالمنطقة: ${log.areaNameAr}\nالصراف: ${log.cashierName}\nالتاريخ: ${formattedDate}`;

      if (navigator.share) {
        let file: File | null = null;
        if (log.photoUrl.startsWith('data:')) {
          const res = await fetch(log.photoUrl);
          const blob = await res.blob();
          file = new File([blob], `cleaning_${log.cashierName.replace(/\s+/g, '_')}.jpg`, { type: 'image/jpeg' });
        }
        
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: language === 'en' ? 'Cleaning Report' : 'تقرير النظافة',
            text: text,
            files: [file]
          });
          return;
        }
      }

      // Fallback
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } catch (err) {
      console.error("Error sharing:", err);
      // fallback
      const formattedDate = formatDate(log.timestamp, log.localTime);
      const text = `*Cleaning Report*\nArea: ${log.areaNameEn}\nCashier: ${log.cashierName}\nDate: ${formattedDate}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  useEffect(() => {
    const q = query(collection(productsDb, "cleaning_logs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: CleaningLog[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as CleaningLog);
      });
      setLogs(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching cleaning logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const uniqueCashiers = Array.from(new Set(logs.map(l => l.cashierName))).filter(Boolean);

  const filteredLogs = logs.filter(log => {
    // 1. Search filter
    const matchesSearch = log.cashierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.areaNameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.areaNameAr.includes(searchTerm);
    
    // 2. Cashier filter
    const matchesCashier = cashierFilter === "all" || log.cashierName === cashierFilter;
    
    // 3. Date filter
    let matchesDate = true;
    if (dateFilter !== "all_time") {
      const logDate = new Date(log.timestamp);
      const now = new Date();
      if (dateFilter === "today") {
        matchesDate = logDate.toDateString() === now.toDateString();
      } else if (dateFilter === "yesterday") {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        matchesDate = logDate.toDateString() === yesterday.toDateString();
      } else if (dateFilter === "this_week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        matchesDate = logDate >= weekAgo;
      } else if (dateFilter === "this_month") {
        matchesDate = logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
      }
    }
    
    return matchesSearch && matchesCashier && matchesDate;
  });

  const formatDate = (isoString: string, fallbackLocal?: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh'
      }).format(d);
    } catch {
      return fallbackLocal || isoString;
    }
  };

  return (
    <PageWrapper className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-8" dir={language === "ar" ? "rtl" : "ltr"}>
      
      {/* Header & Filters */}
      <header className="mb-8 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Sparkles className="text-cyan-500" size={32} />
            {language === 'en' ? 'Cleaning Logs' : 'سجلات النظافة'}
          </h1>
          <p className="text-slate-500 mt-2">
            {language === 'en' ? 'Review and filter cleaning tasks submitted by cashiers.' : 'مراجعة وتصفية مهام النظافة المقدمة من قبل الصرافين.'}
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Search */}
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder={language === 'en' ? 'Search logs...' : 'ابحث في السجلات...'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
            />
          </div>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full md:w-48 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
          >
            <option value="all_time">{language === 'en' ? 'All Time' : 'كل الوقت'}</option>
            <option value="today">{language === 'en' ? 'Today' : 'اليوم'}</option>
            <option value="yesterday">{language === 'en' ? 'Yesterday' : 'أمس'}</option>
            <option value="this_week">{language === 'en' ? 'This Week' : 'هذا الأسبوع'}</option>
            <option value="this_month">{language === 'en' ? 'This Month' : 'هذا الشهر'}</option>
          </select>

          {/* Cashier Filter */}
          <select
            value={cashierFilter}
            onChange={(e) => setCashierFilter(e.target.value)}
            className="w-full md:w-48 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
          >
            <option value="all">{language === 'en' ? 'All Cashiers' : 'كل الصرافين'}</option>
            {uniqueCashiers.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {loading ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center p-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
            <Sparkles size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
              {language === 'en' ? 'No logs found' : 'لم يتم العثور على سجلات'}
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLogs.map(log => (
              <div key={log.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                
                {/* Photo Header */}
                <div 
                  className="h-48 w-full bg-slate-100 dark:bg-slate-800 relative group cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <img src={log.photoUrl} alt={log.areaNameEn} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
                  </div>
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDate(log.timestamp, log.localTime)}
                  </div>
                </div>

                {/* Details */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                        <MapPin size={18} className="text-cyan-500" />
                        {language === 'en' ? log.areaNameEn : log.areaNameAr}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500 mt-1">
                        <User size={14} />
                        {log.cashierName}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                      {language === 'en' ? 'Signature' : 'التوقيع'}
                    </span>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2 h-16 flex items-center justify-center">
                      {log.signatureUrl ? (
                        <img src={log.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain filter dark:invert" />
                      ) : (
                        <span className="text-xs text-slate-400 italic">No Signature</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Full Image Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-lg flex flex-col items-center">
            <button 
              onClick={() => setSelectedLog(null)} 
              className="absolute -top-12 right-0 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <X size={24} />
            </button>
            
            <img src={selectedLog.photoUrl} alt="Full view" className="max-w-full max-h-[70vh] rounded-2xl object-contain shadow-2xl" />
            
            <div className="w-full mt-6 flex flex-col items-center gap-4">
              <button 
                onClick={(e) => { e.stopPropagation(); shareToWhatsApp(selectedLog); }}
                className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white px-6 py-4 rounded-2xl font-bold shadow-[0_0_20px_rgba(37,211,102,0.3)] active:scale-95 transition-transform text-lg"
              >
                <Share2 size={24} />
                {language === 'en' ? 'Share to WhatsApp' : 'مشاركة عبر واتساب'}
              </button>
            </div>
          </div>
        </div>
      )}

    </PageWrapper>
  );
}
