"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, orderBy, limit, updateDoc, doc } from "firebase/firestore";
import { Calculator, Package, Banknote, Calendar, Clock, ArrowRight, Lock, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CashierShiftReportPage() {
  const router = useRouter();

  const [cashiers, setCashiers] = useState<any[]>([]);
  const [selectedCashierId, setSelectedCashierId] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loadingCashiers, setLoadingCashiers] = useState(true);

  // Cashier Details
  const [date, setDate] = useState("");
  const [shift, setShift] = useState("Morning");
  const [cashierRole, setCashierRole] = useState<number>(1);
  
  // Cashier Money Counts
  const [cash, setCash] = useState<string>("");
  const [visa, setVisa] = useState<string>("");

  // Inventory
  const [cigarettes, setCigarettes] = useState({ start: "", delivery: "", end: "" });
  const [lighters, setLighters] = useState({ start: "", delivery: "", end: "" });

  const [existingReportId, setExistingReportId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCashiers = async () => {
      try {
        const snap = await getDocs(collection(db, "cashiers"));
        setCashiers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Failed to load cashiers", e);
      } finally {
        setLoadingCashiers(false);
      }
    };
    fetchCashiers();
    setDate(new Date().toISOString().substring(0, 10));
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = cashiers.find(x => x.id === selectedCashierId);
    if (!c) return alert("Select your name");
    if (c.pin !== pinInput) {
      alert("Incorrect PIN");
      return;
    }

    setUnlocked(true);
    setLoading(true);

    try {
      // 1. Check if there is a rejected report for this cashier today
      const rejectQuery = query(
        collection(db, "shift_reports"),
        where("cashierDetails.name", "==", c.name),
        where("status", "==", "rejected")
      );
      
      const rejectSnap = await getDocs(rejectQuery);
      if (!rejectSnap.empty) {
        // Sort in memory to get the latest without needing a composite index
        const sortedDocs = rejectSnap.docs.sort((a, b) => 
          b.data().createdAt.localeCompare(a.data().createdAt)
        );
        const rejectedReport = sortedDocs[0];
        const data = rejectedReport.data();
        
        setExistingReportId(rejectedReport.id);
        setRejectReason(data.managerAudit?.rejectReason || "No reason provided by manager.");
        setOriginalData({
          cash: data.cashierCounts.cash,
          visa: data.cashierCounts.visa,
          cigEnd: data.inventoryCounts?.cigarettes?.end || 0,
          lightEnd: data.inventoryCounts?.lighters?.end || 0
        });
        
        // Auto-fill their old inputs
        setShift(data.cashierDetails.shift);
        setCashierRole(data.cashierRole || 1);
        setCash(String(data.cashierCounts.cash));
        setVisa(String(data.cashierCounts.visa));
        setCigarettes({
          start: String(data.inventoryCounts?.cigarettes?.start || ""),
          delivery: String(data.inventoryCounts?.cigarettes?.delivery || ""),
          end: String(data.inventoryCounts?.cigarettes?.end || "")
        });
        setLighters({
          start: String(data.inventoryCounts?.lighters?.start || ""),
          delivery: String(data.inventoryCounts?.lighters?.delivery || ""),
          end: String(data.inventoryCounts?.lighters?.end || "")
        });
        
        setLoading(false);
        return; // Skip the auto-fetch for a new report since we are editing a rejected one
      }

      // 2. If no rejected report, Auto-fetch previous shift's end inventory for this store
      const prevQuery = query(
        collection(db, "shift_reports"),
        where("cashierDetails.storeId", "==", c.storeId),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const prevSnap = await getDocs(prevQuery);
      if (!prevSnap.empty) {
        const lastReport = prevSnap.docs[0].data();
        const cigEnd = lastReport.inventoryCounts?.cigarettes?.end || 0;
        const lightEnd = lastReport.inventoryCounts?.lighters?.end || 0;
        setCigarettes(prev => ({ ...prev, start: String(cigEnd) }));
        setLighters(prev => ({ ...prev, start: String(lightEnd) }));
      }
    } catch (e) {
      console.error("Could not fetch data on unlock", e);
      // Fails silently if no previous records or missing composite index
    } finally {
      setLoading(false);
    }
  };

  const calculateSold = (start: string, delivery: string, end: string) => {
    const s = Number(start) || 0;
    const d = Number(delivery) || 0;
    const e = Number(end) || 0;
    return s + d - e;
  };

  const calculateTotalMoney = () => {
    return (Number(cash) || 0) + (Number(visa) || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const c = cashiers.find(x => x.id === selectedCashierId);

    try {
      const payload = {
        status: "pending_manager",
        createdAt: new Date().toISOString(),
        cashierDetails: {
          name: c.name,
          date,
          shift,
          storeId: c.storeId
        },
        cashierRole,
        cashierCounts: {
          cash: Number(cash) || 0,
          visa: Number(visa) || 0,
          total: calculateTotalMoney()
        },
        inventoryCounts: {
          cigarettes: {
            start: Number(cigarettes.start) || 0,
            delivery: Number(cigarettes.delivery) || 0,
            end: Number(cigarettes.end) || 0,
            sold: calculateSold(cigarettes.start, cigarettes.delivery, cigarettes.end)
          },
          lighters: {
            start: Number(lighters.start) || 0,
            delivery: Number(lighters.delivery) || 0,
            end: Number(lighters.end) || 0,
            sold: calculateSold(lighters.start, lighters.delivery, lighters.end)
          }
        }
      };

      let submittedId = "";
      if (existingReportId) {
        // Edit rejected report
        const updatePayload = {
          ...payload,
          previousSubmission: originalData || null
        };
        await updateDoc(doc(db, "shift_reports", existingReportId), updatePayload);
        submittedId = existingReportId;
      } else {
        // Create new report
        const docRef = await addDoc(collection(db, "shift_reports"), payload);
        submittedId = docRef.id;
      }
      
      router.push(`/shift-reports/cashier/success/${submittedId}`);
    } catch (error) {
      console.error("Error submitting shift report:", error);
      alert("Failed to submit. Please check your connection and try again.");
      setLoading(false);
    }
  };

  if (loadingCashiers) {
    return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-600"></div></div>;
  }

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto space-y-6 pt-10">
        <div className="text-center py-4 border-b border-border mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-full mb-4 shadow-lg shadow-red-500/20">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Shift Access</h1>
          <p className="text-sm text-muted-foreground uppercase font-bold tracking-widest mt-2">Authorized Cashiers Only</p>
        </div>

        <form onSubmit={handleUnlock} className="glass-panel p-6 rounded-2xl space-y-6 border border-border">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><UserIcon className="h-4 w-4" /> Cashier Name</label>
            <select 
              required
              value={selectedCashierId}
              onChange={(e) => setSelectedCashierId(e.target.value)}
              className="w-full p-4 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-red-500 text-lg appearance-none"
            >
              <option value="" disabled>-- Select your name --</option>
              {cashiers.map(c => (
                <option key={c.id} value={c.id}>{c.name} (Store: {c.storeId})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><Lock className="h-4 w-4" /> 4-Digit PIN</label>
            <input 
              required
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full p-4 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-red-500 text-center text-3xl tracking-[1em] font-mono"
              placeholder="••••"
            />
          </div>

          <button type="submit" className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg shadow-xl shadow-red-500/20 transition-all">
            Unlock Shift Input
          </button>
        </form>
      </div>
    );
  }

  const activeCashier = cashiers.find(x => x.id === selectedCashierId);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-screen bg-background text-foreground max-w-md mx-auto shadow-2xl relative">
      
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-10 flex items-center justify-between border-b border-slate-800">
        <div>
          <h1 className="text-xl font-black tracking-tight">Daily Shift Report</h1>
          <p className="text-xs text-slate-400 font-semibold">{new Date().toLocaleDateString('en-GB')}</p>
        </div>
        <div className="h-10 w-10 bg-red-600 rounded-full flex items-center justify-center border-2 border-red-500/30">
          <span className="font-black text-xl">K</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 relative">
        {rejectReason && (
          <div className="bg-red-50 border-b border-red-200 p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="bg-red-100 p-2 rounded-full flex-shrink-0">
                <Lock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-red-800 font-bold text-sm">Report Rejected by Manager</h3>
                <p className="text-red-600 text-xs mt-1 font-medium leading-snug">
                  "{rejectReason}"
                </p>
                <p className="text-red-500 text-[10px] mt-2 font-bold uppercase tracking-wider">
                  Please correct your numbers below and resubmit.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 space-y-6">
          
          {/* 1. Shift Info */}
          <section className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Clock className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-bold text-foreground">Shift Information</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> Date</label>
                <input required type="date" value={date} readOnly className="w-full p-3 rounded-xl border border-border bg-muted/50 text-slate-500 outline-none cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Shift</label>
                <select value={shift} onChange={(e) => setShift(e.target.value)} className="w-full p-3 rounded-xl border border-border bg-background outline-none appearance-none">
                  <option value="Morning">Morning</option>
                  <option value="Noon">Noon</option>
                  <option value="Night">Night</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><UserIcon className="h-3 w-3" /> Register Role</label>
                <select value={cashierRole} onChange={(e) => setCashierRole(Number(e.target.value))} className="w-full p-3 rounded-xl border border-border bg-background outline-none appearance-none font-bold text-foreground focus:ring-2 focus:ring-red-500">
                  <option value={1}>Cashier 1 (Full Register & Inventory)</option>
                  <option value={2}>Cashier 2 (Money Only)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1 text-slate-400">Assigned Store ID</label>
              <div className="w-full p-3 rounded-xl border border-border bg-muted/50 text-slate-500 font-mono">
                {activeCashier?.storeId}
              </div>
            </div>
          </section>

          {/* 2. Cashier Money */}
          <section className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Banknote className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-bold text-foreground">Cashier Drops</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Actual Cash Inside Drop</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">EGP</span>
                  <input required type="number" min="0" step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} className="w-full pl-14 p-4 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-emerald-500 text-xl font-mono text-emerald-600 dark:text-emerald-400" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Total Visa Slips Inside Drop</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">EGP</span>
                  <input required type="number" min="0" step="0.01" value={visa} onChange={(e) => setVisa(e.target.value)} className="w-full pl-14 p-4 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-blue-500 text-xl font-mono text-blue-600 dark:text-blue-400" placeholder="0.00" />
                </div>
              </div>
              <div className="pt-4 border-t border-border flex justify-between items-center bg-muted/30 p-4 rounded-xl border-dashed">
                <span className="text-sm font-bold text-muted-foreground uppercase">Total Declared Drops:</span>
                <span className="text-2xl font-black text-foreground">{calculateTotalMoney().toFixed(2)}</span>
              </div>
            </div>
          </section>

          {/* 3. Inventory Checks (Only shown for Cashier 1) */}
          {cashierRole === 1 && (
            <section className="glass-panel p-5 rounded-2xl space-y-6">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Package className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-bold text-foreground">Inventory Checks</h2>
              </div>
              
              {/* Cigarettes */}
              <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border">
                <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-border pb-2 uppercase tracking-wide text-xs">Cigarettes (Packs)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Start</label>
                    <input required type="number" min="0" value={cigarettes.start} onChange={(e) => setCigarettes({ ...cigarettes, start: e.target.value })} className="w-full p-2.5 rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-orange-500 text-center font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 text-emerald-500">+ Delivery</label>
                    <input required type="number" min="0" value={cigarettes.delivery} onChange={(e) => setCigarettes({ ...cigarettes, delivery: e.target.value })} className="w-full p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 outline-none focus:ring-2 focus:ring-emerald-500 text-center font-mono text-emerald-600" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 text-red-500">- End Count</label>
                    <input required type="number" min="0" value={cigarettes.end} onChange={(e) => setCigarettes({ ...cigarettes, end: e.target.value })} className="w-full p-2.5 rounded-lg border border-red-500/30 bg-red-500/5 outline-none focus:ring-2 focus:ring-red-500 text-center font-mono text-red-600 font-bold" />
                  </div>
                  <div className="bg-slate-900 rounded-lg p-2.5 text-center border border-slate-700 flex flex-col justify-center">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Sold Packs</label>
                    <span className="font-black text-white text-lg">{calculateSold(cigarettes.start, cigarettes.delivery, cigarettes.end)}</span>
                  </div>
                </div>
              </div>

              {/* Lighters */}
              <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border">
                <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-border pb-2 uppercase tracking-wide text-xs">Lighters (Units)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Start</label>
                    <input required type="number" min="0" value={lighters.start} onChange={(e) => setLighters({ ...lighters, start: e.target.value })} className="w-full p-2.5 rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-orange-500 text-center font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 text-emerald-500">+ Delivery</label>
                    <input required type="number" min="0" value={lighters.delivery} onChange={(e) => setLighters({ ...lighters, delivery: e.target.value })} className="w-full p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 outline-none focus:ring-2 focus:ring-emerald-500 text-center font-mono text-emerald-600" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 text-red-500">- End Count</label>
                    <input required type="number" min="0" value={lighters.end} onChange={(e) => setLighters({ ...lighters, end: e.target.value })} className="w-full p-2.5 rounded-lg border border-red-500/30 bg-red-500/5 outline-none focus:ring-2 focus:ring-red-500 text-center font-mono text-red-600 font-bold" />
                  </div>
                  <div className="bg-slate-900 rounded-lg p-2.5 text-center border border-slate-700 flex flex-col justify-center">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Sold Units</label>
                    <span className="font-black text-white text-lg">{calculateSold(lighters.start, lighters.delivery, lighters.end)}</span>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* SUBMIT */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border z-10">
          <div className="max-w-md mx-auto">
            <button type="submit" disabled={loading} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg shadow-xl shadow-red-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {loading ? "Submitting..." : <>{existingReportId ? "Resubmit Corrected Report" : "Submit Shift Report"} <ArrowRight className="h-5 w-5" /></>}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
