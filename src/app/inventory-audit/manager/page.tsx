"use client";

import { useState, useEffect, useRef } from "react";
import { db, dbService } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { PageTransition } from "@/components/PageTransition";
import { useLanguage } from "@/context/LanguageContext";
import { ShieldAlert, FileText, Package, AlertTriangle, ArrowRightLeft, Plus } from "lucide-react";
import Barcode from 'react-barcode';

export default function ManagerInventoryAudit() {
  const { language: lang } = useLanguage();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // For managers, we usually rely on circlek_role or similar. Let's just create a dummy manager user or fetch from session if needed, or rely on auth wrapper
    const role = localStorage.getItem("circlek_role");
    setUser({ role: role || "manager", name: "Manager" });
  }, []);
  const [activeBatch, setActiveBatch] = useState<any | null>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [allBatches, setAllBatches] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"active" | "history">("active");
  const [selectedHistoryBatch, setSelectedHistoryBatch] = useState<any | null>(null);
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Grouped and reconciled data
  const [reconciliationData, setReconciliationData] = useState<Record<string, any>>({});

  // 1. Listen to the latest OPEN or CLOSED batch
  useEffect(() => {
    // Ideally we would query by branch and status, but for simplicity we just get all non-finalized
    const q = query(
      collection(db, "audit_batches"),
      where("status", "in", ["OPEN", "CLOSED", "FINALIZED"])
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Sort by openedAt client-side since we have an 'in' query
        const batches = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        batches.sort((a: any, b: any) => {
          const parseDate = (d: any) => {
            if (!d) return 0;
            if (d.seconds) return d.seconds * 1000;
            const time = new Date(d).getTime();
            return isNaN(time) ? 0 : time;
          };
          const timeA = parseDate(a.openedAt);
          const timeB = parseDate(b.openedAt);
          return timeB - timeA;
        });
        
        setAllBatches(batches);
        
        // Prioritize active sessions: OPEN -> CLOSED -> FINALIZED
        const openBatch = batches.find((b: any) => b.status === "OPEN");
        const closedBatch = batches.find((b: any) => b.status === "CLOSED");
        
        setActiveBatch(openBatch || closedBatch || null);
      } else {
        setAllBatches([]);
        setActiveBatch(null);
      }
      setLoading(false);
    }, (error: any) => {
      console.error("Error listening to audit batches:", error);
      alert("Error listening to audit batches: " + error.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Listen to scans for the active batch
  useEffect(() => {
    if (!activeBatch?.id) {
      setScans([]);
      return;
    }
    const q = query(
      collection(db, "audit_scans"),
      where("batchId", "==", activeBatch.id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scanDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setScans(scanDocs);
    });
    return () => unsubscribe();
  }, [activeBatch?.id]);

  // 3. Aggregate scans into reconciliation data whenever scans or batch changes
  useEffect(() => {
    if (activeBatch?.status === "FINALIZED" && activeBatch.reconciliationData) {
      const reconMap: Record<string, any> = {};
      activeBatch.reconciliationData.forEach((item: any) => {
        reconMap[item.barcode] = item;
      });
      setReconciliationData(reconMap);
      return;
    }

    const aggregated: Record<string, any> = {};
    
    scans.forEach(scan => {
      if (!aggregated[scan.barcode]) {
        // Preserve existing inputs if any exist in reconciliationData
        // Also check if the activeBatch has a saved draft we should use
        const draft = activeBatch?.reconciliationDraft?.[scan.barcode];
        const existing = reconciliationData[scan.barcode] || draft || {};
        
        aggregated[scan.barcode] = {
          barcode: scan.barcode,
          productName: scan.productName || existing.productName || draft?.productName || "",
          actualQuantity: 0,
          adjustedActualQuantity: existing.adjustedActualQuantity ?? draft?.adjustedActualQuantity ?? "",
          systemQuantity: existing.systemQuantity || "",
          transferIn: existing.transferIn || "",
          transferOut: existing.transferOut || ""
        };
      }
      aggregated[scan.barcode].actualQuantity += scan.quantity;
    });

    // Merge any existing items that were manually added but not scanned yet
    // Include drafts from the server
    const keysToMerge = new Set([
      ...Object.keys(reconciliationData),
      ...Object.keys(activeBatch?.reconciliationDraft || {})
    ]);

    keysToMerge.forEach(barcode => {
      if (!aggregated[barcode]) {
         const draft = activeBatch?.reconciliationDraft?.[barcode] || {};
         const local = reconciliationData[barcode] || {};
         aggregated[barcode] = {
           barcode,
           productName: local.productName || draft.productName || "",
           actualQuantity: 0,
           adjustedActualQuantity: local.adjustedActualQuantity ?? draft.adjustedActualQuantity ?? "",
           systemQuantity: local.systemQuantity || draft.systemQuantity || "",
           transferIn: local.transferIn || draft.transferIn || "",
           transferOut: local.transferOut || draft.transferOut || ""
         };
      }
    });

    setReconciliationData(aggregated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scans, activeBatch?.status]);

  const handleStartBatch = async () => {
    const batchId = `AUDIT-${new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14)}`;
    try {
      console.log("Attempting to create batch:", batchId);
      // Clear local reconciliation data for the new batch
      setReconciliationData({});
      await dbService.setDoc("audit_batches", batchId, {
        status: "OPEN",
        openedAt: new Date().toISOString(),
        managerEmail: user?.email || "Unknown Manager"
      });
      console.log("Successfully created batch");
    } catch (e: any) {
      console.error("Error starting batch", e);
      alert("Error starting batch: " + (e?.message || "Unknown error"));
    }
  };

  const handleCloseBatch = async () => {
    if (!activeBatch) return;
    if (!confirm(lang === "ar" ? "هل أنت متأكد من إغلاق الجلسة؟ لن يتمكن الكاشير من مسح أي أصناف أخرى." : "Are you sure you want to close this session? Cashiers will not be able to scan more items.")) return;
    
    try {
      await dbService.updateDoc("audit_batches", activeBatch.id, {
        status: "CLOSED",
        closedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error closing batch", e);
    }
  };

  const handleFinalizeAndPrint = async () => {
    if (!activeBatch) return;
    if (!confirm(lang === "ar" ? "تأكيد الجرد نهائياً؟ لا يمكن التراجع عن هذا الإجراء وسيتم طباعة التقرير." : "Finalize Audit? This cannot be undone and will print the official report.")) return;
    
    try {
      // Save the final reconciliation data directly onto the batch
      await dbService.updateDoc("audit_batches", activeBatch.id, {
        status: "FINALIZED",
        finalizedAt: new Date().toISOString(),
        reconciliationData: Object.values(reconciliationData)
      });
      // After finalizing, trigger print
      setTimeout(() => window.print(), 500);
      
      // Since status changes to FINALIZED, it will drop off the activeBatch listener.
      // But we still want to show the print layout for a moment.
    } catch (e) {
      console.error("Error finalizing batch", e);
    }
  };

  const updateHistoryReconField = (barcode: string, field: string, value: string) => {
    if (!selectedHistoryBatch) return;
    const newData = (selectedHistoryBatch.reconciliationData || []).map((item: any) => {
      if (item.barcode === barcode) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setSelectedHistoryBatch({ ...selectedHistoryBatch, reconciliationData: newData });
  };

  const handleSaveHistory = async () => {
    if (!selectedHistoryBatch) return;
    setIsSavingHistory(true);
    try {
      await dbService.updateDoc("audit_batches", selectedHistoryBatch.id, {
        reconciliationData: selectedHistoryBatch.reconciliationData
      });
      alert(lang === "ar" ? "تم الحفظ بنجاح!" : "Changes saved successfully!");
    } catch (e) {
      console.error("Error saving history", e);
      alert("Error saving changes.");
    } finally {
      setIsSavingHistory(false);
    }
  };

  const generateAISummary = async () => {
    if (!selectedHistoryBatch) return;
    setIsGeneratingAI(true);
    try {
      const res = await fetch("/api/audit-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reconData: selectedHistoryBatch.reconciliationData || [] })
      });
      const data = await res.json();
      if (data.success) {
        await dbService.updateDoc("audit_batches", selectedHistoryBatch.id, {
          aiSummary: data.summary
        });
        setSelectedHistoryBatch({ ...selectedHistoryBatch, aiSummary: data.summary });
        alert(lang === "ar" ? "تم إنشاء الملخص الذكي بنجاح!" : "AI Summary generated successfully!");
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      console.error(e);
      alert("Error generating AI summary: " + e.message);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Auto-save drafts when reconciliation changes
  // We use a simple ref to avoid saving on the first render/load
  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    
    // Only save draft if batch is active and not finalized
    if (activeBatch && activeBatch.status !== "FINALIZED") {
      const saveDraft = setTimeout(async () => {
        try {
          await dbService.updateDoc("audit_batches", activeBatch.id, {
            reconciliationDraft: reconciliationData
          });
        } catch(e) {
          console.error("Draft save failed", e);
        }
      }, 1000); // 1 second debounce
      return () => clearTimeout(saveDraft);
    }
  }, [reconciliationData, activeBatch?.id, activeBatch?.status]);

  const updateReconField = (barcode: string, field: string, value: string) => {
    setReconciliationData(prev => {
      const item = prev[barcode] || { barcode, actualQuantity: 0, systemQuantity: "", transferIn: "", transferOut: "" };
      return {
        ...prev,
        [barcode]: { ...item, [field]: value }
      };
    });
  };

  const addNewReconRow = () => {
    const fakeBarcode = prompt("Enter a barcode for the missing item:");
    if (fakeBarcode && !reconciliationData[fakeBarcode]) {
      setReconciliationData(prev => ({
        ...prev,
        [fakeBarcode]: { barcode: fakeBarcode, actualQuantity: 0, systemQuantity: "", transferIn: "", transferOut: "" }
      }));
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

  const reconList = Object.values(reconciliationData).sort((a, b) => b.actualQuantity - a.actualQuantity);

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 md:p-6" dir={lang === "ar" ? "rtl" : "ltr"}>
        
        <div className="mb-6 flex items-center justify-between no-print">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {lang === "ar" ? "إدارة الجرد (مدير)" : "Audit Manager Dashboard"}
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">
              Branch Level Blind Cycle Counting
            </p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-4 mb-6 border-b border-slate-200 no-print">
          <button
            onClick={() => setViewMode("active")}
            className={`pb-3 font-bold text-lg transition-colors border-b-2 ${viewMode === "active" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            Active Audit
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`pb-3 font-bold text-lg transition-colors border-b-2 ${viewMode === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            History
          </button>
        </div>

        {viewMode === "history" ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 no-print">
            <h2 className="text-xl font-bold mb-4">Past Audits</h2>
            {allBatches.filter(b => b.status === "FINALIZED").length === 0 ? (
              <p className="text-slate-500">No finalized audits found.</p>
            ) : (
              <div className="space-y-4">
                {allBatches.filter(b => b.status === "FINALIZED").map(batch => (
                  <div key={batch.id} className="p-4 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <h3 className="font-bold text-slate-900 uppercase tracking-tight">BATCH: {batch.id}</h3>
                      <p className="text-sm font-bold text-slate-500 mt-1">{new Date(batch.finalizedAt || batch.openedAt).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => setSelectedHistoryBatch(batch)}
                      className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors"
                    >
                      View Report
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Modal for selected history batch */}
            {selectedHistoryBatch && (
              <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6 relative">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black uppercase tracking-tight">Audit Report: {selectedHistoryBatch.id}</h2>
                    <div className="flex gap-3 no-print">
                      <button onClick={generateAISummary} disabled={isGeneratingAI} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-black hover:bg-purple-700 transition-colors shadow-lg disabled:opacity-50">
                        {isGeneratingAI ? "Generating..." : "✨ AI SUMMARY"}
                      </button>
                      <button onClick={handleSaveHistory} disabled={isSavingHistory} className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 transition-colors shadow-lg disabled:opacity-50">
                        {isSavingHistory ? "SAVING..." : "SAVE CHANGES"}
                      </button>
                      <button onClick={() => window.print()} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg">
                        <FileText className="w-5 h-5" /> PRINT
                      </button>
                      <button onClick={() => setSelectedHistoryBatch(null)} className="px-6 py-2 bg-slate-200 text-slate-800 rounded-xl font-black hover:bg-slate-300 transition-colors">
                        CLOSE
                      </button>
                    </div>
                  </div>
                  
                  <table className="w-full text-left border-collapse border border-slate-200 text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b-2 border-slate-200">
                        <th className="p-3 font-black text-slate-500 text-xs uppercase">Barcode</th>
                        <th className="p-3 font-black text-blue-600 text-xs uppercase text-center bg-blue-50/50">Actual Qty</th>
                        <th className="p-3 font-black text-slate-500 text-xs uppercase text-center">System Qty</th>
                        <th className="p-3 font-black text-slate-500 text-xs uppercase text-center">Variance</th>
                        <th className="p-3 font-black text-slate-500 text-xs uppercase">Transfer In Ref</th>
                        <th className="p-3 font-black text-slate-500 text-xs uppercase">Transfer Out Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedHistoryBatch.reconciliationData || []).map((item: any) => {
                        const sysQty = Number(item.systemQuantity) || 0;
                        const activeActual = item.adjustedActualQuantity !== "" && item.adjustedActualQuantity !== undefined ? Number(item.adjustedActualQuantity) : item.actualQuantity;
                        const variance = item.systemQuantity === "" ? 0 : activeActual - sysQty;
                        const isShort = variance < 0;
                        const isOver = variance > 0;
                        
                        return (
                          <tr key={item.barcode} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3">
                              <div className="bg-white p-2 rounded-lg border border-slate-200 inline-block mb-1">
                                <Barcode value={item.barcode} width={1.5} height={40} fontSize={12} margin={0} />
                              </div>
                              {item.productName && <div className="text-xs font-bold text-slate-600 truncate max-w-[160px]" title={item.productName}>{item.productName}</div>}
                            </td>
                            <td className="p-3 text-center bg-blue-50/30">
                              <input 
                                type="number"
                                value={item.adjustedActualQuantity !== "" && item.adjustedActualQuantity !== undefined ? item.adjustedActualQuantity : item.actualQuantity}
                                onChange={(e) => updateHistoryReconField(item.barcode, "adjustedActualQuantity", e.target.value)}
                                className="w-20 p-2 text-center border-2 border-transparent hover:border-slate-200 rounded-lg font-black text-xl text-blue-700 bg-transparent outline-none focus:border-blue-500 focus:bg-white"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <input 
                                type="number"
                                value={item.systemQuantity || ""}
                                onChange={(e) => updateHistoryReconField(item.barcode, "systemQuantity", e.target.value)}
                                placeholder="System"
                                className="w-20 p-2 text-center border-2 border-slate-200 rounded-lg font-bold outline-none focus:border-blue-500"
                              />
                            </td>
                            <td className="p-3 text-center">
                              {item.systemQuantity !== "" && (
                                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-black ${isShort ? 'bg-red-100 text-red-700' : isOver ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {variance > 0 ? "+" : ""}{variance}
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <input 
                                type="text"
                                disabled={variance <= 0}
                                value={item.transferIn || ""}
                                onChange={(e) => updateHistoryReconField(item.barcode, "transferIn", e.target.value)}
                                placeholder={isOver ? "Req: Document #" : "-"}
                                className={`w-full p-2 border-2 rounded-lg font-mono text-xs outline-none focus:border-blue-500 ${isOver && !item.transferIn ? 'border-amber-300 bg-amber-50 placeholder:text-amber-300' : 'border-slate-200 disabled:opacity-50'}`}
                              />
                            </td>
                            <td className="p-3">
                              <input 
                                type="text"
                                disabled={variance >= 0}
                                value={item.transferOut || ""}
                                onChange={(e) => updateHistoryReconField(item.barcode, "transferOut", e.target.value)}
                                placeholder={isShort ? "Req: Document #" : "-"}
                                className={`w-full p-2 border-2 rounded-lg font-mono text-xs outline-none focus:border-blue-500 ${isShort && !item.transferOut ? 'border-red-300 bg-red-50 placeholder:text-red-300' : 'border-slate-200 disabled:opacity-50'}`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
        {/* CONTROLS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 no-print">
          {!activeBatch ? (
            <div className="text-center">
              <ShieldAlert className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">No Active Audit Session</h2>
              <p className="text-slate-500 mb-6">Open a new batch to unlock the Cashier scanners.</p>
              <button 
                onClick={handleStartBatch}
                className="px-8 py-4 bg-blue-600 text-white rounded-xl font-black text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
              >
                OPEN NEW AUDIT BATCH
              </button>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`flex h-3 w-3 rounded-full ${activeBatch.status === "OPEN" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
                  <h2 className="text-xl font-black tracking-tight uppercase">Batch: {activeBatch.id}</h2>
                </div>
                <p className="text-slate-500 text-sm font-medium">
                  Status: <strong className={activeBatch.status === "OPEN" ? "text-emerald-600" : "text-amber-600"}>{activeBatch.status}</strong>
                  <span className="mx-2">•</span> 
                  Scans: <strong>{scans.length}</strong> items scanned
                </p>
              </div>

              <div className="flex items-center gap-3">
                {activeBatch.status === "OPEN" ? (
                  <>
                    <button 
                      onClick={() => window.print()}
                      className="px-6 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-colors shadow flex items-center gap-2 border border-blue-200"
                    >
                      <FileText className="w-5 h-5" />
                      PRINT DRAFT WORKSHEET
                    </button>
                    <button 
                      onClick={handleCloseBatch}
                      className="px-6 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors shadow-lg"
                    >
                      CLOSE BATCH (Lock Cashiers)
                    </button>
                  </>
                ) : activeBatch.status === "CLOSED" ? (
                  <button 
                    onClick={handleFinalizeAndPrint}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg flex items-center gap-2"
                  >
                    <FileText className="w-5 h-5" />
                    FINALIZE & PRINT REPORT
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => window.print()}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2"
                    >
                      <FileText className="w-5 h-5" />
                      PRINT AGAIN
                    </button>
                    <button 
                      onClick={handleStartBatch}
                      className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-lg"
                    >
                      START NEW AUDIT
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RECONCILIATION TABLE */}
        {activeBatch && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden no-print">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold tracking-widest uppercase text-sm">Reconciliation Sheet</h3>
              {activeBatch.status === "CLOSED" && (
                <button onClick={addNewReconRow} className="text-xs font-bold px-3 py-1 bg-slate-700 rounded-lg hover:bg-slate-600">+ Add Missing Item</button>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-200">
                    <th className="p-4 font-black text-slate-500 text-xs uppercase">Barcode</th>
                    <th className="p-4 font-black text-blue-600 text-xs uppercase text-center bg-blue-50/50">Actual Qty (Cashier)</th>
                    <th className="p-4 font-black text-slate-500 text-xs uppercase text-center">System Qty</th>
                    <th className="p-4 font-black text-slate-500 text-xs uppercase text-center">Variance</th>
                    <th className="p-4 font-black text-slate-500 text-xs uppercase">Transfer In Ref</th>
                    <th className="p-4 font-black text-slate-500 text-xs uppercase">Transfer Out Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reconList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">No items scanned yet.</td>
                    </tr>
                  ) : (
                    reconList.map(item => {
                      const sysQty = Number(item.systemQuantity) || 0;
                      const activeActual = item.adjustedActualQuantity !== "" && item.adjustedActualQuantity !== undefined ? Number(item.adjustedActualQuantity) : item.actualQuantity;
                      const variance = item.systemQuantity === "" ? 0 : activeActual - sysQty;
                      const isShort = variance < 0;
                      const isOver = variance > 0;
                      
                      return (
                        <tr key={item.barcode} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <div className="bg-white p-2 rounded-lg border border-slate-200 inline-block mb-1">
                              <Barcode value={item.barcode} width={1.5} height={40} fontSize={12} margin={0} />
                            </div>
                            {item.productName && (
                              <div className="text-xs font-bold text-slate-600 max-w-[160px] truncate" title={item.productName}>
                                {item.productName}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-center bg-blue-50/30">
                            <input 
                              type="number"
                              disabled={activeBatch.status === "FINALIZED"}
                              value={item.adjustedActualQuantity !== "" && item.adjustedActualQuantity !== undefined ? item.adjustedActualQuantity : item.actualQuantity}
                              onChange={(e) => updateReconField(item.barcode, "adjustedActualQuantity", e.target.value)}
                              className="w-24 p-2 text-center border-2 border-transparent hover:border-slate-200 rounded-lg font-black text-xl text-blue-700 bg-transparent outline-none focus:border-blue-500 focus:bg-white disabled:opacity-50"
                            />
                          </td>
                          <td className="p-4 text-center">
                            <input 
                              type="number"
                              disabled={activeBatch.status === "FINALIZED"}
                              value={item.systemQuantity}
                              onChange={(e) => updateReconField(item.barcode, "systemQuantity", e.target.value)}
                              placeholder="System"
                              className="w-20 p-2 text-center border-2 border-slate-200 rounded-lg font-bold outline-none focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-100"
                            />
                          </td>
                          <td className="p-4 text-center">
                            {item.systemQuantity !== "" && (
                              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-black ${isShort ? 'bg-red-100 text-red-700' : isOver ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {variance > 0 ? "+" : ""}{variance}
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <input 
                              type="text"
                              disabled={activeBatch.status === "FINALIZED" || variance <= 0}
                              value={item.transferIn || ""}
                              onChange={(e) => updateReconField(item.barcode, "transferIn", e.target.value)}
                              placeholder={isOver ? "Req: Document #" : "-"}
                              className={`w-full p-2 border-2 rounded-lg font-mono text-xs outline-none focus:border-blue-500 ${isOver && !item.transferIn ? 'border-amber-300 bg-amber-50 placeholder:text-amber-300' : 'border-slate-200 disabled:opacity-50'}`}
                            />
                          </td>
                          <td className="p-4">
                            <input 
                              type="text"
                              disabled={activeBatch.status === "FINALIZED" || variance >= 0}
                              value={item.transferOut || ""}
                              onChange={(e) => updateReconField(item.barcode, "transferOut", e.target.value)}
                              placeholder={isShort ? "Req: Document #" : "-"}
                              className={`w-full p-2 border-2 rounded-lg font-mono text-xs outline-none focus:border-blue-500 ${isShort && !item.transferOut ? 'border-red-300 bg-red-50 placeholder:text-red-300' : 'border-slate-200 disabled:opacity-50'}`}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

          </>
        )}

        {/* THE OFFICIAL PRINT REPORT (HIDDEN ON SCREEN, VISIBLE ON PRINT) */}
        {(() => {
          const printBatch = selectedHistoryBatch || activeBatch;
          const printReconList = selectedHistoryBatch ? (selectedHistoryBatch.reconciliationData || []) : reconList;
          if (!printBatch) return null;
          return (
          <div id="print-area" className="text-black bg-white" dir="ltr" style={{ position: 'relative', overflow: 'hidden', padding: '15mm', minHeight: '100vh', display: 'none' }}>
            {/* Micro-Typography Security Borders */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px', overflow: 'hidden' }}>
              <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
              </div>
              <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
              </div>
            </div>
            
            {/* Giant Watermark */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-35deg)', fontSize: '80px', fontWeight: '900', color: 'rgba(59, 130, 246, 0.05)', zIndex: 5, whiteSpace: 'nowrap', pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '5px' }}>
              INVENTORY AUDIT
            </div>

            <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Header */}
              <div className="flex justify-between items-start border-b-4 border-black pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-black text-white p-2 rounded-xl font-black text-3xl tracking-tighter w-12 h-12 flex items-center justify-center">K</div>
                  <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight leading-none text-black">Circle K</h1>
                    <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Branch Inventory Audit</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-black text-gray-900 tracking-tighter">
                    {printBatch.status === "OPEN" ? "CYCLE COUNT DRAFT WORKSHEET" : "CYCLE COUNT RECONCILIATION"}
                  </h2>
                  <p className="text-sm font-mono font-bold text-gray-600 mt-1">{printBatch.id}</p>
                </div>
              </div>

              {/* Data Rows */}
              <div className="mb-4">
                <table className="w-full text-left border-2 border-black">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-black">
                      <th className="py-2 px-3 font-black text-[10px] text-gray-800 uppercase tracking-wider border-r-2 border-black">Barcode</th>
                      <th className="py-2 px-3 font-black text-[10px] text-gray-800 uppercase tracking-wider border-r-2 border-black text-center">Actual (Cashier)</th>
                      <th className="py-2 px-3 font-black text-[10px] text-gray-800 uppercase tracking-wider border-r-2 border-black text-center">System (Manager)</th>
                      <th className="py-2 px-3 font-black text-[10px] text-gray-800 uppercase tracking-wider border-r-2 border-black text-center">Variance</th>
                      <th className="py-2 px-3 font-black text-[10px] text-gray-800 uppercase tracking-wider border-r-2 border-black text-center">TR IN Ref</th>
                      <th className="py-2 px-3 font-black text-[10px] text-gray-800 uppercase tracking-wider text-center">TR OUT Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-black">
                    {printReconList.map((it: any, i: number) => {
                      const sysQty = Number(it.systemQuantity) || 0;
                      const activeActual = it.adjustedActualQuantity !== "" && it.adjustedActualQuantity !== undefined ? Number(it.adjustedActualQuantity) : it.actualQuantity;
                      const variance = it.systemQuantity === "" ? 0 : activeActual - sysQty;
                      return (
                        <tr key={it.barcode || i}>
                          <td className="py-2 px-3 border-r-2 border-black">
                            <div style={{ transform: 'scale(0.8)', transformOrigin: 'left center', width: '120px' }}>
                              <Barcode value={it.barcode} width={1.5} height={30} fontSize={10} margin={0} />
                            </div>
                            {it.productName && <div className="text-[9px] font-bold text-slate-700 leading-tight mt-1 max-w-[120px] whitespace-normal">{it.productName}</div>}
                          </td>
                          <td className="py-1 px-3 font-black text-black text-center border-r-2 border-black text-sm">{activeActual}</td>
                          <td className="py-1 px-3 font-black text-gray-500 text-center border-r-2 border-black text-sm">{it.systemQuantity || (printBatch.status === "OPEN" ? "___________" : "-")}</td>
                          <td className="py-1 px-3 font-black text-center border-r-2 border-black text-sm text-black">
                            {it.systemQuantity === "" ? "-" : (variance > 0 ? "+" : "") + variance}
                          </td>
                          <td className="py-1 px-3 font-mono font-bold text-[10px] text-black border-r-2 border-black text-center tracking-wider">{it.transferIn || "-"}</td>
                          <td className="py-1 px-3 font-mono font-bold text-[10px] text-black text-center tracking-wider">{it.transferOut || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary of Actions */}
              {(() => {
                const needsTransferIn = printReconList.filter((it: any) => {
                  const sysQty = Number(it.systemQuantity) || 0;
                  const activeActual = it.adjustedActualQuantity !== "" && it.adjustedActualQuantity !== undefined ? Number(it.adjustedActualQuantity) : it.actualQuantity;
                  return (it.systemQuantity !== "" && (activeActual - sysQty) > 0);
                });
                
                const needsTransferOut = printReconList.filter((it: any) => {
                  const sysQty = Number(it.systemQuantity) || 0;
                  const activeActual = it.adjustedActualQuantity !== "" && it.adjustedActualQuantity !== undefined ? Number(it.adjustedActualQuantity) : it.actualQuantity;
                  return (it.systemQuantity !== "" && (activeActual - sysQty) < 0);
                });

                if (needsTransferIn.length === 0 && needsTransferOut.length === 0) return null;

                return (
                  <div className="mb-6 break-inside-avoid">
                    <h3 className="font-black text-sm uppercase mb-2 border-b-2 border-black inline-block">Action Required Summary</h3>
                    <div className="flex gap-4">
                      {needsTransferIn.length > 0 && (
                        <div className="flex-1 border-2 border-black p-1">
                          <h4 className="font-black text-xs mb-1 text-black uppercase bg-gray-200 px-2 py-1 border-b-2 border-black">Items To Transfer IN (Overage)</h4>
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="border-b-2 border-black">
                                <th className="p-1 border-r-2 border-black font-black uppercase">Item</th>
                                <th className="p-1 border-r-2 border-black font-black text-center uppercase">Qty to IN</th>
                                <th className="p-1 font-black text-center uppercase">TR IN Ref</th>
                              </tr>
                            </thead>
                            <tbody>
                              {needsTransferIn.map((it: any, i: number) => {
                                const sysQty = Number(it.systemQuantity) || 0;
                                const activeActual = it.adjustedActualQuantity !== "" && it.adjustedActualQuantity !== undefined ? Number(it.adjustedActualQuantity) : it.actualQuantity;
                                const variance = activeActual - sysQty;
                                return (
                                  <tr key={i} className="border-b border-black last:border-b-0">
                                    <td className="p-1 border-r-2 border-black">
                                      <div className="font-mono font-bold">{it.barcode}</div>
                                      {it.productName && <div className="text-[8px] text-black font-bold leading-tight">{it.productName}</div>}
                                    </td>
                                    <td className="p-1 border-r-2 border-black text-center font-black text-lg">+{variance}</td>
                                    <td className="p-1 text-center font-mono font-bold">{it.transferIn || "_______"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {needsTransferOut.length > 0 && (
                        <div className="flex-1 border-2 border-black p-1">
                          <h4 className="font-black text-xs mb-1 text-black uppercase bg-gray-200 px-2 py-1 border-b-2 border-black">Items To Transfer OUT (Shortage)</h4>
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="border-b-2 border-black">
                                <th className="p-1 border-r-2 border-black font-black uppercase">Item</th>
                                <th className="p-1 border-r-2 border-black font-black text-center uppercase">Qty to OUT</th>
                                <th className="p-1 font-black text-center uppercase">TR OUT Ref</th>
                              </tr>
                            </thead>
                            <tbody>
                              {needsTransferOut.map((it: any, i: number) => {
                                const sysQty = Number(it.systemQuantity) || 0;
                                const activeActual = it.adjustedActualQuantity !== "" && it.adjustedActualQuantity !== undefined ? Number(it.adjustedActualQuantity) : it.actualQuantity;
                                const variance = activeActual - sysQty;
                                return (
                                  <tr key={i} className="border-b border-black last:border-b-0">
                                    <td className="p-1 border-r-2 border-black">
                                      <div className="font-mono font-bold">{it.barcode}</div>
                                      {it.productName && <div className="text-[8px] text-black font-bold leading-tight">{it.productName}</div>}
                                    </td>
                                    <td className="p-1 border-r-2 border-black text-center font-black text-lg">{Math.abs(variance)}</td>
                                    <td className="p-1 text-center font-mono font-bold">{it.transferOut || "_______"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* AI Executive Summary */}
              {printBatch.aiSummary && (
                <div className="mb-6 break-inside-avoid border-2 border-black p-3 bg-gray-50">
                  <h3 className="font-black text-sm uppercase mb-2 border-b-2 border-black inline-block text-black">🤖 AI Executive Summary</h3>
                  <div className="text-[10px] whitespace-pre-wrap font-mono text-black leading-relaxed">
                    {printBatch.aiSummary}
                  </div>
                </div>
              )}

              {/* Signatures & Approvals */}
              <div className="mt-auto pt-4 border-t-2 border-gray-100 break-inside-avoid">
                <div className="text-center mb-4">
                  <p className="font-black text-[11px] text-gray-900 mb-1">* Strict Separation of Duties Enforced *</p>
                  <p className="text-[9px] font-bold text-gray-500">Document valid only with authorized signatures and zero unjustified variances.</p>
                </div>

                <div className="flex justify-between items-end px-4">
                  <div className="text-center relative w-1/3">
                    <p className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-10">Manager Signature</p>
                    <div className="border-t-2 border-black pt-2">
                      <p className="font-black text-gray-900 text-[11px] uppercase truncate">{printBatch.managerEmail}</p>
                      <p className="text-[9px] font-bold text-gray-500 mt-0.5 uppercase tracking-widest">Reconciled By</p>
                    </div>
                  </div>

                  {/* Official Stamp Box */}
                  <div style={{ width: '25%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '5px' }}>
                    <div style={{ width: '100%', height: '50px', border: '2px dashed #94a3b8', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontSize: '8px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.5px' }}>Official Branch<br />Stamp / Seal</span>
                    </div>
                  </div>

                  <div className="text-center relative w-1/3">
                    <p className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-10">Operations Area Manager</p>
                    <div className="border-t-2 border-black pt-2">
                      <p className="font-black text-gray-900 text-[11px] uppercase truncate">____________________</p>
                      <p className="text-[9px] font-bold text-gray-500 mt-0.5 uppercase tracking-widest">Reviewed By</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Digital Forensics Footer */}
              <div style={{ borderTop: '2px solid #1e293b', paddingTop: '6px', textAlign: 'center', marginTop: '10px' }}>
                <p style={{ fontSize: '7px', color: '#475569', fontFamily: 'monospace', margin: 0, letterSpacing: '0.5px', fontWeight: 'bold' }}>
                  BATCH {printBatch.id} | OPENED: {new Date(printBatch.openedAt).toLocaleString('en-GB')} | PRINTED: {new Date().toLocaleString('en-GB')} | SYSTEM: ANH PORTAL V2.0
                </p>
              </div>

            </div>
          </div>
          );
        })()}

        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            html, body { 
              height: auto !important; 
              overflow: visible !important; 
              background: white !important; 
              margin: 0 !important;
              padding: 0 !important;
            }
            body * { 
              visibility: hidden; 
            }
            .no-print, .no-print * { 
              display: none !important; 
            }
            #print-area { 
              display: block !important;
              position: absolute !important;
              left: 0 !important; 
              top: 0 !important; 
              width: 100% !important; 
              margin: 0 !important; 
              padding: 10px !important; 
            }
            #print-area, #print-area * { 
              visibility: visible; 
            }
            @page { 
              size: auto; 
              margin: 5mm; 
            }
          }
        `}} />

      </div>
    </PageTransition>
  );
}
