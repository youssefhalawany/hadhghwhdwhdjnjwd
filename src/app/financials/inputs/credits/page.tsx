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
  Printer
} from "lucide-react";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";

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
}

export default function CreditsPage() {
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
  const [priceAdjustment, setPriceAdjustment] = useState("0");
  const [onSalesOnly, setOnSalesOnly] = useState(false);
  const [isTaxable, setIsTaxable] = useState(false);

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
      setCurrentUser(user);
      if (user) {
        fetchCredits();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const [creditHistories, setCreditHistories] = useState<Record<string, any[]>>({});

  const fetchCredits = async () => {
    try {
      const q = query(collection(db, "credits"), orderBy("createdAt", "desc"), limit(200));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const d = doc.data() as any;

        const totalPaid = Number(d.paidAmount || 0);
        const totalDue = Number(d.amountDue || 0) + Number(d.tax || 0);

        // Auto-detect status based on true totalPaid
        let status = d.status || "open";

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
    } catch (error) {
      console.error("Error fetching credits:", error);
      toast.error("Failed to load credits");
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
        storeId: "eL-alamein-4",
        tax: parseFloat(tax) || 0,
        paidAmount: 0,
        priceAdjustment: parseFloat(priceAdjustment) || 0
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
      setPriceAdjustment("0");
      setOnSalesOnly(false);
      setIsTaxable(false);

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
        storeId: "eL-alamein-4",
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

    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      setSelectedCreditForPrint(null);
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
    return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;
  }

  return (
    <>
      <div className="min-h-screen bg-[#f8f9fa] p-6 font-sans print:hidden">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header Options */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg font-semibold shadow hover:bg-red-700 transition"
          >
            <Plus size={20} /> Add Credits
          </button>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50">
              <Download size={18} /> Export Credits
            </button>
            <button className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50">
              <Download size={18} /> Export All
            </button>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Outstanding</p>
            <p className="text-xl font-bold text-orange-600">EGP {stats.outstanding.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.outstanding.count} open</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Pending</p>
            <p className="text-xl font-bold text-blue-600">EGP {stats.pending.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.pending.count} pending</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Partial</p>
            <p className="text-xl font-bold text-yellow-600">EGP {stats.partial.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.partial.count} partial</p>
          </div>
          <div className="bg-green-50 border border-green-100 p-4 rounded-xl shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Collected</p>
            <p className="text-xl font-bold text-green-600">EGP {stats.collected.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.collected.count} done</p>
          </div>
          <div className="bg-red-50 border border-red-100 p-4 rounded-xl shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Overdue</p>
            <p className="text-xl font-bold text-red-600">{stats.overdue.count}</p>
            <p className="text-xs text-gray-500 mt-1">EGP {stats.overdue.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Sales Only</p>
            <p className="text-xl font-bold text-purple-600">{stats.salesOnly.count}</p>
            <p className="text-xs text-gray-500 mt-1">EGP {stats.salesOnly.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search company or invoice..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="w-full p-2.5 rounded-lg border border-gray-300 bg-white shadow-sm outline-none text-gray-700"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="salesOnly">Sales Only</option>
          </select>
        </div>

        {/* Credits List */}
        <div className="space-y-4">
          {filteredCredits.map(credit => {
            const isExpanded = expandedCredits[credit.id];
            const totalDue = credit.amountDue + credit.tax;
            const remaining = totalDue - credit.paidAmount;

            return (
              <div key={credit.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all">
                {/* Header / Summary */}
                <div className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-gray-900 capitalize">{credit.companyName}</h3>
                      <span className="text-sm text-gray-500">{credit.status}</span>
                      {credit.onSalesOnly && (
                        <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full border border-gray-200">Pays on Sales Only</span>
                      )}
                      {!credit.onSalesOnly && (
                        <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full border border-gray-200">Credit</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Invoice #{credit.invoiceNumber} • PO: {credit.poNumber} • Due: {credit.collectionDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <p className="text-2xl font-black text-gray-900">EGP {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <p className="text-sm text-gray-500">Paid: EGP {credit.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <button
                      onClick={() => toggleExpand(credit.id)}
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      {isExpanded ? <ChevronUp size={20} className="text-gray-600" /> : <ChevronDown size={20} className="text-gray-600" />}
                    </button>
                  </div>
                </div>

                {/* Actions (always visible but below) */}
                <div className="px-5 pb-5 flex flex-wrap gap-2">
                  <button onClick={() => handlePrintPdf(credit)} disabled={isPrinting} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    <Printer size={16} /> Print
                  </button>
                  {credit.status !== "paid" && (
                    <button className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700">
                      Pending
                    </button>
                  )}
                  {credit.status === "paid" && (
                    <button className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700">
                      Paid
                    </button>
                  )}
                  <button onClick={() => handleDeleteCredit(credit.id)} className="flex items-center gap-1.5 bg-white border border-red-200 text-red-600 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50">
                    <Trash2 size={16} /> Delete
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50">
                    <h4 className="font-bold text-gray-900 mb-4">Credit Details</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Amount</p>
                        <p className="font-bold text-gray-900">EGP {credit.amountDue.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Tax</p>
                        <p className="font-bold text-gray-900">EGP {credit.tax.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Remaining</p>
                        <p className="font-bold text-red-600">EGP {remaining.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Type</p>
                        <p className="font-bold text-gray-900">{credit.onSalesOnly ? "Pays on Sales Only" : "Normal Credit"}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-gray-200 pt-4 mb-4">
                      <h4 className="font-bold text-gray-900">Payment History</h4>
                      {credit.status !== "paid" && (
                        <button
                          onClick={() => handleOpenPaymentModal(credit)}
                          className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-600 transition"
                        >
                          + Add Payment
                        </button>
                      )}
                    </div>
                    {creditHistories[credit.id] && creditHistories[credit.id].length > 0 ? (
                      <div className="space-y-3">
                        {creditHistories[credit.id].map((payment, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div>
                              <p className="font-bold text-gray-900">EGP {Number(payment.amount).toLocaleString()}</p>
                              <p className="text-xs text-gray-500">{payment.date} • {payment.method?.toUpperCase()}</p>
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded">Paid</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-200">
                          <span className="text-sm font-bold text-gray-600">Total Paid:</span>
                          <span className="text-sm font-bold text-green-600">EGP {credit.paidAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mt-2">No payments yet</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filteredCredits.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500 font-medium">No credits found.</p>
            </div>
          )}
        </div>

      </div>

      {/* ADD CREDIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Add credits</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <X size={24} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddCredit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice # *</label>
                  <input required type="text" className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PO #</label>
                  <input type="text" className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
                  <input required type="text" className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Due *</label>
                  <input required type="number" step="0.01" className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={amountDue} onChange={(e) => setAmountDue(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax</label>
                  <input type="number" step="0.01" className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={tax} onChange={(e) => setTax(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Collection Date</label>
                  <input required type="date" className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price Adjustment <span className="text-xs text-gray-400">(Admin only - can be +/-)</span></label>
                  <input type="number" step="0.01" className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={priceAdjustment} onChange={(e) => setPriceAdjustment(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={onSalesOnly} onChange={(e) => setOnSalesOnly(e.target.checked)} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                  <span className="text-gray-700 font-medium">On Sales Only</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={isTaxable} onChange={(e) => setIsTaxable(e.target.checked)} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                  <span className="text-gray-700 font-medium">Is Taxable?</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  Save Credit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MAKE PAYMENT MODAL */}
      {showPaymentModal && selectedCreditForPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Make Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <X size={24} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleProcessPayment} className="p-6">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                <p className="text-sm text-blue-800 font-medium mb-1">Paying for: <span className="font-bold">{selectedCreditForPayment.companyName}</span></p>
                <p className="text-xs text-blue-600">Invoice: {selectedCreditForPayment.invoiceNumber}</p>
                <div className="mt-2 text-xl font-black text-blue-900">
                  Remaining: EGP {((selectedCreditForPayment.amountDue + selectedCreditForPayment.tax) - selectedCreditForPayment.paidAmount).toLocaleString()}
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                    <input required type="date" className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                    <input required type="time" className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={paymentTime} onChange={(e) => setPaymentTime(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                  <select className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="cash">Cash / نقدي</option>
                    <option value="bank_transfer">Bank Transfer / تحويل بنكي</option>
                    <option value="visa">Visa / فيزا</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Pay *</label>
                  <input required type="number" step="0.01" max={(selectedCreditForPayment.amountDue + selectedCreditForPayment.tax) - selectedCreditForPayment.paidAmount} className="w-full p-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 outline-none font-bold text-lg" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

    {/* HIDDEN PRINT LAYOUT (A4 PDF for Credit) */}
    <style dangerouslySetInnerHTML={{ __html: `
      @media print {
        @page { size: A4 portrait; margin: 0; }
        html, body { background-color: #fff !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        #print-credit-container { display: block !important; }
        .no-print { display: none !important; }
      }
    `}} />
    
    {selectedCreditForPrint && (
      <div id="print-credit-container" className="hidden print:block" style={{ width: '210mm', height: '297mm', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ padding: '60px', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1e293b', paddingBottom: '24px', marginBottom: '40px' }}>
            <div>
              <h1 style={{ fontSize: '36px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>Credit Voucher</h1>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '3px', margin: 0 }}>Official Financial Record</h2>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Voucher ID</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1e293b', fontFamily: 'monospace' }}>{selectedCreditForPrint.id?.substring(0, 8).toUpperCase()}</p>
            </div>
          </div>

          {/* Company Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '48px' }}>
            <div>
              <p style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px', fontWeight: 'bold' }}>Company</p>
              <p style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', margin: '0 0 4px 0' }}>El Masreya for Trade</p>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Branch: <span style={{ fontWeight: 'bold', color: '#1e293b' }}>El Alamein 4</span></p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px', fontWeight: 'bold' }}>Creation Date & Time</p>
              <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 4px 0' }}>{new Date(selectedCreditForPrint.createdAt?.toDate ? selectedCreditForPrint.createdAt.toDate() : selectedCreditForPrint.createdAt || Date.now()).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>{new Date(selectedCreditForPrint.createdAt?.toDate ? selectedCreditForPrint.createdAt.toDate() : selectedCreditForPrint.createdAt || Date.now()).toLocaleTimeString('en-US')}</p>
            </div>
          </div>

          {/* Transaction Details */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '32px', marginBottom: '40px' }}>
            <h3 style={{ fontSize: '14px', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '800', margin: '0 0 24px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>Credit Details</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              <div>
                <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Supplier / Customer Name</p>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0, textTransform: 'capitalize' }}>{selectedCreditForPrint.companyName}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Agreed Payment Date</p>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc2626', margin: 0 }}>{selectedCreditForPrint.collectionDate || 'N/A'}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '32px', paddingTop: '24px', borderTop: '1px dashed #cbd5e1' }}>
              <div>
                <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Invoice Number</p>
                <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0, fontFamily: 'monospace' }}>{selectedCreditForPrint.invoiceNumber || 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>PO Number</p>
                <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0, fontFamily: 'monospace' }}>{selectedCreditForPrint.poNumber || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Amount Box */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <span style={{ fontSize: '16px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Total Amount Due</span>
            <span style={{ fontSize: '36px', fontWeight: '900', color: '#ffffff' }}>EGP {Number(selectedCreditForPrint.amountDue + (selectedCreditForPrint.tax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '40px' }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', fontWeight: 'bold' }}>Subtotal</p>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>EGP {Number(selectedCreditForPrint.amountDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div style={{ backgroundColor: '#f1f5f9', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', fontWeight: 'bold' }}>Tax</p>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>EGP {Number(selectedCreditForPrint.tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div style={{ backgroundColor: '#f1f5f9', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', fontWeight: 'bold' }}>Type</p>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{selectedCreditForPrint.onSalesOnly ? 'Sales Only' : 'Standard Credit'}</p>
            </div>
          </div>

          {/* System Verification Stamp */}
          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '40px' }}>
            <div style={{ border: '4px solid #16a34a', borderRadius: '8px', padding: '16px 32px', textAlign: 'center', transform: 'rotate(-2deg)' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '900', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '2px' }}>Approved & Saved</p>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#15803d', textTransform: 'uppercase', letterSpacing: '1px' }}>Recorded in Financial Database</p>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px', marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Generated by: <span style={{ fontWeight: 'bold', color: '#64748b' }}>{selectedCreditForPrint.createdBy}</span></p>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Secure Automated Receipt</p>
          </div>

        </div>
      </div>
    )}
    </>
  );
}
