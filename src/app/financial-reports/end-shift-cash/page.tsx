"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, setDoc } from "firebase/firestore";
import { ArrowLeft, Wallet, Trash2, Edit2, Check, X, Plus, Calendar, Printer, FilterX } from "lucide-react";
import Link from "next/link";
import { vibrateSuccess, vibrateError } from "@/lib/haptics";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type DetailItem = {
  description: string;
  po: string;
};

type EndShiftRecord = {
  id: string; // The date string YYYY-MM-DD
  date: string;
  startCash: number;
  cash: number;
  visa: number;
  deduction: number;
  details: string; // Legacy string
  poNumbers: string; // Legacy string
  items?: DetailItem[]; // New structure
  endCash: number;
  branchId?: string;
};

export default function EndShiftCashPage() {
  const { currentBranch } = useBranch();
  const [records, setRecords] = useState<EndShiftRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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
      
      // Parse legacy strings if items array doesn't exist
      let parsedItems = r.items;
      if (!parsedItems || parsedItems.length === 0) {
        if (r.details) {
          const detArray = r.details.split("/").map(s => s.trim()).filter(Boolean);
          const poArray = r.poNumbers ? r.poNumbers.split("/").map(s => s.trim()) : [];
          parsedItems = detArray.map((det, i) => ({
            description: det,
            po: poArray[i] || ""
          }));
        } else {
          parsedItems = [];
        }
      }

      computed.push({
        ...r,
        items: parsedItems,
        startCash,
        endCash
      });
    }
    return computed;
  }, [records]);

  // Apply Date Filters
  const filteredRecords = React.useMemo(() => {
    return computedRecords.filter(r => {
      if (fromDate && r.date < fromDate) return false;
      if (toDate && r.date > toDate) return false;
      return true;
    });
  }, [computedRecords, fromDate, toDate]);

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
      items: [{ description: "", po: "" }] // Start with one empty item
    });
  };

  const handleAddItem = () => {
    setEditForm(prev => ({
      ...prev,
      items: [...(prev.items || []), { description: "", po: "" }]
    }));
  };

  const handleUpdateItem = (index: number, field: keyof DetailItem, value: string) => {
    setEditForm(prev => {
      const newItems = [...(prev.items || [])];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditForm(prev => {
      const newItems = [...(prev.items || [])];
      newItems.splice(index, 1);
      return { ...prev, items: newItems };
    });
  };

  const saveRow = async () => {
    if (!editForm.date) {
      toast.error("Date is required.");
      return;
    }

    try {
      // Find the start cash conceptually for saving
      let prevEndCash = 0;
      const prevRecords = computedRecords.filter(r => r.date < editForm.date!).sort((a,b) => b.date.localeCompare(a.date));
      if (prevRecords.length > 0) prevEndCash = prevRecords[0].endCash;
      
      const numStart = prevEndCash;
      const numCash = Number(editForm.cash || 0);
      const numVisa = Number(editForm.visa || 0);
      const numDed = Number(editForm.deduction || 0);
      const numEnd = numStart + numCash - numDed;
      const bId = currentBranch === "all" ? "alamein4" : currentBranch;

      // Clean up empty items before saving
      const cleanedItems = (editForm.items || []).filter(item => item.description.trim() !== "");

      // Rebuild legacy strings for backward compatibility just in case
      const detailsStr = cleanedItems.map(i => i.description).join(" / ");
      const poStr = cleanedItems.map(i => i.po).join(" / ");

      await setDoc(doc(db, "end_shift_cash", `${editForm.date!}_${bId}`), {
        date: editForm.date,
        startCash: numStart,
        cash: numCash,
        visa: numVisa,
        deduction: numDed,
        details: detailsStr,
        poNumbers: poStr,
        items: cleanedItems,
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 print:bg-white print:p-0 print:pb-0">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm print:hidden">
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
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-bold text-sm rounded-lg transition-all"
            >
              <Printer className="h-4 w-4" />
              Print
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

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 print:p-0 print:max-w-none">
        
        {/* Filters Section */}
        <div className="mb-6 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-4 items-end print:hidden">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Date From</label>
            <input 
              type="date" 
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Date To</label>
            <input 
              type="date" 
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setFromDate(""); setToDate(""); }}
              className="px-4 py-2 text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 h-[42px]"
            >
              <FilterX className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>

        {/* Print Header only visible during print */}
        <div className="hidden print:block mb-8 text-center">
          <h1 className="text-3xl font-black mb-2 text-black">End Shift Cash Report</h1>
          <p className="text-gray-500 font-semibold">
            {fromDate && toDate ? `From ${fromDate} to ${toDate}` : 
             fromDate ? `From ${fromDate}` : 
             toDate ? `Until ${toDate}` : 'All Time'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden print:shadow-none print:border-none print:rounded-none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left print:text-xs">
              <thead className="text-[11px] text-slate-500 uppercase tracking-wider bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 print:text-black print:bg-gray-100">
                <tr>
                  <th className="px-3 py-3 font-black whitespace-nowrap">Date</th>
                  <th className="px-3 py-3 font-black text-right whitespace-nowrap bg-slate-100/30 dark:bg-slate-800/30 print:bg-transparent">Start Cash</th>
                  <th className="px-3 py-3 font-black text-right whitespace-nowrap text-teal-600/70 dark:text-teal-400/70 print:text-black">Cash (+ In)</th>
                  <th className="px-3 py-3 font-black text-right whitespace-nowrap text-blue-600/70 dark:text-blue-400/70 print:text-black">Visa</th>
                  <th className="px-3 py-3 font-black text-right whitespace-nowrap text-red-600/70 dark:text-red-400/70 print:text-black">Deduction (- Out)</th>
                  <th className="px-4 py-3 font-black w-2/5">Details & PO Numbers</th>
                  <th className="px-3 py-3 font-black text-right whitespace-nowrap bg-slate-100/30 dark:bg-slate-800/30 print:bg-transparent">End Cash (Auto)</th>
                  <th className="px-3 py-3 font-black text-center sticky right-0 bg-slate-50/95 dark:bg-slate-800/95 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] dark:shadow-[-4px_0_12px_rgba(0,0,0,0.2)] print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 print:divide-gray-300">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-12">
                      <div className="flex justify-center">
                        <Skeleton className="h-16 w-16 rounded-full" />
                      </div>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 && !isAddingNew ? (
                  <tr>
                    <td colSpan={8} className="text-center p-16 text-slate-400 font-semibold bg-slate-50/30 dark:bg-slate-800/10">
                      No shift records found for this period.
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredRecords.map((r, index) => {
                      const isEditing = editingId === r.id;
                      
                      return (
                        <tr key={r.id} className={`transition-colors print:break-inside-avoid ${isEditing ? 'bg-teal-50/50 dark:bg-teal-900/10' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'} print:hover:bg-transparent`}>
                          {/* Date */}
                          <td className="px-3 py-3 font-semibold whitespace-nowrap align-top">
                            {isEditing ? (
                              <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="px-2 py-1.5 border border-slate-200 dark:border-slate-800 focus:border-teal-500 rounded-md bg-white dark:bg-slate-950 text-sm" />
                            ) : (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-slate-400 print:hidden" />
                                <span className="print:font-bold">{r.date.split('-').reverse().join('/')}</span>
                              </div>
                            )}
                          </td>
                          
                          {/* Start Cash */}
                          <td className="px-3 py-3 font-mono text-slate-500 dark:text-slate-400 text-right bg-slate-100/30 dark:bg-slate-800/30 print:bg-transparent print:text-black align-top">
                            {isEditing && index === 0 ? (
                              <input type="number" value={editForm.startCash} onChange={e => setEditForm({...editForm, startCash: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm" />
                            ) : (
                              r.startCash.toLocaleString()
                            )}
                          </td>

                          {/* Cash */}
                          <td className="px-3 py-3 font-black text-teal-600 dark:text-teal-400 text-right print:text-black align-top">
                            {isEditing ? (
                              <input type="number" value={editForm.cash} onChange={e => setEditForm({...editForm, cash: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm" />
                            ) : (
                              r.cash.toLocaleString()
                            )}
                          </td>

                          {/* Visa */}
                          <td className="px-3 py-3 font-bold text-blue-600 dark:text-blue-400 text-right print:text-black align-top">
                            {isEditing ? (
                              <input type="number" value={editForm.visa} onChange={e => setEditForm({...editForm, visa: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm" />
                            ) : (
                              r.visa.toLocaleString()
                            )}
                          </td>

                          {/* Deduction */}
                          <td className="px-3 py-3 font-bold text-red-600 dark:text-red-400 text-right print:text-black align-top">
                            {isEditing ? (
                              <input type="number" value={editForm.deduction} onChange={e => setEditForm({...editForm, deduction: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm" />
                            ) : (
                              r.deduction.toLocaleString()
                            )}
                          </td>

                          {/* Details & PO Numbers as a list */}
                          <td className="px-4 py-3 align-top min-w-[250px]">
                            {isEditing ? (
                              <div className="space-y-2">
                                {(editForm.items || []).map((item, i) => (
                                  <div key={i} className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="flex-1 space-y-2">
                                      <input 
                                        type="text" 
                                        placeholder="Description..."
                                        value={item.description} 
                                        onChange={e => handleUpdateItem(i, "description", e.target.value)} 
                                        className="w-full px-2 py-1.5 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md bg-white dark:bg-slate-950 text-sm" 
                                      />
                                      <input 
                                        type="text" 
                                        placeholder="PO # (Optional)"
                                        value={item.po} 
                                        onChange={e => handleUpdateItem(i, "po", e.target.value)} 
                                        className="w-full px-2 py-1 border border-teal-200 dark:border-teal-800 focus:border-teal-500 rounded-md bg-white dark:bg-slate-950 text-xs font-mono" 
                                      />
                                    </div>
                                    <button onClick={() => handleRemoveItem(i)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded mt-1">
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                                <button 
                                  onClick={handleAddItem}
                                  className="text-xs font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 px-2 py-1.5 rounded flex items-center gap-1 w-full justify-center transition-colors"
                                >
                                  <Plus className="h-3.5 w-3.5" /> Add Detail
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {r.items && r.items.length > 0 ? (
                                  r.items.map((item, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between border-b border-slate-100 dark:border-slate-800/50 print:border-gray-200 last:border-0 pb-1.5 last:pb-0 gap-1">
                                      <span className="text-slate-700 dark:text-slate-300 print:text-black font-medium leading-tight">
                                        • {item.description}
                                      </span>
                                      {item.po && (
                                        <span className="text-[10px] sm:text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded print:bg-transparent print:border print:border-gray-300">
                                          PO: {item.po}
                                        </span>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-slate-400 italic">No details</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* End Cash */}
                          <td className="px-3 py-3 font-black text-right text-slate-800 dark:text-white bg-slate-100/30 dark:bg-slate-800/30 print:bg-transparent print:text-black align-top">
                            {isEditing ? (
                              <span className="text-teal-600 dark:text-teal-400">
                                {((Number(editForm.startCash ?? r.startCash)||0) + (Number(editForm.cash)||0) - (Number(editForm.deduction)||0)).toLocaleString()}
                              </span>
                            ) : (
                              r.endCash.toLocaleString()
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-3 text-center sticky right-0 bg-white/95 dark:bg-slate-900/95 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] dark:shadow-[-4px_0_12px_rgba(0,0,0,0.2)] print:hidden align-top">
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
                      <tr className="bg-teal-50/50 dark:bg-teal-900/10 border-b border-teal-100 dark:border-teal-900 print:hidden">
                        <td className="px-3 py-3 align-top">
                          <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="px-2 py-1.5 border border-teal-300 dark:border-teal-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md bg-white dark:bg-slate-950 text-sm shadow-sm" autoFocus />
                        </td>
                        <td className="px-3 py-3 font-mono text-slate-500 dark:text-slate-400 text-right bg-slate-100/30 dark:bg-slate-800/30 align-top">
                          {editPreviewStartCash.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <input type="number" value={editForm.cash} onChange={e => setEditForm({...editForm, cash: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-300 dark:border-teal-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm shadow-sm" placeholder="0" />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <input type="number" value={editForm.visa} onChange={e => setEditForm({...editForm, visa: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-300 dark:border-teal-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm shadow-sm" placeholder="0" />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <input type="number" value={editForm.deduction} onChange={e => setEditForm({...editForm, deduction: Number(e.target.value)})} className="w-20 px-2 py-1 border border-teal-300 dark:border-teal-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-md text-right bg-white dark:bg-slate-950 font-mono text-sm shadow-sm" placeholder="0" />
                        </td>
                        <td className="px-4 py-3 align-top min-w-[250px]">
                          <div className="space-y-2">
                            {(editForm.items || []).map((item, i) => (
                              <div key={i} className="flex items-start gap-2 bg-white dark:bg-slate-950 p-2 rounded-lg border border-teal-200 dark:border-teal-800 shadow-sm">
                                <div className="flex-1 space-y-2">
                                  <input 
                                    type="text" 
                                    placeholder="Description..."
                                    value={item.description} 
                                    onChange={e => handleUpdateItem(i, "description", e.target.value)} 
                                    className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-800 focus:border-teal-500 rounded-md bg-white dark:bg-slate-950 text-sm" 
                                  />
                                  <input 
                                    type="text" 
                                    placeholder="PO # (Optional)"
                                    value={item.po} 
                                    onChange={e => handleUpdateItem(i, "po", e.target.value)} 
                                    className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 focus:border-teal-500 rounded-md bg-slate-50 dark:bg-slate-900 text-xs font-mono" 
                                  />
                                </div>
                                <button onClick={() => handleRemoveItem(i)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded mt-1">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <button 
                              onClick={handleAddItem}
                              className="text-xs font-bold text-teal-700 bg-teal-100 hover:bg-teal-200 dark:bg-teal-900/50 dark:hover:bg-teal-800 px-2 py-1.5 rounded flex items-center gap-1 w-full justify-center transition-colors shadow-sm"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add Detail
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-black text-slate-800 dark:text-white text-right bg-slate-100/30 dark:bg-slate-800/30 align-top">
                          {(editPreviewStartCash + (Number(editForm.cash)||0) - (Number(editForm.deduction)||0)).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-center sticky right-0 bg-teal-50 dark:bg-teal-900/30 align-top">
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
