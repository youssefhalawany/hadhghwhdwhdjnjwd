"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Shield, UploadCloud, ChevronLeft, AlertTriangle, User as UserIcon, Globe } from "lucide-react";
import { vibrateSuccess, vibrateError } from "@/lib/haptics";
import { NumericFormat } from "react-number-format";

const t = {
  en: {
    title: "Return / Void Request",
    subtitle: "Store Returns Policy",
    important: "Important",
    importantDesc: "Please fill out all details accurately. You MUST keep the physical receipt and hand it to the manager.",
    txnNum: "Transaction Number",
    cashierName: "Cashier Name",
    register: "Register",
    amount: "Amount Returned",
    customerName: "Customer Name",
    customerPhone: "Customer Phone Number",
    reason: "Reason for Return/Void",
    reasonPlaceholder: "Explain exactly why this transaction was voided or returned...",
    signTitle: "Sign Your Request",
    signDesc: "Please sign below to verify this void/return.",
    submit: "Submit Return Request",
    submitting: "Submitting...",
    back: "Back",
    clearSignature: "Clear Signature",
  },
  ar: {
    title: "تسجيل مرتجع / إلغاء عملية",
    subtitle: "سياسة إرجاع وإلغاء المبيعات",
    important: "تنبيه هام",
    importantDesc: "يرجى ملء التفاصيل بدقة. يجب عليك الاحتفاظ بالوصول الورقي (الريسيط) وتسليمه للمدير.",
    txnNum: "رقم المعاملة (العملية)",
    cashierName: "اسم الكاشير",
    register: "رقم كاشير البيع",
    amount: "المبلغ المرتجع",
    customerName: "اسم الزبون",
    customerPhone: "رقم هاتف الزبون",
    reason: "سبب المرتجع / الإلغاء",
    reasonPlaceholder: "يرجى توضيح سبب إلغاء المعاملة أو إرجاعها بالتفصيل...",
    signTitle: "توقيع الطلب",
    signDesc: "يرجى التوقيع داخل المربع أدناه لتأكيد المرتجع.",
    submit: "إرسال طلب المرتجع",
    submitting: "جاري الإرسال...",
    back: "رجوع",
    clearSignature: "مسح التوقيع",
  }
};

const SignaturePad = ({ onSave, onClear, dict }: { onSave: (data: string) => void, onClear: () => void, dict: any }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, []);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: any) => {
    const coords = getCoordinates(e);
    if (!coords) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onClear();
    }
  };

  return (
    <div className="space-y-2">
      <div className="border border-border rounded-xl overflow-hidden bg-white touch-none">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-[150px] sm:h-[200px] cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <button type="button" onClick={clear} className="text-xs text-red-500 font-bold uppercase hover:underline">
        {dict.clearSignature || "Clear Signature"}
      </button>
    </div>
  );
};

