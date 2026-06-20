"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, limit } from "firebase/firestore";
import { ArrowLeft, PlusCircle, FileText, Calendar, Trash2, Building2, Tag, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";

export default function VendorReceiptsPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<"Paid" | "Credit">("Credit");
  const [paymentDate, setPaymentDate] = useState("");

  const [uniqueCompanies, setUniqueCompanies] = useState<string[]>([]);

  useEffect(() => {
    // Fetch last 50 receipts to display and extract unique company names for autocomplete
    const q = query(collection(db, "vendor_receipts"), orderBy("receiptDate", "desc"), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReceipts(data);
      
      const companies = Array.from(new Set(data.map((d: any) => d.companyName).filter(Boolean)));
      setUniqueCompanies(companies as string[]);
      
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !price || isNaN(Number(price)) || Number(price) <= 0) {
      alert("Please enter a valid company name and price.");
      return;
    }

    setSubmitting(true);
    try {
      let createdBy = "Unknown Admin";
      const sessionStr = localStorage.getItem("active_cashier_session");
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        createdBy = session.email || session.name || "Unknown Admin";
      }

      await addDoc(collection(db, "vendor_receipts"), {
        companyName: companyName.trim(),
        poNumber: poNumber.trim(),
        receiptDate,
        price: Number(price),
        status,
        paymentDate: status === "Paid" ? paymentDate : null,
        createdBy,
        createdAt: new Date().toISOString()
      });

      setPoNumber("");
      setPrice("");
      setStatus("Credit");
      setPaymentDate("");
      alert("Receipt logged successfully!");
    } catch (error) {
      console.error("Error adding receipt:", error);
      alert("Failed to log receipt.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this receipt record?")) return;
    try {
      await deleteDoc(doc(db, "vendor_receipts", id));
    } catch (error) {
      console.error("Error deleting receipt:", error);
      alert("Failed to delete record.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100">
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/financial-reports" className="flex items-center gap-1 text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <span className="font-bold text-sm">Back</span>
            </Link>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                <Building2 className="h-5 w-5 text-orange-500" />
                Vendor Receipts Log
              </h1>
            </div>
          </div>
          <Link href="/financial-reports/vendor-statements" className="text-sm font-bold text-orange-600 dark:text-orange-400 hover:underline">
            View Statements →
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Add Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <PlusCircle className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-black uppercase tracking-wider">Log Vendor Receipt</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Company Name</label>
                <input 
                  required 
                  type="text" 
                  list="companies-list"
                  value={companyName} 
                  onChange={e => setCompanyName(e.target.value)} 
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-sm font-bold" 
                  placeholder="e.g. Edita, Coca-Cola" 
                />
                <datalist id="companies-list">
                  {uniqueCompanies.map((c, i) => <option key={i} value={c} />)}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Receipt Date</label>
                  <input required type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-sm font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">PO Number</label>
                  <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-sm font-bold" placeholder="PO-12345" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Price (EGP)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">EGP</span>
                  <input required type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} className="w-full pl-12 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-lg font-black" placeholder="0.00" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Payment Status</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setStatus("Credit")} className={`p-3 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all ${status === "Credit" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    <Clock className="h-4 w-4" /> Credit
                  </button>
                  <button type="button" onClick={() => { setStatus("Paid"); if(!paymentDate) setPaymentDate(new Date().toISOString().split('T')[0]); }} className={`p-3 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all ${status === "Paid" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    <CheckCircle className="h-4 w-4" /> Paid
                  </button>
                </div>
              </div>

              {status === "Paid" && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Payment Date</label>
                  <input required type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-emerald-50/50 dark:bg-emerald-900/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-bold text-emerald-800 dark:text-emerald-400" />
                </div>
              )}

              <button type="submit" disabled={submitting} className="w-full py-3.5 mt-4 bg-slate-900 hover:bg-slate-800 dark:bg-orange-600 dark:hover:bg-orange-700 text-white rounded-xl font-black uppercase tracking-wider text-sm shadow-lg shadow-slate-900/20 active:scale-[0.98] transition-all disabled:opacity-50">
                {submitting ? "Logging..." : "Log Receipt"}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Recent Receipts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-black">Recent Receipts</h2>
          </div>

          {loading ? (
            <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div></div>
          ) : receipts.length === 0 ? (
            <div className="bg-white/50 dark:bg-slate-900/50 rounded-3xl p-12 text-center border border-dashed border-slate-300 dark:border-slate-700">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-500">No receipts logged yet.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
              {receipts.map((receipt) => {
                const isPaid = receipt.status === "Paid";
                return (
                  <div key={receipt.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-orange-500/30 transition-colors">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="bg-slate-100 dark:bg-slate-800 h-12 w-12 rounded-xl flex items-center justify-center text-slate-500 font-black shrink-0">
                        {receipt.companyName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-slate-800 dark:text-white text-base">{receipt.companyName}</span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {isPaid ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {receipt.status}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {receipt.receiptDate}</span>
                          {receipt.poNumber && <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> PO: {receipt.poNumber}</span>}
                          {isPaid && receipt.paymentDate && <span className="text-emerald-600 font-bold">Paid on: {receipt.paymentDate}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        EGP {receipt.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <button onClick={() => handleDelete(receipt.id)} className="sm:opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
