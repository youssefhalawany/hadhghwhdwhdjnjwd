"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, productsDb } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, orderBy, limit, doc, updateDoc, setDoc, deleteDoc, getDocs, where
} from "firebase/firestore";
import { useLanguage } from "@/context/LanguageContext";
import { useBranch } from "@/context/BranchContext";
import { 
  PackageMinus, Hash, Search, Filter, Calendar as CalendarIcon, 
  MapPin, User as UserIcon, CheckCircle2, Clock, Upload, X, FileImage,
  Camera, Sparkles, Scan, ChevronRight, Check, AlertCircle, RefreshCw,
  Layers, ArrowLeft, ShieldCheck, Eye, Trash2, ArrowUpRight, DollarSign,
  ScanLine, HelpCircle, CheckCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Barcode from "react-barcode";
import { CameraScanner } from "@/components/ui/CameraScanner";
import { playSuccessSound, playErrorSound, playPopSound } from "@/lib/sounds";

interface OutOfStockItem {
  barcode: string;
  name: string;
  missingQty: number;
  verified?: boolean;
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
  verifiedItems?: string[]; // Array of verified barcodes
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

  // Active Selected Log for In-Depth Verification & Resolution Modal/Drawer
  const [activeLog, setActiveLog] = useState<OutOfStockLog | null>(null);

  // Verification Item State for Active Log
  const [verifiedBarcodes, setVerifiedBarcodes] = useState<Set<string>>(new Set());
  const [scanningForLog, setScanningForLog] = useState(false);
  const [manualBarcodeInput, setManualBarcodeInput] = useState("");

  // Scanner Modals
  const [showGlobalCodeScanner, setShowGlobalCodeScanner] = useState(false);

  // Upload Receipt State
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [viewImageModal, setViewImageModal] = useState<string | null>(null);

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
        setVerifiedBarcodes(new Set(updated.verifiedItems || []));
      }
    }
  }, [logs]);

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
      const matchesSearch = 
        !searchCodeInput || 
        (log.code || "").includes(searchCodeInput.trim()) ||
        (log.cashierName || "").toLowerCase().includes(searchCodeInput.toLowerCase()) ||
        (log.items || []).some(item => 
          (item.name || "").toLowerCase().includes(searchCodeInput.toLowerCase()) ||
          (item.barcode || "").includes(searchCodeInput)
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

  // Handle Global Code Scan from Safe Slip
  const handleGlobalCodeScan = (scannedText: string) => {
    playPopSound();
    setShowGlobalCodeScanner(false);
    const clean = scannedText.trim();
    setSearchCodeInput(clean);

    // Auto open record if exact code matches
    const exactMatch = logs.find(l => l.code === clean || l.id === clean);
    if (exactMatch) {
      handleOpenLog(exactMatch);
      playSuccessSound();
      toast.success(isRTL ? `تم العثور على الكود #${clean}` : `Found record for Code #${clean}!`);
    } else {
      toast.info(isRTL ? `تم البحث بالكود: ${clean}` : `Filtered by scanned code: ${clean}`);
    }
  };

  // Open Log for Verification
  const handleOpenLog = (log: OutOfStockLog) => {
    playPopSound();
    setActiveLog(log);
    setVerifiedBarcodes(new Set(log.verifiedItems || []));
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  // Handle Item Scan inside Active Log Verification
  const handleItemScan = async (barcode: string) => {
    if (!activeLog) return;
    const cleanBarcode = barcode.trim();
    setManualBarcodeInput("");
    setScanningForLog(false);

    // Check if item exists in this log
    const matchedItem = (activeLog.items || []).find(item => item.barcode === cleanBarcode);

    if (matchedItem) {
      playSuccessSound();
      const updatedSet = new Set(verifiedBarcodes);
      updatedSet.add(cleanBarcode);
      setVerifiedBarcodes(updatedSet);

      // Save verified progress to Firestore
      try {
        await updateDoc(doc(db, "out_of_stock_logs", activeLog.id), {
          verifiedItems: Array.from(updatedSet)
        });
        toast.success(isRTL ? `تم التحقق من: ${matchedItem.name}` : `Verified item: ${matchedItem.name} ✅`);
      } catch (err) {
        console.warn("Save verified items error:", err);
      }
    } else {
      playErrorSound();
      toast.error(isRTL ? "هذا الباركود غير موجود في قائمة النواقص الحالية!" : "Barcode does not match any item in this record!");
    }
  };

  // Toggle Single Item Verified Status manually
  const toggleItemVerified = async (barcode: string) => {
    if (!activeLog) return;
    playPopSound();
    const updatedSet = new Set(verifiedBarcodes);
    if (updatedSet.has(barcode)) {
      updatedSet.delete(barcode);
    } else {
      updatedSet.add(barcode);
    }
    setVerifiedBarcodes(updatedSet);

    try {
      await updateDoc(doc(db, "out_of_stock_logs", activeLog.id), {
        verifiedItems: Array.from(updatedSet)
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
      toast.error(isRTL ? "يرجى التقاط صورة إيصال التسوية أولاً" : "Please attach the settlement receipt photo first!");
      return;
    }

    setUploadingReceipt(true);
    try {
      let finalReceiptUrl = activeLog.receiptUrl || "";

      if (receiptFile) {
        // Compress to high quality web base64
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
        verifiedItems: Array.from(verifiedBarcodes)
      });

      playSuccessSound();
      toast.success(
        isNowResolved 
          ? (isRTL ? `تمت تسوية الكود #${activeLog.code} ورفع الإيصال بنجاح! 🎉` : `Code #${activeLog.code} verified & receipt uploaded! 🎉`)
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

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 pb-32 max-w-7xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      
      {/* 1. Global Floating Barcode Scanner View */}
      {showGlobalCodeScanner && (
        <div className="fixed inset-0 z-[1000] bg-black">
          <CameraScanner onScan={handleGlobalCodeScan} onClose={() => setShowGlobalCodeScanner(false)} />
        </div>
      )}

      {/* 2. Log-Specific Item Barcode Scanner View */}
      {scanningForLog && (
        <div className="fixed inset-0 z-[1000] bg-black">
          <CameraScanner onScan={handleItemScan} onClose={() => setScanningForLog(false)} />
        </div>
      )}

      {/* 3. Hero App Bar */}
      <div className="sticky top-0 z-30 bg-[#070B14]/90 backdrop-blur-2xl border-b border-slate-800/80 px-4 py-4 md:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-rose-500/20 border border-amber-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.2)]">
              <PackageMinus className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  {isRTL ? "مراجعة وتسوية النواقص" : "Out of Stock Reconciler"}
                </h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Manager PWA
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {isRTL ? "مطابقة أرقام الخزينة، فحص الأصناف، ورفع إيصالات التوريد" : "Match safe slips, scan barcodes, and upload settlement receipts"}
              </p>
            </div>
          </div>

          {/* Quick Scan Slip Button */}
          <button
            onClick={() => { playPopSound(); setShowGlobalCodeScanner(true); }}
            className="w-full md:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(245,158,11,0.3)] active:scale-95 transition-all"
          >
            <Scan className="w-5 h-5" />
            {isRTL ? "مسح كود الخزينة (كاميرا)" : "Scan Safe Slip Code"}
          </button>
        </div>

        {/* Quick Stats Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isRTL ? "نواقص معلقة" : "Pending Safe"}</p>
              <p className="text-xl font-black text-amber-400 mt-0.5">{stats.totalPending}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isRTL ? "قيمة المعلق" : "Pending Value"}</p>
              <p className="text-xl font-black text-rose-400 mt-0.5">EGP {stats.pendingVal.toFixed(0)}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isRTL ? "تمت التسوية" : "Resolved"}</p>
              <p className="text-xl font-black text-emerald-400 mt-0.5">{stats.totalResolved}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isRTL ? "إجمالي السجلات" : "Total Logs"}</p>
              <p className="text-xl font-black text-cyan-400 mt-0.5">{logs.length}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-6">
        
        {/* 4. Safe Code Search Pinpad / Bar */}
        <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/90 border border-amber-500/20 rounded-3xl p-4 md:p-6 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="font-bold text-sm text-slate-200">
                {isRTL ? "ابحث برقم الكود المكتوب على ورقة الخزينة:" : "Enter safe slip code (e.g. 4821):"}
              </span>
            </div>
            
            {/* Filter Pills */}
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
                {isRTL ? "مكتمل" : "Resolved"} ({stats.totalResolved})
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
                placeholder={isRTL ? "اكتب كود الخزينة المكون من 4 أرقام (مثال 4821)..." : "Enter 4-digit code (e.g. 4821)..."}
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

            {/* Branch selector if global manager */}
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
        </div>

        {/* 5. Out of Stock Logs Grid / List */}
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
                ? "تأكد من كتابة الكود بشكل صحيح أو قم بمسح ورقة الخزينة باستخدام الكاميرا." 
                : "Double check the code entered or use the Camera Scanner to scan the safe slip barcode."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLogs.map(log => {
              const verifiedCount = (log.verifiedItems || []).length;
              const totalItemsCount = (log.items || []).length;
              const isAllVerified = totalItemsCount > 0 && verifiedCount >= totalItemsCount;

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
                  {/* Card Top Pill & Code */}
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
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse"
                    }`}>
                      {log.resolved ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isRTL ? "تمت التسوية" : "Resolved"}</span>
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
                      <span>{isRTL ? "الأصناف المسجلة" : "Reported Items"} ({totalItemsCount})</span>
                      {log.totalValue !== undefined && log.totalValue > 0 && (
                        <span className="text-amber-400 font-mono">EGP {log.totalValue.toFixed(2)}</span>
                      )}
                    </div>

                    <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                      {(log.items || []).slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/50 last:border-0">
                          <span className="text-slate-300 font-medium truncate max-w-[170px]">{item.name || item.barcode}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-400">x{item.missingQty}</span>
                            {(log.verifiedItems || []).includes(item.barcode) && (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                          </div>
                        </div>
                      ))}
                      {(log.items || []).length > 3 && (
                        <p className="text-[10px] text-slate-500 italic text-center pt-1">
                          +{ (log.items || []).length - 3 } {isRTL ? "أصناف إضافية..." : "more items..."}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleOpenLog(log)}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      log.resolved
                        ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                        : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md font-black"
                    }`}
                  >
                    <span>{log.resolved ? (isRTL ? "عرض تفاصيل التسوية" : "Review Settlement Details") : (isRTL ? "فحص الأصناف ورفع الإيصال" : "Verify Items & Upload Receipt")}</span>
                    <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Active Record Full-Screen Drawer Modal for Verification & Receipt Upload */}
      <AnimatePresence>
        {activeLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0D1322] border border-slate-800 rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Drawer Header */}
              <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-mono font-black text-amber-400 text-xl shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                    #{activeLog.code}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-white">
                        {isRTL ? `تسوية كود الخزينة #${activeLog.code}` : `Safe Slip Reconciliation #${activeLog.code}`}
                      </h2>
                      {activeLog.resolved && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                          {isRTL ? "تمت التسوية" : "Settled"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isRTL ? `مسجل بواسطة: ${activeLog.cashierName} • ${activeLog.timestamp ? new Date(activeLog.timestamp).toLocaleDateString() : ""}` : `Logged by: ${activeLog.cashierName} • ${activeLog.timestamp ? new Date(activeLog.timestamp).toLocaleDateString() : ""}`}
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

              {/* Drawer Scrollable Content */}
              <div className="p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                
                {/* Step 1: Barcode Verification Stage */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Scan className="w-4 h-4 text-cyan-400" />
                        {isRTL ? "1. فحص باركود الأصناف الناقصة" : "1. Scan & Verify Missing Items"}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isRTL ? "امسح باركود المنتج للتأكد من مطابقته مع ورقة الخزينة" : "Scan item barcode to verify match against safe slip"}
                      </p>
                    </div>

                    <button
                      onClick={() => { playPopSound(); setScanningForLog(true); }}
                      className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{isRTL ? "مسح بالكاميرا" : "Scan Item"}</span>
                    </button>
                  </div>

                  {/* Manual Barcode Input Fallback */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={isRTL ? "أو اكتب الباركود يدوياً واضغط تحقق..." : "Or type barcode and press verify..."}
                      value={manualBarcodeInput}
                      onChange={e => setManualBarcodeInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleItemScan(manualBarcodeInput)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={() => handleItemScan(manualBarcodeInput)}
                      disabled={!manualBarcodeInput}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl font-bold text-xs disabled:opacity-40 transition-colors"
                    >
                      {isRTL ? "تحقق" : "Verify"}
                    </button>
                  </div>

                  {/* Items List Checklist */}
                  <div className="space-y-2.5 pt-2">
                    {(activeLog.items || []).map((item, idx) => {
                      const isVerified = verifiedBarcodes.has(item.barcode);

                      return (
                        <div
                          key={idx}
                          onClick={() => toggleItemVerified(item.barcode)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isVerified
                              ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                              : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isVerified ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                            }`}>
                              {isVerified ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                            </div>

                            <div>
                              <p className={`text-xs font-bold ${isVerified ? "text-emerald-300" : "text-white"}`}>
                                {item.name || "Item"}
                              </p>
                              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                                Barcode: {item.barcode}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-slate-500 uppercase block">{isRTL ? "الكمية" : "Qty"}</span>
                              <span className="text-sm font-black text-white">{item.missingQty}</span>
                            </div>
                            
                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                              isVerified ? "border-emerald-500 bg-emerald-500 text-slate-950" : "border-slate-700 bg-slate-800 text-transparent"
                            }`}>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Upload Receipt & Settle Stage */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <FileImage className="w-4 h-4 text-amber-400" />
                        {isRTL ? "2. إرفاق صورة إيصال التسوية / الفاتورة" : "2. Attach Settlement Receipt / Voucher Photo"}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isRTL ? "التقط صورة واضحة للإيصال الموقع من الكاشير والخزينة" : "Take a clear picture of the signed cashier receipt"}
                      </p>
                    </div>
                  </div>

                  {/* Existing Receipt Preview */}
                  {activeLog.receiptUrl && !receiptPreview && (
                    <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30 bg-slate-900 p-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img 
                          src={activeLog.receiptUrl} 
                          alt="Receipt" 
                          className="w-14 h-14 object-cover rounded-xl border border-slate-700" 
                        />
                        <div>
                          <p className="text-xs font-bold text-emerald-400">{isRTL ? "تم إرفاق الإيصال مسبقاً ✅" : "Receipt attached ✅"}</p>
                          <button
                            onClick={() => setViewImageModal(activeLog.receiptUrl || null)}
                            className="text-[11px] text-cyan-400 underline font-semibold mt-0.5"
                          >
                            {isRTL ? "عرض الصورة بالحجم الكامل" : "View full size"}
                          </button>
                        </div>
                      </div>

                      <label className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold cursor-pointer transition-colors border border-slate-700">
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
                            className="w-24 h-24 object-cover rounded-2xl border-2 border-emerald-400 shadow-lg"
                          />
                          <div>
                            <p className="text-xs font-bold text-emerald-400">{isRTL ? "تم التقاط الصورة بنجاح! 📸" : "Receipt captured! 📸"}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{receiptFile?.name}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                            <Camera className="w-6 h-6" />
                          </div>
                          <p className="text-xs font-bold text-slate-200">
                            {isRTL ? "اضغط هنا لالتقاط صورة الإيصال بكاميرا الهاتف" : "Tap here to snap receipt with camera"}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {isRTL ? "أو قم باختيار ملف صورة من المعرض" : "Or select an image file from your device"}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Drawer Bottom Actions */}
              <div className="p-4 sm:p-6 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <button
                  onClick={() => setActiveLog(null)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {isRTL ? "إغلاق النافذة" : "Cancel & Close"}
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
                      <span>{isRTL ? "جاري الحفظ والرفع..." : "Uploading & Saving..."}</span>
                    </>
                  ) : activeLog.resolved ? (
                    <>
                      <X className="w-4 h-4" />
                      <span>{isRTL ? "إلغاء التسوية (إرجاع لمعلق)" : "Mark Back as Pending"}</span>
                    </>
                  ) : (
                    <>
                      <CheckCheck className="w-5 h-5" />
                      <span>{isRTL ? "اعتماد التسوية وحفظ الإيصال" : "Confirm Settlement & Save Receipt"}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. Image Lightbox Viewer */}
      <AnimatePresence>
        {viewImageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-lg p-4"
            onClick={() => setViewImageModal(null)}
          >
            <div className="relative max-w-3xl max-h-[90vh] w-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setViewImageModal(null)}
                className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={viewImageModal}
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
