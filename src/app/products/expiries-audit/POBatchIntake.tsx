"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Zap,
  ClipboardPaste
} from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLanguage } from "@/context/LanguageContext";
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
  onBatchSaved: (savedBatchId?: string) => void;
}

export function POBatchIntake({ currentBranch, onBatchSaved }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";

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

  // Generate an enhanced Batch ID including Supplier, PO Number, Date, and Unique 3 digits
  const generateBatchId = (supplier: string, poNum?: string) => {
    const cleanSupplier = (supplier || "SUPP").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8) || "VENDOR";
    let cleanPO = (poNum || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (!cleanPO || cleanPO === "NA") {
      cleanPO = "PO" + Date.now().toString().slice(-4);
    } else {
      if (!cleanPO.startsWith("PO") && !cleanPO.startsWith("INV")) {
        cleanPO = "PO" + cleanPO;
      }
      cleanPO = cleanPO.slice(0, 10);
    }
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const rand = Math.floor(100 + Math.random() * 900);
    return `BATCH-${cleanSupplier}-${cleanPO}-${dateStr}-${rand}`;
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

  // Handle Paste from Clipboard button
  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) {
        toast.error(isAr ? "متصفحك لا يدعم قراءة الحافظة مباشرة، اضغط Ctrl+V أو Cmd+V" : "Clipboard reading not supported directly. Press Ctrl+V / Cmd+V.");
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            setPoImage(base64);
            processPOWithAI(base64);
          };
          reader.readAsDataURL(blob);
          toast.success(isAr ? "تم لصق صورة الفاتورة من الحافظة بنجاح!" : "PO image pasted from clipboard!");
          return;
        }
      }
      toast.error(isAr ? "لم يتم العثور على صورة في الحافظة. انسخ صورة أولاً ثم اضغط لصق." : "No image found in clipboard. Copy an image first.");
    } catch (err: any) {
      console.warn("Clipboard read error:", err);
      toast.error(isAr ? "يرجى السماح بالوصول للحافظة أو استخدام اختصار Cmd+V / Ctrl+V" : "Please allow clipboard access or press Cmd+V / Ctrl+V");
    }
  };

  // Global Ctrl+V / Cmd+V Paste Listener
  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => {
      const clipItems = e.clipboardData?.items;
      if (!clipItems) return;
      for (let i = 0; i < clipItems.length; i++) {
        if (clipItems[i].type.startsWith("image/")) {
          const file = clipItems[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              setPoImage(base64);
              processPOWithAI(base64);
            };
            reader.readAsDataURL(file);
            toast.success(isAr ? "تم لصق صورة الفاتورة تلقائياً!" : "PO image pasted!");
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePasteEvent);
    return () => window.removeEventListener("paste", handlePasteEvent);
  }, [isAr]);

  // Call Gemini OCR API
  const processPOWithAI = async (base64Image: string) => {
    setIsScanning(true);
    const loadingMsg = isAr 
      ? "جاري قراءة الفاتورة واستخراج الأصناف بالذكاء الاصطناعي..." 
      : "Extracting invoice data and items with Vision AI...";
    toast.loading(loadingMsg, { id: "po-scan" });

    try {
      const res = await fetch("/api/process-po", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || (isAr ? "فشل في قراءة الفاتورة" : "Failed to extract PO details"));
      }

      const extractedSupplier = data.companyName || data.supplier || data.vendor || data.supplierName || (isAr ? "مورد عام" : "General Vendor");
      const extractedInvNum = data.invoiceNumber || data.poNumber || data.deliveryNote || `PO-${Date.now().toString().slice(-6)}`;
      const extractedDate = data.date || data.invoiceDate || new Date().toISOString().split("T")[0];

      setVendorName(extractedSupplier);
      setInvoiceNumber(extractedInvNum);
      setInvoiceDate(extractedDate);
      setBatchId(generateBatchId(extractedSupplier, extractedInvNum));

      // Default expiry date: 60 days from now
      const defaultExp = new Date();
      defaultExp.setDate(defaultExp.getDate() + 60);
      const defaultExpStr = defaultExp.toISOString().split("T")[0];
      setMasterExpiryDate(defaultExpStr);

      // Parse items
      const rawItems = Array.isArray(data.items) ? data.items : [];
      const formattedItems: ExtractedItem[] = rawItems.map((item: any, idx: number) => ({
        id: `item-${Date.now()}-${idx}`,
        itemName: item.description || item.itemName || item.name || item.item_name || item.productName || (isAr ? `صنف ${idx + 1}` : `Item ${idx + 1}`),
        barcode: item.barcode || item.itemCode || item.code || item.sku || "N/A",
        quantity: Math.max(1, Number(item.quantity || item.qty || item.count || 1)),
        unitPrice: Number(item.unitPrice || item.price || item.cost || 0),
        expiryDate: item.expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(item.expiryDate) ? item.expiryDate : defaultExpStr,
      }));

      if (formattedItems.length === 0) {
        formattedItems.push({
          id: `item-${Date.now()}-0`,
          itemName: isAr ? "صنف مستلم" : "Received Item",
          barcode: "N/A",
          quantity: 1,
          expiryDate: defaultExpStr,
        });
      }

      setItems(formattedItems);
      const successMsg = isAr 
        ? `تم استخراج ${formattedItems.length} صنف بنجاح من الفاتورة!` 
        : `Successfully extracted ${formattedItems.length} items from PO!`;
      toast.success(successMsg, { id: "po-scan" });
    } catch (err: any) {
      console.error(err);
      const errorMsg = isAr 
        ? "حدث خطأ أثناء قراءة الفاتورة، يمكنك إدخال البيانات يدوياً" 
        : "Could not auto-extract invoice. You can enter details manually.";
      toast.error(err.message || errorMsg, { id: "po-scan" });
      
      // Fallback manual defaults
      setVendorName(isAr ? "مورد عام" : "General Vendor");
      setBatchId(generateBatchId("GENERAL", "PO001"));
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
    toast.success(isAr ? `تم تعيين الصلاحية لجميع الأصناف (+${days} يوم)` : `Applied expiry (+${days} days) to all items`);
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
      toast.error(isAr ? "يجب وجود صنف واحد على الأقل في الدفعة" : "At least one item is required in the batch");
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Save all items to Firestore `expiries` collection & batch log
  const handleSaveBatch = async () => {
    if (!vendorName.trim()) {
      toast.error(isAr ? "يرجى إدخال اسم المورد / الشركة" : "Please enter the supplier / vendor name");
      return;
    }
    if (items.length === 0) {
      toast.error(isAr ? "لا توجد أصناف لحفظها" : "No items to save");
      return;
    }

    const invalidItem = items.find(i => !i.itemName.trim() || !i.expiryDate);
    if (invalidItem) {
      toast.error(isAr ? "يرجى التأكد من اسم الصنف وتاريخ الصلاحية لجميع الأصناف" : "Please verify item name and expiry date for all rows");
      return;
    }

    setIsSaving(true);
    const saveToast = toast.loading(isAr ? "جاري حفظ وتوثيق الدفعة في رادار الصلاحيات..." : "Saving batch into Expiry Radar...");

    try {
      const branch = currentBranch === "all" ? "alamein4" : currentBranch;
      const normalizedStoreId = branch === "alamein4" ? "eL-alamein-4" : branch === "ola" ? "ola-el-koronfol" : branch;
      const savedUserStr = typeof window !== "undefined" ? localStorage.getItem("active_cashier_session") : null;
      let managerName = isAr ? "المدير المسؤول" : "Store Manager";
      if (savedUserStr) {
        try {
          const u = JSON.parse(savedUserStr);
          managerName = u.displayName || u.name || u.email || managerName;
        } catch {}
      }

      const effectiveBatchId = batchId || generateBatchId(vendorName, invoiceNumber);
      const nowIso = new Date().toISOString();

      // 1. Batch Document Summary in `expiry_batches`
      const batchDocRef = await addDoc(collection(db, "expiry_batches"), {
        batchId: effectiveBatchId,
        supplier: vendorName.trim(),
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
          notes: isAr ? `مستلم عبر فاتورة توريد: ${effectiveBatchId}` : `Received via PO batch: ${effectiveBatchId}`
        });
      });

      await Promise.all(promises);

      const successToast = isAr 
        ? `🎉 تم تسجيل الدفعة (${effectiveBatchId}) بنجاح وإضافتها لقائمة الدفعات والرادار!` 
        : `🎉 Batch (${effectiveBatchId}) successfully registered and added to Batches & Expiry Radar!`;
      toast.success(successToast, { id: saveToast, duration: 4000 });
      
      // Reset form
      setPoImage(null);
      setItems([]);
      setVendorName("");
      setInvoiceNumber("");
      setBatchId("");
      
      // Notify parent to switch to batches view with the saved batch
      onBatchSaved(effectiveBatchId);
    } catch (err: any) {
      console.error("Save Batch Error:", err);
      toast.error(err.message || (isAr ? "حدث خطأ أثناء حفظ الدفعة" : "Failed to save batch"), { id: saveToast });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full space-y-6" dir={isAr ? "rtl" : "ltr"}>
      {/* Top Banner / Upload Zone */}
      {!poImage && (
        <div className="bg-[#0B1121] border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
              <Sparkles size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {isAr ? "استلام دفعة بضاعة جديدة بالذكاء الاصطناعي" : "AI PO Batch Intake & Expiry Ingestion"}
              </h2>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">
                {isAr 
                  ? "ارفع، صور، أو الصق من الحافظة فاتورة استلام البضاعة (PO / Delivery Note)، وسيقوم الذكاء الاصطناعي باستخراج الأصناف والكميات فوراً لتحديد تواريخ الصلاحية وتفعيل التنبيهات الذكية قبل 15 يوماً."
                  : "Upload, photograph, or paste from clipboard your supplier invoice (PO / Delivery Note). AI will instantly extract items, codes, and quantities to set expiry dates and activate 15-day smart alerts."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Upload size={18} /> {isAr ? "رفع صورة الفاتورة (PO)" : "Upload PO Image"}
              </button>

              <button
                onClick={handlePasteFromClipboard}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-sm shadow-xl shadow-teal-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
                title={isAr ? "لصق من الحافظة أو اضغط Ctrl+V" : "Paste from clipboard or press Cmd+V / Ctrl+V"}
              >
                <ClipboardPaste size={18} /> {isAr ? "📋 لصق من الحافظة (Paste)" : "📋 Paste Clipboard"}
              </button>

              <button
                onClick={() => cameraInputRef.current?.click()}
                className="px-6 py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Camera size={18} /> {isAr ? "التقاط صورة بالكاميرا" : "Take Photo"}
              </button>

              <button
                onClick={() => {
                  setPoImage("manual");
                  setVendorName(isAr ? "مورد عام" : "General Vendor");
                  setBatchId(generateBatchId("MANUAL", "PO001"));
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
                className="px-5 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-medium text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
              >
                <Plus size={16} /> {isAr ? "إدخال يدوي بدون صورة" : "Manual Entry"}
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
          <h3 className="text-xl font-black text-white">
            {isAr ? "جاري تحليل بيانات الفاتورة واستخراج الأصناف..." : "Analyzing invoice data and extracting line items..."}
          </h3>
          <p className="text-sm text-slate-400">
            {isAr 
              ? "نستخدم محرك Vision فائق السرعة للتعرف على الأصناف والباركود والكميات." 
              : "Using ultra-fast Vision AI to extract items, barcodes, and quantities."}
          </p>
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
                  {isAr ? "⚡ توثيق استلام دفعة جديدة" : "⚡ New Batch Intake"}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1.5 flex items-center gap-2">
                  <Package className="text-indigo-400" size={24} /> {batchId || (isAr ? "تفاصيل الدفعة" : "Batch Details")}
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
                  {isAr ? "إعادة مسح فاتورة أخرى" : "Scan Another Invoice"}
                </button>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                  <Building2 size={14} className="text-indigo-400" /> {isAr ? "اسم المورد / الشركة:" : "Supplier / Vendor Name:"}
                </label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => {
                    setVendorName(e.target.value);
                    setBatchId(generateBatchId(e.target.value, invoiceNumber));
                  }}
                  placeholder={isAr ? "مثال: إيديتا، بيبسي، جهينة..." : "e.g., Edita, Pepsi, Chipsy..."}
                  className="w-full bg-[#070C18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                  <FileText size={14} className="text-indigo-400" /> {isAr ? "رقم الفاتورة / إذن الاستلام:" : "Invoice / PO Number:"}
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => {
                    setInvoiceNumber(e.target.value);
                    setBatchId(generateBatchId(vendorName, e.target.value));
                  }}
                  placeholder="e.g. PO-98421"
                  className="w-full bg-[#070C18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                  <Calendar size={14} className="text-indigo-400" /> {isAr ? "تاريخ التوريد والاستلام:" : "Delivery / Receiving Date:"}
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full bg-[#070C18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                  <Hash size={14} className="text-indigo-400" /> {isAr ? "كود الدفعة المرجعي (Auto Batch #):" : "Batch Ref Code (Auto):"}
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
                {isAr ? "تعيين تاريخ صلاحية موحد لجميع الأصناف بضغطة واحدة:" : "Quick 1-Click Expiry Presets for All Items:"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => applyPresetToAll(15)}
                className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                {isAr ? "+15 يوم" : "+15 Days"}
              </button>
              <button
                onClick={() => applyPresetToAll(30)}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                {isAr ? "+30 يوم (شهر)" : "+30 Days (1 Mo)"}
              </button>
              <button
                onClick={() => applyPresetToAll(60)}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                {isAr ? "+60 يوم (شهرين)" : "+60 Days (2 Mo)"}
              </button>
              <button
                onClick={() => applyPresetToAll(90)}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                {isAr ? "+90 يوم (3 شهور)" : "+90 Days (3 Mo)"}
              </button>
              <button
                onClick={() => applyPresetToAll(180)}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                {isAr ? "+6 شهور" : "+6 Months"}
              </button>
              <button
                onClick={() => applyPresetToAll(365)}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                {isAr ? "+سنة كاملة" : "+1 Year"}
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-[#0B1121] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Package size={20} className="text-indigo-400" /> 
                {isAr ? `أصناف الدفعة المستلمة (${items.length})` : `Batch Line Items (${items.length})`}
              </h3>

              <button
                onClick={addItem}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <Plus size={16} /> {isAr ? "إضافة صنف إضافي" : "Add Extra Item"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className={`w-full text-sm ${isAr ? "text-right" : "text-left"}`}>
                <thead>
                  <tr className="bg-[#070C18] border-b border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="p-4">#</th>
                    <th className="p-4 min-w-[220px]">{isAr ? "اسم الصنف / المنتج" : "Item / Product Name"}</th>
                    <th className="p-4 min-w-[140px]">{isAr ? "الباركود" : "Barcode"}</th>
                    <th className="p-4 min-w-[100px]">{isAr ? "الكمية" : "Quantity"}</th>
                    <th className="p-4 min-w-[170px]">{isAr ? "تاريخ الصلاحية" : "Expiry Date"}</th>
                    <th className="p-4 min-w-[120px]">{isAr ? "حالة الرادار" : "Radar Status"}</th>
                    <th className="p-4 text-center">{isAr ? "إجراء" : "Action"}</th>
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
                            placeholder={isAr ? "اسم الصنف..." : "Item name..."}
                            className="w-full bg-[#070C18] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-bold focus:border-indigo-500 outline-none"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="text"
                            value={item.barcode}
                            onChange={(e) => updateItem(item.id, "barcode", e.target.value)}
                            placeholder={isAr ? "الباركود..." : "Barcode..."}
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
                              <AlertTriangle size={12} /> {isAr ? "منتهي" : "Expired"}
                            </span>
                          ) : is15DaysWarning ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              <Clock size={12} /> {isAr ? `إنذار 15 يوم (${daysRemaining} يوم)` : `15d Alert (${daysRemaining}d)`}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <Check size={12} /> {isAr ? `آمن (${daysRemaining} يوم)` : `Safe (${daysRemaining}d)`}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title={isAr ? "حذف هذا الصنف" : "Delete this item"}
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
                  {isAr ? (
                    <>
                      سيتم تسجيل <strong className="text-white">{items.length} صنف</strong> بإجمالي <strong className="text-white">{items.reduce((s, i) => s + i.quantity, 0)} قطعة</strong> تحت كود الدفعة <strong className="text-indigo-300 font-mono">{batchId}</strong>.
                    </>
                  ) : (
                    <>
                      Registering <strong className="text-white">{items.length} items</strong> ({items.reduce((s, i) => s + i.quantity, 0)} units total) under batch code <strong className="text-indigo-300 font-mono">{batchId}</strong>.
                    </>
                  )}
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
                  {isAr ? "إلغاء" : "Cancel"}
                </button>

                <button
                  onClick={handleSaveBatch}
                  disabled={isSaving}
                  className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  {isAr ? "حفظ واعتماد الدفعة في السيستم" : "Save & Register Batch in System"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
