"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Search, MapPin, Clock, User, Package, Image as ImageIcon, CheckCircle, X } from "lucide-react";
import { productsDb } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { useLanguage } from "@/context/LanguageContext";
import { PageWrapper } from "@/components/PageWrapper";
import { CashierBottomNav } from "@/components/CashierBottomNav";
import { CameraCapture } from "@/components/MobileUX/CameraCapture";
import toast from "react-hot-toast";

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
  const [storeId, setStoreId] = useState("Unknown");
  const [cashierName, setCashierName] = useState("Unknown");

  // Modal State
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [takenName, setTakenName] = useState("");
  const [takenPhone, setTakenPhone] = useState("");
  const [takenPhotoUrl, setTakenPhotoUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem("active_cashier_session");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.branchId) setStoreId(parsed.branchId);
        if (parsed.name) setCashierName(parsed.name);
      } catch (e) {}
    } else {
      setLoading(false); // If no session, at least stop loading
    }
  }, []);

  useEffect(() => {
    if (storeId === "Unknown") return; // Wait until storeId is loaded

    const q = query(collection(productsDb, "lost_and_found"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = data.filter((item: any) => item.status !== "taken" && item.storeId === storeId);
      setItems(filtered);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [storeId]);

  const handleMarkAsTaken = async () => {
    if (!takenName.trim() || !takenPhone.trim() || !takenPhotoUrl) {
      toast.error(language === 'en' ? 'Please provide all details and a photo.' : 'يرجى تقديم جميع التفاصيل وصورة.');
      return;
    }
    if (!selectedItemId) return;

    setIsSubmitting(true);
    try {
      await updateDoc(doc(productsDb, "lost_and_found", selectedItemId), {
        status: "taken",
        takenAt: new Date().toISOString(),
        takenDetails: {
          name: takenName.trim(),
          phone: takenPhone.trim(),
          photoUrl: takenPhotoUrl,
          takenByCashierName: cashierName
        }
      });
      toast.success(language === 'en' ? 'Item marked as taken!' : 'تم التحديد كمستلم!');
      closeModal();
    } catch (error) {
      console.error("Error updating item status:", error);
      toast.error(language === 'en' ? 'Failed to update status.' : 'فشل التحديث.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setSelectedItemId(null);
    setTakenName("");
    setTakenPhone("");
    setTakenPhotoUrl("");
  };

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
              {language === 'en' ? 'No pending items found.' : 'لم يتم العثور على عناصر معلقة.'}
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

              <div className="mt-2 pt-3 border-t border-white/5">
                <button
                  onClick={() => setSelectedItemId(item.id)}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 py-2.5 rounded-xl text-sm font-bold transition-all"
                >
                  <CheckCircle size={16} />
                  {language === 'en' ? 'Mark as Taken' : 'تحديد كمستلم'}
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      {/* Mark as Taken Modal */}
      {selectedItemId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <div className="w-full max-w-sm rounded-2xl p-5 relative" style={{ backgroundColor: D.surface, border: `1px solid ${D.border}` }}>
            <button 
              onClick={closeModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold text-white mb-4 pr-6">
              {language === 'en' ? 'Customer Details' : 'تفاصيل العميل'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  {language === 'en' ? 'Customer Name' : 'اسم العميل'}
                </label>
                <input
                  type="text"
                  value={takenName}
                  onChange={e => setTakenName(e.target.value)}
                  className="w-full bg-slate-800/50 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  placeholder={language === 'en' ? 'Full Name' : 'الاسم الكامل'}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  {language === 'en' ? 'Phone Number' : 'رقم الهاتف'}
                </label>
                <input
                  type="tel"
                  value={takenPhone}
                  onChange={e => setTakenPhone(e.target.value)}
                  className="w-full bg-slate-800/50 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  placeholder={language === 'en' ? '01xxxxxxxxx' : '٠١xxxxxxxxx'}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  {language === 'en' ? 'National ID Photo' : 'صورة بطاقة الرقم القومي'}
                </label>
                <div className="p-1 rounded-xl" style={{ backgroundColor: D.bg, border: `1px solid ${D.border}` }}>
                  <CameraCapture onPhotoUploaded={setTakenPhotoUrl} label={language === 'en' ? 'Photo of ID + Item' : 'صورة للبطاقة مع العنصر'} />
                </div>
                <p className="text-[10px] text-cyan-400/70 mt-2">
                  {language === 'en' ? 'Take a picture of the ID next to the claimed item.' : 'التقط صورة للبطاقة بجوار العنصر المستلم.'}
                </p>
              </div>

              <button
                onClick={handleMarkAsTaken}
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mt-2"
                style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)', color: '#fff' }}
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    {language === 'en' ? 'Confirm Delivery' : 'تأكيد التسليم'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <CashierBottomNav />
    </PageWrapper>
  );
}
