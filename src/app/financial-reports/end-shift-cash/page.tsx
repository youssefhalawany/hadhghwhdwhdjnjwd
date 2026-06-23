"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ArrowLeft, Wallet, PlusCircle, FileText, Calendar, Trash2, Edit2, Check, X } from "lucide-react";
import Link from "next/link";
import { vibrateSuccess, vibrateError } from "@/lib/haptics";
import { NumericFormat } from "react-number-format";

type EndShiftRecord = {
  id: string;
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
  const [records, setRecords] = useState<EndShiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startCash, setStartCash] = useState<string>("");
  const [cash, setCash] = useState<string>("");
  const [visa, setVisa] = useState<string>("");
  const [deduction, setDeduction] = useState<string>("");
  const [details, setDetails] = useState("");
  const [poNumbers, setPoNumbers] = useState("");
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<EndShiftRecord>>({});

  useEffect(() => {
    const q = query(collection(db, "end_shift_cash"), orderBy("date", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as EndShiftRecord));
      setRecords(fetched);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Auto-fill startCash based on selected date
  useEffect(() => {
    if (records.length === 0) return;
    
    // Find the record immediately preceding the selected date
    const previousRecords = records.filter(r => r.date < date).sort((a, b) => b.date.localeCompare(a.date));
    
    if (previousRecords.length > 0) {
      setStartCash(previousRecords[0].endCash.toString());
    } else {
      setStartCash("0"); // If it's the very first record
    }
  }, [date, records]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (startCash === "" || cash === "" || visa === "" || deduction === "") {
      vibrateError();
      alert("Please fill in all numerical fields (use 0 if none).");
      return;
    }

    setSubmitting(true);
    try {
      const numStart = Number(startCash);
      const numCash = Number(cash);
      const numVisa = Number(visa);
      const numDed = Number(deduction);
      const numEnd = numStart + numCash - numDed;

      await addDoc(collection(db, "end_shift_cash"), {
        date,
        startCash: numStart,
        cash: numCash,
        visa: numVisa,
        deduction: numDed,
        details: details.trim(),
        poNumbers: poNumbers.trim(),
        endCash: numEnd,
        createdAt: new Date().toISOString()
      });

      // Reset form but keep date advanced by 1 day as a convenience? Let's just keep the date or advance it.
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      setDate(nextDay.toISOString().split('T')[0]);
      
      setCash("");
      setVisa("");
      setDeduction("");
      setDetails("");
      setPoNumbers("");
      
      vibrateSuccess();
    } catch (error) {
      vibrateError();
      console.error("Error adding record:", error);
      alert("Failed to log record.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this record? This may affect subsequent balances.")) return;
    try {
      await deleteDoc(doc(db, "end_shift_cash", id));
      vibrateSuccess();
    } catch (error) {
      console.error("Error deleting record:", error);
      alert("Failed to delete record.");
    }
  };

  const startEditing = (record: EndShiftRecord) => {
    setEditingId(record.id);
    setEditForm(record);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    
    try {
      const numStart = Number(editForm.startCash || 0);
      const numCash = Number(editForm.cash || 0);
      const numVisa = Number(editForm.visa || 0);
      const numDed = Number(editForm.deduction || 0);
      const numEnd = numStart + numCash - numDed;

      await updateDoc(doc(db, "end_shift_cash", editingId), {
        date: editForm.date,
        startCash: numStart,
        cash: numCash,
        visa: numVisa,
        deduction: numDed,
        details: editForm.details || "",
        poNumbers: editForm.poNumbers || "",
        endCash: numEnd,
        updatedAt: new Date().toISOString()
      });
      setEditingId(null);
      vibrateSuccess();
    } catch (error) {
      vibrateError();
      console.error("Error updating record:", error);
      alert("Failed to update record.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100">
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10">
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
                End Shift Cash Report
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* LEFT COLUMN: Add Form */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <PlusCircle className="h-5 w-5 text-teal-500" />
              <h2 className="text-lg font-black uppercase tracking-wider">Add Record</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Date</label>
                <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-bold" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Start Cash</label>
                <NumericFormat 
                  required 
                  value={startCash} 
                  onValueChange={(values) => setStartCash(values.value)} 
                  thousandSeparator=","
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-bold" 
                  placeholder="0" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cash</label>
                  <NumericFormat 
                    required 
                    value={cash} 
                    onValueChange={(values) => setCash(values.value)} 
                    thousandSeparator=","
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-bold text-teal-600 dark:text-teal-400" 
                    placeholder="0" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Visa</label>
                  <NumericFormat 
                    required 
                    value={visa} 
                    onValueChange={(values) => setVisa(values.value)} 
                    thousandSeparator=","
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-bold text-blue-600 dark:text-blue-400" 
                    placeholder="0" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Deduction</label>
                <NumericFormat 
                  required 
                  value={deduction} 
                  onValueChange={(values) => setDeduction(values.value)} 
                  thousandSeparator=","
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-bold text-red-600 dark:text-red-400" 
                  placeholder="0" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Details / Notes</label>
                <input type="text" value={details} onChange={e => setDetails(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm" placeholder="e.g. Maintenance" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">PO Numbers</label>
                <input type="text" value={poNumbers} onChange={e => setPoNumbers(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm" placeholder="e.g. 2551691" />
              </div>

              <div className="pt-2">
                <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 p-3 rounded-xl mb-4">
                  <span className="text-xs font-bold uppercase text-slate-500">Preview End Cash:</span>
                  <span className="font-black text-lg text-teal-600 dark:text-teal-400">
                    {(Number(startCash || 0) + Number(cash || 0) - Number(deduction || 0)).toLocaleString()}
                  </span>
                </div>

                <button type="submit" disabled={submitting} className={`w-full py-3 ${submitting ? 'bg-slate-500 opacity-50 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700 active:scale-[0.98] cursor-pointer'} text-white rounded-xl font-black uppercase tracking-wider text-sm shadow-lg shadow-teal-500/20 transition-all`}>
                  {submitting ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Data Table */}
        <div className="xl:col-span-3 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-black flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-500" />
                Shift Records
              </h2>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-bold whitespace-nowrap">Date</th>
                    <th className="px-4 py-3 font-bold text-right whitespace-nowrap">Start Cash</th>
                    <th className="px-4 py-3 font-bold text-right whitespace-nowrap">Cash</th>
                    <th className="px-4 py-3 font-bold text-right whitespace-nowrap">Visa</th>
                    <th className="px-4 py-3 font-bold text-right whitespace-nowrap">Deduction</th>
                    <th className="px-4 py-3 font-bold">Details</th>
                    <th className="px-4 py-3 font-bold whitespace-nowrap">PO Numbers</th>
                    <th className="px-4 py-3 font-bold text-right whitespace-nowrap">End Cash</th>
                    <th className="px-4 py-3 font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="text-center p-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-teal-500"></div>
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center p-8 text-slate-500 font-medium">
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    records.map((r) => {
                      const isEditing = editingId === r.id;
                      
                      return (
                        <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          {/* Date */}
                          <td className="px-4 py-3 font-semibold whitespace-nowrap">
                            {isEditing ? (
                              <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="w-full p-1 border rounded" />
                            ) : (
                              new Date(r.date).toLocaleDateString('en-GB')
                            )}
                          </td>
                          
                          {/* Start Cash */}
                          <td className="px-4 py-3 font-bold text-right">
                            {isEditing ? (
                              <input type="number" value={editForm.startCash} onChange={e => setEditForm({...editForm, startCash: Number(e.target.value)})} className="w-20 p-1 border rounded text-right" />
                            ) : (
                              r.startCash.toLocaleString()
                            )}
                          </td>

                          {/* Cash */}
                          <td className="px-4 py-3 font-bold text-teal-600 dark:text-teal-400 text-right">
                            {isEditing ? (
                              <input type="number" value={editForm.cash} onChange={e => setEditForm({...editForm, cash: Number(e.target.value)})} className="w-20 p-1 border rounded text-right" />
                            ) : (
                              r.cash.toLocaleString()
                            )}
                          </td>

                          {/* Visa */}
                          <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400 text-right">
                            {isEditing ? (
                              <input type="number" value={editForm.visa} onChange={e => setEditForm({...editForm, visa: Number(e.target.value)})} className="w-20 p-1 border rounded text-right" />
                            ) : (
                              r.visa.toLocaleString()
                            )}
                          </td>

                          {/* Deduction */}
                          <td className="px-4 py-3 font-bold text-red-600 dark:text-red-400 text-right">
                            {isEditing ? (
                              <input type="number" value={editForm.deduction} onChange={e => setEditForm({...editForm, deduction: Number(e.target.value)})} className="w-20 p-1 border rounded text-right" />
                            ) : (
                              r.deduction.toLocaleString()
                            )}
                          </td>

                          {/* Details */}
                          <td className="px-4 py-3 max-w-[150px] truncate" title={r.details}>
                            {isEditing ? (
                              <input type="text" value={editForm.details} onChange={e => setEditForm({...editForm, details: e.target.value})} className="w-full p-1 border rounded" />
                            ) : (
                              r.details
                            )}
                          </td>

                          {/* PO Numbers */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {isEditing ? (
                              <input type="text" value={editForm.poNumbers} onChange={e => setEditForm({...editForm, poNumbers: e.target.value})} className="w-full p-1 border rounded" />
                            ) : (
                              r.poNumbers
                            )}
                          </td>

                          {/* End Cash */}
                          <td className="px-4 py-3 font-black text-right whitespace-nowrap">
                            {isEditing ? (
                              <span className="text-teal-500">
                                {((Number(editForm.startCash)||0) + (Number(editForm.cash)||0) - (Number(editForm.deduction)||0)).toLocaleString()}
                              </span>
                            ) : (
                              r.endCash.toLocaleString()
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-center">
                            {isEditing ? (
                              <div className="flex justify-center gap-2">
                                <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg">
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={cancelEditing} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-2">
                                <button onClick={() => startEditing(r)} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors">
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
