"use client";

import React, { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, getDocs, getDoc, updateDoc, where, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Plus, Check, X, ShieldAlert, DollarSign, Calendar, Save, Trash2, CheckCircle2, Printer, Filter, ChevronRight, Share2, Send, FileText, Layers, Download, Pencil, Clock, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranch, BranchId } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";
import confetti from "canvas-confetti";

type PayrollRecord = {
  id?: string;
  employeeId: string;
  storeId?: string;
  month: string;
  days: number;
  standardPay: number;
  bonus: number;
  deductions: number;
  loanThisMonth: number;
  insurance: number;
  overtime: number;
  netPay: number;
  createdAt: string | any;
  createdBy: string;
  postedToFinanceAt?: string | any;
  paymentMethod: 'cash' | 'bank' | 'cheque';
  appliedDeductionIds?: string[];
  appliedLoanIds?: string[];
  appliedAdjustmentIds?: string[]; // for the new Adjustments system
  status?: string;
};

const SlideToRun = ({ onComplete }: { onComplete: () => void }) => {
  const [isSuccess, setIsSuccess] = useState(false);
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [0, 250],
    ["linear-gradient(90deg, #1e293b 0%, #0f172a 100%)", "linear-gradient(90deg, #059669 0%, #10b981 100%)"]
  );

  const handleDragEnd = (event: any, info: any) => {
    if (info.offset.x > 200) {
      setIsSuccess(true);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => onComplete(), 1000);
    } else {
      // snap back
    }
  };

  return (
    <div className="w-80 mx-auto">
      <motion.div style={{ background }} className="relative w-full h-16 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-700 shadow-inner">
        {!isSuccess && <span className="absolute z-0 text-slate-400 font-black tracking-widest uppercase text-sm ml-12">Slide to Run Payroll</span>}
        {isSuccess && <span className="absolute z-0 text-white font-black tracking-widest uppercase text-sm">Payroll Locked! 🎉</span>}
        
        {!isSuccess && (
          <motion.div
            drag="x"
            dragSnapToOrigin={true}
            dragConstraints={{ left: 0, right: 256 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            style={{ x }}
            className="absolute left-1 z-10 w-14 h-14 bg-white rounded-xl shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing"
          >
            <ChevronRight className="text-slate-800 w-6 h-6" />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default function AdminPayrollPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const { t } = useLanguage();
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<PayrollRecord[]>([]);
  const [paidLines, setPaidLines] = useState<PayrollRecord[]>([]);
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PayrollRecord>>({
    bonus: 0,
    days: 0,
    deductions: 0,
    insurance: 0,
    loanThisMonth: 0,
    overtime: 0,
    paymentMethod: "cash",
  });
  const [selectedEmp, setSelectedEmp] = useState<any>(null);

  const { currentBranch, availableBranches } = useBranch();
  const [filterBranch, setFilterBranch] = useState<BranchId | "all">("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");

  const [showPaidModal, setShowPaidModal] = useState<PayrollRecord | null>(null);
  const [paidDate, setPaidDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const [currentDate, setCurrentDate] = useState("");

  const [isPrinting, setIsPrinting] = useState(false);
  const [printPayslipRecord, setPrintPayslipRecord] = useState<PayrollRecord | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintPayslipRecord(null);
      setIsBatchPrinting(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    if (printPayslipRecord || isBatchPrinting) {
      const timer = setTimeout(() => {
        window.print();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [printPayslipRecord, isBatchPrinting]);

  const handleBatchWhatsApp = () => {
    if (filteredDrafts.length === 0) {
      toast.error("No pending drafts to share.");
      return;
    }

    const dateString = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const totalNet = filteredDrafts.reduce((acc, curr) => acc + (curr.netPay || 0), 0);

    let message = `*📊 PENDING PAYROLL SUMMARY - ${dateString}*\n`;
    message += `*Branch:* ${currentBranch === "all" ? "All Branches" : currentBranch}\n`;
    message += `*Total Employees Pending:* ${filteredDrafts.length}\n`;
    message += `*Total Pending Net Amount:* EGP ${totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n\n`;
    message += `*Employee Payout Breakdown:*\n`;

    filteredDrafts.forEach((d, idx) => {
      const emp = employees.find(e => e.id === d.employeeId);
      message += `${idx + 1}. *${emp?.name || d.employeeId}* (${d.month}): EGP ${(d.netPay || 0).toLocaleString()}\n`;
    });

    message += `\n_Generated via Circle K HR Management System_`;

    const encoded = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    toast.success("WhatsApp summary prepared!");
  };

  const handleTriggerBatchPrint = () => {
    if (filteredDrafts.length === 0) {
      toast.error("No pending drafts to print.");
      return;
    }
    setPrintPayslipRecord(null);
    setIsBatchPrinting(true);
  };

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

  useEffect(() => {
    setCurrentDate(new Date().toLocaleString('en-GB'));
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserEmail(user.email || "");
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const role = userDoc.data()?.role;
          setIsAdmin(role === "admin_editor" || role === "owner" || role === "admin");
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchEmps = async () => {
      try {
        const snap = await getDocs(collection(db, "employees"));
        setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching employees", err);
      }
    };
    fetchEmps();

    const unsubDrafts = onSnapshot(query(collection(db, "payroll_drafts"), limit(100)), (snap) => {
      setDrafts(snap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollRecord)).sort((a, b) => {
        const aTime = typeof a.createdAt === 'object' && a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt || "");
        const bTime = typeof b.createdAt === 'object' && b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt || "");
        return String(bTime).localeCompare(String(aTime));
      }));
    });

    const unsubLines = onSnapshot(query(collection(db, "payroll_lines"), orderBy("createdAt", "desc"), limit(100)), (snap) => {
      setPaidLines(snap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollRecord)));
    });

    return () => {
      unsubDrafts();
      unsubLines();
    };
  }, [isAdmin]);

  const fetchEmployeeDeductionsAndLoans = async (empId: string, monthStr: string) => {
    let totalDeductions = 0;
    let totalLoans = 0;
    const appliedDeductionIds: string[] = [];
    const appliedLoanIds: string[] = [];
    const appliedAdjustmentIds: string[] = [];

    try {
      // Unapplied deductions
      const dQ = query(collection(db, "deductions"), where("employeeId", "==", empId), where("applied", "==", false));
      const dSnap = await getDocs(dQ);
      dSnap.forEach(d => {
        totalDeductions += Number(d.data().amount) || 0;
        appliedDeductionIds.push(d.id);
      });

      // Loans for the month
      const lQ = query(collection(db, "loans"), where("employeeId", "==", empId));
      const lSnap = await getDocs(lQ);
      lSnap.forEach(l => {
        const data = l.data();
        if (data.date && data.date.startsWith(monthStr)) {
          totalLoans += Number(data.approved) || 0;
          appliedLoanIds.push(l.id);
        }
      });
      // NEW: Unified Adjustments System
      const adjQ = query(collection(db, "adjustments"), where("employeeId", "==", empId), where("status", "==", "pending"));
      const adjSnap = await getDocs(adjQ);
      
      adjSnap.forEach(a => {
        const data = a.data();
        if (data.type === "deduction") totalDeductions += (Number(data.amount) || 0);
        if (data.type === "loan") totalLoans += (Number(data.amount) || 0);
        appliedAdjustmentIds.push(a.id);
      });

    } catch (err) {
      console.error("Error fetching deductions/loans", err);
    }

    return { totalDeductions, totalLoans, appliedDeductionIds, appliedLoanIds, appliedAdjustmentIds };
  };

  const handleEmpSelect = async (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    
    setSelectedEmp(emp);
    
    const d = new Date();
    // Default to previous month if day < 15, else current month
    if (d.getDate() < 15) d.setMonth(d.getMonth() - 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const { totalDeductions, totalLoans, appliedDeductionIds, appliedLoanIds, appliedAdjustmentIds } = await fetchEmployeeDeductionsAndLoans(emp.id, monthStr);

    setEditForm({
      employeeId: emp.id,
      storeId: emp.storeId || "",
      month: monthStr,
      days: 30, // Default full month
      insurance: Number(emp.insurance) || 0,
      bonus: 0,
      deductions: totalDeductions,
      loanThisMonth: totalLoans,
      appliedDeductionIds,
      appliedLoanIds,
      appliedAdjustmentIds,
      overtime: 0,
      paymentMethod: "cash",
    });
  };

  const handleMonthChange = async (newMonth: string) => {
    setEditForm({ ...editForm, month: newMonth });
    if (selectedEmp) {
      const { totalDeductions, totalLoans, appliedDeductionIds, appliedLoanIds, appliedAdjustmentIds } = await fetchEmployeeDeductionsAndLoans(selectedEmp.id, newMonth);
      setEditForm(prev => ({
        ...prev,
        month: newMonth,
        deductions: totalDeductions,
        loanThisMonth: totalLoans,
        appliedDeductionIds,
        appliedLoanIds,
        appliedAdjustmentIds,
      }));
    }
  };

  // Auto-calculate Standard Pay and Net Pay
  const calcPays = () => {
    if (!selectedEmp) return { standardPay: 0, netPay: 0 };
    const base = Number(selectedEmp.baseSalary) || Number(selectedEmp.salary) || 3000;
    const days = Number(editForm.days) || 0;
    
    const standardPay = Math.round((base / 30) * days);
    const netPay = standardPay 
      + (Number(editForm.overtime) || 0) 
      + (Number(editForm.bonus) || 0) 
      - (Number(editForm.deductions) || 0) 
      - (Number(editForm.loanThisMonth) || 0) 
      - (Number(editForm.insurance) || 0);

    return { standardPay, netPay };
  };

  const handleEditDraft = (draft: PayrollRecord) => {
    const emp = employees.find(e => e.id === draft.employeeId);
    setSelectedEmp(emp || { id: draft.employeeId, name: draft.employeeId });
    setEditingDraftId(draft.id || null);
    setEditForm({
      employeeId: draft.employeeId,
      storeId: draft.storeId || emp?.storeId || "",
      month: draft.month,
      days: draft.days ?? 30,
      insurance: draft.insurance ?? (Number(emp?.insurance) || 0),
      bonus: draft.bonus ?? 0,
      deductions: draft.deductions ?? 0,
      loanThisMonth: draft.loanThisMonth ?? 0,
      overtime: draft.overtime ?? 0,
      paymentMethod: draft.paymentMethod || "cash",
      appliedDeductionIds: draft.appliedDeductionIds || [],
      appliedLoanIds: draft.appliedLoanIds || [],
      appliedAdjustmentIds: draft.appliedAdjustmentIds || [],
    });
    setIsAdding(true);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedEmp || !editForm.employeeId) {
      toast.error("Please select an employee");
      return;
    }

    const { standardPay, netPay } = calcPays();

    const record: PayrollRecord = {
      bonus: Number(editForm.bonus) || 0,
      createdAt: editingDraftId ? (editForm.createdAt || new Date().toLocaleString('en-GB', { timeZone: 'Africa/Cairo' })) : new Date().toLocaleString('en-GB', { timeZone: 'Africa/Cairo' }),
      createdBy: currentUserEmail,
      days: Number(editForm.days) || 0,
      deductions: Number(editForm.deductions) || 0,
      employeeId: editForm.employeeId,
      insurance: Number(editForm.insurance) || 0,
      loanThisMonth: Number(editForm.loanThisMonth) || 0,
      month: editForm.month || "",
      netPay,
      overtime: Number(editForm.overtime) || 0,
      paymentMethod: editForm.paymentMethod as any || "cash",
      standardPay,
      storeId: editForm.storeId || "",
      appliedDeductionIds: editForm.appliedDeductionIds || [],
      appliedLoanIds: editForm.appliedLoanIds || [],
      appliedAdjustmentIds: editForm.appliedAdjustmentIds || []
    };

    try {
      if (editingDraftId) {
        await updateDoc(doc(db, "payroll_drafts", editingDraftId), record);
        toast.success("Unpaid Draft updated successfully");
      } else {
        await addDoc(collection(db, "payroll_drafts"), record);
        toast.success("Saved as Unpaid Draft");
      }
      setIsAdding(false);
      setSelectedEmp(null);
      setEditingDraftId(null);
    } catch (err: any) {
      toast.error("Failed to save draft: " + err.message);
    }
  };

  const openMarkPaidModal = (draft: PayrollRecord) => {
    setShowPaidModal(draft);
    setPaidDate(new Date().toISOString().split("T")[0]);
  };

  const confirmMarkPaid = async () => {
    if (!showPaidModal) return;
    const draft = showPaidModal;

    try {
      // Create in payroll_lines
      const finalRecord = { ...draft };
      delete finalRecord.id;
      // Format selected date
      const selectedDate = new Date(paidDate);
      finalRecord.postedToFinanceAt = selectedDate.toLocaleString('en-GB', { timeZone: 'Africa/Cairo' });
      finalRecord.status = "paid";

      const newDocRef = await addDoc(collection(db, "payroll_lines"), finalRecord);
      
      // Apply deductions
      if (draft.appliedDeductionIds && draft.appliedDeductionIds.length > 0) {
        for (const dId of draft.appliedDeductionIds) {
          try {
            await updateDoc(doc(db, "deductions", dId), { applied: true, appliedPayrollId: newDocRef.id });
          } catch(e) { console.error("Failed to update deduction", dId, e); }
        }
      }

      // Apply New Adjustments (Unified)
      if (draft.appliedAdjustmentIds && draft.appliedAdjustmentIds.length > 0) {
        for (const adjId of draft.appliedAdjustmentIds) {
          try {
            await updateDoc(doc(db, "adjustments", adjId), { status: "applied", appliedPayrollId: newDocRef.id });
          } catch(e) { console.error("Failed to update adjustment", adjId, e); }
        }
      }

      // Delete from drafts
      if (draft.id) {
        await deleteDoc(doc(db, "payroll_drafts", draft.id));
      }
      
      toast.success("Payroll Marked as Paid and posted to Finance");
      setShowPaidModal(null);
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    }
  };

  const deleteDraft = async (id: string) => {
    if (!confirm("Delete this draft permanently?")) return;
    try {
      await deleteDoc(doc(db, "payroll_drafts", id));
      toast.success("Draft deleted");
    } catch (err: any) {
      toast.error("Failed to delete draft: " + err.message);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-[200px]" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2">Access Denied</h1>
        <p className="text-slate-500 max-w-md">You do not have administrative privileges to view or process the Payroll System.</p>
      </div>
    );
  }

  const isBranchMatch = (emp: any, recordStoreId: string | undefined, filter: string) => {
    if (filter === "all") return true;
    
    const legacyMap: Record<string, string> = {
      "alamein4": "eL-alamein-4",
      "ola": "ola-el-koronfol"
    };
    const legacyId = legacyMap[filter] || filter;

    if (emp?.branchId === filter) return true;
    if (emp?.storeId === legacyId || emp?.storeId === filter) return true;
    if (recordStoreId === filter || recordStoreId === legacyId) return true;

    return false;
  };

  const filteredDrafts = drafts.filter(d => {
    const emp = employees.find(e => e.id === d.employeeId);
    const branchMatch = isBranchMatch(emp, d.storeId, filterBranch);
    const monthMatch = filterMonth === "all" || d.month === filterMonth;
    return branchMatch && monthMatch;
  });

  const filteredLines = paidLines.filter(d => {
    const emp = employees.find(e => e.id === d.employeeId);
    const branchMatch = isBranchMatch(emp, d.storeId, filterBranch);
    const monthMatch = filterMonth === "all" || d.month === filterMonth;
    return branchMatch && monthMatch;
  });

  const allMonths = Array.from(new Set([...drafts, ...paidLines].map(d => d.month))).sort().reverse();

  const totalPendingPayment = filteredDrafts.reduce((sum, d) => sum + (Number(d.netPay) || 0), 0);
  const totalPaidPayment = filteredLines.reduce((sum, d) => sum + (Number(d.netPay) || 0), 0);
  const totalCombinedPayroll = totalPendingPayment + totalPaidPayment;

  const { standardPay, netPay } = calcPays();

  return (
    <>
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500 pb-24 print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <DollarSign className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              {t("admin.payroll.title")}
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t("admin.payroll.subtitle")}</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => {
              setEditingDraftId(null);
              setSelectedEmp(null);
              setEditForm({ bonus: 0, days: 0, deductions: 0, insurance: 0, loanThisMonth: 0, overtime: 0, paymentMethod: "cash" });
              setIsAdding(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> {t("admin.payroll.new_payroll")}
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-6 shadow-xl shadow-indigo-100/20 dark:shadow-none animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" /> {editingDraftId ? "Edit Unpaid Payroll Draft" : t("admin.payroll.draft_new")}
            </h2>
            <button onClick={() => { setIsAdding(false); setSelectedEmp(null); setEditingDraftId(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("admin.payroll.employee")}</label>
              <select 
                value={editForm.employeeId || ""}
                onChange={e => handleEmpSelect(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              >
                <option value="">Select an employee...</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.position})</option>
                ))}
              </select>
            </div>

            {selectedEmp && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("admin.payroll.month")}</label>
                  <input 
                    type="month" 
                    value={editForm.month}
                    onChange={e => handleMonthChange(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("admin.payroll.base_salary")}</label>
                  <div className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-500">
                    {(Number(selectedEmp.baseSalary) || Number(selectedEmp.salary) || 3000).toLocaleString()} EGP
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("admin.payroll.days_worked")}</label>
                  <input 
                    type="number" 
                    value={editForm.days}
                    onChange={e => setEditForm({...editForm, days: Number(e.target.value)})}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-800 rounded-xl text-sm font-bold text-indigo-700 dark:text-indigo-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("admin.payroll.overtime")}</label>
                  <input 
                    type="number" 
                    value={editForm.overtime}
                    onChange={e => setEditForm({...editForm, overtime: Number(e.target.value)})}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("admin.payroll.bonus")}</label>
                  <input 
                    type="number" 
                    value={editForm.bonus}
                    onChange={e => setEditForm({...editForm, bonus: Number(e.target.value)})}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("admin.payroll.deductions")}</label>
                  <input 
                    type="number" 
                    value={editForm.deductions}
                    onChange={e => setEditForm({...editForm, deductions: Number(e.target.value)})}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("admin.payroll.loan_deductions")}</label>
                  <input 
                    type="number" 
                    value={editForm.loanThisMonth}
                    onChange={e => setEditForm({...editForm, loanThisMonth: Number(e.target.value)})}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-orange-200 dark:border-orange-800 rounded-xl text-sm text-orange-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("admin.payroll.insurance")}</label>
                  <input 
                    type="number" 
                    value={editForm.insurance}
                    onChange={e => setEditForm({...editForm, insurance: Number(e.target.value)})}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-1 lg:col-span-3 mt-4">
                  <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex gap-8">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Calculated Standard Pay</p>
                        <p className="text-2xl font-mono font-bold text-slate-700 dark:text-slate-300">{standardPay.toLocaleString()} EGP</p>
                      </div>
                      <div>
                        <p className="text-xs text-indigo-500 font-bold uppercase">Final Net Pay</p>
                        <p className="text-3xl font-black font-mono text-indigo-600 dark:text-indigo-400">{netPay.toLocaleString()} EGP</p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleSaveDraft}
                      className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                      <Save className="w-5 h-5" /> {editingDraftId ? "Update Draft" : "Save as Draft (Unpaid)"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PAYROLL SUMMARY METRICS (DYNAMIC TO BRANCH & PERIOD FILTERS) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <div className="bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/40 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Total Pending Payment</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">
              EGP {totalPendingPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">{filteredDrafts.length} unpaid draft payrolls</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-900/40 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total Paid Payment</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">
              EGP {totalPaidPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">{filteredLines.length} paid payroll records</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-indigo-200/60 dark:border-indigo-900/40 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Total Combined Payroll</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">
              EGP {totalCombinedPayroll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">{filteredDrafts.length + filteredLines.length} total records in filter</p>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4 shadow-sm print:hidden">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter className="w-5 h-5" />
          <span className="font-bold">Filters:</span>
        </div>
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value as BranchId | "all")}
          className="p-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm"
        >
          <option value="all">All Branches</option>
          {availableBranches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="p-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm"
        >
          <option value="all">All Months</option>
          {allMonths.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <div className="flex-1"></div>
        <button
          onClick={() => {
            window.print();
          }}
          className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition-colors"
        >
          <Printer className="w-4 h-4" /> Print Report
        </button>
      </div>

      {/* DRAFTS */}
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
            Unpaid Drafts ({filteredDrafts.length})
          </h2>
          {filteredDrafts.length > 0 && (
            <button
              onClick={() => setShowBatchModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm shadow-md transition-all hover:scale-105 active:scale-95"
            >
              <Layers className="w-4 h-4" /> Batch Export All Pending (PDF & WhatsApp)
            </button>
          )}
        </div>

        {/* BATCH DRAFT EXPORT MODAL */}
        {showBatchModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white">Batch Export Pending Payrolls</h3>
                    <p className="text-xs text-slate-500">{filteredDrafts.length} Pending Payroll Packets Ready</p>
                  </div>
                </div>
                <button onClick={() => setShowBatchModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between font-medium">
                  <span>Total Employees:</span>
                  <span className="font-bold text-slate-800 dark:text-white">{filteredDrafts.length}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Total Pending Payout:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    EGP {filteredDrafts.reduce((acc, c) => acc + (c.netPay || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-500">
                  📄 <strong>Multi-Page Packet Includes:</strong> Executive Summary Table + Per-Employee 2-Page Payslip & Receipt Packets.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setShowBatchModal(false);
                    handleTriggerBatchPrint();
                  }}
                  className="p-4 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-2xl font-bold flex flex-col items-center gap-2 text-sm shadow-lg transition-all"
                >
                  <Printer className="w-6 h-6 text-indigo-400" />
                  <span>Print Unified PDF</span>
                  <span className="text-[10px] font-normal text-slate-400">Executive Summary + 2-Page Slips</span>
                </button>

                <button
                  onClick={() => {
                    setShowBatchModal(false);
                    handleBatchWhatsApp();
                  }}
                  className="p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold flex flex-col items-center gap-2 text-sm shadow-lg transition-all"
                >
                  <Share2 className="w-6 h-6 text-emerald-200" />
                  <span>Share via WhatsApp</span>
                  <span className="text-[10px] font-normal text-emerald-100">Send Payout Breakdown Text</span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {filteredDrafts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-2xl text-center text-slate-500">
            No unpaid payroll drafts at the moment.
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3">Days</th>
                    <th className="px-4 py-3">Gross</th>
                    <th className="px-4 py-3">Net Pay</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {filteredDrafts.map(d => {
                    const emp = employees.find(e => e.id === d.employeeId);
                    return (
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{emp?.name || d.employeeId}</td>
                        <td className="px-4 py-3 font-mono text-xs">{d.month}</td>
                        <td className="px-4 py-3">{d.days}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{(d.standardPay || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{(d.netPay || 0).toLocaleString()} EGP</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <button 
                              onClick={() => handleEditDraft(d)}
                              className="px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors print:hidden"
                              title="Edit Draft"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button 
                              onClick={() => setPrintPayslipRecord(d)}
                              className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors print:hidden"
                              title="Print Payslip"
                            >
                              <Printer className="w-3.5 h-3.5" /> Print Payslip
                            </button>
                            <button 
                              onClick={() => openMarkPaidModal(d)}
                              className="px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors print:hidden"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
                            </button>
                            <button 
                              onClick={() => deleteDraft(d.id!)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded print:hidden"
                              title="Delete Draft"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* PAID HISTORY */}
      <div className="space-y-4 pt-8 border-t border-slate-200 dark:border-slate-800">
        <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          Paid History
        </h2>
        
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Net Paid</th>
                  <th className="px-4 py-3">Paid At</th>
                  <th className="px-4 py-3">Processed By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredLines.map((d, i) => {
                  const emp = employees.find(e => e.id === d.employeeId);
                  return (
                    <tr key={d.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-300">{emp?.name || d.employeeId}</td>
                      <td className="px-4 py-3 font-mono text-xs">{d.month}</td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{(d.netPay || 0).toLocaleString()} EGP</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {typeof d.postedToFinanceAt === 'object' && d.postedToFinanceAt?.seconds 
                          ? new Date(d.postedToFinanceAt.seconds * 1000).toLocaleString('en-GB') 
                          : String(d.postedToFinanceAt || "N/A")}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{String(d.createdBy || "")}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setPrintPayslipRecord(d)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print Payslip
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredLines.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No paid history found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>

    {/* MARK PAID MODAL */}
    {showPaidModal && (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
        <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Confirm Payment Date
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Mark payroll for {employees.find(e => e.id === showPaidModal.employeeId)?.name || 'Employee'} as PAID.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Payment Date</label>
              <input 
                type="date" 
                value={paidDate}
                onChange={e => setPaidDate(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium"
              />
            </div>
            <div className="flex flex-col gap-4 pt-4 items-center">
              <SlideToRun onComplete={confirmMarkPaid} />
              <button 
                onClick={() => setShowPaidModal(null)}
                className="w-full max-w-[320px] py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* PRINTABLE REPORT */}
    <div className={`hidden ${printPayslipRecord || isBatchPrinting ? 'hidden' : 'print:block'} w-full text-black bg-white`}>
      <div className="mb-6 text-center border-b-2 border-black pb-4">
        <h1 className="text-2xl font-black uppercase tracking-widest">Payroll Report</h1>
        <p className="text-sm text-gray-600 mt-1">
          Branch: {filterBranch === 'all' ? 'All Branches' : availableBranches.find(b => b.id === filterBranch)?.name || filterBranch} | 
          Month: {filterMonth === 'all' ? 'All Months' : filterMonth}
        </p>
        <p className="text-xs text-gray-500 mt-1">Generated: {currentDate}</p>
      </div>

      {filteredDrafts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-3 uppercase border-b border-gray-300 pb-1">Unpaid Drafts</h2>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-2">Employee</th>
                <th className="py-2">Branch</th>
                <th className="py-2">Month</th>
                <th className="py-2 text-center">Days</th>
                <th className="py-2 text-right">Standard</th>
                <th className="py-2 text-right">Overtime</th>
                <th className="py-2 text-right">Bonus</th>
                <th className="py-2 text-right text-red-600">Deductions</th>
                <th className="py-2 text-right text-red-600">Loans</th>
                <th className="py-2 text-right text-red-600">Insurance</th>
                <th className="py-2 text-right font-bold">Net Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDrafts.map((d, i) => {
                const emp = employees.find(e => e.id === d.employeeId);
                const bName = availableBranches.find(b => b.id === (emp?.branchId || d.storeId))?.name || d.storeId || "-";
                return (
                  <tr key={d.id || i}>
                    <td className="py-2 font-semibold">{emp?.name || d.employeeId}</td>
                    <td className="py-2">{bName}</td>
                    <td className="py-2">{d.month}</td>
                    <td className="py-2 text-center">{d.days}</td>
                    <td className="py-2 text-right">{(d.standardPay || 0).toLocaleString()}</td>
                    <td className="py-2 text-right">{(d.overtime || 0).toLocaleString()}</td>
                    <td className="py-2 text-right">{(d.bonus || 0).toLocaleString()}</td>
                    <td className="py-2 text-right text-red-600">{(d.deductions || 0).toLocaleString()}</td>
                    <td className="py-2 text-right text-red-600">{(d.loanThisMonth || 0).toLocaleString()}</td>
                    <td className="py-2 text-right text-red-600">{(d.insurance || 0).toLocaleString()}</td>
                    <td className="py-2 text-right font-bold">{(d.netPay || 0).toLocaleString()}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-black font-bold">
                <td colSpan={10} className="py-3 text-right uppercase">Total Pending (Unpaid):</td>
                <td className="py-3 text-right">{filteredDrafts.reduce((sum, d) => sum + (Number(d.netPay) || 0), 0).toLocaleString()} EGP</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {filteredLines.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-3 uppercase border-b border-gray-300 pb-1">Paid Payroll History</h2>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-2">Employee</th>
                <th className="py-2">Branch</th>
                <th className="py-2">Month</th>
                <th className="py-2 text-center">Days</th>
                <th className="py-2 text-right">Standard</th>
                <th className="py-2 text-right">Overtime</th>
                <th className="py-2 text-right">Bonus</th>
                <th className="py-2 text-right text-red-600">Deductions</th>
                <th className="py-2 text-right text-red-600">Loans</th>
                <th className="py-2 text-right text-red-600">Insurance</th>
                <th className="py-2 text-right font-bold">Net Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLines.map((d, i) => {
                const emp = employees.find(e => e.id === d.employeeId);
                const bName = availableBranches.find(b => b.id === (emp?.branchId || d.storeId))?.name || d.storeId || "-";
                return (
                  <tr key={d.id || i}>
                    <td className="py-2 font-semibold">{emp?.name || d.employeeId}</td>
                    <td className="py-2">{bName}</td>
                    <td className="py-2">{d.month}</td>
                    <td className="py-2 text-center">{d.days}</td>
                    <td className="py-2 text-right">{(d.standardPay || 0).toLocaleString()}</td>
                    <td className="py-2 text-right">{(d.overtime || 0).toLocaleString()}</td>
                    <td className="py-2 text-right">{(d.bonus || 0).toLocaleString()}</td>
                    <td className="py-2 text-right text-red-600">{(d.deductions || 0).toLocaleString()}</td>
                    <td className="py-2 text-right text-red-600">{(d.loanThisMonth || 0).toLocaleString()}</td>
                    <td className="py-2 text-right text-red-600">{(d.insurance || 0).toLocaleString()}</td>
                    <td className="py-2 text-right font-bold">{(d.netPay || 0).toLocaleString()}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-black font-bold">
                <td colSpan={10} className="py-3 text-right uppercase">Total Paid:</td>
                <td className="py-3 text-right">{filteredLines.reduce((sum, d) => sum + (Number(d.netPay) || 0), 0).toLocaleString()} EGP</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      
      {filteredDrafts.length === 0 && filteredLines.length === 0 && (
        <div className="text-center py-10 text-gray-500 italic border border-gray-200">
          No records found for the selected filters.
        </div>
      )}

      <div className="mt-12 flex justify-between items-end border-t border-gray-300 pt-8">
        <div className="w-48 border-t-2 border-black pt-2 text-center text-sm font-bold">
          Prepared By
        </div>
        <div className="w-48 border-t-2 border-black pt-2 text-center text-sm font-bold">
          Approved By
        </div>
      </div>
    </div>

    {/* PRINTABLE PAYSLIP & RECEIPT */}
    {printPayslipRecord && (() => {
      const p = printPayslipRecord;
      const emp = employees.find(e => e.id === p.employeeId) || {};
      const netPayWords = numberToEnglishWords(p.netPay || 0);
      const gross = (p.standardPay || 0) + (p.overtime || 0) + (p.bonus || 0);
      const dateString = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      
      const empBranchObj = availableBranches.find(b => b.id === emp.storeId);
      const companyName = empBranchObj ? empBranchObj.name : "Company Name";

      return (
        <div className="hidden print:block w-full text-black bg-white" style={{ fontFamily: "Arial, sans-serif", fontSize: "12px" }}>
          
          {/* PAGE 1: PAYSLIP */}
          <div className="pay-page" style={{ boxSizing: "border-box", width: "100%", maxWidth: "190mm", margin: "0 auto", position: "relative", backgroundColor: "#ffffff" }}>
            
            {/* Corporate Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "8px", marginBottom: "12px" }}>
              <div>
                <h1 style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>{companyName}</h1>
                <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: "10px" }}>Commercial Registry (س.ت): 123456 | Tax ID (ب.ض): 123-456-789</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Payslip</h2>
                <h3 style={{ fontSize: "12px", fontWeight: "normal", color: "#475569", margin: "1px 0 0 0" }}>كشف راتب شهري</h3>
              </div>
            </div>
            
            <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid #cbd5e1", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ width: "50%", padding: "6px 10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span>Employee Name</span><span>اسم الموظف</span>
                </div>
                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{emp.name || "-"}</div>
              </div>
              <div style={{ width: "50%", padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span>Employee ID</span><span>الرقم الوظيفي</span>
                </div>
                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", fontSize: "10px", wordBreak: "break-all", color: "#0f172a" }}>{emp.id || "-"}</div>
              </div>
              <div style={{ width: "50%", padding: "6px 10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span>National ID</span><span>الرقم القومي</span>
                </div>
                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", letterSpacing: "0.5px", color: "#0f172a", fontSize: "11px" }}>{emp.nationalId || "-"}</div>
              </div>
              <div style={{ width: "50%", padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span>Position</span><span>المسمى الوظيفي</span>
                </div>
                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{emp.position || "-"}</div>
              </div>
              <div style={{ width: "50%", padding: "6px 10px", borderRight: "1px solid #cbd5e1", backgroundColor: "#f8fafc" }}>
                <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span>Payroll Period</span><span>دورة الراتب</span>
                </div>
                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{p.month}</div>
              </div>
              <div style={{ width: "50%", padding: "6px 10px", backgroundColor: "#f8fafc" }}>
                <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span>Issue Date</span><span>تاريخ الإصدار</span>
                </div>
                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{dateString}</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#0f172a", color: "#ffffff", border: "1px solid #0f172a", padding: "8px 14px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold" }}>(Net Pay) صافي الراتب المستحق</span>
              <span style={{ fontSize: "16px", fontWeight: "900", color: "#34d399" }}>EGP {(p.netPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ textAlign: "right", fontSize: "11px", marginTop: "4px", color: "#475569", fontWeight: "500" }}>
              فقط وقدره: {netPayWords} لا غير
            </div>

            {/* EARNINGS */}
            <div style={{ marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: "bold", borderBottom: "1.5px solid #0f172a", paddingBottom: "2px", marginBottom: "4px", textTransform: "uppercase", fontSize: "11px" }}>
                <span>Earnings</span><span>الاستحقاقات</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "5px 8px", textAlign: "right", fontWeight: "600" }}>البند / Description</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", width: "150px", fontWeight: "600" }}>القيمة / Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>الراتب الأساسي (Basic Salary)</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {(p.standardPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr style={{ backgroundColor: "#f8fafc" }}>
                    <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>أجر إضافي (Overtime)</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {(p.overtime || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>مكافآت وحوافز (Bonuses/Incentives)</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {(p.bonus || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr style={{ backgroundColor: "#e2e8f0", color: "#0f172a" }}>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>إجمالي الاستحقاقات (Gross Earnings)</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>EGP {gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* DEDUCTIONS */}
            <div style={{ marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: "bold", borderBottom: "1.5px solid #0f172a", paddingBottom: "2px", marginBottom: "4px", textTransform: "uppercase", fontSize: "11px" }}>
                <span>Deductions</span><span>الاستقطاعات</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "5px 8px", textAlign: "right", fontWeight: "600" }}>البند / Description</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", width: "150px", fontWeight: "600" }}>القيمة / Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>جزاءات قانونية وإدارية (Legal/Admin Penalties)</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {(p.deductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr style={{ backgroundColor: "#f8fafc" }}>
                    <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>تأمينات اجتماعية (Social Insurance)</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {(p.insurance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>سلف / قروض (Advances/Loans)</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {(p.loanThisMonth || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr style={{ backgroundColor: "#e2e8f0", color: "#0f172a" }}>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>إجمالي الاستقطاعات (Total Deductions)</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>EGP {((p.deductions || 0) + (p.insurance || 0) + (p.loanThisMonth || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SIGNATURES */}
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between" }}>
              <div style={{ width: "42%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#475569", marginBottom: "25px" }}>
                  <span>Employee Signature</span><span>توقيع الموظف</span>
                </div>
                <div style={{ borderBottom: "1px solid #cbd5e1" }}></div>
              </div>
              <div style={{ width: "42%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#475569", marginBottom: "25px" }}>
                  <span>HR Department</span><span>إدارة الموارد البشرية</span>
                </div>
                <div style={{ borderBottom: "1px solid #cbd5e1" }}></div>
              </div>
            </div>
          </div>
          
          {/* PAGE 2: SALARY ACKNOWLEDGEMENT RECEIPT */}
          <div className="pay-page-last" style={{ boxSizing: "border-box", width: "100%", maxWidth: "190mm", margin: "0 auto", position: "relative", backgroundColor: "#ffffff" }}>
            
            {/* Corporate Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "8px", marginBottom: "12px" }}>
              <div>
                <h1 style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>{companyName}</h1>
                <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: "10px" }}>Commercial Registry (س.ت): 123456 | Tax ID (ب.ض): 123-456-789</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Salary Receipt</h2>
                <h3 style={{ fontSize: "12px", fontWeight: "normal", color: "#475569", margin: "1px 0 0 0" }}>إقرار استلام راتب ومخالصة نهائية</h3>
              </div>
            </div>
            
            <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid #cbd5e1", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ width: "50%", padding: "6px 10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span>Employee Name</span><span>اسم الموظف</span>
                </div>
                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{emp.name || "-"}</div>
              </div>
              <div style={{ width: "50%", padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span>Employee ID</span><span>الرقم الوظيفي</span>
                </div>
                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", fontSize: "10px", wordBreak: "break-all", color: "#0f172a" }}>{emp.id || "-"}</div>
              </div>
              <div style={{ width: "50%", padding: "6px 10px", borderRight: "1px solid #cbd5e1", backgroundColor: "#f8fafc" }}>
                <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span>Payroll Period</span><span>دورة الراتب</span>
                </div>
                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{p.month}</div>
              </div>
              <div style={{ width: "50%", padding: "6px 10px", backgroundColor: "#f8fafc" }}>
                <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span>Issue Date</span><span>تاريخ الإصدار</span>
                </div>
                <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{dateString}</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#0f172a", color: "#ffffff", border: "1px solid #0f172a", padding: "8px 14px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold" }}>(Net Received Amount) المبلغ الصافي المستلم</span>
              <span style={{ fontSize: "16px", fontWeight: "900", color: "#34d399" }}>EGP {(p.netPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ textAlign: "right", fontSize: "11px", marginTop: "4px", color: "#475569", fontWeight: "500" }}>
              فقط وقدره: {netPayWords} لا غير
            </div>

            {/* BILINGUAL LEGAL CLEARANCE BOX */}
            <div style={{ marginTop: "14px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: "#f8fafc", padding: "10px 14px" }}>
              <div style={{ direction: "rtl", textAlign: "right", borderBottom: "1px solid #cbd5e1", paddingBottom: "6px", marginBottom: "6px" }}>
                <h3 style={{ color: "#0f172a", fontSize: "12px", fontWeight: "bold", margin: 0 }}>إقرار استلام ومخالصة نهائية</h3>
                <p style={{ fontSize: "10px", lineHeight: "1.4", color: "#334155", margin: "4px 0 0 0", textAlign: "justify" }}>
                  أقر أنا الموقع أدناه، بصفتي موظفاً لدى الشركة المذكورة أعلاه، بأنني قد استلمت كامل الراتب والمستحقات المالية الخاصة بي عن دورة الراتب (<strong>{p.month}</strong>)، وذلك بعد إجراء كافة الاستقطاعات المقررة قانوناً. ويُعد توقيعي على هذا الإقرار بمثابة مخالصة نهائية تامة تبرئ ذمة الشركة من أي مطالبات مالية تخص هذه الدورة.
                </p>
              </div>
              <div style={{ direction: "ltr", textAlign: "left", paddingTop: "2px" }}>
                <h3 style={{ color: "#0f172a", fontSize: "12px", fontWeight: "bold", margin: 0 }}>Final Clearance & Salary Receipt</h3>
                <p style={{ fontSize: "9.5px", lineHeight: "1.35", color: "#334155", margin: "4px 0 0 0", textAlign: "justify" }}>
                  I, the undersigned employee, acknowledge receipt of my full salary and dues for (<strong>{p.month}</strong>), net of all lawful deductions. My signature constitutes a full & final clearance discharging the company from any financial claims for this period.
                </p>
              </div>
            </div>

            {/* SIGNATURES BOX */}
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px", backgroundColor: "#ffffff" }}>
              <div style={{ width: "45%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#475569", fontWeight: "bold", marginBottom: "25px" }}>
                  <span>Employee Signature</span>
                  <span>توقيع الموظف (المُقر)</span>
                </div>
                <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
              </div>
              <div style={{ width: "45%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#475569", fontWeight: "bold", marginBottom: "25px" }}>
                  <span>Authorized Manager</span>
                  <span>توقيع المدير المختص</span>
                </div>
                <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {/* PRINTABLE BATCH PAYROLL BOOKLET */}
    {isBatchPrinting && (() => {
      const dateString = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const totalBatchGross = filteredDrafts.reduce((acc, curr) => acc + (curr.standardPay || 0) + (curr.overtime || 0) + (curr.bonus || 0), 0);
      const totalBatchDeds = filteredDrafts.reduce((acc, curr) => acc + (curr.deductions || 0) + (curr.insurance || 0) + (curr.loanThisMonth || 0), 0);
      const totalBatchNet = filteredDrafts.reduce((acc, curr) => acc + (curr.netPay || 0), 0);
      
      const empBranchObj = availableBranches.find(b => b.id === currentBranch);
      const companyName = empBranchObj ? empBranchObj.name : "Circle K Franchise";

      return (
        <div className="hidden print:block w-full text-black bg-white" style={{ fontFamily: "Arial, sans-serif", fontSize: "12px" }}>
          
          {/* PAGE 1: EXECUTIVE SUMMARY TABLE */}
          <div className="pay-page" style={{ boxSizing: "border-box", width: "100%", maxWidth: "190mm", margin: "0 auto", position: "relative", backgroundColor: "#ffffff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "8px", marginBottom: "12px" }}>
              <div>
                <h1 style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>{companyName}</h1>
                <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: "10px" }}>Commercial Registry (س.ت): 123456 | Tax ID (ب.ض): 123-456-789</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Pending Payroll Summary</h2>
                <h3 style={{ fontSize: "12px", fontWeight: "normal", color: "#475569", margin: "1px 0 0 0" }}>جدول مسير المستحقات غير المدفوعة</h3>
              </div>
            </div>

            <div style={{ backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "8px 12px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "10px", color: "#64748b", display: "block" }}>Date & Cycle / التاريخ والإصدار</span>
                <strong style={{ fontSize: "12px", color: "#0f172a" }}>{dateString}</strong>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "#64748b", display: "block" }}>Total Pending Count</span>
                <strong style={{ fontSize: "12px", color: "#0f172a" }}>{filteredDrafts.length} Employees</strong>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "10px", color: "#64748b", display: "block" }}>Total Net Payable / إجمالي الصافي</span>
                <strong style={{ fontSize: "15px", color: "#059669" }}>EGP {totalBatchNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5px" }}>
              <thead>
                <tr style={{ backgroundColor: "#0f172a", color: "#ffffff", textAlign: "left" }}>
                  <th style={{ padding: "6px 8px", textAlign: "center" }}>#</th>
                  <th style={{ padding: "6px 8px" }}>Employee Name</th>
                  <th style={{ padding: "6px 8px" }}>Month</th>
                  <th style={{ padding: "6px 8px", textAlign: "center" }}>Days</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Gross Salary</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Deductions</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Net Payable</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrafts.map((d, index) => {
                  const emp = employees.find(e => e.id === d.employeeId);
                  const gross = (d.standardPay || 0) + (d.overtime || 0) + (d.bonus || 0);
                  const deds = (d.deductions || 0) + (d.insurance || 0) + (d.loanThisMonth || 0);
                  return (
                    <tr key={d.id || index} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                      <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: "bold" }}>{index + 1}</td>
                      <td style={{ padding: "6px 8px", fontWeight: "bold", color: "#0f172a" }}>{emp?.name || d.employeeId}</td>
                      <td style={{ padding: "6px 8px" }}>{d.month}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{d.days}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>EGP {gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#dc2626" }}>EGP {deds.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "900", color: "#059669" }}>EGP {(d.netPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: "#e2e8f0", fontWeight: "bold", borderTop: "2px solid #0f172a" }}>
                  <td colSpan={4} style={{ padding: "8px", textAlign: "left" }}>GRAND TOTALS / الإجمالي العام</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>EGP {totalBatchGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: "8px", textAlign: "right", color: "#dc2626" }}>EGP {totalBatchDeds.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: "8px", textAlign: "right", fontSize: "12px", color: "#059669" }}>EGP {totalBatchNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            {/* SIGNATURES */}
            <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px", backgroundColor: "#f8fafc" }}>
              <div style={{ width: "45%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#475569", fontWeight: "bold", marginBottom: "25px" }}>
                  <span>Prepared By (Financial Controller)</span>
                  <span>إعداد المحاسب المسؤول</span>
                </div>
                <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
              </div>
              <div style={{ width: "45%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#475569", fontWeight: "bold", marginBottom: "25px" }}>
                  <span>Approved By (General Manager)</span>
                  <span>اعتماد المدير العام</span>
                </div>
                <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
              </div>
            </div>
          </div>

          {/* PER EMPLOYEE PACKETS */}
          {filteredDrafts.map((p, idx) => {
            const emp = employees.find(e => e.id === p.employeeId) || {};
            const netPayWords = numberToEnglishWords(p.netPay || 0);
            const gross = (p.standardPay || 0) + (p.overtime || 0) + (p.bonus || 0);
            const empBranch = availableBranches.find(b => b.id === emp.storeId);
            const empCompName = empBranch ? empBranch.name : companyName;

            return (
              <React.Fragment key={p.id || idx}>
                {/* PAGE 1: PAYSLIP */}
                <div className="pay-page" style={{ boxSizing: "border-box", width: "100%", maxWidth: "190mm", margin: "0 auto", position: "relative", backgroundColor: "#ffffff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "8px", marginBottom: "12px" }}>
                    <div>
                      <h1 style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>{empCompName}</h1>
                      <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: "10px" }}>Commercial Registry (س.ت): 123456 | Tax ID (ب.ض): 123-456-789</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Payslip</h2>
                      <h3 style={{ fontSize: "12px", fontWeight: "normal", color: "#475569", margin: "1px 0 0 0" }}>كشف راتب شهري</h3>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid #cbd5e1", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: "50%", padding: "6px 10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                      <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                        <span>Employee Name</span><span>اسم الموظف</span>
                      </div>
                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{emp.name || "-"}</div>
                    </div>
                    <div style={{ width: "50%", padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                      <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                        <span>Employee ID</span><span>الرقم الوظيفي</span>
                      </div>
                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", fontSize: "10px", wordBreak: "break-all", color: "#0f172a" }}>{emp.id || "-"}</div>
                    </div>
                    <div style={{ width: "50%", padding: "6px 10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                      <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                        <span>National ID</span><span>الرقم القومي</span>
                      </div>
                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", letterSpacing: "0.5px", color: "#0f172a", fontSize: "11px" }}>{emp.nationalId || "-"}</div>
                    </div>
                    <div style={{ width: "50%", padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                      <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                        <span>Position</span><span>المسمى الوظيفي</span>
                      </div>
                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{emp.position || "-"}</div>
                    </div>
                    <div style={{ width: "50%", padding: "6px 10px", borderRight: "1px solid #cbd5e1", backgroundColor: "#f8fafc" }}>
                      <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                        <span>Payroll Period</span><span>دورة الراتب</span>
                      </div>
                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{p.month}</div>
                    </div>
                    <div style={{ width: "50%", padding: "6px 10px", backgroundColor: "#f8fafc" }}>
                      <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                        <span>Issue Date</span><span>تاريخ الإصدار</span>
                      </div>
                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{dateString}</div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: "#0f172a", color: "#ffffff", border: "1px solid #0f172a", padding: "8px 14px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "bold" }}>(Net Pay) صافي الراتب المستحق</span>
                    <span style={{ fontSize: "16px", fontWeight: "900", color: "#34d399" }}>EGP {(p.netPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "11px", marginTop: "4px", color: "#475569", fontWeight: "500" }}>
                    فقط وقدره: {netPayWords} لا غير
                  </div>

                  {/* EARNINGS */}
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: "bold", borderBottom: "1.5px solid #0f172a", paddingBottom: "2px", marginBottom: "4px", textTransform: "uppercase", fontSize: "11px" }}>
                      <span>Earnings</span><span>الاستحقاقات</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1" }}>
                          <th style={{ padding: "5px 8px", textAlign: "right", fontWeight: "600" }}>البند / Description</th>
                          <th style={{ padding: "5px 8px", textAlign: "right", width: "150px", fontWeight: "600" }}>القيمة / Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>الراتب الأساسي (Basic Salary)</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {(p.standardPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style={{ backgroundColor: "#f8fafc" }}>
                          <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>أجر إضافي (Overtime)</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {(p.overtime || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>مكافآت وحوافز (Bonuses/Incentives)</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {(p.bonus || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style={{ backgroundColor: "#e2e8f0", color: "#0f172a" }}>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>إجمالي الاستحقاقات (Gross Earnings)</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>EGP {gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* DEDUCTIONS */}
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: "bold", borderBottom: "1.5px solid #0f172a", paddingBottom: "2px", marginBottom: "4px", textTransform: "uppercase", fontSize: "11px" }}>
                      <span>Deductions</span><span>الاستقطاعات</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1" }}>
                          <th style={{ padding: "5px 8px", textAlign: "right", fontWeight: "600" }}>البند / Description</th>
                          <th style={{ padding: "5px 8px", textAlign: "right", width: "150px", fontWeight: "600" }}>القيمة / Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>جزاءات قانونية وإدارية (Legal/Admin Penalties)</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {(p.deductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style={{ backgroundColor: "#f8fafc" }}>
                          <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>تأمينات اجتماعية (Social Insurance)</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {(p.insurance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>سلف / قروض (Advances/Loans)</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #e2e8f0", fontWeight: "600" }}>EGP {(p.loanThisMonth || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style={{ backgroundColor: "#e2e8f0", color: "#0f172a" }}>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>إجمالي الاستقطاعات (Total Deductions)</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>EGP {((p.deductions || 0) + (p.insurance || 0) + (p.loanThisMonth || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* SIGNATURES */}
                  <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between" }}>
                    <div style={{ width: "42%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#475569", marginBottom: "25px" }}>
                        <span>Employee Signature</span><span>توقيع الموظف</span>
                      </div>
                      <div style={{ borderBottom: "1px solid #cbd5e1" }}></div>
                    </div>
                    <div style={{ width: "42%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#475569", marginBottom: "25px" }}>
                        <span>HR Department</span><span>إدارة الموارد البشرية</span>
                      </div>
                      <div style={{ borderBottom: "1px solid #cbd5e1" }}></div>
                    </div>
                  </div>
                </div>

                {/* PAGE 2: SALARY ACKNOWLEDGEMENT RECEIPT */}
                <div className="pay-page" style={{ boxSizing: "border-box", width: "100%", maxWidth: "190mm", margin: "0 auto", position: "relative", backgroundColor: "#ffffff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "8px", marginBottom: "12px" }}>
                    <div>
                      <h1 style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>{empCompName}</h1>
                      <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: "10px" }}>Commercial Registry (س.ت): 123456 | Tax ID (ب.ض): 123-456-789</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Salary Receipt</h2>
                      <h3 style={{ fontSize: "12px", fontWeight: "normal", color: "#475569", margin: "1px 0 0 0" }}>إقرار استلام راتب ومخالصة نهائية</h3>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid #cbd5e1", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: "50%", padding: "6px 10px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                      <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                        <span>Employee Name</span><span>اسم الموظف</span>
                      </div>
                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{emp.name || "-"}</div>
                    </div>
                    <div style={{ width: "50%", padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                      <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                        <span>Employee ID</span><span>الرقم الوظيفي</span>
                      </div>
                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", fontSize: "10px", wordBreak: "break-all", color: "#0f172a" }}>{emp.id || "-"}</div>
                    </div>
                    <div style={{ width: "50%", padding: "6px 10px", borderRight: "1px solid #cbd5e1", backgroundColor: "#f8fafc" }}>
                      <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                        <span>Payroll Period</span><span>دورة الراتب</span>
                      </div>
                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{p.month}</div>
                    </div>
                    <div style={{ width: "50%", padding: "6px 10px", backgroundColor: "#f8fafc" }}>
                      <div style={{ color: "#64748b", fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
                        <span>Issue Date</span><span>تاريخ الإصدار</span>
                      </div>
                      <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "1px", color: "#0f172a", fontSize: "11px" }}>{dateString}</div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: "#0f172a", color: "#ffffff", border: "1px solid #0f172a", padding: "8px 14px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "bold" }}>(Net Received Amount) المبلغ الصافي المستلم</span>
                    <span style={{ fontSize: "16px", fontWeight: "900", color: "#34d399" }}>EGP {(p.netPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "11px", marginTop: "4px", color: "#475569", fontWeight: "500" }}>
                    فقط وقدره: {netPayWords} لا غير
                  </div>

                  {/* BILINGUAL LEGAL CLEARANCE BOX */}
                  <div style={{ marginTop: "14px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: "#f8fafc", padding: "10px 14px" }}>
                    <div style={{ direction: "rtl", textAlign: "right", borderBottom: "1px solid #cbd5e1", paddingBottom: "6px", marginBottom: "6px" }}>
                      <h3 style={{ color: "#0f172a", fontSize: "12px", fontWeight: "bold", margin: 0 }}>إقرار استلام ومخالصة نهائية</h3>
                      <p style={{ fontSize: "10px", lineHeight: "1.4", color: "#334155", margin: "4px 0 0 0", textAlign: "justify" }}>
                        أقر أنا الموقع أدناه، بصفتي موظفاً لدى الشركة المذكورة أعلاه، بأنني قد استلمت كامل الراتب والمستحقات المالية الخاصة بي عن دورة الراتب (<strong>{p.month}</strong>)، وذلك بعد إجراء كافة الاستقطاعات المقررة قانوناً. ويُعد توقيعي على هذا الإقرار بمثابة مخالصة نهائية تامة تبرئ ذمة الشركة من أي مطالبات مالية تخص هذه الدورة.
                      </p>
                    </div>
                    <div style={{ direction: "ltr", textAlign: "left", paddingTop: "2px" }}>
                      <h3 style={{ color: "#0f172a", fontSize: "12px", fontWeight: "bold", margin: 0 }}>Final Clearance & Salary Receipt</h3>
                      <p style={{ fontSize: "9.5px", lineHeight: "1.35", color: "#334155", margin: "4px 0 0 0", textAlign: "justify" }}>
                        I, the undersigned employee, acknowledge receipt of my full salary and dues for (<strong>{p.month}</strong>), net of all lawful deductions. My signature constitutes a full & final clearance discharging the company from any financial claims for this period.
                      </p>
                    </div>
                  </div>

                  {/* SIGNATURES BOX */}
                  <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px 14px", backgroundColor: "#f8fafc" }}>
                    <div style={{ width: "45%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", fontWeight: "bold", marginBottom: "30px" }}>
                        <span>Employee Signature</span><span>توقيع الموظف (المُقر)</span>
                      </div>
                      <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
                    </div>
                    <div style={{ width: "45%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#475569", fontWeight: "bold", marginBottom: "30px" }}>
                        <span>Authorized Manager</span><span>توقيع المدير المختص</span>
                      </div>
                      <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      );
    })()}
    </>
  );
}
