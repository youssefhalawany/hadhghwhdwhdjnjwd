"use client";

import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
  FileCheck2
} from "lucide-react";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { PageTransition } from "@/components/PageTransition";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { playPopSound, playPrinterSound } from "@/lib/sounds";

export default function ManagerDocumentsPage() {
  const { currentBranch } = useBranch();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "payslip" | "payment_receipt" | "credit_receipt" | "custom">("all");

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

    // 3. For official generated documents (payslips, payment vouchers, credit notes)
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
            @page { size: A4 portrait; margin: 10mm; }
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              background: #ffffff; 
              color: #0f172a; 
              margin: 0; 
              padding: 0; 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact; 
            }
            .print-page { 
              width: 100%; 
              box-sizing: border-box; 
              background: white; 
            }
            .print-hide { display: none !important; }
            .page-break { page-break-after: always; break-after: page; }
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

                {docItem.metadata?.amount > 0 && (
                  <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Amount</span>
                    <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 font-mono">
                      EGP {Number(docItem.metadata.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                    <Printer className="w-4 h-4" /> Print 2-Page Packet
                  </button>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="p-1.5 rounded-full bg-slate-200 dark:bg-[#1E293B] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Document Preview Area */}
              <div className="p-6 overflow-y-auto flex-1 bg-white text-slate-900 custom-scrollbar">
                
                {/* Captured Printable Layout Container */}
                <div id="official-doc-print-capture" className="space-y-8 text-slate-900">
                  
                  {/* --- PAGE 1: OFFICIAL PAYSLIP VOUCHER --- */}
                  <div className="space-y-6">
                    {/* Executive Letterhead Header */}
                    <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white font-black text-lg shadow-md">
                          K
                        </div>
                        <div>
                          <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">
                            ANH Portal • Circle K Franchise
                          </h2>
                          <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">
                            Commercial Registry (س.ت): 123456 | Tax ID (ب.ض): 123-456-789
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <h2 className="text-base font-black text-slate-900 uppercase">
                          {selectedDoc.docType === "payslip" ? "Official Payslip" : "Executive Voucher"}
                        </h2>
                        <span className="text-xs font-bold font-mono text-slate-600 block">
                          REF: {selectedDoc.serialNumber}
                        </span>
                        <p className="text-[10px] text-slate-500 font-bold">
                          Date: {new Date(selectedDoc.createdAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                    </div>

                    {/* Document Title Banner */}
                    <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-center">
                      <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                        {selectedDoc.title}
                      </h1>
                      <p className="text-xs font-semibold text-slate-600 mt-0.5">
                        {selectedDoc.subtitle}
                      </p>
                    </div>

                    {/* Metadata Table for Payslip */}
                    {selectedDoc.docType === "payslip" && selectedDoc.metadata && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-300 text-xs">
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Employee Name / اسم الموظف</p>
                            <p className="font-extrabold text-slate-900 text-sm">{selectedDoc.metadata.employeeName}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Position / المسمى الوظيفي</p>
                            <p className="font-extrabold text-slate-900 text-sm">{selectedDoc.metadata.employeeRole || "Store Staff"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Pay Period / شهر الراتب</p>
                            <p className="font-extrabold text-slate-900">{selectedDoc.metadata.month || "2026-06"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Store Branch / الفرع</p>
                            <p className="font-extrabold text-slate-900 capitalize">{selectedDoc.targetBranch || "El Alamein 4"}</p>
                          </div>
                        </div>

                        {/* High Visibility Net Pay Box */}
                        <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-md">
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-400">Total Net Payable Salary / صافي الراتب المستحق</p>
                            <p className="text-[11px] text-slate-300 mt-0.5 font-medium">Approved & Disbursed for {selectedDoc.metadata.month}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black text-emerald-400 font-mono">
                              EGP {Number(selectedDoc.metadata.netSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        <table className="w-full text-xs border-collapse border border-slate-300">
                          <thead>
                            <tr className="bg-slate-200 text-slate-900 font-black">
                              <th className="p-2.5 text-left border border-slate-300">Salary Breakdown Item / تفاصيل الراتب</th>
                              <th className="p-2.5 text-right border border-slate-300">Amount (EGP)</th>
                            </tr>
                          </thead>
                          <tbody className="font-mono">
                            <tr>
                              <td className="p-2.5 border border-slate-300 font-sans font-bold">Base Monthly Salary / الراتب الأساسي</td>
                              <td className="p-2.5 text-right border border-slate-300 font-extrabold text-slate-900">
                                EGP {Number(selectedDoc.metadata.baseSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                            <tr>
                              <td className="p-2.5 border border-slate-300 font-sans font-bold">Bonuses, Overtime & Allowances / الحوافز والبدلات</td>
                              <td className="p-2.5 text-right border border-slate-300 font-extrabold text-emerald-700">
                                + EGP {Number(selectedDoc.metadata.bonuses || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                            <tr>
                              <td className="p-2.5 border border-slate-300 font-sans font-bold">Deductions, Absences & Advances / الخصومات والسلفيات</td>
                              <td className="p-2.5 text-right border border-slate-300 font-extrabold text-rose-700">
                                - EGP {Number(selectedDoc.metadata.deductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                            <tr className="bg-slate-100 font-black text-sm">
                              <td className="p-3 border border-slate-300 font-sans uppercase">TOTAL NET DISBURSED SALARY / صافي المستحق النهائي</td>
                              <td className="p-3 text-right border border-slate-300 text-emerald-800">
                                EGP {Number(selectedDoc.metadata.netSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Metadata Table for Receipts */}
                    {(selectedDoc.docType === "payment_receipt" || selectedDoc.docType === "credit_receipt") && selectedDoc.metadata && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Vendor / Supplier</p>
                            <p className="font-extrabold text-slate-900">{selectedDoc.metadata.supplierName}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Invoice / Ref #</p>
                            <p className="font-mono font-bold text-slate-900">{selectedDoc.metadata.invoiceNumber}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Payment Method</p>
                            <p className="font-bold text-slate-900 capitalize">{selectedDoc.metadata.paymentMethod}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Amount</p>
                            <p className="font-mono font-black text-cyan-800 text-sm">
                              EGP {Number(selectedDoc.metadata.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Executive Remarks */}
                    {selectedDoc.note && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase">Remarks & Directives / ملاحظات الإدارة</p>
                        <p className="text-slate-800 mt-1 font-medium whitespace-pre-wrap">{selectedDoc.note}</p>
                      </div>
                    )}

                    {/* Attached Image Embed Preview */}
                    {selectedDoc.fileUrl && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase flex items-center justify-between">
                          <span>Attached Document / Image Evidence</span>
                          <a href={selectedDoc.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Open Full Image
                          </a>
                        </p>
                        {selectedDoc.fileType === "image" ? (
                          <img src={selectedDoc.fileUrl} alt="Attached Evidence" className="max-h-64 object-contain rounded-lg border border-slate-300 mx-auto" />
                        ) : (
                          <p className="text-xs text-blue-700 font-mono underline break-all">{selectedDoc.fileUrl}</p>
                        )}
                      </div>
                    )}

                    {/* Executive Signature Block */}
                    <div className="pt-6 mt-6 border-t-2 border-slate-300 flex items-end justify-between">
                      <div>
                        <p className="text-[9px] font-mono text-slate-400 tracking-wider">
                          SERIAL: {selectedDoc.serialNumber} • STORE COPY (PAGE 1)
                        </p>
                        <p className="text-[9px] font-mono text-slate-400">
                          ISSUED BY: {selectedDoc.senderName} ({selectedDoc.senderEmail})
                        </p>
                      </div>
                      <div className="text-center w-40">
                        <div className="h-10 border-b border-slate-400 mb-1 flex items-end justify-center">
                          <span className="text-xs font-black italic text-slate-700">Official Seal Approved</span>
                        </div>
                        <p className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Executive Authorization</p>
                      </div>
                    </div>
                  </div>

                  {/* --- PAGE 2: EMPLOYEE RECEIPT & CLEARANCE FORM (FOR PAYSLIPS) --- */}
                  {selectedDoc.docType === "payslip" && (
                    <div className="page-break pt-12 space-y-6 border-t-4 border-dashed border-slate-400">
                      
                      <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900">
                        <div>
                          <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">
                            ANH Portal • Circle K Franchise
                          </h2>
                          <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">
                            Official Employee Salary Receipt & Clearance Form (نموذج إقرار استلام الراتب)
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black font-mono text-slate-900 block">
                            PAGE 2 OF 2 • {selectedDoc.serialNumber}
                          </span>
                        </div>
                      </div>

                      <div className="p-6 rounded-2xl bg-slate-50 border-2 border-slate-300 space-y-4">
                        <h3 className="text-sm font-black text-slate-900 uppercase text-center border-b pb-2">
                          إقرار وتعهد استلام الراتب والمستحقات الماليّة
                        </h3>
                        
                        <p className="text-xs text-slate-800 leading-relaxed font-medium text-right">
                          أقر أنا الموظف: <strong className="text-slate-950 font-black underline">{selectedDoc.metadata?.employeeName || "الموظف"}</strong> 
                          بأنني قد استلمت كامل مستحقاتي المالية عن شهر <strong>{selectedDoc.metadata?.month || "2026-06"}</strong> 
                          بإجمالي صافي راتب قدره: <strong className="text-emerald-800 font-mono font-black text-sm">EGP {Number(selectedDoc.metadata?.netSalary || 0).toLocaleString()}</strong>، 
                          وليس لي أي مطالبات مالية أخرى عن هذه الفترة تجاه إدارة الشركة.
                        </p>

                        <div className="grid grid-cols-2 gap-4 pt-6 text-xs font-bold border-t border-slate-300">
                          <div>
                            <p className="text-slate-500 mb-1">اسم الموظف / Employee Name:</p>
                            <p className="text-slate-900 font-black">{selectedDoc.metadata?.employeeName}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 mb-1">المسمى الوظيفي / Position:</p>
                            <p className="text-slate-900 font-black">{selectedDoc.metadata?.employeeRole || "Store Staff"}</p>
                          </div>
                          <div className="pt-4">
                            <p className="text-slate-500 mb-1">توقيع الموظف / Employee Signature:</p>
                            <div className="h-12 border-b-2 border-slate-900"></div>
                          </div>
                          <div className="pt-4">
                            <p className="text-slate-500 mb-1">توقيع اعتماد المدير / Manager Approval:</p>
                            <div className="h-12 border-b-2 border-slate-900"></div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 text-center text-[10px] text-slate-400 font-mono">
                        ANH REPORTS • OFFICIAL 2-PAGE EXECUTIVE PAYSLIP PACKET • REF #{selectedDoc.serialNumber}
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
