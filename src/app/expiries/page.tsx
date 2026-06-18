"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Calendar as CalendarIcon, PlusCircle, AlertTriangle, 
  CheckCircle, Clock, Trash2, Package, Globe
} from "lucide-react";

export default function ExpiryTrackerPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [loading, setLoading] = useState(true);
  const [expiries, setExpiries] = useState<any[]>([]);
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);

  // Form States
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

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

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !quantity || !expiryDate) return;

    const newItem = {
      itemName,
      quantity: Number(quantity),
      expiryDate,
      storeId: authenticatedUser.storeId,
      addedBy: authenticatedUser.name,
      createdAt: new Date().toISOString(),
      status: "active" // active, pulled
    };

    try {
      const docRef = await addDoc(collection(db, "expiries"), newItem);
      setExpiries(prev => [...prev, { id: docRef.id, ...newItem }].sort((a,b) => a.expiryDate.localeCompare(b.expiryDate)));
      setItemName("");
      setQuantity("");
      setExpiryDate("");
    } catch (e) {
      console.error("Error adding item:", e);
      alert(lang === "en" ? "Failed to add item." : "فشلت إضافة العنصر.");
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

  const deleteItem = async (id: string) => {
    if (!confirm(lang === "en" ? "Delete this entry permanently?" : "هل أنت متأكد من الحذف؟")) return;
    try {
      await deleteDoc(doc(db, "expiries", id));
      setExpiries(prev => prev.filter(item => item.id !== id));
    } catch (e) {
      console.error("Error deleting:", e);
    }
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 pb-20" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => router.push("/cashier")}
            className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className={`h-5 w-5 ${lang === "ar" ? "rotate-180" : ""}`} />
            <span className="font-bold text-sm">{lang === "en" ? "Back" : "رجوع"}</span>
          </button>
          
          <h1 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-blue-500" />
            {lang === "en" ? "Expiry Tracker" : "متابعة تواريخ الصلاحية"}
          </h1>
          
          <button 
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
          >
            <Globe className="h-4 w-4" /> {lang === "en" ? "عربي" : "EN"}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8">
        
        {/* Early Warning System Banner */}
        <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-4 rounded-r-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-orange-500 flex-shrink-0" />
            <div>
              <h2 className="text-orange-800 dark:text-orange-400 font-bold text-sm uppercase tracking-widest">
                {lang === "en" ? "Early Warning System" : "نظام الإنذار المبكر"}
              </h2>
              <p className="text-orange-600 dark:text-orange-300 text-xs mt-1 font-medium">
                {lang === "en" 
                  ? "Items below expire within 48 hours. Pull them from shelves immediately if expired."
                  : "المنتجات بالأسفل ستنتهي صلاحيتها خلال ٤٨ ساعة. يرجى إزالتها إذا انتهت صلاحيتها."}
              </p>
            </div>
          </div>
        </div>

        {/* Add New Item Form */}
        <form onSubmit={handleAddItem} className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-none">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-blue-500" />
            {lang === "en" ? "Log Fresh Food Delivery" : "تسجيل منتجات جديدة"}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
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
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
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
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button 
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-md shadow-blue-500/20 active:scale-[0.98] transition-transform"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {expiries.filter(item => item.status !== "pulled").map(item => {
              const itemDate = new Date(item.expiryDate);
              itemDate.setHours(0,0,0,0);
              
              const isExpired = itemDate < today;
              const isExpiringToday = itemDate.getTime() === today.getTime();
              const isExpiringTomorrow = itemDate.getTime() === tomorrow.getTime();

              let severityClass = "border-slate-200 dark:border-slate-700";
              let badgeClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
              let badgeText = lang === "en" ? "Valid" : "صالح";

              if (isExpired) {
                severityClass = "border-red-500 bg-red-50 dark:bg-red-900/10";
                badgeClass = "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400";
                badgeText = lang === "en" ? "EXPIRED! Pull Now!" : "منتهي الصلاحية! أزله فوراً!";
              } else if (isExpiringToday) {
                severityClass = "border-orange-500 bg-orange-50 dark:bg-orange-900/10";
                badgeClass = "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400";
                badgeText = lang === "en" ? "Expires Today" : "ينتهي اليوم";
              } else if (isExpiringTomorrow) {
                severityClass = "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10";
                badgeClass = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400";
                badgeText = lang === "en" ? "Expires Tomorrow" : "ينتهي غداً";
              }

              return (
                <div key={item.id} className={`p-4 rounded-2xl border-2 ${severityClass} shadow-sm transition-all flex flex-col justify-between`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isExpired || isExpiringToday ? "bg-red-100 dark:bg-red-900/30 text-red-500" : "bg-blue-100 dark:bg-blue-900/30 text-blue-500"}`}>
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{item.itemName}</h4>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">
                          {lang === "en" ? "Qty:" : "الكمية:"} <span className="text-slate-700 dark:text-slate-300">{item.quantity}</span>
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${badgeClass}`}>
                      {badgeText}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700 pt-3">
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold">
                      {lang === "en" ? "Exp:" : "الانتهاء:"} {item.expiryDate}
                    </p>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => deleteItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        title={lang === "en" ? "Delete entry" : "حذف"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => markAsPulled(item.id)}
                        className="flex items-center gap-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold hover:scale-105 transition-transform"
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
                <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                <p className="font-bold text-slate-500">{lang === "en" ? "All clear! No active items to track." : "ممتاز! لا يوجد منتجات حالياً للمتابعة."}</p>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
