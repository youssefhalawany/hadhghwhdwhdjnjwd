"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, setDoc } from "firebase/firestore";
import { ArrowLeft, Wallet, FileText, Trash2, Edit2, Check, X, Plus } from "lucide-react";
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
        fetched = fetched.filter((r: any) => r.branchId === currentBranch);
      }
      setRecords(fetched);
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 pb-20">
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/financial-reports" className="flex items-center gap-1 text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
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
          <button 
            onClick={startNewRow}
            disabled={isAddingNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-slate-500 uppercase tracking-wider bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-4 font-black whitespace-nowrap">Date</th>
                  <th className="px-5 py-4 font-black text-right whitespace-nowrap bg-slate-100/30 dark:bg-slate-800/30">Start Cash (Auto)</th>
                  <th className="px-5 py-4 font-black text-right whitespace-nowrap text-teal-600/70 dark:text-teal-400/70">Cash (+ In)</th>
                  <th className="px-5 py-4 font-black text-right whitespace-nowrap text-blue-600/70 dark:text-blue-400/70">Visa</th>
                  <th className="px-5 py-4 font-black text-right whitespace-nowrap text-red-600/70 dark:text-red-400/70">Deduction (- Out)</th>
                  <th className="px-5 py-4 font-black">Details</th>
                  <th className="px-5 py-4 font-black whitespace-nowrap">PO Numbers</th>
                  <th className="px-5 py-4 font-black text-right whitespace-nowrap bg-slate-100/30 dark:bg-slate-800/30">End Cash (Auto)</th>
                  <th className="px-5 py-4 font-black text-center sticky right-0 bg-slate-50/95 dark:bg-slate-800/95 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] dark:shadow-[-4px_0_12px_rgba(0,0,0,0.2)]">Actions</th>
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
                          <td className="px-5 py-3.5 font-bold whitespace-nowrap">
                            {isEditing ? (
                              <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="w-full px-2 py-1.5 border border-teal-200 dark:border-teal-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md bg-white dark:bg-slate-950 font-mono text-sm shadow-sm" />
                            ) : (
                              <span className="font-mono text-slate-700 dark:text-slate-300">
                                {new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </span>
                            )}
                          </td>
                          
                          {/* Start Cash (Auto Computed) */}
                          <td className="px-5 py-3.5 font-bold text-right bg-slate-50/30 dark:bg-slate-800/10 text-slate-500 dark:text-slate-400">
                            {isEditing && index === 0 ? (
                              // Allow editing start cash ONLY on the very first record to seed the balances
                              <input type="number" value={editForm.startCash} onChange={e => setEditForm({...editForm, startCash: Number(e.target.value)})} className="w-24 px-2 py-1.5 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm" />
                            ) : (
                              r.startCash.toLocaleString()
                            )}
                          </td>

                          {/* Cash */}
                          <td className="px-5 py-3.5 font-black text-teal-600 dark:text-teal-400 text-right">
                            {isEditing ? (
                              <input type="number" value={editForm.cash} onChange={e => setEditForm({...editForm, cash: Number(e.target.value)})} className="w-24 px-2 py-1.5 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm" />
                            ) : (
                              r.cash.toLocaleString()
                            )}
                          </td>

                          {/* Visa */}
                          <td className="px-5 py-3.5 font-bold text-blue-600 dark:text-blue-400 text-right">
                            {isEditing ? (
                              <input type="number" value={editForm.visa} onChange={e => setEditForm({...editForm, visa: Number(e.target.value)})} className="w-24 px-2 py-1.5 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm" />
                            ) : (
                              r.visa.toLocaleString()
                            )}
                          </td>

                          {/* Deduction */}
                          <td className="px-5 py-3.5 font-black text-red-600 dark:text-red-400 text-right">
                            {isEditing ? (
                              <input type="number" value={editForm.deduction} onChange={e => setEditForm({...editForm, deduction: Number(e.target.value)})} className="w-24 px-2 py-1.5 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm" />
                            ) : (
                              r.deduction.toLocaleString()
                            )}
                          </td>

                          {/* Details */}
                          <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                            {isEditing ? (
                              <input type="text" value={editForm.details} onChange={e => setEditForm({...editForm, details: e.target.value})} className="w-full min-w-[150px] px-2 py-1.5 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md bg-white dark:bg-slate-950 text-sm shadow-sm" placeholder="Any details..." />
                            ) : (
                              <div className="max-w-[200px] truncate" title={r.details}>{r.details}</div>
                            )}
                          </td>

                          {/* PO Numbers */}
                          <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-mono text-xs">
                            {isEditing ? (
                              <input type="text" value={editForm.poNumbers} onChange={e => setEditForm({...editForm, poNumbers: e.target.value})} className="w-full min-w-[120px] px-2 py-1.5 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md bg-white dark:bg-slate-950 shadow-sm" placeholder="PO..." />
                            ) : (
                              r.poNumbers
                            )}
                          </td>

                          {/* End Cash (Auto Computed) */}
                          <td className="px-5 py-3.5 font-black text-right whitespace-nowrap bg-slate-50/30 dark:bg-slate-800/10 text-slate-800 dark:text-white">
                            {isEditing ? (
                              <span className="text-teal-600 dark:text-teal-400">
                                {((Number(editForm.startCash ?? r.startCash)||0) + (Number(editForm.cash)||0) - (Number(editForm.deduction)||0)).toLocaleString()}
                              </span>
                            ) : (
                              r.endCash.toLocaleString()
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5 text-center sticky right-0 bg-white/95 dark:bg-slate-900/95 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] dark:shadow-[-4px_0_12px_rgba(0,0,0,0.2)]">
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
                              <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" style={{ opacity: 1 }}>
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
                      <tr className="bg-teal-50 dark:bg-teal-900/20 shadow-[inset_0_2px_10px_rgba(20,184,166,0.1)]">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="w-full px-2 py-1.5 border-2 border-teal-500 focus:ring-2 focus:ring-teal-500/30 rounded-md bg-white dark:bg-slate-950 font-mono text-sm shadow-md" autoFocus />
                        </td>
                        <td className="px-5 py-4 text-right text-slate-400 font-mono text-sm">
                          {/* Live preview of what start cash will be based on chosen date */}
                          {editPreviewStartCash.toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                          <input type="number" value={editForm.cash} onChange={e => setEditForm({...editForm, cash: Number(e.target.value)})} className="w-24 px-2 py-1.5 border border-teal-300 dark:border-teal-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm shadow-sm" placeholder="0" />
                        </td>
                        <td className="px-5 py-4">
                          <input type="number" value={editForm.visa} onChange={e => setEditForm({...editForm, visa: Number(e.target.value)})} className="w-24 px-2 py-1.5 border border-teal-300 dark:border-teal-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm shadow-sm" placeholder="0" />
                        </td>
                        <td className="px-5 py-4">
                          <input type="number" value={editForm.deduction} onChange={e => setEditForm({...editForm, deduction: Number(e.target.value)})} className="w-24 px-2 py-1.5 border border-teal-300 dark:border-teal-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm shadow-sm" placeholder="0" />
                        </td>
                        <td className="px-5 py-4">
                          <input type="text" value={editForm.details} onChange={e => setEditForm({...editForm, details: e.target.value})} className="w-full min-w-[150px] px-2 py-1.5 border border-teal-300 dark:border-teal-700 focus:border-teal-500 rounded-md bg-white dark:bg-slate-950 text-sm shadow-sm" placeholder="Notes..." />
                        </td>
                        <td className="px-5 py-4">
                          <input type="text" value={editForm.poNumbers} onChange={e => setEditForm({...editForm, poNumbers: e.target.value})} className="w-full min-w-[120px] px-2 py-1.5 border border-teal-300 dark:border-teal-700 focus:border-teal-500 rounded-md bg-white dark:bg-slate-950 text-xs shadow-sm font-mono" placeholder="PO..." />
                        </td>
                        <td className="px-5 py-4 font-black text-right text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/10">
                           {(editPreviewStartCash + (Number(editForm.cash)||0) - (Number(editForm.deduction)||0)).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-center sticky right-0 bg-teal-50/95 dark:bg-teal-900/95 shadow-[-4px_0_12px_rgba(20,184,166,0.1)]">
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
