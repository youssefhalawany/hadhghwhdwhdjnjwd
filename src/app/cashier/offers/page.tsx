"use client";

import { useState, useEffect } from "react";
import { productsDb } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Tag, Sparkles, Megaphone, ArrowRight } from "lucide-react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import Barcode from "react-barcode";
import { CashierBottomNav } from "@/components/CashierBottomNav";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";

interface Offer {
  id: string;
  title: string;
  code: string;
  description: string;
  active: boolean;
  createdAt: string;
}

const D = {
  bg: "#0B1121",
  surface: "#151E32",
  surfaceHigh: "#1C2841",
  border: "rgba(34, 211, 238, 0.15)",
  cyan: "#22d3ee",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
};

export default function CashierOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { language } = useLanguage();

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const querySnapshot = await getDocs(collection(productsDb, "promotions"));
        const data: Offer[] = [];
        querySnapshot.forEach((docSnap) => {
          data.push({ id: docSnap.id, ...(docSnap.data() as Omit<Offer, 'id'>) });
        });
        setOffers(data.filter(o => o.active).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch (err) {
        console.error("Failed to load offers", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOffers();
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
            <ArrowRight className={language === 'en' ? 'rotate-180' : ''} size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <Megaphone className="text-red-500" size={24} />
              {language === 'en' ? 'Current Offers' : 'العروض الحالية'}
            </h1>
            <p className="text-[11px] font-medium text-cyan-400/70 mt-0.5">
              {language === 'en' ? 'Suggest these to customers' : 'اقترح هذه العروض على العملاء'}
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 mt-6 space-y-5 relative z-10">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center p-12 rounded-3xl border border-dashed flex flex-col items-center shadow-lg" style={{ borderColor: D.border, backgroundColor: D.surface }}>
            <Sparkles size={48} className="text-cyan-500/50 mb-4" />
            <h3 className="text-lg font-bold text-white">
              {language === 'en' ? 'No active offers' : 'لا توجد عروض حالياً'}
            </h3>
            <p className="text-sm mt-2 text-[#94a3b8]">
              {language === 'en' ? 'New offers will appear here.' : 'سيتم إضافة العروض الجديدة هنا.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {offers.map((offer, i) => (
              <motion.div 
                key={offer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="relative overflow-hidden rounded-3xl p-5 border shadow-lg"
                style={{ backgroundColor: D.surface, borderColor: D.border }}
              >
                {/* Decorative background shape */}
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex gap-4 items-start relative z-10">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg" style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}>
                    <Tag className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-lg text-white leading-tight">
                      {offer.title}
                    </h3>
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: D.textSecondary }}>
                      {offer.description}
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-5 flex flex-col items-center relative z-10" style={{ borderTop: `1px dashed ${D.border}` }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider mb-3 text-cyan-400">
                    {language === 'en' ? 'SCAN PROMO CODE' : 'امسح كود الخصم'}
                  </span>
                  
                  <div className="bg-white p-4 rounded-xl w-full flex flex-col items-center shadow-inner border border-slate-200">
                    <Barcode 
                      value={offer.code} 
                      width={2.2} 
                      height={60} 
                      displayValue={false} 
                      background="#ffffff" 
                      lineColor="#000000" 
                      margin={0}
                    />
                    <span className="font-mono font-black tracking-[0.35em] text-xl text-black mt-3">
                      {offer.code}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <CashierBottomNav />
    </PageWrapper>
  );
}
