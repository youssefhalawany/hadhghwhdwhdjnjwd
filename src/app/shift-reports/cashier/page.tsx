"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { Calculator, Package, Banknote, Calendar, Clock, ArrowRight, Lock, User as UserIcon, Globe, WifiOff, RefreshCw, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

// Translation Dictionary
const t = {
  en: {
    shiftAccess: "Shift Access",
    authorizedOnly: "Authorized Cashiers Only",
    cashierName: "Cashier Name",
    selectName: "-- Select your name --",
    pin: "4-Digit PIN",
    unlock: "Unlock Shift Input",
    dailyReport: "Daily Shift Report",
    rejectedTitle: "Report Rejected by Manager",
    rejectedSubtitle: "Please correct your numbers below and resubmit.",
    shiftInfo: "Shift Information",
    date: "Date",
    shift: "Shift",
    morning: "Morning",
    noon: "Noon",
    night: "Night",
    role: "Register Role",
    role1: "Cashier 1 (Full Register & Inventory)",
    role2: "Cashier 2 (Money Only)",
    storeId: "Assigned Store ID",
    drops: "Cashier Drops",
    actualCash: "Actual Cash Inside Drop",
    totalVisa: "Total Visa Slips Inside Drop",
    totalDrops: "Total Declared Drops:",
    inventory: "Inventory Checks",
    cigarettes: "Cigarettes (Packs)",
    lighters: "Lighters (Units)",
    start: "Start",
    delivery: "+ Delivery",
    end: "- End Count",
    soldPacks: "Sold Packs",
    soldUnits: "Sold Units",
    submitting: "Submitting...",
    resubmit: "Resubmit Corrected Report",
    submit: "Submit Shift Report",
    reasonLabel: "Manager's Reason"
  },
  ar: {
    shiftAccess: "تسجيل الدخول للوردية",
    authorizedOnly: "للكاشير المصرح لهم فقط",
    cashierName: "اسم الكاشير",
    selectName: "-- اختر اسمك --",
    pin: "الرمز السري (٤ أرقام)",
    unlock: "الدخول للوردية",
    dailyReport: "تقرير الوردية اليومي",
    rejectedTitle: "تم رفض التقرير من المدير",
    rejectedSubtitle: "يرجى تصحيح الأرقام أدناه وإعادة الإرسال.",
    shiftInfo: "معلومات الوردية",
    date: "التاريخ",
    shift: "فترة الوردية",
    morning: "صباحي",
    noon: "مسائي",
    night: "ليلي",
    role: "نوع الكاشير",
    role1: "كاشير ١ (نقدية ومخزون)",
    role2: "كاشير ٢ (نقدية فقط)",
    storeId: "رقم الفرع",
    drops: "النقدية المسلمة",
    actualCash: "النقد الفعلي المسلم (كاش)",
    totalVisa: "إجمالي إيصالات الفيزا",
    totalDrops: "إجمالي النقدية المسلمة:",
    inventory: "جرد المخزون",
    cigarettes: "السجائر (علب)",
    lighters: "الولاعات (حبات)",
    start: "بداية الوردية",
    delivery: "+ استلام",
    end: "- نهاية الوردية",
    soldPacks: "المباع (علب)",
    soldUnits: "المباع (حبات)",
    submitting: "جاري الإرسال...",
    resubmit: "إعادة إرسال التقرير المصحح",
    submit: "إرسال تقرير الوردية",
    reasonLabel: "سبب الرفض"
  }
};

