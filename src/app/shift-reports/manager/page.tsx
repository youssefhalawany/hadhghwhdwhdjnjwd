"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, addDoc } from "firebase/firestore";
import { CheckCircle, Clock, FileText, Banknote, Package, Lock, Printer, Archive, Trash2, Calendar, QrCode } from "lucide-react";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function ManagerAuditPage() {
  const [activeTab, setActiveTab] = useState<"pending" | "history" | "expiries">("pending");

  const [pendingReports, setPendingReports] = useState<any[]>([]);
  const [historyReports, setHistoryReports] = useState<any[]>([]);
  const [expiries, setExpiries] = useState<any[]>([]);

  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const formatTimeMinus2Hours = (dateString: string) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    d.setHours(d.getHours() - 2);
    return d.toLocaleString('en-GB');
  };

  // Audit Form State
  const [expectedCash, setExpectedCash] = useState<string>("");
  const [expectedVisa, setExpectedVisa] = useState<string>("");
  const [auditShift, setAuditShift] = useState<string>("Morning");
  const [cigarettesPercent, setCigarettesPercent] = useState<string>("");
  const [coffeePercent, setCoffeePercent] = useState<string>("");
  const [comments, setComments] = useState<string>("");
  const [managerName, setManagerName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const [cashierOverrideCash, setCashierOverrideCash] = useState<string>("");
  const [cashierOverrideVisa, setCashierOverrideVisa] = useState<string>("");

  const [isEditingExpiry, setIsEditingExpiry] = useState(false);
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [editExpiryQty, setEditExpiryQty] = useState("");

  useEffect(() => {
    // 1. Fetch Pending
    const qPending = query(collection(db, "shift_reports"), where("status", "==", "pending_manager"));
    const unsubPending = onSnapshot(qPending, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      reports.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPendingReports(reports);
    });

    // 2. Fetch History (Approved)
    const qHistory = query(collection(db, "shift_reports"), where("status", "==", "approved"));
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      reports.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistoryReports(reports);
      setLoading(false);
    });

    // 3. Fetch Expiries
    const qExpiries = query(collection(db, "expiries"));
    const unsubExpiries = onSnapshot(qExpiries, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      items.sort((a: any, b: any) => {
        const dateA = a.expiryDate || "";
        const dateB = b.expiryDate || "";
        return dateA.localeCompare(dateB);
      });
      setExpiries(items);
    });

    return () => {
      unsubPending();
      unsubHistory();
      unsubExpiries();
    };
  }, []);

  const handleSelectReport = (report: any) => {
    setSelectedReport(report);
    setCashierOverrideCash(String(report.cashierCounts.cash || "0"));
    setCashierOverrideVisa(String(report.cashierCounts.visa || "0"));
    // Populate form
    if (report.managerAudit) {
      setExpectedCash(String(report.managerAudit.expectedCash || ""));
      setExpectedVisa(String(report.managerAudit.expectedVisa || ""));
      setCigarettesPercent(String(report.managerAudit.cigarettesPercent || ""));
      setCoffeePercent(String(report.managerAudit.coffeePercent || ""));
      setComments(report.managerAudit.comments || "");
      setManagerName(report.managerAudit.managerName || "");
      setAuditShift(report.cashierDetails?.shift || "Morning");
    } else {
      setExpectedCash("");
      setExpectedVisa("");
      setCigarettesPercent("");
      setCoffeePercent("");
      setComments("");
      setAuditShift(report.cashierDetails?.shift || "Morning");
    }
  };

  const calculateCashVariance = () => {
    if (!selectedReport) return 0;
    const submittedCash = activeTab === "pending" ? Number(cashierOverrideCash) || 0 : selectedReport.cashierCounts.cash;
    return submittedCash - (Number(expectedCash) || 0);
  };

  const calculateVisaVariance = () => {
    if (!selectedReport) return 0;
    const submittedVisa = activeTab === "pending" ? Number(cashierOverrideVisa) || 0 : selectedReport.cashierCounts.visa;
    return submittedVisa - (Number(expectedVisa) || 0);
  };

  const calculateTotalVariance = () => {
    return calculateCashVariance() + calculateVisaVariance();
  };

  const handleApprove = async () => {
    if (!selectedReport) return;
    if (!managerName.trim()) {
      alert("Please enter your name as the auditing manager.");
      return;
    }

    setSubmitting(true);
    try {
      const reportRef = doc(db, "shift_reports", selectedReport.id);

      await updateDoc(reportRef, {
        status: "approved",
        "cashierDetails.shift": auditShift.toLowerCase(),
        "cashierCounts.cash": Number(cashierOverrideCash) || 0,
        "cashierCounts.visa": Number(cashierOverrideVisa) || 0,
        "cashierCounts.total": (Number(cashierOverrideCash) || 0) + (Number(cashierOverrideVisa) || 0),
        managerAudit: {
          ...selectedReport.managerAudit, // preserve rejectReason and other older fields
          expectedCash: Number(expectedCash) || 0,
          expectedVisa: Number(expectedVisa) || 0,
          cashVariance: calculateCashVariance(),
          visaVariance: calculateVisaVariance(),
          overShort: calculateTotalVariance(),
          cigarettesPercent: Number(cigarettesPercent) || 0,
          coffeePercent: Number(coffeePercent) || 0,
          comments,
          managerName,
          auditedAt: selectedReport.managerAudit?.auditedAt || new Date().toISOString()
        }
      });

      // Construct notes incorporating edit history if previously rejected
      let finalNotes = comments;
      if (selectedReport.managerAudit?.rejectReason) {
        finalNotes += `\n[System Note: Previously sent back for editing. Reason: ${selectedReport.managerAudit.rejectReason}]`;
      }

      // Add to sales collection
      await addDoc(collection(db, "sales"), {
        cash: Number(expectedCash) || 0,
        cashierName: selectedReport.cashierDetails.name,
        createdAt: new Date().toISOString(),
        createdBy: managerName,
        date: selectedReport.cashierDetails.date,
        notes: finalNotes.trim(),
        overShort: calculateCashVariance(), // Cash variance only as requested
        shift: auditShift.toLowerCase(),
        storeId: selectedReport.cashierDetails.storeId,
        visa: Number(expectedVisa) || 0
      });

      try {
        await fetch("/api/notifications/notify-master", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "New Sales Record (Shift Approved)",
            body: `Date: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' })}\nApproved By: ${managerName}\nCashier: ${selectedReport.cashierDetails.name}\nShift: ${auditShift}\nSystem Cash: ${expectedCash} EGP\nSystem Visa: ${expectedVisa} EGP\nOver/Short: ${calculateCashVariance()} EGP\nCig. Variance: ${Number(cigarettesPercent) || 0}%\nCoffee Variance: ${Number(coffeePercent) || 0}%\nNotes: ${finalNotes || 'None'}\n\nView Approved Report:\n${window.location.origin}/shift-reports/view?id=${selectedReport.id}`
          })
        });
      } catch (err) { console.error("Notify error", err); }

      alert("Report Approved & Saved! Sales record created.");
      setActiveTab("history");
    } catch (error) {
      console.error("Error approving report:", error);
      alert("Failed to approve report.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReport) return;
    const reason = prompt("Enter reason for rejection (this will be shown to the cashier):");
    if (!reason) return; // cancelled or empty

    setSubmitting(true);
    try {
      const reportRef = doc(db, "shift_reports", selectedReport.id);

      await updateDoc(reportRef, {
        status: "rejected",
        managerAudit: {
          rejectReason: reason,
          rejectedAt: new Date().toISOString()
        }
      });

      alert("Report Rejected & sent back to cashier!");
      setActiveTab("pending");
      setSelectedReport(null);
    } catch (error) {
      console.error("Error rejecting report:", error);
      alert("Failed to reject report.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedReport) return;
    
    // First confirmation: PIN
    const pin = prompt("Admin override required. Please enter the 4-digit manager PIN to delete this report:");
    if (pin !== "1111") {
      if (pin !== null) alert("Incorrect PIN. Deletion cancelled.");
      return;
    }

    // Second confirmation: Professional confirmation
    const isConfirmed = window.confirm(
      "CRITICAL WARNING: You are about to permanently delete this shift report.\n\n" +
      "This action cannot be undone and will permanently erase all financial, inventory, and submission data associated with this shift.\n\n" +
      "Are you absolutely sure you want to proceed with permanent deletion?"
    );

    if (!isConfirmed) return;

    setSubmitting(true);
    try {
      const reportRef = doc(db, "shift_reports", selectedReport.id);
      await deleteDoc(reportRef);

      alert("Success: Shift report has been permanently deleted.");
      setActiveTab("pending");
      setSelectedReport(null);
    } catch (error) {
      console.error("Error deleting report:", error);
      alert("System Error: Failed to delete report.");
    } finally {
      setSubmitting(false);
    }
  };

  const generatePDF = async () => {
    if (!selectedReport) return;
    setGeneratingPDF(true);
    try {
      const element = document.getElementById("manager-signoff-pdf-capture");
      if (!element) return;

      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.autoPrint();
      window.open(pdf.output("bloburl"), "_blank");
    } catch (error) {
      console.error("PDF Generate Error:", error);
      alert("Failed to generate PDF Report.");
    } finally {
      setGeneratingPDF(false);
    }
  };
  
  const handleMarkExpiryPulled = async (item: any) => {
    const exp = new Date(item.expiryDate);
    exp.setHours(0,0,0,0);
    const t = new Date();
    t.setHours(0,0,0,0);
    const isExpired = exp <= t;

    let pulledQty = Number(item.quantity) || 0;

    if (isExpired) {
      const pulledQtyStr = prompt(`Audit Expiry: Item ${item.itemName} (${item.barcode || "N/A"})\nHow many items are you actually pulling from the shelf?`, item.quantity.toString());
      if (pulledQtyStr === null) return; // Cancelled
      
      pulledQty = Number(pulledQtyStr);
      if (isNaN(pulledQty) || pulledQty < 0) {
        alert("Invalid quantity. Action cancelled.");
        return;
      }
    }

    try {
      // 1. Update status in expiries
      await updateDoc(doc(db, "expiries", item.id), { status: "pulled" });
      setSelectedExpiry((prev: any) => prev && prev.id === item.id ? { ...prev, status: "pulled" } : prev);

      // 2. If expired, add to expired_items collection
      if (isExpired) {
        const savedUserStr = localStorage.getItem("active_cashier_session");
        let managerEmail = "Unknown Manager";
        if (savedUserStr) {
          const sessionData = JSON.parse(savedUserStr);
          managerEmail = sessionData.email || sessionData.name || "Unknown Manager";
        }

        const todayStr = new Date().toISOString().split('T')[0];

        await addDoc(collection(db, "expired_items"), {
          barcode: item.barcode || "N/A",
          category: "uncategorized",
          createdAt: new Date().toISOString(),
          createdBy: managerEmail,
          date: todayStr,
          name: item.itemName,
          quantity: pulledQty,
          storeId: item.storeId || "Unknown"
        });
      }
      
      // alert only if we had to audit it to give confirmation
      if (isExpired) alert("Item audited and marked as pulled successfully!");

    } catch (error) {
      console.error("Error marking pulled:", error);
      alert("Failed to update status.");
    }
  };

  const handleDeleteExpiry = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expiry record?")) return;
    try {
      await deleteDoc(doc(db, "expiries", id));
      setSelectedExpiry(null);
    } catch (error) {
      console.error("Error deleting expiry:", error);
      alert("Failed to delete record.");
    }
  };

  const handleSaveExpiryEdit = async () => {
    if (!selectedExpiry) return;
    try {
      await updateDoc(doc(db, "expiries", selectedExpiry.id), {
        expiryDate: editExpiryDate,
        quantity: Number(editExpiryQty) || 0
      });
      setSelectedExpiry({ ...selectedExpiry, expiryDate: editExpiryDate, quantity: Number(editExpiryQty) || 0 });
      setIsEditingExpiry(false);
      alert("Expiry record updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to update expiry record.");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div></div>;
  }

  const reportsList = activeTab === "pending" 
    ? pendingReports 
    : historyReports.filter(r => 
        r.id.toUpperCase().includes(searchQuery.toUpperCase()) || 
        (r.cashierDetails?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
      );

  const filteredExpiries = expiries.filter(item => 
    (item.itemName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.barcode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.storeId || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.addedBy || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-border pb-4 mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Manager Audit Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Review, approve, and print end-of-shift reports</p>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
          <button
            onClick={() => { setActiveTab("pending"); setSelectedReport(null); setSelectedExpiry(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "pending" ? "bg-card shadow text-red-500 border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Clock className="h-4 w-4" /> Pending ({pendingReports.length})
          </button>
          <button
            onClick={() => { setActiveTab("history"); setSelectedReport(null); setSelectedExpiry(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "history" ? "bg-card shadow text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Archive className="h-4 w-4" /> Audit History ({historyReports.length})
          </button>
          <button
            onClick={() => { setActiveTab("expiries"); setSelectedReport(null); setSelectedExpiry(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "expiries" ? "bg-card shadow text-blue-500 border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Calendar className="h-4 w-4 text-blue-500" /> Expiries Tracker ({expiries.filter(e => e.status !== "pulled").length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT COLUMN: LIST */}
        <div className="lg:col-span-1 space-y-4 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
          
          {(activeTab === "history" || activeTab === "expiries") && (
            <div className="sticky top-0 z-10 bg-background pb-2">
              <input 
                type="text"
                placeholder={activeTab === "expiries" ? "Search by Item, Barcode, or Store..." : "Search by Barcode or Cashier Name..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-3 rounded-xl border border-border bg-muted/50 focus:bg-background outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
            </div>
          )}

          {activeTab === "expiries" ? (
            filteredExpiries.length === 0 ? (
              <div className="glass-panel p-8 text-center rounded-2xl">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="font-bold text-foreground">No active expiries tracked.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredExpiries.map(item => {
                  const itemDate = new Date(item.expiryDate);
                  itemDate.setHours(0,0,0,0);
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  const tomorrow = new Date(today);
                  tomorrow.setDate(tomorrow.getDate() + 1);

                  const isExpired = itemDate < today;
                  const isExpiringToday = itemDate.getTime() === today.getTime();
                  const isExpiringTomorrow = itemDate.getTime() === tomorrow.getTime();

                  let badgeClass = "bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/30";
                  let badgeText = "Active";

                  if (item.status === "pulled") {
                    badgeClass = "bg-slate-200 text-slate-500 dark:bg-slate-800/80 dark:text-slate-500 border border-slate-300/30";
                    badgeText = "Pulled";
                  } else if (isExpired) {
                    badgeClass = "bg-red-105 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200/30";
                    badgeText = "EXPIRED";
                  } else if (isExpiringToday) {
                    badgeClass = "bg-orange-105 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/30";
                    badgeText = "Today";
                  } else if (isExpiringTomorrow) {
                    badgeClass = "bg-yellow-105 text-yellow-800 dark:bg-yellow-950/45 dark:text-yellow-400 border border-yellow-250/30";
                    badgeText = "Tomorrow";
                  }

                  const isSelected = selectedExpiry?.id === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => { setSelectedExpiry(item); setSelectedReport(null); setEditExpiryDate(item.expiryDate); setEditExpiryQty(String(item.quantity)); setIsEditingExpiry(false); }}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${isSelected
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/15 shadow-md shadow-blue-500/10'
                          : 'border-border bg-card hover:border-blue-300'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-foreground text-sm">{item.expiryDate}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeClass}`}>{badgeText}</span>
                      </div>
                      <div className="font-semibold text-lg text-foreground mb-1">{item.itemName}</div>
                      <div className="text-xs text-muted-foreground font-mono flex items-center justify-between">
                        <span>Barcode: {item.barcode}</span>
                        <span className="font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">Qty: {item.quantity}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : reportsList.length === 0 ? (
            <div className="glass-panel p-8 text-center rounded-2xl">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="font-bold text-foreground">{activeTab === "pending" ? "All caught up!" : "No history found."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
              {reportsList.map(report => (
                <motion.button
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  key={report.id}
                  onClick={() => { handleSelectReport(report); setSelectedExpiry(null); }}
                  className={`w-full text-left p-4 rounded-xl border transition-all relative overflow-hidden ${selectedReport?.id === report.id
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/20 shadow-md shadow-red-500/10'
                      : 'border-border bg-card hover:border-red-300'
                    }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-foreground text-sm">{report.cashierDetails.date}</span>
                    <span className="text-xs font-bold px-2 py-1 bg-red-500/10 rounded-md text-red-500 border border-red-200/20 dark:border-red-950/30">{report.cashierDetails.shift}</span>
                  </div>
                  <div className="font-semibold text-lg text-foreground mb-1">{report.cashierDetails.name}</div>
                  <div className="text-xs text-muted-foreground font-mono mb-3">Store: {report.cashierDetails.storeId}</div>

                  {activeTab === "history" && report.managerAudit && (
                    <div className={`mb-3 text-xs flex justify-between bg-card p-2 rounded border border-border ${report.managerAudit.overShort !== 0 ? 'animate-pulse border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : ''}`}>
                      <span className="text-muted-foreground">Variance:</span>
                      <span className={`font-bold ${report.managerAudit.overShort < 0 ? 'text-red-600' : report.managerAudit.overShort > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {report.managerAudit.overShort < 0 ? '-' : report.managerAudit.overShort > 0 ? '+' : ''}EGP {Math.abs(report.managerAudit.overShort)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-red-100 dark:border-red-900/30">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Declared Total</span>
                    <span className="font-bold text-red-600 dark:text-red-400">EGP {report.cashierCounts.total.toLocaleString()}</span>
                  </div>
                </motion.button>
              ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: AUDIT WORKSPACE */}
        <div className="lg:col-span-2">
          {activeTab === "expiries" ? (
            !selectedExpiry ? (
              <div className="glass-panel h-full min-h-[500px] p-6 rounded-2xl border border-border bg-muted/10 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-6 w-6 text-blue-500 animate-pulse" />
                  <h3 className="text-xl font-black text-foreground">Expiries Tracker Summary</h3>
                </div>

                {/* Stat Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Total Active */}
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-border shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Tracking</span>
                    <span className="text-3xl font-black text-blue-600 mt-2">
                      {expiries.filter(e => e.status !== "pulled").length}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">Active items</span>
                  </div>

                  {/* Expired */}
                  {(() => {
                    const expiredCount = expiries.filter(e => {
                      if (e.status === "pulled") return false;
                      const exp = new Date(e.expiryDate);
                      exp.setHours(0,0,0,0);
                      const t = new Date();
                      t.setHours(0,0,0,0);
                      return exp < t;
                    }).length;

                    return (
                      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-border shadow-sm flex flex-col justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Expired</span>
                        <span className={`text-3xl font-black mt-2 ${expiredCount > 0 ? "text-red-600 animate-pulse" : "text-slate-500"}`}>
                          {expiredCount}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">Requires pulling</span>
                      </div>
                    );
                  })()}

                  {/* Expiring Soon */}
                  {(() => {
                    const soonCount = expiries.filter(e => {
                      if (e.status === "pulled") return false;
                      const exp = new Date(e.expiryDate);
                      exp.setHours(0,0,0,0);
                      const t = new Date();
                      t.setHours(0,0,0,0);
                      const tom = new Date(t);
                      tom.setDate(tom.getDate() + 1);
                      return exp.getTime() === t.getTime() || exp.getTime() === tom.getTime();
                    }).length;

                    return (
                      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-border shadow-sm flex flex-col justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Expires 48h</span>
                        <span className="text-3xl font-black text-orange-500 mt-2">
                          {soonCount}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">Pull window close</span>
                      </div>
                    );
                  })()}

                  {/* Total Pulled */}
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-border shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Pulled</span>
                    <span className="text-3xl font-black text-green-600 mt-2">
                      {expiries.filter(e => e.status === "pulled").length}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">Lifetime total</span>
                  </div>
                </div>

                {/* Expiry Action List (Critical First) */}
                <div className="bg-white dark:bg-slate-850 p-5 rounded-xl border border-border space-y-4">
                  <h4 className="text-sm font-black text-foreground uppercase tracking-wider">Critical Daily Action List</h4>
                  
                  {(() => {
                    const criticalItems = expiries.filter(e => {
                      if (e.status === "pulled") return false;
                      const exp = new Date(e.expiryDate);
                      exp.setHours(0,0,0,0);
                      const t = new Date();
                      t.setHours(0,0,0,0);
                      const tom = new Date(t);
                      tom.setDate(tom.getDate() + 1);
                      return exp < t || exp.getTime() === t.getTime() || exp.getTime() === tom.getTime();
                    });

                    if (criticalItems.length === 0) {
                      return (
                        <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                          <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                          <p className="text-xs font-semibold text-slate-500">No items expiring today, tomorrow, or already expired! Excellent work.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted text-muted-foreground uppercase text-[10px]">
                            <tr>
                              <th className="p-2.5">Item Name</th>
                              <th className="p-2.5">Barcode</th>
                              <th className="p-2.5">Store</th>
                              <th className="p-2.5">Expiry Date</th>
                              <th className="p-2.5 text-center">Qty</th>
                              <th className="p-2.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {criticalItems.map(item => {
                              const exp = new Date(item.expiryDate);
                              exp.setHours(0,0,0,0);
                              const t = new Date();
                              t.setHours(0,0,0,0);
                              const isExpired = exp < t;

                              return (
                                <tr key={item.id} className={isExpired ? "bg-red-500/5" : "bg-transparent"}>
                                  <td className="p-2.5 font-bold text-foreground flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? "bg-red-500 animate-ping" : "bg-orange-500"}`}></span>
                                    {item.itemName}
                                  </td>
                                  <td className="p-2.5 font-mono text-muted-foreground">{item.barcode}</td>
                                  <td className="p-2.5 text-muted-foreground">{item.storeId}</td>
                                  <td className={`p-2.5 font-bold ${isExpired ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"}`}>
                                    {item.expiryDate} {isExpired ? "(EXPIRED)" : ""}
                                  </td>
                                  <td className="p-2.5 text-center font-bold text-foreground">{item.quantity}</td>
                                  <td className="p-2.5 text-right flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleMarkExpiryPulled(item)}
                                      className="px-2 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded font-bold text-[10px] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                    >
                                      Pull
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="glass-panel rounded-2xl border border-border overflow-hidden">
                {/* Header */}
                <div className="bg-slate-900 text-white p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-black">{selectedExpiry.itemName}</h2>
                      <p className="text-slate-400 text-sm mt-1">
                        Barcode: {selectedExpiry.barcode} • Store: {selectedExpiry.storeId}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        {/* Status Badges */}
                        {selectedExpiry.status === "pulled" ? (
                          <span className="px-2.5 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-lg border border-slate-700">
                            Pulled
                          </span>
                        ) : (() => {
                          const itemDate = new Date(selectedExpiry.expiryDate);
                          itemDate.setHours(0,0,0,0);
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          const tomorrow = new Date(today);
                          tomorrow.setDate(tomorrow.getDate() + 1);

                          if (itemDate < today) {
                            return (
                              <span className="px-2.5 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/30 animate-pulse">
                                EXPIRED! Pull Now!
                              </span>
                            );
                          } else if (itemDate.getTime() === today.getTime()) {
                            return (
                              <span className="px-2.5 py-1 bg-orange-500/20 text-orange-400 text-xs font-bold rounded-lg border border-orange-500/30">
                                Expires Today
                              </span>
                            );
                          } else if (itemDate.getTime() === tomorrow.getTime()) {
                            return (
                              <span className="px-2.5 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-lg border border-yellow-500/30">
                                Expires Tomorrow
                              </span>
                            );
                          } else {
                            return (
                              <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg border border-blue-500/30">
                                Active Tracking
                              </span>
                            );
                          }
                        })()}
                      </div>
                    </div>
                    <div className="text-right flex items-center justify-end gap-4">
                      {isEditingExpiry ? (
                        <div className="text-left bg-slate-800 p-2 rounded-lg">
                          <label className="text-[10px] text-slate-400 font-bold block uppercase mb-1">New Quantity</label>
                          <input type="number" value={editExpiryQty} onChange={e => setEditExpiryQty(e.target.value)} className="w-16 p-1 text-slate-900 font-bold rounded text-center outline-none" />
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Quantity</p>
                          <p className="text-2xl font-black text-green-400">{selectedExpiry.quantity}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6 bg-background">
                  {/* 1. Barcode Render */}
                  <section className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border flex flex-col items-center justify-center">
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Item Barcode</p>
                    {selectedExpiry.barcode ? (
                      <div className="bg-white p-3 rounded">
                        <Barcode value={selectedExpiry.barcode} width={1.8} height={50} fontSize={14} />
                      </div>
                    ) : (
                      <span className="text-sm italic text-muted-foreground">No barcode recorded</span>
                    )}
                  </section>

                  {/* 2. Expiry Details */}
                  <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/30 rounded-xl border border-border relative">
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Expiration Date</p>
                      {isEditingExpiry ? (
                        <input type="date" value={editExpiryDate} onChange={e => setEditExpiryDate(e.target.value)} className="w-full p-2 mt-1 rounded bg-background border border-border font-bold outline-none text-foreground" />
                      ) : (
                        <p className="text-lg font-bold text-foreground">{selectedExpiry.expiryDate}</p>
                      )}
                    </div>
                    <div className="p-4 bg-muted/30 rounded-xl border border-border">
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Date Logged</p>
                      <p className="text-lg font-bold text-foreground">
                        {selectedExpiry.createdAt ? new Date(selectedExpiry.createdAt).toLocaleDateString('en-GB') : "N/A"}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-xl border border-border">
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Logged By Staff</p>
                      <p className="text-lg font-bold text-foreground">{selectedExpiry.addedBy || "Unknown"}</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-xl border border-border">
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Store Location</p>
                      <p className="text-lg font-bold text-foreground">{selectedExpiry.storeId || "Unknown"}</p>
                    </div>
                  </section>

                  {/* 3. Actions */}
                  <div className="pt-4 border-t border-border flex flex-col gap-3">
                    {isEditingExpiry ? (
                      <div className="flex gap-2">
                        <button onClick={() => setIsEditingExpiry(false)} className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-all">Cancel</button>
                        <button onClick={handleSaveExpiryEdit} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md">Save Changes</button>
                      </div>
                    ) : (
                      <>
                        {selectedExpiry.status !== "pulled" && (
                          <button
                            type="button"
                            onClick={() => handleMarkExpiryPulled(selectedExpiry)}
                            className="w-full py-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer animate-in fade-in"
                          >
                            <CheckCircle className="h-5 w-5 text-green-500" /> Mark Item as Pulled from Shelf
                          </button>
                        )}
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setIsEditingExpiry(true)}
                            className="flex-1 py-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl font-bold text-sm transition-all flex items-center justify-center cursor-pointer"
                          >
                            Edit Record
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpiry(selectedExpiry.id)}
                            className="flex-1 py-3 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:border-red-900/40 dark:hover:bg-red-900/50 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" /> Delete Expiry
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : !selectedReport ? (
            <div className="glass-panel h-full min-h-[500px] flex flex-col items-center justify-center text-center rounded-2xl border border-border bg-muted/20">
              <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-bold text-muted-foreground">Select a report to view/audit</p>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl border border-border overflow-hidden">
              {/* Header */}
              <div className="bg-slate-900 text-white p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-black">{selectedReport.cashierDetails.name}</h2>
                    <p className="text-slate-400 text-sm mt-1 flex flex-wrap items-center gap-2">
                      <span>{selectedReport.cashierDetails.date}</span>
                      <span className="text-slate-600">•</span>
                      {activeTab === "pending" ? (
                        <select 
                          value={auditShift} 
                          onChange={(e) => setAuditShift(e.target.value)} 
                          className="bg-slate-800 border border-slate-600 text-white rounded px-2 py-0.5 outline-none font-bold text-xs focus:border-red-500 transition-colors"
                        >
                          <option value="Morning">Morning Shift</option>
                          <option value="Noon">Noon Shift</option>
                          <option value="Night">Night Shift</option>
                        </select>
                      ) : (
                        <span>{selectedReport.cashierDetails.shift} Shift</span>
                      )}
                      <span className="text-slate-600">•</span>
                      <span>{selectedReport.cashierDetails.storeId}</span>
                    </p>
                    <p className="text-slate-500 text-xs mt-1 font-semibold text-blue-600">
                      {selectedReport.cashierRole === 2 ? 'Cashier 2 (Money Only)' : 'Cashier 1 (Full Register)'}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">Submitted: {formatTimeMinus2Hours(selectedReport.createdAt)}</p>
                    {activeTab === "history" && (
                      <span className="inline-block mt-3 px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded border border-green-500/30">
                        <CheckCircle className="inline h-3 w-3 mr-1" /> Approved by {selectedReport.managerAudit?.managerName}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Declared Total</p>
                    <p className="text-2xl font-black text-green-400">EGP {activeTab === "pending" ? ((Number(cashierOverrideCash) || 0) + (Number(cashierOverrideVisa) || 0)).toLocaleString() : selectedReport.cashierCounts.total.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-8 bg-background">

                {/* 1. Cashier Counts vs System Expected */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Banknote className="h-5 w-5 text-red-500" />
                    <h3 className="text-lg font-bold">Financial Audit (Over/Short)</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border relative">
                      <div className="absolute -top-3 left-4 bg-background px-2 text-[10px] font-bold text-muted-foreground uppercase border border-border rounded-full">Cashier's Physical Count</div>
                      <div className="flex justify-between items-center gap-2 p-2 bg-card rounded border border-border">
                        <span className="text-sm font-semibold">Cash</span>
                        {activeTab === "pending" ? (
                          <input type="number" value={cashierOverrideCash} onChange={e => setCashierOverrideCash(e.target.value)} className="w-28 p-1 text-right font-mono border border-border bg-background rounded outline-none focus:ring-1 focus:ring-blue-500 text-sm" placeholder="Override" />
                        ) : (
                          <span className="font-mono font-bold">EGP {selectedReport.cashierCounts.cash.toLocaleString()}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center gap-2 p-2 bg-card rounded border border-border">
                        <span className="text-sm font-semibold">Visa</span>
                        {activeTab === "pending" ? (
                          <input type="number" value={cashierOverrideVisa} onChange={e => setCashierOverrideVisa(e.target.value)} className="w-28 p-1 text-right font-mono border border-border bg-background rounded outline-none focus:ring-1 focus:ring-blue-500 text-sm" placeholder="Override" />
                        ) : (
                          <span className="font-mono font-bold">EGP {selectedReport.cashierCounts.visa.toLocaleString()}</span>
                        )}
                      </div>
                    </div>

                    {/* Manager Input (System Expected) */}
                    <div className="space-y-3 p-4 bg-red-500/5 dark:bg-red-950/10 rounded-xl border border-red-200/50 dark:border-red-900/30 relative">
                      <div className="absolute -top-3 left-4 bg-red-100 dark:bg-red-950/80 px-2 text-[10px] font-bold text-red-800 dark:text-red-300 uppercase border border-red-200/50 dark:border-red-900/40 rounded-full">POS Expected Totals</div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-sm font-semibold text-red-900">Cash</span>
                        <input type="number" value={expectedCash} onChange={e => setExpectedCash(e.target.value)} className="w-32 p-1.5 text-right font-mono border rounded outline-none focus:ring-2 focus:ring-red-500" placeholder="0.00" />
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-sm font-semibold text-red-900">Visa</span>
                        <input type="number" value={expectedVisa} onChange={e => setExpectedVisa(e.target.value)} className="w-32 p-1.5 text-right font-mono border rounded outline-none focus:ring-2 focus:ring-red-500" placeholder="0.00" />
                      </div>
                    </div>
                  </div>

                  {/* Variance Result */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border flex justify-between items-center bg-slate-50 border-slate-200">
                      <span className="font-bold text-slate-700">Cash Variance</span>
                      {(() => {
                        const variance = calculateCashVariance();
                        const isZero = variance === 0;
                        const isShort = variance < 0;
                        return (
                          <span className={`text-xl font-black ${isZero ? 'text-slate-500' : isShort ? 'text-red-600' : 'text-green-600'}`}>
                            {isShort ? '-' : isZero ? '' : '+'}EGP {Math.abs(variance).toLocaleString()}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="p-4 rounded-xl border flex justify-between items-center bg-slate-50 border-slate-200">
                      <span className="font-bold text-slate-700">Visa Variance</span>
                      {(() => {
                        const variance = calculateVisaVariance();
                        const isZero = variance === 0;
                        const isShort = variance < 0;
                        return (
                          <span className={`text-xl font-black ${isZero ? 'text-slate-500' : isShort ? 'text-red-600' : 'text-green-600'}`}>
                            {isShort ? '-' : isZero ? '' : '+'}EGP {Math.abs(variance).toLocaleString()}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </section>

                {/* 2. Inventory Review (Only for Cashier 1) */}
                {selectedReport.cashierRole !== 2 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Package className="h-5 w-5 text-amber-500" />
                      <h3 className="text-lg font-bold">Inventory Review</h3>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground uppercase text-xs">
                          <tr>
                            <th className="p-3 font-bold">Item</th>
                            <th className="p-3">Start</th>
                            <th className="p-3">Delivery</th>
                            <th className="p-3">End</th>
                            <th className="p-3 font-bold text-right">Calculated Sold</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                          <tr>
                            <td className="p-3 font-bold">Cigarettes (سجائر)</td>
                            <td className="p-3">{selectedReport.inventoryCounts?.cigarettes?.start || 0}</td>
                            <td className="p-3">{selectedReport.inventoryCounts?.cigarettes?.delivery || 0}</td>
                            <td className="p-3">{selectedReport.inventoryCounts?.cigarettes?.end || 0}</td>
                            <td className="p-3 font-bold text-right bg-amber-50 text-amber-900">{selectedReport.inventoryCounts?.cigarettes?.sold || 0}</td>
                          </tr>
                          <tr>
                            <td className="p-3 font-bold">Lighters (ولاعات)</td>
                            <td className="p-3">{selectedReport.inventoryCounts?.lighters?.start || 0}</td>
                            <td className="p-3">{selectedReport.inventoryCounts?.lighters?.delivery || 0}</td>
                            <td className="p-3">{selectedReport.inventoryCounts?.lighters?.end || 0}</td>
                            <td className="p-3 font-bold text-right bg-amber-50 text-amber-900">{selectedReport.inventoryCounts?.lighters?.sold || 0}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Cigarettes Shrink %</label>
                        <input type="number" step="0.01" value={cigarettesPercent} onChange={e => setCigarettesPercent(e.target.value)} className="w-full p-2.5 rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-amber-500" placeholder="e.g. 1.2" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Coffee Shrink %</label>
                        <input type="number" step="0.01" value={coffeePercent} onChange={e => setCoffeePercent(e.target.value)} className="w-full p-2.5 rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-amber-500" placeholder="e.g. 2.5" />
                      </div>
                    </div>
                  </section>
                )}

                {/* 3. Final Sign Off */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="h-5 w-5 text-slate-500" />
                    <h3 className="text-lg font-bold">Manager Audit Notes</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Auditing Manager Name</label>
                      <input type="text" value={managerName} onChange={e => setManagerName(e.target.value)} className="w-full p-3 rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-slate-500" placeholder="Enter your full name" />
                    </div>
                    {selectedReport.managerAudit?.rejectReason && (
                      <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                        <label className="block text-[10px] font-bold text-red-800 uppercase tracking-wider mb-1">Previous Rejection Reason</label>
                        <p className="text-red-600 text-sm italic font-medium">"{selectedReport.managerAudit.rejectReason}"</p>
                        {selectedReport.previousSubmission && (
                          <div className="mt-2 pt-2 border-t border-red-200">
                            <p className="text-[10px] font-bold text-red-800 uppercase">Original Incorrect Submission:</p>
                            <p className="text-xs text-red-700 font-mono mt-0.5">
                              Cash: EGP {selectedReport.previousSubmission.cash} | Visa: EGP {selectedReport.previousSubmission.visa}
                              {selectedReport.cashierRole === 1 && ` | Cigarettes End: ${selectedReport.previousSubmission.cigEnd} | Lighters End: ${selectedReport.previousSubmission.lightEnd}`}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Audit Comments (Optional)</label>
                      <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} className="w-full p-3 rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-slate-500" placeholder="Notes regarding variances, issues, etc." />
                    </div>
                  </div>
                </section>

                {/* Actions */}
                <div className="pt-4 border-t border-border grid grid-cols-1 gap-4">
                  {activeTab === "pending" ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={handleReject}
                          disabled={submitting}
                          className="w-full py-4 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl font-bold text-lg transition-all cursor-pointer"
                        >
                          {submitting ? "..." : "Reject & Send Back"}
                        </button>
                        <button
                          type="button"
                          onClick={handleApprove}
                          disabled={submitting}
                          className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-lg shadow-xl shadow-slate-900/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {submitting ? "Saving..." : <><CheckCircle className="h-5 w-5" /> Approve</>}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={submitting}
                        className="w-full py-3 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" /> Permanently Delete Report
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={submitting}
                        className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-sm transition-all cursor-pointer"
                      >
                        {submitting ? "Saving..." : "Update Audit Notes"}
                      </button>
                      <button
                        type="button"
                        onClick={generatePDF}
                        disabled={generatingPDF}
                        className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-xl shadow-red-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {generatingPDF ? "Generating PDF..." : <><Printer className="h-5 w-5" /> Print A4 Sign-Off Sheet</>}
                      </button>
                    </>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- HIDDEN FORMAL A4 PRINT TEMPLATE FOR MANAGER --- */}
      {selectedReport && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div id="manager-signoff-pdf-capture" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>

            {/* Header / Letterhead */}
            <div style={{ padding: '40px 40px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '4px solid #1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '80px', height: '80px', backgroundColor: '#dc2626', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '50px', fontWeight: '900', color: '#ffffff', lineHeight: 1 }}>K</span>
                </div>
                <div>
                  <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>CIRCLE K EL-ALAMEIN 4</h1>
                  <p style={{ fontSize: '16px', color: '#64748b', margin: '5px 0 0', fontWeight: '600' }}>SHIFT REPORT</p>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <Barcode value={selectedReport.id.substring(0, 10).toUpperCase()} width={1.5} height={40} fontSize={12} displayValue={true} />
                </div>
                <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '15px' }}>
                  {typeof window !== 'undefined' && (
                    <QRCode 
                      value={window.location.origin + '/shift-reports/view?id=' + selectedReport.id} 
                      size={64} 
                      level="M" 
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div style={{ padding: '30px 40px', position: 'relative', zIndex: 10 }}>

              {/* Branch & Shift Details (Strict Grid) */}
              <div style={{ border: '2px solid #e2e8f0', marginBottom: '30px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '10px 15px', borderBottom: '2px solid #e2e8f0', fontWeight: 'bold', color: '#1e293b', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  1. Shift & Branch Information
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '10px' }}>
                    <div>
                      <p style={{ margin: '0 0 5px', color: '#64748b' }}>Audited By</p>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>{managerName || "Pending"}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 5px', color: '#64748b' }}>Date Audited</p>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>{formatTimeMinus2Hours(selectedReport.managerAudit?.auditedAt || new Date().toISOString())}</p>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '0' }}>
                  <div style={{ padding: '15px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 'bold' }}>Branch / Store ID</p>
                    <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: 'bold', margin: 0 }}>{selectedReport.cashierDetails.storeId}</p>
                  </div>
                  <div style={{ padding: '15px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 'bold' }}>Shift Period</p>
                    <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: 'bold', margin: 0 }}>{selectedReport.cashierDetails.shift} Shift</p>
                  </div>
                  <div style={{ padding: '15px', borderBottom: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 'bold' }}>Cashier Name</p>
                    <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: 'bold', margin: 0 }}>{selectedReport.cashierDetails.name}</p>
                  </div>
                  <div style={{ padding: '15px', borderRight: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 'bold' }}>Operating Date</p>
                    <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: 'bold', margin: 0 }}>{selectedReport.cashierDetails.date}</p>
                  </div>
                  <div style={{ padding: '15px', borderRight: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 'bold' }}>Cashier Role</p>
                    <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: 'bold', margin: 0 }}>
                      {selectedReport.cashierRole === 2 ? 'Cashier 2 (Money Only)' : 'Cashier 1 (Full)'}
                    </p>
                  </div>
                  <div style={{ padding: '15px' }}>
                    <p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 'bold' }}>Cashier Submission Timestamp</p>
                    <p style={{ fontSize: '16px', color: '#0f172a', fontWeight: 'bold', margin: 0 }}>{formatTimeMinus2Hours(selectedReport.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* Financial Audit */}
              <div style={{ border: '2px solid #e2e8f0', marginBottom: '15px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '6px 15px', borderBottom: '2px solid #e2e8f0', fontWeight: 'bold', color: '#1e293b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  2. Financial Audit & Variance
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead style={{ backgroundColor: '#f1f5f9' }}>
                    <tr>
                      <th style={{ padding: '8px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>Tender Type</th>
                      <th style={{ padding: '8px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>Cashier Declared</th>
                      <th style={{ padding: '8px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>Manager / POS Expected</th>
                      <th style={{ padding: '8px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569', textAlign: 'right' }}>Variance (Over/Short)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Cash</td>
                      <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '14px' }}>EGP {selectedReport.cashierCounts.cash.toLocaleString()}</td>
                      <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '14px' }}>EGP {Number(expectedCash).toLocaleString() || "0"}</td>
                      <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '14px', textAlign: 'right', fontWeight: 'bold', color: calculateCashVariance() < 0 ? '#dc2626' : '#16a34a' }}>
                        {calculateCashVariance() < 0 ? '-' : '+'}EGP {Math.abs(calculateCashVariance()).toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Visa</td>
                      <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '14px' }}>EGP {selectedReport.cashierCounts.visa.toLocaleString()}</td>
                      <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '14px' }}>EGP {Number(expectedVisa).toLocaleString() || "0"}</td>
                      <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '14px', textAlign: 'right', fontWeight: 'bold', color: calculateVisaVariance() < 0 ? '#dc2626' : '#16a34a' }}>
                        {calculateVisaVariance() < 0 ? '-' : '+'}EGP {Math.abs(calculateVisaVariance()).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Inventory Review */}
              {selectedReport.cashierRole !== 2 && (
                <div style={{ border: '2px solid #e2e8f0', marginBottom: '15px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '6px 15px', borderBottom: '2px solid #e2e8f0', fontWeight: 'bold', color: '#1e293b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    3. Inventory Counts & Shrinkage
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead style={{ backgroundColor: '#f1f5f9' }}>
                      <tr>
                        <th style={{ padding: '8px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>Item</th>
                        <th style={{ padding: '8px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>Start</th>
                        <th style={{ padding: '8px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>Delivery</th>
                        <th style={{ padding: '8px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>End</th>
                        <th style={{ padding: '8px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569', textAlign: 'right' }}>Calculated Sold</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Cigarettes</td>
                        <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0' }}>{selectedReport.inventoryCounts?.cigarettes?.start || 0}</td>
                        <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0' }}>{selectedReport.inventoryCounts?.cigarettes?.delivery || 0}</td>
                        <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0' }}>{selectedReport.inventoryCounts?.cigarettes?.end || 0}</td>
                        <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{selectedReport.inventoryCounts?.cigarettes?.sold || 0}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Lighters</td>
                        <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0' }}>{selectedReport.inventoryCounts?.lighters?.start || 0}</td>
                        <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0' }}>{selectedReport.inventoryCounts?.lighters?.delivery || 0}</td>
                        <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0' }}>{selectedReport.inventoryCounts?.lighters?.end || 0}</td>
                        <td style={{ padding: '8px 15px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{selectedReport.inventoryCounts?.lighters?.sold || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                    <div style={{ padding: '8px 15px', borderRight: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginRight: '10px' }}>Cigarettes Shrink</span>
                      <span style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a' }}>{Number(cigarettesPercent) || 0}%</span>
                    </div>
                    <div style={{ padding: '8px 15px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginRight: '10px' }}>Coffee Shrink</span>
                      <span style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a' }}>{Number(coffeePercent) || 0}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Manager Notes & Rejection History */}
              <div style={{ border: '2px solid #e2e8f0', marginBottom: '30px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '6px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#1e293b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  4. Manager Comments & Review
                </div>
                <div style={{ padding: '12px 15px', fontSize: '12px', color: '#334155' }}>
                  {selectedReport.managerAudit?.rejectReason && (
                    <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed #cbd5e1' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 'bold', color: '#dc2626', textTransform: 'uppercase' }}>Previous Rejection Reason (Corrected by Cashier)</p>
                      <p style={{ margin: 0, fontStyle: 'italic', color: '#dc2626' }}>"{selectedReport.managerAudit.rejectReason}"</p>
                      {selectedReport.previousSubmission && (
                        <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #fca5a5' }}>
                          <p style={{ margin: 0, fontSize: '9px', fontWeight: 'bold', color: '#b91c1c', textTransform: 'uppercase' }}>Original Incorrect Submission</p>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#b91c1c', fontFamily: 'monospace' }}>
                            Cash: EGP {selectedReport.previousSubmission.cash} | Visa: EGP {selectedReport.previousSubmission.visa}
                            {selectedReport.cashierRole === 1 && ` | Cigarettes End: ${selectedReport.previousSubmission.cigEnd} | Lighters End: ${selectedReport.previousSubmission.lightEnd}`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ fontStyle: selectedReport.managerAudit?.comments ? 'normal' : 'italic' }}>
                    {selectedReport.managerAudit?.comments || "No additional comments provided by the auditing manager."}
                  </div>
                </div>
              </div>

              {/* Official Signatures Block */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>

                {/* Cashier Signature */}
                <div style={{ width: '40%' }}>
                  <p style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', marginBottom: '10px', lineHeight: 1.4 }}>
                    I, the undersigned cashier, declare that the physical counts provided above are accurate, and I have surrendered the declared funds to the manager.
                  </p>
                  {selectedReport.cashierSignature ? (
                    <img src={selectedReport.cashierSignature} alt="Signature" style={{ display: 'block', maxWidth: '100%', height: '100px', objectFit: 'contain', marginBottom: '5px' }} />
                  ) : (
                    <div style={{ height: '100px', marginBottom: '5px' }}></div>
                  )}
                  <div style={{ borderBottom: '2px solid #1e293b', width: '100%', marginBottom: '10px' }}></div>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: 0, textTransform: 'uppercase' }}>Cashier Signature</p>
                  <p style={{ fontSize: '16px', fontWeight: '900', color: '#000000', margin: '4px 0 0' }}>{selectedReport.cashierDetails.name}</p>
                </div>

                {/* Manager Signature */}
                <div style={{ width: '40%' }}>
                  <p style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', marginBottom: '30px', lineHeight: 1.4 }}>
                    I, the undersigned manager, declare that I have audited the shift, received the declared funds, and entered the corresponding POS totals.
                  </p>
                  <div style={{ borderBottom: '2px solid #1e293b', width: '100%', marginBottom: '10px' }}></div>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: 0, textTransform: 'uppercase' }}>Manager Signature</p>
                  <p style={{ fontSize: '16px', fontWeight: '900', color: '#000000', margin: '4px 0 0' }}>{managerName || "__________________"}</p>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 'auto', marginBottom: '30px', marginLeft: '40px', marginRight: '40px', borderTop: '2px solid #e2e8f0', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>El Masreya For Trade Internal Document</span>
                <p style={{ fontSize: '9px', color: '#cbd5e1', margin: '2px 0 0' }}>Generated: {formatTimeMinus2Hours(new Date().toISOString())}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 'bold' }}>AUDIT TIMESTAMP: {formatTimeMinus2Hours(selectedReport.managerAudit?.auditedAt || selectedReport.createdAt)}</span>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
