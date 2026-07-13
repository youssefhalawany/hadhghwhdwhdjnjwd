"use client";

import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { 
  Plus, 
  Printer, 
  Wallet, 
  Banknote, 
  Landmark, 
  Loader2,
  FileText,
  AlertTriangle,
  Search,
  CheckCircle2,
  Clock
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";

export default function PaymentsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Data state
  const [payments, setPayments] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  
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
  
  // Modals / Overlays
  const [showAddSupplier, setShowAddSupplier] = useState(false);
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
      // Fetch Suppliers
      const supSnapshot = await getDocs(query(collection(db, "suppliers"), orderBy("name", "asc")));
      const supData = supSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setSuppliers(supData);

      // Fetch Payments
      const paySnapshot = await getDocs(query(collection(db, "cash_payments"), orderBy("createdAt", "desc")));
      const payData = paySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPayments(payData);

    } catch (err) {
      console.error("Error fetching data", err);
      toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    try {
      setSubmitting(true);
      await addDoc(collection(db, "suppliers"), {
        name: newSupplierName.trim().toUpperCase(),
        createdAt: serverTimestamp()
      });
      toast.success("Supplier added!");
      setCompanyName(newSupplierName.trim().toUpperCase());
      setShowAddSupplier(false);
      setNewSupplierName("");
      // Refresh suppliers
      const supSnapshot = await getDocs(query(collection(db, "suppliers"), orderBy("name", "asc")));
      setSuppliers(supSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    } catch (err) {
      console.error(err);
      toast.error("Failed to add supplier");
    } finally {
      setSubmitting(false);
    }
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
        storeId: "eL-alamein-4", // Hardcoded per screenshot context, could be dynamic
        tax: numTax,
        total
      };

      const docRef = await addDoc(collection(db, "cash_payments"), newPayment);
      toast.success("Payment recorded successfully!");
      
      // Add local ID for immediate printing without refresh
      const savedPayment = { id: docRef.id, ...newPayment, createdAt: Timestamp.now() };
      setPayments([savedPayment, ...payments]);
      
      // Reset form
      setInvoiceNumber("");
      setPoNumber("");
      setAmount("");
      setTax("");
      setCategoryNote("");
      
      // Auto-trigger print
      setSelectedPaymentForPrint(savedPayment);
      setTimeout(() => {
        generatePDF();
      }, 500);

    } catch (err) {
      console.error(err);
      toast.error("Failed to save payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const generatePDF = async () => {
    setGeneratingPDF(true);
    try {
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      const page1 = document.getElementById("pdf-receipt");
      if (page1) {
        // ensure element is visible before capture
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
      console.error("PDF Generate Error:", error);
      toast.error("Failed to generate PDF Receipt.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Calculations for top metrics
  const todayDate = new Date().toISOString().split("T")[0];
  const todayPayments = payments.filter(p => p.date === todayDate);
  const totalCashToday = todayPayments.filter(p => p.method === "cash").reduce((acc, p) => acc + (p.total || 0), 0);
  const totalVisaToday = todayPayments.filter(p => p.method === "visa").reduce((acc, p) => acc + (p.total || 0), 0);
  const totalBankToday = todayPayments.filter(p => p.method === "bank_transfer").reduce((acc, p) => acc + (p.total || 0), 0);

  const pettyCashWarning = totalCashToday > 10000;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Financials: Payments</h1>
          <p className="text-slate-500 mt-2">Record, manage, and print payment vouchers securely.</p>
        </div>
      </div>

      {/* TOP METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-600 dark:text-slate-400">Total Payments Today</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{todayPayments.length}</p>
        </div>
        
        <div className={`bg-white dark:bg-slate-900 border ${pettyCashWarning ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'} rounded-2xl p-5 shadow-sm relative overflow-hidden`}>
          {pettyCashWarning && <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>}
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 ${pettyCashWarning ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'} rounded-lg`}>
              <Banknote className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-600 dark:text-slate-400">Cash Paid Today</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalCashToday.toLocaleString()}</p>
            <span className="text-sm font-medium text-slate-500">EGP</span>
          </div>
          {pettyCashWarning && (
            <p className="text-xs text-red-500 font-bold mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Exceeds 10K Safe Limit
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <Wallet className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-600 dark:text-slate-400">Visa Paid Today</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalVisaToday.toLocaleString()}</p>
            <span className="text-sm font-medium text-slate-500">EGP</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <Landmark className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-600 dark:text-slate-400">Bank Transfer Today</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalBankToday.toLocaleString()}</p>
            <span className="text-sm font-medium text-slate-500">EGP</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT PANEL: FORM */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSavePayment} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">New Payment Voucher</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-2.5 text-slate-800 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Method</label>
                <select 
                  value={method} 
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-2.5 text-slate-800 dark:text-white"
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
                  <Plus className="h-3 w-3" /> New
                </button>
              </div>
              <select 
                value={companyName} 
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-2.5 text-slate-800 dark:text-white"
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
                  className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-2.5 text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">System PO #</label>
                <input 
                  type="text" 
                  value={poNumber} 
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="e.g. PO-9876"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-2.5 text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (EGP)</label>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg p-2.5 text-slate-800 dark:text-white font-mono text-lg font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tax / VAT (EGP)</label>
                <input 
                  type="number" 
                  value={tax} 
                  onChange={(e) => setTax(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg p-2.5 text-slate-800 dark:text-white font-mono text-lg"
                />
              </div>
              <div className="col-span-2 flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-3 mt-1">
                <span className="font-bold text-slate-600 dark:text-slate-400">Total Payment:</span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                  {((parseFloat(amount)||0) + (parseFloat(tax)||0)).toLocaleString('en-US', {minimumFractionDigits: 2})} <span className="text-sm">EGP</span>
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-2.5 text-slate-800 dark:text-white"
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
              <textarea 
                value={categoryNote} 
                onChange={(e) => setCategoryNote(e.target.value)}
                placeholder="Any additional details..."
                rows={2}
                className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-2.5 text-slate-800 dark:text-white resize-none"
              />
            </div>

            <button 
              type="submit" 
              disabled={submitting}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-xl p-4 font-bold transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
              {submitting ? "Saving..." : "Save & Print Receipt"}
            </button>
          </form>
        </div>

        {/* RIGHT PANEL: DATA TABLE */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Payments Log</h2>
            </div>
            
            <div className="overflow-x-auto flex-1 max-h-[700px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                  <tr>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-400">Date</th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-400">Supplier</th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-400">Method</th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-400">INV / PO</th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-400 text-right">Total (EGP)</th>
                    <th className="p-4 font-bold text-slate-600 dark:text-slate-400 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments.map(pay => (
                    <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-slate-800 dark:text-slate-200 font-medium">
                        {pay.date}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white">{pay.companyName}</div>
                        <div className="text-xs text-slate-500 uppercase">{pay.category}</div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                          ${pay.method === 'cash' ? 'bg-emerald-100 text-emerald-700' : 
                            pay.method === 'visa' ? 'bg-purple-100 text-purple-700' : 
                            'bg-amber-100 text-amber-700'}`}>
                          {pay.method.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {pay.invoiceNumber && <div>INV: {pay.invoiceNumber}</div>}
                        {pay.poNumber && <div>PO: {pay.poNumber}</div>}
                      </td>
                      <td className="p-4 text-right font-bold text-slate-900 dark:text-white font-mono">
                        {pay.total?.toLocaleString()}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => {
                            setSelectedPaymentForPrint(pay);
                            setTimeout(() => generatePDF(), 100);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No payment records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ADD SUPPLIER MODAL */}
      {showAddSupplier && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
                disabled={!newSupplierName.trim() || submitting}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT LAYOUT (A4) */}
      {selectedPaymentForPrint && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div id="pdf-receipt" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', padding: '40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            
            {/* Background Watermark Logo */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 0, opacity: 0.04, pointerEvents: 'none' }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Circle_K_logo.svg/2048px-Circle_K_logo.svg.png" alt="Watermark" style={{ width: '500px', filter: 'grayscale(100%)' }} />
            </div>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #000', paddingBottom: '20px', marginBottom: '30px', position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '70px', height: '70px', border: '3px solid #000', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '42px', fontWeight: '900', color: '#000', lineHeight: 1 }}>K</span>
                </div>
                <div>
                  <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Payment Voucher</h1>
                  <p style={{ fontSize: '14px', color: '#000', margin: '4px 0 0', fontWeight: 'bold', textTransform: 'uppercase' }}>Circle K - El Alamein 4</p>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                <Barcode value={selectedPaymentForPrint.id.substring(0, 10).toUpperCase()} width={1.5} height={40} fontSize={12} displayValue={true} margin={0} />
                <div style={{ backgroundColor: '#000', color: '#fff', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                  {selectedPaymentForPrint.method.replace('_', ' ').toUpperCase()} PAYMENT
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div style={{ position: 'relative', zIndex: 10, flex: 1 }}>
              
              {/* Top Meta Data Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                <div style={{ border: '2px solid #000', borderRadius: '8px', padding: '15px' }}>
                  <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Paid To (Supplier / Vendor)</p>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#000' }}>{selectedPaymentForPrint.companyName}</p>
                </div>
                <div style={{ border: '2px solid #000', borderRadius: '8px', padding: '15px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Date of Payment</p>
                    <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#000' }}>{selectedPaymentForPrint.date}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Category</p>
                    <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#000', textTransform: 'uppercase' }}>{selectedPaymentForPrint.category}</p>
                  </div>
                </div>
              </div>

              {/* References Table */}
              <div style={{ border: '2px solid #000', borderRadius: '8px', marginBottom: '30px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#f9f9f9', padding: '10px 15px', borderBottom: '2px solid #000', fontWeight: '900', color: '#000', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Document References
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: '#fff' }}>
                  <div style={{ padding: '15px', borderRight: '1px solid #000' }}>
                    <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>Supplier Invoice Number</p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#000', fontFamily: 'monospace' }}>{selectedPaymentForPrint.invoiceNumber || 'N/A'}</p>
                  </div>
                  <div style={{ padding: '15px' }}>
                    <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>System PO Number</p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#000', fontFamily: 'monospace' }}>{selectedPaymentForPrint.poNumber || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div style={{ border: '2px solid #000', borderRadius: '8px', marginBottom: '30px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#f9f9f9', padding: '10px 15px', borderBottom: '2px solid #000', fontWeight: '900', color: '#000', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Financial Details
                </div>
                <div style={{ padding: '15px 30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                    <span>Payment Amount (Base)</span>
                    <span style={{ fontFamily: 'monospace' }}>EGP {Number(selectedPaymentForPrint.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #ccc', fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                    <span>Tax / VAT Applied</span>
                    <span style={{ fontFamily: 'monospace' }}>EGP {Number(selectedPaymentForPrint.tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: '#000', textTransform: 'uppercase' }}>Total Paid</span>
                    <span style={{ fontSize: '32px', fontWeight: '900', color: '#000', fontFamily: 'monospace' }}>
                      EGP {Number(selectedPaymentForPrint.total).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedPaymentForPrint.categoryNote && (
                <div style={{ border: '2px solid #000', borderRadius: '8px', padding: '15px', marginBottom: '30px' }}>
                  <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Payment Notes & Description</p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#000', fontStyle: 'italic', fontWeight: 'bold' }}>{selectedPaymentForPrint.categoryNote}</p>
                </div>
              )}

            </div>

            {/* Signatures Block at Bottom */}
            <div style={{ marginTop: 'auto', border: '3px solid #000', borderRadius: '12px', padding: '20px', backgroundColor: '#fdfdfd', position: 'relative', zIndex: 10 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: '900', color: '#000', textTransform: 'uppercase', textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '10px' }}>Official Sign-Off & Receipt Acknowledgement</h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '40px' }}>
                {/* Supplier Sign-off */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '11px', color: '#333', fontStyle: 'italic', marginBottom: '15px', fontWeight: 'bold' }}>
                    I, the undersigned representative of <span style={{ textDecoration: 'underline' }}>{selectedPaymentForPrint.companyName}</span>, acknowledge receipt of the total payment amount specified above in full satisfaction of the referenced invoice(s).
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#000', width: '120px' }}>Recipient Name:</span>
                      <div style={{ flex: 1, borderBottom: '1px solid #000', height: '20px' }}></div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#000', width: '120px' }}>National ID:</span>
                      <div style={{ flex: 1, borderBottom: '1px solid #000', height: '20px' }}></div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginTop: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#000', width: '120px' }}>Signature:</span>
                      <div style={{ flex: 1, borderBottom: '1px solid #000', height: '40px' }}></div>
                    </div>
                  </div>
                </div>

                {/* Vertical Divider */}
                <div style={{ width: '2px', backgroundColor: '#000', margin: '0 10px' }}></div>

                {/* Manager Sign-off */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '11px', color: '#333', fontStyle: 'italic', marginBottom: '15px', fontWeight: 'bold' }}>
                    I, the undersigned authorized manager, confirm that this payment was executed in accordance with company policy and funds were correctly disbursed from the branch safe/account.
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#000', width: '120px' }}>Authorized By:</span>
                      <div style={{ flex: 1, borderBottom: '1px solid #000', height: '20px' }}>
                        <span style={{ display: 'block', paddingBottom: '2px', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                          {selectedPaymentForPrint.createdBy?.split('@')[0].replace('.', ' ')}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginTop: '40px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#000', width: '120px' }}>Signature & Stamp:</span>
                      <div style={{ flex: 1, borderBottom: '1px solid #000', height: '40px', position: 'relative' }}>
                        {/* Fake Stamp purely for visual aesthetics of the form */}
                        <div style={{ 
                          position: 'absolute', right: '10px', bottom: '10px',
                          border: '2px solid rgba(0,0,128,0.2)', padding: '4px', borderRadius: '4px', transform: 'rotate(-5deg)', opacity: 0.5, pointerEvents: 'none'
                        }}>
                          <div style={{ fontSize: '10px', fontWeight: '900', color: 'rgba(0,0,128,0.2)', textTransform: 'uppercase' }}>Approved Payment</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '20px', borderTop: '2px solid #000', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
              <p style={{ fontSize: '9px', color: '#666', fontFamily: 'monospace', margin: 0, fontWeight: 'bold' }}>
                PAYMENT_ID: {selectedPaymentForPrint.id} | TIMESTAMP: {new Date().toLocaleString()}
              </p>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <QRCode value={window.location.origin + '/financials/payments/' + selectedPaymentForPrint.id} size={30} level="L" />
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
