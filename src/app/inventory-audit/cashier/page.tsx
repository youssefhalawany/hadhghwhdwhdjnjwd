"use client";

import { useState, useEffect } from "react";
import { db, dbService } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { PageTransition } from "@/components/PageTransition";
import { useLanguage } from "@/context/LanguageContext";

import { AlertCircle, CheckCircle2, Lock, ScanLine } from "lucide-react";

export default function CashierInventoryAudit() {
  const { language: lang } = useLanguage();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr);
        setUser(savedUser);
      } catch (e) {
        console.error("Invalid session data");
      }
    }
  }, []);
  const [activeBatch, setActiveBatch] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Listen for open audit batches
  useEffect(() => {
    const q = query(
      collection(db, "audit_batches"),
      where("status", "==", "OPEN")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Just take the first open batch for simplicity
        setActiveBatch({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setActiveBatch(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to audit batches:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim() || !quantity || !activeBatch) return;

    setSubmitting(true);
    try {
      await dbService.addDoc("audit_scans", {
        batchId: activeBatch.id,
        barcode: barcode.trim(),
        quantity: Number(quantity),
        cashierEmail: user?.email || "Unknown",
        timestamp: new Date().toISOString()
      });
      
      setSuccessMsg(lang === "ar" ? "تم تسجيل الصنف بنجاح!" : "Item scanned successfully!");
      setBarcode("");
      setQuantity("");
      
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (error) {
      console.error("Error submitting scan:", error);
      alert(lang === "ar" ? "حدث خطأ" : "An error occurred");
    } finally {
      setSubmitting(false);
      // Auto-focus barcode again if possible
      document.getElementById('barcode-input')?.focus();
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </PageTransition>
    );
  }

  // LOCKED STATE: No open batch
  if (!activeBatch) {
    return (
      <PageTransition>
        <div className="max-w-2xl mx-auto p-4 md:p-8 min-h-[80vh] flex flex-col items-center justify-center text-center">
          <div className="bg-slate-100 p-8 rounded-full mb-6">
            <Lock className="w-16 h-16 text-slate-400" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">
            {lang === "ar" ? "نظام الجرد مغلق" : "Audit System Locked"}
          </h1>
          <p className="text-slate-500 font-medium max-w-md">
            {lang === "ar" 
              ? "في انتظار المدير لفتح جلسة جرد جديدة. يرجى الانتظار." 
              : "Waiting for a manager to open a new audit session. Please stand by."}
          </p>
        </div>
      </PageTransition>
    );
  }

  // ACTIVE STATE: Batch is open
  return (
    <PageTransition>
      <div className="max-w-md mx-auto p-4 md:p-6" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {lang === "ar" ? "الجرد العشوائي (العمياء)" : "Blind Cycle Count"}
            </h1>
            <p className="text-xs font-bold text-emerald-600 mt-1 uppercase tracking-widest flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {lang === "ar" ? "جلسة مفتوحة" : "Session Active"}
            </p>
          </div>
        </div>

        <div className="border-2 border-slate-200 shadow-xl rounded-2xl overflow-hidden bg-white">
          <div className="bg-slate-900 p-4 text-white">
            <div className="flex items-center gap-3 opacity-90">
              <ScanLine className="w-5 h-5 text-blue-400" />
              <p className="text-xs font-mono tracking-widest">BATCH: {activeBatch.id.substring(0, 15)}...</p>
            </div>
          </div>
          <div className="p-6">
            
            {successMsg && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                <CheckCircle2 className="w-6 h-6 shrink-0" />
                <p className="font-bold text-sm">{successMsg}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {lang === "ar" ? "الباركود" : "Barcode"}
                </label>
                <input
                  id="barcode-input"
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder={lang === "ar" ? "امسح الباركود..." : "Scan barcode..."}
                  className="w-full p-4 border-2 border-slate-200 rounded-xl bg-slate-50 font-mono text-lg font-bold outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
                  required
                  autoFocus
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {lang === "ar" ? "الكمية الفعلية" : "Actual Quantity"}
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="any"
                  className="w-full p-4 border-2 border-slate-200 rounded-xl bg-slate-50 text-2xl font-black outline-none focus:border-blue-500 focus:bg-white transition-all text-center shadow-inner"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || !barcode || !quantity}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-lg shadow-lg hover:bg-blue-700 hover:shadow-blue-500/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none uppercase tracking-wide"
                >
                  {submitting 
                    ? (lang === "ar" ? "جاري التسجيل..." : "Submitting...") 
                    : (lang === "ar" ? "تسجيل الكمية" : "Submit Count")}
                </button>
              </div>
            </form>

            <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-amber-800">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-xs font-medium leading-relaxed">
                {lang === "ar" 
                  ? "تحذير: لا يمكنك تعديل أو مراجعة الأصناف بعد تسجيلها. تأكد من دقة الكمية قبل الضغط على تسجيل." 
                  : "Warning: You cannot edit or review items after submitting. Ensure the quantity is accurate before pressing submit."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
