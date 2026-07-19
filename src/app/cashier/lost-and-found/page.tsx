"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Search, MapPin, Clock, User, Package, Image as ImageIcon } from "lucide-react";
import { productsDb } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { useLanguage } from "@/context/LanguageContext";
import { PageWrapper } from "@/components/PageWrapper";
import { CashierBottomNav } from "@/components/CashierBottomNav";

const D = {
  bg: "#0B1121",
  surface: "#151E32",
  surfaceHigh: "#1C2841",
  border: "rgba(34, 211, 238, 0.15)",
  cyan: "#22d3ee",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
};

export default function LostAndFoundList() {
  const router = useRouter();
  const { language } = useLanguage();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(productsDb, "lost_and_found"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setItems(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <PageWrapper className="min-h-screen pb-32" dir={language === "ar" ? "rtl" : "ltr"} style={{ backgroundColor: D.bg }}>
      {/* Top Header */}
      <div className="pt-8 pb-4 px-6 relative z-10 flex items-center justify-between shadow-md" style={{ backgroundColor: D.surface, borderBottom: `1px solid ${D.border}` }}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/cashier')}
            className="w-10 h-10 rounded-full flex items-center justify-center text-cyan-400 border shadow-sm transition-transform active:scale-95"
            style={{ backgroundColor: D.bg, borderColor: D.border }}
          >
            <ArrowLeft className={language === 'ar' ? 'rotate-180' : ''} size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <Package className="text-cyan-400" size={24} />
              {language === 'en' ? 'Lost & Found' : 'المفقودات'}
            </h1>
            <p className="text-[11px] font-medium text-cyan-400/70 mt-0.5">
              {language === 'en' ? 'View reported items' : 'عرض العناصر المبلغ عنها'}
            </p>
          </div>
        </div>
        <button 
          onClick={() => router.push('/cashier/lost-and-found/add')}
          className="h-10 px-4 rounded-full flex items-center gap-2 text-white font-bold text-sm shadow-lg transition-transform active:scale-95"
          style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)' }}
        >
          <Plus size={18} />
          {language === 'en' ? 'Add Item' : 'إضافة'}
        </button>
      </div>

      <main className="max-w-md mx-auto px-4 mt-6 space-y-4 relative z-10">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center p-8 rounded-2xl border" style={{ backgroundColor: D.surface, borderColor: D.border }}>
            <Search className="mx-auto text-slate-500 mb-3" size={32} />
            <p className="text-slate-400 text-sm">
              {language === 'en' ? 'No items recorded yet.' : 'لا توجد عناصر مسجلة بعد.'}
            </p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="p-4 rounded-2xl border flex flex-col gap-3 shadow-md" style={{ backgroundColor: D.surface, borderColor: D.border }}>
              <div className="flex justify-between items-start">
                <h3 className="text-base font-bold text-white leading-tight">
                  {item.description}
                </h3>
                {item.photoUrl && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0 ml-3">
                    <img src={item.photoUrl} alt="Item" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <MapPin size={14} className="text-cyan-400 shrink-0" />
                  <span className="font-medium">{item.locationFound}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <User size={14} className="text-slate-500 shrink-0" />
                  <span>{item.cashierName}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <Clock size={12} className="shrink-0" />
                  <span>{item.localTime || new Date(item.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      <CashierBottomNav />
    </PageWrapper>
  );
}
