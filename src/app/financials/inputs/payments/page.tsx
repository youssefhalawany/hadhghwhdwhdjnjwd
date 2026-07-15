"use client";

// @ts-expect-error
import QRCodeLib from "qrcode";

function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";
  
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
  
  function getBelow100(n: number): string {
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    if (o === 0) return tens[t];
    return ones[o] + " و" + tens[t];
  }
  
  function getBelow1000(n: number): string {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    if (h === 0) return getBelow100(rest);
    const hText = hundreds[h];
    if (rest === 0) return hText;
    return hText + " و" + getBelow100(rest);
  }
  
  const thousands = Math.floor(num / 1000);
  const remainder = num % 1000;
  
  let result = "";
  
  if (thousands > 0) {
    if (thousands === 1) result += "ألف";
    else if (thousands === 2) result += "ألفان";
    else if (thousands >= 3 && thousands <= 10) result += getBelow100(thousands) + " آلاف";
    else result += getBelow1000(thousands) + " ألف";
  }
  
  if (remainder > 0) {
    if (result !== "") result += " و";
    result += getBelow1000(remainder);
  }
  
  return result;
}

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
  limit,
  where
} from "firebase/firestore";
import { 
  Plus, 
  Download, 
  Trash2,
  Search,
  Loader2,
  X,
  FileDown,
  Image as ImageIcon
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { useBranch } from "@/context/BranchContext";
import { motion, AnimatePresence } from "framer-motion";

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
  const { currentBranch } = useBranch();
  const branchIds = useMemo(() => {
    const ids = [];
    if (currentBranch === "all") {
      // no filter
    } else if (currentBranch === "alamein4") {
      ids.push("eL-alamein-4");
    } else if (currentBranch === "ola") {
      ids.push("ola-el-koronfol");
    } else {
      ids.push(currentBranch);
    }
    return ids;
  }, [currentBranch]);

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
  const [supplierRepName, setSupplierRepName] = useState("");
  const [supplierNationalId, setSupplierNationalId] = useState("");
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [qrCodeData, setQrCodeData] = useState("");
  
  // PO Extraction State
  const [poItems, setPoItems] = useState<{barcode: string, quantity: number, description: string, unitPrice: number}[]>([]);
  const [isProcessingPo, setIsProcessingPo] = useState(false);
  
  // Print State
  const [selectedPaymentForPrint, setSelectedPaymentForPrint] = useState<any>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    if (selectedPaymentForPrint) {
      const text = `Payment ID: ${selectedPaymentForPrint.id}\nCompany: ${selectedPaymentForPrint.companyName}\nInvoice: ${selectedPaymentForPrint.invoiceNumber}\nAmount: ${selectedPaymentForPrint.total} EGP\nDate: ${selectedPaymentForPrint.date}`;
      // @ts-expect-error
      QRCodeLib.toDataURL(text)
        // @ts-expect-error
        .then((url: string) => setQrCodeData(url))
        // @ts-expect-error
        .catch((err: any) => console.error(err));
    } else {
      setQrCodeData("");
    }
  }, [selectedPaymentForPrint]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, currentBranch, monthFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Payments
      let q1;
      if (monthFilter) {
        const monthStart = `${monthFilter}-01`;
        const monthEnd = `${monthFilter}-31`;
        q1 = branchIds.length > 0
          ? query(collection(db, "cash_payments"), where("storeId", "in", branchIds), where("date", ">=", monthStart), where("date", "<=", monthEnd), orderBy("date", "desc"))
          : query(collection(db, "cash_payments"), where("date", ">=", monthStart), where("date", "<=", monthEnd), orderBy("date", "desc"));
      } else {
        q1 = branchIds.length > 0
          ? query(collection(db, "cash_payments"), where("storeId", "in", branchIds), orderBy("date", "desc"), limit(500))
          : query(collection(db, "cash_payments"), orderBy("date", "desc"), limit(500));
      }
      const paySnapshot = await getDocs(q1);
      const loadedPayments = paySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setPayments(loadedPayments);

      // 2. Extract Suppliers from cash_payments
      const uniqueSuppliers = new Set<string>();
      
      loadedPayments.forEach(p => {
        if (p.companyName) uniqueSuppliers.add(p.companyName.toUpperCase());
      });

      setSuppliers(Array.from(uniqueSuppliers).sort().map((name, index) => ({ id: `sup_${index}`, name })));
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("https://console.firebase.google.com")) {
        const urlMatch = err.message.match(/(https:\/\/console\.firebase\.google\.com[^\s]*)/);
        if (urlMatch) {
          toast.error("Firebase Index Missing (Required for filtering)", {
            description: "Click the button to automatically create the required index.",
            action: {
              label: "Create Index",
              onClick: () => window.open(urlMatch[0], "_blank")
            },
            duration: 20000,
          });
          setLoading(false);
          return;
        }
      }
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

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file.');
      return;
    }
    
    setIsProcessingPo(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Image = reader.result as string;
      try {
        const response = await fetch('/api/process-po', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image })
        });
        
        if (!response.ok) throw new Error('Failed to process image');
        const data = await response.json();
        
        if (data.poNumber) setPoNumber(data.poNumber);
        if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber);
        if (data.date) setDate(data.date);
        
        if (data.companyName) {
           const match = suppliers.find(s => s.name.toLowerCase().includes(data.companyName.toLowerCase()) || data.companyName.toLowerCase().includes(s.name.toLowerCase()));
           if (match) setCompanyName(match.name);
        }
        
        if (data.amount !== undefined) setAmount(data.amount.toString());
        if (data.tax !== undefined) setTax(data.tax.toString());
        
        if (data.items && Array.isArray(data.items)) {
          setPoItems(data.items);
        }
        
        toast.success('PO processed successfully!');
      } catch (err) {
        console.error(err);
        toast.error('Error processing PO image. Please enter manually.');
      } finally {
        setIsProcessingPo(false);
      }
    };
  };

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (!showAddModal || category !== 'order') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleImageUpload(file);
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddModal, category]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (category !== 'order') return;
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
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
        storeId: branchIds.length > 0 ? branchIds[0] : "eL-alamein-4", 
        tax: numTax,
        total,
        supplierRepName,
        supplierNationalId,
        ...(poItems.length > 0 ? { items: poItems } : {})
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
      setSupplierRepName("");
      setSupplierNationalId("");
      setPoItems([]);
      
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

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Payments Control</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Track and manage all corporate outgoings.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-white transition-all">
              <FileDown size={18} /> Export All
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-[#ef4444] text-white px-5 py-2.5 rounded-xl font-semibold shadow-md hover:bg-[#dc2626] hover:-translate-y-0.5 transition-all"
            >
              <Plus size={20} /> Record Payment
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {categoryStats["order"] && (
            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-5xl">📦</div>
              <div className="flex items-center gap-2 text-blue-600 mb-3">
                <span className="text-sm font-bold tracking-wide uppercase">Order</span>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {categoryStats["order"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              <p className="text-xs font-semibold text-blue-600/70 mt-1 relative z-10">{categoryStats["order"].count} payment(s)</p>
            </motion.div>
          )}
          {categoryStats["utilities"] && (
            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-5xl">💡</div>
              <div className="flex items-center gap-2 text-amber-600 mb-3">
                <span className="text-sm font-bold tracking-wide uppercase">Utilities</span>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {categoryStats["utilities"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              <p className="text-xs font-semibold text-amber-600/70 mt-1 relative z-10">{categoryStats["utilities"].count} payment(s)</p>
            </motion.div>
          )}
          {categoryStats["maintenance"] && (
            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-5xl">🔧</div>
              <div className="flex items-center gap-2 text-purple-600 mb-3">
                <span className="text-sm font-bold tracking-wide uppercase">Maintenance</span>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {categoryStats["maintenance"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              <p className="text-xs font-semibold text-purple-600/70 mt-1 relative z-10">{categoryStats["maintenance"].count} payment(s)</p>
            </motion.div>
          )}
          {categoryStats["transportation"] && (
            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-5xl">🚚</div>
              <div className="flex items-center gap-2 text-emerald-600 mb-3">
                <span className="text-sm font-bold tracking-wide uppercase">Transportation</span>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {categoryStats["transportation"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              <p className="text-xs font-semibold text-emerald-600/70 mt-1 relative z-10">{categoryStats["transportation"].count} payment(s)</p>
            </motion.div>
          )}
          {categoryStats["other"] && (
            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-5xl">📝</div>
              <div className="flex items-center gap-2 text-slate-600 mb-3">
                <span className="text-sm font-bold tracking-wide uppercase">Other</span>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {categoryStats["other"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              <p className="text-xs font-semibold text-slate-600/70 mt-1 relative z-10">{categoryStats["other"].count} payment(s)</p>
            </motion.div>
          )}
        </div>

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 p-2 rounded-2xl shadow-sm flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search company, invoice, PO number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-transparent focus:bg-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-none outline-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400 font-medium"
            />
          </div>
          <div className="h-px md:h-auto md:w-px bg-slate-200 dark:bg-slate-700"></div>
          <input 
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full md:w-64 px-4 py-3 rounded-xl bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors border-none outline-none text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider">
            All Records ({filteredPayments.length})
          </h2>
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {filteredPayments.map((pay, idx) => {
              const initials = pay.companyName ? pay.companyName.substring(0, 2).toUpperCase() : "NA";
              const colors = [
                'bg-indigo-100 text-indigo-700 border-indigo-200', 
                'bg-rose-100 text-rose-700 border-rose-200', 
                'bg-emerald-100 text-emerald-700 border-emerald-200',
                'bg-amber-100 text-amber-700 border-amber-200',
                'bg-blue-100 text-blue-700 border-blue-200'
              ];
              const charCode = pay.companyName ? pay.companyName.charCodeAt(0) : 0;
              const avatarColor = colors[charCode % colors.length];

              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.05 }}
                  key={pay.id} 
                  className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden group"
                >
                  <div className="p-4 md:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-full border flex items-center justify-center font-black text-lg tracking-tight ${avatarColor}`}>
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white capitalize tracking-tight">{pay.companyName}</h3>
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                            {CATEGORY_EMOJIS[pay.category]} <span className="capitalize">{pay.category}</span>
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                          <span className="text-slate-400">{pay.date}</span>
                          {(pay.invoiceNumber || pay.poNumber) && (
                            <>
                              <span className="text-slate-300">•</span>
                              {pay.invoiceNumber && `Inv: ${pay.invoiceNumber}`} 
                              {pay.invoiceNumber && pay.poNumber && " | "}
                              {pay.poNumber && `PO: ${pay.poNumber}`}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-3 md:pt-0">
                      <div className="text-right">
                        <p className="text-2xl font-black text-[#dc2626] tracking-tight font-mono">
                          <span className="text-sm font-medium text-slate-400 dark:text-slate-500 mr-1">EGP</span>
                          {Number(pay.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setSelectedPaymentForPrint(pay);
                            setTimeout(() => generatePDF(), 100);
                          }}
                          className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                        >
                          <Download size={20} />
                        </button>
                        <button onClick={() => handleDelete(pay.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredPayments.length === 0 && (
            <div className="text-center py-12 text-slate-500 font-medium">
              No payments found matching your criteria.
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl relative my-auto border border-slate-100 dark:border-slate-800"
            >
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              
              <form onSubmit={handleSavePayment} className="p-8">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white pb-6 tracking-tight">Record Payment</h2>
                
                {category === 'order' && (
                  <div 
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className={`mb-6 border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${isProcessingPo ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-slate-50/80 dark:bg-slate-800/50 dark:border-slate-700'}`}
                  >
                    {isProcessingPo ? (
                      <div className="flex flex-col items-center justify-center gap-2 text-blue-600">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="font-bold">Reading Purchase Order...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                        <ImageIcon className="h-8 w-8 text-slate-400" />
                        <span className="font-bold">Paste or Drop PO Image Here</span>
                        <span className="text-xs">We'll automatically extract the details using AI</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Basic Info</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date *</label>
                            <input type="date" required className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={date} onChange={(e) => setDate(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Method *</label>
                            <select className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={method} onChange={(e) => setMethod(e.target.value)}>
                              <option value="cash">Cash</option>
                              <option value="visa">Visa</option>
                              <option value="bank_transfer">Bank Transfer</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Company / Supplier *</label>
                            <button type="button" onClick={() => setShowAddSupplier(true)} className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1">
                              + New Supplier
                            </button>
                          </div>
                          <select required className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={companyName} onChange={(e) => setCompanyName(e.target.value)}>
                            <option value="">Select a supplier...</option>
                            {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Rep Name</label>
                          <input type="text" placeholder="Driver / Representative" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={supplierRepName} onChange={(e) => setSupplierRepName(e.target.value)} />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Rep National ID</label>
                          <input type="text" placeholder="14-digit ID" maxLength={14} className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={supplierNationalId} onChange={(e) => setSupplierNationalId(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Financials</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Amount (Before Tax) *</label>
                            <input type="number" required placeholder="0.00" step="0.01" min="0" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all outline-none font-bold text-red-600 text-lg" value={amount} onChange={(e) => setAmount(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tax Amount</label>
                            <input type="number" placeholder="0.00" step="0.01" min="0" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900 text-lg" value={tax} onChange={(e) => setTax(e.target.value)} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Invoice #</label>
                            <input type="text" placeholder="INV-123" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">PO #</label>
                            <input type="text" placeholder="PO-123" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category *</label>
                            <select className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={category} onChange={(e) => setCategory(e.target.value)}>
                              <option value="order">Order</option>
                              <option value="maintenance">Maintenance</option>
                              <option value="utilities">Utilities</option>
                              <option value="transportation">Transportation</option>
                              <option value="other">Other / Misc</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes</label>
                            <input type="text" placeholder="Optional details..." className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={categoryNote} onChange={(e) => setCategoryNote(e.target.value)} />
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>

                {poItems.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">Extracted Items ({poItems.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 uppercase font-bold">
                          <tr>
                            <th className="px-4 py-3 rounded-l-xl">Barcode</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3 text-center">Qty</th>
                            <th className="px-4 py-3 text-right">Price</th>
                            <th className="px-4 py-3 text-right rounded-r-xl">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 font-medium">
                              <td className="px-4 py-3 text-slate-500">{item.barcode}</td>
                              <td className="px-4 py-3 text-slate-900 dark:text-slate-300">{item.description}</td>
                              <td className="px-4 py-3 text-center text-slate-900 dark:text-slate-300">{item.quantity}</td>
                              <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-300">{item.unitPrice}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-300">{(item.quantity * item.unitPrice).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-3 rounded-xl font-bold shadow-md shadow-red-500/20 hover:shadow-red-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save & Print Receipt"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddSupplier && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            >
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Add New Supplier</h3>
              <input 
                type="text" 
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="e.g. COCA COLA EG"
                className="w-full border-none bg-slate-50 focus:ring-2 focus:ring-blue-500/20 rounded-xl p-3 text-slate-900 font-medium mb-6 outline-none"
                autoFocus
              />
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setShowAddSupplier(false)}
                  className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddSupplier}
                  disabled={!newSupplierName.trim()}
                  className="px-5 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  Use Supplier
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HIDDEN PRINT LAYOUT (A4) */}
      {selectedPaymentForPrint && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div id="pdf-receipt" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            
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
            <div style={{ padding: '20px 30px 10px', textAlign: 'right' }}>
              <div style={{ padding: '15px', border: '1px dashed #000', borderRadius: '4px', display: 'inline-block', width: '100%', boxSizing: 'border-box' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#000', fontWeight: 'bold', lineHeight: '1.6' }} dir="rtl">
                  أقر أنا الموقع أدناه {selectedPaymentForPrint.supplierRepName ? `(الاسم: ${selectedPaymentForPrint.supplierRepName}) ` : ""}{selectedPaymentForPrint.supplierNationalId ? `(رقم قومي: ${selectedPaymentForPrint.supplierNationalId}) ` : ""}باستلامي كامل قيمة الفاتورة/المطالبة المذكورة أعلاه استلاماً نهائياً وناجزاً لا رجعة فيه. وبموجب هذا الإيصال، أبرئ ذمة شركة سيركل كيه العلمين 4 إبراءً ذمة تاماً ونهائياً وشاملاً كافة المستحقات المالية المتعلقة بهذه الفاتورة، ولا يحق لي، لا حاضراً ولا مستقبلاً، المطالبة بأي مبالغ إضافية أو تعويضات تخصها أمام أي جهة قضائية أو إدارية.
                </p>
              </div>
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



            {/* Financial Details Table */}
            <div style={{ padding: '0 30px', position: 'relative' }}>
              <div style={{ border: '2px solid #000', borderRadius: '4px', overflow: 'hidden', position: 'relative', backgroundColor: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', position: 'relative', zIndex: 2 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #000' }}>
                      <th style={{ padding: '8px 15px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', borderRight: '1px dotted #ccc' }}>
                        <span style={{ letterSpacing: '1px' }}>Invoice Value</span> <span style={{ letterSpacing: '0' }}>/ قيمة الفاتورة</span>
                      </th>
                      <th style={{ padding: '8px 15px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', borderRight: '1px dotted #ccc' }}>
                        <span style={{ letterSpacing: '1px' }}>Tax</span> <span style={{ letterSpacing: '0' }}>/ الضريبة</span>
                      </th>
                      <th style={{ padding: '8px 15px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', borderRight: '1px dotted #ccc' }}>
                        <span style={{ letterSpacing: '1px' }}>Total</span> <span style={{ letterSpacing: '0' }}>/ الإجمالي</span>
                      </th>
                      <th style={{ padding: '8px 15px', textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase' }}>
                        <span style={{ letterSpacing: '1px' }}>Taxable</span> <span style={{ letterSpacing: '0' }}>/ خاضع</span>
                      </th>
                    </tr>
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
                <div dir="rtl" style={{ backgroundColor: '#f9f9f9', padding: '10px 15px', textAlign: 'right', fontWeight: 'bold', color: '#333', fontSize: '12px', borderTop: '1px solid #000' }}>
                  فقط وقدره: {numberToArabicWords(Number(selectedPaymentForPrint.total))} جنيهاً مصرياً لا غير
                </div>
              </div>
            </div>

            {/* Signatures & Stamp */}
            <div style={{ padding: '0 30px', marginTop: '50px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', backgroundColor: '#fff', border: '2px solid #000', borderRadius: '4px', position: 'relative', zIndex: 10, minHeight: '140px' }}>
                
                <div style={{ width: '30%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '9px', color: '#333', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.4, fontWeight: 'bold' }}>
                    {selectedPaymentForPrint.method === 'bank_transfer' ? 
                      "Bank transfers are executed electronically. Manager signature confirms execution." : 
                      "I declare the above info is accurate and I received the funds."}
                  </p>
                  <div>
                    <div style={{ position: 'relative', height: '30px', display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid #000', marginBottom: '8px' }}>
                      <div style={{ position: 'absolute', bottom: '4px', left: '0', width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#999', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        [ SIGNATURE ]
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', textAlign: 'center' }}>
                      {selectedPaymentForPrint.method === 'bank_transfer' ? "MANAGER / المدير المعتمد" : (selectedPaymentForPrint.supplierRepName || "SUPPLIER / المورد")}
                    </p>
                  </div>
                </div>

                <div style={{ width: '30%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  {selectedPaymentForPrint.method !== 'bank_transfer' && (
                    <>
                      <p style={{ fontSize: '9px', color: '#333', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.4, fontWeight: 'bold', textAlign: 'center' }}>
                        National ID attached.
                      </p>
                      <div>
                        <div style={{ position: 'relative', height: '30px', display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid #000', marginBottom: '8px' }}>
                          <div style={{ position: 'absolute', bottom: '4px', left: '0', width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#999', letterSpacing: '2px', textTransform: 'uppercase' }}>
                            {selectedPaymentForPrint.supplierNationalId || "[ ID COPY ]"}
                          </div>
                        </div>
                        <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', textAlign: 'center' }}>National ID / الرقم القومي</p>
                      </div>
                    </>
                  )}
                </div>

                <div style={{ width: '40%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                  {qrCodeData && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <img src={qrCodeData} alt="QR Code" style={{ width: "70px", height: "70px" }} />
                      <span style={{ fontSize: "8px", fontWeight: "bold", color: "#666", marginTop: "4px" }}>VERIFICATION</span>
                    </div>
                  )}
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

            {/* Payment Dynamic Stamp (placed in the large empty area at the bottom) */}
            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '180px' }}>
              {(() => {
                const payMethod = selectedPaymentForPrint.method || 'cash';
                const stampColor = payMethod === 'cash' ? '#16a34a' : '#ef4444';
                const stampText = payMethod === 'cash' ? 'PAID IN CASH' : (payMethod === 'visa' ? 'PAID BY VISA' : 'PAID BY BANK');
                
                return (
                  <div style={{ transform: 'rotate(-5deg)', opacity: 0.85 }}>
                    <div style={{ border: `5px solid ${stampColor}`, borderRadius: '50%', width: '180px', height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: stampColor, backgroundColor: 'transparent', boxShadow: `inset 0 0 0 2px ${stampColor}33, 0 0 0 2px ${stampColor}33` }}>
                      <span style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px', textAlign: 'center' }}>{stampText}</span>
                      <span style={{ fontSize: '16px', fontWeight: '900', borderBottom: `2px solid ${stampColor}`, paddingBottom: '4px', marginBottom: '6px' }}>معتمد</span>
                      <span style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '1px' }}>PAYMENT</span>
                      <span style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '4px' }}>{selectedPaymentForPrint.date}</span>
                    </div>
                  </div>
                );
              })()}
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
