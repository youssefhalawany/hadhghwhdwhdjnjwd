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
  updateDoc,
  Timestamp,
  where,
  limit
} from "firebase/firestore";
import {
  Plus,
  Trash2,
  Search,
  Loader2,
  X,
  FileDown,
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
  Clock,
  AlertTriangle,
  CheckCircle,
  PieChart,
  AlertCircle,
  FileText,
  Banknote,
  Calendar,
  MoreHorizontal,
  CreditCard,
  Building
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import dynamic from "next/dynamic";
import { useBranch } from "@/context/BranchContext";

const SignaturePad = dynamic(() => import("react-signature-canvas"), { ssr: false });

interface Credit {
  id: string;
  amountDue: number;
  collectionDate: string;
  companyName: string;
  createdAt: any;
  createdBy: string;
  invoiceNumber: string;
  isTaxable: boolean;
  onSalesOnly: boolean;
  poNumber: string;
  status: "open" | "pending" | "paid" | "partial" | "overdue";
  storeId: string;
  tax: number;
  paidAmount: number;
  priceAdjustment: number;
  payments: any[];
  managerSignature?: string;
}

export default function CreditsPage() {
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
  const [credits, setCredits] = useState<Credit[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Credit Form
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [amountDue, setAmountDue] = useState("");
  const [tax, setTax] = useState("0");
  const [collectionDate, setCollectionDate] = useState("");
  const [onSalesOnly, setOnSalesOnly] = useState(false);
  const [isTaxable, setIsTaxable] = useState(false);

  const STANDARD_COMPANIES = [
    "Pepsi", "Coca-Cola", "Al Ahram Beverages", "Juhayna", "Edita", 
    "Red Bull", "Nestle", "Pringles", "Chipsy", "Cadbury", "Galaxy", 
    "Mars", "Domty", "Beyti", "Lamar", "Philip Morris", "Eastern Company", 
    "Mansour", "Wadi Food", "Rich Bake"
  ];

  const sigPadRef = React.useRef<any>(null);
  const [managerSignature, setManagerSignature] = useState("");
  const [hasSigned, setHasSigned] = useState(false);

  // Payment Form
  const [selectedCreditForPayment, setSelectedCreditForPayment] = useState<Credit | null>(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentTime, setPaymentTime] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [expandedCredits, setExpandedCredits] = useState<Record<string, boolean>>({});
  const [selectedCreditForPrint, setSelectedCreditForPrint] = useState<Credit | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      fetchCredits();
    }
  }, [auth.currentUser, currentBranch]);

  const [creditHistories, setCreditHistories] = useState<Record<string, any[]>>({});

  const fetchCredits = async () => {
    try {
      const q = branchIds.length > 0 
        ? query(collection(db, "credits"), where("storeId", "in", branchIds), orderBy("createdAt", "desc"), limit(50))
        : query(collection(db, "credits"), orderBy("createdAt", "desc"), limit(50));

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const d = doc.data() as any;

        let totalPaid = Number(d.paidAmount || 0);
        const totalDue = Number(d.amountDue || 0) + Number(d.tax || 0);

        let status = d.status || "open";

        // Backwards compatibility for old records that have status='paid' but missing paidAmount
        if (status === "paid" && totalPaid === 0 && totalDue > 0) {
          totalPaid = totalDue;
        }

        // Auto-detect status based on true totalPaid
        if (totalPaid >= totalDue && totalDue > 0) {
          status = "paid";
        } else if (totalPaid > 0 && totalPaid < totalDue) {
          status = "partial";
        } else if (status === "open" && d.collectionDate) {
          const cDate = new Date(d.collectionDate);
          const today = new Date();
          cDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);
          if (cDate < today) {
            status = "overdue";
          }
        }

        return {
          id: doc.id,
          ...d,
          status,
          paidAmount: totalPaid,
          priceAdjustment: Number(d.priceAdjustment || 0),
          tax: Number(d.tax || 0)
        };
      }) as Credit[];
      setCredits(data);
    } catch (err: any) {
      console.error("Error fetching credits:", err);
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
      toast.error("Failed to load credits: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (id: string) => {
    const isExpanding = !expandedCredits[id];
    setExpandedCredits(prev => ({ ...prev, [id]: isExpanding }));

    if (isExpanding && !creditHistories[id]) {
      try {
        const hQuery = query(collection(db, "credit_payments"), where("creditId", "==", id));
        const snap = await getDocs(hQuery);
        const history = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => {
          if (a.createdAt && b.createdAt) {
            return b.createdAt.toMillis() - a.createdAt.toMillis();
          }
          return 0;
        });
        setCreditHistories(prev => ({ ...prev, [id]: history }));
        
        // Recalculate true paid amount from history for accuracy
        const calculatedPaid = history.reduce((sum, payment: any) => sum + Number(payment.amount || 0), 0);
        if (calculatedPaid > 0) {
          setCredits(prev => prev.map(c => {
            if (c.id === id) {
              const newPaid = Math.max(c.paidAmount, calculatedPaid);
              const totalDue = c.amountDue + c.tax;
              return { 
                ...c, 
                paidAmount: newPaid,
                status: newPaid >= totalDue ? "paid" : c.status
              };
            }
            return c;
          }));
        }
      } catch (err) {
        console.error("Failed to load history for credit", id, err);
      }
    }
  };

  const handleAddCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber || !companyName || !amountDue || !collectionDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newCredit = {
        amountDue: parseFloat(amountDue),
        collectionDate,
        companyName,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "unknown",
        invoiceNumber,
        isTaxable,
        onSalesOnly,
        poNumber,
        status: "open",
        storeId: currentBranch === "all" ? "eL-alamein-4" : currentBranch,
        tax: parseFloat(tax) || 0,
        paidAmount: 0,
        priceAdjustment: 0,
        managerSignature: managerSignature || (hasSigned && sigPadRef.current ? sigPadRef.current.toDataURL() : null)
      };

      const docRef = await addDoc(collection(db, "credits"), newCredit);
      const savedCredit = { id: docRef.id, ...newCredit, createdAt: Timestamp.now() } as Credit;
      setCredits([savedCredit, ...credits]);

      toast.success("Credit added successfully!");
      setShowAddModal(false);

      // Reset form
      setInvoiceNumber("");
      setPoNumber("");
      setCompanyName("");
      setAmountDue("");
      setTax("0");
      setCollectionDate("");
      setOnSalesOnly(false);
      setIsTaxable(false);
      
      setManagerSignature("");
      setHasSigned(false);
      if (sigPadRef.current) {
        sigPadRef.current.clear();
      }

    } catch (error) {
      console.error("Error adding credit:", error);
      toast.error("Failed to add credit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCredit = async (id: string) => {
    if (!confirm("Are you sure you want to delete this credit?")) return;
    try {
      await deleteDoc(doc(db, "credits", id));
      setCredits(credits.filter(c => c.id !== id));
      toast.success("Credit deleted.");
    } catch (error) {
      console.error("Error deleting credit:", error);
      toast.error("Failed to delete.");
    }
  };

  const handleOpenPaymentModal = (credit: Credit) => {
    setSelectedCreditForPayment(credit);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));

    // Suggest the remaining amount
    const remaining = (credit.amountDue + credit.tax) - credit.paidAmount;
    setPaymentAmount(remaining.toString());
    setPaymentMethod("cash");
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreditForPayment) return;
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const pAmt = parseFloat(paymentAmount);
      const newPaidAmount = selectedCreditForPayment.paidAmount + pAmt;
      const totalDue = selectedCreditForPayment.amountDue + selectedCreditForPayment.tax;

      let newStatus = selectedCreditForPayment.status;
      if (newPaidAmount >= totalDue) {
        newStatus = "paid";
      } else if (newPaidAmount > 0) {
        newStatus = "partial";
      }

      // 1. Update Credit Document
      await updateDoc(doc(db, "credits", selectedCreditForPayment.id), {
        paidAmount: newPaidAmount,
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // 2. Add to Cash Payments
      const paymentRecord = {
        amount: pAmt,
        category: "credit",
        categoryNote: `Credit Payment - Inv #${selectedCreditForPayment.invoiceNumber} - ${selectedCreditForPayment.companyName}`,
        companyName: selectedCreditForPayment.companyName,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "unknown",
        date: paymentDate,
        description: `Credit Payment`,
        invoiceNumber: selectedCreditForPayment.invoiceNumber,
        isTaxable: false,
        method: paymentMethod,
        poNumber: selectedCreditForPayment.poNumber,
        storeId: branchIds.length > 0 && branchIds[0] !== "all" ? branchIds[0] : "eL-alamein-4",
        tax: 0,
        total: pAmt,
        creditId: selectedCreditForPayment.id
      };
      await addDoc(collection(db, "cash_payments"), paymentRecord);

      // 3. Add to Credit Payments History
      await addDoc(collection(db, "credit_payments"), {
        creditId: selectedCreditForPayment.id,
        amount: pAmt,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "unknown",
        date: paymentDate,
        method: paymentMethod
      });

      // Refresh data
      await fetchCredits();
      
      // Refresh history if expanded
      if (expandedCredits[selectedCreditForPayment.id]) {
        const hQuery = query(collection(db, "credit_payments"), where("creditId", "==", selectedCreditForPayment.id));
        const snap = await getDocs(hQuery);
        const history = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => {
          if (a.createdAt && b.createdAt) {
            return b.createdAt.toMillis() - a.createdAt.toMillis();
          }
          return 0;
        });
        setCreditHistories(prev => ({ ...prev, [selectedCreditForPayment.id]: history }));
      }
      toast.success("Payment processed successfully!");
      setShowPaymentModal(false);
      setSelectedCreditForPayment(null);
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Failed to process payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintPdf = async (credit: Credit) => {
    setSelectedCreditForPrint(credit);
    setIsPrinting(true);

    setTimeout(async () => {
      try {
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const page1 = document.getElementById("print-credit-container");
        
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
      } catch (error) {
        toast.error("Failed to generate PDF.");
      } finally {
        setIsPrinting(false);
        setSelectedCreditForPrint(null);
      }
    }, 500);
  };

  // Derived Stats
  const stats = useMemo(() => {
    let outstanding = 0;
    let pending = 0;
    let partial = 0;
    let collected = 0;
    let overdue = 0;
    let salesOnly = 0;

    let outstandingCount = 0;
    let pendingCount = 0;
    let partialCount = 0;
    let collectedCount = 0;
    let overdueCount = 0;
    let salesOnlyCount = 0;

    credits.forEach(c => {
      const total = c.amountDue + c.tax;
      const remaining = total - c.paidAmount;

      if (c.onSalesOnly) {
        salesOnly += remaining;
        salesOnlyCount++;
        return; // Skip other stats if sales only
      }

      if (c.status === "paid") {
        collected += c.paidAmount;
        collectedCount++;
      } else if (c.status === "partial") {
        partial += remaining;
        partialCount++;
        outstanding += remaining;
        outstandingCount++;
      } else if (c.status === "overdue") {
        overdue += remaining;
        overdueCount++;
        outstanding += remaining;
        outstandingCount++;
      } else if (c.status === "pending") {
        pending += remaining;
        pendingCount++;
      } else {
        outstanding += remaining;
        outstandingCount++;
      }
    });

    return {
      outstanding: { amount: outstanding, count: outstandingCount },
      pending: { amount: pending, count: pendingCount },
      partial: { amount: partial, count: partialCount },
      collected: { amount: collected, count: collectedCount },
      overdue: { amount: overdue, count: overdueCount },
      salesOnly: { amount: salesOnly, count: salesOnlyCount }
    };
  }, [credits]);

  const filteredCredits = credits.filter(c => {
    const matchesSearch = c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (statusFilter !== "all") {
      if (statusFilter === "salesOnly") matchesStatus = c.onSalesOnly;
      else matchesStatus = c.status === statusFilter && !c.onSalesOnly;
    }

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;
  }

  return (
    <>
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans print:hidden">
        <div className="max-w-[1400px] mx-auto space-y-8">
          
          {/* Header & Actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Credits Management</h1>
              <p className="text-sm text-slate-500 font-medium mt-1">Track, manage, and collect outstanding corporate credits.</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 bg-white/60 backdrop-blur-md border border-slate-200/60 text-slate-700 px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-white hover:border-slate-300 transition-all">
                <FileDown size={18} /> Export
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all"
              >
                <Plus size={20} /> Add Credit
              </button>
            </div>
          </div>

          {/* Premium Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-rose-50 to-orange-50 border border-orange-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><AlertCircle size={48} className="text-orange-600" /></div>
              <div className="flex items-center gap-2 text-orange-600 mb-3">
                <AlertCircle size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Outstanding</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {stats.outstanding.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-orange-600/70 mt-1 relative z-10">{stats.outstanding.count} open invoices</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-sky-50 to-blue-50 border border-blue-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Clock size={48} className="text-blue-600" /></div>
              <div className="flex items-center gap-2 text-blue-600 mb-3">
                <Clock size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Pending</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {stats.pending.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-blue-600/70 mt-1 relative z-10">{stats.pending.count} awaiting clear</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-yellow-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><PieChart size={48} className="text-amber-600" /></div>
              <div className="flex items-center gap-2 text-amber-600 mb-3">
                <PieChart size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Partial</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {stats.partial.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-amber-600/70 mt-1 relative z-10">{stats.partial.count} partially paid</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle size={48} className="text-emerald-600" /></div>
              <div className="flex items-center gap-2 text-emerald-600 mb-3">
                <CheckCircle size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Collected</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {stats.collected.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-emerald-600/70 mt-1 relative z-10">{stats.collected.count} fully paid</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><AlertTriangle size={48} className="text-red-600" /></div>
              <div className="flex items-center gap-2 text-red-600 mb-3">
                <AlertTriangle size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Overdue</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {stats.overdue.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-red-600/70 mt-1 relative z-10">{stats.overdue.count} past due date</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Building size={48} className="text-violet-600" /></div>
              <div className="flex items-center gap-2 text-violet-600 mb-3">
                <Building size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Sales Only</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {stats.salesOnly.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-violet-600/70 mt-1 relative z-10">{stats.salesOnly.count} active accounts</p>
            </motion.div>
          </div>

          {/* Unified Command Bar (Filters) */}
          <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 p-2 rounded-2xl shadow-sm flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search company or invoice..."
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-transparent focus:bg-white hover:bg-slate-50 transition-colors border-none outline-none text-slate-700 placeholder:text-slate-400 font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="h-px md:h-auto md:w-px bg-slate-200"></div>
            <select
              className="w-full md:w-64 px-4 py-3 rounded-xl bg-transparent hover:bg-slate-50 focus:bg-white transition-colors border-none outline-none text-slate-700 font-bold cursor-pointer appearance-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">⚡ All Statuses</option>
              <option value="open">Open Credits</option>
              <option value="pending">Pending Payments</option>
              <option value="partial">Partially Paid</option>
              <option value="paid">Fully Paid</option>
              <option value="overdue">⚠️ Overdue</option>
              <option value="salesOnly">🏢 Sales Only Accounts</option>
            </select>
          </div>

        {/* Credits Data Grid */}
        <div className="space-y-4">
          <AnimatePresence>
            {filteredCredits.map((credit, idx) => {
              const isExpanded = expandedCredits[credit.id];
              const totalDue = credit.amountDue + credit.tax;
              const remaining = totalDue - credit.paidAmount;

              // Generate Company Initials for Avatar
              const initials = credit.companyName.substring(0, 2).toUpperCase();
              const colors = [
                'bg-indigo-100 text-indigo-700 border-indigo-200', 
                'bg-rose-100 text-rose-700 border-rose-200', 
                'bg-emerald-100 text-emerald-700 border-emerald-200',
                'bg-amber-100 text-amber-700 border-amber-200',
                'bg-blue-100 text-blue-700 border-blue-200'
              ];
              const avatarColor = colors[credit.companyName.charCodeAt(0) % colors.length];

              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.05 }}
                  key={credit.id} 
                  className="bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden group"
                >
                  {/* Row Summary */}
                  <div className="p-4 md:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
                    
                    {/* Left: Avatar + Details */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-full border flex items-center justify-center font-black text-lg tracking-tight ${avatarColor}`}>
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-bold text-slate-900 capitalize tracking-tight">{credit.companyName}</h3>
                          
                          {/* Modern Badges */}
                          {credit.status === 'paid' && <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><CheckCircle size={12}/> Paid</span>}
                          {credit.status === 'pending' && <span className="bg-blue-50 text-blue-600 border border-blue-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><Clock size={12}/> Pending</span>}
                          {credit.status === 'partial' && <span className="bg-amber-50 text-amber-600 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><PieChart size={12}/> Partial</span>}
                          {credit.status === 'overdue' && <span className="bg-red-50 text-red-600 border border-red-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><AlertTriangle size={12}/> Overdue</span>}
                          {credit.status === 'open' && <span className="bg-slate-100 text-slate-600 border border-slate-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><AlertCircle size={12}/> Open</span>}

                          {credit.onSalesOnly && (
                            <span className="bg-violet-50 text-violet-600 border border-violet-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><Building size={12}/> Sales Only</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                          <FileText size={14} className="text-slate-400" /> Inv: {credit.invoiceNumber} 
                          {credit.poNumber && <><span className="text-slate-300">•</span> PO: {credit.poNumber}</>} 
                          <span className="text-slate-300">•</span> Due: {credit.collectionDate}
                        </p>
                      </div>
                    </div>

                    {/* Right: Financials & Actions */}
                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                      <div className="text-right">
                        <p className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                          <span className="text-sm font-medium text-slate-400 mr-1">EGP</span>
                          {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-sm font-medium text-slate-500 flex items-center justify-end gap-1">
                          Paid: <span className="text-emerald-600 font-bold">{credit.paidAmount.toLocaleString()}</span>
                        </p>
                      </div>
                      
                      {/* Action Dropdown / Buttons */}
                      <div className="flex items-center gap-2">
                        <button onClick={() => handlePrintPdf(credit)} disabled={isPrinting} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50">
                          <Printer size={20} />
                        </button>
                        <button onClick={() => handleDeleteCredit(credit.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                          <Trash2 size={20} />
                        </button>
                        <button
                          onClick={() => toggleExpand(credit.id)}
                          className={`p-2.5 rounded-xl transition-colors ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                        >
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details Area */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-100 bg-slate-50/50"
                      >
                        <div className="p-5 md:p-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Amount</p>
                              <p className="font-black text-slate-900">EGP {credit.amountDue.toLocaleString()}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tax</p>
                              <p className="font-black text-slate-900">EGP {credit.tax.toLocaleString()}</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
                              <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Remaining</p>
                              <p className="font-black text-red-600">EGP {remaining.toLocaleString()}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Type</p>
                              <p className="font-bold text-slate-900 flex items-center gap-2">
                                {credit.onSalesOnly ? <><Building size={14} className="text-violet-500"/> Sales Only</> : <><CreditCard size={14} className="text-indigo-500"/> Standard</>}
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-between items-center border-t border-slate-200 pt-6 mb-4">
                            <h4 className="font-bold text-slate-900 flex items-center gap-2">
                              <Banknote className="text-slate-400"/> Payment History
                            </h4>
                            {credit.status !== "paid" && (
                              <button
                                onClick={() => handleOpenPaymentModal(credit)}
                                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                              >
                                <Plus size={16} /> Record Payment
                              </button>
                            )}
                          </div>
                          
                          {creditHistories[credit.id] && creditHistories[credit.id].length > 0 ? (
                            <div className="space-y-2">
                              {creditHistories[credit.id].map((payment, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                      <CheckCircle size={18} />
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900 font-mono tracking-tight">EGP {Number(payment.amount).toLocaleString()}</p>
                                      <p className="text-xs font-medium text-slate-500 flex items-center gap-1"><Calendar size={12}/> {payment.date} <span className="px-1 text-slate-300">•</span> {payment.method?.toUpperCase()}</p>
                                    </div>
                                  </div>
                                  <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full">Paid</span>
                                </div>
                              ))}
                              <div className="flex justify-between items-center pt-4 mt-2 border-t border-slate-200">
                                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Paid</span>
                                <span className="text-lg font-black text-emerald-600 tracking-tight">EGP {credit.paidAmount.toLocaleString()}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-300">
                              <p className="text-sm font-bold text-slate-400">No payments recorded yet</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredCredits.length === 0 && (
            <div className="text-center py-16 bg-white/50 backdrop-blur-sm rounded-3xl border border-slate-200 border-dashed">
              <AlertCircle className="mx-auto text-slate-300 mb-3" size={48} />
              <p className="text-slate-500 font-bold text-lg">No credits found.</p>
              <p className="text-slate-400 text-sm">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>

      </div>

      {/* ADD CREDIT MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Record New Credit</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddCredit} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Invoice # *</label>
                    <input required type="text" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">PO #</label>
                    <input type="text" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Company *</label>
                    <input required list="companies-list" type="text" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                    <datalist id="companies-list">
                      {STANDARD_COMPANIES.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Amount Due *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">EGP</span>
                      <input required type="number" step="0.01" className="w-full pl-12 pr-4 p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-black text-slate-900" value={amountDue} onChange={(e) => setAmountDue(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tax</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">EGP</span>
                      <input type="number" step="0.01" className="w-full pl-12 pr-4 p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-bold text-slate-900" value={tax} onChange={(e) => setTax(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Collection Date</label>
                    <input required type="date" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {[14, 15, 30, 45].map(days => (
                        <button 
                          key={days} 
                          type="button" 
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + days);
                            setCollectionDate(d.toISOString().split('T')[0]);
                          }}
                          className="text-[10px] font-bold px-2 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors"
                        >
                          +{days} Days
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input type="checkbox" checked={onSalesOnly} onChange={(e) => setOnSalesOnly(e.target.checked)} className="peer sr-only" />
                      <div className="w-6 h-6 rounded-md border-2 border-slate-300 bg-white peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-colors"></div>
                      <CheckCircle size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-slate-700 font-bold group-hover:text-slate-900 transition-colors">On Sales Only</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input type="checkbox" checked={isTaxable} onChange={(e) => setIsTaxable(e.target.checked)} className="peer sr-only" />
                      <div className="w-6 h-6 rounded-md border-2 border-slate-300 bg-white peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-colors"></div>
                      <CheckCircle size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-slate-700 font-bold group-hover:text-slate-900 transition-colors">Is Taxable?</span>
                  </label>
                </div>

                <div className="mb-8">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Manager Signature *</label>
                    {(managerSignature || hasSigned) && (
                      <button type="button" onClick={() => { sigPadRef.current?.clear(); setHasSigned(false); setManagerSignature(""); }} className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded font-bold uppercase hover:bg-red-100 transition-colors">
                        Clear Signature
                      </button>
                    )}
                  </div>
                  <div className="border border-slate-200 bg-slate-50 rounded-xl overflow-hidden relative shadow-inner" style={{ height: "150px" }}>
                    {managerSignature && !hasSigned ? (
                      <img src={managerSignature} alt="Saved Signature" className="w-full h-full object-contain p-4" />
                    ) : (
                      <SignaturePad 
                        // @ts-expect-error: dynamic import ref typing mismatch
                        ref={sigPadRef} 
                        canvasProps={{ className: "w-full h-full cursor-crosshair" }} 
                        onBegin={() => setHasSigned(true)}
                        onEnd={() => {
                          if (sigPadRef.current) {
                            setManagerSignature(sigPadRef.current.toDataURL());
                          }
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all">
                    {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                    Save Credit
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAKE PAYMENT MODAL */}
      <AnimatePresence>
        {showPaymentModal && selectedCreditForPayment && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Make Payment</h2>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleProcessPayment} className="p-6">
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-2xl border border-indigo-100/50 mb-6 shadow-inner">
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Paying For</p>
                  <p className="text-lg text-indigo-900 font-black tracking-tight">{selectedCreditForPayment.companyName}</p>
                  <p className="text-sm font-medium text-indigo-600/80 mb-4 flex items-center gap-1"><FileText size={14}/> Inv: {selectedCreditForPayment.invoiceNumber}</p>
                  
                  <div className="bg-white/60 p-3 rounded-xl border border-indigo-100/50 flex justify-between items-center backdrop-blur-sm">
                    <span className="text-sm font-bold text-indigo-900/60 uppercase tracking-wide">Remaining Balance</span>
                    <span className="text-2xl font-black text-indigo-600 font-mono tracking-tight">EGP {((selectedCreditForPayment.amountDue + selectedCreditForPayment.tax) - selectedCreditForPayment.paidAmount).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date *</label>
                      <input required type="date" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-bold text-slate-900" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Time *</label>
                      <input required type="time" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-bold text-slate-900" value={paymentTime} onChange={(e) => setPaymentTime(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Method *</label>
                    <select className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-bold text-slate-900 appearance-none cursor-pointer" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      <option value="cash">💵 Cash / نقدي</option>
                      <option value="bank_transfer">🏦 Bank Transfer / تحويل بنكي</option>
                      <option value="visa">💳 Visa / فيزا</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Amount to Pay *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">EGP</span>
                      <input required type="number" step="0.01" max={(selectedCreditForPayment.amountDue + selectedCreditForPayment.tax) - selectedCreditForPayment.paidAmount} className="w-full pl-14 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-black text-2xl text-slate-900 shadow-sm transition-all bg-white" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all">
                    {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                    Confirm Payment
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {selectedCreditForPrint && (
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div id="print-credit-container" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          
          {/* Header like Shift Report */}
          <div style={{ padding: '20px 30px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ width: '50px', height: '50px', border: '2px solid #000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '30px', fontWeight: 'bold', color: '#000', lineHeight: 1 }}>K</span>
              </div>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>CIRCLE K EL-ALAMEIN 4</h1>
                <p style={{ fontSize: '12px', color: '#333', margin: '2px 0 0', fontWeight: 'bold' }}>CREDIT APPROVAL REPORT</p>
              </div>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid #000`, borderRadius: '8px', padding: '6px 10px', minWidth: '60px' }}>
                <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>Auth</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#000', lineHeight: 1, whiteSpace: 'nowrap' }}>{selectedCreditForPrint.createdBy?.split('@')[0] || "SYS"}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                <span style={{ fontSize: '26px', fontWeight: 'bold', color: '#000' }} dir="rtl">تقرير اعتماد فاتورة آجلة</span>
              </div>
            </div>
          </div>

          {/* Intro Text */}
          <div style={{ padding: '30px 30px 15px', textAlign: 'right', direction: 'rtl' }}>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#000', fontWeight: 'bold' }}>
              تُقر إدارة الفرع بأن الطلب الموضح أدناه قد تم تنفيذه وفق نظام الآجل، وذلك بناءً على الاتفاق المسبق مع المورد. وتفاصيل الطلب كالتالي:
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
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>{selectedCreditForPrint.companyName}</div>
                </div>
              </div>
              {/* Row 2 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 1, padding: '12px 15px', borderRight: '1px solid #000', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Invoice #</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>رقم الفاتورة</span>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000', fontFamily: 'monospace' }}>{selectedCreditForPrint.invoiceNumber || '-'}</div>
                </div>
                <div style={{ flex: 1, padding: '12px 15px', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>PO #</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>رقم الأمر</span>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000', fontFamily: 'monospace' }}>{selectedCreditForPrint.poNumber || '-'}</div>
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
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>
                    {new Date(selectedCreditForPrint.createdAt?.toDate ? selectedCreditForPrint.createdAt.toDate() : selectedCreditForPrint.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Legal Paragraph */}
          <div style={{ padding: '20px 30px', textAlign: 'center', direction: 'rtl', position: 'relative', zIndex: 10 }}>
            <p style={{ margin: '0 auto', fontSize: '13px', lineHeight: '1.8', color: '#000', fontWeight: 'bold', maxWidth: '650px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', border: '1px dashed #000' }}>
              أتعهد أنا مدير الفرع بأن هذه الفاتورة الآجلة تم اعتمادها بناءً على استلام البضائع أو الخدمات كاملة، وتخضع لسياسة التحصيل المتفق عليها مع الإدارة المالية.
            </p>
          </div>

          {/* Financial Section */}
          <div style={{ padding: '10px 30px', position: 'relative', zIndex: 10 }}>
            <div style={{ border: '2px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#f9f9f9', padding: '4px 15px', borderBottom: '1px solid #000', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Financial Details & Collection Date</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead style={{ backgroundColor: '#fff', borderBottom: '1px solid #000' }}>
                  <tr>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Invoice Value <br/><span style={{ fontSize: '10px' }}>قيمة الفاتورة</span></th>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Tax <br/><span style={{ fontSize: '10px' }}>الضريبة</span></th>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Total <br/><span style={{ fontSize: '10px' }}>الإجمالي</span></th>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Taxable <br/><span style={{ fontSize: '10px' }}>خاضع للضريبة</span></th>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold' }}>Date of Collection <br/><span style={{ fontSize: '10px' }}>تاريخ التحصيل</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ backgroundColor: '#fff' }}>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(selectedCreditForPrint.amountDue).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(selectedCreditForPrint.tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', backgroundColor: '#f0fdf4' }}>EGP {Number(selectedCreditForPrint.amountDue + (selectedCreditForPrint.tax || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', textAlign: 'center', fontSize: '12px' }}>{selectedCreditForPrint.isTaxable ? '(Yes) نعم' : '(No) لا'}</td>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', textAlign: 'center', fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', color: '#b91c1c' }}>{selectedCreditForPrint.collectionDate || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures & Stamp */}
          <div style={{ padding: '0 30px', marginTop: '50px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', backgroundColor: '#fff', border: '2px solid #000', borderRadius: '4px', position: 'relative', zIndex: 10, minHeight: '140px' }}>
              <div style={{ width: '40%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '9px', color: '#333', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.4, fontWeight: 'bold' }}>
                  I officially approve this credit invoice for future payment as per the agreed terms.
                </p>
                <div>
                  <div style={{ position: 'relative', height: '40px', display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid #000', marginBottom: '8px' }}>
                    {selectedCreditForPrint.managerSignature ? (
                      <img src={selectedCreditForPrint.managerSignature} alt="Manager Signature" style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', maxHeight: '45px', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ position: 'absolute', bottom: '4px', left: '0', width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#999', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        [ SIGNATURE ]
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', textAlign: 'center' }}>Manager Signature / توقيع المدير</p>
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
          <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyItems: 'flex-start', paddingLeft: '50px', minHeight: '180px' }}>
            <div style={{ transform: 'rotate(-10deg)', opacity: 0.85 }}>
              <div style={{ border: '5px solid #16a34a', borderRadius: '50%', width: '180px', height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#16a34a', backgroundColor: 'transparent', boxShadow: 'inset 0 0 0 2px rgba(22, 163, 74, 0.2), 0 0 0 2px rgba(22, 163, 74, 0.2)' }}>
                <span style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>APPROVED</span>
                <span style={{ fontSize: '18px', fontWeight: '900', borderBottom: '2px solid #16a34a', paddingBottom: '4px', marginBottom: '6px' }}>معتمد للآجل</span>
                <span style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '1px' }}>CREDIT INVOICE</span>
                <span style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '4px' }}>
                  {new Date(selectedCreditForPrint.createdAt?.toDate ? selectedCreditForPrint.createdAt.toDate() : selectedCreditForPrint.createdAt || Date.now()).toLocaleDateString('en-GB')}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 'auto', marginBottom: '20px', marginLeft: '30px', marginRight: '30px', borderTop: '2px solid #000', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
            <p style={{ fontSize: '8px', color: '#333', fontFamily: 'monospace', margin: 0, letterSpacing: '0.5px', fontWeight: 'bold' }}>
              CREDIT ID: {selectedCreditForPrint.id} | PRINTED: {new Date().toLocaleString()} | AUTHORIZED: {selectedCreditForPrint.createdBy?.split('@')[0] || "SYS"}
            </p>
            <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#000' }}>PAGE 1 OF 1</p>
          </div>

        </div>
      </div>
    )}
    </>
  );
}
