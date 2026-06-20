"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Calendar as CalendarIcon, PlusCircle, AlertTriangle, 
  CheckCircle, Clock, Trash2, Package, Globe, Camera, X, QrCode
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

export default function ExpiryTrackerPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [loading, setLoading] = useState(true);
  const [expiries, setExpiries] = useState<any[]>([]);
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);

  // Form States
  const [itemName, setItemName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  
  // Edit Quantity States
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editItemQty, setEditItemQty] = useState<number>(0);

  // Scanner States
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (!savedUserStr) {
      router.push("/cashier");
      return;
    }

    const sessionData = JSON.parse(savedUserStr);
    setAuthenticatedUser(sessionData);

    const fetchExpiries = async () => {
      try {
        const q = query(collection(db, "expiries"), orderBy("expiryDate", "asc"));
        const snap = await getDocs(q);
        setExpiries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error fetching expiries:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchExpiries();
  }, [router]);

  // Scanner Actions
  const startScanning = () => {
    setShowScanner(true);
    setScannerError("");
    
    // Wait a tick for the DOM element to render
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("scanner-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        const startWithConstraints = async (constraints: any) => {
          return html5QrCode.start(
            constraints,
            config,
            (decodedText) => {
              try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = "sine";
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.15);
              } catch (e) {
                console.error("Audio beep failed", e);
              }
              setBarcode(decodedText);
              stopScanning();
            },
            undefined
          );
        };

        try {
          // Try standard environment camera
          await startWithConstraints({ facingMode: "environment" });
          scannerRef.current = html5QrCode;
        } catch (err) {
          try {
            // Fallback to any camera
            await startWithConstraints({ video: true });
            scannerRef.current = html5QrCode;
          } catch (fallbackErr) {
            setScannerError(lang === "en" ? "Camera error. Please ensure permissions are granted or use a supported browser." : "فشل الكاميرا. يرجى منح الصلاحيات.");
          }
        }
      } catch (err: any) {
        console.error("Scanner failed to mount:", err);
        setScannerError(lang === "en" ? "Scanner error." : "خطأ في المسح.");
      }
    }, 250);
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().catch(e => console.error("Error stopping scanner:", e));
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      scannerRef.current = null;
    }
    setShowScanner(false);
  };



  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !quantity || !expiryDate || !barcode) return;

    const newItem = {
      itemName: itemName || "",
      barcode: barcode || "",
      quantity: Number(quantity) || 0,
      expiryDate: expiryDate || "",
      storeId: authenticatedUser?.storeId || "Unknown Store",
      addedBy: authenticatedUser?.name || authenticatedUser?.email || "Unknown User",
      createdAt: new Date().toISOString(),
      status: "active" // active, pulled
    };

    // Remove any accidental undefined fields
    Object.keys(newItem).forEach(key => {
      if ((newItem as any)[key] === undefined) {
        delete (newItem as any)[key];
      }
    });

    try {
      const docRef = await addDoc(collection(db, "expiries"), newItem);
      setExpiries(prev => [...prev, { id: docRef.id, ...newItem }].sort((a,b) => a.expiryDate.localeCompare(b.expiryDate)));
      setItemName("");
      setBarcode("");
      setQuantity("");
      setExpiryDate("");
    } catch (e: any) {
      console.error("Error adding item:", e);
      alert((lang === "en" ? "Failed to add item. Error: " : "فشلت إضافة العنصر. الخطأ: ") + (e.message || e));
    }
  };

  const markAsPulled = async (id: string) => {
    try {
      await updateDoc(doc(db, "expiries", id), { status: "pulled" });
      setExpiries(prev => prev.map(item => item.id === id ? { ...item, status: "pulled" } : item));
    } catch (e) {
      console.error("Error updating:", e);
    }
  };

  const saveQuantity = async (item: any) => {
    if (editItemQty === 0) {
      if (!confirm(lang === "en" ? "Marking quantity as 0 means the item was sold. It will be removed from records. Proceed?" : "الكمية 0 تعني أن العنصر قد تم بيعه. سيتم حذفه من السجلات. متابعة؟")) return;
      try {
        await deleteDoc(doc(db, "expiries", item.id));
        setExpiries(prev => prev.filter(i => i.id !== item.id));
      } catch (e) {
        console.error("Error deleting:", e);
      }
    } else {
      try {
        await updateDoc(doc(db, "expiries", item.id), { quantity: editItemQty });
        setExpiries(prev => prev.map(i => i.id === item.id ? { ...i, quantity: editItemQty } : i));
      } catch (e) {
        console.error("Error updating quantity:", e);
      }
    }
    setEditingQtyId(null);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 pb-20 transition-colors duration-300" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button 
            type="button"
            onClick={() => router.push("/cashier")}
            className="flex items-center gap-1 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer animate-in fade-in duration-200"
          >
            <ArrowLeft className={`h-5 w-5 ${lang === "ar" ? "rotate-180" : ""}`} />
            <span className="font-bold text-sm">{lang === "en" ? "Back" : "رجوع"}</span>
          </button>
          
          <h1 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-blue-500 animate-pulse" />
            {lang === "en" ? "Expiry Tracker" : "متابعة تواريخ الصلاحية"}
          </h1>
          
          <button 
            type="button"
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-1.5 rounded-full text-xs font-bold transition-colors text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-slate-600/40 cursor-pointer"
          >
            <Globe className="h-4 w-4" /> {lang === "en" ? "عربي" : "EN"}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8">
        
        {/* Early Warning System Banner */}
        <div className="bg-orange-50/75 dark:bg-orange-950/15 border-l-4 border-orange-500 p-4 rounded-r-xl shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-orange-500 flex-shrink-0 animate-bounce" />
            <div>
              <h2 className="text-orange-850 dark:text-orange-400 font-bold text-sm uppercase tracking-widest">
                {lang === "en" ? "Early Warning System" : "نظام الإنذار المبكر"}
              </h2>
              <p className="text-orange-750 dark:text-orange-350 text-xs mt-1 font-medium leading-relaxed">
                {lang === "en" 
                  ? "Items below expire within 48 hours. Pull them from shelves immediately if expired."
                  : "المنتجات بالأسفل ستنتهي صلاحيتها خلال ٤٨ ساعة. يرجى إزالتها إذا انتهت صلاحيتها."}
              </p>
            </div>
          </div>
        </div>

        {/* Add New Item Form */}
        <form onSubmit={handleAddItem} className="bg-white/70 dark:bg-slate-800/40 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-slate-200/60 dark:border-slate-700/40 shadow-lg shadow-slate-200/10 dark:shadow-none space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-blue-500" />
            {lang === "en" ? "Log Fresh Food Delivery" : "تسجيل منتجات جديدة"}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Barcode input with scan camera button */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                {lang === "en" ? "Barcode / Scan" : "الباركود / مسح"}
              </label>
              <div className="flex gap-2">
                <input 
                  required 
                  type="text" 
                  value={barcode} 
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder={lang === "en" ? "Barcode" : "الباركود"}
                  className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-semibold font-mono text-sm"
                />
                <button 
                  type="button"
                  onClick={startScanning}
                  className="bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-700 text-white p-3 rounded-xl font-bold active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer shadow border border-slate-200 dark:border-slate-700"
                  title={lang === "en" ? "Scan Barcode" : "مسح الباركود"}
                >
                  <Camera className="h-5 w-5 text-blue-500" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                {lang === "en" ? "Product Name" : "اسم المنتج"}
              </label>
              <input 
                required 
                type="text" 
                value={itemName} 
                onChange={(e) => setItemName(e.target.value)}
                placeholder={lang === "en" ? "e.g., Juhayna Milk" : "مثل: لبن جهينة"}
                className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                {lang === "en" ? "Quantity" : "الكمية"}
              </label>
              <input 
                required 
                type="number" 
                min="1"
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                {lang === "en" ? "Expiry Date" : "تاريخ الانتهاء"}
              </label>
              <input 
                required 
                type="date" 
                value={expiryDate} 
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-semibold"
              />
            </div>
          </div>
          
          <div className="flex justify-end pt-2">
            <button 
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-md shadow-blue-500/20 active:scale-[0.98] hover:scale-[1.01] transition-all cursor-pointer"
            >
              {lang === "en" ? "Add to Tracker" : "إضافة للمتابعة"}
            </button>
          </div>
        </form>

        {/* To-Do List (Actionable Items) */}
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {lang === "en" ? "Daily Action List" : "قائمة العمل اليومية"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {expiries.filter(item => item.status !== "pulled").map(item => {
              const itemDate = new Date(item.expiryDate);
              itemDate.setHours(0,0,0,0);
              
              const isExpired = itemDate < today;
              const isExpiringToday = itemDate.getTime() === today.getTime();
              const isExpiringTomorrow = itemDate.getTime() === tomorrow.getTime();

              let severityClass = "border-slate-200/85 dark:border-slate-800 bg-white/40 dark:bg-slate-850/10";
              let badgeClass = "bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/30";
              let badgeText = lang === "en" ? "Valid" : "صالح";

              if (isExpired) {
                severityClass = "border-red-500/80 bg-red-50/70 dark:bg-red-950/15";
                badgeClass = "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200/30";
                badgeText = lang === "en" ? "EXPIRED! Pull Now!" : "منتهي الصلاحية! أزله فوراً!";
              } else if (isExpiringToday) {
                severityClass = "border-orange-500/80 bg-orange-50/70 dark:bg-orange-950/15";
                badgeClass = "bg-orange-100 text-orange-900/40 text-orange-700 dark:text-orange-450 border border-orange-200/30";
                badgeText = lang === "en" ? "Expires Today" : "ينتهي اليوم";
              } else if (isExpiringTomorrow) {
                severityClass = "border-yellow-400/80 bg-yellow-50/70 dark:bg-yellow-950/15";
                badgeClass = "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-750 dark:text-yellow-455 border border-yellow-250/30";
                badgeText = lang === "en" ? "Expires Tomorrow" : "ينتهي غداً";
              }

              return (
                <div key={item.id} className={`p-4 rounded-2xl border-2 ${severityClass} shadow-sm hover:shadow-md hover:scale-[1.015] duration-200 transition-all flex flex-col justify-between`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isExpired || isExpiringToday ? "bg-red-100/80 dark:bg-red-900/30 text-red-500" : "bg-blue-100/80 dark:bg-blue-900/30 text-blue-500"}`}>
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{item.itemName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                            {lang === "en" ? "Qty:" : "الكمية:"} 
                            {editingQtyId === item.id ? (
                              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-md p-0.5 border border-blue-500/30">
                                <input 
                                  type="number" 
                                  min="0" 
                                  value={editItemQty} 
                                  onChange={e => setEditItemQty(Number(e.target.value))} 
                                  className="w-12 p-1 bg-transparent text-slate-900 dark:text-white font-black outline-none text-center" 
                                />
                                <button type="button" onClick={() => saveQuantity(item)} className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold">{lang === "en" ? "Save" : "حفظ"}</button>
                                <button type="button" onClick={() => setEditingQtyId(null)} className="text-[10px] text-slate-400 px-1 hover:text-slate-600 font-bold">X</button>
                              </div>
                            ) : (
                              <span className="text-slate-755 dark:text-slate-350">{item.quantity}</span>
                            )}
                          </p>
                          {item.barcode && (
                            <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400 px-1.5 py-0.5 rounded font-bold border border-slate-200/40 dark:border-slate-700/40 flex items-center gap-0.5">
                              <QrCode className="h-3 w-3" /> {item.barcode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${badgeClass}`}>
                      {badgeText}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60 pt-3">
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold">
                      {lang === "en" ? "Exp:" : "الانتهاء:"} {item.expiryDate}
                    </p>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => { setEditingQtyId(item.id); setEditItemQty(item.quantity); }}
                        className="text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors"
                      >
                        {lang === "en" ? "Edit Qty" : "تعديل الكمية"}
                      </button>
                      <button 
                        type="button"
                        onClick={() => markAsPulled(item.id)}
                        className="flex items-center gap-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {lang === "en" ? "Mark Pulled" : "تم الإزالة"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {expiries.filter(item => item.status !== "pulled").length === 0 && (
              <div className="col-span-1 md:col-span-2 p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3 animate-bounce" />
                <p className="font-bold text-slate-500">{lang === "en" ? "All clear! No active items to track." : "ممتاز! لا يوجد منتجات حالياً للمتابعة."}</p>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Barcode Camera Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-black text-base flex items-center gap-2">
                <Camera className="h-5 w-5 text-blue-500 animate-pulse" />
                {lang === "en" ? "Scan Item Barcode" : "مسح باركود المنتج"}
              </h3>
              <button 
                type="button" 
                onClick={stopScanning}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Camera Viewport */}
            <div className="p-4 space-y-4">
              {scannerError ? (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-center space-y-3">
                  <AlertTriangle className="h-8 w-8 text-red-500 mx-auto animate-bounce" />
                  <p className="text-sm font-semibold text-red-400">{scannerError}</p>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden bg-white text-slate-900 border border-slate-800">
                  <div id="scanner-reader" className="w-full"></div>
                </div>
              )}

              <p className="text-xs text-slate-400 text-center font-medium">
                {lang === "en" 
                  ? "Align barcode within target frame to capture automatically."
                  : "ضع الباركود في وسط المربع للمسح التلقائي."}
              </p>
              
              <div className="pt-2">
                <button 
                  type="button"
                  onClick={stopScanning}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  {lang === "en" ? "Cancel" : "إلغاء"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
