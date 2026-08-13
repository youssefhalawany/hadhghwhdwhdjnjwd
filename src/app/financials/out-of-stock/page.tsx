"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, productsDb } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, orderBy, limit, doc, updateDoc, getDoc, setDoc
} from "firebase/firestore";
import { useLanguage } from "@/context/LanguageContext";
import { useBranch } from "@/context/BranchContext";
import { 
  PackageMinus, Hash, Search, Filter, Calendar as CalendarIcon, 
  MapPin, User as UserIcon, CheckCircle2, Clock, Upload, X, FileImage,
  Camera, Sparkles, Scan, ChevronRight, Check, AlertCircle, RefreshCw,
  Layers, ArrowLeft, ShieldCheck, Eye, Trash2, ArrowUpRight, DollarSign,
  ScanLine, HelpCircle, CheckCheck, Maximize2, Tag, ShoppingBag, Store,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Barcode from "react-barcode";
import { playSuccessSound, playErrorSound, playPopSound } from "@/lib/sounds";

interface OutOfStockItem {
  barcode: string;
  name: string;
  missingQty: number;
  price?: number;
  unitPrice?: number;
  totalPrice?: number;
}

interface OutOfStockLog {
  id: string;
  code: string;
  items: OutOfStockItem[];
  totalMissingQuantity: number;
  totalValue?: number;
  cashierName: string;
  branchId: string;
  storeId?: string;
  timestamp: string;
  date?: string;
  resolved?: boolean;
  resolvedAt?: string;
  receiptUrl?: string;
  scannedAtPos?: string[]; // Array of barcodes scanned at POS
}

// Safe Barcode Component with high contrast for POS Hardware Scanners
function PosBarcodeViewer({ 
  value, 
  width = 2, 
  height = 65, 
  onExpand 
}: { 
  value: string; 
  width?: number; 
  height?: number;
  onExpand?: () => void;
}) {
  const [error, setError] = useState(false);

  if (!value) return null;

  return (
    <div className="relative group bg-white rounded-2xl p-3 border-2 border-slate-200 shadow-lg flex flex-col items-center justify-center select-none">
      {!error ? (
        <div className="overflow-x-auto max-w-full flex justify-center py-1">
          <Barcode
            value={value}
            width={width}
            height={height}
            fontSize={14}
            margin={6}
            background="#FFFFFF"
            lineColor="#000000"
            displayValue={true}
          />
        </div>
      ) : (
        <div className="font-mono text-base font-black text-slate-950 py-4 px-6 tracking-widest bg-amber-100 rounded-xl">
          {value}
        </div>
      )}

      {onExpand && (
        <button
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
          className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg opacity-80 group-hover:opacity-100 transition-opacity"
          title="Fullscreen Barcode"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function OutOfStockManagerPage() {
  const { language: lang } = useLanguage();
  const { currentBranch, availableBranches } = useBranch();
  const isRTL = lang === "ar";

  // Data State
  const [logs, setLogs] = useState<OutOfStockLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchCodeInput, setSearchCodeInput] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "resolved">("all");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");

  // Active Safe Record being processed
  const [activeLog, setActiveLog] = useState<OutOfStockLog | null>(null);

  // Prices cache from productsDb
  const [priceCache, setPriceCache] = useState<Record<string, number>>({});

  // Scanned / Verified items at POS
  const [scannedAtPosSet, setScannedAtPosSet] = useState<Set<string>>(new Set());

  // Fullscreen Barcode Zoom Modal
  const [zoomedBarcode, setZoomedBarcode] = useState<{ barcode: string; name: string; price?: number } | null>(null);

  // Receipt Upload State
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [viewReceiptModal, setViewReceiptModal] = useState<string | null>(null);

  // 1. Real-time Subscription to Out of Stock Logs
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "out_of_stock_logs"), orderBy("timestamp", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as OutOfStockLog));
      setLogs(data);
      setLoading(false);
    }, (e) => {
      console.error("Firestore OOS listener error:", e);
      toast.error(isRTL ? "فشل تحميل سجلات النواقص" : "Failed to load out of stock logs");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isRTL]);

  // Sync activeLog if updated in real-time
  useEffect(() => {
    if (activeLog) {
      const updated = logs.find(l => l.id === activeLog.id);
      if (updated) {
        setActiveLog(updated);
        setScannedAtPosSet(new Set(updated.scannedAtPos || []));
      }
    }
  }, [logs]);

  // Fetch missing item prices from productsDb
  useEffect(() => {
    if (!activeLog) return;

    const fetchPrices = async () => {
      const newPrices: Record<string, number> = { ...priceCache };
      let changed = false;

      for (const item of activeLog.items || []) {
        if (item.barcode && !newPrices[item.barcode]) {
          try {
            const snap = await getDoc(doc(productsDb, "products", item.barcode));
            if (snap.exists()) {
              const d = snap.data();
              const p = Number(d.currentPrice || d.price || d.salePrice || 0);
              if (p > 0) {
                newPrices[item.barcode] = p;
                changed = true;
              }
            }
          } catch (e) {}
        }
      }

      if (changed) {
        setPriceCache(newPrices);
      }
    };

    fetchPrices();
  }, [activeLog]);

  // Stats Calculations
  const stats = useMemo(() => {
    const totalPending = logs.filter(l => !l.resolved).length;
    const totalResolved = logs.filter(l => l.resolved).length;
    const totalMissingVal = logs.reduce((sum, l) => sum + (l.totalValue || 0), 0);
    const pendingVal = logs.filter(l => !l.resolved).reduce((sum, l) => sum + (l.totalValue || 0), 0);
    return { totalPending, totalResolved, totalMissingVal, pendingVal };
  }, [logs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const queryTrim = searchCodeInput.trim().toLowerCase();
      const matchesSearch = 
        !queryTrim || 
        (log.code || "").toLowerCase().includes(queryTrim) ||
        (log.cashierName || "").toLowerCase().includes(queryTrim) ||
        (log.items || []).some(item => 
          (item.name || "").toLowerCase().includes(queryTrim) ||
          (item.barcode || "").includes(queryTrim)
        );

      const resolvedBranch = log.branchId || "alamein4";
      const matchesBranch = currentBranch !== "all" 
        ? (resolvedBranch === currentBranch || (currentBranch === "alamein4" && resolvedBranch.includes("alamein")) || (currentBranch === "ola" && resolvedBranch.includes("ola")))
        : (selectedBranchFilter === "all" || resolvedBranch === selectedBranchFilter);

      if (filterStatus === "pending" && log.resolved) return false;
      if (filterStatus === "resolved" && !log.resolved) return false;

      return matchesSearch && matchesBranch;
    });
  }, [logs, searchCodeInput, filterStatus, selectedBranchFilter, currentBranch]);

  // Open Log for POS Scanning & Verification
  const handleOpenLog = (log: OutOfStockLog) => {
    playPopSound();
    setActiveLog(log);
    setScannedAtPosSet(new Set(log.scannedAtPos || []));
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  // Toggle Scanned State for an item
  const toggleScannedAtPos = async (barcode: string) => {
    if (!activeLog) return;
    playSuccessSound();
    const updatedSet = new Set(scannedAtPosSet);
    if (updatedSet.has(barcode)) {
      updatedSet.delete(barcode);
    } else {
      updatedSet.add(barcode);
    }
    setScannedAtPosSet(updatedSet);

    try {
      await updateDoc(doc(db, "out_of_stock_logs", activeLog.id), {
        scannedAtPos: Array.from(updatedSet)
      });
    } catch (err) {}
  };

  // Handle Receipt Image Selection & Compression
  const handleReceiptChange = (file: File | null) => {
    if (!file) {
      setReceiptFile(null);
      setReceiptPreview(null);
      return;
    }
    setReceiptFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setReceiptPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Final Settlement / Resolution
  const handleResolveRecord = async () => {
    if (!activeLog) return;

    if (!activeLog.resolved && !receiptFile && !activeLog.receiptUrl) {
      toast.error(isRTL ? "يرجى التقاط صورة إيصال الكاشير / الفاتورة أولاً" : "Please attach the POS receipt image first!");
      return;
    }

    setUploadingReceipt(true);
    try {
      let finalReceiptUrl = activeLog.receiptUrl || "";

      if (receiptFile) {
        // Compress to clean web base64
        const compressedBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(receiptFile);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const MAX_WIDTH = 1280;
              const MAX_HEIGHT = 1600;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", 0.7));
              } else {
                resolve(event.target?.result as string);
              }
            };
            img.onerror = (err) => reject(err);
          };
          reader.onerror = (err) => reject(err);
        });

        finalReceiptUrl = compressedBase64;
      }

      const isNowResolved = !activeLog.resolved;

      await updateDoc(doc(db, "out_of_stock_logs", activeLog.id), {
        resolved: isNowResolved,
        receiptUrl: isNowResolved ? finalReceiptUrl : activeLog.receiptUrl || null,
        resolvedAt: isNowResolved ? new Date().toISOString() : null,
        scannedAtPos: Array.from(scannedAtPosSet)
      });

      playSuccessSound();
      toast.success(
        isNowResolved 
          ? (isRTL ? `تمت تسوية الكود #${activeLog.code} ورفع الإيصال بنجاح! 🎉` : `Code #${activeLog.code} settled & POS receipt uploaded! 🎉`)
          : (isRTL ? "تمت إعادة السجل إلى قيد المراجعة" : "Record marked back as pending.")
      );

      setActiveLog(null);
    } catch (err: any) {
      console.error("Resolve error:", err);
      playErrorSound();
      toast.error(err.message || "Failed to resolve record");
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Helper to calculate item price
  const getItemPrice = (item: OutOfStockItem) => {
    if (item.price && item.price > 0) return item.price;
    if (item.unitPrice && item.unitPrice > 0) return item.unitPrice;
    if (priceCache[item.barcode]) return priceCache[item.barcode];
    return null;
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 pb-32 max-w-7xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      
      {/* 1. Header Bar */}
      <div className="sticky top-0 z-30 bg-[#070B14]/90 backdrop-blur-2xl border-b border-slate-800/80 px-4 py-4 md:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-rose-500/20 border border-amber-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.2)]">
              <ScanLine className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  {isRTL ? "شاشة مسح باركود النواقص (POS Scanner)" : "Out of Stock POS Barcode Screen"}
                </h1>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  POS Ready 🎯
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {isRTL ? "اعرض الباركود عالي الوضوح لمسحه بجهاز الباركود في الكاشير مع الأسعار والتسوية" : "Display crystal-clear barcodes with prices for handheld POS scanners"}
              </p>
            </div>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isRTL ? "أكواد معلقة" : "Pending Slips"}</p>
              <p className="text-xl font-black text-amber-400 mt-0.5">{stats.totalPending}</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isRTL ? "إجمالي القيمة" : "Total Value"}</p>
              <p className="text-xl font-black text-rose-400 mt-0.5">EGP {stats.pendingVal.toFixed(0)}</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isRTL ? "تمت التسوية" : "Settled"}</p>
              <p className="text-xl font-black text-emerald-400 mt-0.5">{stats.totalResolved}</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isRTL ? "إجمالي السجلات" : "Total Slips"}</p>
              <p className="text-xl font-black text-cyan-400 mt-0.5">{logs.length}</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-6">
        
        {/* 2. Safe Code Quick Finder & Chips */}
        <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/90 border border-amber-500/20 rounded-3xl p-4 md:p-6 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="font-bold text-sm text-slate-200">
                {isRTL ? "أدخل رقم كود الخزينة (المكتوب على الورقة):" : "Search Safe Slip Code (e.g. 4821):"}
              </span>
            </div>
            
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 self-stretch sm:self-auto justify-center">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === "all" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"}`}
              >
                {isRTL ? "الكل" : "All"} ({logs.length})
              </button>
              <button
                onClick={() => setFilterStatus("pending")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === "pending" ? "bg-rose-500 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
              >
                {isRTL ? "معلق" : "Pending"} ({stats.totalPending})
              </button>
              <button
                onClick={() => setFilterStatus("resolved")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === "resolved" ? "bg-emerald-500 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
              >
                {isRTL ? "تمت التسوية" : "Settled"} ({stats.totalResolved})
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-amber-400 font-mono font-bold text-lg pointer-events-none">
                #
              </div>
              <input
                type="text"
                placeholder={isRTL ? "اكتب رقم الكود المكون من 4 أرقام أو اسم الصنف..." : "Type 4-digit code (e.g. 4821) or product name..."}
                value={searchCodeInput}
                onChange={e => setSearchCodeInput(e.target.value)}
                className="w-full bg-slate-950/90 border border-amber-500/30 rounded-2xl py-3.5 pl-10 pr-4 text-white font-mono text-base tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
              {searchCodeInput && (
                <button
                  onClick={() => setSearchCodeInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {currentBranch === "all" && (
              <select
                value={selectedBranchFilter}
                onChange={e => setSelectedBranchFilter(e.target.value)}
                className="bg-slate-950/90 border border-slate-800 text-slate-300 rounded-2xl px-4 py-3 text-xs font-bold outline-none cursor-pointer"
              >
                <option value="all">{isRTL ? "جميع الفروع" : "All Branches"}</option>
                {availableBranches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Quick Pending Code Pills */}
          {logs.filter(l => !l.resolved).length > 0 && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                {isRTL ? "الأكواد المعلقة:" : "Pending Slips:"}
              </span>
              {logs.filter(l => !l.resolved).slice(0, 8).map(l => (
                <button
                  key={l.id}
                  onClick={() => handleOpenLog(l)}
                  className="shrink-0 px-3 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <span>#{l.code}</span>
                  <span className="text-[10px] text-slate-400">({l.items?.length || 0})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Slips Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 rounded-3xl bg-slate-900/40 border border-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-3 text-slate-500">
              <PackageMinus className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-200 mb-1">
              {isRTL ? "لا توجد سجلات نواقص مطابقة" : "No Out of Stock records found"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {isRTL 
                ? "تأكد من كتابة كود الخزينة بشكل صحيح." 
                : "Double check the safe code entered in the search bar."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLogs.map(log => {
              const scannedCount = (log.scannedAtPos || []).length;
              const totalItemsCount = (log.items || []).length;

              return (
                <motion.div
                  key={log.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`group relative rounded-3xl p-5 border transition-all duration-200 ${
                    log.resolved
                      ? "bg-slate-900/60 border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_8px_30px_rgba(16,185,129,0.08)]"
                      : "bg-slate-900/80 border-amber-500/30 hover:border-amber-500/60 shadow-[0_8px_30px_rgba(245,158,11,0.08)]"
                  }`}
                >
                  {/* Card Top */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-mono font-black border transition-all ${
                        log.resolved
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                      }`}>
                        <span className="text-[9px] uppercase tracking-widest text-slate-400 font-sans font-bold -mb-1">
                          Code
                        </span>
                        <span className="text-xl tracking-wider">
                          #{log.code || log.id.slice(0, 4)}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{log.cashierName || "Cashier"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1 font-mono">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span className="capitalize">{log.branchId === "alamein4" || log.branchId === "eL-alamein-4" ? "El Alamein 4" : log.branchId || "Branch"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 border ${
                      log.resolved
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    }`}>
                      {log.resolved ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isRTL ? "تمت التسوية" : "Settled"}</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>{isRTL ? "في الانتظار" : "Pending Safe"}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Items List Preview */}
                  <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800 space-y-2 mb-4">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>{isRTL ? "الأصناف المطلوبة" : "Items"} ({totalItemsCount})</span>
                      {log.totalValue !== undefined && log.totalValue > 0 && (
                        <span className="text-amber-400 font-mono">EGP {log.totalValue.toFixed(2)}</span>
                      )}
                    </div>

                    <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                      {(log.items || []).slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/50 last:border-0">
                          <span className="text-slate-300 font-medium truncate max-w-[170px]">{item.name || item.barcode}</span>
                          <span className="text-[11px] font-mono text-slate-400">x{item.missingQty}</span>
                        </div>
                      ))}
                      {(log.items || []).length > 3 && (
                        <p className="text-[10px] text-slate-500 italic text-center pt-1">
                          +{ (log.items || []).length - 3 } {isRTL ? "أصناف إضافية..." : "more items..."}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Button: Open POS Scan Screen */}
                  <button
                    onClick={() => handleOpenLog(log)}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      log.resolved
                        ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                        : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md font-black"
                    }`}
                  >
                    <ScanLine className="w-4 h-4" />
                    <span>{isRTL ? "عرض الباركود والأسعار لمسح POS" : "Open Barcodes & Prices for POS"}</span>
                    <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. POS Barcode Display & Settlement Drawer Modal */}
      <AnimatePresence>
        {activeLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0D1322] border border-slate-800 rounded-[2rem] w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
            >
              {/* Drawer Header */}
              <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex flex-col items-center justify-center font-mono font-black text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                    <span className="text-[9px] uppercase font-sans font-bold text-slate-400 -mb-1">Safe Code</span>
                    <span className="text-xl">#{activeLog.code}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-white">
                        {isRTL ? `باركودات الكود #${activeLog.code} لمسح الكاشير` : `POS Scan Screen - Code #${activeLog.code}`}
                      </h2>
                      {activeLog.resolved && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                          {isRTL ? "تمت التسوية" : "Settled"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isRTL ? `الكاشير: ${activeLog.cashierName} • التاريخ: ${activeLog.timestamp ? new Date(activeLog.timestamp).toLocaleDateString() : ""}` : `Cashier: ${activeLog.cashierName} • Date: ${activeLog.timestamp ? new Date(activeLog.timestamp).toLocaleDateString() : ""}`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveLog(null)}
                  className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                
                {/* POS Instruction Banner */}
                <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-transparent border border-cyan-500/30 rounded-2xl p-4 flex items-center gap-3 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
                    <ScanLine className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-cyan-300">
                      {isRTL ? "امسح الباركودات المعروضة بالأسفل مباشرة باستخدام جهاز الباركود للكاشير (POS Gun):" : "Aim your POS Barcode Scanner Gun directly at each barcode below on your screen:"}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isRTL ? "تم تحسين وضوح وتباين الخطوط لتسهيل المسح الفوري وتوضيح سعر كل منتج." : "High-contrast pure-white barcode cards with live pricing for fast optical scanning."}
                    </p>
                  </div>
                </div>

                {/* Items & High-Contrast Barcodes */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <span>{isRTL ? "قائمة الأصناف والباركود" : "Items & Barcodes to Scan"} ({(activeLog.items || []).length})</span>
                    <span className="text-amber-400 font-mono">
                      {scannedAtPosSet.size} / {(activeLog.items || []).length} {isRTL ? "تم المسح بالـ POS" : "Scanned in POS"}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {(activeLog.items || []).map((item, idx) => {
                      const isScanned = scannedAtPosSet.has(item.barcode);
                      const unitPrice = getItemPrice(item);
                      const totalPrice = unitPrice ? unitPrice * (item.missingQty || 1) : null;

                      return (
                        <div
                          key={idx}
                          className={`p-4 sm:p-5 rounded-3xl border transition-all ${
                            isScanned
                              ? "bg-slate-900/90 border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.12)]"
                              : "bg-slate-900/90 border-slate-800 shadow-xl"
                          }`}
                        >
                          {/* Item Details Header */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-xl bg-slate-800 text-slate-300 font-mono font-bold text-xs flex items-center justify-center">
                                #{idx + 1}
                              </span>
                              <div>
                                <h4 className="text-sm font-bold text-white leading-tight">
                                  {item.name || "Product"}
                                </h4>
                                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                                  Code: {item.barcode}
                                </p>
                              </div>
                            </div>

                            {/* Price Badges */}
                            <div className="flex items-center gap-2">
                              {unitPrice !== null ? (
                                <div className="text-right bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
                                  <span className="text-[9px] text-emerald-400 font-bold uppercase block">{isRTL ? "سعر القطعة" : "Unit Price"}</span>
                                  <span className="text-sm font-black text-emerald-300 font-mono">EGP {unitPrice.toFixed(2)}</span>
                                </div>
                              ) : (
                                <div className="text-right bg-slate-800 px-3 py-1 rounded-xl">
                                  <span className="text-[9px] text-slate-400 font-bold uppercase block">{isRTL ? "السعر" : "Price"}</span>
                                  <span className="text-xs font-bold text-slate-300">Catalog</span>
                                </div>
                              )}

                              <div className="text-right bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
                                <span className="text-[9px] text-amber-400 font-bold uppercase block">{isRTL ? "الكمية" : "Qty"}</span>
                                <span className="text-sm font-black text-amber-300 font-mono">x{item.missingQty}</span>
                              </div>
                            </div>
                          </div>

                          {/* Total Value calculation if available */}
                          {totalPrice !== null && (
                            <div className="flex items-center justify-between text-xs py-1.5 px-3 mb-3 bg-slate-950/60 rounded-xl border border-slate-800/60 font-mono text-slate-300">
                              <span>{isRTL ? "إجمالي هذا الصنف:" : "Item Total Value:"}</span>
                              <span className="font-bold text-emerald-400">EGP {totalPrice.toFixed(2)}</span>
                            </div>
                          )}

                          {/* Crystal-Clear Barcode for Hardware Scanner */}
                          <div className="my-2">
                            <PosBarcodeViewer
                              value={item.barcode}
                              width={2}
                              height={60}
                              onExpand={() => setZoomedBarcode({ barcode: item.barcode, name: item.name, price: unitPrice || undefined })}
                            />
                          </div>

                          {/* Action Checklist Bar */}
                          <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-800">
                            <button
                              onClick={() => toggleScannedAtPos(item.barcode)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                                isScanned
                                  ? "bg-emerald-500 text-slate-950 font-black shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                              }`}
                            >
                              <Check className={`w-4 h-4 ${isScanned ? "stroke-[3]" : ""}`} />
                              <span>{isScanned ? (isRTL ? "تم المسح في الـ POS ✅" : "Scanned in POS ✅") : (isRTL ? "تحديد كـ تم المسح في الـ POS" : "Mark as Scanned in POS")}</span>
                            </button>

                            <button
                              onClick={() => setZoomedBarcode({ barcode: item.barcode, name: item.name, price: unitPrice || undefined })}
                              className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 p-2"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                              <span>{isRTL ? "تكبير الباركود" : "Zoom Barcode"}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Upload POS Receipt Section */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <FileImage className="w-4 h-4 text-amber-400" />
                      {isRTL ? "رفع إيصال الكاشير / الفاتورة المستخرجة" : "Attach Printed POS Receipt Photo"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isRTL ? "بعد مسح الأصناف في الكاشير، التقط صورة لإيصال الـ POS لإتمام وإغلاق كود الخزينة" : "After scanning items into POS, snap a photo of the POS printed receipt to settle the safe code"}
                    </p>
                  </div>

                  {/* Existing Receipt Preview */}
                  {activeLog.receiptUrl && !receiptPreview && (
                    <div className="rounded-2xl overflow-hidden border border-emerald-500/30 bg-slate-900 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img 
                          src={activeLog.receiptUrl} 
                          alt="Receipt" 
                          className="w-16 h-16 object-cover rounded-xl border border-slate-700 cursor-pointer"
                          onClick={() => setViewReceiptModal(activeLog.receiptUrl || null)}
                        />
                        <div>
                          <p className="text-xs font-bold text-emerald-400">{isRTL ? "إيصال التسوية مرفق ✅" : "Settlement receipt attached ✅"}</p>
                          <button
                            onClick={() => setViewReceiptModal(activeLog.receiptUrl || null)}
                            className="text-xs text-cyan-400 underline font-semibold mt-1"
                          >
                            {isRTL ? "عرض الصورة كاملة" : "View full size"}
                          </button>
                        </div>
                      </div>

                      <label className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold cursor-pointer transition-colors border border-slate-700">
                        {isRTL ? "تغيير الصورة" : "Replace Photo"}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={e => handleReceiptChange(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {/* Upload Box */}
                  {(!activeLog.receiptUrl || receiptPreview) && (
                    <div className="relative border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-2xl p-6 text-center transition-all bg-slate-900/40">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={e => handleReceiptChange(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />

                      {receiptPreview ? (
                        <div className="flex flex-col items-center gap-3">
                          <img 
                            src={receiptPreview} 
                            alt="Receipt Preview" 
                            className="w-28 h-28 object-cover rounded-2xl border-2 border-emerald-400 shadow-xl"
                          />
                          <div>
                            <p className="text-xs font-bold text-emerald-400">{isRTL ? "تم التقاط صورة الإيصال! 📸" : "Receipt photo ready! 📸"}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{receiptFile?.name}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                            <Camera className="w-6 h-6" />
                          </div>
                          <p className="text-xs font-bold text-slate-200">
                            {isRTL ? "اضغط هنا لالتقاط صورة إيصال الكاشير بكاميرا الهاتف" : "Tap here to snap POS printed receipt with camera"}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {isRTL ? "أو اختيار صورة من المعرض" : "Or choose an existing image file"}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Drawer Actions */}
              <div className="p-4 sm:p-6 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <button
                  onClick={() => setActiveLog(null)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {isRTL ? "إغلاق" : "Close"}
                </button>

                <button
                  onClick={handleResolveRecord}
                  disabled={uploadingReceipt}
                  className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                    activeLog.resolved
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                      : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.3)]"
                  }`}
                >
                  {uploadingReceipt ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isRTL ? "جاري الحفظ والتسوية..." : "Saving & Settling..."}</span>
                    </>
                  ) : activeLog.resolved ? (
                    <>
                      <X className="w-4 h-4" />
                      <span>{isRTL ? "إلغاء التسوية (إرجاع لمعلق)" : "Mark Back as Pending"}</span>
                    </>
                  ) : (
                    <>
                      <CheckCheck className="w-5 h-5" />
                      <span>{isRTL ? "اعتماد التسوية وإغلاق كود الخزينة" : "Confirm Settlement & Close Safe Slip"}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Fullscreen Barcode Zoom Modal for POS Optical Laser Scanners */}
      <AnimatePresence>
        {zoomedBarcode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4"
            onClick={() => setZoomedBarcode(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-10 max-w-lg w-full text-slate-950 shadow-2xl flex flex-col items-center justify-center relative"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setZoomedBarcode(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                {isRTL ? "قارئ الباركود (POS Gun)" : "POS Laser Scanner Target"}
              </p>
              <h3 className="text-lg font-black text-center text-slate-900 mb-2 line-clamp-2 px-6">
                {zoomedBarcode.name}
              </h3>

              {zoomedBarcode.price !== undefined && (
                <div className="bg-emerald-500 text-white font-mono font-black text-sm px-4 py-1 rounded-full mb-4">
                  EGP {zoomedBarcode.price.toFixed(2)}
                </div>
              )}

              {/* Extra Wide High-Contrast Barcode */}
              <div className="py-4 px-2 w-full flex justify-center overflow-x-auto">
                <Barcode
                  value={zoomedBarcode.barcode}
                  width={2.6}
                  height={110}
                  fontSize={18}
                  margin={10}
                  background="#FFFFFF"
                  lineColor="#000000"
                  displayValue={true}
                />
              </div>

              <p className="text-xs font-bold text-slate-400 mt-3 text-center">
                {isRTL ? "وجّه ماسح الكاشير مباشرة نحو الشاشة لمسح الصنف" : "Hold barcode gun directly at the screen"}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. Receipt Lightbox Viewer */}
      <AnimatePresence>
        {viewReceiptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-lg p-4"
            onClick={() => setViewReceiptModal(null)}
          >
            <div className="relative max-w-3xl max-h-[90vh] w-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setViewReceiptModal(null)}
                className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={viewReceiptModal}
                alt="Receipt Full View"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-slate-700 shadow-2xl"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
