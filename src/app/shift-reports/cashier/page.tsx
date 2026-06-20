"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { Calculator, Package, Banknote, Calendar, Clock, ArrowRight, ArrowLeft, Lock, User as UserIcon, Globe, WifiOff, RefreshCw, ChevronDown, Shield, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { PinPad } from "@/components/PinPad";
import { RadarOfflineScreen } from "@/components/RadarOfflineScreen";

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
    reasonLabel: "Manager's Reason",
    signYourReport: "Sign Your Report",
    signBelow: "Please sign below to verify this report.",
    clearSignature: "Clear Signature"
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
    reasonLabel: "سبب الرفض",
    signYourReport: "توقيع التقرير",
    signBelow: "يرجى التوقيع داخل المربع أدناه لتأكيد التقرير.",
    clearSignature: "مسح التوقيع"
  }
};

const SignaturePad = ({ onSave, onClear, dict }: { onSave: (data: string) => void, onClear: () => void, dict: any }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Fix for blurry canvas on high DPI screens
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, []);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Calculate scaling factor in case the canvas is scaled by CSS
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: any) => {
    const coords = getCoordinates(e);
    if (!coords) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onClear();
    }
  };

  return (
    <div className="space-y-2">
      <div className="border border-border rounded-xl overflow-hidden bg-white touch-none">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-[150px] sm:h-[200px] cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <button type="button" onClick={clear} className="text-xs text-red-500 font-bold uppercase hover:underline">
        {dict.clearSignature || "Clear Signature"}
      </button>
    </div>
  );
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

  const [cashierSignature, setCashierSignature] = useState<string>("");

  const [loading, setLoading] = useState(false);
  
  // Offline Mode States
  const [isOffline, setIsOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [showRadar, setShowRadar] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  useEffect(() => {
    // Check if authenticated from Cashier Hub
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (savedUserStr) {
      try {
        const user = JSON.parse(savedUserStr);
        setSelectedCashierId(user.id);
        setUnlocked(true);
        // We simulate unlocking to trigger the data fetch logic
        setTimeout(() => triggerUnlockDataFetch(user), 500);
      } catch (e) {
        console.error("Invalid session");
      }
    }

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
        
        // Show success animation on radar if it's open
        setShowRadar(true);
        setTimeout(() => {
          setShowRadar(false);
          alert(lang === 'en' ? "Offline reports successfully synced to the server!" : "تم مزامنة التقارير المحفوظة بنجاح!");
        }, 2000);
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
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Inject Master Account so it works properly in Shift Reports
        fetched.push({
          id: "master_youssef",
          employeeId: "master_youssef",
          name: "Mr Youssef",
          pin: "4321",
          role: "master",
          storeId: "ALL"
        });
        
        setCashiers(fetched);
      } catch (e) {
        console.error("Failed to load cashiers", e);
      } finally {
        setLoadingCashiers(false);
      }
    };
    fetchCashiers();
    setDate(new Date().toISOString().substring(0, 10));
  }, []);

  // Extracted unlock logic for auto-unlock support
  const triggerUnlockDataFetch = async (c: any) => {
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

  const handleUnlock = async (e: React.FormEvent | string) => {
    if (typeof e !== "string") {
      e.preventDefault();
    }
    const c = cashiers.find(x => x.id === selectedCashierId);
    if (!c) return alert("Select your name");
    
    const pinToVerify = typeof e === "string" ? e : pinInput;
    if (c.pin !== pinToVerify) {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([50, 50, 50]);
      alert("Incorrect PIN");
      setPinInput("");
      return;
    }

    setUnlocked(true);
    triggerUnlockDataFetch(c);
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

    if (!cashierSignature) {
      alert(lang === 'en' ? "Please sign your report before submitting." : "يرجى توقيع التقرير قبل الإرسال.");
      return;
    }

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
      cashierSignature,
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
      
      try {
        fetch("/api/notifications/notify-master", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "New Shift Report",
            body: `Cashier ${c?.name || 'Unknown'} (Store: ${c?.storeId || 'Unknown'}) just submitted a shift report.`
          })
        }).catch(e => console.error("Notify error", e));
      } catch (err) {}

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
        
        // Show radar
        setShowRadar(true);
        
        // Reset form to let them continue or leave
        setDenominations({ '200': "", '100': "", '50': "", '20': "", '10': "", '5': "", 'coins': "" });
        setVisa("");
        setCashierSignature("");
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/40 flex flex-col items-center justify-center pt-8 pb-12 px-4 transition-colors duration-300" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="w-full max-w-md space-y-6">
          
          {/* Language Toggle */}
          <div className="flex justify-end">
            <button 
              type="button"
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/50 px-4 py-2 rounded-full text-sm font-bold shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Globe className="h-4 w-4" /> {lang === "en" ? "عربي" : "English"}
            </button>
          </div>

          {/* Title */}
          <div className="text-center py-2 mb-2">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-full mb-4 shadow-xl shadow-red-500/30">
              <Lock className="h-8 w-8 text-white animate-pulse" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {dict.shiftAccess}
            </h1>
            <p className="text-xs text-red-600 dark:text-red-400 font-bold tracking-widest mt-2 uppercase">
              {dict.authorizedOnly}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleUnlock} className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md p-6 sm:p-8 rounded-3xl space-y-6 border border-slate-200/70 dark:border-slate-800/60 shadow-2xl">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1">
                <UserIcon className="h-4 w-4 text-slate-400" /> {dict.cashierName}
              </label>
              <div className="relative">
                <div 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-805/50 text-slate-900 dark:text-white outline-none focus:border-red-500 text-base cursor-pointer flex justify-between items-center transition-all"
                >
                  <span className={!selectedCashierId ? "text-slate-400 dark:text-slate-505" : "font-bold"}>
                    {selectedCashierId 
                      ? (() => {
                          const c = cashiers.find(x => x.id === selectedCashierId);
                          return c ? `${c.name} (${lang === "en" ? "Store" : "فرع"}: ${c.storeId})` : dict.selectName;
                        })()
                      : dict.selectName}
                  </span>
                  <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </div>

                {isDropdownOpen && (
                  <div className="absolute z-[100] top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5 animate-in fade-in duration-200">
                    {cashiers.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => { setSelectedCashierId(c.id); setIsDropdownOpen(false); }}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700/60 last:border-0 flex flex-col gap-1 transition-colors"
                      >
                        <span className="font-bold text-slate-900 dark:text-white text-base">{c.name}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-900/50 px-2 py-0.5 rounded-md w-fit">
                          {lang === "en" ? "Store" : "فرع"}: {c.storeId}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-4 flex items-center justify-center gap-1">
                <Lock className="h-4 w-4 text-slate-400" /> {dict.pin}
              </label>
              <PinPad 
                onPinChange={(val) => setPinInput(val)}
                onSubmit={(val) => handleUnlock(val)}
                maxLength={4}
              />
            </div>
          </form>
        </div>
      </div>
    );
  }

  const activeCashier = cashiers.find(x => x.id === selectedCashierId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-28" dir={lang === "ar" ? "rtl" : "ltr"}>
      
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => router.push("/cashier")}
              className="flex items-center gap-1 text-slate-555 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <ArrowLeft className={`h-5 w-5 ${lang === "ar" ? "rotate-180" : ""}`} />
              <span className="font-bold text-sm">{lang === "en" ? "Back" : "رجوع"}</span>
            </button>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 dark:text-white leading-none">{dict.dailyReport}</h1>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">{new Date().toLocaleDateString('en-GB')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              type="button"
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-705 px-3 py-1.5 rounded-full text-xs font-bold transition-colors text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700/60 cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5" /> {lang === "en" ? "عربي" : "EN"}
            </button>
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-red-600 rounded-full flex items-center justify-center border-2 border-red-500/30 text-white font-black shadow-md shadow-red-500/10">
              K
            </div>
          </div>
        </div>
      </header>

      {showRadar && (
        <RadarOfflineScreen 
          isReconnecting={syncing} 
          onDismiss={() => setShowRadar(false)} 
          reportCount={offlineCount} 
        />
      )}

      {/* Offline Status Bar */}
      {(isOffline || offlineCount > 0) && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div 
            onClick={() => setShowRadar(true)}
            className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold text-white shadow-md cursor-pointer transition-all hover:scale-[1.01] ${isOffline ? 'bg-orange-500 shadow-orange-500/10' : 'bg-blue-600 shadow-blue-600/10'}`}
          >
            <div className="flex items-center gap-2">
              {isOffline ? <WifiOff className="h-4 w-4" /> : <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />}
              <span>
                {isOffline 
                  ? (lang === 'en' ? "Offline Mode Active (Auto-saves locally)" : "وضع عدم الاتصال نشط (سيتم الحفظ محلياً)") 
                  : (syncing ? (lang === 'en' ? "Syncing offline reports..." : "جاري مزامنة التقارير...") : (lang === 'en' ? "Internet Restored" : "عاد الاتصال بالإنترنت"))
                }
              </span>
            </div>
            {offlineCount > 0 && (
              <span className="bg-white/20 px-2.5 py-0.5 rounded-lg text-[10px] font-black">
                {offlineCount} {lang === 'en' ? "pending" : "معلق"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {rejectReason && (
          <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/50 p-5 rounded-2xl shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="bg-red-100 dark:bg-red-900/30 p-2.5 rounded-xl flex-shrink-0 text-red-600 dark:text-red-400">
                <Lock className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-red-900 dark:text-red-400 font-bold text-sm sm:text-base">{dict.rejectedTitle}</h3>
                <p className="text-red-750 dark:text-red-300 text-xs sm:text-sm mt-1 font-semibold leading-relaxed">
                  <span className="font-black text-red-900 dark:text-red-400">{dict.reasonLabel}:</span> "{rejectReason}"
                </p>
                <p className="text-red-600 dark:text-red-400 text-[10px] sm:text-xs mt-3 font-bold uppercase tracking-wider">
                  {dict.rejectedSubtitle}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">{lang === "en" ? "Logged In Cashier" : "الكاشير المسجل"}</p>
              <p className="font-bold text-slate-800 dark:text-white text-base leading-none mt-1">{activeCashier?.name}</p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={() => router.push('/voids/cashier')}
            className="w-full sm:w-auto flex items-center justify-between bg-slate-900 hover:bg-slate-800 dark:bg-slate-850 dark:hover:bg-slate-700 text-white px-5 py-3.5 rounded-2xl font-bold shadow-md shadow-slate-900/10 active:scale-[0.98] transition-all gap-4 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" />
              <span className="text-left font-bold text-xs sm:text-sm">
                {lang === 'en' ? "Log a Void / Return" : "تسجيل مرتجع / إلغاء"}
              </span>
            </div>
            <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-800 dark:bg-slate-700 px-2 py-0.5 rounded-md">NEW</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Shift Info & Cash breakdown */}
            <div className="space-y-6">
              
              {/* 1. Shift Info */}
              <section className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-150 dark:border-slate-800 pb-3">
                  <Clock className="h-5 w-5 text-red-500" />
                  <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">{dict.shiftInfo}</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> {dict.date}
                    </label>
                    <input required type="date" value={date} readOnly className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 text-slate-500 outline-none cursor-not-allowed text-xs sm:text-sm font-semibold" />
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {dict.shift}
                    </label>
                    <div className="relative">
                      <select value={shift} onChange={(e) => setShift(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none appearance-none focus:ring-2 focus:ring-red-500 text-xs sm:text-sm font-semibold cursor-pointer">
                        <option value="Morning">{dict.morning}</option>
                        <option value="Noon">{dict.noon}</option>
                        <option value="Night">{dict.night}</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <UserIcon className="h-3.5 w-3.5" /> {dict.role}
                    </label>
                    <div className="relative">
                      <select value={cashierRole} onChange={(e) => setCashierRole(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none appearance-none font-bold focus:ring-2 focus:ring-red-500 text-xs sm:text-sm cursor-pointer">
                        <option value={1}>{dict.role1}</option>
                        <option value={2}>{dict.role2}</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-1.5">{dict.storeId}</label>
                  <div className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 text-slate-500 font-mono text-xs sm:text-sm font-semibold">
                    {activeCashier?.storeId}
                  </div>
                </div>
              </section>

              {/* 2. Cashier Money (Drops) */}
              <section className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-150 dark:border-slate-800 pb-3">
                  <Banknote className="h-5 w-5 text-emerald-500" />
                  <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">{dict.drops}</h2>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-3.5 tracking-wider">{lang === "en" ? "Cash Breakdown (Quantities)" : "تفاصيل النقدية (العدد)"}</p>
                    
                    <div className="flex flex-col gap-3">
                      {[200, 100, 50, 20, 10, 5].map((bill) => (
                        <div key={bill} className="flex items-center justify-between gap-4">
                          <span className="w-16 text-sm font-bold text-slate-555 dark:text-slate-400 font-mono">x EGP {bill}</span>
                          <input 
                            type="number" inputMode="numeric" min="0"
                            value={denominations[String(bill) as keyof typeof denominations]} 
                            onChange={(e) => setDenominations({...denominations, [String(bill)]: e.target.value})}
                            className="w-full p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-emerald-600 dark:text-emerald-400 text-right text-base sm:text-lg font-bold transition-all"
                            placeholder="0"
                          />
                        </div>
                      ))}
                      
                      <div className="flex items-center justify-between gap-4 mt-2 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                        <span className="w-16 text-sm font-bold text-slate-555 dark:text-slate-400 font-mono">{lang === "en" ? "Coins" : "قروش/فكة"}</span>
                        <input 
                          type="number" inputMode="decimal" min="0" step="0.01"
                          value={denominations['coins']} 
                          onChange={(e) => setDenominations({...denominations, 'coins': e.target.value})}
                          className="w-full p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-emerald-600 dark:text-emerald-400 text-right text-base sm:text-lg font-bold transition-all"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                    <span className="font-bold text-sm text-emerald-800 dark:text-emerald-450 uppercase">{lang === "en" ? "Total Cash" : "إجمالي النقدية"}</span>
                    <span className="font-black text-xl text-emerald-600 dark:text-emerald-450 font-mono">EGP {calculateTotalCash().toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">{dict.totalVisa}</label>
                    <div className="relative">
                      <span className={`absolute ${lang === "ar" ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs sm:text-sm`}>EGP</span>
                      <input required type="number" inputMode="decimal" min="0" step="0.01" value={visa} onChange={(e) => setVisa(e.target.value)} className={`w-full ${lang === "ar" ? "pr-14" : "pl-14"} p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-base sm:text-lg font-mono font-bold text-blue-600 dark:text-blue-450 transition-all`} placeholder="0.00" />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border-dashed">
                    <span className="text-xs sm:text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{dict.totalDrops}</span>
                    <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">EGP {calculateTotalMoney().toFixed(2)}</span>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Inventory & Signature */}
            <div className="space-y-6">
              
              {/* 3. Inventory Checks */}
              {cashierRole === 1 && (
                <section className="glass-panel p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-150 dark:border-slate-800 pb-3">
                    <Package className="h-5 w-5 text-orange-500" />
                    <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">{dict.inventory}</h2>
                  </div>
                  
                  {/* Cigarettes */}
                  <div className="space-y-2.5 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 animate-in fade-in">
                    <h3 className="font-bold text-slate-700 dark:text-slate-350 border-b border-slate-200 dark:border-slate-800 pb-2 uppercase tracking-widest text-[10px]">{dict.cigarettes}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[8px] sm:text-[9px] font-bold text-slate-450 dark:text-slate-500 uppercase mb-1">{dict.start}</label>
                        <input required type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={cigarettes.start} onChange={(e) => setCigarettes({ ...cigarettes, start: e.target.value })} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-orange-500 text-center font-mono text-xs sm:text-sm font-bold" />
                      </div>
                      <div>
                        <label className="block text-[8px] sm:text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase mb-1 text-emerald-500">{dict.delivery}</label>
                        <input required type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={cigarettes.delivery} onChange={(e) => setCigarettes({ ...cigarettes, delivery: e.target.value })} className="w-full p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 outline-none focus:ring-2 focus:ring-emerald-500 text-center font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-450" />
                      </div>
                      <div>
                        <label className="block text-[8px] sm:text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase mb-1 text-red-500">{dict.end}</label>
                        <input required type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={cigarettes.end} onChange={(e) => setCigarettes({ ...cigarettes, end: e.target.value })} className="w-full p-2 rounded-lg border border-red-500/20 bg-red-500/5 outline-none focus:ring-2 focus:ring-red-500 text-center font-mono text-xs sm:text-sm font-bold text-red-600 dark:text-red-450" />
                      </div>
                      <div className="bg-slate-900 rounded-lg p-1.5 text-center border border-slate-800 flex flex-col justify-center">
                        <label className="block text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase mb-0.5">{dict.soldPacks}</label>
                        <span className="font-black text-white text-xs sm:text-sm font-mono leading-none">{calculateSold(cigarettes.start, cigarettes.delivery, cigarettes.end)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Lighters */}
                  <div className="space-y-2.5 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 animate-in fade-in">
                    <h3 className="font-bold text-slate-700 dark:text-slate-350 border-b border-slate-200 dark:border-slate-800 pb-2 uppercase tracking-widest text-[10px]">{dict.lighters}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[8px] sm:text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase mb-1">{dict.start}</label>
                        <input required type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={lighters.start} onChange={(e) => setLighters({ ...lighters, start: e.target.value })} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-orange-500 text-center font-mono text-xs sm:text-sm font-bold" />
                      </div>
                      <div>
                        <label className="block text-[8px] sm:text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase mb-1 text-emerald-500">{dict.delivery}</label>
                        <input required type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={lighters.delivery} onChange={(e) => setLighters({ ...lighters, delivery: e.target.value })} className="w-full p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 outline-none focus:ring-2 focus:ring-emerald-500 text-center font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-455" />
                      </div>
                      <div>
                        <label className="block text-[8px] sm:text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase mb-1 text-red-500">{dict.end}</label>
                        <input required type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={lighters.end} onChange={(e) => setLighters({ ...lighters, end: e.target.value })} className="w-full p-2 rounded-lg border border-red-500/20 bg-red-500/5 outline-none focus:ring-2 focus:ring-red-500 text-center font-mono text-xs sm:text-sm font-bold text-red-600 dark:text-red-455" />
                      </div>
                      <div className="bg-slate-900 rounded-lg p-1.5 text-center border border-slate-800 flex flex-col justify-center">
                        <label className="block text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase mb-0.5">{dict.soldUnits}</label>
                        <span className="font-black text-white text-xs sm:text-sm font-mono leading-none">{calculateSold(lighters.start, lighters.delivery, lighters.end)}</span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Signature Capture */}
              <section className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-150 dark:border-slate-800 pb-3">
                  <UserIcon className="h-5 w-5 text-red-500" />
                  <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">{dict.signYourReport}</h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{dict.signBelow}</p>
                <SignaturePad 
                  dict={dict} 
                  onSave={(data) => setCashierSignature(data)} 
                  onClear={() => setCashierSignature("")} 
                />
                <input type="text" value={cashierSignature} readOnly className="h-0 w-0 opacity-0 absolute pointer-events-none" tabIndex={-1} />
              </section>
            </div>
          </div>

          {/* Footer inside the form to allow submit trigger */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div className="hidden sm:block">
                <p className="text-[10px] uppercase font-bold text-slate-450 tracking-wider leading-none">{lang === "en" ? "Ready Status" : "حالة التقرير"}</p>
                <p className="text-xs font-bold text-emerald-650 dark:text-emerald-450 mt-1 flex items-center gap-1">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" /> {lang === "en" ? "Ready to Submit" : "جاهز للإرسال"}
                </p>
              </div>
              
              <button type="submit" disabled={loading} className="w-full sm:w-auto px-8 py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-base shadow-lg shadow-red-500/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer">
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    {existingReportId ? dict.resubmit : dict.submit}
                    <ArrowRight className={`h-4.5 w-4.5 ${lang === "ar" ? "rotate-180" : ""}`} />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
