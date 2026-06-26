"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, setDoc, getDocs, writeBatch } from "firebase/firestore";
import { ArrowLeft, Wallet, FileText, Trash2, Edit2, Check, X, Plus, Calendar } from "lucide-react";
import Link from "next/link";
import { vibrateSuccess, vibrateError } from "@/lib/haptics";
import { NumericFormat } from "react-number-format";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type EndShiftRecord = {
  id: string; // The date string YYYY-MM-DD
  date: string;
  startCash: number;
  cash: number;
  visa: number;
  deduction: number;
  details: string;
  poNumbers: string;
  endCash: number;
};

export default function EndShiftCashPage() {
  const { currentBranch } = useBranch();
  const [records, setRecords] = useState<EndShiftRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<EndShiftRecord>>({});
  
  // Add new row state
  const [isAddingNew, setIsAddingNew] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "end_shift_cash"), orderBy("date", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      let fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as EndShiftRecord));
      if (currentBranch !== "all") {
        // Fallback to alamein4 for old records that didn't have branchId saved
        fetched = fetched.filter((r: any) => (r.branchId || "alamein4") === currentBranch);
      }
      setRecords(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Firestore End Shift Cash Error:", error);
      toast.error("Database Error: " + error.message);
      setLoading(false);
    });
    return () => unsub();
  }, [currentBranch]);

  // Compute running totals dynamically so we don't have to manually update everything if a past record is added
  const computedRecords = React.useMemo(() => {
    const computed: EndShiftRecord[] = [];
    let runningEndCash = 0;
    
    // Sort records explicitly here once
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    
    for (const r of sorted) {
      const startCash = computed.length === 0 ? r.startCash : runningEndCash;
      const endCash = startCash + r.cash - r.deduction;
      runningEndCash = endCash;
      computed.push({
        ...r,
        startCash,
        endCash
      });
    }
    return computed;
  }, [records]);

  // Compute the preview start cash for the row being edited/added ONCE, not in the render loop
  const editPreviewStartCash = React.useMemo(() => {
    if (!editForm.date) return 0;
    const prevs = computedRecords.filter(r => r.date < editForm.date!).sort((a,b) => b.date.localeCompare(a.date));
    return prevs.length > 0 ? prevs[0].endCash : 0;
  }, [computedRecords, editForm.date]);

  const handleDelete = async (id: string) => {
    toast.warning("Are you sure you want to delete this record?", {
      description: "Subsequent balances will shift.",
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await deleteDoc(doc(db, "end_shift_cash", id));
            toast.success("Record deleted");
            vibrateSuccess();
          } catch (error) {
            console.error(error);
            toast.error("Failed to delete record.");
            vibrateError();
          }
        }
      }
    });
  };

  const startEditing = (record: EndShiftRecord) => {
    setIsAddingNew(false);
    setEditingId(record.id);
    setEditForm(record);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setEditForm({});
  };

  const startNewRow = () => {
    setEditingId(null);
    setIsAddingNew(true);
    
    // Default to the day after the last record
    let nextDate = new Date().toISOString().split('T')[0];
    if (computedRecords.length > 0) {
      const lastRecord = computedRecords[computedRecords.length - 1];
      const d = new Date(lastRecord.date);
      d.setDate(d.getDate() + 1);
      nextDate = d.toISOString().split('T')[0];
    }
    
    setEditForm({
      date: nextDate,
      cash: 0,
      visa: 0,
      deduction: 0,
      details: "",
      poNumbers: ""
    });
  };

  const saveRow = async () => {
    if (!editForm.date) {
      toast.error("Date is required.");
      return;
    }

    try {
      // Find the start cash conceptually for saving (though it's overridden by display logic anyway)
      let prevEndCash = 0;
      const prevRecords = computedRecords.filter(r => r.date < editForm.date!).sort((a,b) => b.date.localeCompare(a.date));
      if (prevRecords.length > 0) prevEndCash = prevRecords[0].endCash;
      
      const numStart = prevEndCash;
      const numCash = Number(editForm.cash || 0);
      const numVisa = Number(editForm.visa || 0);
      const numDed = Number(editForm.deduction || 0);
      const numEnd = numStart + numCash - numDed;
      const bId = currentBranch === "all" ? "alamein4" : currentBranch;

      // We use the date and branch as the document ID so adding the same date updates it or creates it cleanly
      await setDoc(doc(db, "end_shift_cash", `${editForm.date!}_${bId}`), {
        date: editForm.date,
        startCash: numStart,
        cash: numCash,
        visa: numVisa,
        deduction: numDed,
        details: editForm.details || "",
        poNumbers: editForm.poNumbers || "",
        endCash: numEnd,
        branchId: bId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setEditingId(null);
      setIsAddingNew(false);
      setEditForm({});
      toast.success("Record saved!");
      vibrateSuccess();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save record.");
      vibrateError();
    }
  };

  const fixDatesBackward = async () => {
    if (!window.confirm("Shift all dates backward by 1 day?")) return;
    try {
      const snap = await getDocs(collection(db, "end_shift_cash"));
      const batch = writeBatch(db);
      snap.forEach((d: any) => {
        const data = d.data();
        if (data.date) {
          const dateObj = new Date(data.date);
          dateObj.setDate(dateObj.getDate() - 1);
          const newDateStr = dateObj.toISOString().split('T')[0];
          
          const branchId = data.branchId || currentBranch || 'alamein4';
          const newDocId = `${newDateStr}_${branchId}`;
          const newRef = doc(db, "end_shift_cash", newDocId);
          
          batch.set(newRef, { ...data, date: newDateStr });
          batch.delete(d.ref);
        }
      });
      await batch.commit();
      alert("Successfully shifted all dates backward by 1 day!");
    } catch (e) {
      console.error(e);
      alert("Failed to shift dates: " + String(e));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/financial-reports" className="text-slate-500 hover:text-teal-600 transition-colors flex items-center gap-2">
              <ArrowLeft className="h-5 w-5" />
              <span className="font-bold text-sm">Back</span>
            </Link>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                <Wallet className="h-5 w-5 text-teal-500" />
                End Shift Cash
              </h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={fixDatesBackward}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm rounded-lg shadow-md transition-all active:scale-95"
            >
              Revert Dates (-1 Day)
            </button>
            <button 
              onClick={startNewRow}
              disabled={isAddingNew}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              <Plus className="h-4 w-4" />
              Add Row
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-slate-500 uppercase tracking-wider bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-3 font-black whitespace-nowrap">Date</th>
                  <th className="px-3 py-3 font-black text-right whitespace-nowrap bg-slate-100/30 dark:bg-slate-800/30">Start Cash</th>
                  <th className="px-3 py-3 font-black text-right whitespace-nowrap text-teal-600/70 dark:text-teal-400/70">Cash (+ In)</th>
                  <th className="px-3 py-3 font-black text-right whitespace-nowrap text-blue-600/70 dark:text-blue-400/70">Visa</th>
                  <th className="px-3 py-3 font-black text-right whitespace-nowrap text-red-600/70 dark:text-red-400/70">Deduction (- Out)</th>
                  <th className="px-3 py-3 font-black">Details</th>
                  <th className="px-3 py-3 font-black whitespace-nowrap">PO Numbers</th>
                  <th className="px-3 py-3 font-black text-right whitespace-nowrap bg-slate-100/30 dark:bg-slate-800/30">End Cash (Auto)</th>
                  <th className="px-3 py-3 font-black text-center sticky right-0 bg-slate-50/95 dark:bg-slate-800/95 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] dark:shadow-[-4px_0_12px_rgba(0,0,0,0.2)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-12">
                      <div className="flex justify-center">
                        <Skeleton className="h-16 w-16 rounded-full" />
                      </div>
                    </td>
                  </tr>
                ) : computedRecords.length === 0 && !isAddingNew ? (
                  <tr>
                    <td colSpan={9} className="text-center p-16 text-slate-400 font-semibold bg-slate-50/30 dark:bg-slate-800/10">
                      No shift records found. Click "Add Row" to start.
                    </td>
                  </tr>
                ) : (
                  <>
                    {computedRecords.map((r, index) => {
                      const isEditing = editingId === r.id;
                      
                      return (
                        <tr key={r.id} className={`transition-colors ${isEditing ? 'bg-teal-50/50 dark:bg-teal-900/10' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'}`}>
                          {/* Date */}
                          <td className="px-3 py-3 font-semibold whitespace-nowrap">
                            {isEditing ? (
                              <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="px-2 py-1.5 border border-slate-200 dark:border-slate-800 focus:border-teal-500 rounded-md bg-white dark:bg-slate-950 text-sm" />
                            ) : (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                {r.date.split('-').reverse().join('/')}
                              </div>
                            )}
                          </td>
                          
                          {/* Start Cash */}
                          <td className="px-3 py-3 font-mono text-slate-500 dark:text-slate-400 text-right bg-slate-100/30 dark:bg-slate-800/30">
                            {isEditing && index === 0 ? (
                              <input type="number" value={editForm.startCash} onChange={e => setEditForm({...editForm, startCash: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm" />
                            ) : (
                              r.startCash.toLocaleString()
                            )}
                          </td>

                          {/* Cash */}
                          <td className="px-3 py-3 font-black text-teal-600 dark:text-teal-400 text-right">
                            {isEditing ? (
                              <input type="number" value={editForm.cash} onChange={e => setEditForm({...editForm, cash: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm" />
                            ) : (
                              r.cash.toLocaleString()
                            )}
                          </td>

                          {/* Visa */}
                          <td className="px-3 py-3 font-bold text-blue-600 dark:text-blue-400 text-right">
                            {isEditing ? (
                              <input type="number" value={editForm.visa} onChange={e => setEditForm({...editForm, visa: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm" />
                            ) : (
                              r.visa.toLocaleString()
                            )}
                          </td>

                          {/* Deduction */}
                          <td className="px-3 py-3 font-bold text-red-600 dark:text-red-400 text-right">
                            {isEditing ? (
                              <input type="number" value={editForm.deduction} onChange={e => setEditForm({...editForm, deduction: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm" />
                            ) : (
                              r.deduction.toLocaleString()
                            )}
                          </td>

                          {/* Details */}
                          <td className="px-3 py-3 min-w-[150px]">
                            {isEditing ? (
                              <input type="text" value={editForm.details} onChange={e => setEditForm({...editForm, details: e.target.value})} className="w-full px-2 py-1.5 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md bg-white dark:bg-slate-950 text-sm" />
                            ) : (
                              <span className="text-slate-600 dark:text-slate-300">{r.details || "-"}</span>
                            )}
                          </td>

                          {/* PO Numbers */}
                          <td className="px-3 py-3 min-w-[120px]">
                            {isEditing ? (
                              <input type="text" value={editForm.poNumbers} onChange={e => setEditForm({...editForm, poNumbers: e.target.value})} className="w-full px-2 py-1.5 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md bg-white dark:bg-slate-950 text-sm" />
                            ) : (
                              <span className="text-slate-600 dark:text-slate-300 font-mono text-xs">{r.poNumbers || "-"}</span>
                            )}
                          </td>

                          {/* End Cash */}
                          <td className="px-3 py-3 font-black text-right text-slate-800 dark:text-white bg-slate-100/30 dark:bg-slate-800/30">
                            {isEditing ? (
                              <span className="text-teal-600 dark:text-teal-400">
                                {((Number(editForm.startCash ?? r.startCash)||0) + (Number(editForm.cash)||0) - (Number(editForm.deduction)||0)).toLocaleString()}
                              </span>
                            ) : (
                              r.endCash.toLocaleString()
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-3 text-center sticky right-0 bg-white/95 dark:bg-slate-900/95 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] dark:shadow-[-4px_0_12px_rgba(0,0,0,0.2)]">
                            {isEditing ? (
                              <div className="flex justify-center gap-1">
                                <button onClick={saveRow} className="p-1.5 bg-green-500 text-white hover:bg-green-600 rounded-md shadow-sm transition-colors" title="Save">
                                  <Check className="h-4 w-4" strokeWidth={3} />
                                </button>
                                <button onClick={cancelEditing} className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md transition-colors" title="Cancel">
                                  <X className="h-4 w-4" strokeWidth={3} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-1">
                                <button onClick={() => startEditing(r)} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-md transition-colors">
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* NEW ROW ENTRY */}
                    {isAddingNew && (
                      <tr className="bg-teal-50/50 dark:bg-teal-900/10 border-b border-teal-100 dark:border-teal-900">
                        <td className="px-3 py-3">
                          <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="px-2 py-1.5 border border-teal-300 dark:border-teal-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md bg-white dark:bg-slate-950 text-sm shadow-sm" autoFocus />
                        </td>
                        <td className="px-3 py-3 font-mono text-slate-500 dark:text-slate-400 text-right bg-slate-100/30 dark:bg-slate-800/30">
                          {editPreviewStartCash.toLocaleString()}
                        </td>
                        <td className="px-3 py-3">
                          <input type="number" value={editForm.cash} onChange={e => setEditForm({...editForm, cash: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-300 dark:border-teal-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm shadow-sm" placeholder="0" />
                        </td>
                        <td className="px-3 py-3">
                          <input type="number" value={editForm.visa} onChange={e => setEditForm({...editForm, visa: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-300 dark:border-teal-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm shadow-sm" placeholder="0" />
                        </td>
                        <td className="px-3 py-3">
                          <input type="number" value={editForm.deduction} onChange={e => setEditForm({...editForm, deduction: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-300 dark:border-teal-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm shadow-sm" placeholder="0" />
                        </td>
                        <td className="px-3 py-3">
                          <input type="text" value={editForm.details} onChange={e => setEditForm({...editForm, details: e.target.value})} className="w-full px-2 py-1 border border-teal-300 dark:border-teal-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md bg-white dark:bg-slate-950 text-sm shadow-sm" placeholder="Reason..." />
                        </td>
                        <td className="px-3 py-3">
                          <input type="text" value={editForm.poNumbers} onChange={e => setEditForm({...editForm, poNumbers: e.target.value})} className="w-full px-2 py-1 border border-teal-300 dark:border-teal-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md bg-white dark:bg-slate-950 text-sm shadow-sm" placeholder="PO..." />
                        </td>
                        <td className="px-3 py-3 font-black text-slate-800 dark:text-white text-right bg-slate-100/30 dark:bg-slate-800/30">
                          {(editPreviewStartCash + (Number(editForm.cash)||0) - (Number(editForm.deduction)||0)).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-center sticky right-0 bg-teal-50 dark:bg-teal-900/30">
                          <div className="flex justify-center gap-1">
                            <button onClick={saveRow} className="p-1.5 bg-teal-600 text-white hover:bg-teal-700 rounded-md shadow-md transition-all active:scale-95" title="Save Row">
                              <Check className="h-4 w-4" strokeWidth={3} />
                            </button>
                            <button onClick={cancelEditing} className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md shadow-sm transition-colors" title="Cancel">
                              <X className="h-4 w-4" strokeWidth={3} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
