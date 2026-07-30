"use client";

import React, { useState, useEffect, useRef } from "react";
import { collection, addDoc, query, orderBy, limit, getDocs } from "firebase/firestore";
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
  Upload,
  CheckCircle,
  FileCheck2,
  Trash2,
  Search,
  ListFilter
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

  // Existing Records fetched from database
  const [existingPayments, setExistingPayments] = useState<any[]>([]);
  const [existingCredits, setExistingCredits] = useState<any[]>([]);
  const [existingEmployees, setExistingEmployees] = useState<any[]>([]);
  const [fetchingRecords, setFetchingRecords] = useState(true);

  // Selection dropdown state
  const [selectedRecordId, setSelectedRecordId] = useState("");

  // Common Fields
  const [title, setTitle] = useState("Monthly Employee Payslip");
  const [subtitle, setSubtitle] = useState("Salary statement for July 2026");
  const [note, setNote] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState<"none" | "image" | "pdf">("none");
  const [fileName, setFileName] = useState("");

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing records from database on mount
  useEffect(() => {
    async function loadData() {
      setFetchingRecords(true);
      try {
        // Fetch Cash Payments
        const paymentsSnap = await getDocs(query(collection(db, "cash_payments"), orderBy("createdAt", "desc"), limit(50)));
        setExistingPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Credits
        const creditsSnap = await getDocs(query(collection(db, "credits"), orderBy("createdAt", "desc"), limit(50)));
        setExistingCredits(creditsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Employees / Cashiers / Managers
        const usersSnap = await getDocs(query(collection(db, "users"), limit(50)));
        const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Also fetch from employees if available
        try {
          const empSnap = await getDocs(query(collection(db, "employees"), limit(50)));
          empSnap.docs.forEach(d => {
            const data = d.data();
            if (!usersList.some((u: any) => u.name === data.name || u.email === data.email)) {
              usersList.push({ id: d.id, ...data });
            }
          });
        } catch (e) {}

        setExistingEmployees(usersList);

      } catch (err) {
        console.error("Error loading existing records:", err);
      } finally {
        setFetchingRecords(false);
      }
    }

    loadData();
  }, []);

  const handleDocTypeChange = (type: DocType) => {
    triggerHapticFeedback(8);
    playPopSound();
    setDocType(type);
    setSelectedRecordId("");

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

  // Handle Select Existing Employee / Payslip
  const handleSelectEmployee = (id: string) => {
    setSelectedRecordId(id);
    const emp = existingEmployees.find(e => e.id === id);
    if (emp) {
      triggerHapticFeedback(10);
      setEmployeeName(emp.displayName || emp.name || emp.email || "Employee");
      setEmployeeRole(emp.role || "Store Staff");
      setBaseSalary(String(emp.baseSalary || emp.salary || 10000));
      setBonuses(String(emp.bonuses || 0));
      setDeductions(String(emp.deductions || 0));
      setTitle(`Payslip - ${emp.displayName || emp.name || "Employee"}`);
      setSubtitle(`Salary statement for ${month}`);
      toast.success(`Populated details for ${emp.displayName || emp.name}`);
    }
  };

  // Handle Select Existing Payment
  const handleSelectPayment = (id: string) => {
    setSelectedRecordId(id);
    const p = existingPayments.find(item => item.id === id);
    if (p) {
      triggerHapticFeedback(10);
      setSupplierName(p.companyName || p.supplierName || "Vendor");
      setAmount(String(p.total || p.amount || 0));
      setInvoiceNumber(p.invoiceNumber || p.poNumber || id.substring(0, 8));
      setPaymentMethod(p.method || p.paymentMethod || "Cash");
      setTitle(`Payment Receipt - ${p.companyName || "Vendor"}`);
      setSubtitle(`Voucher EGP ${Number(p.total || p.amount || 0).toLocaleString()} (Inv #${p.invoiceNumber || id.substring(0,6)})`);
      if (p.poImageUrl || p.receiptUrl || p.bankTransferReceiptUrl) {
        setFileUrl(p.poImageUrl || p.receiptUrl || p.bankTransferReceiptUrl);
        setFileType("image");
        setFileName("Existing Receipt Attachment");
      }
      toast.success(`Loaded payment record for ${p.companyName}`);
    }
  };

  // Handle Select Existing Credit Note
  const handleSelectCredit = (id: string) => {
    setSelectedRecordId(id);
    const c = existingCredits.find(item => item.id === id);
    if (c) {
      triggerHapticFeedback(10);
      setSupplierName(c.companyName || c.supplierName || "Vendor");
      setAmount(String(c.amountDue || c.total || 0));
      setInvoiceNumber(c.invoiceNumber || id.substring(0, 8));
      setTitle(`Credit Statement - ${c.companyName || "Vendor"}`);
      setSubtitle(`Credit Note EGP ${Number(c.amountDue || c.total || 0).toLocaleString()}`);
      if (c.attachmentUrl || c.imageUrl) {
        setFileUrl(c.attachmentUrl || c.imageUrl);
        setFileType("image");
        setFileName("Credit Voucher Image");
      }
      toast.success(`Loaded credit note for ${c.companyName}`);
    }
  };

  // Native File Upload Handler (Image or PDF)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error("File size must be under 8MB");
      return;
    }

    triggerHapticFeedback([15, 30]);
    setFileName(file.name);

    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    setFileType(isPdf ? "pdf" : "image");

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      setFileUrl(base64Data);
      toast.success(`Uploaded ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setFileUrl("");
    setFileType("none");
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        fileName: fileName || null,
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

      // Save to admin_dispatches Firestore Collection
      await addDoc(collection(db, "admin_dispatches"), payload);

      // Add to Notifications for real-time alerts
      await addDoc(collection(db, "notifications"), {
        title: `📄 New Official Document: ${title}`,
        body: `${subtitle} (Ref #${serialNumber})`,
        createdAt: new Date().toISOString(),
        url: "/manager/documents",
        type: "official_document"
      });

      // Trigger Lock Screen Push Notification
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

      // Reset
      setNote("");
      handleRemoveFile();
      setSelectedRecordId("");

    } catch (err: any) {
      console.error("Failed to send document:", err);
      toast.error("Failed to send document: " + (err.message || "Error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#050814] text-slate-100 p-4 md:p-8 max-w-4xl mx-auto space-y-6 pb-24">
        
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
              Select directly from existing app records or upload custom PDF/Images to send official printable receipts.
            </p>
          </div>
        </div>

        {/* Document Type Selector Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => handleDocTypeChange("payslip")}
            className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all active:scale-95 cursor-pointer ${
              docType === "payslip"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10"
                : "bg-[#0B1121] border-[#1E293B] text-slate-400 hover:text-white"
            }`}
          >
            <DollarSign className="w-5 h-5" />
            <div>
              <p className="text-xs font-black">Payroll Payslip</p>
              <p className="text-[10px] opacity-75">Pick from Employees</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleDocTypeChange("payment_receipt")}
            className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all active:scale-95 cursor-pointer ${
              docType === "payment_receipt"
                ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-lg shadow-cyan-500/10"
                : "bg-[#0B1121] border-[#1E293B] text-slate-400 hover:text-white"
            }`}
          >
            <Receipt className="w-5 h-5" />
            <div>
              <p className="text-xs font-black">Payment Receipt</p>
              <p className="text-[10px] opacity-75">Pick from Payment Logs</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleDocTypeChange("credit_receipt")}
            className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all active:scale-95 cursor-pointer ${
              docType === "credit_receipt"
                ? "bg-purple-500/15 border-purple-500/40 text-purple-400 shadow-lg shadow-purple-500/10"
                : "bg-[#0B1121] border-[#1E293B] text-slate-400 hover:text-white"
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <div>
              <p className="text-xs font-black">Credit Statement</p>
              <p className="text-[10px] opacity-75">Pick from Credit Notes</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleDocTypeChange("custom")}
            className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all active:scale-95 cursor-pointer ${
              docType === "custom"
                ? "bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/10"
                : "bg-[#0B1121] border-[#1E293B] text-slate-400 hover:text-white"
            }`}
          >
            <FileText className="w-5 h-5" />
            <div>
              <p className="text-xs font-black">Custom File Upload</p>
              <p className="text-[10px] opacity-75">Upload PDF / Image File</p>
            </div>
          </button>
        </div>

        {/* SELECT FROM EXISTING APP RECORDS BANNER */}
        <div className="p-4 rounded-3xl bg-[#0B1121] border border-[#1E293B] shadow-2xl space-y-4">
          
          {docType === "payslip" && (
            <div>
              <label className="text-xs font-black text-emerald-400 block mb-1.5 flex items-center gap-1.5">
                <ListFilter className="w-4 h-4" /> Pick Existing Staff / Employee from App Database
              </label>
              <select
                value={selectedRecordId}
                onChange={(e) => handleSelectEmployee(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-emerald-500/30 text-xs font-bold text-white outline-none focus:border-emerald-400 cursor-pointer"
              >
                <option value="">-- Choose Existing Employee --</option>
                {existingEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    👤 {emp.displayName || emp.name || emp.email} ({emp.role || "Staff"}) - Base EGP {emp.baseSalary || emp.salary || 10000}
                  </option>
                ))}
              </select>
            </div>
          )}

          {docType === "payment_receipt" && (
            <div>
              <label className="text-xs font-black text-cyan-400 block mb-1.5 flex items-center gap-1.5">
                <ListFilter className="w-4 h-4" /> Pick Existing Payment Log from App Database
              </label>
              <select
                value={selectedRecordId}
                onChange={(e) => handleSelectPayment(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-cyan-500/30 text-xs font-bold text-white outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="">-- Choose Existing Cash Payment Log --</option>
                {existingPayments.map((p) => (
                  <option key={p.id} value={p.id}>
                    💵 {p.companyName || p.supplierName} - EGP {Number(p.total || p.amount || 0).toLocaleString()} (Inv #{p.invoiceNumber || p.id.substring(0, 6)}) - {p.date || "Recent"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {docType === "credit_receipt" && (
            <div>
              <label className="text-xs font-black text-purple-400 block mb-1.5 flex items-center gap-1.5">
                <ListFilter className="w-4 h-4" /> Pick Existing Credit Note from App Database
              </label>
              <select
                value={selectedRecordId}
                onChange={(e) => handleSelectCredit(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-purple-500/30 text-xs font-bold text-white outline-none focus:border-purple-400 cursor-pointer"
              >
                <option value="">-- Choose Existing Credit Note --</option>
                {existingCredits.map((c) => (
                  <option key={c.id} value={c.id}>
                    💳 {c.companyName || c.supplierName} - EGP {Number(c.amountDue || c.total || 0).toLocaleString()} (Inv #{c.invoiceNumber || c.id.substring(0, 6)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Target Branch Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#1E293B]">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-cyan-400" /> Target Branch
              </label>
              <select
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#1E293B] text-xs font-bold text-white outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="all">🏢 All Store Branches (Broadcast)</option>
                <option value="alamein4">El Alamein 4</option>
                <option value="ola">Ola El Koronfol</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" /> Target Manager Account
              </label>
              <select
                value={targetManager}
                onChange={(e) => setTargetManager(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-[#1E293B] text-xs font-bold text-white outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="all">👥 All Active Managers</option>
                <option value="store_manager">Store Manager</option>
                <option value="assistant_manager">Assistant Manager</option>
              </select>
            </div>
          </div>
        </div>

        {/* Compose / Edit Details Form */}
        <form onSubmit={handleSubmit} className="p-5 md:p-6 rounded-3xl bg-[#0B1121] border border-[#1E293B] shadow-2xl space-y-5">
          
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

          {/* Dynamic Form Fields */}
          {docType === "payslip" && (
            <div className="p-4 rounded-2xl bg-[#0F172A] border border-emerald-500/20 space-y-4">
              <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> Employee Salary Breakdown
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
                <Receipt className="w-4 h-4" /> Vendor Receipt Details
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

          {/* DIRECT NATIVE FILE UPLOAD SECTION (IMAGE / PDF) */}
          <div className="p-4 rounded-2xl bg-[#0F172A] border border-amber-500/20 space-y-3">
            <label className="text-xs font-black text-amber-400 block flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Upload className="w-4 h-4" /> Upload Image / PDF Document File
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Supports JPG, PNG, PDF (Max 8MB)</span>
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />

            {!fileUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 rounded-2xl border-2 border-dashed border-[#1E293B] hover:border-amber-500/50 bg-[#0B1121] text-slate-400 hover:text-amber-400 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
              >
                <Upload className="w-6 h-6 text-slate-500 group-hover:text-amber-400 transition-colors" />
                <span className="text-xs font-bold">Tap here to choose Image or PDF from device</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-[#0B1121] border border-amber-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {fileType === "image" ? (
                    <img src={fileUrl} alt="Upload preview" className="w-12 h-12 object-cover rounded-lg border border-[#1E293B] shrink-0" />
                  ) : (
                    <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{fileName || "Uploaded File"}</p>
                    <span className="text-[10px] text-amber-400 uppercase font-mono font-bold">{fileType} File Attached</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-2 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
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
