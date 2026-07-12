"use client";

import { useState, useEffect } from "react";
import { db, dbService } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, limit } from "firebase/firestore";
import { PageTransition } from "@/components/PageTransition";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "next-themes";

import { AlertCircle, CheckCircle2, Lock, ScanLine, Camera, Edit2, Save, X, Package } from "lucide-react";
import { CameraScanner } from "@/components/ui/CameraScanner";

export default function CashierInventoryAudit() {
  const { language: lang } = useLanguage();
  const { setTheme } = useTheme();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setTheme("light");
  }, [setTheme]);

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
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const [myScans, setMyScans] = useState<any[]>([]);
  const [editingScanId, setEditingScanId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [productNameDisplay, setProductNameDisplay] = useState("");

  // Listen for barcode changes to show product name instantly
  useEffect(() => {
    if (!barcode.trim()) {
      setProductNameDisplay("");
      return;
    }
    const fetchName = async () => {
      try {
         const pQuery = query(collection(db, "products"), where("barcode", "==", barcode.trim()), limit(1));
         const pSnap = await getDocs(pQuery);
         if (!pSnap.empty) {
           const data = pSnap.docs[0].data();
           setProductNameDisplay(data.itemName || data.description || "");
         } else {
           setProductNameDisplay("");
         }
      } catch(e) {}
    };
    fetchName();
  }, [barcode]);

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

  // Listen for THIS cashier's scans
  useEffect(() => {
    if (!activeBatch?.id || !user?.email) {
      setMyScans([]);
      return;
    }

    // Query by batchId only to avoid composite index requirements, filter client-side
    const q = query(
      collection(db, "audit_scans"),
      where("batchId", "==", activeBatch.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allScans = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter to only show the logged-in cashier's scans
      const filtered = allScans.filter((s: any) => {
        return (
          (user?.name && s.cashierName === user.name) ||
          (user?.id && s.cashierId === user.id) ||
          (user?.email && s.cashierEmail === user.email && s.cashierEmail !== "Unknown")
        );
      });
      // Sort by timestamp descending
      filtered.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setMyScans(filtered);
    });

    return () => unsubscribe();
  }, [activeBatch?.id, user?.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim() || !quantity || !activeBatch) return;

    setSubmitting(true);
    try {
      const bcode = barcode.trim();
      let productName = "";
      
      // Attempt to look up product name
      try {
        const pQuery = query(collection(db, "products"), where("barcode", "==", bcode), limit(1));
        const pSnap = await getDocs(pQuery);
        if (!pSnap.empty) {
          const pData = pSnap.docs[0].data();
          productName = pData.itemName || pData.description || "";
        }
      } catch (err) {
        console.error("Failed to fetch product name", err);
      }

      await dbService.addDoc("audit_scans", {
        batchId: activeBatch.id,
        barcode: bcode,
        productName,
        quantity: Number(quantity),
        cashierEmail: user?.email || "Unknown",
        cashierName: user?.name || "Unknown",
        cashierId: user?.id || user?.employeeId || "Unknown",
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

  const handleUpdateScan = async (scanId: string) => {
    if (!editQuantity) return;
    try {
      await dbService.updateDoc("audit_scans", scanId, {
        quantity: Number(editQuantity),
        updatedAt: new Date().toISOString()
      });
      setEditingScanId(null);
      setEditQuantity("");
    } catch (e) {
      console.error("Error updating scan", e);
      alert("Failed to update.");
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
                <div className="flex gap-2">
                  <input
                    id="barcode-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder={lang === "ar" ? "امسح الباركود..." : "Scan barcode..."}
                    className="flex-1 p-4 border-2 border-slate-200 rounded-xl bg-slate-50 font-mono text-lg font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
                    required
                    autoFocus
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="p-4 bg-slate-800 text-white rounded-xl shadow-lg hover:bg-slate-700 transition-colors flex items-center justify-center shrink-0"
                  >
                    <Camera className="w-6 h-6" />
                  </button>
                </div>
                {productNameDisplay && (
                  <div className="mt-4 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 shadow-inner flex flex-col items-center justify-center animate-in zoom-in fade-in duration-300">
                    <span className="text-xs font-bold text-blue-500 mb-1 flex items-center gap-1 uppercase tracking-widest">
                      <Package className="w-4 h-4" /> 
                      {lang === "ar" ? "الصنف" : "Item Scanned"}
                    </span>
                    <p className="text-2xl font-black text-blue-800 text-center leading-tight">
                      {productNameDisplay}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {lang === "ar" ? "الكمية الفعلية" : "Actual Quantity"}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="any"
                  className="w-full p-4 border-2 border-slate-200 rounded-xl bg-slate-50 text-2xl font-black text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all text-center shadow-inner"
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

            {/* My Scans Section */}
            <div className="mt-8 border-t-2 border-slate-100 pt-6">
              <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center justify-between">
                <span>{lang === "ar" ? "قائمة الجرد الخاصة بي" : "My Scan History"}</span>
                <span className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-full">{myScans.length}</span>
              </h2>

              {myScans.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                  <p className="text-sm font-bold text-slate-400">
                    {lang === "ar" ? "لم تقم بتسجيل أي أصناف بعد." : "No items scanned yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {myScans.map(scan => (
                    <div key={scan.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-700">{scan.barcode}</span>
                          {scan.productName && (
                            <span className="text-xs font-semibold text-slate-500">{scan.productName}</span>
                          )}
                        </div>
                        {editingScanId === scan.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="number"
                              className="w-20 p-2 text-center font-black border-2 border-blue-500 rounded-lg outline-none"
                              value={editQuantity}
                              onChange={e => setEditQuantity(e.target.value)}
                              autoFocus
                            />
                            <button onClick={() => handleUpdateScan(scan.id)} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
                              <Save className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingScanId(null)} className="p-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-black text-blue-600">{scan.quantity}</span>
                            <button onClick={() => { setEditingScanId(scan.id); setEditQuantity(scan.quantity.toString()); }} className="p-1.5 text-slate-400 hover:text-blue-600 bg-white rounded shadow-sm border border-slate-200">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        {new Date(scan.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {isScannerOpen && (
        <CameraScanner 
          onScan={(decodedText) => {
            setBarcode(decodedText);
            setQuantity("");
            // Auto-focus quantity input after short delay to allow re-render
            setTimeout(() => {
              const qtyInput = document.querySelector('input[type="number"]') as HTMLInputElement;
              if (qtyInput) qtyInput.focus();
            }, 100);
          }} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}
    </PageTransition>
  );
}
