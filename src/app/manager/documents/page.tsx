"use client";

import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  FileText, 
  Printer, 
  Search, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Receipt, 
  CreditCard, 
  X, 
  Sparkles, 
  Building, 
  User, 
  ExternalLink,
  ShieldCheck,
  Eye,
  Layers,
  FileCheck2,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { PageTransition } from "@/components/PageTransition";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { playPopSound, playPrinterSound } from "@/lib/sounds";

const numberToEnglishWords = (num: number): string => {
  if (!num || num === 0) return "zero Egyptian pounds";
  const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const inWords = (n: number): string => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? '-' + a[n % 10] : ' ');
      if (n < 1000) return a[Math.floor(n / 100)] + 'hundred ' + (n % 100 ? 'and ' + inWords(n % 100) : '');
      if (n < 1000000) return inWords(Math.floor(n / 1000)) + 'thousand ' + (n % 1000 ? inWords(n % 1000) : '');
      if (n < 1000000000) return inWords(Math.floor(n / 1000000)) + 'million ' + (n % 1000000 ? inWords(n % 1000000) : '');
      return '';
  };
  return inWords(Math.floor(num)).trim() + " Egyptian pounds";
};

export default function ManagerDocumentsPage() {
  const { currentBranch } = useBranch();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "payslip" | "payment_receipt" | "credit_receipt" | "custom">("all");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const role = userDoc.data()?.role;
            setIsAdmin(Boolean(role === "admin_editor" || role === "owner" || role === "admin" || user.email?.includes("admin")));
          } else {
            setIsAdmin(Boolean(user.email?.includes("admin")));
          }
        } catch {
          setIsAdmin(Boolean(user.email?.includes("admin")));
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "admin_dispatches"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDispatches(docs);
      setLoading(false);
    }, (err) => {
      console.error("Firestore dispatches listener error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenDoc = async (docData: any) => {
    triggerHapticFeedback(10);
    playPopSound();
    setSelectedDoc(docData);

    if (docData.status === "unread") {
      try {
        await updateDoc(doc(db, "admin_dispatches", docData.id), { status: "read" });
      } catch (err) {
        console.debug("Error updating status:", err);
      }
    }
  };

  const handleDeleteDispatch = async (docId: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, "admin_dispatches", docId));
        toast.success("Document deleted successfully");
        if (selectedDoc?.id === docId) {
          setSelectedDoc(null);
        }
      } catch (err) {
        console.error("Error deleting document:", err);
        toast.error("Failed to delete document");
      }
    }
  };

  const handlePrint = async () => {
    if (!selectedDoc) return;
    triggerHapticFeedback([10, 20, 10]);
    playPrinterSound();

    try {
      await updateDoc(doc(db, "admin_dispatches", selectedDoc.id), {
        printedCount: (selectedDoc.printedCount || 0) + 1
      });
    } catch (err) {
      console.debug("Error incrementing printed count:", err);
    }

    // 1. If an uploaded image file exists, print ONLY the image file as it is (full page)
    if (selectedDoc.fileUrl && (selectedDoc.fileType === "image" || selectedDoc.docType === "custom")) {
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${selectedDoc.title}</title>
            <style>
              @page { size: auto; margin: 0; }
              body { 
                margin: 0; 
                padding: 0; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                min-height: 100vh; 
                background: #ffffff; 
              }
              img { 
                max-width: 100%; 
                max-height: 100vh; 
                object-fit: contain; 
              }
            </style>
          </head>
          <body>
            <img src="${selectedDoc.fileUrl}" onload="window.print(); setTimeout(function(){ window.close(); }, 600);" />
          </body>
        </html>
      `);
      printWindow.document.close();
      return;
    }

    // 2. If a PDF document link exists, open PDF directly in new window for printing
    if (selectedDoc.fileUrl && selectedDoc.fileType === "pdf") {
      window.open(selectedDoc.fileUrl, "_blank");
      return;
    }

    // 3. For official generated documents (payslips, payment vouchers, credit notes, batch packets)
    const printContent = document.getElementById("official-doc-print-capture");
    if (!printContent) {
      window.print();
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${selectedDoc.title} - #${selectedDoc.serialNumber}</title>
          <style>
            @media print { 
              @page { size: A4 portrait; margin: 0mm !important; } 
              body { margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } 
              html, body { height: 100%; overflow: visible; } 
            }
            body { 
              font-family: Arial, sans-serif; 
              font-size: 13px; 
              background: #ffffff; 
              color: #000000; 
              margin: 0; 
              padding: 0; 
            }
            .print-page { 
              width: 100%; 
              box-sizing: border-box; 
              background: white; 
            }
          </style>
        </head>
        <body>
          <div class="print-page">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const filteredDocs = dispatches.filter((docItem) => {
    const matchesBranch = docItem.targetBranch === "all" || !docItem.targetBranch || docItem.targetBranch === currentBranch;
    const matchesTab = activeTab === "all" || docItem.docType === activeTab;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      (docItem.title || "").toLowerCase().includes(q) ||
      (docItem.serialNumber || "").toLowerCase().includes(q) ||
      (docItem.subtitle || "").toLowerCase().includes(q) ||
      (docItem.metadata?.employeeName || "").toLowerCase().includes(q) ||
      (docItem.metadata?.supplierName || "").toLowerCase().includes(q);

    return matchesBranch && matchesTab && matchesSearch;
  });

  return (
    <PageTransition>
      <div className="min-h-screen bg-slate-50 dark:bg-[#050814] text-slate-900 dark:text-slate-100 p-4 md:p-8 max-w-6xl mx-auto space-y-6 pb-28 transition-colors">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#1E293B]">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-500 dark:text-cyan-400" /> Executive Documents & Official Receipts
            </span>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
              Manager Document Inbox
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Official admin dispatches, employee payslips, vendor receipts, and printable executive records.
            </p>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={isAr ? "ابحث في المستندات والإيصالات والاسم..." : "Search document title, serial #, employee or supplier..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-[#0B1121] border border-slate-200 dark:border-[#1E293B] text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-cyan-400 shadow-sm"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                  : "bg-white dark:bg-[#0B1121] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1E293B]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> All Dispatches ({dispatches.length})
            </button>

            <button
              onClick={() => setActiveTab("payslip")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "payslip"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                  : "bg-white dark:bg-[#0B1121] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1E293B]"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" /> Payslips
            </button>

            <button
              onClick={() => setActiveTab("payment_receipt")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "payment_receipt"
                  ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/30"
                  : "bg-white dark:bg-[#0B1121] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1E293B]"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" /> Payment Receipts
            </button>

            <button
              onClick={() => setActiveTab("credit_receipt")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "credit_receipt"
                  ? "bg-purple-500 text-slate-950 shadow-md shadow-purple-500/30"
                  : "bg-white dark:bg-[#0B1121] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1E293B]"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" /> Credit Notes
            </button>

            <button
              onClick={() => setActiveTab("custom")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "custom"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                  : "bg-white dark:bg-[#0B1121] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1E293B]"
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Custom Notices
            </button>
          </div>
        </div>

        {/* Document Grid */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Sparkles className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
            Loading Official Documents...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs rounded-3xl bg-white dark:bg-[#0B1121] border border-slate-200 dark:border-[#1E293B] shadow-sm">
            No official documents found for this category.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((docItem) => (
              <div
                key={docItem.id}
                onClick={() => handleOpenDoc(docItem)}
                className="p-4 rounded-3xl bg-white dark:bg-[#0B1121] border border-slate-200 dark:border-[#1E293B] hover:border-cyan-500/40 shadow-sm dark:shadow-xl space-y-3 relative overflow-hidden group cursor-pointer transition-all active:scale-98"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-2.5 rounded-2xl border shrink-0 ${
                      docItem.docType === "payslip"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : docItem.docType === "payment_receipt"
                        ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
                        : docItem.docType === "credit_receipt"
                        ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    }`}>
                      {docItem.docType === "payslip" && <DollarSign className="w-5 h-5" />}
                      {docItem.docType === "payment_receipt" && <Receipt className="w-5 h-5" />}
                      {docItem.docType === "credit_receipt" && <CreditCard className="w-5 h-5" />}
                      {docItem.docType === "custom" && <FileText className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-black text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors truncate">
                        {docItem.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                        {docItem.serialNumber}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border shrink-0 ${
                    docItem.status === "unread"
                      ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  }`}>
                    {docItem.status === "unread" ? "NEW 🆕" : "READ"}
                  </span>
                </div>

                {/* Subtitle / Metadata preview */}
                <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                  {docItem.subtitle}
                </p>

                {docItem.metadata?.netSalary > 0 && (
                  <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Net Salary</span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      EGP {Number(docItem.metadata.netSalary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {docItem.metadata?.isBatchPayroll && (
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Batch Packet</span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {docItem.metadata.allPayrollRecords?.length || 0} Staff Packets (2-Pages Each)
                    </span>
                  </div>
                )}

                {/* Card Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#1E293B] text-[10px] text-slate-400">
                  <span>{new Date(docItem.createdAt).toLocaleDateString()}</span>
                  <div className="flex items-center gap-1.5">
                    {docItem.printedCount > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                        🖨️ {docItem.printedCount}x
                      </span>
                    )}
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDispatch(docItem.id, docItem.title);
                        }}
                        className="px-2 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-xs font-bold flex items-center gap-1 transition-all"
                        title="Delete Document Dispatch"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    )}
                    <button className="px-2.5 py-1 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-black flex items-center gap-1">
                      <Eye className="w-3 h-3" /> View & Print
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* OFFICIAL EXECUTIVE DOCUMENT MODAL */}
        {selectedDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
            <div className="bg-white dark:bg-[#0B1121] border border-slate-200 dark:border-[#1E293B] rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl text-slate-900 dark:text-slate-100 my-auto flex flex-col max-h-[92vh]">
              
              {/* Modal Controls Bar */}
              <div className="p-4 border-b border-slate-200 dark:border-[#1E293B] flex items-center justify-between bg-slate-50 dark:bg-[#0F172A]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/30">
                    {selectedDoc.serialNumber}
                  </span>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white truncate max-w-xs md:max-w-md">
                    {selectedDoc.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-1.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md shadow-cyan-500/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> 
                    {selectedDoc.metadata?.isBatchPayroll ? `Print All (${selectedDoc.metadata.allPayrollRecords?.length || 0} Staff Packets)` : "Print Payslip Packet"}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteDispatch(selectedDoc.id, selectedDoc.title)}
                      className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Delete Document"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="p-1.5 rounded-full bg-slate-200 dark:bg-[#1E293B] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Document Preview Area */}
              <div className="p-6 overflow-y-auto flex-1 bg-white text-slate-900 custom-scrollbar" style={{ fontFamily: "Arial, sans-serif", fontSize: "13px" }}>
                
                {/* Captured Printable Layout Container (EXACT COPY FROM /admin/payroll) */}
                <div id="official-doc-print-capture" className="w-full text-black bg-white" style={{ fontFamily: "Arial, sans-serif", fontSize: "13px" }}>
                  
                  {/* IF BATCH PAYROLL MODE */}
                  {selectedDoc.docType === "payslip" && selectedDoc.metadata?.isBatchPayroll && selectedDoc.metadata?.allPayrollRecords?.length > 0 ? (
                    (() => {
                      const dateString = new Date(selectedDoc.createdAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                      const records = selectedDoc.metadata.allPayrollRecords;
                      const companyName = "Circle K Franchise";
                      const totalBatchGross = records.reduce((acc: number, curr: any) => acc + Number(curr.standardPay || curr.baseSalary || curr.salary || 0) + Number(curr.overtime || 0) + Number(curr.bonus || curr.bonuses || 0), 0);
                      const totalBatchDeds = records.reduce((acc: number, curr: any) => acc + Number(curr.deductions || 0) + Number(curr.insurance || 0) + Number(curr.loanThisMonth || curr.loan || 0), 0);
                      const totalBatchNet = records.reduce((acc: number, curr: any) => acc + Number(curr.netPay || curr.netSalary || 0), 0);

                      return (
                        <>
                          {/* PAGE 1: EXECUTIVE BATCH SUMMARY TABLE */}
                          <div style={{ boxSizing: "border-box", width: "210mm", height: "297mm", maxHeight: "297mm", padding: "12mm 15mm 18mm 15mm", margin: "0 auto", position: "relative", overflow: "hidden", pageBreakAfter: "always", breakAfter: "page", pageBreakInside: "avoid", breakInside: "avoid", backgroundColor: "#ffffff" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "12px", marginBottom: "16px" }}>
                              <div>
                                <h1 style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>{companyName}</h1>
                                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "11px" }}>Commercial Registry (س.ت): 123456 | Tax ID (ب.ض): 123-456-789</p>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Pending Payroll Summary</h2>
                                <h3 style={{ fontSize: "14px", fontWeight: "normal", color: "#475569", margin: "2px 0 0 0" }}>جدول مسير المستحقات غير المدفوعة</h3>
                              </div>
                            </div>

                            <div style={{ backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Date & Cycle / التاريخ والإصدار</span>
                                <strong style={{ fontSize: "13px", color: "#0f172a" }}>{dateString}</strong>
                              </div>
                              <div>
                                <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Total Pending Count</span>
                                <strong style={{ fontSize: "13px", color: "#0f172a" }}>{records.length} Employees</strong>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Total Net Payable / إجمالي الصافي</span>
                                <strong style={{ fontSize: "16px", color: "#059669" }}>EGP {totalBatchNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                              </div>
                            </div>

                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                              <thead>
                                <tr style={{ backgroundColor: "#0f172a", color: "#ffffff", textAlign: "left" }}>
                                  <th style={{ padding: "8px", textAlign: "center" }}>#</th>
                                  <th style={{ padding: "8px" }}>Employee Name</th>
                                  <th style={{ padding: "8px" }}>Month</th>
                                  <th style={{ padding: "8px", textAlign: "center" }}>Days</th>
                                  <th style={{ padding: "8px", textAlign: "right" }}>Gross Salary</th>
                                  <th style={{ padding: "8px", textAlign: "right" }}>Deductions</th>
                                  <th style={{ padding: "8px", textAlign: "right" }}>Net Payable</th>
                                </tr>
                              </thead>
                              <tbody>
                                {records.map((d: any, index: number) => {
                                  const empName = d.resolvedName || d.employeeName || d.staffName || d.name || "Employee";
                                  const stdPay = Number(d.standardPay || d.baseSalary || d.salary || 0);
                                  const ovt = Number(d.overtime || 0);
                                  const bon = Number(d.bonus || d.bonuses || 0);
                                  const gross = stdPay + ovt + bon;
                                  const deds = Number(d.deductions || 0) + Number(d.insurance || 0) + Number(d.loanThisMonth || d.loan || 0);
                                  const net = Number(d.netPay || d.netSalary || (gross - deds));
                                  return (
                                    <tr key={d.id || index} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                                      <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: "bold" }}>{index + 1}</td>
                                      <td style={{ padding: "7px 8px", fontWeight: "bold", color: "#0f172a" }}>{empName}</td>
                                      <td style={{ padding: "7px 8px" }}>{d.month || selectedDoc.metadata.month}</td>
                                      <td style={{ padding: "7px 8px", textAlign: "center" }}>{d.days || 30}</td>
                                      <td style={{ padding: "7px 8px", textAlign: "right" }}>EGP {gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                      <td style={{ padding: "7px 8px", textAlign: "right", color: "#dc2626" }}>EGP {deds.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: "900", color: "#059669" }}>EGP {net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                  );
                                })}
                                <tr style={{ backgroundColor: "#e2e8f0", fontWeight: "bold", borderTop: "2px solid #0f172a" }}>
                                  <td colSpan={4} style={{ padding: "10px 8px", textAlign: "left" }}>GRAND TOTALS / الإجمالي العام</td>
                                  <td style={{ padding: "10px 8px", textAlign: "right" }}>EGP {totalBatchGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: "10px 8px", textAlign: "right", color: "#dc2626" }}>EGP {totalBatchDeds.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: "10px 8px", textAlign: "right", fontSize: "13px", color: "#059669" }}>EGP {totalBatchNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                              </tbody>
                            </table>

                            <div style={{ position: "absolute", bottom: "18mm", left: "15mm", right: "15mm", display: "flex", justifyContent: "space-between", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "14px", backgroundColor: "#f8fafc" }}>
                              <div style={{ width: "45%" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", fontWeight: "bold", marginBottom: "35px" }}>
                                  <span>Prepared By (Financial Controller)</span>
                                  <span>إعداد المحاسب المسؤول</span>
                                </div>
                                <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
                              </div>
                              <div style={{ width: "45%" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", fontWeight: "bold", marginBottom: "35px" }}>
                                  <span>Approved By (General Manager)</span>
                                  <span>اعتماد المدير العام</span>
                                </div>
                                <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
                              </div>
                            </div>
                          </div>

                          {/* PER EMPLOYEE PACKETS (PAGE 1 & PAGE 2) */}
                          {records.map((p: any, idx: number) => {
                            const empName = p.resolvedName || p.employeeName || p.staffName || p.name || "Employee";
                            const empId = p.employeeId || p.id || `EMP-${idx + 1}`;
                            const position = p.role || p.position || "Store Staff";
                            const nationalId = p.nationalId || "-";
                            const payMonth = p.month || selectedDoc.metadata.month || "2026-06";
                            
                            const stdPay = Number(p.standardPay || p.baseSalary || p.salary || 0);
                            const ovt = Number(p.overtime || 0);
                            const bon = Number(p.bonus || p.bonuses || 0);
                            const gross = stdPay + ovt + bon;

                            const deds = Number(p.deductions || 0);
                            const ins = Number(p.insurance || 0);
                            const loan = Number(p.loanThisMonth || p.loan || 0);
                            const totalDeds = deds + ins + loan;

                            const netPay = Number(p.netPay || p.netSalary || (gross - totalDeds));
                            const netPayWords = numberToEnglishWords(netPay);

                            return (
                              <React.Fragment key={p.id || idx}>
                                {/* PAGE 1: PAYSLIP */}
                                <div style={{ boxSizing: "border-box", width: "210mm", height: "297mm", maxHeight: "297mm", padding: "12mm 15mm 18mm 15mm", margin: "0 auto", position: "relative", overflow: "hidden", pageBreakAfter: "always", breakAfter: "page", pageBreakInside: "avoid", breakInside: "avoid", backgroundColor: "#ffffff" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "12px", marginBottom: "16px" }}>
                                    <div>
                                      <h1 style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>Circle K Franchise</h1>
                                      <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "11px" }}>Commercial Registry (س.ت): 123456 | Tax ID (ب.ض): 123-456-789</p>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                      <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Payslip</h2>
                                      <h3 style={{ fontSize: "14px", fontWeight: "normal", color: "#475569", margin: "2px 0 0 0" }}>كشف راتب شهري</h3>
                                    </div>
                                  </div>
                                  
                                  <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid #cbd5e1" }}>
                                    <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                                      <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                        <span>Employee Name</span><span>اسم الموظف</span>
                                      </div>
                                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{empName}</div>
                                    </div>
                                    <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1" }}>
                                      <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                        <span>Employee ID</span><span>الرقم الوظيفي</span>
                                      </div>
                                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", fontSize: "11px", wordBreak: "break-all", color: "#0f172a" }}>{empId}</div>
                                    </div>
                                    <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                                      <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                        <span>National ID</span><span>الرقم القومي</span>
                                      </div>
                                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", letterSpacing: "1px", color: "#0f172a" }}>{nationalId}</div>
                                    </div>
                                    <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1" }}>
                                      <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                        <span>Position</span><span>المسمى الوظيفي</span>
                                      </div>
                                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{position}</div>
                                    </div>
                                    <div style={{ width: "50%", padding: "10px", borderRight: "1px solid #cbd5e1", backgroundColor: "#f8fafc" }}>
                                      <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                        <span>Payroll Period</span><span>دورة الراتب</span>
                                      </div>
                                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{payMonth}</div>
                                    </div>
                                    <div style={{ width: "50%", padding: "10px", backgroundColor: "#f8fafc" }}>
                                      <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                        <span>Issue Date</span><span>تاريخ الإصدار</span>
                                      </div>
                                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{dateString}</div>
                                    </div>
                                  </div>

                                  <div style={{ backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", padding: "12px 16px", marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px" }}>
                                    <span style={{ fontSize: "13px", fontWeight: "bold", color: "#0f172a" }}>صافي الراتب المستحق / Net Payable</span>
                                    <span style={{ fontSize: "18px", fontWeight: "900", color: "#0f172a" }}>EGP {netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                  <div style={{ textAlign: "right", fontSize: "12px", marginTop: "6px", color: "#475569", fontWeight: "500" }}>
                                    فقط وقدره: {netPayWords} لا غير
                                  </div>

                                  {/* EARNINGS */}
                                  <div style={{ marginTop: "20px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: "bold", borderBottom: "2px solid #0f172a", paddingBottom: "4px", marginBottom: "8px", textTransform: "uppercase", fontSize: "12px" }}>
                                      <span>Earnings</span><span>الاستحقاقات</span>
                                    </div>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                                      <thead>
                                        <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1" }}>
                                          <th style={{ padding: "8px", textAlign: "right", fontWeight: "600" }}>البند / Description</th>
                                          <th style={{ padding: "8px", textAlign: "right", width: "160px", fontWeight: "600" }}>القيمة / Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr>
                                          <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>الراتب الأساسي (Basic Salary)</td>
                                          <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {stdPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                        <tr style={{ backgroundColor: "#f8fafc" }}>
                                          <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>أجر إضافي (Overtime)</td>
                                          <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {ovt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                        <tr>
                                          <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>مكافآت وحوافز (Bonuses/Incentives)</td>
                                          <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {bon.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                        <tr style={{ backgroundColor: "#e2e8f0", color: "#0f172a" }}>
                                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: "bold" }}>إجمالي الاستحقاقات (Gross Earnings)</td>
                                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: "bold" }}>EGP {gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* DEDUCTIONS */}
                                  <div style={{ marginTop: "20px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: "bold", borderBottom: "2px solid #0f172a", paddingBottom: "4px", marginBottom: "8px", textTransform: "uppercase", fontSize: "12px" }}>
                                      <span>Deductions</span><span>الاستقطاعات</span>
                                    </div>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                                      <thead>
                                        <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1" }}>
                                          <th style={{ padding: "8px", textAlign: "right", fontWeight: "600" }}>البند / Description</th>
                                          <th style={{ padding: "8px", textAlign: "right", width: "160px", fontWeight: "600" }}>القيمة / Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr>
                                          <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>جزاءات قانونية وإدارية (Legal/Admin Penalties)</td>
                                          <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {deds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                        <tr style={{ backgroundColor: "#f8fafc" }}>
                                          <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>تأمينات اجتماعية (Social Insurance)</td>
                                          <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {ins.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                        <tr>
                                          <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>سلف / قروض (Advances/Loans)</td>
                                          <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {loan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                        <tr style={{ backgroundColor: "#e2e8f0", color: "#0f172a" }}>
                                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: "bold" }}>إجمالي الاستقطاعات (Total Deductions)</td>
                                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: "bold" }}>EGP {totalDeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* SIGNATURES */}
                                  <div style={{ position: "absolute", bottom: "18mm", left: "15mm", right: "15mm", display: "flex", justifyContent: "space-between" }}>
                                    <div style={{ width: "40%" }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", marginBottom: "35px" }}>
                                        <span>Employee Signature</span><span>توقيع الموظف</span>
                                      </div>
                                      <div style={{ borderBottom: "1px solid #cbd5e1" }}></div>
                                    </div>
                                    <div style={{ width: "40%" }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", marginBottom: "35px" }}>
                                        <span>HR Department</span><span>إدارة الموارد البشرية</span>
                                      </div>
                                      <div style={{ borderBottom: "1px solid #cbd5e1" }}></div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* PAGE 2: SALARY ACKNOWLEDGEMENT RECEIPT */}
                                <div style={{ boxSizing: "border-box", width: "210mm", height: "297mm", maxHeight: "297mm", padding: "12mm 15mm 18mm 15mm", margin: "0 auto", position: "relative", overflow: "hidden", pageBreakBefore: "always", breakBefore: "page", pageBreakAfter: "always", breakAfter: "page", pageBreakInside: "avoid", breakInside: "avoid", backgroundColor: "#ffffff" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "12px", marginBottom: "16px" }}>
                                    <div>
                                      <h1 style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>Circle K Franchise</h1>
                                      <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "11px" }}>Commercial Registry (س.ت): 123456 | Tax ID (ب.ض): 123-456-789</p>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                      <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Salary Receipt</h2>
                                      <h3 style={{ fontSize: "14px", fontWeight: "normal", color: "#475569", margin: "2px 0 0 0" }}>إقرار استلام راتب ومخالصة نهائية</h3>
                                    </div>
                                  </div>
                                  
                                  <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid #cbd5e1" }}>
                                    <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                                      <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                        <span>Employee Name</span><span>اسم الموظف</span>
                                      </div>
                                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{empName}</div>
                                    </div>
                                    <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1" }}>
                                      <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                        <span>Employee ID</span><span>الرقم الوظيفي</span>
                                      </div>
                                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", fontSize: "11px", wordBreak: "break-all", color: "#0f172a" }}>{empId}</div>
                                    </div>
                                    <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                                      <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                        <span>National ID</span><span>الرقم القومي</span>
                                      </div>
                                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", letterSpacing: "1px", color: "#0f172a" }}>{nationalId}</div>
                                    </div>
                                    <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1" }}>
                                      <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                        <span>Position</span><span>المسمى الوظيفي</span>
                                      </div>
                                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{position}</div>
                                    </div>
                                    <div style={{ width: "50%", padding: "10px", borderRight: "1px solid #cbd5e1", backgroundColor: "#f8fafc" }}>
                                      <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                        <span>Payroll Period</span><span>دورة الراتب</span>
                                      </div>
                                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{payMonth}</div>
                                    </div>
                                    <div style={{ width: "50%", padding: "10px", backgroundColor: "#f8fafc" }}>
                                      <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                        <span>Issue Date</span><span>تاريخ الإصدار</span>
                                      </div>
                                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{dateString}</div>
                                    </div>
                                  </div>

                                  <div style={{ backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", padding: "12px 16px", marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px" }}>
                                    <span style={{ fontSize: "13px", fontWeight: "bold", color: "#0f172a" }}>المبلغ الصافي المستلم</span>
                                    <span style={{ fontSize: "18px", fontWeight: "900", color: "#0f172a" }}>EGP {netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                  <div style={{ textAlign: "right", fontSize: "12px", marginTop: "6px", color: "#475569", fontWeight: "500" }}>
                                    فقط وقدره: {netPayWords} لا غير
                                  </div>

                                  <div style={{ marginTop: "24px", textAlign: "right", direction: "rtl", backgroundColor: "#f8fafc", padding: "14px 18px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                    <h3 style={{ color: "#0f172a", borderBottom: "1px solid #cbd5e1", paddingBottom: "6px", marginBottom: "10px", fontSize: "14px", fontWeight: "bold" }}>
                                      إقرار استلام ومخالصة نهائية
                                    </h3>
                                    <p style={{ fontSize: "12px", lineHeight: "1.6", color: "#334155", textAlign: "justify" }}>
                                      أقر أنا الموقع أدناه، بصفتي موظفاً لدى الشركة المذكورة أعلاه، بأنني قد استلمت كامل الراتب والمستحقات المالية الخاصة بي عن دورة الراتب الموضحة أعلاه (<strong>{payMonth}</strong>)، وذلك بعد إجراء كافة الاستقطاعات القانونية والاعتيادية المقررة بموجب قانون العمل المصري وقوانين التأمينات الاجتماعية واللوائح الداخلية للشركة.
                                    </p>
                                    <p style={{ fontSize: "12px", lineHeight: "1.6", color: "#334155", textAlign: "justify", marginTop: "8px" }}>
                                      ويُعد توقيعي على هذا الإقرار بمثابة <strong>مخالصة نهائية تامة وكاملة</strong> تبرئ ذمة الشركة من أي مطالبات مالية أو حقوق تخص الراتب الأساسي، البدلات، الحوافز، الأجر الإضافي، أو أي مميزات أخرى عن الفترة المذكورة، ولا يحق لي الرجوع على الشركة مستقبلاً بأي مطالبات تخص هذه الدورة.
                                    </p>
                                  </div>

                                  <div style={{ marginTop: "14px", textAlign: "left", direction: "ltr", backgroundColor: "#f8fafc", padding: "14px 18px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                    <h3 style={{ color: "#0f172a", borderBottom: "1px solid #cbd5e1", paddingBottom: "6px", marginBottom: "10px", fontSize: "14px", fontWeight: "bold" }}>
                                      Final Clearance & Salary Receipt
                                    </h3>
                                    <p style={{ fontSize: "11px", lineHeight: "1.5", color: "#334155", textAlign: "justify" }}>
                                      I, the undersigned, in my capacity as an employee of the aforementioned company, hereby acknowledge receipt of my full salary and financial dues for the payroll period stated above (<strong>{payMonth}</strong>). This is net of all lawful and customary deductions in accordance with Egyptian Labor Law, Social Insurance laws, and company internal regulations.
                                    </p>
                                    <p style={{ fontSize: "11px", lineHeight: "1.5", color: "#334155", textAlign: "justify", marginTop: "6px" }}>
                                      My signature on this receipt constitutes a <strong>full and final clearance</strong> discharging the Company from any financial claims or rights pertaining to basic salary, allowances, incentives, overtime, or any other benefits for the stated period. I forfeit any right to raise future claims regarding this cycle.
                                    </p>
                                  </div>

                                  <div style={{ position: "absolute", bottom: "18mm", left: "15mm", right: "15mm", display: "flex", justifyContent: "space-between", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "14px", backgroundColor: "#f8fafc" }}>
                                    <div style={{ width: "45%" }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", fontWeight: "bold", marginBottom: "35px" }}>
                                        <span>Employee Signature</span>
                                        <span>توقيع الموظف (المُقر)</span>
                                      </div>
                                      <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
                                    </div>
                                    <div style={{ width: "45%" }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", fontWeight: "bold", marginBottom: "35px" }}>
                                        <span>Authorized Manager</span>
                                        <span>توقيع المدير المختص</span>
                                      </div>
                                      <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
                                    </div>
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </>
                      );
                    })()
                  ) : selectedDoc.docType === "payslip" ? (
                    /* SINGLE PAYSLIP PACKET (EXACT 1-TO-1 COPY FROM /admin/payroll) */
                    (() => {
                      const m = selectedDoc.metadata || {};
                      const raw = m.rawPayrollRecord || {};
                      const empName = m.employeeName || "Employee";
                      const empId = raw.employeeId || selectedDoc.serialNumber;
                      const nationalId = raw.nationalId || "-";
                      const position = m.employeeRole || "Store Staff";
                      const payMonth = m.month || "2026-06";
                      const dateString = new Date(selectedDoc.createdAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

                      const stdPay = Number(m.baseSalary || raw.standardPay || 0);
                      const ovt = Number(raw.overtime || 0);
                      const bon = Number(m.bonuses || raw.bonus || 0);
                      const gross = stdPay + ovt + bon;

                      const deds = Number(m.deductions || raw.deductions || 0);
                      const ins = Number(raw.insurance || 0);
                      const loan = Number(raw.loanThisMonth || 0);
                      const totalDeds = deds + ins + loan;

                      const netPay = Number(m.netSalary || raw.netPay || (gross - totalDeds));
                      const netPayWords = numberToEnglishWords(netPay);

                      return (
                        <>
                          {/* PAGE 1: PAYSLIP */}
                          <div style={{ boxSizing: "border-box", width: "210mm", height: "297mm", maxHeight: "297mm", padding: "12mm 15mm 18mm 15mm", margin: "0 auto", position: "relative", overflow: "hidden", pageBreakAfter: "always", breakAfter: "page", pageBreakInside: "avoid", breakInside: "avoid", backgroundColor: "#ffffff" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "12px", marginBottom: "16px" }}>
                              <div>
                                <h1 style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>Circle K Franchise</h1>
                                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "11px" }}>Commercial Registry (س.ت): 123456 | Tax ID (ب.ض): 123-456-789</p>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Payslip</h2>
                                <h3 style={{ fontSize: "14px", fontWeight: "normal", color: "#475569", margin: "2px 0 0 0" }}>كشف راتب شهري</h3>
                              </div>
                            </div>
                            
                            <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid #cbd5e1" }}>
                              <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                                <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                  <span>Employee Name</span><span>اسم الموظف</span>
                                </div>
                                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{empName}</div>
                              </div>
                              <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1" }}>
                                <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                  <span>Employee ID</span><span>الرقم الوظيفي</span>
                                </div>
                                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", fontSize: "11px", wordBreak: "break-all", color: "#0f172a" }}>{empId}</div>
                              </div>
                              <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                                <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                  <span>National ID</span><span>الرقم القومي</span>
                                </div>
                                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", letterSpacing: "1px", color: "#0f172a" }}>{nationalId}</div>
                              </div>
                              <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1" }}>
                                <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                  <span>Position</span><span>المسمى الوظيفي</span>
                                </div>
                                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{position}</div>
                              </div>
                              <div style={{ width: "50%", padding: "10px", borderRight: "1px solid #cbd5e1", backgroundColor: "#f8fafc" }}>
                                <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                  <span>Payroll Period</span><span>دورة الراتب</span>
                                </div>
                                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{payMonth}</div>
                              </div>
                              <div style={{ width: "50%", padding: "10px", backgroundColor: "#f8fafc" }}>
                                <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                  <span>Issue Date</span><span>تاريخ الإصدار</span>
                                </div>
                                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{dateString}</div>
                              </div>
                            </div>

                            <div style={{ backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", padding: "12px 16px", marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px" }}>
                              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#0f172a" }}>صافي الراتب المستحق / Net Payable</span>
                              <span style={{ fontSize: "18px", fontWeight: "900", color: "#0f172a" }}>EGP {netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ textAlign: "right", fontSize: "12px", marginTop: "6px", color: "#475569", fontWeight: "500" }}>
                              فقط وقدره: {netPayWords} لا غير
                            </div>

                            {/* EARNINGS */}
                            <div style={{ marginTop: "20px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: "bold", borderBottom: "2px solid #0f172a", paddingBottom: "4px", marginBottom: "8px", textTransform: "uppercase", fontSize: "12px" }}>
                                <span>Earnings</span><span>الاستحقاقات</span>
                              </div>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                                <thead>
                                  <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1" }}>
                                    <th style={{ padding: "8px", textAlign: "right", fontWeight: "600" }}>البند / Description</th>
                                    <th style={{ padding: "8px", textAlign: "right", width: "160px", fontWeight: "600" }}>القيمة / Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>الراتب الأساسي (Basic Salary)</td>
                                    <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {stdPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  </tr>
                                  <tr style={{ backgroundColor: "#f8fafc" }}>
                                    <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>أجر إضافي (Overtime)</td>
                                    <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {ovt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  </tr>
                                  <tr>
                                    <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>مكافآت وحوافز (Bonuses/Incentives)</td>
                                    <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {bon.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  </tr>
                                  <tr style={{ backgroundColor: "#e2e8f0", color: "#0f172a" }}>
                                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: "bold" }}>إجمالي الاستحقاقات (Gross Earnings)</td>
                                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: "bold" }}>EGP {gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* DEDUCTIONS */}
                            <div style={{ marginTop: "20px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: "bold", borderBottom: "2px solid #0f172a", paddingBottom: "4px", marginBottom: "8px", textTransform: "uppercase", fontSize: "12px" }}>
                                <span>Deductions</span><span>الاستقطاعات</span>
                              </div>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                                <thead>
                                  <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1" }}>
                                    <th style={{ padding: "8px", textAlign: "right", fontWeight: "600" }}>البند / Description</th>
                                    <th style={{ padding: "8px", textAlign: "right", width: "160px", fontWeight: "600" }}>القيمة / Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>جزاءات قانونية وإدارية (Legal/Admin Penalties)</td>
                                    <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {deds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  </tr>
                                  <tr style={{ backgroundColor: "#f8fafc" }}>
                                    <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>تأمينات اجتماعية (Social Insurance)</td>
                                    <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {ins.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  </tr>
                                  <tr>
                                    <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>سلف / قروض (Advances/Loans)</td>
                                    <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {loan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  </tr>
                                  <tr style={{ backgroundColor: "#e2e8f0", color: "#0f172a" }}>
                                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: "bold" }}>إجمالي الاستقطاعات (Total Deductions)</td>
                                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: "bold" }}>EGP {totalDeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* SIGNATURES */}
                            <div style={{ position: "absolute", bottom: "18mm", left: "15mm", right: "15mm", display: "flex", justifyContent: "space-between" }}>
                              <div style={{ width: "40%" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", marginBottom: "35px" }}>
                                  <span>Employee Signature</span><span>توقيع الموظف</span>
                                </div>
                                <div style={{ borderBottom: "1px solid #cbd5e1" }}></div>
                              </div>
                              <div style={{ width: "40%" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", marginBottom: "35px" }}>
                                  <span>HR Department</span><span>إدارة الموارد البشرية</span>
                                </div>
                                <div style={{ borderBottom: "1px solid #cbd5e1" }}></div>
                              </div>
                            </div>
                          </div>
                          
                          {/* PAGE 2: SALARY ACKNOWLEDGEMENT RECEIPT */}
                          <div style={{ boxSizing: "border-box", width: "210mm", height: "297mm", maxHeight: "297mm", padding: "12mm 15mm 18mm 15mm", margin: "0 auto", position: "relative", overflow: "hidden", pageBreakBefore: "always", breakBefore: "page", pageBreakAfter: "always", breakAfter: "page", pageBreakInside: "avoid", breakInside: "avoid", backgroundColor: "#ffffff" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "12px", marginBottom: "16px" }}>
                              <div>
                                <h1 style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>Circle K Franchise</h1>
                                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "11px" }}>Commercial Registry (س.ت): 123456 | Tax ID (ب.ض): 123-456-789</p>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Salary Receipt</h2>
                                <h3 style={{ fontSize: "14px", fontWeight: "normal", color: "#475569", margin: "2px 0 0 0" }}>إقرار استلام راتب ومخالصة نهائية</h3>
                              </div>
                            </div>
                            
                            <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid #cbd5e1" }}>
                              <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                                <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                  <span>Employee Name</span><span>اسم الموظف</span>
                                </div>
                                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{empName}</div>
                              </div>
                              <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1" }}>
                                <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                  <span>Employee ID</span><span>الرقم الوظيفي</span>
                                </div>
                                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", fontSize: "11px", wordBreak: "break-all", color: "#0f172a" }}>{empId}</div>
                              </div>
                              <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                                <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                  <span>National ID</span><span>الرقم القومي</span>
                                </div>
                                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", letterSpacing: "1px", color: "#0f172a" }}>{nationalId}</div>
                              </div>
                              <div style={{ width: "50%", padding: "10px", borderBottom: "1px solid #cbd5e1" }}>
                                <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                  <span>Position</span><span>المسمى الوظيفي</span>
                                </div>
                                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{position}</div>
                              </div>
                              <div style={{ width: "50%", padding: "10px", borderRight: "1px solid #cbd5e1", backgroundColor: "#f8fafc" }}>
                                <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                  <span>Payroll Period</span><span>دورة الراتب</span>
                                </div>
                                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{payMonth}</div>
                              </div>
                              <div style={{ width: "50%", padding: "10px", backgroundColor: "#f8fafc" }}>
                                <div style={{ color: "#64748b", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                  <span>Issue Date</span><span>تاريخ الإصدار</span>
                                </div>
                                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "2px", color: "#0f172a" }}>{dateString}</div>
                              </div>
                            </div>

                            <div style={{ backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", padding: "12px 16px", marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px" }}>
                              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#0f172a" }}>المبلغ الصافي المستلم</span>
                              <span style={{ fontSize: "18px", fontWeight: "900", color: "#0f172a" }}>EGP {netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ textAlign: "right", fontSize: "12px", marginTop: "6px", color: "#475569", fontWeight: "500" }}>
                              فقط وقدره: {netPayWords} لا غير
                            </div>

                            <div style={{ marginTop: "24px", textAlign: "right", direction: "rtl", backgroundColor: "#f8fafc", padding: "14px 18px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <h3 style={{ color: "#0f172a", borderBottom: "1px solid #cbd5e1", paddingBottom: "6px", marginBottom: "10px", fontSize: "14px", fontWeight: "bold" }}>
                                إقرار استلام ومخالصة نهائية
                              </h3>
                              <p style={{ fontSize: "12px", lineHeight: "1.6", color: "#334155", textAlign: "justify" }}>
                                أقر أنا الموقع أدناه، بصفتي موظفاً لدى الشركة المذكورة أعلاه، بأنني قد استلمت كامل الراتب والمستحقات المالية الخاصة بي عن دورة الراتب الموضحة أعلاه (<strong>{payMonth}</strong>)، وذلك بعد إجراء كافة الاستقطاعات القانونية والاعتيادية المقررة بموجب قانون العمل المصري وقوانين التأمينات الاجتماعية واللوائح الداخلية للشركة.
                              </p>
                              <p style={{ fontSize: "12px", lineHeight: "1.6", color: "#334155", textAlign: "justify", marginTop: "8px" }}>
                                ويُعد توقيعي على هذا الإقرار بمثابة <strong>مخالصة نهائية تامة وكاملة</strong> تبرئ ذمة الشركة من أي مطالبات مالية أو حقوق تخص الراتب الأساسي، البدلات، الحوافز، الأجر الإضافي، أو أي مميزات أخرى عن الفترة المذكورة، ولا يحق لي الرجوع على الشركة مستقبلاً بأي مطالبات تخص هذه الدورة.
                              </p>
                            </div>

                            <div style={{ marginTop: "14px", textAlign: "left", direction: "ltr", backgroundColor: "#f8fafc", padding: "14px 18px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <h3 style={{ color: "#0f172a", borderBottom: "1px solid #cbd5e1", paddingBottom: "6px", marginBottom: "10px", fontSize: "14px", fontWeight: "bold" }}>
                                Final Clearance & Salary Receipt
                              </h3>
                              <p style={{ fontSize: "11px", lineHeight: "1.5", color: "#334155", textAlign: "justify" }}>
                                I, the undersigned, in my capacity as an employee of the aforementioned company, hereby acknowledge receipt of my full salary and financial dues for the payroll period stated above (<strong>{payMonth}</strong>). This is net of all lawful and customary deductions in accordance with Egyptian Labor Law, Social Insurance laws, and company internal regulations.
                              </p>
                              <p style={{ fontSize: "11px", lineHeight: "1.5", color: "#334155", textAlign: "justify", marginTop: "6px" }}>
                                My signature on this receipt constitutes a <strong>full and final clearance</strong> discharging the Company from any financial claims or rights pertaining to basic salary, allowances, incentives, overtime, or any other benefits for the stated period. I forfeit any right to raise future claims regarding this cycle.
                              </p>
                            </div>

                            <div style={{ position: "absolute", bottom: "18mm", left: "15mm", right: "15mm", display: "flex", justifyContent: "space-between", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "14px", backgroundColor: "#f8fafc" }}>
                              <div style={{ width: "45%" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", fontWeight: "bold", marginBottom: "35px" }}>
                                  <span>Employee Signature</span>
                                  <span>توقيع الموظف (المُقر)</span>
                                </div>
                                <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
                              </div>
                              <div style={{ width: "45%" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", fontWeight: "bold", marginBottom: "35px" }}>
                                  <span>Authorized Manager</span>
                                  <span>توقيع المدير المختص</span>
                                </div>
                                <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    /* NON-PAYSLIP VOUCHER (Payment Receipt, Credit Statement, etc.) */
                    <div style={{ boxSizing: "border-box", width: "210mm", height: "297mm", maxHeight: "297mm", padding: "12mm 15mm 18mm 15mm", margin: "0 auto", position: "relative", overflow: "hidden", backgroundColor: "#ffffff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "12px", marginBottom: "16px" }}>
                        <div>
                          <h1 style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>Circle K Franchise</h1>
                          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "11px" }}>Commercial Registry (س.ت): 123456 | Tax ID (ب.ض): 123-456-789</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Executive Voucher</h2>
                          <h3 style={{ fontSize: "14px", fontWeight: "normal", color: "#475569", margin: "2px 0 0 0" }}>مستند إداري رسمي</h3>
                        </div>
                      </div>

                      <div style={{ backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "14px", marginBottom: "16px", textAlign: "center" }}>
                        <h2 style={{ fontSize: "18px", fontWeight: "900", color: "#0f172a", margin: 0 }}>{selectedDoc.title}</h2>
                        <p style={{ fontSize: "12px", color: "#475569", margin: "4px 0 0 0" }}>{selectedDoc.subtitle}</p>
                      </div>

                      {selectedDoc.metadata && (
                        <div style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "14px", backgroundColor: "#ffffff", marginBottom: "16px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
                            <div><strong>Vendor / Supplier:</strong> {selectedDoc.metadata.supplierName || "-"}</div>
                            <div><strong>Invoice / Ref #:</strong> {selectedDoc.metadata.invoiceNumber || "-"}</div>
                            <div><strong>Payment Method:</strong> {selectedDoc.metadata.paymentMethod || "Cash"}</div>
                            <div><strong>Total Amount:</strong> EGP {Number(selectedDoc.metadata.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                          </div>
                        </div>
                      )}

                      {selectedDoc.note && (
                        <div style={{ border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", borderRadius: "8px", padding: "12px", fontSize: "12px", marginBottom: "16px" }}>
                          <strong style={{ color: "#0f172a", display: "block", marginBottom: "4px" }}>Executive Directives:</strong>
                          <p style={{ margin: 0, color: "#334155" }}>{selectedDoc.note}</p>
                        </div>
                      )}

                      {selectedDoc.fileUrl && selectedDoc.fileType === "image" && (
                        <div style={{ textAlign: "center", marginTop: "16px" }}>
                          <img src={selectedDoc.fileUrl} alt="Attached Document" style={{ maxHeight: "350px", maxWidth: "100%", objectFit: "contain", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
                        </div>
                      )}

                      <div style={{ position: "absolute", bottom: "18mm", left: "15mm", right: "15mm", display: "flex", justifyContent: "space-between", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "14px", backgroundColor: "#f8fafc" }}>
                        <div style={{ width: "45%" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", fontWeight: "bold", marginBottom: "35px" }}>
                            <span>Issued By</span>
                            <span>جهة الإصدار</span>
                          </div>
                          <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
                        </div>
                        <div style={{ width: "45%" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", fontWeight: "bold", marginBottom: "35px" }}>
                            <span>Executive Approval</span>
                            <span>اعتماد الإدارة</span>
                          </div>
                          <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
