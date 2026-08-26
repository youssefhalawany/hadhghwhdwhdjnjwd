"use client";

import React, { useState, useRef } from "react";
import { 
  Upload, 
  Camera, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Package, 
  Plus, 
  Trash2, 
  FileText, 
  Building2, 
  Hash, 
  Clock, 
  RefreshCw, 
  ChevronRight, 
  Barcode as BarcodeIcon,
  ShieldCheck,
  Check,
  Zap
} from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";

interface ExtractedItem {
  id: string;
  itemName: string;
  barcode: string;
  quantity: number;
  unitPrice?: number;
  expiryDate: string;
}

interface Props {
  currentBranch: string;
  onBatchSaved: () => void;
}

export function POBatchIntake({ currentBranch, onBatchSaved }: Props) {
  const [poImage, setPoImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [batchId, setBatchId] = useState("");
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [masterExpiryDate, setMasterExpiryDate] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Generate a clean Batch ID
  const generateBatchId = (supplier: string) => {
    const cleanSupplier = (supplier || "SUPPLIER").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const rand = Math.floor(100 + Math.random() * 900);
    return `BATCH-${cleanSupplier}-${dateStr}-${rand}`;
  };

  // Convert File to Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPoImage(base64);
      processPOWithAI(base64);
    };
    reader.readAsDataURL(file);
  };

  // Call Gemini OCR API
  const processPOWithAI = async (base64Image: string) => {
    setIsScanning(true);
    toast.loading("جاري قراءة الفاتورة واستخراج الأصناف بالذكاء الاصطناعي...", { id: "po-scan" });

    try {
      const res = await fetch("/api/process-po", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "فشل في قراءة الفاتورة");
      }

      const extractedSupplier = data.companyName || "مورد عام";
      const extractedInvNum = data.invoiceNumber || data.poNumber || `PO-${Date.now().toString().slice(-6)}`;
      const extractedDate = data.date || new Date().toISOString().split("T")[0];

      setVendorName(extractedSupplier);
      setInvoiceNumber(extractedInvNum);
      setInvoiceDate(extractedDate);
      setBatchId(generateBatchId(extractedSupplier));

      // Default default expiry date: 60 days from now
      const defaultExp = new Date();
      defaultExp.setDate(defaultExp.getDate() + 60);
      const defaultExpStr = defaultExp.toISOString().split("T")[0];
      setMasterExpiryDate(defaultExpStr);

      // Parse items
      const rawItems = Array.isArray(data.items) ? data.items : [];
      const formattedItems: ExtractedItem[] = rawItems.map((item: any, idx: number) => ({
        id: `item-${Date.now()}-${idx}`,
        itemName: item.description || item.name || `صنف ${idx + 1}`,
        barcode: item.barcode || "N/A",
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitPrice: Number(item.unitPrice) || 0,
        expiryDate: defaultExpStr,
      }));

      if (formattedItems.length === 0) {
        // Add 1 blank item if none extracted
        formattedItems.push({
          id: `item-${Date.now()}-0`,
          itemName: "صنف مستلم",
          barcode: "N/A",
          quantity: 1,
          expiryDate: defaultExpStr,
        });
      }

      setItems(formattedItems);
      toast.success(`تم استخراج ${formattedItems.length} صنف بنجاح!`, { id: "po-scan" });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "حدث خطأ أثناء قراءة الفاتورة، يمكنك إدخال البيانات يدوياً", { id: "po-scan" });
      
      // Fallback manual defaults
      setVendorName("مورد عام");
      setBatchId(generateBatchId("GENERAL"));
      const defaultExp = new Date();
      defaultExp.setDate(defaultExp.getDate() + 60);
      const defaultExpStr = defaultExp.toISOString().split("T")[0];
      setMasterExpiryDate(defaultExpStr);
      setItems([{
        id: `item-${Date.now()}-0`,
        itemName: "",
        barcode: "",
        quantity: 1,
        expiryDate: defaultExpStr,
      }]);
    } finally {
      setIsScanning(false);
    }
  };

  // Apply quick expiry preset to all items
  const applyPresetToAll = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    const dateStr = target.toISOString().split("T")[0];
    setMasterExpiryDate(dateStr);
    setItems(prev => prev.map(item => ({ ...item, expiryDate: dateStr })));
    toast.success(`تم تعيين الصلاحية لجميع الأصناف (+${days} يوم)`);
  };

  // Update item field
  const updateItem = (id: string, field: keyof ExtractedItem, value: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // Add extra row
  const addItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length}`,
        itemName: "",
        barcode: "",
        quantity: 1,
        expiryDate: masterExpiryDate || new Date().toISOString().split("T")[0],
      }
    ]);
  };

  // Remove row
  const removeItem = (id: string) => {
    if (items.length <= 1) {
      toast.error("يجب وجود صنف واحد على الأقل في الدفعة");
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Save all items to Firestore `expiries` collection & batch log
  const handleSaveBatch = async () => {
    if (!vendorName.trim()) {
      toast.error("يرجى إدخال اسم المورد / الشركة");
      return;
    }
    if (items.length === 0) {
      toast.error("لا توجد أصناف لحفظها");
      return;
    }

    const invalidItem = items.find(i => !i.itemName.trim() || !i.expiryDate);
    if (invalidItem) {
      toast.error("يرجى التأكد من اسم الصنف وتاريخ الصلاحية لجميع الأصناف");
      return;
    }

    setIsSaving(true);
    const saveToast = toast.loading("جاري حفظ وتوثيق الدفعة في رادار الصلاحيات...");

    try {
      const branch = currentBranch === "all" ? "alamein4" : currentBranch;
      const normalizedStoreId = branch === "alamein4" ? "eL-alamein-4" : branch === "ola" ? "ola-el-koronfol" : branch;
      const savedUserStr = typeof window !== "undefined" ? localStorage.getItem("active_cashier_session") : null;
      let managerName = "المدير المسؤول";
      if (savedUserStr) {
        try {
          const u = JSON.parse(savedUserStr);
          managerName = u.displayName || u.name || u.email || managerName;
        } catch {}
      }

      const effectiveBatchId = batchId || generateBatchId(vendorName);
      const nowIso = new Date().toISOString();

      // 1. Batch Document Summary in `expiry_batches`
      const batchDocRef = await addDoc(collection(db, "expiry_batches"), {
        batchId: effectiveBatchId,
        supplier: vendorName,
        invoiceNumber: invoiceNumber || "N/A",
        invoiceDate: invoiceDate || nowIso.split("T")[0],
        totalItemsCount: items.length,
        totalQuantityCount: items.reduce((sum, i) => sum + i.quantity, 0),
        branchId: branch,
        storeId: normalizedStoreId,
        createdBy: managerName,
        createdAt: nowIso,
        poImageUrl: poImage ? "has_image" : null,
        status: "active"
      });

      // 2. Add each item to `expiries` collection
      const promises = items.map(item => {
        return addDoc(collection(db, "expiries"), {
          itemName: item.itemName.trim(),
          barcode: item.barcode?.trim() || "N/A",
          quantity: Number(item.quantity) || 1,
          initialQuantity: Number(item.quantity) || 1,
          soldQuantity: 0,
          unitPrice: Number(item.unitPrice) || 0,
          expiryDate: item.expiryDate,
          supplier: vendorName.trim(),
          batchId: effectiveBatchId,
          batchDocId: batchDocRef.id,
          invoiceNumber: invoiceNumber || "N/A",
          poDate: invoiceDate || nowIso.split("T")[0],
          branchId: branch,
          storeId: normalizedStoreId,
          status: "active", // active, near_expiry, expired, sold, pulled, pending_return
          createdBy: managerName,
          createdAt: nowIso,
          notes: `مستلم عبر فاتورة توريد: ${effectiveBatchId}`
        });
      });

      await Promise.all(promises);

      toast.success(`🎉 تم تسجيل الدفعة (${effectiveBatchId}) بنجاح وإضافتها لرادار الصلاحيات!`, { id: saveToast });
      
      // Reset form
      setPoImage(null);
      setItems([]);
      setVendorName("");
      setInvoiceNumber("");
      setBatchId("");
      
      // Notify parent to switch to active view
      onBatchSaved();
    } catch (err: any) {
      console.error("Save Batch Error:", err);
      toast.error(err.message || "حدث خطأ أثناء حفظ الدفعة", { id: saveToast });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Banner / Upload Zone */}
      {!poImage && (
        <div className="bg-[#0B1121] border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
              <Sparkles size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                استلام دفعة بضاعة جديدة بالذكاء الاصطناعي
              </h2>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">
                ارفع أو صور فاتورة استلام البضاعة (PO / Delivery Note)، وسيقوم الذكاء الاصطناعي باستخراج الأصناف والكميات فوراً لتحديد تواريخ الصلاحية وتفعيل التنبيهات الذكية قبل 15 يوماً.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Upload size={18} /> رفع صورة الفاتورة (PO)
              </button>

              <button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Camera size={18} /> التقاط صورة بالكاميرا
              </button>

              <button
                onClick={() => {
                  setPoImage("manual");
                  setVendorName("مورد عام");
                  setBatchId(generateBatchId("MANUAL"));
                  const d = new Date();
                  d.setDate(d.getDate() + 60);
                  const dStr = d.toISOString().split("T")[0];
                  setMasterExpiryDate(dStr);
                  setItems([{
                    id: `item-${Date.now()}-0`,
                    itemName: "",
                    barcode: "",
                    quantity: 1,
                    expiryDate: dStr,
                  }]);
                }}
                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-medium text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
              >
                <Plus size={16} /> إدخال يدوي بدون صورة
              </button>
            </div>

            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*,.pdf" 
              className="hidden" 
              onChange={handleFileChange} 
            />
            <input 
              ref={cameraInputRef} 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              onChange={handleFileChange} 
            />
          </div>
        </div>
      )}

      {/* AI Scanning Progress State */}
      {isScanning && (
        <div className="bg-[#0B1121] border border-indigo-500/30 rounded-3xl p-10 shadow-2xl text-center space-y-4 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <Loader2 size={32} className="animate-spin text-indigo-400" />
          </div>
          <h3 className="text-xl font-black text-white">جاري تحليل بيانات الفاتورة واستخراج الأصناف...</h3>
          <p className="text-sm text-slate-400">نستخدم محرك Vision فائق السرعة للتعرف على الأصناف والباركود والكميات.</p>
        </div>
      )}

      {/* Batch Form & Items Table */}
      {poImage && !isScanning && (
        <div className="space-y-6">
          {/* Header Metadata Card */}
          <div className="bg-[#0B1121] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  ⚡ توثيق استلام دفعة جديدة
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1.5 flex items-center gap-2">
                  <Package className="text-indigo-400" size={24} /> {batchId || "تفاصيل الدفعة"}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPoImage(null);
                    setItems([]);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
                >
                  إعادة مسح فاتورة أخرى
                </button>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 mb-1.5 block flex items-center gap-1">
                  <Building2 size={14} className="text-indigo-400" /> اسم المورد / الشركة:
                </label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => {
                    setVendorName(e.target.value);
                    setBatchId(generateBatchId(e.target.value));
                  }}
                  placeholder="مثال: إيديتا، بيبسي، جهينة..."
                  className="w-full bg-[#070C18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 mb-1.5 block flex items-center gap-1">
                  <FileText size={14} className="text-indigo-400" /> رقم الفاتورة / إذن الاستلام:
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="مثال: PO-98421"
                  className="w-full bg-[#070C18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 mb-1.5 block flex items-center gap-1">
                  <Calendar size={14} className="text-indigo-400" /> تاريخ التوريد والاستلام:
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full bg-[#070C18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 mb-1.5 block flex items-center gap-1">
                  <Hash size={14} className="text-indigo-400" /> كود الدفعة المرجعي:
                </label>
                <input
                  type="text"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="w-full bg-[#070C18] border border-indigo-500/30 rounded-xl px-3.5 py-2.5 text-xs text-indigo-300 font-mono font-black focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Quick Expiry Batch Presets */}
          <div className="bg-[#0B1121] border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-amber-400" />
              <span className="text-xs font-black text-slate-200">
                تعيين تاريخ صلاحية موحد لجميع الأصناف بضغطة واحدة:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => applyPresetToAll(15)}
                className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                +15 يوم
              </button>
              <button
                onClick={() => applyPresetToAll(30)}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                +30 يوم (شهر)
              </button>
              <button
                onClick={() => applyPresetToAll(60)}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                +60 يوم (شهرين)
              </button>
              <button
                onClick={() => applyPresetToAll(90)}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                +90 يوم (3 شهور)
              </button>
              <button
                onClick={() => applyPresetToAll(180)}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                +6 شهور
              </button>
              <button
                onClick={() => applyPresetToAll(365)}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                +سنة كاملة
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-[#0B1121] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Package size={20} className="text-indigo-400" /> أصناف الدفعة المستلمة ({items.length})
              </h3>

              <button
                onClick={addItem}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <Plus size={16} /> إضافة صنف إضافي
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-[#070C18] border-b border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="p-4">#</th>
                    <th className="p-4 min-w-[220px]">اسم الصنف / المنتج</th>
                    <th className="p-4 min-w-[140px]">الباركود</th>
                    <th className="p-4 min-w-[100px]">الكمية</th>
                    <th className="p-4 min-w-[170px]">تاريخ الصلاحية</th>
                    <th className="p-4 min-w-[120px]">حالة الرادار</th>
                    <th className="p-4 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((item, idx) => {
                    const daysRemaining = item.expiryDate ? Math.ceil((new Date(item.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    const is15DaysWarning = daysRemaining <= 15 && daysRemaining > 0;
                    const isExpired = daysRemaining <= 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-xs font-mono font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-4">
                          <input
                            type="text"
                            value={item.itemName}
                            onChange={(e) => updateItem(item.id, "itemName", e.target.value)}
                            placeholder="اسم الصنف..."
                            className="w-full bg-[#070C18] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-bold focus:border-indigo-500 outline-none"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="text"
                            value={item.barcode}
                            onChange={(e) => updateItem(item.id, "barcode", e.target.value)}
                            placeholder="الباركود..."
                            className="w-full bg-[#070C18] border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 font-bold focus:border-indigo-500 outline-none"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, "quantity", Math.max(1, Number(e.target.value) || 1))}
                            className="w-24 bg-[#070C18] border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white font-black text-center focus:border-indigo-500 outline-none"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="date"
                            value={item.expiryDate}
                            onChange={(e) => updateItem(item.id, "expiryDate", e.target.value)}
                            className="w-full bg-[#070C18] border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-indigo-300 font-bold focus:border-indigo-500 outline-none"
                          />
                        </td>
                        <td className="p-4">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              <AlertTriangle size={12} /> منتهي
                            </span>
                          ) : is15DaysWarning ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              <Clock size={12} /> إنذار 15 يوم ({daysRemaining} يوم)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <Check size={12} /> آمن ({daysRemaining} يوم)
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="حذف هذا الصنف"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-5 bg-[#070C18] border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400" />
                <span>
                  سيتم تسجيل <strong className="text-white">{items.length} صنف</strong> بإجمالي <strong className="text-white">{items.reduce((s, i) => s + i.quantity, 0)} قطعة</strong> تحت كود الدفعة <strong className="text-indigo-300 font-mono">{batchId}</strong>.
                </span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setPoImage(null);
                    setItems([]);
                  }}
                  disabled={isSaving}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  onClick={handleSaveBatch}
                  disabled={isSaving}
                  className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  حفظ واعتماد الدفعة في السيستم
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
