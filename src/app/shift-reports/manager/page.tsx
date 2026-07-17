"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, addDoc, orderBy, limit, getDocs, setDoc } from "firebase/firestore";
import { CheckCircle, Clock, FileText, Banknote, Package, Lock, Printer, Archive, Trash2, Calendar, QrCode, Search, AlertTriangle, X, ShieldAlert } from "lucide-react";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/PageTransition";
import dynamic from "next/dynamic";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from "recharts";

const SignaturePad = dynamic(() => import("react-signature-canvas"), { ssr: false });

export default function ManagerAuditPage() {
  const { currentBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<"pending" | "history" | "performance">("pending");
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<string[]>([]);

  useEffect(() => {
    if (activeTab === "history" || activeTab === "performance") {
      setHasLoadedHistory(true);
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("anh_dismissed_anomalies");
      if (stored) setDismissedAnomalies(JSON.parse(stored));
    } catch (e) { }
  }, []);

  const [pendingReports, setPendingReports] = useState<any[]>([]);
  const [historyReports, setHistoryReports] = useState<any[]>([]);

  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAgedShifts, setHasAgedShifts] = useState(false);
  const [earlyRadars, setEarlyRadars] = useState<any[]>([]);
  const [rejectedRadars, setRejectedRadars] = useState<any[]>([]);
  
  // Showdown Mode State
  const [showdownMode, setShowdownMode] = useState(false);
  const [showdownSelection, setShowdownSelection] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setActiveTab("history");
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cashierLeaderboard = React.useMemo(() => {
    const map = new Map();
    historyReports.forEach(r => {
      const name = r.cashierDetails?.name;
      if (!name) return;

      const cashVar = r.managerAudit?.cashVariance || 0;
      const visaVar = r.managerAudit?.visaVariance || 0;
      const totalDec = (r.cashierCounts?.cash || 0) + (r.cashierCounts?.visa || 0);
      const shiftDate = new Date(r.createdAt || r.date || Date.now()).getTime();

      if (!map.has(name)) {
        map.set(name, {
          cashVariance: 0,
          visaVariance: 0,
          totalDeclared: 0,
          shifts: 0,
          firstShiftDate: shiftDate
        });
      }

      const current = map.get(name);
      current.cashVariance += cashVar;
      current.visaVariance += visaVar;
      current.totalDeclared += totalDec;
      current.shifts += 1;
      if (shiftDate < current.firstShiftDate) {
        current.firstShiftDate = shiftDate;
      }
    });

    return Array.from(map.entries())
      .map(([name, data]) => {
        const daysActive = Math.max(1, Math.ceil((Date.now() - data.firstShiftDate) / (1000 * 60 * 60 * 24)));
        const avgPerShift = data.shifts > 0 ? (data.totalDeclared / data.shifts) : 0;
        return { name, ...data, daysActive, avgPerShift };
      })
      .sort((a, b) => b.totalDeclared - a.totalDeclared);
  }, [historyReports]);

  const getCashierCashDelta = (cashierName: string) => {
    if (!cashierName) return 0;
    const pastShifts = historyReports
      .filter(r => r.cashierDetails?.name === cashierName && r.id !== selectedReport?.id)
      .slice(0, 5);
    if (pastShifts.length === 0) return 0;
    const total = pastShifts.reduce((sum, r) => sum + (r.managerAudit?.cashVariance || 0), 0);
    return Math.round(total / pastShifts.length);
  };

  const getCashierVisaDelta = (cashierName: string) => {
    if (!cashierName) return 0;
    const pastShifts = historyReports
      .filter(r => r.cashierDetails?.name === cashierName && r.id !== selectedReport?.id)
      .slice(0, 5);
    if (pastShifts.length === 0) return 0;
    const total = pastShifts.reduce((sum, r) => sum + (r.managerAudit?.visaVariance || 0), 0);
    return Math.round(total / pastShifts.length);
  };

  const detectedAnomalies = React.useMemo(() => {
    const anomalies: { type: string, message: string, severity: "high" | "medium" }[] = [];
    const cashierGroups = new Map<string, any[]>();

    // Group approved reports by cashier
    historyReports.forEach(r => {
      const name = r.cashierDetails?.name;
      if (!name || !r.managerAudit) return;
      if (!cashierGroups.has(name)) cashierGroups.set(name, []);
      cashierGroups.get(name)!.push(r);
    });

    // Analyze patterns for each cashier
    cashierGroups.forEach((reports, name) => {
      // 1. Repeated exact same negative CASH variance
      const varianceCounts = new Map<number, number>();
      reports.forEach(r => {
        const v = r.managerAudit.cashVariance;
        if (v < 0) {
          varianceCounts.set(v, (varianceCounts.get(v) || 0) + 1);
        }
      });

      varianceCounts.forEach((count, variance) => {
        if (count >= 3) {
          anomalies.push({
            type: "repeated_shortage",
            severity: "high",
            message: `Notice: Cashier ${name} has reported an exact cash shortage of EGP ${Math.abs(variance)} on ${count} different shifts recently. This is a highly unusual pattern and may indicate targeted theft.`
          });
        }
      });

      // 2. High Shrink Alerts (Coffee < 30%)
      const lowCoffeeShrink = reports.filter(r => (r.managerAudit?.coffeePercent < 30 && r.managerAudit?.coffeePercent !== undefined && r.managerAudit?.coffeePercent !== null && r.managerAudit?.coffeePercent !== ""));

      if (lowCoffeeShrink.length >= 3) {
        anomalies.push({
          type: "low_coffee_shrink",
          severity: "high",
          message: `Notice: Cashier ${name} has reported coffee yield below 30% on ${lowCoffeeShrink.length} recent shifts. Good coffee yield should be above 30%. Please review these inventory logs.`
        });
      }
    });

    return anomalies;
  }, [historyReports]);

  const formatTimeMinus2Hours = (dateValue: any) => {
    if (!dateValue) return "";
    try {
      // Handle Firebase Timestamp objects
      let d: Date;
      if (typeof dateValue === 'object' && dateValue.seconds) {
        d = new Date(dateValue.seconds * 1000);
      } else {
        d = new Date(dateValue);
      }

      if (isNaN(d.getTime())) return "Invalid Date";

      d.setHours(d.getHours() - 2);
      return d.toLocaleString('en-GB');
    } catch {
      return "Invalid Date";
    }
  };

  // Audit Form State
  const [expectedCash, setExpectedCash] = useState<string>("");
  const [expectedVisa, setExpectedVisa] = useState<string>("");
  const [auditShift, setAuditShift] = useState<string>("Morning");
  const [coffeePercent, setCoffeePercent] = useState<string>("");
  const [cigarettePercent, setCigarettePercent] = useState<string>("");
  const [comments, setComments] = useState<string>("");
  const [managerName, setManagerName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const sigPadRef = React.useRef<any>(null);
  const [managerSignature, setManagerSignature] = useState("");
  const [hasSigned, setHasSigned] = useState(false);

  const [cashierOverrideCash, setCashierOverrideCash] = useState<string>("");
  const [cashierOverrideVisa, setCashierOverrideVisa] = useState<string>("");

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePin, setDeletePin] = useState("");

  const [earlyDayModalOpen, setEarlyDayModalOpen] = useState(false);
  const [cashiersList, setCashiersList] = useState<any[]>([]);
  const [selectedCashierForEarlyDay, setSelectedCashierForEarlyDay] = useState("");
  const [earlyDayTargetDate, setEarlyDayTargetDate] = useState(new Date().toISOString().substring(0, 10));
  const [earlyDayTargetShift, setEarlyDayTargetShift] = useState("Morning");
  const [requestingEarlyDay, setRequestingEarlyDay] = useState(false);

  useEffect(() => {
    if (earlyDayModalOpen && cashiersList.length === 0) {
      const fetchCashiers = async () => {
        const snap = await getDocs(collection(db, "cashiers"));
        setCashiersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      };
      fetchCashiers();
    }
  }, [earlyDayModalOpen]);

  const handleRequestEarlyDay = async () => {
    if (!selectedCashierForEarlyDay) {
      toast.error("Please select a cashier");
      return;
    }
    setRequestingEarlyDay(true);
    try {
      await addDoc(collection(db, "early_day_requests"), {
        cashierId: selectedCashierForEarlyDay,
        status: "pending",
        requestedAt: new Date().toISOString(),
        branchId: currentBranch || "all",
        targetDate: earlyDayTargetDate || new Date().toISOString().substring(0, 10),
        targetShift: earlyDayTargetShift || "Morning",
      });
      toast.success("Early Day Request Sent to Cashier!");
      setEarlyDayModalOpen(false);
      setSelectedCashierForEarlyDay("");
      setEarlyDayTargetDate(new Date().toISOString().substring(0, 10));
      setEarlyDayTargetShift("Morning");
    } catch (e: any) {
      toast.error(`Failed to request early day: ${e.message || String(e)}`);
      console.error(e);
    } finally {
      setRequestingEarlyDay(false);
    }
  };


  useEffect(() => {
    const getReportBranch = (r: any) => {
      if (r.branchId) return r.branchId;
      const storeId = r.cashierDetails?.storeId?.toLowerCase() || "";
      if (storeId.includes("ola") || storeId.includes("koronfol")) return "ola";
      return "alamein4"; // Default fallback
    };

    const getDateValue = (dateObj: any) => {
      if (!dateObj) return 0;
      if (typeof dateObj === 'object' && dateObj.seconds) return dateObj.seconds * 1000;
      const t = new Date(dateObj).getTime();
      return isNaN(t) ? 0 : t;
    };

    // 1. Fetch Pending
    const qPending = query(collection(db, "shift_reports"), where("status", "==", "pending_manager"));
    const unsubPending = onSnapshot(qPending, (snapshot) => {
      let reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      if (currentBranch !== "all") {
        reports = reports.filter(r => getReportBranch(r) === currentBranch);
      }
      reports.sort((a: any, b: any) => getDateValue(b.createdAt) - getDateValue(a.createdAt));
      
      let aged = false;
      const now = Date.now();
      reports.forEach(r => {
        const subTime = getDateValue(r.createdAt || r.submittedAt);
        if (subTime && now - subTime > 4 * 60 * 60 * 1000) {
          aged = true;
        }
      });
      setHasAgedShifts(aged);
      setPendingReports(reports);
      setLoading(false);
    });

    // 2. Fetch History (Approved) - limit to 100 to ensure we get plenty of data immediately
    const qHistory = query(collection(db, "shift_reports"), orderBy("createdAt", "desc"), limit(100));
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      // Filter locally to avoid composite index requirement
      const approvedReports = reports.filter((r: any) => r.status === "approved");
      setHistoryReports(approvedReports);
    });

    // 3. Fetch Live Drop Radars (Early Drops & Rejected Shifts)
    const unsubEarly = onSnapshot(query(collection(db, "early_day_requests"), where("status", "==", "pending")), (snap) => {
      let requests = snap.docs.map(doc => ({ id: doc.id, type: 'early', ...doc.data() as any }));
      if (currentBranch !== "all") {
         requests = requests.filter(r => (r.branchId === currentBranch) || getReportBranch(r) === currentBranch);
      }
      setEarlyRadars(requests);
    });

    const unsubRejected = onSnapshot(query(collection(db, "shift_reports"), where("status", "==", "rejected")), (snap) => {
      let rejected = snap.docs.map(doc => ({ id: doc.id, type: 'rejected', ...doc.data() as any }));
      if (currentBranch !== "all") {
         rejected = rejected.filter(r => (r.branchId === currentBranch) || getReportBranch(r) === currentBranch);
      }
      setRejectedRadars(rejected);
    });

    return () => {
      unsubPending();
      unsubHistory();
      unsubEarly();
      unsubRejected();
    };
  }, [currentBranch]);

  const handleSelectReport = (report: any) => {
    setSelectedReport(report);
    setCashierOverrideCash(String(report?.cashierCounts?.cash || "0"));
    setCashierOverrideVisa(String(report?.cashierCounts?.visa || "0"));
    // Populate form
    if (report.managerAudit) {
      setExpectedCash(String(report.managerAudit.expectedCash || ""));
      setExpectedVisa(String(report.managerAudit.expectedVisa || ""));
      setCoffeePercent(String(report.managerAudit.coffeePercent || ""));
      setCigarettePercent(String(report.managerAudit.cigarettePercent || ""));
      setComments(report.managerAudit.comments || "");
      setManagerName(report.managerAudit.managerName || "");
      setAuditShift(report.cashierDetails?.shift || "Morning");
    } else {
      setExpectedCash("");
      setExpectedVisa("");
      setCoffeePercent("");
      setCigarettePercent("");
      setComments("");
      setAuditShift(report.cashierDetails?.shift || "Morning");
    }
    setManagerSignature("");
    setHasSigned(false);
    if (sigPadRef.current) {
      sigPadRef.current.clear();
    }
  };

  const calculateCashVariance = () => {
    if (!selectedReport) return 0;
    const submittedCash = activeTab === "pending" ? Number(cashierOverrideCash) || 0 : selectedReport.cashierCounts?.cash;
    return submittedCash - (Number(expectedCash) || 0);
  };

  const calculateVisaVariance = () => {
    if (!selectedReport) return 0;
    const submittedVisa = activeTab === "pending" ? Number(cashierOverrideVisa) || 0 : selectedReport.cashierCounts?.visa;
    return submittedVisa - (Number(expectedVisa) || 0);
  };

  const calculateTotalVariance = () => {
    return calculateCashVariance() + calculateVisaVariance();
  };

  const handleApprove = async () => {
    if (!selectedReport) return;
    if (!managerName.trim()) {
      toast.error("Please enter your name as the auditing manager.");
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
          coffeePercent: Number(coffeePercent) || 0,
          cigarettePercent: Number(cigarettePercent) || 0,
          comments,
          managerName,
          signature: managerSignature || null,
          auditedAt: selectedReport.managerAudit?.auditedAt || new Date().toISOString()
        }
      });

      // Construct notes incorporating edit history if previously rejected
      let finalNotes = comments;
      if (selectedReport.managerAudit?.rejectReason) {
        finalNotes += `\n[System Note: Previously sent back for editing. Reason: ${selectedReport.managerAudit.rejectReason}]`;
      }

      // Find existing sales document or create new
      const salesRef = collection(db, "sales");
      let existingSalesDocId = null;

      if (activeTab === "history") {
        // First try finding by shiftReportId
        const qById = query(salesRef, where("shiftReportId", "==", selectedReport.id), limit(1));
        const idSnap = await getDocs(qById);
        
        if (!idSnap.empty) {
          existingSalesDocId = idSnap.docs[0].id;
        } else {
          // Fallback to finding by exact match of older records
          const qFallback = query(salesRef, 
            where("date", "==", selectedReport?.cashierDetails?.date),
            where("shift", "==", auditShift.toLowerCase()),
            where("storeId", "==", selectedReport?.cashierDetails?.storeId),
            limit(1)
          );
          const fallbackSnap = await getDocs(qFallback);
          if (!fallbackSnap.empty) {
            existingSalesDocId = fallbackSnap.docs[0].id;
          }
        }
      }

      const salesData = {
        cash: Number(expectedCash) || 0,
        cashierName: selectedReport?.cashierDetails?.name || "Unknown",
        date: selectedReport?.cashierDetails?.date || new Date().toISOString().split('T')[0],
        notes: finalNotes ? finalNotes.trim() : "",
        overShort: calculateCashVariance() || 0,
        shift: auditShift ? auditShift.toLowerCase() : (selectedReport?.cashierDetails?.shift?.toLowerCase() || "morning"),
        storeId: selectedReport?.cashierDetails?.storeId || "Unknown",
        branchId: selectedReport?.branchId || currentBranch || "alamein4",
        visa: Number(expectedVisa) || 0,
        shiftReportId: selectedReport?.id || "Unknown"
      };

      if (existingSalesDocId) {
        await updateDoc(doc(db, "sales", existingSalesDocId), {
           ...salesData,
           updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(salesRef, {
           ...salesData,
           createdBy: managerName || "Manager",
           createdAt: new Date().toISOString()
        });
      }

      // Fire and forget notification
      fetch("/api/notifications/notify-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Sales Record (Shift Approved)",
          body: `Date: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' })}\nApproved By: ${managerName}\nCashier: ${selectedReport?.cashierDetails?.name}\nShift: ${auditShift}\nSystem Cash: ${expectedCash} EGP\nSystem Visa: ${expectedVisa} EGP\nOver/Short: ${calculateCashVariance()} EGP\nCoffee Variance: ${Number(coffeePercent) || 0}%\nNotes: ${finalNotes || 'None'}\n\nView Approved Report:\n${window.location.origin}/shift-reports/view?id=${selectedReport.id}`
        })
      }).catch(err => console.error("Notify error", err));

      toast.success("Report Approved & Saved! Sales record created.");
      setActiveTab("history");
    } catch (error) {
      console.error("Error approving report:", error);
      toast.error("Failed to approve report.");
    } finally {
      setSubmitting(false);
    }
  };

  const triggerReject = () => {
    if (!selectedReport) return;
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const confirmReject = async () => {
    if (!selectedReport || !rejectReason.trim()) {
      toast.error("Please enter a valid rejection reason.");
      return;
    }
    setSubmitting(true);
    setRejectModalOpen(false);
    try {
      const reportRef = doc(db, "shift_reports", selectedReport.id);

      await updateDoc(reportRef, {
        status: "rejected",
        managerAudit: {
          rejectReason: rejectReason,
          rejectedAt: new Date().toISOString()
        }
      });

      toast.success("Report Rejected & sent back to cashier!");
      setActiveTab("pending");
      setSelectedReport(null);
    } catch (error) {
      console.error("Error rejecting report:", error);
      toast.error("Failed to reject report.");
    } finally {
      setSubmitting(false);
    }
  };

  const triggerDispute = () => {
    if (!selectedReport) return;
    setDisputeReason("");
    setDisputeModalOpen(true);
  };

  const confirmDispute = async () => {
    if (!selectedReport || !disputeReason.trim()) {
      toast.error("Please enter a valid reason for the dispute/investigation.");
      return;
    }
    setSubmitting(true);
    setDisputeModalOpen(false);
    try {
      const reportRef = doc(db, "shift_reports", selectedReport.id);

      await updateDoc(reportRef, {
        status: "disputed",
        managerAudit: {
          disputeReason: disputeReason,
          disputedAt: new Date().toISOString(),
          managerName: managerName || "Manager"
        }
      });

      toast.success("Report flagged for investigation & sent back to cashier!");
      setActiveTab("pending");
      setSelectedReport(null);
    } catch (error) {
      console.error("Error disputing report:", error);
      toast.error("Failed to flag report.");
    } finally {
      setSubmitting(false);
    }
  };

  const triggerDelete = () => {
    if (!selectedReport) return;
    setDeletePin("");
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedReport) return;

    if (deletePin !== "1111") {
      toast.error("Incorrect PIN. Deletion cancelled.");
      return;
    }

    setSubmitting(true);
    setDeleteModalOpen(false);
    try {
      const reportRef = doc(db, "shift_reports", selectedReport.id);
      await deleteDoc(reportRef);

      toast.success("Success: Shift report has been permanently deleted.");
      setActiveTab("pending");
      setSelectedReport(null);
    } catch (error) {
      console.error("Error deleting report:", error);
      toast.error("System Error: Failed to delete report.");
    } finally {
      setSubmitting(false);
    }
  };

  const generatePDF = async () => {
    if (!selectedReport) return;
    setGeneratingPDF(true);
    try {
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();

      // PAGE 1
      const page1 = document.getElementById("pdf-page-1");
      if (page1) {
        const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true });
        const imgData1 = canvas1.toDataURL("image/png");
        const pdfHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
        pdf.addImage(imgData1, "PNG", 0, 0, pdfWidth, pdfHeight1);
      }

      // PAGE 2 (If applicable)
      const page2 = document.getElementById("pdf-page-2");
      if (page2 && selectedReport.cashierRole === 1) {
        pdf.addPage();
        const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true });
        const imgData2 = canvas2.toDataURL("image/png");
        const pdfHeight2 = (canvas2.height * pdfWidth) / canvas2.width;
        pdf.addImage(imgData2, "PNG", 0, 0, pdfWidth, pdfHeight2);
      }

      pdf.autoPrint();
      window.open(pdf.output("bloburl"), "_blank");
    } catch (error) {
      console.error("PDF Generate Error:", error);
      toast.error("Failed to generate PDF Report.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Skeleton className="h-16 w-16 rounded-full" />
      </div>
    );
  }

  const reportsList = activeTab === "pending"
    ? pendingReports
    : historyReports.filter(r =>
      r.id.toUpperCase().includes(searchQuery.toUpperCase()) ||
      (r.cashierDetails?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );


  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-border pb-4 mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">Manager Audit Portal</h1>
            <p className="text-sm text-muted-foreground mt-1">Review, approve, and print end-of-shift reports</p>
          </div>

          {/* TAB SWITCHER AND ACTION */}
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => setEarlyDayModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-all shadow-md whitespace-nowrap cursor-pointer"
            >
              <Clock className="h-4 w-4" /> Request Early Day
            </button>

            <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
              <button
                onClick={() => { setActiveTab("pending"); setSelectedReport(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "pending" ? "bg-card shadow text-red-500 border border-border" : "text-muted-foreground hover:text-foreground"} ${hasAgedShifts ? 'animate-pulse' : ''}`}
              >
                <Clock className="h-4 w-4" /> Pending ({pendingReports.filter((r: any) => {
                  if (currentBranch === "all") return true;
                  if (r.branchId) return r.branchId === currentBranch;
                  const store = (r.cashierDetails?.storeId || "").toLowerCase();
                  if (currentBranch === "alamein4") return store.includes("alamein") || (!store.includes("alamein") && !store.includes("ola"));
                  if (currentBranch === "ola") return store.includes("ola");
                  return true;
                }).length})
              </button>
              <button
                onClick={() => { setActiveTab("history"); setSelectedReport(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "history" ? "bg-card shadow text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Archive className="h-4 w-4" /> Audit History ({historyReports.filter((r: any) => {
                  if (currentBranch === "all") return true;
                  if (r.branchId) return r.branchId === currentBranch;
                  const store = (r.cashierDetails?.storeId || "").toLowerCase();
                  if (currentBranch === "alamein4") return store.includes("alamein") || (!store.includes("alamein") && !store.includes("ola"));
                  if (currentBranch === "ola") return store.includes("ola");
                  return true;
                }).length})
              </button>
              <button
                onClick={() => { setActiveTab("performance"); setSelectedReport(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "performance" ? "bg-card shadow text-blue-600 border border-border" : "text-muted-foreground hover:text-foreground"}`}
              >
                Performance
              </button>
            </div>
          </div>
        </div>

        {/* Pattern Recognition Alerts */}
        {detectedAnomalies.filter(a => !dismissedAnomalies.includes(a.message)).length > 0 && (
          <div className="mb-6 space-y-3">
            {detectedAnomalies.filter(a => !dismissedAnomalies.includes(a.message)).map((anomaly, idx) => (
              <div key={idx} className={`relative p-4 rounded-xl border flex gap-3 animate-in fade-in slide-in-from-top-4 ${anomaly.severity === 'high' ? 'bg-red-500/10 border-red-500/50 text-red-800 dark:text-red-300' : 'bg-amber-500/10 border-amber-500/50 text-amber-800 dark:text-amber-300'}`}>
                <AlertTriangle className={`h-6 w-6 shrink-0 ${anomaly.severity === 'high' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
                <div className="pr-6">
                  <h4 className="font-bold text-sm uppercase tracking-wider mb-1">
                    Pattern Detected: {anomaly.type.replace('_', ' ')}
                  </h4>
                  <p className="text-sm font-medium">{anomaly.message}</p>
                </div>
                <button
                  onClick={() => {
                    setDismissedAnomalies(prev => {
                      const updated = [...prev, anomaly.message];
                      localStorage.setItem("anh_dismissed_anomalies", JSON.stringify(updated));
                      return updated;
                    });
                  }}
                  className={`absolute top-3 right-3 p-1 rounded-full transition-colors ${anomaly.severity === 'high' ? 'hover:bg-red-500/20 text-red-600' : 'hover:bg-amber-500/20 text-amber-600'}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "performance" ? (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black mb-1">Cashier Intelligence</h2>
                <p className="text-slate-400 text-sm">Aggregated performance and variance metrics from the last 50 processed shifts.</p>
              </div>
              <div className="bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700">
                <span className="text-sm font-bold text-slate-300">Total Active Cashiers: </span>
                <span className="text-lg font-black text-white">{cashierLeaderboard.length}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {cashierLeaderboard.length === 0 ? (
                <div className="col-span-full glass-panel p-10 text-center text-muted-foreground font-medium rounded-2xl">
                  No shift data available to calculate performance.
                </div>
              ) : (
                cashierLeaderboard.map((cashier, idx) => {
                  const isCashShort = cashier.cashVariance < 0;
                  const isCashOver = cashier.cashVariance > 0;
                  const isVisaShort = cashier.visaVariance < 0;
                  const isVisaOver = cashier.visaVariance > 0;
                  const accuracyRating = Math.max(0, 100 - (Math.abs(cashier.cashVariance) / (cashier.totalDeclared || 1)) * 100);

                  return (
                    <div key={idx} className="relative group rounded-2xl overflow-hidden transition-all hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] duration-500 border border-slate-700 dark:border-slate-800 bg-slate-900">
                      {/* Holographic Sheen Animation */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-0 pointer-events-none bg-[linear-gradient(125deg,transparent_20%,rgba(255,255,255,0.1)_40%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.1)_60%,transparent_80%)] bg-[length:200%_200%] animate-[shimmer_3s_infinite_linear]" />
                      
                      {/* Dynamic Gradient Background */}
                      <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${idx === 0 ? 'from-yellow-400 via-amber-600 to-orange-700' : accuracyRating > 99 ? 'from-emerald-400 via-teal-600 to-cyan-700' : 'from-slate-600 via-slate-700 to-slate-900'} z-0`} />
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-3xl z-0" />

                      {/* Rank & Badges */}
                      {idx < 3 && (
                        <div className="absolute top-0 left-0 bg-gradient-to-r from-yellow-400 to-amber-600 text-yellow-950 text-[10px] font-black px-3 py-1 rounded-br-xl uppercase tracking-wider z-20 shadow-lg">
                          Rank #{idx + 1}
                        </div>
                      )}
                      
                      {cashier.cashVariance === 0 && cashier.shifts > 0 && (
                        <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-gradient-to-r from-amber-300 to-yellow-500 text-amber-950 text-[10px] font-black px-2.5 py-1 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.6)] border border-yellow-200/50">
                          <Sparkles className="h-3 w-3" /> FLAWLESS
                        </div>
                      )}

                      <div className="relative z-10 p-6 flex flex-col h-full">
                        {/* Header */}
                        <div className="text-center mb-6">
                          <h3 className="text-xl font-black text-white tracking-tight mb-1">{cashier.name}</h3>
                          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700/50">
                            <Activity className={`h-3 w-3 ${accuracyRating > 99 ? 'text-emerald-400' : accuracyRating > 95 ? 'text-amber-400' : 'text-red-400'}`} />
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                              Accuracy: {accuracyRating.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Main Stat */}
                        <div className="text-center mb-6">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Handled</p>
                          <div className="text-3xl font-black text-white font-mono drop-shadow-md">
                            EGP {cashier.totalDeclared.toLocaleString()}
                          </div>
                        </div>

                        {/* Variances */}
                        <div className="grid grid-cols-2 gap-3 mb-6 flex-grow">
                          <div className="bg-slate-900/50 backdrop-blur-md p-4 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Cash Variance</p>
                            <span className={`inline-block text-lg font-black ${isCashShort ? "text-red-500" : isCashOver ? "text-emerald-500" : "text-slate-400"}`}>
                              {isCashShort ? "-" : isCashOver ? "+" : ""}EGP {Math.abs(cashier.cashVariance).toLocaleString()}
                            </span>
                          </div>
                          <div className="bg-slate-900/50 backdrop-blur-md p-4 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Visa Variance</p>
                            <span className={`inline-block text-lg font-black ${isVisaShort ? "text-red-500" : isVisaOver ? "text-emerald-500" : "text-slate-400"}`}>
                              {isVisaShort ? "-" : isVisaOver ? "+" : ""}EGP {Math.abs(cashier.visaVariance).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Footer Stats */}
                        <div className="flex justify-between items-center pt-4 border-t border-slate-800 text-xs text-slate-400 font-medium">
                          <div className="flex flex-col items-center gap-1" title="Days Active">
                            <Calendar className="h-4 w-4 text-slate-500" />
                            <span>{cashier.daysActive}d</span>
                          </div>
                          <div className="flex flex-col items-center gap-1" title="Total Shifts">
                            <Briefcase className="h-4 w-4 text-slate-500" />
                            <span>{cashier.shifts}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1" title="Average Revenue per Shift">
                            <Banknote className="h-4 w-4 text-slate-500" />
                            <span>EGP {Math.round(cashier.avgPerShift).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* LEFT COLUMN: LIST */}
            <div className="lg:col-span-1 space-y-4 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">

              {(activeTab === "history") && (
                <div className="sticky top-0 z-10 bg-background pb-2">
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search by Barcode or Cashier Name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-3 pl-10 pr-32 rounded-xl border border-border bg-muted/50 focus:bg-background outline-none focus:ring-2 focus:ring-red-500 text-sm transition-all"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    
                    <button
                      onClick={() => {
                        setShowdownMode(!showdownMode);
                        setShowdownSelection([]);
                        setSelectedReport(null);
                      }}
                      className={`absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${showdownMode ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`}
                    >
                      {showdownMode ? 'Cancel' : 'Compare ⚔️'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "pending" && [...earlyRadars, ...rejectedRadars].length > 0 && (
                <div className="mb-4 space-y-3">
                  {[...earlyRadars, ...rejectedRadars].map((radar, idx) => (
                    <div key={idx} className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-lg relative overflow-hidden flex items-center gap-4">
                      {/* Scanning Radar Animation */}
                      <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden rounded-xl">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent animate-[spin_3s_linear_infinite]" style={{ transformOrigin: 'center' }}></div>
                        <div className="absolute inset-0 rounded-xl border-2 border-emerald-500/20"></div>
                      </div>
                      
                      <div className="relative z-10 flex items-center justify-center h-10 w-10 bg-emerald-500/20 rounded-full border border-emerald-500/50">
                        <div className="h-4 w-4 bg-emerald-500 rounded-full animate-ping"></div>
                        <Clock className="h-5 w-5 text-emerald-400 absolute" />
                      </div>
                      
                      <div className="relative z-10 flex-1">
                        <h4 className="text-white font-bold text-sm tracking-wide">
                          {radar.type === 'early' ? 'Awaiting Early Drop' : 'Awaiting Re-submission'}
                        </h4>
                        <p className="text-emerald-400 text-xs font-medium">
                          {radar.type === 'early' 
                            ? `Waiting for cashier to submit early day report...` 
                            : `Waiting for ${radar.cashierDetails?.name || 'cashier'} to fix rejected shift...`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {reportsList.length === 0 ? (
                <div className="glass-panel p-8 text-center rounded-2xl">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="font-bold text-foreground">{activeTab === "pending" ? "All caught up!" : "No history found."}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reportsList.filter((r: any) => {
                    if (currentBranch === "all") return true;
                    if (r.branchId) return r.branchId === currentBranch;
                    const store = (r.cashierDetails?.storeId || "").toLowerCase();
                    if (currentBranch === "alamein4") return store.includes("alamein") || (!store.includes("alamein") && !store.includes("ola"));
                    if (currentBranch === "ola") return store.includes("ola");
                    return true;
                  }).map((report, idx) => {
                    if (activeTab === "history") {
                      // Apple Wallet / Timeline Style
                      return (
                        <div key={report.id} className="relative pl-6 sm:pl-10">
                          {/* Timeline Line & Dot */}
                          <div className="absolute left-[11px] sm:left-[19px] top-0 bottom-[-16px] w-[2px] bg-slate-200 dark:bg-slate-800" />
                          <div className="absolute left-[7px] sm:left-[15px] top-6 h-[10px] w-[10px] rounded-full bg-slate-400 dark:bg-slate-600 ring-4 ring-background z-10" />
                          
                          <button
                            onClick={() => {
                              if (showdownMode) {
                                if (showdownSelection.find(s => s.id === report.id)) {
                                  setShowdownSelection(showdownSelection.filter(s => s.id !== report.id));
                                } else if (showdownSelection.length < 2) {
                                  setShowdownSelection([...showdownSelection, report]);
                                } else {
                                  toast.error("You can only compare 2 shifts at a time!");
                                }
                              } else {
                                handleSelectReport(report);
                              }
                            }}
                            className={`w-full text-left rounded-2xl transition-all relative overflow-hidden group ${
                              showdownMode && showdownSelection.find(s => s.id === report.id)
                                ? 'scale-[1.02] shadow-[0_0_20px_rgba(239,68,68,0.3)] ring-2 ring-red-500 z-20'
                                : selectedReport?.id === report.id
                                  ? 'scale-[1.02] shadow-2xl z-20'
                                  : 'hover:-translate-y-1 hover:shadow-xl hover:z-20'
                              }`}
                          >
                            {/* Pass Background Gradient */}
                            <div className={`absolute inset-0 opacity-90 ${
                              showdownMode && showdownSelection.find(s => s.id === report.id) 
                                ? 'bg-gradient-to-br from-red-900 to-red-950'
                                : selectedReport?.id === report.id 
                                  ? 'bg-gradient-to-br from-slate-800 to-slate-900' 
                                  : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900'
                              }`} />
                            
                            <div className="relative z-10 p-0 flex flex-col h-full border border-slate-300/50 dark:border-slate-700/50 rounded-2xl overflow-hidden">
                               {/* Pass Header */}
                               <div className={`px-5 py-4 flex justify-between items-center ${
                                  (selectedReport?.id === report.id || (showdownMode && showdownSelection.find(s => s.id === report.id))) 
                                    ? 'bg-black/20 text-white' 
                                    : 'bg-black/5 text-slate-800 dark:text-slate-200'
                                }`}>
                                 <div className="flex flex-col">
                                   <span className="font-black tracking-tight text-lg">{report?.cashierDetails?.name}</span>
                                   <span className="text-xs opacity-80 font-medium">Store: {report?.cashierDetails?.storeId}</span>
                                 </div>
                                 <div className="flex flex-col items-end">
                                   <span className="font-bold text-sm">{report?.cashierDetails?.date}</span>
                                   <span className="text-[10px] font-black uppercase tracking-wider opacity-80">{report?.cashierDetails?.shift} Shift</span>
                                 </div>
                               </div>

                               {/* Pass Body */}
                               <div className={`px-5 py-5 flex justify-between items-center bg-white dark:bg-slate-950`}>
                                 <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Handled</span>
                                    <span className="text-xl font-black text-slate-900 dark:text-white">EGP {report?.cashierCounts?.total?.toLocaleString()}</span>
                                 </div>
                                 {report.managerAudit && (
                                   <div className="flex flex-col items-end">
                                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Variance</span>
                                     <span className={`text-lg font-black ${report.managerAudit.overShort < 0 ? 'text-red-500' : report.managerAudit.overShort > 0 ? 'text-emerald-500' : 'text-slate-500'}`}>
                                        {report.managerAudit.overShort < 0 ? '-' : report.managerAudit.overShort > 0 ? '+' : ''}EGP {Math.abs(report.managerAudit.overShort)}
                                     </span>
                                   </div>
                                 )}
                               </div>

                               {/* Pass Footer / Cutout effect */}
                               <div className={`relative px-5 py-3 flex justify-between items-center border-t border-dashed ${selectedReport?.id === report.id ? 'bg-black/20 text-white border-white/20' : 'bg-black/5 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'}`}>
                                  {/* Left/Right Cutouts to simulate ticket */}
                                  <div className="absolute -left-2 -top-2 w-4 h-4 rounded-full bg-background border-r border-b border-transparent" />
                                  <div className="absolute -right-2 -top-2 w-4 h-4 rounded-full bg-background border-l border-b border-transparent" />

                                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                                    <CheckCircle className="h-3 w-3" /> Approved
                                  </div>
                                  <Barcode value={report.id.substring(0, 8)} width={1} height={20} displayValue={false} background="transparent" lineColor={selectedReport?.id === report.id ? '#fff' : 'currentColor'} margin={0} />
                               </div>
                            </div>
                          </button>
                        </div>
                      );
                    }

                    // Pending Style
                    return (
                      <button
                        key={report.id}
                        onClick={() => { handleSelectReport(report); }}
                        className={`w-full text-left p-4 rounded-xl border transition-all relative overflow-hidden ${selectedReport?.id === report.id
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/20 shadow-md shadow-red-500/10'
                          : 'border-border bg-card hover:border-red-300'
                          }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-foreground text-sm">{report?.cashierDetails?.date}</span>
                          <span className="text-xs font-bold px-2 py-1 bg-red-500/10 rounded-md text-red-500 border border-red-200/20 dark:border-red-950/30">{report?.cashierDetails?.shift}</span>
                        </div>
                        <div className="font-semibold text-lg text-foreground mb-1">
                          {report?.cashierDetails?.name}
                          {report?.isEarlyDay && (
                            <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                              <Clock className="h-3 w-3" /> Early Day
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mb-3">Store: {report?.cashierDetails?.storeId}</div>

                        <div className="flex justify-between items-center pt-3 border-t border-red-100 dark:border-red-900/30">
                          <span className="text-xs font-bold text-muted-foreground uppercase">Declared Total</span>
                          <span className="font-bold text-red-600 dark:text-red-400">EGP {report?.cashierCounts?.total?.toLocaleString()}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: AUDIT WORKSPACE */}
            <div className="lg:col-span-2">
              {showdownMode ? (
                <div className="glass-panel h-full min-h-[500px] flex flex-col rounded-2xl border border-border bg-slate-950 text-white overflow-hidden relative">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
                  
                  <div className="p-8 border-b border-slate-800 bg-black/40 backdrop-blur-xl relative z-10 text-center">
                    <h2 className="text-3xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                      Shift Showdown 🥊
                    </h2>
                    <p className="text-slate-400 mt-2 text-sm font-medium">Select exactly 2 shifts from the history list to generate a comparative analysis.</p>
                  </div>
                  
                  <div className="flex-grow flex flex-col items-center justify-center p-8 relative z-10">
                    {showdownSelection.length < 2 ? (
                      <div className="text-center animate-pulse">
                        <div className="inline-flex items-center justify-center h-24 w-24 rounded-full border-2 border-dashed border-red-500/50 bg-red-500/10 mb-4">
                          <span className="text-4xl font-black text-red-500">{showdownSelection.length}/2</span>
                        </div>
                        <p className="text-slate-500 font-bold uppercase tracking-wider">Awaiting Selection...</p>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center">
                        <div className="flex justify-between w-full max-w-lg mb-8 px-8">
                          <div className="text-center">
                            <span className="inline-block px-3 py-1 bg-red-500 text-white text-[10px] font-black uppercase rounded-full mb-2 border border-red-400">Shift A</span>
                            <h4 className="font-bold text-lg">{showdownSelection[0].cashierDetails.name}</h4>
                            <p className="text-xs text-slate-400">{showdownSelection[0].cashierDetails.date} ({showdownSelection[0].cashierDetails.shift})</p>
                          </div>
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-2xl font-black italic text-slate-700">VS</span>
                          </div>
                          <div className="text-center">
                            <span className="inline-block px-3 py-1 bg-blue-500 text-white text-[10px] font-black uppercase rounded-full mb-2 border border-blue-400">Shift B</span>
                            <h4 className="font-bold text-lg">{showdownSelection[1].cashierDetails.name}</h4>
                            <p className="text-xs text-slate-400">{showdownSelection[1].cashierDetails.date} ({showdownSelection[1].cashierDetails.shift})</p>
                          </div>
                        </div>

                        {/* Radar Chart Generation */}
                        {(() => {
                          const A = showdownSelection[0];
                          const B = showdownSelection[1];
                          const maxVol = Math.max(A.cashierCounts?.total || 1, B.cashierCounts?.total || 1);
                          
                          // Convert to percentages (0-100 score) for the Radar chart
                          const volA = Math.round(((A.cashierCounts?.total || 0) / maxVol) * 100);
                          const volB = Math.round(((B.cashierCounts?.total || 0) / maxVol) * 100);
                          
                          // Accuracy: 100% minus variance penalty (stricter penalty for small amounts to make chart readable)
                          const cashAccA = Math.max(0, 100 - (Math.abs(A.managerAudit?.overShort || 0) / 10));
                          const cashAccB = Math.max(0, 100 - (Math.abs(B.managerAudit?.overShort || 0) / 10));
                          
                          const visaAccA = 100; // Assuming Visa is always exact in this simple example unless we tracked it separately
                          const visaAccB = 100;

                          const data = [
                            { subject: 'Volume', A: volA, B: volB, fullMark: 100 },
                            { subject: 'Cash Acc', A: cashAccA, B: cashAccB, fullMark: 100 },
                            { subject: 'Visa Acc', A: visaAccA, B: visaAccB, fullMark: 100 },
                            { subject: 'Punctuality', A: A.isEarlyDay ? 80 : 100, B: B.isEarlyDay ? 80 : 100, fullMark: 100 },
                            { subject: 'Checklist', A: 100, B: 100, fullMark: 100 }, // Placeholder for future checklist features
                          ];

                          return (
                            <div className="w-full max-w-lg h-[400px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                                  <PolarGrid stroke="#334155" />
                                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} />
                                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                  <Radar name="Shift A" dataKey="A" stroke="#ef4444" fill="#ef4444" fillOpacity={0.5} />
                                  <Radar name="Shift B" dataKey="B" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                                </RadarChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
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
                        <h2 className="text-2xl font-black">
                          {selectedReport?.cashierDetails?.name}
                          {selectedReport?.isEarlyDay && (
                            <span className="ml-2 align-middle inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider border border-indigo-500/30">
                              <Clock className="h-3.5 w-3.5" /> Early Day
                            </span>
                          )}
                        </h2>
                        <p className="text-slate-400 text-sm mt-1 flex flex-wrap items-center gap-2">
                          <span>{selectedReport?.cashierDetails?.date}</span>
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
                            <span>{selectedReport?.cashierDetails?.shift} Shift</span>
                          )}
                          <span className="text-slate-600">•</span>
                          <span>{selectedReport?.cashierDetails?.storeId}</span>
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
                      <div className="text-right flex flex-col items-end">
                        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Declared Total</p>
                        <p className="text-2xl font-black text-green-400">EGP {activeTab === "pending" ? ((Number(cashierOverrideCash) || 0) + (Number(cashierOverrideVisa) || 0)).toLocaleString() : selectedReport?.cashierCounts?.total?.toLocaleString()}</p>
                        {(activeTab === "history" || activeTab === "pending") && (
                          <div className="mt-4 text-right bg-slate-800/90 border border-slate-700 px-3 py-2 rounded-xl shadow-inner min-w-[180px]">
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 border-b border-slate-700 pb-1">Historical Context</p>

                            <div className="flex justify-between items-center text-xs mb-1">
                              <span className="text-slate-400 font-medium mr-3">Cash Avg (5sh):</span>
                              <span className={`font-black ${getCashierCashDelta(selectedReport.cashierDetails?.name) < 0 ? 'text-red-400' : getCashierCashDelta(selectedReport.cashierDetails?.name) > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                                {getCashierCashDelta(selectedReport.cashierDetails?.name) < 0 ? '-' : getCashierCashDelta(selectedReport.cashierDetails?.name) > 0 ? '+' : ''}
                                EGP {Math.abs(getCashierCashDelta(selectedReport.cashierDetails?.name))}
                              </span>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-medium mr-3">Visa Avg (5sh):</span>
                              <span className={`font-black ${getCashierVisaDelta(selectedReport.cashierDetails?.name) < 0 ? 'text-red-400' : getCashierVisaDelta(selectedReport.cashierDetails?.name) > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                                {getCashierVisaDelta(selectedReport.cashierDetails?.name) < 0 ? '-' : getCashierVisaDelta(selectedReport.cashierDetails?.name) > 0 ? '+' : ''}
                                EGP {Math.abs(getCashierVisaDelta(selectedReport.cashierDetails?.name))}
                              </span>
                            </div>
                          </div>
                        )}
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
                              <span className="font-mono font-bold">EGP {selectedReport?.cashierCounts?.cash?.toLocaleString()}</span>
                            )}
                          </div>
                          <div className="flex justify-between items-center gap-2 p-2 bg-card rounded border border-border">
                            <span className="text-sm font-semibold">Visa</span>
                            {activeTab === "pending" ? (
                              <input type="number" value={cashierOverrideVisa} onChange={e => setCashierOverrideVisa(e.target.value)} className="w-28 p-1 text-right font-mono border border-border bg-background rounded outline-none focus:ring-1 focus:ring-blue-500 text-sm" placeholder="Override" />
                            ) : (
                              <span className="font-mono font-bold">EGP {selectedReport?.cashierCounts?.visa?.toLocaleString()}</span>
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
                                <th className="p-3 text-right">End Count</th>
                                <th className="p-3 font-bold text-right">Calculated Sold</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card">
                              {/* Backward compatibility for old reports */}
                              {selectedReport.inventoryCounts?.cigarettes && (
                                <tr>
                                  <td className="p-3 font-bold">Cigarettes (Old Format)</td>
                                  <td className="p-3">{selectedReport.inventoryCounts?.cigarettes?.start || 0}</td>
                                  <td className="p-3">{selectedReport.inventoryCounts?.cigarettes?.delivery || 0}</td>
                                  <td className="p-3 text-right">{selectedReport.inventoryCounts?.cigarettes?.end || 0}</td>
                                  <td className="p-3 font-bold text-right bg-amber-50 text-amber-900">{selectedReport.inventoryCounts?.cigarettes?.sold || 0}</td>
                                </tr>
                              )}

                              {/* New format: Detailed cigarette counts */}
                              {selectedReport.inventoryCounts?.cigaretteCounts && Object.entries(selectedReport.inventoryCounts.cigaretteCounts).map(([type, count]) => {
                                const isObj = typeof count === 'object' && count !== null;
                                const start = isObj ? (count as any).start || "0" : "-";
                                const delivery = isObj ? (count as any).delivery || "0" : "-";
                                const end = isObj ? (count as any).end || "0" : String(count || "0");
                                const s = Number(start) || 0;
                                const d = Number(delivery) || 0;
                                const e = Number(end) || 0;
                                const sold = isObj ? String(s + d - e) : "-";

                                return (
                                  <tr key={type} className="bg-orange-50/20">
                                    <td className="p-3 font-medium text-xs sm:text-sm pl-6 border-l-4 border-orange-400">{type}</td>
                                    <td className="p-3">{start}</td>
                                    <td className="p-3">{delivery}</td>
                                    <td className="p-3 text-right font-bold">{end}</td>
                                    <td className="p-3 text-right font-bold bg-amber-50 text-amber-900">{sold}</td>
                                  </tr>
                                );
                              })}

                              <tr>
                                <td className="p-3 font-bold">Lighters (ولاعات)</td>
                                <td className="p-3">{selectedReport.inventoryCounts?.lighters?.start || 0}</td>
                                <td className="p-3">{selectedReport.inventoryCounts?.lighters?.delivery || 0}</td>
                                <td className="p-3 text-right">{selectedReport.inventoryCounts?.lighters?.end || 0}</td>
                                <td className="p-3 font-bold text-right bg-amber-50 text-amber-900">{selectedReport.inventoryCounts?.lighters?.sold || 0}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}

                    {/* Shrink & Variance Tracking (For Both Cashiers) */}
                    <section>
                      <div className="flex items-center gap-2 mb-4">
                        <Package className="h-5 w-5 text-amber-500" />
                        <h3 className="text-lg font-bold">Shrink & Audit Data</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/30">
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Coffee Shrink %</label>
                          <input type="number" step="0.01" value={coffeePercent} onChange={e => setCoffeePercent(e.target.value)} className="w-full p-2.5 rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-amber-500" placeholder="e.g. 2.5" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Cigarette Shrink %</label>
                          <input type="number" step="0.01" value={cigarettePercent} onChange={e => setCigarettePercent(e.target.value)} className="w-full p-2.5 rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-amber-500" placeholder="e.g. 1.2" />
                        </div>
                      </div>
                    </section>

                    {/* 3. Final Sign Off */}
                    <section className="mt-8">
                      <div className="flex items-center gap-2 mb-4">
                        <Lock className="h-5 w-5 text-slate-500" />
                        <h3 className="text-lg font-bold">Manager Audit Notes</h3>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Auditing Manager Name</label>
                          <input type="text" value={managerName} onChange={e => setManagerName(e.target.value)} className="w-full p-3 rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-slate-500" placeholder="Enter your full name" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-muted-foreground uppercase">Manager Signature *</label>
                            {(managerSignature || hasSigned) && (
                              <button type="button" onClick={() => { sigPadRef.current?.clear(); setHasSigned(false); setManagerSignature(""); }} className="text-xs text-red-500 font-bold uppercase hover:underline">
                                Clear Signature
                              </button>
                            )}
                          </div>
                          <div className="border-2 border-dashed border-border rounded-lg bg-background overflow-hidden relative" style={{ height: "150px" }}>
                            {managerSignature && !hasSigned ? (
                              <img src={managerSignature} alt="Saved Signature" className="w-full h-full object-contain p-2" />
                            ) : (
                              <SignaturePad 
                                // @ts-expect-error: dynamic import ref typing mismatch
                                ref={sigPadRef} 
                                canvasProps={{ className: "w-full h-full" }} 
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
                        {selectedReport.cashierWriteUp && (
                          <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                            <label className="block text-[10px] font-bold text-purple-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> Cashier's Investigation Write-Up
                            </label>
                            <p className="text-purple-900 text-sm font-medium whitespace-pre-wrap">"{selectedReport.cashierWriteUp}"</p>
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <button
                              onClick={triggerReject}
                              disabled={submitting}
                              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm transition-all"
                            >
                              {submitting ? "Rejecting..." : "Reject Report"}
                            </button>
                            <button
                              onClick={triggerDispute}
                              disabled={submitting}
                              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
                            >
                              <ShieldAlert className="w-5 h-5" /> Flag for Investigation
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
                            onClick={triggerDelete}
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
                          <button
                            type="button"
                            onClick={triggerDelete}
                            disabled={submitting}
                            className="w-full py-3 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" /> Permanently Delete Report
                          </button>
                        </>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- HIDDEN FORMAL A4 PRINT TEMPLATE FOR MANAGER --- */}
        {selectedReport && (() => {
          const cashVar = calculateCashVariance();
          const visaVar = calculateVisaVariance();

          let shiftGrade = "F";
          let gradeBg = "#fef2f2";
          let gradeBorder = "#ef4444";
          let gradeText = "#dc2626";

          const generateEgyptianSummary = () => {
            const totalSales = (Number(expectedCash) || 0) + (Number(expectedVisa) || 0);
            const name = selectedReport?.cashierDetails?.name?.split(' ')[0] || "الكاشير";

            let visaStr = "";
            if (visaVar === 0) {
              visaStr = "حسابات الفيزا متقفلة مظبوط بالقرش";
            } else if (visaVar > 0) {
              visaStr = `في زيادة في الفيزا بقيمة ${Math.abs(visaVar)} جنيه`;
            } else {
              visaStr = `عنده عجز في الفيزا بقيمة ${Math.abs(visaVar)} جنيه`;
            }

            let cashStr = "";
            if (cashVar === 0) {
              cashStr = "والنقدية سليمة 100% بدون أي عجز أو زيادة";
            } else if (cashVar > 0 && cashVar <= 100) {
              cashStr = `ومعاه زيادة بسيطة في النقدية بقيمة ${Math.abs(cashVar)} جنيه`;
            } else if (cashVar > 100) {
              cashStr = `بس عنده زيادة ملحوظة في النقدية بقيمة ${Math.abs(cashVar)} جنيه`;
            } else if (cashVar < 0 && cashVar >= -50) {
              cashStr = `ومعاه عجز بسيط في النقدية بقيمة ${Math.abs(cashVar)} جنيه`;
            } else {
              cashStr = `وللأسف عنده عجز كبير في النقدية بقيمة ${Math.abs(cashVar)} جنيه محتاج مراجعة فورية`;
            }

            return `ملخص النظام: ${name} قفل ورديته بمبيعات إجمالية ${totalSales.toLocaleString()} جنيه. ${visaStr}، ${cashStr}.`;
          };

          const generateVolumeContext = () => {
            const totalSales = (Number(expectedCash) || 0) + (Number(expectedVisa) || 0);
            const isBusy = totalSales > 15000;
            const isGoodGrade = shiftGrade === "A+" || shiftGrade === "B";

            if (isBusy && isGoodGrade) {
              return "تحليل المبيعات: الوردية دي كانت زحمة ومبيعاتها معدية ١٥ ألف، وبسم الله ما شاء الله الكاشير كان مركز ومقفل حساباته صح.";
            } else if (isBusy && !isGoodGrade) {
              return "تحليل المبيعات: الوردية كانت زحمة جداً (أكتر من ١٥ ألف)، فممكن اللخبطة دي بسبب ضغط الشغل، بس برضه المراجعة مطلوبة.";
            } else if (!isBusy && !isGoodGrade) {
              return "تحليل المبيعات: الوردية كانت هادية ومفيش ضغط، ومع ذلك في لخبطة أو عجز! الموضوع ده غريب ومحتاج تراجع وراه كويس.";
            } else {
              return "تحليل المبيعات: الوردية كانت هادية وطبيعية، والكاشير قفل حساباته مظبوط.";
            }
          };

          if (visaVar !== 0 || cashVar > 500 || cashVar < -500) {
            shiftGrade = "F";
            gradeBg = "#fef2f2";
            gradeBorder = "#ef4444";
            gradeText = "#dc2626";
          } else if (cashVar === 0) {
            shiftGrade = "A+";
            gradeBg = "#f0fdf4";
            gradeBorder = "#22c55e";
            gradeText = "#16a34a";
          } else if (cashVar > 0 && cashVar <= 100) {
            shiftGrade = "B";
            gradeBg = "#fefce8";
            gradeBorder = "#eab308";
            gradeText = "#ca8a04";
          } else if (cashVar >= -50 && cashVar < 0) {
            shiftGrade = "C";
            gradeBg = "#fff7ed";
            gradeBorder = "#f97316";
            gradeText = "#ea580c";
          } else {
            shiftGrade = "D";
            gradeBg = "#fff1f2";
            gradeBorder = "#e11d48";
            gradeText = "#be123c";
          }

          const securityBorders = (
            <>
              {/* Background Watermark Logo */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 0, opacity: 0.04, pointerEvents: 'none' }}>
                <img src="/icons8-circled-k-50.png" alt="Watermark" style={{ width: '500px', filter: 'grayscale(100%)', opacity: 0.1 }} />
              </div>
              
              {/* Micro-Typography Security Borders */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px', overflow: 'hidden' }}>
                <div style={{ fontSize: '6px', color: '#000000', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.3 }}>
                  {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                </div>
                <div style={{ fontSize: '6px', color: '#000000', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.3 }}>
                  {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                </div>
              </div>
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', padding: '4px', overflow: 'hidden', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                <div style={{ fontSize: '6px', color: '#000000', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.3 }}>
                  {Array(35).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                </div>
              </div>
              <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', padding: '4px', overflow: 'hidden', writingMode: 'vertical-rl' }}>
                <div style={{ fontSize: '6px', color: '#000000', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.3 }}>
                  {Array(35).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                </div>
              </div>
            </>
          );

          const renderHeader = (title: string) => (
            <div style={{ padding: '20px 30px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '50px', height: '50px', border: '2px solid #000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '30px', fontWeight: 'bold', color: '#000', lineHeight: 1 }}>K</span>
                </div>
                <div>
                  <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>CIRCLE K EL-ALAMEIN 4</h1>
                  <p style={{ fontSize: '12px', color: '#333', margin: '2px 0 0', fontWeight: 'bold' }}>{title}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid #000`, borderRadius: '8px', padding: '6px 10px', minWidth: '60px' }}>
                  <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>Grade</p>
                  <p style={{ margin: 0, fontSize: '26px', fontWeight: 'bold', color: '#000', lineHeight: 1 }}>{shiftGrade}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                  <Barcode value={selectedReport.id.substring(0, 10).toUpperCase()} width={1.2} height={30} fontSize={9} displayValue={true} margin={0} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                  {typeof window !== 'undefined' && (
                    <QRCode value={window.location.origin + '/shift-reports/view?id=' + selectedReport.id} size={45} level="M" />
                  )}
                </div>
              </div>
            </div>
          );

          const signatures = (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', padding: '10px 15px', backgroundColor: '#fff', border: '2px solid #000', borderRadius: '8px' }}>
              <div style={{ width: '30%', display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '8px', color: '#333', fontStyle: 'italic', marginBottom: '8px', lineHeight: 1.3, flexGrow: 1, fontWeight: 'bold' }}>
                  I, the undersigned cashier, declare that the physical counts provided above are accurate, and I have surrendered the declared funds to the manager.
                </p>
                <div style={{ position: 'relative', height: '45px', display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid #000', marginBottom: '6px' }}>
                  {selectedReport.cashierSignature ? (
                    <img src={selectedReport.cashierSignature} alt="Signature" style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', maxHeight: '50px', maxWidth: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ position: 'absolute', bottom: '6px', left: '0', width: '100%', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#333', letterSpacing: '2px', textTransform: 'uppercase' }}>
                      [ NO SIGNATURE ]
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase' }}>{selectedReport.cashierDetails.name}</p>
                <p style={{ fontSize: '8px', fontWeight: 'bold', color: '#666', margin: '2px 0 0', textTransform: 'uppercase' }}>Declaring Cashier</p>
              </div>

              <div style={{ width: '30%', display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '8px', color: '#333', fontStyle: 'italic', marginBottom: '8px', lineHeight: 1.3, flexGrow: 1, fontWeight: 'bold' }}>
                  I, the undersigned manager, declare that I have physically counted the funds and verified the variances against the system expectations.
                </p>
                <div style={{ position: 'relative', height: '45px', display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid #000', marginBottom: '6px' }}>
                  {(managerSignature || selectedReport.managerAudit?.signature) ? (
                    <img src={managerSignature || selectedReport.managerAudit?.signature} alt="Signature" style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', maxHeight: '50px', maxWidth: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ position: 'absolute', bottom: '6px', left: '0', width: '100%', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#333', letterSpacing: '2px', textTransform: 'uppercase' }}>
                      [ PENDING REVIEW ]
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase' }}>{managerName || selectedReport.managerAudit?.managerName || "Pending"}</p>
                <p style={{ fontSize: '8px', fontWeight: 'bold', color: '#666', margin: '2px 0 0', textTransform: 'uppercase' }}>Auditing Manager</p>
              </div>

              <div style={{ width: '25%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                  <div style={{ 
                    border: '3px solid #000080', 
                    borderRadius: '4px', 
                    padding: '8px 12px', 
                    transform: 'rotate(-2deg)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontFamily: '"Arial Black", Impact, "Arial Rounded MT Bold", sans-serif',
                    opacity: 0.85,
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,128,0.2), 0 0 0 1px rgba(0,0,128,0.2)'
                  }}>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: '#000080', letterSpacing: '1px', lineHeight: 1.2 }}>Circle k</span>
                    <span style={{ fontSize: '15px', fontWeight: '900', color: '#000080', letterSpacing: '0.5px', lineHeight: 1.2 }}>El Alamein 4</span>
                  </div>
                </div>
              </div>
            </div>
          );

          const renderFooter = (pageNumber: string) => (
            <div style={{ marginTop: 'auto', marginBottom: '20px', marginLeft: '30px', marginRight: '30px', borderTop: '2px solid #000', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
              <p style={{ fontSize: '8px', color: '#333', fontFamily: 'monospace', margin: 0, letterSpacing: '0.5px', fontWeight: 'bold' }}>
                DOCUMENT SHIFT-{selectedReport.id.substring(0, 10).toUpperCase()} | PRINTED: {formatTimeMinus2Hours(new Date().toISOString())} | AUTHORIZED: MGR_{managerName.replace(/\s+/g, '_').toUpperCase() || "PENDING"}
              </p>
              <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#000' }}>{pageNumber}</p>
            </div>
          );

          const renderVarianceBadge = (variance: number) => {
            if (variance === 0) return <div style={{ fontWeight: '900', fontSize: '13px', letterSpacing: '0.5px' }}>✓ BALANCED</div>;
            if (variance < 0) return <div style={{ fontWeight: '900', fontSize: '13px', letterSpacing: '0.5px' }}>▼ SHORT: {variance}</div>;
            return <div style={{ fontWeight: '900', fontSize: '13px', letterSpacing: '0.5px' }}>▲ OVER: +{variance}</div>;
          };

          return (
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
              {/* PAGE 1: FINANCIAL AUDIT */}
              <div id="pdf-page-1" style={{ width: '794px', height: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>
                {securityBorders}
                {renderHeader(selectedReport.cashierRole === 2 ? "SHIFT REPORT" : "SHIFT REPORT (FINANCIALS)")}

                <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 10 }}>
                  {/* Left Column (Details) */}
                  <div style={{ flex: 1, padding: '10px 15px 10px 30px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ backgroundColor: '#fff', border: '1px solid #000', borderRight: '4px solid #000', borderRadius: '6px', padding: '6px 10px', direction: 'rtl', textAlign: 'right', marginBottom: '15px' }}>
                      <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#000', lineHeight: 1.4, fontWeight: 'bold' }}><span style={{ color: '#000', marginLeft: '6px' }}>■</span>{generateEgyptianSummary()}</p>
                      <p style={{ margin: 0, fontSize: '10px', color: '#000', lineHeight: 1.4, fontWeight: 'bold' }}><span style={{ color: '#000', marginLeft: '6px' }}>■</span>{generateVolumeContext()}</p>
                    </div>

                    <div style={{ border: '2px solid #000', borderRadius: '6px', padding: '8px 15px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: '0 0 2px', fontSize: '9px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expected System Cash</p>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#000' }}>EGP {Number(expectedCash).toLocaleString()}</p>
                      </div>
                      <div style={{ width: '1px', backgroundColor: '#000', alignSelf: 'stretch' }}></div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: '0 0 2px', fontSize: '9px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actual Cashier Cash</p>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#000' }}>EGP {selectedReport?.cashierCounts?.cash?.toLocaleString()}</p>
                      </div>
                      <div style={{ width: '1px', backgroundColor: '#000', alignSelf: 'stretch' }}></div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: '0 0 2px', fontSize: '9px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total System Visa</p>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#000' }}>EGP {Number(expectedVisa).toLocaleString()}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', border: '2px solid #000', color: '#000', padding: '6px 20px', borderRadius: '6px', marginBottom: '15px' }}>
                      <p style={{ margin: '0 0 2px', fontSize: '9px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Net Sales (Sys)</p>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>EGP {(Number(expectedCash) + Number(expectedVisa)).toLocaleString()}</p>
                    </div>

                    <div style={{ border: '2px solid #000', marginBottom: '15px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: '#f9f9f9', padding: '4px 15px', borderBottom: '1px solid #000', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        1. Shift & Branch Information
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '4px' }}>
                          <div><p style={{ margin: '0 0 2px', color: '#666', fontSize: '9px' }}>Audited By</p><p style={{ margin: 0, fontWeight: 'bold', fontSize: '11px', color: '#000' }}>{managerName || "Pending"}</p></div>
                          <div><p style={{ margin: '0 0 2px', color: '#666', fontSize: '9px' }}>Date Audited</p><p style={{ margin: 0, fontWeight: 'bold', fontSize: '11px', color: '#000' }}>{formatTimeMinus2Hours(selectedReport.managerAudit?.auditedAt || new Date().toISOString())}</p></div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                        <div style={{ padding: '6px 15px', borderRight: '1px dotted #ccc', borderBottom: '1px dotted #ccc' }}><p style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', margin: '0 0 2px' }}>Store ID</p><p style={{ fontSize: '11px', color: '#000', fontWeight: 'bold', margin: 0 }}>{selectedReport?.cashierDetails?.storeId}</p></div>
                        <div style={{ padding: '6px 15px', borderBottom: '1px dotted #ccc' }}><p style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', margin: '0 0 2px' }}>Shift Period</p><p style={{ fontSize: '11px', color: '#000', fontWeight: 'bold', margin: 0 }}>{selectedReport?.cashierDetails?.shift} Shift</p></div>
                        <div style={{ padding: '6px 15px', borderRight: '1px dotted #ccc', borderBottom: '1px dotted #ccc' }}><p style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', margin: '0 0 2px' }}>Cashier Name</p><p style={{ fontSize: '11px', color: '#000', fontWeight: 'bold', margin: 0 }}>{selectedReport?.cashierDetails?.name}</p></div>
                        <div style={{ padding: '6px 15px', borderBottom: '1px dotted #ccc' }}><p style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', margin: '0 0 2px' }}>Operating Date</p><p style={{ fontSize: '11px', color: '#000', fontWeight: 'bold', margin: 0 }}>{selectedReport?.cashierDetails?.date}</p></div>
                        <div style={{ padding: '6px 15px', borderRight: '1px dotted #ccc' }}><p style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', margin: '0 0 2px' }}>Cashier Role</p><p style={{ fontSize: '11px', color: '#000', fontWeight: 'bold', margin: 0 }}>{selectedReport.cashierRole === 2 ? 'Cashier 2 (Money Only)' : 'Cashier 1 (Full)'}</p></div>
                        <div style={{ padding: '6px 15px' }}><p style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', margin: '0 0 2px' }}>Timestamp</p><p style={{ fontSize: '11px', color: '#000', fontWeight: 'bold', margin: 0 }}>{formatTimeMinus2Hours(selectedReport.createdAt)}</p></div>
                      </div>
                    </div>

                    <div style={{ border: '2px solid #000', marginBottom: '15px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: '#f9f9f9', padding: '4px 15px', borderBottom: '1px solid #000', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>2. Financial Audit & Variance</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                        <thead style={{ backgroundColor: '#fff', borderBottom: '1px solid #000' }}>
                          <tr><th style={{ padding: '6px 15px', fontWeight: 'bold' }}>Tender Type</th><th style={{ padding: '6px 15px', fontWeight: 'bold' }}>Declared</th><th style={{ padding: '6px 15px', fontWeight: 'bold' }}>Expected</th><th style={{ padding: '6px 15px', textAlign: 'right', fontWeight: 'bold' }}>Variance Status</th></tr>
                        </thead>
                        <tbody>
                          <tr style={{ backgroundColor: '#fff' }}>
                            <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', fontWeight: 'bold', fontSize: '12px' }}>Cash</td>
                            <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {selectedReport?.cashierCounts?.cash?.toLocaleString()}</td>
                            <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(expectedCash).toLocaleString() || "0"}</td>
                            <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', textAlign: 'right' }}>{renderVarianceBadge(calculateCashVariance())}</td>
                          </tr>
                          <tr style={{ backgroundColor: '#fff' }}>
                            <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', fontWeight: 'bold', fontSize: '12px' }}>Visa</td>
                            <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {selectedReport?.cashierCounts?.visa?.toLocaleString()}</td>
                            <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(expectedVisa).toLocaleString() || "0"}</td>
                            <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', textAlign: 'right' }}>{renderVarianceBadge(calculateVisaVariance())}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Manager Notes & Shrink on Page 1 */}
                    <div style={{ border: '2px solid #000', marginBottom: '15px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: '#f9f9f9', padding: '4px 15px', borderBottom: '1px solid #000', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>3. Manager Comments & Shrink</span>
                      </div>
                      <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                        <div style={{ flex: 1, padding: '6px 15px', borderRight: '1px solid #000', backgroundColor: '#fff' }}>
                          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Coffee Shrink %</span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>{selectedReport.managerAudit?.coffeePercent || coffeePercent || 0}%</span>
                        </div>
                        <div style={{ flex: 1, padding: '6px 15px', backgroundColor: '#fff' }}>
                          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Cigarette Shrink %</span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>{selectedReport.managerAudit?.cigarettePercent || cigarettePercent || 0}%</span>
                        </div>
                      </div>
                      <div style={{ padding: '6px 15px', fontSize: '11px', color: '#000', fontStyle: selectedReport.managerAudit?.comments ? 'normal' : 'italic', backgroundColor: '#fff' }}>
                        {selectedReport.managerAudit?.rejectReason && (
                          <div style={{ marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px dotted #ccc' }}>
                            <p style={{ margin: '0 0 2px', fontSize: '9px', fontWeight: 'bold', color: '#000', textTransform: 'uppercase' }}>Previous Rejection Reason (Corrected by Cashier)</p>
                            <p style={{ margin: 0, fontStyle: 'italic', color: '#000', fontWeight: 'bold' }}>"{selectedReport.managerAudit.rejectReason}"</p>
                          </div>
                        )}
                        <div style={{ fontStyle: selectedReport.managerAudit?.comments || comments ? 'normal' : 'italic' }}>
                          {selectedReport.managerAudit?.comments || comments || "No additional comments provided."}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '30px' }}>
                      {signatures}
                    </div>
                  </div>

                  {/* Right Column (Z-Report Stapler Box - 80mm = ~302px) */}
                  <div style={{ width: '302px', borderLeft: '2px dashed #000', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '10px', left: '-12px', fontSize: '24px', backgroundColor: '#fff' }}>✂</div>
                    <div style={{ position: 'absolute', bottom: '10px', left: '-12px', fontSize: '24px', backgroundColor: '#fff' }}>✂</div>
                    <div style={{ transform: 'rotate(-90deg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', letterSpacing: '1px' }}>AFFIX Z-REPORT TAPE HERE</span>
                      <span style={{ fontSize: '12px', color: '#333' }}>(عرض 80 مم - قم بتدبيس تقرير Z هنا)</span>
                    </div>
                  </div>
                </div>
                {renderFooter(selectedReport.cashierRole === 2 ? "PAGE 1 OF 1" : "PAGE 1 OF 2")}
              </div>

              {/* PAGE 2: INVENTORY AUDIT (Only for Cashier 1) */}
              {selectedReport.cashierRole !== 2 && (
                <div id="pdf-page-2" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', marginTop: '20px' }}>
                  {securityBorders}
                  {renderHeader("SHIFT REPORT (INVENTORY)")}
                  
                  <div style={{ padding: '10px 30px', position: 'relative', zIndex: 10, display: 'flex', flex: 1, flexDirection: 'column' }}>
                    {(() => {
                      let totalCigarettesSold = 0;
                      if (selectedReport.inventoryCounts?.cigaretteCounts) {
                        Object.values(selectedReport.inventoryCounts.cigaretteCounts).forEach((count: any) => {
                          if (typeof count === 'object' && count !== null) {
                            const s = Number(count.start) || 0;
                            const d = Number(count.delivery) || 0;
                            const e = Number(count.end) || 0;
                            totalCigarettesSold += (s + d - e);
                          }
                        });
                      }
                      const totalLightersSold = Number(selectedReport.inventoryCounts?.lighters?.sold) || 0;
                      const totalUnits = totalCigarettesSold + totalLightersSold;
                      
                      return (
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                          <div style={{ flex: 1, backgroundColor: '#fff', border: '2px solid #000', borderRadius: '6px', padding: '8px 12px' }}>
                            <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Cigarettes Sold</p>
                            <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#000' }}>{totalCigarettesSold} <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#666' }}>Packs</span></p>
                          </div>
                          <div style={{ flex: 1, backgroundColor: '#fff', border: '2px solid #000', borderRadius: '6px', padding: '8px 12px' }}>
                            <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Lighters Sold</p>
                            <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#000' }}>{totalLightersSold} <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#666' }}>Units</span></p>
                          </div>
                          <div style={{ flex: 1, backgroundColor: '#f9f9f9', border: '2px solid #000', borderRadius: '6px', padding: '8px 12px' }}>
                            <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Units Moved</p>
                            <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#000' }}>{totalUnits} <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#666' }}>Total</span></p>
                          </div>
                        </div>
                      );
                    })()}

                    <div style={{ border: '2px solid #000', marginBottom: '15px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: '#f9f9f9', padding: '4px 15px', borderBottom: '1px solid #000', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        3. Detailed Inventory Breakdown
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '10px' }}>
                        <thead style={{ backgroundColor: '#fff', borderBottom: '1px solid #000' }}>
                          <tr>
                            <th style={{ padding: '4px 15px', fontWeight: 'bold', color: '#000' }}>Item</th>
                            <th style={{ padding: '4px 15px', fontWeight: 'bold', color: '#000' }}>Start</th>
                            <th style={{ padding: '4px 15px', fontWeight: 'bold', color: '#000' }}>Delivery</th>
                            <th style={{ padding: '4px 15px', fontWeight: 'bold', color: '#000' }}>End</th>
                            <th style={{ padding: '4px 15px', fontWeight: 'bold', color: '#000', textAlign: 'right' }}>Calculated Sold</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReport.inventoryCounts?.cigarettes && (
                            <tr style={{ backgroundColor: '#f9f9f9' }}>
                              <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc', fontWeight: 'bold' }}>Cigarettes</td>
                              <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc' }}>{selectedReport.inventoryCounts?.cigarettes?.start || 0}</td>
                              <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc' }}>{selectedReport.inventoryCounts?.cigarettes?.delivery || 0}</td>
                              <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc' }}>{selectedReport.inventoryCounts?.cigarettes?.end || 0}</td>
                              <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc', textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>{selectedReport.inventoryCounts?.cigarettes?.sold || 0}</td>
                            </tr>
                          )}
                          {selectedReport.inventoryCounts?.cigaretteCounts && Object.entries(selectedReport.inventoryCounts.cigaretteCounts).map(([type, count], index) => {
                            const isObj = typeof count === 'object' && count !== null;
                            const start = isObj ? (count as any).start || "0" : "-";
                            const delivery = isObj ? (count as any).delivery || "0" : "-";
                            const end = isObj ? (count as any).end || "0" : String(count || "0");
                            const s = Number(start) || 0;
                            const d = Number(delivery) || 0;
                            const e = Number(end) || 0;
                            const sold = isObj ? String(s + d - e) : "-";
                            return (
                              <tr key={type} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                                <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc', fontWeight: 'bold', fontSize: '9px' }}>{type}</td>
                                <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc' }}>{start}</td>
                                <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc' }}>{delivery}</td>
                                <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc', fontWeight: 'bold' }}>{end}</td>
                                <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc', textAlign: 'right', fontWeight: 'bold', fontSize: '11px' }}>{sold}</td>
                              </tr>
                            );
                          })}
                          <tr style={{ backgroundColor: '#fff' }}>
                            <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc', fontWeight: 'bold' }}>Lighters</td>
                            <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc' }}>{selectedReport.inventoryCounts?.lighters?.start || 0}</td>
                            <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc' }}>{selectedReport.inventoryCounts?.lighters?.delivery || 0}</td>
                            <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc' }}>{selectedReport.inventoryCounts?.lighters?.end || 0}</td>
                            <td style={{ padding: '4px 15px', borderBottom: '1px dotted #ccc', textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>{selectedReport.inventoryCounts?.lighters?.sold || 0}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ display: 'flex', backgroundColor: '#f9f9f9', borderTop: '2px solid #000' }}>
                        <div style={{ padding: '6px 15px', flex: 1, borderRight: '1px solid #ccc' }}>
                          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginRight: '10px' }}>Coffee Shrink</span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>{selectedReport.managerAudit?.coffeePercent || coffeePercent || 0}%</span>
                        </div>
                        <div style={{ padding: '6px 15px', flex: 1 }}>
                          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginRight: '10px' }}>Cigarette Shrink</span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>{selectedReport.managerAudit?.cigarettePercent || cigarettePercent || 0}%</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '30px' }}>
                      {signatures}
                    </div>
                  </div>
                  {renderFooter("PAGE 2 OF 2")}
                </div>
              )}
            </div>
          );
        })()}

        {/* Reject Modal */}
        {rejectModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Reject Shift Report</h3>
              <textarea
                className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-3 text-slate-800 dark:text-white outline-none focus:border-red-500 mb-4 min-h-[100px]"
                placeholder="Enter reason for rejection (this will be shown to the cashier)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReject}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dispute Modal */}
        {disputeModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border-2 border-purple-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full text-purple-600">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Flag for Investigation</h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-medium">
                This will lock the report and require the cashier to write a formal explanation (Write-Up) and sign it before the shift can be closed.
              </p>
              <textarea
                className="w-full border-2 border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-900/10 rounded-lg p-3 text-slate-800 dark:text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 mb-4 min-h-[100px] font-medium"
                placeholder="Detail the issue (e.g. Major cash shortage of EGP 500, missing stock, etc.)"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDisputeModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDispute}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md"
                >
                  Flag Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {deleteModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-red-500/20">
              <h3 className="text-lg font-bold text-red-600 mb-2">CRITICAL WARNING</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                You are about to permanently delete this shift report. This action cannot be undone and will erase all data associated with this shift.
              </p>
              <input
                type="password"
                className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg p-3 text-slate-800 dark:text-white outline-none focus:border-red-500 mb-4 text-center font-bold tracking-[0.5em]"
                placeholder="Enter 4-digit Manager PIN"
                value={deletePin}
                onChange={(e) => setDeletePin(e.target.value)}
                maxLength={4}
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg"
                >
                  Permanently Delete
                </button>
              </div>
            </div>
          </div>
        )}
        {/* EARLY DAY MODAL */}
        {earlyDayModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border">
              <div className="p-6">
                <h3 className="text-xl font-black text-foreground mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-500" /> Request Early Day Drop
                </h3>
                <p className="text-sm text-muted-foreground mb-6">Select a cashier to force an early day report fill on their next login or refresh.</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Select Cashier</label>
                    <select
                      value={selectedCashierForEarlyDay}
                      onChange={(e) => setSelectedCashierForEarlyDay(e.target.value)}
                      className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    >
                      <option value="">-- Choose a Cashier --</option>
                      {cashiersList.filter((c: any) => {
                        if (currentBranch === "all") return true;
                        if (c.branchId) return c.branchId === currentBranch;

                        const store = (c.storeId || "").toLowerCase();
                        if (currentBranch === "alamein4") return store.includes("alamein") || (!store.includes("alamein") && !store.includes("ola"));
                        if (currentBranch === "ola") return store.includes("ola");
                        return true;
                      }).map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name} - Store {c.storeId}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Target Date</label>
                      <input
                        type="date"
                        value={earlyDayTargetDate}
                        onChange={(e) => setEarlyDayTargetDate(e.target.value)}
                        className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Target Shift</label>
                      <select
                        value={earlyDayTargetShift}
                        onChange={(e) => setEarlyDayTargetShift(e.target.value)}
                        className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      >
                        <option value="Morning">Morning</option>
                        <option value="Evening">Evening</option>
                        <option value="Night">Night</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                  <button
                    onClick={() => setEarlyDayModalOpen(false)}
                    className="px-4 py-2 rounded-lg font-bold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestEarlyDay}
                    disabled={requestingEarlyDay || !selectedCashierForEarlyDay}
                    className="px-6 py-2 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {requestingEarlyDay ? "Sending..." : "Send Request"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