export default function CashierVoidPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const dict = t[lang];
  
  const [transactionNumber, setTransactionNumber] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [register, setRegister] = useState("Cash 1");
  const [cashierSignature, setCashierSignature] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (savedUserStr) {
      try {
        const user = JSON.parse(savedUserStr);
        if (user && user.name) {
          setCashierName(user.name);
        }
      } catch (e) {
        console.error("Invalid session");
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierSignature) {
      vibrateError();
      alert(lang === "en" ? "Please sign your request before submitting." : "يرجى توقيع الطلب قبل الإرسال.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        transactionNumber,
        cashierName,
        customerName,
        customerPhone,
        amount: Number(amount),
        reason,
        register,
        cashierSignature,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "void_requests"), payload);
      
      try {
        fetch("/api/notifications/notify-master", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "New Void/Return Request",
            body: `Cashier ${cashierName || 'Unknown'} logged a return for ${amount} EGP (Ref: ${transactionNumber}).`
          })
        }).catch(e => console.error("Notify error", e));
      } catch (err) {}

      vibrateSuccess();
      router.push("/voids/cashier/success");
    } catch (error: any) {
      vibrateError();
      console.error("Error submitting void request:", error);
      alert(lang === "en" ? "Failed to submit request: " + error.message : "فشل إرسال الطلب: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-28" dir={lang === "ar" ? "rtl" : "ltr"}>
      
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-750 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => router.push('/cashier')}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer text-slate-500 dark:text-slate-200"
            >
              <ChevronLeft className={`h-5 w-5 ${lang === "ar" ? "rotate-180" : ""}`} />
            </button>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 dark:text-white leading-none">{dict.title}</h1>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">{dict.subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-205 dark:hover:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-bold transition-colors text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700/60 cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5" /> {lang === "en" ? "عربي" : "EN"}
            </button>
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-red-600 rounded-full flex items-center justify-center border-2 border-red-500/30 text-white font-black shadow-md shadow-red-500/10">
              K
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Warning Alert banner */}
        <div className="bg-amber-50/70 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5.5 w-5.5 text-amber-500 flex-shrink-0 animate-bounce" />
            <div>
              <p className="text-sm font-bold text-amber-850 dark:text-amber-400 leading-none">{dict.important}</p>
              <p className="text-xs sm:text-sm text-amber-750 dark:text-amber-300 font-semibold mt-1.5 leading-relaxed">{dict.importantDesc}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Form Fields */}
            <div className="glass-panel p-5 rounded-2xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">{dict.txnNum}</label>
                <input 
                  type="text" 
                  required
                  autoFocus
                  value={transactionNumber}
                  onChange={(e) => setTransactionNumber(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-red-500 transition-all text-base font-mono font-bold"
                  placeholder="e.g. TXN-98273"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">{dict.cashierName}</label>
                <input 
                  type="text" 
                  required
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 text-slate-500 outline-none cursor-not-allowed font-bold"
                  readOnly
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">{dict.register}</label>
                  <select 
                    value={register}
                    onChange={(e) => setRegister(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-red-500 transition-all font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="Cash 1">Cash 1</option>
                    <option value="Cash 2">Cash 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">{dict.amount}</label>
                  <div className="relative">
                    <NumericFormat 
                      required
                      value={amount}
                      onValueChange={(values) => setAmount(values.value)}
                      thousandSeparator=","
                      allowNegative={false}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      className={`w-full p-3 ${lang === "ar" ? "pl-12" : "pr-12"} rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-red-500 transition-all font-mono font-black text-red-600 dark:text-red-400 text-lg`}
                      placeholder="0.00"
                    />
                    <span className={`absolute ${lang === "ar" ? "left-4" : "right-4"} top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 dark:text-slate-500`}>EGP</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">{dict.customerName}</label>
                <input 
                  type="text" 
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-red-500 transition-all font-bold"
                  placeholder="Full Name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">{dict.customerPhone}</label>
                <input 
                  type="tel" 
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-red-500 transition-all font-mono font-bold"
                  placeholder="01xxxxxxxxx"
                />
              </div>
            </div>
            
            {/* Right Column: Reason and Signature */}
            <div className="space-y-6">
              
              {/* Reason */}
              <section className="glass-panel p-5 rounded-2xl space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">{dict.reason}</label>
                  <textarea 
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm h-28 resize-none"
                    placeholder={dict.reasonPlaceholder}
                  />
                </div>
              </section>

              {/* Signature Capture */}
              <section className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-150 dark:border-slate-800 pb-3">
                  <UserIcon className="h-5 w-5 text-red-500" />
                  <h2 className="text-sm font-bold text-slate-850 dark:text-slate-250 uppercase">{dict.signTitle}</h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{dict.signDesc}</p>
                <SignaturePad 
                  dict={dict} 
                  onSave={(data) => setCashierSignature(data)} 
                  onClear={() => setCashierSignature("")} 
                />
                <input type="text" value={cashierSignature} readOnly required className="h-0 w-0 opacity-0 absolute pointer-events-none" />
              </section>
            </div>
          </div>

          {/* Fixed Footer */}
          <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
            <div className="max-w-4xl mx-auto flex items-center justify-end">
              <button 
                type="submit" 
                disabled={loading}
                className={`w-full sm:w-auto px-8 py-3.5 ${loading ? 'bg-slate-500 opacity-50 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-[0.98] cursor-pointer'} text-white rounded-xl font-bold shadow-lg shadow-red-500/15 transition-all flex items-center justify-center gap-2`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    {dict.submitting}
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-5 w-5" /> {dict.submit}
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </main>
    </div>
  );
}
