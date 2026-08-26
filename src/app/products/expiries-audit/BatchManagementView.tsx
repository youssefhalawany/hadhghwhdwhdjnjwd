"use client";

import React, { useState } from "react";
import { 
  Package, 
  Search, 
  Printer, 
  Calendar, 
  Building2, 
  FileText, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  Check, 
  Plus, 
  Eye, 
  X, 
  Sparkles,
  ShieldCheck,
  Hash,
  ShoppingBag
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import QRCode from "react-qr-code";
import toast from "react-hot-toast";

interface BatchItem {
  id: string;
  batchId: string;
  supplier: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalItemsCount?: number;
  totalQuantityCount?: number;
  branchId?: string;
  storeId?: string;
  createdBy?: string;
  createdAt: string;
  status?: string;
}

interface Props {
  batches: BatchItem[];
  allExpiries: any[];
  currentBranch: string;
  onIntakeClick: () => void;
  onAuditAction: (item: any, action: "destroy" | "return" | "sold") => void;
}

export function BatchManagementView({
  batches,
  allExpiries,
  currentBranch,
  onIntakeClick,
  onAuditAction,
}: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatchForModal, setSelectedBatchForModal] = useState<BatchItem | null>(null);
  const [selectedBatchForPrint, setSelectedBatchForPrint] = useState<BatchItem | null>(null);
  const [copiedBatchId, setCopiedBatchId] = useState<string | null>(null);

  // Filter batches
  const filteredBatches = batches.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (b.batchId || "").toLowerCase().includes(q) ||
      (b.supplier || "").toLowerCase().includes(q) ||
      (b.invoiceNumber || "").toLowerCase().includes(q) ||
      (b.createdBy || "").toLowerCase().includes(q)
    );
  });

  // Get items belonging to a batch
  const getBatchItems = (batch: BatchItem) => {
    return allExpiries.filter(
      (e) => e.batchId === batch.batchId || e.batchDocId === batch.id
    );
  };

  // Copy batch ID helper
  const handleCopyBatchId = (batchId: string) => {
    navigator.clipboard.writeText(batchId);
    setCopiedBatchId(batchId);
    toast.success(isAr ? "تم نسخ كود الدفعة!" : "Batch ID copied to clipboard!");
    setTimeout(() => setCopiedBatchId(null), 2000);
  };

  // Trigger print for a specific batch
  const handlePrintBatch = (batch: BatchItem) => {
    setSelectedBatchForPrint(batch);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="w-full space-y-6" dir={isAr ? "rtl" : "ltr"}>
      {/* Printable Batch Receipt A4 - Only appears in print dialog */}
      {selectedBatchForPrint && (
        <div id="batch-printable-receipt" className="hidden print:block w-full bg-white text-slate-900 font-sans" dir="ltr">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm !important;
              }
              body, html {
                background: #ffffff !important;
                background-color: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              main, .custom-scrollbar, #__next, div:not(#batch-printable-receipt):not(#batch-printable-receipt *) {
                background: transparent !important;
                background-color: transparent !important;
                border: none !important;
                box-shadow: none !important;
              }
              .print\\:hidden, nav, header, aside, .sidebar, footer, .no-print {
                display: none !important;
              }
              #batch-printable-receipt {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 auto !important;
                padding: 0 !important;
                background: #ffffff !important;
                background-color: #ffffff !important;
                color: #000000 !important;
                border: none !important;
              }
              table {
                page-break-inside: auto;
                width: 100% !important;
                border-collapse: collapse !important;
              }
              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
              thead {
                display: table-header-group;
              }
            }
          `}} />

          {(() => {
            const batch = selectedBatchForPrint;
            const batchItems = getBatchItems(batch);
            const totalUnits = batchItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0) || batch.totalQuantityCount || 0;
            const branchLabel = currentBranch === "all" ? "HQ Portal" : (currentBranch === "ola" ? "Ola El Koronfol" : "Alamein 4");
            const qrPayload = JSON.stringify({
              batchId: batch.batchId,
              supplier: batch.supplier,
              po: batch.invoiceNumber,
              date: batch.invoiceDate || batch.createdAt,
              itemsCount: batchItems.length,
              units: totalUnits,
              branch: branchLabel,
            });

            return (
              <div className="w-full space-y-4">
                {/* Official Header */}
                <div className="flex justify-between items-start border-b border-gray-300 pb-3">
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-red-600 leading-none">CIRCLE K</h1>
                    <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mt-1">
                      {branchLabel} — Operations Management
                    </p>
                    <p className="text-[9px] text-gray-500 font-mono mt-0.5">
                      OFFICIAL GOODS RECEIVING & EXPIRY BATCH RECORD
                    </p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-base font-bold text-gray-900 tracking-tight">إذن استلام دفعة بضاعة وتوثيق الصلاحيات</h2>
                    <p className="text-[11px] font-mono font-bold text-indigo-700 mt-0.5">{batch.batchId}</p>
                    <p className="text-[9px] text-gray-500">Date: {new Date().toLocaleDateString('en-GB')} | {new Date().toLocaleTimeString()}</p>
                  </div>
                </div>

                {/* Batch Metadata Cards */}
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="p-2 border border-gray-200 rounded">
                    <span className="text-[8px] text-gray-500 font-bold uppercase block">Supplier / المورد</span>
                    <span className="text-xs font-black text-gray-900 mt-0.5 block truncate">{batch.supplier}</span>
                  </div>
                  <div className="p-2 border border-gray-200 rounded">
                    <span className="text-[8px] text-gray-500 font-bold uppercase block">PO / Invoice #</span>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-0.5 block">{batch.invoiceNumber || "N/A"}</span>
                  </div>
                  <div className="p-2 border border-gray-200 rounded">
                    <span className="text-[8px] text-gray-500 font-bold uppercase block">Receiving Date</span>
                    <span className="text-xs font-mono font-bold text-gray-900 mt-0.5 block">{batch.invoiceDate || batch.createdAt?.split("T")[0]}</span>
                  </div>
                  <div className="p-2 border border-gray-200 rounded text-right">
                    <span className="text-[8px] text-gray-500 font-bold uppercase block">Total Items & Units</span>
                    <span className="text-xs font-bold text-gray-900 mt-0.5 block">
                      {batchItems.length} Items ({totalUnits} Units)
                    </span>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="w-full">
                  <table className="w-full text-left text-xs border border-gray-200">
                    <thead>
                      <tr className="border-b border-gray-300 bg-white">
                        <th className="p-1.5 font-bold text-gray-700 border-r border-gray-200 w-8">#</th>
                        <th className="p-1.5 font-bold text-gray-700 border-r border-gray-200">Product Name / اسم الصنف</th>
                        <th className="p-1.5 font-bold text-gray-700 border-r border-gray-200 w-28">Barcode / الكود</th>
                        <th className="p-1.5 font-bold text-gray-700 border-r border-gray-200 text-center w-16">Qty / الكمية</th>
                        <th className="p-1.5 font-bold text-gray-700 border-r border-gray-200 text-center w-20">Unit Cost</th>
                        <th className="p-1.5 font-bold text-gray-700 border-r border-gray-200 w-28">Expiry Date</th>
                        <th className="p-1.5 font-bold text-gray-700 text-center w-20">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchItems.map((item, idx) => {
                        const days = item.expiryDate ? Math.ceil((new Date(item.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
                        return (
                          <tr key={item.id} className="border-b border-gray-200 bg-white">
                            <td className="p-1.5 text-[10px] font-mono text-gray-500 border-r border-gray-200">{idx + 1}</td>
                            <td className="p-1.5 font-bold text-gray-900 border-r border-gray-200">{item.itemName}</td>
                            <td className="p-1.5 font-mono text-[10px] text-gray-700 border-r border-gray-200">{item.barcode || "-"}</td>
                            <td className="p-1.5 font-black text-gray-900 text-center border-r border-gray-200">{item.quantity}</td>
                            <td className="p-1.5 font-mono text-gray-700 text-center border-r border-gray-200">{item.unitPrice ? `${item.unitPrice} EGP` : "-"}</td>
                            <td className="p-1.5 font-mono font-bold text-red-600 border-r border-gray-200">{item.expiryDate || "-"}</td>
                            <td className="p-1.5 uppercase font-bold text-[9px] text-center text-gray-700">
                              {days <= 0 ? "EXPIRED" : days <= 15 ? "15D WARNING" : "SAFE"}
                            </td>
                          </tr>
                        );
                      })}
                      {batchItems.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-gray-500">No line items recorded for this batch.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Signatures & Stamp Section */}
                <div className="pt-4 border-t border-gray-300 flex justify-between items-end text-xs" style={{ pageBreakInside: 'avoid' }}>
                  <div className="flex items-center gap-2">
                    <QRCode value={qrPayload} size={48} level="L" />
                    <div>
                      <p className="text-[8px] font-bold text-gray-600 font-mono">BATCH: {batch.batchId}</p>
                      <p className="text-[7px] text-gray-400 font-mono">VERIFIED BY ANH SYSTEM V2.0</p>
                    </div>
                  </div>

                  <div className="text-center w-40">
                    <p className="text-[8px] text-gray-400 uppercase mb-6">Store Receiving Manager</p>
                    <div className="border-t border-gray-400 pt-0.5">
                      <p className="text-[8px] font-bold text-gray-700">{batch.createdBy || "Authorized Officer"}</p>
                    </div>
                  </div>

                  <div className="text-center w-40">
                    <p className="text-[8px] text-gray-400 uppercase mb-6">Supplier Representative</p>
                    <div className="border-t border-gray-400 pt-0.5">
                      <p className="text-[8px] font-bold text-gray-700">Delivery Representative</p>
                    </div>
                  </div>

                  <div className="w-32 border border-gray-300 rounded p-1.5 text-center">
                    <p className="text-[7px] text-gray-400 uppercase">Quality Stamp</p>
                    <div className="h-4"></div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Top Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Package className="text-indigo-400" size={26} />
            {isAr ? `دفعات التوريد المسجلة (${filteredBatches.length})` : `Registered PO Batches (${filteredBatches.length})`}
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {isAr
              ? "متابعة أذونات التوريد، فحص تواريخ الصلاحية، وطباعة أذونات الاستلام الرسمية لكل دفعة."
              : "Track supplier PO batches, monitor expiry lifecycles, and print official receiving records per batch."}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? "بحث بكود الدفعة، المورد، الفاتورة..." : "Search batch ID, supplier, PO#..."}
              className="w-full bg-[#0B1121] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white font-bold placeholder-slate-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <button
            onClick={onIntakeClick}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus size={14} /> {isAr ? "استلام دفعة جديدة" : "New PO Intake"}
          </button>
        </div>
      </div>

      {/* Batches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBatches.map((batch) => {
          const batchItems = getBatchItems(batch);
          const totalUnits = batchItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0) || batch.totalQuantityCount || 0;
          
          // Expiry breakdown
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const expiredCount = batchItems.filter((i) => {
            if (!i.expiryDate) return false;
            const exp = new Date(i.expiryDate);
            exp.setHours(0, 0, 0, 0);
            return exp.getTime() <= today.getTime() && !["sold", "pulled", "audited", "returned"].includes(i.status || "");
          }).length;

          const warningCount = batchItems.filter((i) => {
            if (!i.expiryDate) return false;
            const exp = new Date(i.expiryDate);
            exp.setHours(0, 0, 0, 0);
            const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return diff <= 15 && diff > 0 && !["sold", "pulled", "audited", "returned"].includes(i.status || "");
          }).length;

          const soldCount = batchItems.filter((i) => i.status === "sold").length;
          const activeCount = batchItems.filter((i) => !["sold", "pulled", "audited", "returned"].includes(i.status || "")).length;

          return (
            <div
              key={batch.id || batch.batchId}
              className="bg-[#0B1121] border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-5 shadow-xl space-y-4 transition-all duration-200 flex flex-col justify-between"
            >
              {/* Top Row: Batch ID badge + Copy */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    onClick={() => handleCopyBatchId(batch.batchId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-black tracking-wide cursor-pointer hover:bg-indigo-500/20 transition-colors truncate max-w-[240px]"
                    title={isAr ? "اضغط لنسخ كود الدفعة" : "Click to copy Batch ID"}
                  >
                    <Hash size={12} className="shrink-0 text-indigo-400" />
                    <span className="truncate">{batch.batchId}</span>
                    {copiedBatchId === batch.batchId ? (
                      <Check size={12} className="text-emerald-400 shrink-0" />
                    ) : (
                      <Copy size={12} className="text-slate-400 shrink-0" />
                    )}
                  </span>

                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    {batch.createdAt?.split("T")[0] || batch.invoiceDate || ""}
                  </span>
                </div>

                {/* Supplier & PO Info */}
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                    <Building2 size={18} className="text-indigo-400 shrink-0" />
                    <span className="truncate">{batch.supplier}</span>
                  </h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <FileText size={13} className="text-slate-500" />
                    <span>{isAr ? "رقم الفاتورة / الإذن:" : "PO / Invoice #:"}</span>
                    <strong className="text-slate-200 font-mono">{batch.invoiceNumber || "N/A"}</strong>
                  </p>
                </div>
              </div>

              {/* Middle Metrics */}
              <div className="grid grid-cols-2 gap-2 bg-[#070C18] border border-slate-800/80 rounded-2xl p-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{isAr ? "عدد الأصناف" : "Line Items"}</span>
                  <span className="text-sm font-black text-white mt-0.5 block">{batchItems.length || batch.totalItemsCount || 0} {isAr ? "صنف" : "Items"}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{isAr ? "إجمالي القطع" : "Total Units"}</span>
                  <span className="text-sm font-black text-indigo-300 font-mono mt-0.5 block">{totalUnits} {isAr ? "قطعة" : "Units"}</span>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                {expiredCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                    <AlertTriangle size={11} /> {expiredCount} {isAr ? "منتهي" : "Expired"}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <Clock size={11} /> {warningCount} {isAr ? "إنذار 15 يوم" : "15d Alert"}
                  </span>
                )}
                {soldCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                    <CheckCircle2 size={11} /> {soldCount} {isAr ? "تم بيعه" : "Sold"}
                  </span>
                )}
                {activeCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {activeCount} {isAr ? "نشط بالرادار" : "Active"}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                <button
                  onClick={() => setSelectedBatchForModal(batch)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye size={14} className="text-indigo-400" />
                  {isAr ? "عرض الأصناف" : "View Items"}
                </button>

                <button
                  onClick={() => handlePrintBatch(batch)}
                  className="px-3.5 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title={isAr ? "طباعة إذن استلام الدفعة A4" : "Print Batch A4 Receipt"}
                >
                  <Printer size={14} />
                  <span>{isAr ? "طباعة" : "Print"}</span>
                </button>
              </div>
            </div>
          );
        })}

        {filteredBatches.length === 0 && (
          <div className="col-span-full py-16 text-center bg-[#0B1121] border border-slate-800 rounded-3xl p-8 space-y-4">
            <Package size={48} className="mx-auto text-slate-600" />
            <h3 className="text-lg font-black text-white">
              {isAr ? "لا توجد دفعات توريد مسجلة حتى الآن" : "No Registered PO Batches Found"}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {isAr
                ? "قم برفع أول فاتورة توريد (PO) بالذكاء الاصطناعي لتوليد كود الدفعة وتسجيل الأصناف وتفعيل رادار الصلاحيات."
                : "Upload your first supplier PO invoice with AI to generate batch records and start tracking expiry lifecycles."}
            </p>
            <button
              onClick={onIntakeClick}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-xl shadow-indigo-600/30 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <Plus size={16} /> {isAr ? "استلام دفعة PO الآن" : "Scan PO Batch Now"}
            </button>
          </div>
        )}
      </div>

      {/* Detailed Batch Items Modal */}
      {selectedBatchForModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#0B1121] border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono font-black px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {selectedBatchForModal.batchId}
                </span>
                <h3 className="text-xl font-black text-white tracking-tight mt-1.5 flex items-center gap-2">
                  <Building2 className="text-indigo-400" size={20} />
                  {selectedBatchForModal.supplier}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr ? "رقم الفاتورة / الإذن:" : "Invoice / PO #:"}{" "}
                  <strong className="text-slate-200 font-mono">{selectedBatchForModal.invoiceNumber || "N/A"}</strong> •{" "}
                  {selectedBatchForModal.invoiceDate || selectedBatchForModal.createdAt?.split("T")[0]}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintBatch(selectedBatchForModal)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <Printer size={15} /> {isAr ? "طباعة إذن الدفعة" : "Print Batch"}
                </button>

                <button
                  onClick={() => setSelectedBatchForModal(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Items Table */}
            <div className="overflow-y-auto p-4 sm:p-6 flex-1 custom-scrollbar">
              {(() => {
                const items = getBatchItems(selectedBatchForModal);
                return (
                  <table className={`w-full text-xs ${isAr ? "text-right" : "text-left"}`}>
                    <thead>
                      <tr className="bg-[#070C18] border-b border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="p-3">#</th>
                        <th className="p-3">{isAr ? "اسم الصنف" : "Item Name"}</th>
                        <th className="p-3">{isAr ? "الباركود" : "Barcode"}</th>
                        <th className="p-3 text-center">{isAr ? "الكمية" : "Quantity"}</th>
                        <th className="p-3">{isAr ? "تاريخ الصلاحية" : "Expiry Date"}</th>
                        <th className="p-3">{isAr ? "حالة الرادار" : "Radar Status"}</th>
                        <th className="p-3 text-center">{isAr ? "إجراء سريع" : "Action"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {items.map((item, idx) => {
                        const days = item.expiryDate ? Math.ceil((new Date(item.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
                        const isExpired = days <= 0;
                        const is15Days = days <= 15 && days > 0;

                        return (
                          <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                            <td className="p-3 font-black text-white">{item.itemName}</td>
                            <td className="p-3 font-mono text-slate-400">{item.barcode || "N/A"}</td>
                            <td className="p-3 font-black text-center text-indigo-300 font-mono">{item.quantity}</td>
                            <td className="p-3 font-mono text-red-400 font-bold">{item.expiryDate || "-"}</td>
                            <td className="p-3">
                              {item.status === "sold" ? (
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                                  {isAr ? "تم بيعه" : "Sold"}
                                </span>
                              ) : isExpired ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                                  {isAr ? "منتهي الصلاحية" : "Expired"}
                                </span>
                              ) : is15Days ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                                  {isAr ? `ينتهي خلال ${days} يوم` : `${days}d Warning`}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                  {isAr ? `آمن (${days} يوم)` : `Safe (${days}d)`}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {item.status !== "sold" && item.status !== "pulled" && (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => onAuditAction(item, "sold")}
                                    className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    {isAr ? "بيع" : "Sold"}
                                  </button>
                                  <button
                                    onClick={() => onAuditAction(item, "destroy")}
                                    className="px-2 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    {isAr ? "سحب" : "Pull"}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                            {isAr ? "لا توجد أصناف مسجلة تحت هذه الدفعة" : "No items found for this batch"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#070C18] border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {isAr ? "كود الدفعة المعتمد لدى الإدارة:" : "Authorized Batch Reference:"}{" "}
                <strong className="text-indigo-300 font-mono">{selectedBatchForModal.batchId}</strong>
              </span>

              <button
                onClick={() => setSelectedBatchForModal(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