export default function CashierShiftReportPage() {
  const router = useRouter();

  const [lang, setLang] = useState<"en" | "ar">("en");
  const dict = t[lang];

  const [cashiers, setCashiers] = useState<any[]>([]);
  const [selectedCashierId, setSelectedCashierId] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loadingCashiers, setLoadingCashiers] = useState(true);

  // Cashier Details
  const [date, setDate] = useState("");
  const [shift, setShift] = useState("Morning");
  const [cashierRole, setCashierRole] = useState<number>(1);
  
  // Cashier Money Counts
  const [denominations, setDenominations] = useState({
    '200': "", '100': "", '50': "", '20': "", '10': "", '5': "", 'coins': ""
  });
  const [visa, setVisa] = useState<string>("");

  // Inventory
  const [cigarettes, setCigarettes] = useState({ start: "", delivery: "", end: "" });
  const [lighters, setLighters] = useState({ start: "", delivery: "", end: "" });

  const [existingReportId, setExistingReportId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  
  // Offline Mode States
  const [isOffline, setIsOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  useEffect(() => {
    // Initial offline check
    setIsOffline(!navigator.onLine);
    checkOfflineQueue();

    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineReports();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkOfflineQueue = () => {
    const stored = localStorage.getItem('offline_reports_queue');
    if (stored) {
      const q = JSON.parse(stored);
      setOfflineCount(q.length);
    } else {
      setOfflineCount(0);
    }
  };

  const syncOfflineReports = async () => {
    const stored = localStorage.getItem('offline_reports_queue');
    if (!stored) return;
    
    try {
      setSyncing(true);
      const queue = JSON.parse(stored);
      const remaining = [];
      
      for (const item of queue) {
        try {
          if (item.existingReportId) {
            await updateDoc(doc(db, "shift_reports", item.existingReportId), item.payload);
          } else {
            await addDoc(collection(db, "shift_reports"), item.payload);
          }
        } catch (e) {
          console.error("Failed to sync report", e);
          remaining.push(item);
        }
      }
      
      if (remaining.length === 0) {
        localStorage.removeItem('offline_reports_queue');
        alert(lang === 'en' ? "Offline reports successfully synced to the server!" : "تم مزامنة التقارير المحفوظة بنجاح!");
      } else {
        localStorage.setItem('offline_reports_queue', JSON.stringify(remaining));
      }
      checkOfflineQueue();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const fetchCashiers = async () => {
      try {
        const snap = await getDocs(collection(db, "cashiers"));
        setCashiers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Failed to load cashiers", e);
      } finally {
        setLoadingCashiers(false);
      }
    };
    fetchCashiers();
    setDate(new Date().toISOString().substring(0, 10));
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = cashiers.find(x => x.id === selectedCashierId);
    if (!c) return alert("Select your name");
    if (c.pin !== pinInput) {
      alert("Incorrect PIN");
      return;
    }

    setUnlocked(true);
    setLoading(true);

    try {
      // 1. Check if there is a rejected report for this cashier today
      const rejectQuery = query(
        collection(db, "shift_reports"),
        where("cashierDetails.name", "==", c.name),
        where("status", "==", "rejected")
      );
      
      const rejectSnap = await getDocs(rejectQuery);
      if (!rejectSnap.empty) {
        // Sort in memory to get the latest without needing a composite index
        const sortedDocs = rejectSnap.docs.sort((a, b) => 
          b.data().createdAt.localeCompare(a.data().createdAt)
        );
        const rejectedReport = sortedDocs[0];
        const data = rejectedReport.data();
        
        setExistingReportId(rejectedReport.id);
        setRejectReason(data.managerAudit?.rejectReason || "No reason provided by manager.");
        setOriginalData({
          cash: data.cashierCounts.cash,
          visa: data.cashierCounts.visa,
          cigEnd: data.inventoryCounts?.cigarettes?.end || 0,
          lightEnd: data.inventoryCounts?.lighters?.end || 0
        });
        
        // Auto-fill their old inputs
        setShift(data.cashierDetails.shift);
        setCashierRole(data.cashierRole || 1);
        if (data.cashierCounts.denominations) {
          setDenominations({
            '200': data.cashierCounts.denominations['200'] ? String(data.cashierCounts.denominations['200']) : "",
            '100': data.cashierCounts.denominations['100'] ? String(data.cashierCounts.denominations['100']) : "",
            '50': data.cashierCounts.denominations['50'] ? String(data.cashierCounts.denominations['50']) : "",
            '20': data.cashierCounts.denominations['20'] ? String(data.cashierCounts.denominations['20']) : "",
            '10': data.cashierCounts.denominations['10'] ? String(data.cashierCounts.denominations['10']) : "",
            '5': data.cashierCounts.denominations['5'] ? String(data.cashierCounts.denominations['5']) : "",
            'coins': data.cashierCounts.denominations['coins'] ? String(data.cashierCounts.denominations['coins']) : ""
          });
        } else {
          setDenominations({ '200': "", '100': "", '50': "", '20': "", '10': "", '5': "", 'coins': String(data.cashierCounts.cash) });
        }
        setVisa(String(data.cashierCounts.visa));
        setCigarettes({
          start: String(data.inventoryCounts?.cigarettes?.start || ""),
          delivery: String(data.inventoryCounts?.cigarettes?.delivery || ""),
          end: String(data.inventoryCounts?.cigarettes?.end || "")
        });
        setLighters({
          start: String(data.inventoryCounts?.lighters?.start || ""),
          delivery: String(data.inventoryCounts?.lighters?.delivery || ""),
          end: String(data.inventoryCounts?.lighters?.end || "")
        });
        
        setLoading(false);
        return; // Skip the auto-fetch for a new report since we are editing a rejected one
      }

      // 2. If no rejected report, Auto-fetch previous shift's end inventory for this store
      const prevQuery = query(
        collection(db, "shift_reports"),
        where("cashierDetails.storeId", "==", c.storeId)
      );
      const prevSnap = await getDocs(prevQuery);
      if (!prevSnap.empty) {
        const sortedDocs = prevSnap.docs.sort((a,b) => b.data().createdAt.localeCompare(a.data().createdAt));
        const lastReport = sortedDocs[0].data();
        const cigEnd = lastReport.inventoryCounts?.cigarettes?.end || 0;
        const lightEnd = lastReport.inventoryCounts?.lighters?.end || 0;
        setCigarettes(prev => ({ ...prev, start: String(cigEnd) }));
        setLighters(prev => ({ ...prev, start: String(lightEnd) }));
      }
    } catch (e) {
      console.error("Could not fetch data on unlock", e);
      // Fails silently if no previous records or missing composite index
    } finally {
      setLoading(false);
    }
  };

  const calculateSold = (start: string, delivery: string, end: string) => {
    const s = Number(start) || 0;
    const d = Number(delivery) || 0;
    const e = Number(end) || 0;
    return s + d - e;
  };

  const calculateTotalCash = () => {
    return (
      (Number(denominations['200']) * 200) +
      (Number(denominations['100']) * 100) +
      (Number(denominations['50']) * 50) +
      (Number(denominations['20']) * 20) +
      (Number(denominations['10']) * 10) +
      (Number(denominations['5']) * 5) +
      (Number(denominations['coins']) || 0)
    );
  };

  const calculateTotalMoney = () => {
    return calculateTotalCash() + (Number(visa) || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const c = cashiers.find(x => x.id === selectedCashierId);

    const payload: any = {
      status: "pending_manager",
      createdAt: new Date().toISOString(),
      cashierDetails: {
        name: c?.name || "Unknown",
        date,
        shift,
        storeId: c?.storeId || "Unknown"
      },
      cashierRole,
      cashierCounts: {
        cash: calculateTotalCash(),
        denominations: {
          '200': Number(denominations['200']) || 0,
          '100': Number(denominations['100']) || 0,
          '50': Number(denominations['50']) || 0,
          '20': Number(denominations['20']) || 0,
          '10': Number(denominations['10']) || 0,
          '5': Number(denominations['5']) || 0,
          'coins': Number(denominations['coins']) || 0,
        },
        visa: Number(visa) || 0,
        total: calculateTotalMoney()
      },
      inventoryCounts: {
        cigarettes: {
          start: Number(cigarettes.start) || 0,
          delivery: Number(cigarettes.delivery) || 0,
          end: Number(cigarettes.end) || 0,
          sold: calculateSold(cigarettes.start, cigarettes.delivery, cigarettes.end)
        },
        lighters: {
          start: Number(lighters.start) || 0,
          delivery: Number(lighters.delivery) || 0,
          end: Number(lighters.end) || 0,
          sold: calculateSold(lighters.start, lighters.delivery, lighters.end)
        }
      }
    };

    try {

      if (isOffline) {
        throw new Error("OFFLINE_MODE");
      }

      let submittedId = "";
      if (existingReportId) {
        // Edit rejected report
        const updatePayload = {
          ...payload,
          previousSubmission: originalData || null
        };
        await updateDoc(doc(db, "shift_reports", existingReportId), updatePayload);
        submittedId = existingReportId;
      } else {
        // Create new report
        const docRef = await addDoc(collection(db, "shift_reports"), payload);
        submittedId = docRef.id;
      }
      router.push(`/shift-reports/cashier/success?id=${submittedId}`);
    } catch (error: any) {
      console.error("Error submitting shift report:", error);
      
      // Save to offline queue if offline or network failure
      const isNetworkError = error.message === "OFFLINE_MODE" || error.code?.includes('network') || error.message?.includes('offline');
      
      if (isNetworkError) {
        const stored = localStorage.getItem('offline_reports_queue');
        const queue = stored ? JSON.parse(stored) : [];
        queue.push({
          existingReportId: existingReportId || null,
          payload: {
            ...payload,
            _offlineSavedAt: new Date().toISOString()
          }
        });
        localStorage.setItem('offline_reports_queue', JSON.stringify(queue));
        checkOfflineQueue();
        
        alert(lang === 'en' ? "You are offline. Your report has been saved and will automatically send when you reconnect to the internet." : "أنت غير متصل بالإنترنت. تم حفظ التقرير محلياً وسيتم إرساله تلقائياً فور عودة الاتصال.");
        
        // Reset form to let them continue or leave
        setDenominations({ '200': "", '100': "", '50': "", '20': "", '10': "", '5': "", 'coins': "" });
        setVisa("");
        router.push('/shift-reports/cashier');
        window.location.reload();
      } else {
        alert(lang === 'en' ? "Failed to submit. Please try again." : "فشل الإرسال. يرجى المحاولة مرة أخرى.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingCashiers) {
    return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-600"></div></div>;
  }

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto space-y-6 pt-10" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="flex justify-end px-4">
          <button 
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-2 bg-slate-200 dark:bg-slate-800 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold shadow-sm"
          >
            <Globe className="h-4 w-4" /> {lang === "en" ? "عربي" : "English"}
          </button>
        </div>

        <div className="text-center py-4 border-b border-border mb-4 sm:mb-6 px-4">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-red-600 rounded-full mb-3 sm:mb-4 shadow-lg shadow-red-500/20">
            <Lock className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{dict.shiftAccess}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground uppercase font-bold tracking-widest mt-1 sm:mt-2">{dict.authorizedOnly}</p>
        </div>

        <div className="px-4">
          <form onSubmit={handleUnlock} className="glass-panel p-4 sm:p-6 rounded-2xl space-y-4 sm:space-y-6 border border-border">
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase mb-1 sm:mb-2 flex items-center gap-1"><UserIcon className="h-3 w-3 sm:h-4 sm:w-4" /> {dict.cashierName}</label>
              <div className="relative">
                <div 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full p-3 sm:p-4 rounded-xl border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-red-500 text-base sm:text-lg cursor-pointer flex justify-between items-center"
                >
                  <span className={!selectedCashierId ? "text-muted-foreground" : ""}>
                    {selectedCashierId 
                      ? (() => {
                          const c = cashiers.find(x => x.id === selectedCashierId);
                          return c ? `${c.name} (${lang === "en" ? "Store" : "فرع"}: ${c.storeId})` : dict.selectName;
                        })()
                      : dict.selectName}
                  </span>
                  <ChevronDown className={`h-5 w-5 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </div>

                {isDropdownOpen && (
                  <div className="absolute z-[100] top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5">
                    {cashiers.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => { setSelectedCashierId(c.id); setIsDropdownOpen(false); }}
                        className="p-4 hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800 dark:active:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 transition-colors"
                      >
                        <span className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">{c.name}</span>
                        <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md w-fit">
                          {lang === "en" ? "Store" : "فرع"}: {c.storeId}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase mb-1 sm:mb-2 flex items-center gap-1"><Lock className="h-3 w-3 sm:h-4 sm:w-4" /> {dict.pin}</label>
              <input 
                required
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full p-3 sm:p-4 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-red-500 text-center text-2xl sm:text-3xl tracking-[0.5em] sm:tracking-[1em] font-mono"
                placeholder="••••"
              />
            </div>

            <button type="submit" className="w-full py-3 sm:py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-base sm:text-lg shadow-xl shadow-red-500/20 transition-all">
              {dict.unlock}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeCashier = cashiers.find(x => x.id === selectedCashierId);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground max-w-md mx-auto shadow-2xl relative" dir={lang === "ar" ? "rtl" : "ltr"}>
      
      {/* Header */}
      <header className="bg-slate-900 text-white p-3 sm:p-4 sticky top-0 z-10 flex items-center justify-between border-b border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight">{dict.dailyReport}</h1>
          <p className="text-[10px] sm:text-xs text-slate-400 font-semibold">{new Date().toLocaleDateString('en-GB')}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            type="button"
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors"
          >
            <Globe className="h-3 w-3" /> {lang === "en" ? "عربي" : "EN"}
          </button>
          <div className="h-8 w-8 sm:h-10 sm:w-10 bg-red-600 rounded-full flex items-center justify-center border-2 border-red-500/30">
            <span className="font-black text-sm sm:text-xl">K</span>
          </div>
        </div>
      </header>

      {/* Offline Status Bar */}
      {(isOffline || offlineCount > 0) && (
        <div className={`px-4 py-2 flex items-center justify-between text-xs font-bold text-white ${isOffline ? 'bg-orange-500' : 'bg-blue-600'}`}>
          <div className="flex items-center gap-2">
            {isOffline ? <WifiOff className="h-4 w-4" /> : <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />}
            <span>
              {isOffline 
                ? (lang === 'en' ? "Offline Mode Active" : "وضع عدم الاتصال نشط") 
                : (syncing ? (lang === 'en' ? "Syncing..." : "جاري المزامنة...") : (lang === 'en' ? "Internet Restored" : "عاد الاتصال"))
              }
            </span>
          </div>
          {offlineCount > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full">
              {offlineCount} {lang === 'en' ? "pending" : "معلق"}
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pb-24 relative">
        {rejectReason && (
          <div className="bg-red-50 border-b border-red-200 p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="bg-red-100 p-2 rounded-full flex-shrink-0">
                <Lock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-red-800 font-bold text-sm">{dict.rejectedTitle}</h3>
                <p className="text-red-600 text-xs mt-1 font-medium leading-snug">
                  <span className="font-bold text-red-800">{dict.reasonLabel}:</span> "{rejectReason}"
                </p>
                <p className="text-red-500 text-[10px] mt-2 font-bold uppercase tracking-wider">
                  {dict.rejectedSubtitle}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-3 sm:p-4 space-y-4 sm:space-y-6">
          
          {/* 1. Shift Info */}
          <section className="glass-panel p-4 sm:p-5 rounded-xl sm:rounded-2xl space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
              <h2 className="text-base sm:text-lg font-bold text-foreground">{dict.shiftInfo}</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> {dict.date}</label>
                <input required type="date" value={date} readOnly className="w-full p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-border bg-muted/50 text-slate-500 outline-none cursor-not-allowed text-xs sm:text-sm" />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> {dict.shift}</label>
                <select value={shift} onChange={(e) => setShift(e.target.value)} className="w-full p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-border bg-background outline-none appearance-none text-xs sm:text-sm">
                  <option value="Morning">{dict.morning}</option>
                  <option value="Noon">{dict.noon}</option>
                  <option value="Night">{dict.night}</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><UserIcon className="h-3 w-3" /> {dict.role}</label>
                <select value={cashierRole} onChange={(e) => setCashierRole(Number(e.target.value))} className="w-full p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-border bg-background outline-none appearance-none font-bold text-foreground focus:ring-2 focus:ring-red-500 text-xs sm:text-sm">
                  <option value={1}>{dict.role1}</option>
                  <option value={2}>{dict.role2}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase mb-1 text-slate-400">{dict.storeId}</label>
              <div className="w-full p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-border bg-muted/50 text-slate-500 font-mono text-xs sm:text-sm">
                {activeCashier?.storeId}
              </div>
            </div>
          </section>

          {/* 2. Cashier Money */}
          <section className="glass-panel p-4 sm:p-5 rounded-xl sm:rounded-2xl space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
              <h2 className="text-base sm:text-lg font-bold text-foreground">{dict.drops}</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-border">
                <p className="text-sm font-bold text-muted-foreground mb-3">{lang === "en" ? "Cash Breakdown (Quantities)" : "تفاصيل النقدية (العدد)"}</p>
                <div className="flex flex-col gap-3">
                  {[200, 100, 50, 20, 10, 5].map((bill) => (
                    <div key={bill} className="flex items-center gap-2">
                      <span className="w-12 text-sm font-bold text-slate-500">x {bill}</span>
                      <input 
                        type="number" inputMode="numeric" min="0"
                        value={denominations[String(bill) as keyof typeof denominations]} 
                        onChange={(e) => setDenominations({...denominations, [String(bill)]: e.target.value})}
                        className="w-full p-2.5 sm:p-3 rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-emerald-600 dark:text-emerald-400 text-lg"
                        placeholder="0"
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-2 pt-3 border-t border-border">
                    <span className="w-12 text-sm font-bold text-slate-500">Coins</span>
                    <input 
                      type="number" inputMode="decimal" min="0" step="0.01"
                      value={denominations['coins']} 
                      onChange={(e) => setDenominations({...denominations, 'coins': e.target.value})}
                      className="w-full p-2.5 sm:p-3 rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-emerald-600 dark:text-emerald-400 text-lg"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
                <span className="font-bold text-emerald-800 dark:text-emerald-500">{lang === "en" ? "Total Cash" : "إجمالي النقدية"}</span>
                <span className="font-black text-xl text-emerald-600 dark:text-emerald-400 font-mono">{calculateTotalCash().toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase mb-1">{dict.totalVisa}</label>
                <div className="relative">
                  <span className={`absolute ${lang === "ar" ? "right-3 sm:right-4" : "left-3 sm:left-4"} top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs sm:text-sm`}>EGP</span>
                  <input required type="number" inputMode="decimal" min="0" step="0.01" value={visa} onChange={(e) => setVisa(e.target.value)} className={`w-full ${lang === "ar" ? "pr-12 sm:pr-14" : "pl-12 sm:pl-14"} p-3 sm:p-4 rounded-lg sm:rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-blue-500 text-lg sm:text-xl font-mono text-blue-600 dark:text-blue-400`} placeholder="0.00" />
                </div>
              </div>
              <div className="pt-3 sm:pt-4 border-t border-border flex justify-between items-center bg-muted/30 p-3 sm:p-4 rounded-lg sm:rounded-xl border-dashed">
                <span className="text-xs sm:text-sm font-bold text-muted-foreground uppercase">{dict.totalDrops}</span>
                <span className="text-xl sm:text-2xl font-black text-foreground">{calculateTotalMoney().toFixed(2)}</span>
              </div>
            </div>
          </section>

          {/* 3. Inventory Checks (Only shown for Cashier 1) */}
          {cashierRole === 1 && (
            <section className="glass-panel p-4 sm:p-5 rounded-xl sm:rounded-2xl space-y-4 sm:space-y-6">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                <h2 className="text-base sm:text-lg font-bold text-foreground">{dict.inventory}</h2>
              </div>
              
              {/* Cigarettes */}
              <div className="space-y-2 sm:space-y-3 bg-muted/20 p-3 sm:p-4 rounded-xl border border-border">
                <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-border pb-1 sm:pb-2 uppercase tracking-wide text-[10px] sm:text-xs">{dict.cigarettes}</h3>
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  <div>
                    <label className="block text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase mb-1">{dict.start}</label>
                    <input required type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={cigarettes.start} onChange={(e) => setCigarettes({ ...cigarettes, start: e.target.value })} className="w-full p-2 sm:p-2.5 rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-orange-500 text-center font-mono text-xs sm:text-base" />
                  </div>
                  <div>
                    <label className="block text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase mb-1 text-emerald-500">{dict.delivery}</label>
                    <input required type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={cigarettes.delivery} onChange={(e) => setCigarettes({ ...cigarettes, delivery: e.target.value })} className="w-full p-2 sm:p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 outline-none focus:ring-2 focus:ring-emerald-500 text-center font-mono text-emerald-600 text-xs sm:text-base" />
                  </div>
                  <div>
                    <label className="block text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase mb-1 text-red-500">{dict.end}</label>
                    <input required type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={cigarettes.end} onChange={(e) => setCigarettes({ ...cigarettes, end: e.target.value })} className="w-full p-2 sm:p-2.5 rounded-lg border border-red-500/30 bg-red-500/5 outline-none focus:ring-2 focus:ring-red-500 text-center font-mono text-red-600 font-bold text-xs sm:text-base" />
                  </div>
                  <div className="bg-slate-900 rounded-lg p-1.5 sm:p-2.5 text-center border border-slate-700 flex flex-col justify-center">
                    <label className="block text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase mb-0.5">{dict.soldPacks}</label>
                    <span className="font-black text-white text-sm sm:text-lg">{calculateSold(cigarettes.start, cigarettes.delivery, cigarettes.end)}</span>
                  </div>
                </div>
              </div>

              {/* Lighters */}
              <div className="space-y-2 sm:space-y-3 bg-muted/20 p-3 sm:p-4 rounded-xl border border-border">
                <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-border pb-1 sm:pb-2 uppercase tracking-wide text-[10px] sm:text-xs">{dict.lighters}</h3>
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  <div>
                    <label className="block text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase mb-1">{dict.start}</label>
                    <input required type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={lighters.start} onChange={(e) => setLighters({ ...lighters, start: e.target.value })} className="w-full p-2 sm:p-2.5 rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-orange-500 text-center font-mono text-xs sm:text-base" />
                  </div>
                  <div>
                    <label className="block text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase mb-1 text-emerald-500">{dict.delivery}</label>
                    <input required type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={lighters.delivery} onChange={(e) => setLighters({ ...lighters, delivery: e.target.value })} className="w-full p-2 sm:p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 outline-none focus:ring-2 focus:ring-emerald-500 text-center font-mono text-emerald-600 text-xs sm:text-base" />
                  </div>
                  <div>
                    <label className="block text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase mb-1 text-red-500">{dict.end}</label>
                    <input required type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={lighters.end} onChange={(e) => setLighters({ ...lighters, end: e.target.value })} className="w-full p-2 sm:p-2.5 rounded-lg border border-red-500/30 bg-red-500/5 outline-none focus:ring-2 focus:ring-red-500 text-center font-mono text-red-600 font-bold text-xs sm:text-base" />
                  </div>
                  <div className="bg-slate-900 rounded-lg p-1.5 sm:p-2.5 text-center border border-slate-700 flex flex-col justify-center">
                    <label className="block text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase mb-0.5">{dict.soldUnits}</label>
                    <span className="font-black text-white text-sm sm:text-lg">{calculateSold(lighters.start, lighters.delivery, lighters.end)}</span>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* SUBMIT */}
        <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-background/90 backdrop-blur-md border-t border-border z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
          <div className="max-w-md mx-auto">
            <button type="submit" disabled={loading} className="w-full py-3.5 sm:py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-base sm:text-lg shadow-xl shadow-red-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {loading ? dict.submitting : <>{existingReportId ? dict.resubmit : dict.submit} <ArrowRight className={`h-4 w-4 sm:h-5 sm:w-5 ${lang === "ar" ? "rotate-180" : ""}`} /></>}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
