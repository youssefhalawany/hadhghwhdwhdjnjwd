"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  doc,
  Timestamp,
  limit
} from "firebase/firestore";
import { 
  Plus, 
  Download, 
  Trash2,
  Search,
  Loader2,
  X,
  FileDown
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";

const CATEGORY_EMOJIS: Record<string, string> = {
  order: "📦",
  maintenance: "🔧",
  utilities: "💡",
  transportation: "🚚",
  other: "📝"
};

const METHOD_EMOJIS: Record<string, string> = {
  cash: "💵",
  visa: "💳",
  bank_transfer: "🏦"
};

export default function PaymentsRedesignPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Data state
  const [payments, setPayments] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${mm}`;
  });

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form State
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("cash");
  const [category, setCategory] = useState("order");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [amount, setAmount] = useState("");
  const [tax, setTax] = useState("");
  const [categoryNote, setCategoryNote] = useState("");
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  
  // Print State
  const [selectedPaymentForPrint, setSelectedPaymentForPrint] = useState<any>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchData();
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Payments
      const paySnapshot = await getDocs(query(collection(db, "cash_payments"), orderBy("createdAt", "desc"), limit(200)));
      const loadedPayments = paySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setPayments(loadedPayments);

      // 2. Fetch Suppliers from both supplier_returns and cash_payments
      const uniqueSuppliers = new Set<string>();
      
      // Add from payments
      loadedPayments.forEach(p => {
        if (p.companyName) uniqueSuppliers.add(p.companyName.toUpperCase());
      });

      // Add from returns
      try {
        const returnsSnap = await getDocs(query(collection(db, "supplier_returns"), orderBy("createdAt", "desc"), limit(200)));
        returnsSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.supplier) uniqueSuppliers.add(data.supplier.toUpperCase());
        });
      } catch (returnsErr) {
        console.log("Could not load supplier returns for autocomplete list:", returnsErr);
      }

      setSuppliers(Array.from(uniqueSuppliers).sort().map((name, index) => ({ id: `sup_${index}`, name })));
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = () => {
    if (!newSupplierName.trim()) return;
    const name = newSupplierName.trim().toUpperCase();
    
    // Just add to local state, it will be persisted to cash_payments when a payment is saved
    const newSupp = { id: `sup_new_${Date.now()}`, name };
    setSuppliers(prev => [...prev, newSupp].sort((a, b) => a.name.localeCompare(b.name)));
    setCompanyName(name);
    setShowAddSupplier(false);
    setNewSupplierName("");
    toast.success("Supplier ready to be used!");
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !amount) {
      toast.error("Company name and amount are required.");
      return;
    }

    const numAmount = parseFloat(amount) || 0;
    const numTax = parseFloat(tax) || 0;
    const total = numAmount + numTax;

    try {
      setSubmitting(true);
      const newPayment = {
        amount: numAmount,
        category,
        categoryNote,
        companyName,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "unknown",
        date,
        description: categoryNote,
        invoiceNumber,
        isTaxable: numTax > 0,
        method,
        poNumber,
        storeId: "eL-alamein-4", 
        tax: numTax,
        total
      };

      const docRef = await addDoc(collection(db, "cash_payments"), newPayment);
      toast.success("Payment saved!");
      
      const savedPayment = { id: docRef.id, ...newPayment, createdAt: Timestamp.now() };
      setPayments([savedPayment, ...payments]);
      setShowAddModal(false);
      
      // Reset form
      setInvoiceNumber("");
      setPoNumber("");
      setAmount("");
      setTax("");
      setCategoryNote("");
      
      // Auto Print
      setSelectedPaymentForPrint(savedPayment);
      setTimeout(() => generatePDF(), 500);

    } catch (err) {
      console.error(err);
      toast.error("Failed to save payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this payment?")) return;
    try {
      await deleteDoc(doc(db, "cash_payments", id));
      setPayments(payments.filter(p => p.id !== id));
      toast.success("Payment deleted successfully.");
    } catch (err) {
      toast.error("Failed to delete payment.");
    }
  };

  const generatePDF = async () => {
    setGeneratingPDF(true);
    try {
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const page1 = document.getElementById("pdf-receipt");
      
      if (page1) {
        page1.style.left = "0";
        const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true });
        const imgData1 = canvas1.toDataURL("image/png");
        const pdfHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
        pdf.addImage(imgData1, "PNG", 0, 0, pdfWidth, pdfHeight1);
        page1.style.left = "-9999px";
      }

      pdf.autoPrint();
      window.open(pdf.output("bloburl"), "_blank");
      setSelectedPaymentForPrint(null);
    } catch (error) {
      toast.error("Failed to generate PDF.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Derived filtered data
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Month Filter
      if (monthFilter && p.date && !p.date.startsWith(monthFilter)) return false;
      
      // Search Filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.companyName?.toLowerCase().includes(q) ||
          p.invoiceNumber?.toLowerCase().includes(q) ||
          p.poNumber?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [payments, monthFilter, searchQuery]);

  // Aggregate Category Stats for the top cards
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {};
    filteredPayments.forEach(p => {
      const cat = p.category || "other";
      if (!stats[cat]) stats[cat] = { count: 0, total: 0 };
      stats[cat].count += 1;
      stats[cat].total += (p.total || 0);
    });
    return stats;
  }, [filteredPayments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 pb-20">
      
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        
        {/* MONTH FILTER */}
        <div>
          <input 
            type="month" 
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* ACTIONS ROW */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <button 
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add Payments
          </button>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <FileDown className="h-4 w-4" /> Export Payments
            </button>
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <FileDown className="h-4 w-4" /> Export All
            </button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
          <input 
            type="text" 
            placeholder="Search company, invoice, PO number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        {/* METRICS SUMMARY CARDS */}
        <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
          {categoryStats["order"] && (
            <div className="min-w-[240px] bg-[#eff6ff] dark:bg-blue-900/30 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-5 shrink-0">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📦</span>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Order</h3>
              </div>
              <p className="text-xs font-bold text-slate-500 mb-1">{categoryStats["order"].count} payment(s)</p>
              <p className="text-blue-600 dark:text-blue-400 font-bold text-lg">EGP {categoryStats["order"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
          )}
          {categoryStats["utilities"] && (
            <div className="min-w-[240px] bg-[#fefce8] dark:bg-amber-900/30 border border-amber-100 dark:border-amber-900/50 rounded-2xl p-5 shrink-0">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">💡</span>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Utilities</h3>
              </div>
              <p className="text-xs font-bold text-slate-500 mb-1">{categoryStats["utilities"].count} payment(s)</p>
              <p className="text-amber-600 dark:text-amber-500 font-bold text-lg">EGP {categoryStats["utilities"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
          )}
          {categoryStats["maintenance"] && (
            <div className="min-w-[240px] bg-[#f5f3ff] dark:bg-purple-900/30 border border-purple-100 dark:border-purple-900/50 rounded-2xl p-5 shrink-0">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🔧</span>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Maintenance</h3>
              </div>
              <p className="text-xs font-bold text-slate-500 mb-1">{categoryStats["maintenance"].count} payment(s)</p>
              <p className="text-purple-600 dark:text-purple-400 font-bold text-lg">EGP {categoryStats["maintenance"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
          )}
          {categoryStats["transportation"] && (
            <div className="min-w-[240px] bg-[#ecfdf5] dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-5 shrink-0">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🚚</span>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Transportation</h3>
              </div>
              <p className="text-xs font-bold text-slate-500 mb-1">{categoryStats["transportation"].count} payment(s)</p>
              <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">EGP {categoryStats["transportation"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
          )}
          {categoryStats["other"] && (
            <div className="min-w-[240px] bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shrink-0">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📝</span>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Other</h3>
              </div>
              <p className="text-xs font-bold text-slate-500 mb-1">{categoryStats["other"].count} payment(s)</p>
              <p className="text-slate-600 dark:text-slate-400 font-bold text-lg">EGP {categoryStats["other"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
          )}
        </div>

        {/* LIST HEADER */}
        <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider pt-4">
          All Records ({filteredPayments.length})
        </h2>

        {/* FEED / LIST VIEW */}
        <div className="space-y-4">
          {filteredPayments.map(pay => (
            <div key={pay.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-1">{CATEGORY_EMOJIS[pay.category] || "📝"}</span>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-lg leading-tight">{pay.companyName}</h3>
                    <p className="text-xs text-slate-500 font-bold mt-1">
                      {pay.date} • {METHOD_EMOJIS[pay.method] || ""} {pay.method}
                    </p>
                    {(pay.invoiceNumber || pay.poNumber) && (
                      <p className="text-xs text-slate-400 font-medium mt-1">
                        {pay.invoiceNumber && `Invoice: ${pay.invoiceNumber}`} 
                        {pay.invoiceNumber && pay.poNumber && " • "}
                        {pay.poNumber && `PO: ${pay.poNumber}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setSelectedPaymentForPrint(pay);
                      setTimeout(() => generatePDF(), 100);
                    }}
                    className="p-2 text-blue-600 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <Download size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(pay.id)}
                    className="p-2 text-red-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/30">
                <div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-1">Category</p>
                  <p className="font-bold text-slate-900 dark:text-white capitalize">{pay.category}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-1">Amount</p>
                  <p className="font-bold text-[#dc2626] text-lg">EGP {Number(pay.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-1">Tax</p>
                  <p className="font-bold text-slate-900 dark:text-white">EGP {Number(pay.tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-1">Total</p>
                  <p className="font-bold text-[#dc2626] text-lg">EGP {Number(pay.total).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              </div>
            </div>
          ))}

          {filteredPayments.length === 0 && (
            <div className="text-center py-12 text-slate-500 font-medium">
              No payments found matching your criteria.
            </div>
          )}
        </div>
      </div>

      {/* ADD PAYMENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl relative my-auto">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full"
            >
              <X size={20} />
            </button>
            
            <form onSubmit={handleSavePayment} className="p-6 space-y-5">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4">Create Payment</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-3 text-slate-800 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Method</label>
                  <select 
                    value={method} 
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-3 text-slate-800 dark:text-white"
                  >
                    <option value="cash">Cash</option>
                    <option value="visa">Visa</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Supplier / Company</label>
                  <button type="button" onClick={() => setShowAddSupplier(true)} className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
                    <Plus className="h-3 w-3" /> New Supplier
                  </button>
                </div>
                <select 
                  value={companyName} 
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-3 text-slate-800 dark:text-white font-bold"
                  required
                >
                  <option value="">Select a supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Invoice Number</label>
                  <input 
                    type="text" 
                    value={invoiceNumber} 
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-1234"
                    className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-3 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">System PO #</label>
                  <input 
                    type="text" 
                    value={poNumber} 
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="e.g. PO-9876"
                    className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-3 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-5 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                <div>
                  <label className="block text-xs font-black text-red-700 dark:text-red-400 uppercase mb-1">Amount (EGP)</label>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 rounded-lg p-3 text-slate-900 dark:text-white font-mono text-xl font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-red-700 dark:text-red-400 uppercase mb-1">Tax / VAT (EGP)</label>
                  <input 
                    type="number" 
                    value={tax} 
                    onChange={(e) => setTax(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 rounded-lg p-3 text-slate-900 dark:text-white font-mono text-xl"
                  />
                </div>
                <div className="col-span-2 flex justify-between items-center border-t border-red-200 dark:border-red-800 pt-4 mt-2">
                  <span className="font-black text-red-800 dark:text-red-300 uppercase">Total Payment:</span>
                  <span className="text-3xl font-black text-red-600 font-mono">
                    {((parseFloat(amount)||0) + (parseFloat(tax)||0)).toLocaleString('en-US', {minimumFractionDigits: 2})} <span className="text-base">EGP</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-3 text-slate-800 dark:text-white"
                  >
                    <option value="order">Supplier Order</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="utilities">Utilities</option>
                    <option value="transportation">Transportation</option>
                    <option value="other">Other / Misc</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes / Description</label>
                  <input 
                    type="text"
                    value={categoryNote} 
                    onChange={(e) => setCategoryNote(e.target.value)}
                    placeholder="Any additional details..."
                    className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-3 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full mt-4 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-xl p-4 font-black transition-all shadow-lg flex items-center justify-center gap-2 text-lg"
              >
                {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : "Save & Print Receipt"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD SUPPLIER SUB-MODAL */}
      {showAddSupplier && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Add New Supplier</h3>
            <input 
              type="text" 
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              placeholder="e.g. COCA COLA EG"
              className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-3 text-slate-800 dark:text-white mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowAddSupplier(false)}
                className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddSupplier}
                disabled={!newSupplierName.trim()}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Use Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT LAYOUT (A4) */}
      {selectedPaymentForPrint && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div id="pdf-receipt" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header like Shift Report */}
            <div style={{ padding: '20px 30px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '50px', height: '50px', border: '2px solid #000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '30px', fontWeight: 'bold', color: '#000', lineHeight: 1 }}>K</span>
                </div>
                <div>
                  <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>CIRCLE K EL-ALAMEIN 4</h1>
                  <p style={{ fontSize: '12px', color: '#333', margin: '2px 0 0', fontWeight: 'bold' }}>PAYMENT VOUCHER</p>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid #000`, borderRadius: '8px', padding: '6px 10px', minWidth: '60px' }}>
                  <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>Auth</p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#000', lineHeight: 1, whiteSpace: 'nowrap' }}>{selectedPaymentForPrint.createdBy?.split('@')[0] || "SYS"}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                  <span style={{ fontSize: '26px', fontWeight: 'bold', color: '#000' }} dir="rtl">إيصال استلام نقدية</span>
                </div>
              </div>
            </div>

            {/* Intro Text */}
            <div style={{ padding: '30px 30px 15px', textAlign: 'right', direction: 'rtl' }}>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#000', fontWeight: 'bold' }}>
                في حال تم سداد قيمة الفاتورة نقدًا، يُرجى من المورد تعبئة البيانات التالية لتوثيق عملية الاستلام في السجلات الرسمية.
              </p>
            </div>

            {/* 2x3 Grid Data */}
            <div style={{ padding: '0 30px', marginBottom: '20px', position: 'relative', zIndex: 10 }}>
              <div style={{ border: '2px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
                {/* Row 1 */}
                <div style={{ display: 'flex', borderBottom: '1px solid #000', backgroundColor: '#f9f9f9' }}>
                  <div style={{ flex: 1, padding: '12px 15px', borderRight: '1px solid #000' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Our Company</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>اسم شركتنا</span>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>El Masreya for Trade</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px 15px', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Invoice Company</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>اسم الشركة للفاتورة</span>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>{selectedPaymentForPrint.companyName}</div>
                  </div>
                </div>
                {/* Row 2 */}
                <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                  <div style={{ flex: 1, padding: '12px 15px', borderRight: '1px solid #000', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Invoice #</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>رقم الفاتورة</span>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000', fontFamily: 'monospace' }}>{selectedPaymentForPrint.invoiceNumber || '-'}</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px 15px', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>PO #</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>رقم الأمر</span>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000', fontFamily: 'monospace' }}>{selectedPaymentForPrint.poNumber || '-'}</div>
                  </div>
                </div>
                {/* Row 3 */}
                <div style={{ display: 'flex' }}>
                  <div style={{ flex: 1, padding: '12px 15px', borderRight: '1px solid #000', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Branch</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>اسم الفرع</span>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>El Alamein 4</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px 15px', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Date</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>التاريخ</span>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>{selectedPaymentForPrint.date}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Legal Paragraph */}
            <div style={{ padding: '20px 30px', textAlign: 'center', direction: 'rtl', position: 'relative', zIndex: 10 }}>
              <p style={{ margin: '0 auto', fontSize: '13px', lineHeight: '1.8', color: '#000', fontWeight: 'bold', maxWidth: '650px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', border: '1px dashed #000' }}>
                يُقر المورد باستلامه كامل قيمة الفاتورة المذكورة استلامًا نهائيًا وناجزًا، وبأنه لا يحق له بأي حال من الأحوال المطالبة بأي مبالغ إضافية تتعلق بهذه الفاتورة أو بهذا السداد، ويُعد هذا الإقرار مخالصة نهائية وشاملة وملزمة قانونًا.
              </p>
            </div>

            {/* Financial Section */}
            <div style={{ padding: '10px 30px', position: 'relative', zIndex: 10 }}>
              <div style={{ border: '2px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#f9f9f9', padding: '4px 15px', borderBottom: '1px solid #000', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Payment Audit & Variance</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                  <thead style={{ backgroundColor: '#fff', borderBottom: '1px solid #000' }}>
                    <tr><th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Invoice Value / قيمة الفاتورة</th><th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Tax / الضريبة</th><th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Total / الإجمالي</th><th style={{ padding: '6px 15px', fontWeight: 'bold' }}>Taxable / خاضع</th></tr>
                  </thead>
                  <tbody>
                    <tr style={{ backgroundColor: '#fff' }}>
                      <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(selectedPaymentForPrint.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(selectedPaymentForPrint.tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', backgroundColor: '#f0fdf4' }}>EGP {Number(selectedPaymentForPrint.total).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', textAlign: 'center', fontSize: '12px' }}>{Number(selectedPaymentForPrint.tax) > 0 ? '(Yes) نعم' : '(No) لا'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signatures & Stamp */}
            <div style={{ padding: '0 30px', marginTop: '50px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', backgroundColor: '#fff', border: '2px solid #000', borderRadius: '4px', position: 'relative', zIndex: 10, minHeight: '140px' }}>
                <div style={{ width: '30%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '9px', color: '#333', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.4, fontWeight: 'bold' }}>
                    I declare the above info is accurate and I received the funds.
                  </p>
                  <div>
                    <div style={{ position: 'relative', height: '30px', display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid #000', marginBottom: '8px' }}>
                      <div style={{ position: 'absolute', bottom: '4px', left: '0', width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#999', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        [ SIGNATURE ]
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', textAlign: 'center' }}>Supplier / المورد</p>
                  </div>
                </div>

                <div style={{ width: '30%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '9px', color: '#333', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.4, fontWeight: 'bold', textAlign: 'center' }}>
                    National ID attached.
                  </p>
                  <div>
                    <div style={{ position: 'relative', height: '30px', display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid #000', marginBottom: '8px' }}>
                      <div style={{ position: 'absolute', bottom: '4px', left: '0', width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#999', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        [ ID COPY ]
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', textAlign: 'center' }}>National ID / الرقم القومي</p>
                  </div>
                </div>

                <div style={{ width: '30%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  {/* The specific blue stamp from the Shift Report */}
                  <div style={{ 
                    border: '3px solid #000080', 
                    borderRadius: '4px', 
                    padding: '10px 15px', 
                    transform: 'rotate(-2deg)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontFamily: '"Arial Black", Impact, "Arial Rounded MT Bold", sans-serif',
                    opacity: 0.85,
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,128,0.2), 0 0 0 1px rgba(0,0,128,0.2)'
                  }}>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: '#000080', letterSpacing: '1px', lineHeight: 1.2 }}>Circle k</span>
                    <span style={{ fontSize: '16px', fontWeight: '900', color: '#000080', letterSpacing: '0.5px', lineHeight: 1.2 }}>El Alamein 4</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Approved Stamp (placed in the large empty area at the bottom) */}
            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '180px' }}>
              <div style={{ transform: 'rotate(-5deg)', opacity: 0.85 }}>
                <div style={{ border: '5px solid #16a34a', borderRadius: '50%', width: '160px', height: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#16a34a', backgroundColor: 'transparent', boxShadow: 'inset 0 0 0 2px rgba(22, 163, 74, 0.2), 0 0 0 2px rgba(22, 163, 74, 0.2)' }}>
                  <span style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>APPROVED</span>
                  <span style={{ fontSize: '18px', fontWeight: '900', borderBottom: '2px solid #16a34a', paddingBottom: '4px', marginBottom: '6px' }}>معتمد</span>
                  <span style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '1px' }}>PAYMENT</span>
                  <span style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '4px' }}>{selectedPaymentForPrint.date}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 'auto', marginBottom: '20px', marginLeft: '30px', marginRight: '30px', borderTop: '2px solid #000', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
              <p style={{ fontSize: '8px', color: '#333', fontFamily: 'monospace', margin: 0, letterSpacing: '0.5px', fontWeight: 'bold' }}>
                PAYMENT ID: {selectedPaymentForPrint.id} | PRINTED: {new Date().toLocaleString()} | AUTHORIZED: SYS
              </p>
              <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#000' }}>PAGE 1 OF 1</p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
