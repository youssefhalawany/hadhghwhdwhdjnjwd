"use client";

import React, { useState, useEffect, useRef } from "react";
import { db, productsDb } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { 
  ArrowLeft, PackageMinus, Plus, ScanLine, Search, 
  Trash2, Save, CheckCircle2, ChevronRight, Hash, Camera
} from "lucide-react";
import { CameraScanner } from "@/components/ui/CameraScanner";
import { playSuccessSound, playErrorSound, playPopSound } from "@/lib/sounds";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// Re-use matching Design Tokens
const D = {
  bg: "#0B1121",
  surface: "#151E32",
  surfaceHigh: "#1C2841",
  border: "rgba(34, 211, 238, 0.15)",
  borderMid: "rgba(34, 211, 238, 0.25)",
  cyan: "#22d3ee",
  cyanDim: "rgba(34, 211, 238, 0.1)",
  cyanBorder: "rgba(34, 211, 238, 0.25)",
  yellow: "#facc15",
  yellowDim: "rgba(250,204,21,0.1)",
  yellowBorder: "rgba(250,204,21,0.25)",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  textDim: "#64748b",
};

export default function OutOfStockPage() {
  const router = useRouter();
  const { language: lang } = useLanguage();
  const isRTL = lang === "ar";
  
  const [session, setSession] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("active_cashier_session");
    if (!saved) {
      router.replace("/cashier");
    } else {
      setSession(JSON.parse(saved));
    }
  }, [router]);

  const handleScan = async (code: string) => {
    playPopSound();
    setBarcodeInput("");
    setShowScanner(false);
    await lookupProduct(code);
  };

  const lookupProduct = async (code: string) => {
    if (!code) return;
    setIsSearching(true);
    try {
      // Look in productsDb (anhproducts) first
      const q = query(collection(productsDb, "products"), where("barcode", "==", code));
      const snap = await getDocs(q);
      
      let foundName = "Unknown Product";
      if (!snap.empty) {
        const data = snap.docs[0].data();
        foundName = data.description || data.name || data.itemName || "Unknown Product";
      } else {
        // Try id if barcode field is missing
        const q2 = query(collection(productsDb, "products"));
        const allProducts = await getDocs(q2);
        const match = allProducts.docs.find(d => d.id === code);
        if (match) {
           const data = match.data();
           foundName = data.description || data.name || data.itemName || "Unknown Product";
        } else {
           toast.warning(isRTL ? "المنتج غير مسجل، يمكنك الاستمرار." : "Product not found, you can continue.");
        }
      }

      setItems(prev => {
        const existing = prev.find(p => p.barcode === code);
        if (existing) {
          return prev.map(p => p.barcode === code ? { ...p, missingQty: p.missingQty + 1 } : p);
        }
        return [...prev, { barcode: code, name: foundName, missingQty: 1 }];
      });
      playSuccessSound();
    } catch (e) {
      console.error(e);
      toast.error("Lookup failed");
    } finally {
      setIsSearching(false);
    }
  };

  const updateQty = (idx: number, qty: string) => {
    const newItems = [...items];
    const val = parseInt(qty);
    newItems[idx].missingQty = isNaN(val) ? 0 : val;
    setItems(newItems);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    playPopSound();
  };

  const generateCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error(isRTL ? "أضف منتجاً أولاً" : "Add an item first");
      return;
    }

    setIsSubmitting(true);
    try {
      const code = generateCode();
      const totalMissing = items.reduce((sum, item) => sum + item.missingQty, 0);
      
      const payload = {
        code,
        items,
        totalMissingQuantity: totalMissing,
        cashierName: session?.name || "Unknown",
        branchId: session?.branchId || "alamein4",
        storeId: session?.storeId || session?.branchId || "alamein4",
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString("en-CA"),
      };

      await setDoc(doc(collection(db, "out_of_stock_logs"), code), payload);
      
      playSuccessSound();
      setSubmittedCode(code);
    } catch (e) {
      console.error(e);
      playErrorSound();
      toast.error("Failed to submit!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const rootStyle = {
    background: "#0B1121",
    color: D.textPrimary,
    minHeight: "100vh",
    width: "100%",
    direction: isRTL ? "rtl" : "ltr" as any
  };

  if (showScanner) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <CameraScanner onScan={handleScan} onClose={() => setShowScanner(false)} title={isRTL ? "مسح الباركود للنواقص" : "Scan Out of Stock Barcode"} />
      </div>
    );
  }

  if (submittedCode) {
    return (
      <div style={rootStyle} className="flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[#151E32] p-8 rounded-3xl border border-[#facc15]/30 shadow-2xl flex flex-col items-center max-w-sm w-full"
        >
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(250,204,21,0.3)]">
            <CheckCircle2 size={40} className="text-yellow-400" />
          </div>
          <h1 className="text-2xl font-black mb-2">{isRTL ? "تم الحفظ بنجاح!" : "Saved Successfully!"}</h1>
          <p className="text-slate-400 text-sm mb-6">
            {isRTL ? "يرجى كتابة هذا الكود على ورقة وتدبيسها ووضعها في الخزينة." : "Please write this code on a paper, staple it, and place it in the safe."}
          </p>
          
          <div className="bg-[#0B1121] rounded-2xl p-6 w-full mb-8 border border-slate-800">
            <p className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-2">
              {isRTL ? "كود العملية" : "Submission Code"}
            </p>
            <div className="text-5xl font-black text-yellow-400 tracking-widest font-mono">
              {submittedCode}
            </div>
          </div>

          <button 
            onClick={() => router.push("/cashier")}
            className="w-full py-4 rounded-xl font-bold bg-yellow-500 text-[#0B1121] hover:bg-yellow-400 transition-colors shadow-[0_0_20px_rgba(250,204,21,0.4)]"
          >
            {isRTL ? "العودة للرئيسية" : "Back to Home"}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={rootStyle} className="flex flex-col">
      {/* Header */}
      <div className="pt-12 pb-6 px-6 sticky top-0 z-10 bg-[#0B1121]/80 backdrop-blur-xl border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => { playPopSound(); router.push("/cashier"); }} className="p-2 -ml-2 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white">
            <ArrowLeft size={20} className={isRTL ? "rotate-180" : ""} />
          </button>
          <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded-lg border border-yellow-500/20 font-bold text-xs">
            <PackageMinus size={14} />
            {isRTL ? "سجل النواقص" : "Out of Stock Log"}
          </div>
        </div>
        <h1 className="text-2xl font-black">{isRTL ? "تسجيل النواقص" : "Log Missing Items"}</h1>
        <p className="text-slate-500 text-sm mt-1">{isRTL ? "قم بمسح الباركود للمنتجات غير المتوفرة" : "Scan barcodes for out of stock products"}</p>
      </div>

      <div className="flex-1 p-4 pb-32">
        {/* Search / Scan Bar */}
        <div className="bg-[#151E32] rounded-2xl p-4 border border-slate-800 mb-6 flex gap-3 shadow-lg">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text"
              placeholder={isRTL ? "أدخل الباركود..." : "Enter barcode..."}
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScan(barcodeInput)}
              className="w-full bg-[#0B1121] border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-yellow-500/50"
            />
          </div>
          <button 
            onClick={() => handleScan(barcodeInput)}
            className="w-12 flex items-center justify-center bg-slate-800 rounded-xl text-white hover:bg-slate-700 disabled:opacity-50"
            disabled={!barcodeInput || isSearching}
          >
            <Plus size={20} />
          </button>
          <button 
            onClick={() => { playPopSound(); setShowScanner(true); }}
            className="w-12 flex items-center justify-center bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-xl hover:bg-yellow-500/30"
          >
            <Camera size={20} />
          </button>
        </div>

        {/* Item List */}
        <div className="space-y-3">
          <AnimatePresence>
            {items.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#151E32] border border-slate-800 rounded-2xl p-4 flex gap-4 items-center"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-700">
                  <PackageMinus size={24} className="text-slate-400" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-sm line-clamp-1">{item.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                      <Hash size={10} /> {item.barcode}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1 w-16">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{isRTL ? "الكمية" : "Qty"}</span>
                  <input 
                    type="number"
                    value={item.missingQty || ""}
                    onChange={e => updateQty(idx, e.target.value)}
                    className="w-full bg-[#0B1121] border border-slate-700 rounded-lg text-center py-2 text-white font-bold focus:border-yellow-500/50 focus:outline-none"
                  />
                </div>

                <button 
                  onClick={() => removeItem(idx)}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg ml-1"
                >
                  <Trash2 size={18} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {items.length === 0 && !isSearching && (
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700/50">
                <ScanLine size={24} className="text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm">
                {isRTL ? "امسح الباركود أو أدخله يدوياً للبدء في التسجيل." : "Scan or type a barcode to start logging."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Area */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0B1121] via-[#0B1121] to-transparent pt-12 pb-8">
          <div className="bg-[#151E32] border border-slate-700 p-4 rounded-3xl shadow-2xl flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 mb-1">{isRTL ? "إجمالي الأصناف" : "Total Items"}</div>
              <div className="text-xl font-black text-white">{items.length}</div>
            </div>
            
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-yellow-500 text-[#0B1121] font-black px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-yellow-400 transition-colors shadow-[0_0_20px_rgba(250,204,21,0.2)] disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="animate-pulse">{isRTL ? "جاري الحفظ..." : "Saving..."}</span>
              ) : (
                <>
                  <Save size={20} />
                  {isRTL ? "حفظ واستخراج كود" : "Save & Get Code"}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
