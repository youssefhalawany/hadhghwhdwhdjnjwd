"use client";

import React, { useState, useEffect } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useLanguage } from "@/context/LanguageContext";
import { useBranch } from "@/context/BranchContext";
import { 
  PackageMinus, Hash, Search, Filter, Calendar as CalendarIcon, 
  MapPin, User as UserIcon, CheckCircle2, Clock, Upload, X, FileImage
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Barcode from "react-barcode";
import { DrawerProfile } from "@/components/DrawerProfile";

export default function OutOfStockManagerPage() {
  const { language: lang } = useLanguage();
  const { currentBranch } = useBranch();
  const isRTL = lang === "ar";

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterResolved, setFilterResolved] = useState<"all" | "pending" | "resolved">("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  // Receipt Upload State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "out_of_stock_logs"), orderBy("timestamp", "desc"), limit(30));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(data);
      setLoading(false);
    }, (e) => {
      console.error(e);
      toast.error("Failed to load logs");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleResolveClick = (id: string, currentStatus: boolean) => {
    if (currentStatus) {
      // If already resolved, just unresolve it instantly
      toggleResolved(id, currentStatus);
    } else {
      // If resolving, require receipt upload
      setSelectedLogId(id);
      setReceiptFile(null);
      setUploadModalOpen(true);
    }
  };

  const handleUploadAndResolve = async () => {
    if (!selectedLogId) return;
    if (!receiptFile) {
      toast.error(isRTL ? "يرجى إرفاق صورة الإيصال أولاً" : "Please attach receipt image first");
      return;
    }

    setUploading(true);
    try {
      // Compress the image before uploading (same as Voids)
      const compressedDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(receiptFile);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
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
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.6));
            } else {
              resolve(event.target?.result as string);
            }
          };
          img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
      });

      // Save the compressed base64 string directly to Firestore (Super Fast, like Voids)
      const url = compressedDataUrl;

      // Update Firestore
      await updateDoc(doc(db, "out_of_stock_logs", selectedLogId), {
        resolved: true,
        receiptUrl: url,
        resolvedAt: new Date().toISOString()
      });

      setLogs(prev => prev.map(l => l.id === selectedLogId ? { ...l, resolved: true, receiptUrl: url } : l));
      toast.success(isRTL ? "تمت المراجعة ورفع الإيصال بنجاح" : "Resolved and receipt uploaded");
      setUploadModalOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to upload receipt and resolve");
    } finally {
      setUploading(false);
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

  const uniqueBranches = Array.from(new Set(logs.map(l => l.branchId).filter(Boolean)));

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.code || "").includes(searchTerm) || 
      (log.cashierName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.branchId || "").toLowerCase().includes(searchTerm.toLowerCase());
      
    const resolvedBranchId = log.branchId || "el-alamein-4";
    const matchesBranch = currentBranch !== "all" 
      ? resolvedBranchId === currentBranch 
      : (selectedBranch === "all" || resolvedBranchId === selectedBranch);

    if (filterResolved === "pending" && log.resolved) return false;
    if (filterResolved === "resolved" && !log.resolved) return false;

    return matchesSearch && matchesBranch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 relative pb-20" dir={isRTL ? "rtl" : "ltr"}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 -mx-4 px-4 sm:mx-0 sm:px-0 py-4 bg-[#050810]/80 backdrop-blur-xl border-b border-slate-800/50 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <PackageMinus className="w-8 h-8 text-rose-500" />
            {isRTL ? "مراجعة النواقص" : "Out of Stock Review"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
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
          {currentBranch === "all" && (
          <select 
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="w-full sm:w-auto px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none cursor-pointer"
          >
            <option value="all">{isRTL ? "جميع الفروع" : "All Branches"}</option>
            {uniqueBranches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          )}
          <select 
            value={filterResolved}
            onChange={e => setFilterResolved(e.target.value as any)}
            className="w-full sm:w-auto px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none cursor-pointer"
          >
            <option value="all">{isRTL ? "الكل" : "All Status"}</option>
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
              className={`bg-white/5 dark:bg-[#050810]/60 backdrop-blur-xl rounded-[2rem] overflow-hidden border ${log.resolved ? 'border-emerald-500/30 shadow-[0_8px_30px_rgba(16,185,129,0.12)]' : 'border-rose-500/30 shadow-[0_8px_30px_rgba(244,63,94,0.12)]'} transition-all hover:scale-[1.02]`}
            >
              {/* Header */}
              <div className={`p-5 border-b flex items-center justify-between ${log.resolved ? 'bg-gradient-to-r from-emerald-500/10 to-transparent border-emerald-500/10' : 'bg-gradient-to-r from-rose-500/10 to-transparent border-rose-500/10'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-sm border ${log.resolved ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/20 border-rose-500/30 text-rose-400'}`}>
                    {log.code || "---"}
                  </div>
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest ${log.resolved ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isRTL ? "كود الخزينة" : "Vault Code"}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric", hour12: true }) : log.date}
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 ${log.resolved ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.3)]'}`}>
                  {log.resolved ? (
                    <><CheckCircle2 size={14} /> {isRTL ? "تمت المراجعة" : "Resolved"}</>
                  ) : (
                    <><Clock size={14} /> {isRTL ? "قيد المراجعة" : "Pending"}</>
                  )}
                </div>
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

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {isRTL ? "الأصناف الناقصة" : "Missing Items"} ({log.totalMissingQuantity || 0})
                    </div>
                    {log.totalValue !== undefined && (
                      <div className="text-sm font-black text-white bg-slate-800 px-3 py-1 rounded-lg">
                        EGP {log.totalValue.toFixed(2)}
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => setSelectedLog(log)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold text-sm hover:bg-cyan-500/20 transition-all hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                  >
                    <Search size={16} />
                    {isRTL ? "عرض التفاصيل" : "Review Details"}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Selected Log Drawer Profile */}
      <DrawerProfile
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={isRTL ? `تفاصيل النواقص - ${selectedLog?.code}` : `Out of Stock Details - ${selectedLog?.code}`}
      >
        {selectedLog && (
          <div className="space-y-6 flex flex-col h-full">
            
            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  setSelectedLog(null);
                  handleResolveClick(selectedLog.id, selectedLog.resolved);
                }}
                className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-bold transition-all ${
                  selectedLog.resolved 
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                }`}
              >
                {selectedLog.resolved ? (
                  <><X size={16} /> {isRTL ? "إلغاء المراجعة" : "Mark as Pending"}</>
                ) : (
                  <><CheckCircle2 size={16} /> {isRTL ? "تأكيد المراجعة ورفع إيصال" : "Resolve & Upload Receipt"}</>
                )}
              </button>

              {selectedLog.receiptUrl && (
                <button 
                  onClick={() => setViewImage(selectedLog.receiptUrl)}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold text-sm hover:bg-blue-500/20 transition-all hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                >
                  <FileImage size={18} />
                  {isRTL ? "عرض الإيصال المرفق" : "View Uploaded Receipt"}
                </button>
              )}
            </div>

            {/* Items List */}
            <div className="flex-1 space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                {isRTL ? "الأصناف الناقصة" : "Missing Items"}
              </div>
              
              <div className="space-y-2">
                {(selectedLog.items || []).map((item: any, idx: number) => (
                  <div key={idx} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 flex justify-between items-center">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-sm font-bold text-white truncate mb-2">
                        {item.name || "Unknown Item"}
                      </div>
                      <div className="bg-white p-2 rounded-lg inline-block shadow-sm">
                        <Barcode 
                          value={item.barcode} 
                          width={1.5} 
                          height={40} 
                          fontSize={14}
                          background="#ffffff"
                          lineColor="#000000"
                          margin={0}
                        />
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase leading-none mb-1">
                        {isRTL ? "الكمية" : "Qty"}
                      </span>
                      <span className="text-xl font-black text-white leading-none">
                        {item.missingQty || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </DrawerProfile>

      {/* View Image Modal */}
      <AnimatePresence>
        {viewImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setViewImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-3xl max-h-[90vh] w-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setViewImage(null)}
                className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors bg-white/10 rounded-full p-2"
              >
                <X size={24} />
              </button>
              <img 
                src={viewImage} 
                alt="Receipt" 
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Receipt Modal */}
      <AnimatePresence>
        {uploadModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0f172a] border border-slate-800 rounded-[2rem] p-6 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black text-white">
                    {isRTL ? "رفع إيصال التسوية" : "Upload Receipt"}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {isRTL ? "يرجى إرفاق صورة الإيصال لإتمام المراجعة" : "Please attach receipt to resolve"}
                  </p>
                </div>
                <button onClick={() => setUploadModalOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer relative ${receiptFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 hover:bg-slate-800 hover:border-slate-600'}`}>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {receiptFile ? (
                    <div className="text-emerald-400 font-bold flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                        <CheckCircle2 size={32} />
                      </div>
                      <span className="truncate max-w-[200px]">{receiptFile.name}</span>
                    </div>
                  ) : (
                    <div className="text-slate-400 flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                        <Upload size={28} className="text-slate-300" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-300 block">{isRTL ? "اضغط لاختيار صورة" : "Tap to upload image"}</span>
                        <span className="text-xs mt-1 block">{isRTL ? "أو التقاط صورة بكاميرا الهاتف" : "Or capture with camera"}</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleUploadAndResolve}
                  disabled={!receiptFile || uploading}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-white font-black disabled:opacity-50 disabled:grayscale flex justify-center items-center gap-2 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  ) : (
                    <CheckCircle2 size={20} />
                  )}
                  {isRTL ? "تأكيد النواقص وحل المشكلة" : "Confirm & Resolve"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
