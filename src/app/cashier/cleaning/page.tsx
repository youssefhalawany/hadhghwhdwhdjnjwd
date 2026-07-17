"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, CheckCircle, Droplets } from "lucide-react";
import { productsDb, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useLanguage } from "@/context/LanguageContext";
import { PageWrapper } from "@/components/PageWrapper";
import { CashierBottomNav } from "@/components/CashierBottomNav";
import { CameraCapture } from "@/components/MobileUX/CameraCapture";
import SignatureCanvas from "react-signature-canvas";
import toast from "react-hot-toast";
import { playSuccessSound } from "@/lib/sounds";

const AREAS = [
  { id: "males_toilet", en: "Males Toilet", ar: "حمام الرجال" },
  { id: "females_toilet", en: "Females Toilet", ar: "حمام السيدات" },
  { id: "backline", en: "Backline", ar: "الخط الخلفي" },
  { id: "counter", en: "Counter", ar: "الكاونتر" },
  { id: "shelves", en: "Shelves", ar: "الأرفف" },
  { id: "floor", en: "Floor", ar: "الأرضية" },
  { id: "office", en: "Office", ar: "المكتب" },
  { id: "storage", en: "Storage", ar: "المخزن" },
  { id: "fridge", en: "Fridge", ar: "الثلاجة" },
];

const D = {
  bg: "#0B1121",
  surface: "#151E32",
  surfaceHigh: "#1C2841",
  border: "rgba(34, 211, 238, 0.15)",
  cyan: "#22d3ee",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
};

export default function CashierCleaningPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cashierName, setCashierName] = useState("Unknown");
  const [storeId, setStoreId] = useState("Unknown");
  const [showSuccess, setShowSuccess] = useState(false);

  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    // Attempt to get the logged-in cashier's name from localStorage
    const savedSession = localStorage.getItem("active_cashier_session");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.name) setCashierName(parsed.name);
        if (parsed.branchId) setStoreId(parsed.branchId);
      } catch (e) {}
    }
  }, []);

  const handleClearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleSubmit = async () => {
    if (!selectedArea) {
      toast.error(language === 'en' ? 'Please select an area to clean.' : 'يرجى اختيار المنطقة.');
      return;
    }
    if (!photoUrl) {
      toast.error(language === 'en' ? 'Please take a photo of the cleaned area.' : 'يرجى التقاط صورة للمنطقة.');
      return;
    }
    if (sigCanvas.current?.isEmpty()) {
      toast.error(language === 'en' ? 'Please sign to confirm.' : 'يرجى التوقيع للتأكيد.');
      return;
    }

    setIsSubmitting(true);
    try {
      const signatureDataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png");
      
      const payload = {
        areaId: selectedArea,
        areaNameEn: AREAS.find(a => a.id === selectedArea)?.en || "",
        areaNameAr: AREAS.find(a => a.id === selectedArea)?.ar || "",
        photoUrl,
        signatureUrl: signatureDataUrl,
        cashierName,
        timestamp: new Date().toISOString(),
        localTime: new Date().toLocaleString("en-GB"), // e.g. 16/07/2026, 15:42:32
      };

      await addDoc(collection(productsDb, "cleaning_logs"), payload);
      
      await addDoc(collection(db, "notifications"), {
        type: "cleaning",
        message: `${cashierName} submitted a new Cleaning Record`,
        cashierName,
        storeId: storeId,
        createdAt: serverTimestamp(),
        read: false,
        link: "/admin/cleaning",
      });
      
      playSuccessSound();
      setShowSuccess(true);
      setTimeout(() => {
        router.push('/cashier');
      }, 2000);
    } catch (error) {
      console.error("Error submitting cleaning log:", error);
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
            onClick={() => router.push('/cashier')}
            className="w-10 h-10 rounded-full flex items-center justify-center text-cyan-400 border shadow-sm transition-transform active:scale-95"
            style={{ backgroundColor: D.bg, borderColor: D.border }}
          >
            <ArrowRight className={language === 'en' ? 'rotate-180' : ''} size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <Sparkles className="text-cyan-400" size={24} />
              {language === 'en' ? 'Cleaning Log' : 'سجل النظافة'}
            </h1>
            <p className="text-[11px] font-medium text-cyan-400/70 mt-0.5">
              {language === 'en' ? 'Record completed cleaning tasks' : 'تسجيل مهام النظافة المكتملة'}
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 mt-6 space-y-6 relative z-10">
        
        {/* Step 1: Area Selection */}
        <section>
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center">1</span>
            {language === 'en' ? 'Select Area' : 'اختر المنطقة'}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {AREAS.map(area => {
              const isSelected = selectedArea === area.id;
              return (
                <button
                  key={area.id}
                  onClick={() => setSelectedArea(area.id)}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                    isSelected ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'border-white/5 opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: isSelected ? undefined : D.surface }}
                >
                  <Droplets size={20} className={isSelected ? 'text-cyan-400' : 'text-slate-500'} />
                  <span className={`text-[10px] font-bold text-center leading-tight ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                    {language === 'en' ? area.en : area.ar}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2: Photo */}
        <section>
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center">2</span>
            {language === 'en' ? 'Photo Proof' : 'صورة الإثبات'}
          </h2>
          <div className="p-1 rounded-2xl" style={{ backgroundColor: D.surface, border: `1px solid ${D.border}` }}>
            <CameraCapture onPhotoUploaded={setPhotoUrl} label={language === 'en' ? 'Take Photo' : 'التقط صورة'} />
          </div>
        </section>

        {/* Step 3: Signature */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center">3</span>
              {language === 'en' ? 'Signature' : 'التوقيع'}
            </h2>
            <button onClick={handleClearSignature} className="text-xs text-slate-400 hover:text-white underline">
              {language === 'en' ? 'Clear' : 'مسح'}
            </button>
          </div>
          
          <div className="rounded-2xl overflow-hidden border bg-white" style={{ borderColor: D.border }}>
            <SignatureCanvas 
              ref={sigCanvas}
              penColor="black"
              canvasProps={{ className: 'w-full h-32 cursor-crosshair' }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-2 text-center">
            {language === 'en' ? 'Sign above to confirm the area is fully cleaned.' : 'وقع أعلاه لتأكيد أن المنطقة نظيفة تماماً.'}
          </p>
        </section>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full h-14 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
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
            {language === 'en' ? 'Submitted successfully!' : 'تم الإرسال بنجاح!'}
          </h2>
        </div>
      )}

      <CashierBottomNav />
    </PageWrapper>
  );
}
