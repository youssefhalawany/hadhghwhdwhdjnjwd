"use client";

import React, { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { 
  FileText, 
  Send, 
  Paperclip, 
  DollarSign, 
  Receipt, 
  CreditCard, 
  Sparkles, 
  User, 
  Building, 
  CheckCircle,
  FileCheck2,
  Calendar,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { PageTransition } from "@/components/PageTransition";
import { playPopSound } from "@/lib/sounds";
import { triggerHapticFeedback } from "@/lib/pwaBadges";

type DocType = "payslip" | "payment_receipt" | "credit_receipt" | "custom";

export default function AdminSendDocumentPage() {
  const [docType, setDocType] = useState<DocType>("payslip");
  const [targetBranch, setTargetBranch] = useState("all");
  const [targetManager, setTargetManager] = useState("all");
  const [loading, setLoading] = useState(false);

  // Common Fields
  const [title, setTitle] = useState("Monthly Employee Payslip");
  const [subtitle, setSubtitle] = useState("Salary statement for July 2026");
  const [note, setNote] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState<"none" | "image" | "pdf">("none");

  // Payslip Fields
  const [employeeName, setEmployeeName] = useState("");
  const [employeeRole, setEmployeeRole] = useState("Store Manager");
  const [month, setMonth] = useState(new Date().toLocaleString("en-US", { month: "long", year: "numeric" }));
  const [baseSalary, setBaseSalary] = useState("");
  const [bonuses, setBonuses] = useState("");
  const [deductions, setDeductions] = useState("");

  // Receipt Fields
  const [supplierName, setSupplierName] = useState("");
  const [amount, setAmount] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const handleDocTypeChange = (type: DocType) => {
    triggerHapticFeedback(8);
    playPopSound();
    setDocType(type);
    if (type === "payslip") {
      setTitle("Monthly Employee Payslip");
      setSubtitle(`Salary statement for ${month}`);
    } else if (type === "payment_receipt") {
      setTitle("Official Payment Voucher");
      setSubtitle("Vendor payment clearance receipt");
    } else if (type === "credit_receipt") {
      setTitle("Official Credit Statement");
      setSubtitle("Vendor credit note acknowledgment");
    } else {
      setTitle("Official Executive Memorandum");
      setSubtitle("Administrative notice & directives");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a document title");
      return;
    }

    setLoading(true);
    triggerHapticFeedback([20, 50, 20]);

    try {
      const serialNumber = `DOC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

      // Calculate net salary if payslip
      let calculatedNet = 0;
      if (docType === "payslip") {
        const base = Number(baseSalary) || 0;
        const add = Number(bonuses) || 0;
        const sub = Number(deductions) || 0;
        calculatedNet = base + add - sub;
      }

      const payload: any = {
        serialNumber,
        docType,
        title: title.trim(),
        subtitle: subtitle.trim(),
        targetBranch,
        targetManager,
        senderName: auth.currentUser?.displayName || "Admin Operations",
        senderEmail: auth.currentUser?.email || "admin@circlek.eg",
        fileUrl: fileUrl.trim() || null,
        fileType,
        note: note.trim(),
        createdAt: new Date().toISOString(),
        printedCount: 0,
        status: "unread",
        metadata: {}
      };

      if (docType === "payslip") {
        payload.metadata = {
          employeeName: employeeName.trim() || "Store Manager",
          employeeRole,
          month,
          baseSalary: Number(baseSalary) || 0,
          bonuses: Number(bonuses) || 0,
          deductions: Number(deductions) || 0,
          netSalary: calculatedNet
        };
      } else if (docType === "payment_receipt" || docType === "credit_receipt") {
        payload.metadata = {
          supplierName: supplierName.trim() || "Vendor",
          amount: Number(amount) || 0,
          invoiceNumber: invoiceNumber.trim() || "N/A",
          paymentMethod
        };
      }

      // 1. Add to admin_dispatches Firestore Collection
      await addDoc(collection(db, "admin_dispatches"), payload);

      // 2. Add to Notifications collection for real-time manager alerts
      await addDoc(collection(db, "notifications"), {
        title: `📄 New Official Document: ${title}`,
        body: `${subtitle} (Ref #${serialNumber})`,
        createdAt: new Date().toISOString(),
        url: "/manager/documents",
        type: "official_document"
      });

      // 3. Trigger Push Notification to all Manager Devices
      fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `📄 Official Document Received`,
          body: `${title} - Serial #${serialNumber}`,
          url: "/manager/documents"
        })
      }).catch(err => console.debug("Push dispatch error:", err));

      toast.success(`Official document ${serialNumber} sent to Manager!`);

      // Reset Form
      setNote("");
      setFileUrl("");
      setEmployeeName("");
      setBaseSalary("");
      setBonuses("");
      setDeductions("");
      setAmount("");
      setInvoiceNumber("");
      setSupplierName("");

    } catch (err: any) {
      console.error("Failed to send document:", err);
      toast.error("Failed to send document: " + (err.message || "Error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#050814] text-slate-100 p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        
        {/* Header Title Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" /> Executive Dispatch Console
            </span>
            <h1 className="text-xl md:text-2xl font-black text-white mt-1.5 tracking-tight">
              Send Official Document to Manager
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Compose payslips, payment receipts, credit statements, or custom PDF/Image dispatches for manager printing.
            </p>
          </div>
        </div>

        {/* Document Type Selector Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => handleDocTypeChange("payslip")}
            className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all active:scale-95 ${
              docType === "payslip"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10"
                : "bg-[#0B1121] border-[#1E293B] text-slate-400 hover:text-white"
            }`}
          >
            <DollarSign className="w-5 h-5" />
            <div>
              <p className="text-xs font-black">Payroll Payslip</p>
              <p className="text-[10px] opacity-75">Salary & Bonus statement</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleDocTypeChange("payment_receipt")}
            className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all active:scale-95 ${
              docType === "payment_receipt"
                ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-lg shadow-cyan-500/10"
                : "bg-[#0B1121] border-[#1E293B] text-slate-400 hover:text-white"
            }`}
          >
            <Receipt className="w-5 h-5" />
            <div>
              <p className="text-xs font-black">Payment Receipt</p>
              <p className="text-[10px] opacity-75">Vendor payment clearance</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleDocTypeChange("credit_receipt")}
            className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all active:scale-95 ${
              docType === "credit_receipt"
                ? "bg-purple-500/15 border-purple-500/40 text-purple-400 shadow-lg shadow-purple-500/10"
                : "bg-[#0B1121] border-[#1E293B] text-slate-400 hover:text-white"
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <div>
              <p className="text-xs font-black">Credit Statement</p>
              <p className="text-[10px] opacity-75">Vendor credit note</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleDocTypeChange("custom")}
            className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all active:scale-95 ${
              docType === "custom"
                ? "bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/10"
                : "bg-[#0B1121] border-[#1E293B] text-slate-400 hover:text-white"
            }`}
          >
            <FileText className="w-5 h-5" />
            <div>
              <p className="text-xs font-black">Custom Notice</p>
              <p className="text-[10px] opacity-75">PDF / Image / Text memo</p>
            </div>
          </button>
        </div>

        {/* Main Compose Form */}
        <form onSubmit={handleSubmit} className="p-5 md:p-6 rounded-3xl bg-[#0B1121] border border-[#1E293B] shadow-2xl space-y-5">
          
          {/* Target Branch Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-cyan-400" /> Target Branch
              </label>
              <select
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#1E293B] text-xs font-bold text-white outline-none focus:border-cyan-400"
              >
                <option value="all">🏢 All Store Branches (Broadcast)</option>
                <option value="alamein4">El Alamein 4</option>
                <option value="ola">Ola El Koronfol</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" /> Target Manager Role / Account
              </label>
              <select
                value={targetManager}
                onChange={(e) => setTargetManager(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#1E293B] text-xs font-bold text-white outline-none focus:border-cyan-400"
              >
                <option value="all">👥 All Active Managers</option>
                <option value="store_manager">Store Manager</option>
                <option value="assistant_manager">Assistant Manager</option>
                <option value="shift_leader">Shift Supervisor</option>
              </select>
            </div>
          </div>

          {/* Document Title & Subtitle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Document Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Monthly Payslip - July 2026"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#1E293B] text-xs font-bold text-white outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Subtitle / Reference Summary</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Approved Salary Disbursement"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#1E293B] text-xs font-bold text-white outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Dynamic Form Sections based on docType */}
          {docType === "payslip" && (
            <div className="p-4 rounded-2xl bg-[#0F172A] border border-emerald-500/20 space-y-4">
              <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> Employee Salary Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Employee Name</label>
                  <input
                    type="text"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    placeholder="e.g. Ahmed Mahmoud"
                    className="w-full px-3 py-2 rounded-xl bg-[#0B1121] border border-[#1E293B] text-xs font-bold text-white outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Role / Position</label>
                  <input
                    type="text"
                    value={employeeRole}
                    onChange={(e) => setEmployeeRole(e.target.value)}
                    placeholder="Store Manager"
                    className="w-full px-3 py-2 rounded-xl bg-[#0B1121] border border-[#1E293B] text-xs font-bold text-white outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Pay Period / Month</label>
                  <input
                    type="text"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    placeholder="July 2026"
                    className="w-full px-3 py-2 rounded-xl bg-[#0B1121] border border-[#1E293B] text-xs font-bold text-white outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Base Salary (EGP)</label>
                  <input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="12000"
                    className="w-full px-3 py-2 rounded-xl bg-[#0B1121] border border-[#1E293B] text-xs font-bold text-emerald-400 outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Bonuses & Allowances (EGP)</label>
                  <input
                    type="number"
                    value={bonuses}
                    onChange={(e) => setBonuses(e.target.value)}
                    placeholder="1500"
                    className="w-full px-3 py-2 rounded-xl bg-[#0B1121] border border-[#1E293B] text-xs font-bold text-cyan-400 outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Deductions / Advances (EGP)</label>
                  <input
                    type="number"
                    value={deductions}
                    onChange={(e) => setDeductions(e.target.value)}
                    placeholder="500"
                    className="w-full px-3 py-2 rounded-xl bg-[#0B1121] border border-[#1E293B] text-xs font-bold text-rose-400 outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {(docType === "payment_receipt" || docType === "credit_receipt") && (
            <div className="p-4 rounded-2xl bg-[#0F172A] border border-cyan-500/20 space-y-4">
              <h3 className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4" /> Vendor Receipt Breakdown
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Supplier / Vendor Name</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Juhayna Food Industries"
                    className="w-full px-3 py-2 rounded-xl bg-[#0B1121] border border-[#1E293B] text-xs font-bold text-white outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Amount (EGP)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="8500"
                    className="w-full px-3 py-2 rounded-xl bg-[#0B1121] border border-[#1E293B] text-xs font-bold text-cyan-400 outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Invoice / Ref Number</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="INV-99201"
                    className="w-full px-3 py-2 rounded-xl bg-[#0B1121] border border-[#1E293B] text-xs font-bold text-white outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Optional Attachment & Notes */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-amber-400" /> Attached Image / PDF URL (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://... image or PDF document link"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#1E293B] text-xs font-bold text-white outline-none focus:border-cyan-400 font-mono"
                />
                <select
                  value={fileType}
                  onChange={(e: any) => setFileType(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-[#0F172A] border border-[#1E293B] text-xs font-bold text-slate-300 outline-none"
                >
                  <option value="none">No File</option>
                  <option value="image">Image</option>
                  <option value="pdf">PDF Link</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Executive Instructions / Remarks</label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Enter specific instructions or remarks for the manager regarding this document..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#1E293B] text-xs text-white outline-none focus:border-cyan-400 resize-none font-medium"
              />
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black text-sm shadow-xl shadow-cyan-500/20 hover:opacity-95 transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? "Dispatching Official Document..." : "Dispatch Document to Manager Portal"}
          </button>
        </form>
      </div>
    </PageTransition>
  );
}
