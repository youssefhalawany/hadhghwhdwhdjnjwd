"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Package } from "lucide-react";
import { productsDb, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useLanguage } from "@/context/LanguageContext";
import { PageWrapper } from "@/components/PageWrapper";
import { CashierBottomNav } from "@/components/CashierBottomNav";
import { CameraCapture } from "@/components/MobileUX/CameraCapture";
import toast from "react-hot-toast";
import { playSuccessSound } from "@/lib/sounds";

const D = {
  bg: "#0B1121",
  surface: "#151E32",
  surfaceHigh: "#1C2841",
  border: "rgba(34, 211, 238, 0.15)",
  cyan: "#22d3ee",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
};

export default function AddLostAndFoundPage() {
  const router = useRouter();
  const { language } = useLanguage();
  
  const [description, setDescription] = useState("");
  const [locationFound, setLocationFound] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cashierName, setCashierName] = useState("Unknown");
  const [storeId, setStoreId] = useState("Unknown");
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem("active_cashier_session");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.name) setCashierName(parsed.name);
        if (parsed.branchId) setStoreId(parsed.branchId);
      } catch (e) {}
    }
  }, []);

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error(language === 'en' ? 'Please describe the item.' : 'يرجى وصف العنصر.');
      return;
    }
    if (!locationFound.trim()) {
      toast.error(language === 'en' ? 'Please enter where it was found.' : 'يرجى إدخال مكان العثور عليه.');
      return;
    }
    if (!photoUrl) {
      toast.error(language === 'en' ? 'Please take a photo of the item.' : 'يرجى التقاط صورة للعنصر.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        description: description.trim(),
        locationFound: locationFound.trim(),
        photoUrl,
        cashierName,
        storeId,
        timestamp: new Date().toISOString(),
        localTime: new Date().toLocaleString("en-GB"),
      };

      await addDoc(collection(productsDb, "lost_and_found"), payload);
      
      try {
        await addDoc(collection(db, "notifications"), {
          type: "lost_and_found",
          message: `${cashierName} submitted a new Lost & Found Record`,
          cashierName,
          storeId,
          createdAt: serverTimestamp(),
          read: false,
          link: "/admin/lost-and-found",
        });
      } catch (notifyErr) {
        console.error("Notification failed:", notifyErr);
      }
      
      try {
        fetch("/api/notifications/notify-master", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "New Lost & Found Record",
            body: `Cashier: ${cashierName || 'Unknown'}\nItem: ${payload.description}`
          })
        }).catch(e => console.error("Notify error", e));
      } catch (err) {}

      playSuccessSound();
      setShowSuccess(true);
      setTimeout(() => {
        router.push('/cashier/lost-and-found');
      }, 2000);
    } catch (error) {
      console.error("Error submitting lost and found log:", error);
      toast.error(language === 'en' ? 'Failed to submit.' : 'فشل الإرسال.');
      setIsSubmitting(false);
    }
  };

  return (
    <PageWrapper className="min-h-screen pb-32" dir={language === "ar" ? "rtl" : "ltr"} style={{ backgroundColor: D.bg }}>
      
      {/* Top Header */}
      <div className="pt-8 pb-4 px-6 relative z-10 flex items-center justify-between shadow-md" style={{ backgroundColor: D.surface, borderBottom: `1px solid ${D.border}` }}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/cashier/lost-and-found')}
            className="w-10 h-10 rounded-full flex items-center justify-center text-cyan-400 border shadow-sm transition-transform active:scale-95"
            style={{ backgroundColor: D.bg, borderColor: D.border }}
          >
            <ArrowLeft className={language === 'ar' ? 'rotate-180' : ''} size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <Package className="text-cyan-400" size={24} />
              {language === 'en' ? 'Add Item' : 'إضافة عنصر'}
            </h1>
            <p className="text-[11px] font-medium text-cyan-400/70 mt-0.5">
              {language === 'en' ? 'Record a lost item' : 'تسجيل عنصر مفقود'}
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 mt-6 space-y-6 relative z-10">
        
        {/* Step 1: Details */}
        <section>
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center">1</span>
            {language === 'en' ? 'Item Details' : 'تفاصيل العنصر'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">
                {language === 'en' ? 'What is it?' : 'ما هو؟'}
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={language === 'en' ? 'e.g. Black Wallet, iPhone 13, Keys' : 'مثال: محفظة سوداء، آيفون ١٣، مفاتيح'}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">
                {language === 'en' ? 'Where was it found?' : 'أين تم العثور عليه؟'}
              </label>
              <input
                type="text"
                value={locationFound}
                onChange={e => setLocationFound(e.target.value)}
                placeholder={language === 'en' ? 'e.g. Near coffee machine, table 2' : 'مثال: بالقرب من ماكينة القهوة، طاولة ٢'}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Step 2: Photo */}
        <section>
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center">2</span>
            {language === 'en' ? 'Photo Proof' : 'صورة الإثبات'}
          </h2>
          <div className="p-1 rounded-2xl" style={{ backgroundColor: D.surface, border: `1px solid ${D.border}` }}>
            <CameraCapture onPhotoUploaded={setPhotoUrl} label={language === 'en' ? 'Take Photo of Item' : 'التقط صورة للعنصر'} />
          </div>
          <p className="text-[10px] text-slate-500 mt-2 text-center">
            {language === 'en' ? 'Take a photo showing where the item was found.' : 'التقط صورة تظهر مكان العثور على العنصر.'}
          </p>
        </section>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full h-14 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95 mt-8"
          style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)', color: '#fff' }}
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          ) : (
            <>
              <CheckCircle size={24} />
              {language === 'en' ? 'Submit Record' : 'إرسال السجل'}
            </>
          )}
        </button>

      </main>

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B1121] animate-in fade-in duration-300">
          <div className="h-32 w-32 bg-cyan-500/20 rounded-full flex items-center justify-center mb-6 animate-[pulse_1.5s_ease-in-out_infinite]">
            <CheckCircle className="h-16 w-16 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
          </div>
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2 drop-shadow-md">
            {language === 'en' ? 'Saved successfully!' : 'تم الحفظ بنجاح!'}
          </h2>
        </div>
      )}

      <CashierBottomNav />
    </PageWrapper>
  );
}
