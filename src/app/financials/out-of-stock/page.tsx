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

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "out_of_stock_logs"), orderBy("timestamp", "desc"), limit(300));
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
    <div className="max-w-7xl mx-auto space-y-6 relative" dir={isRTL ? "rtl" : "ltr"}>
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
                  onClick={() => handleResolveClick(log.id, log.resolved)}
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
                          <div className="mt-2 bg-white p-2 rounded-lg inline-block">
                            <Barcode 
                              value={item.barcode} 
                              width={1.5} 
                              height={30} 
                              fontSize={12}
                              background="#ffffff"
                              lineColor="#000000"
                              margin={0}
                            />
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
                  
                  {/* Receipt Link */}
                  {log.receiptUrl && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                      <button 
                        onClick={() => setViewImage(log.receiptUrl)}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        <FileImage size={16} />
                        {isRTL ? "عرض الإيصال المرفق" : "View Uploaded Receipt"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {uploadModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isRTL ? "إرفاق صورة الإيصال" : "Upload Receipt"}
                </h3>
                <button 
                  onClick={() => !uploading && setUploadModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  disabled={uploading}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {isRTL 
                      ? "لإتمام المراجعة، يرجى تصوير إيصال الدفع الخاص بهذه النواقص ورفعه هنا."
                      : "To mark this as resolved, please take a photo of the payment receipt and upload it."}
                  </p>
                </div>

                <div className="flex items-center justify-center w-full">
                  <label htmlFor="receipt-upload" className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer ${receiptFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {receiptFile ? (
                        <>
                          <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
                          <p className="mb-2 text-sm text-emerald-600 font-bold truncate max-w-[200px]">{receiptFile.name}</p>
                          <p className="text-xs text-emerald-500">{isRTL ? "تم اختيار الملف بنجاح" : "File selected successfully"}</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-slate-400 mb-3" />
                          <p className="mb-2 text-sm text-slate-600 dark:text-slate-300 font-bold">
                            {isRTL ? "اضغط هنا لاختيار صورة" : "Click to select image"}
                          </p>
                          <p className="text-xs text-slate-500">{isRTL ? "PNG, JPG حتى 5MB" : "PNG, JPG up to 5MB"}</p>
                        </>
                      )}
                    </div>
                    <input 
                      id="receipt-upload" 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setReceiptFile(e.target.files[0]);
                        }
                      }}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button 
                  onClick={() => setUploadModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  disabled={uploading}
                >
                  {isRTL ? "إلغاء" : "Cancel"}
                </button>
                <button 
                  onClick={handleUploadAndResolve}
                  disabled={!receiptFile || uploading}
                  className={`px-5 py-2.5 rounded-xl font-bold text-white flex items-center gap-2 transition-colors ${!receiptFile || uploading ? 'bg-emerald-300 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                >
                  {uploading ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> {isRTL ? "جاري الرفع..." : "Uploading..."}</>
                  ) : (
                    <><CheckCircle2 size={16} /> {isRTL ? "تأكيد الرفع" : "Upload & Resolve"}</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

    </div>
  );
}
