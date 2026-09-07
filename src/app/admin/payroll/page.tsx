"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, getDocs, getDoc, updateDoc, where, limit, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { 
  Plus, Check, X, ShieldAlert, ShieldCheck, DollarSign, Calendar, Save, Trash2, 
  CheckCircle2, Printer, Filter, ChevronRight, Share2, Send, FileText, Layers, 
  Download, Pencil, Clock, CreditCard, Search, Building2, Sparkles, ArrowUpRight, 
  Coins, TrendingUp, Users, Banknote, CheckCheck, AlertCircle, Briefcase, 
  UserCheck, RefreshCw, Eye, PieChart, ArrowDownRight, Wallet
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranch, BranchId } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { motion, useAnimation, useMotionValue, useTransform, animate, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { dispatchNotificationSystem } from "@/lib/notifications";
import { notifyFinancialsUpdated } from "@/lib/financial-sync";

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

function AnimatedNumber({ value }: { value: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) =>
    new Intl.NumberFormat("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(latest)
  );

  useEffect(() => {
    const controls = animate(count, value, { duration: 1.2, ease: "easeOut" });
    return controls.stop;
  }, [value]);

  return <motion.span className="tabular-nums">{rounded}</motion.span>;
}

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
  const [userRole, setUserRole] = useState<string | null>(null);
  const { t, language } = useLanguage();

  const isManager = useMemo(() => {
    const email = (currentUserEmail || "").toLowerCase();
    if (email.includes("halawany") || email.includes("admin") || email.includes("youssef")) return false;
    const storedRole = typeof window !== "undefined" ? localStorage.getItem("circlek_role") : null;
    const effectiveRole = userRole || storedRole || "manager";
    return effectiveRole === "manager" || effectiveRole === "manager_assistant";
  }, [userRole, currentUserEmail]);

  const canEditOrDelete = useMemo(() => {
    return !isManager;
  }, [isManager]);
  
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

  // Edit Paid Payroll State
  const [editingPaidRecord, setEditingPaidRecord] = useState<PayrollRecord | null>(null);
  const [paidEditForm, setPaidEditForm] = useState<{
    days: number;
    standardPay: number;
    overtime: number;
    bonus: number;
    deductions: number;
    loanThisMonth: number;
    insurance: number;
    paymentMethod: 'cash' | 'bank' | 'cheque';
    month: string;
    paidDateInput: string;
    customStandardPay: boolean;
  }>({
    days: 30,
    standardPay: 0,
    overtime: 0,
    bonus: 0,
    deductions: 0,
    loanThisMonth: 0,
    insurance: 0,
    paymentMethod: 'cash',
    month: '',
    paidDateInput: new Date().toISOString().split("T")[0],
    customStandardPay: false
  });
  const [isSavingPaid, setIsSavingPaid] = useState(false);

  const [currentDate, setCurrentDate] = useState("");

  const [isPrinting, setIsPrinting] = useState(false);
  const [printPayslipRecord, setPrintPayslipRecord] = useState<PayrollRecord | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);

  // Modern Navigation, Search & Loan Context States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"drafts" | "history" | "analytics">("drafts");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<"all" | "cash" | "bank">("all");
  const [empLoanInfo, setEmpLoanInfo] = useState<{ activeLoanBal: number; totalInstallments: number; nextInstallment: number } | null>(null);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintPayslipRecord(null);
      setIsBatchPrinting(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  // Auto-print listener when opened from notification URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("autoPrintBatch") === "true") {
        const timer = setTimeout(() => {
          setIsBatchPrinting(true);
          toast.info("Preparing Official Batch Booklet for printing...");
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Instant RAF print trigger (eliminates print lag on desktop & PWA)
  useEffect(() => {
    if (printPayslipRecord || isBatchPrinting) {
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          window.print();
        });
        return () => cancelAnimationFrame(raf2);
      });
      return () => cancelAnimationFrame(raf1);
    }
  }, [printPayslipRecord, isBatchPrinting]);

  const handleSendBatchToManager = async () => {
    if (filteredDrafts.length === 0) {
      toast.error("No pending drafts to send to manager.");
      return;
    }

    const dateString = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const totalNet = filteredDrafts.reduce((acc, curr) => acc + (curr.netPay || 0), 0);
    const branchName = currentBranch === "all" ? "All Branches" : availableBranches.find(b => b.id === currentBranch)?.name || currentBranch;
    const printUrl = `/admin/payroll?autoPrintBatch=true&branch=${encodeURIComponent(currentBranch)}&month=${encodeURIComponent(filterMonth)}`;
    const serialNumber = `DOC-2026-${Math.floor(10000 + Math.random() * 90000)}`;

    // 1. Create Official Document Record in Firestore 'admin_dispatches' (Shows up in Manager Official Documents Inbox)
    try {
      await addDoc(collection(db, "admin_dispatches"), {
        title: `All Staff Monthly Payroll Packet (${filterMonth === "all" ? "All Months" : filterMonth})`,
        subtitle: `Batch dispatch containing 2-page payslips & clearance forms for all ${filteredDrafts.length} staff members (Total Net EGP ${totalNet.toLocaleString()})`,
        serialNumber: serialNumber,
        docType: "payslip",
        status: "unread",
        printedCount: 0,
        createdAt: new Date().toISOString(),
        branchId: currentBranch,
        metadata: {
          isBatchPayroll: true,
          netSalary: totalNet,
          allPayrollRecords: filteredDrafts,
          printUrl: printUrl
        }
      });
    } catch (err) {
      console.error("Error creating official dispatch document:", err);
    }

    // 2. Dispatch High-Priority System Push Notification to Manager
    try {
      await dispatchNotificationSystem({
        title: "📋 Official Payroll Booklet Dispatched",
        body: `Official Batch Packet (${filteredDrafts.length} slips, Total EGP ${totalNet.toLocaleString()}) sent to Official Documents (${branchName}).`,
        type: "payment",
        url: "/manager/documents",
        metadata: {
          batchCount: filteredDrafts.length,
          totalNetPay: totalNet,
          branch: branchName,
          month: filterMonth
        }
      });
    } catch (err) {
      console.error("Error dispatching manager notification:", err);
    }

    // 3. Format WhatsApp Official Document Transmission
    let message = `*📋 OFFICIAL PAYROLL BOOKLET FOR PRINTING*\n`;
    message += `*Circle K Franchise HR & Finance System*\n\n`;
    message += `*Branch:* ${branchName}\n`;
    message += `*Period:* ${filterMonth === "all" ? "All Months" : filterMonth}\n`;
    message += `*Total Employees:* ${filteredDrafts.length}\n`;
    message += `*Total Net Payout:* EGP ${totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
    message += `*Serial #:* ${serialNumber}\n`;
    message += `*Date Dispatched:* ${dateString}\n\n`;
    message += `*Official Documents Inbox Link:*\nhttps://anh-zeta.vercel.app/manager/documents\n\n`;
    message += `_Saved to Manager Official Documents. Click link to view & print official slips._`;

    const encoded = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    toast.success("Saved to Official Documents & Dispatched to Manager!");
  };

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

  const getBranchCompanyName = (storeId?: string, empBranchId?: string) => {
    const rawId = (storeId || empBranchId || currentBranch || "").toLowerCase();
    
    const bObj = availableBranches.find(b => 
      b.id.toLowerCase() === rawId || 
      b.name.toLowerCase().includes(rawId)
    );

    if (bObj && bObj.name && !bObj.name.toLowerCase().includes("company name")) {
      return bObj.name;
    }

    if (rawId.includes("alamein") || rawId.includes("elalamein") || rawId === "store_1" || rawId === "1") {
      return "Circle K - El Alamein 4";
    }
    if (rawId.includes("koronfol") || rawId.includes("ola") || rawId === "store_2" || rawId === "2") {
      return "Circle K - Ola El Koronfol";
    }

    return "Circle K - El Alamein 4";
  };

  const numberToArabicWords = (num: number): string => {
    if (!num || num === 0) return "صفر";
    const absNum = Math.floor(Math.abs(num));
    
    const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
    const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
    const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
    
    function getBelow100(n: number): string {
      if (n < 20) return ones[n];
      const t = Math.floor(n / 10);
      const o = n % 10;
      if (o === 0) return tens[t];
      return ones[o] + " و" + tens[t];
    }
    
    function getBelow1000(n: number): string {
      const h = Math.floor(n / 100);
      const rest = n % 100;
      if (h === 0) return getBelow100(rest);
      const hText = hundreds[h];
      if (rest === 0) return hText;
      return hText + " و" + getBelow100(rest);
    }
    
    const thousands = Math.floor(absNum / 1000);
    const remainder = absNum % 1000;
    
    let result = "";
    
    if (thousands > 0) {
      if (thousands === 1) result += "ألف";
      else if (thousands === 2) result += "ألفان";
      else if (thousands >= 3 && thousands <= 10) result += getBelow100(thousands) + " آلاف";
      else result += getBelow1000(thousands) + " ألف";
    }
    
    if (remainder > 0) {
      if (result !== "") result += " و";
      result += getBelow1000(remainder);
    }
    
    return result;
  };

  const getArMonthName = (mStr: string) => {
    if (!mStr || !mStr.includes("-")) return mStr;
    const [y, m] = mStr.split("-");
    const months = [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    ];
    const idx = parseInt(m, 10) - 1;
    return `${months[idx] || m} ${y}`;
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
      const storedRole = typeof window !== "undefined" ? localStorage.getItem("circlek_role") : null;
      const allowedRoles = ["admin_editor", "owner", "admin", "manager", "superadmin", "manager_assistant"];

      if (user) {
        setCurrentUserEmail(user.email || "");
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const role = userDoc.exists() ? userDoc.data()?.role : null;
          setUserRole(role || storedRole || "manager");
          const userEmail = (user.email || "").toLowerCase();

          const hasAccess = 
            allowedRoles.includes(role) || 
            allowedRoles.includes(storedRole || "") ||
            userEmail.includes("admin") || 
            userEmail.includes("halawany") || 
            userEmail.includes("manager");

          setIsAdmin(hasAccess);
        } catch {
          setUserRole(storedRole || "manager");
          const userEmail = (user.email || "").toLowerCase();
          const hasAccess = 
            allowedRoles.includes(storedRole || "") || 
            userEmail.includes("admin") || 
            userEmail.includes("halawany") || 
            userEmail.includes("manager");
          setIsAdmin(hasAccess);
        }
      } else {
        const effectiveRole = storedRole || "manager";
        setUserRole(effectiveRole);
        if (allowedRoles.includes(effectiveRole)) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (currentBranch) {
      setFilterBranch(currentBranch);
    }
  }, [currentBranch]);

  useEffect(() => {
    if (!isAdmin) return;

    let isMounted = true;

    const fetchEmps = async () => {
      try {
        const snap = await getDocs(collection(db, "employees"));
        if (isMounted) {
          setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.error("Error fetching employees", err);
      }
    };
    fetchEmps();

    const unsubDrafts = onSnapshot(
      query(collection(db, "payroll_drafts"), limit(200)),
      (snap) => {
        if (!isMounted) return;
        setDrafts(snap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollRecord)).sort((a, b) => {
          const aTime = typeof a.createdAt === 'object' && a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt || "");
          const bTime = typeof b.createdAt === 'object' && b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt || "");
          return String(bTime).localeCompare(String(aTime));
        }));
      },
      (error) => {
        console.warn("payroll_drafts onSnapshot warning:", error);
      }
    );

    const unsubLines = onSnapshot(
      query(collection(db, "payroll_lines"), limit(200)),
      (snap) => {
        if (!isMounted) return;
        setPaidLines(snap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollRecord)).sort((a, b) => {
          const aTime = typeof a.createdAt === 'object' && a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt || "");
          const bTime = typeof b.createdAt === 'object' && b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt || "");
          return String(bTime).localeCompare(String(aTime));
        }));
      },
      (error) => {
        console.warn("payroll_lines onSnapshot warning:", error);
      }
    );

    return () => {
      isMounted = false;
      unsubDrafts();
      unsubLines();
    };
  }, [isAdmin]);

  const fetchEmployeeDeductionsAndLoans = async (empId: string, monthStr: string) => {
    let totalDeductions = 0;
    let totalLoans = 0;
    let totalActiveLoanBalance = 0;
    let activeLoanInstallmentsRemaining = 0;
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

      // Loans for the month (Multi-month installments or active balance)
      const lQ = query(collection(db, "loans"), where("employeeId", "==", empId));
      const lSnap = await getDocs(lQ);
      lSnap.forEach(l => {
        const data = l.data();
        // Skip already settled loans
        if (data.settled === true || data.status === "settled") return;
        const currentRemaining = Number(data.remainingBalance !== undefined ? data.remainingBalance : (data.approved || data.amount || 0));
        if (currentRemaining <= 0) return;

        totalActiveLoanBalance += currentRemaining;

        let installmentToDeduct = 0;

        // Check if this is a multi-month scheduled installment loan
        if (Array.isArray(data.installments) && data.installments.length > 0) {
          activeLoanInstallmentsRemaining += data.installments.filter((i: any) => i.status === "pending").length;
          // Look for an installment scheduled for this exact month
          const targetInst = data.installments.find((i: any) => i.month === monthStr && i.status === "pending");
          if (targetInst) {
            installmentToDeduct = Number(targetInst.amount) || 0;
          } else {
            // Check if there are overdue/pending installments whose month <= monthStr
            const overdueInst = data.installments.find((i: any) => i.month <= monthStr && i.status === "pending");
            if (overdueInst) {
              installmentToDeduct = Number(overdueInst.amount) || 0;
            }
          }
          if (installmentToDeduct > 0) {
            installmentToDeduct = Math.min(installmentToDeduct, currentRemaining);
          }
        } else if (data.monthlyInstallment && Number(data.monthlyInstallment) > 0) {
          installmentToDeduct = Math.min(Number(data.monthlyInstallment), currentRemaining);
        } else {
          // Legacy single-month loan: only deduct if it matches monthStr or is pending/approved
          if (!data.date || data.date.startsWith(monthStr) || (data.status === "approved" || data.status === "pending")) {
            installmentToDeduct = currentRemaining;
          }
        }

        if (installmentToDeduct > 0) {
          totalLoans += installmentToDeduct;
          appliedLoanIds.push(l.id);
        }
      });
      // NEW: Unified Adjustments System
      const adjQ = query(collection(db, "adjustments"), where("employeeId", "==", empId), where("status", "==", "pending"));
      const adjSnap = await getDocs(adjQ);
      
      adjSnap.forEach(a => {
        const data = a.data();
        if (data.type === "deduction") totalDeductions += (Number(data.amount) || 0);
        if (data.type === "loan") {
          // If this adjustment is a mirror of a loan doc already processed in loans above, do not add it again
          if ((data.loanDocId && appliedLoanIds.includes(data.loanDocId)) || appliedLoanIds.includes(a.id)) {
            appliedAdjustmentIds.push(a.id);
            return;
          }
          totalLoans += (Number(data.amount) || 0);
          totalActiveLoanBalance += (Number(data.amount) || 0);
        }
        appliedAdjustmentIds.push(a.id);
      });

    } catch (err) {
      console.error("Error fetching deductions/loans", err);
    }

    return { 
      totalDeductions, 
      totalLoans, 
      appliedDeductionIds, 
      appliedLoanIds, 
      appliedAdjustmentIds,
      totalActiveLoanBalance,
      activeLoanInstallmentsRemaining
    };
  };

  const handleEmpSelect = async (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) {
      setSelectedEmp(null);
      setEmpLoanInfo(null);
      return;
    }
    
    setSelectedEmp(emp);
    
    const d = new Date();
    // Default to previous month if day < 15, else current month
    if (d.getDate() < 15) d.setMonth(d.getMonth() - 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const { 
      totalDeductions, 
      totalLoans, 
      appliedDeductionIds, 
      appliedLoanIds, 
      appliedAdjustmentIds,
      totalActiveLoanBalance,
      activeLoanInstallmentsRemaining
    } = await fetchEmployeeDeductionsAndLoans(emp.id, monthStr);

    setEmpLoanInfo({
      activeLoanBal: totalActiveLoanBalance,
      totalInstallments: activeLoanInstallmentsRemaining,
      nextInstallment: totalLoans
    });

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
      const { 
        totalDeductions, 
        totalLoans, 
        appliedDeductionIds, 
        appliedLoanIds, 
        appliedAdjustmentIds,
        totalActiveLoanBalance,
        activeLoanInstallmentsRemaining
      } = await fetchEmployeeDeductionsAndLoans(selectedEmp.id, newMonth);

      setEmpLoanInfo({
        activeLoanBal: totalActiveLoanBalance,
        totalInstallments: activeLoanInstallmentsRemaining,
        nextInstallment: totalLoans
      });

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
    if (!canEditOrDelete) {
      toast.error(language === "ar" ? "غير مصرح: صلاحية المدير هي إضافة الرواتب فقط دون إمكانية التعديل" : "Managers can only add new salaries. Editing is restricted.");
      return;
    }
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
    if (editingDraftId && !canEditOrDelete) {
      toast.error(language === "ar" ? "غير مصرح: صلاحية المدير هي إضافة الرواتب فقط دون إمكانية التعديل" : "Managers can only add new salaries. Editing existing drafts is restricted.");
      return;
    }

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
    if (!canEditOrDelete) {
      toast.error(language === "ar" ? "اعتماد وصرف الرواتب مخصص للإدارة العليا فقط" : "Approving and paying payroll is restricted to administrators.");
      return;
    }
    setShowPaidModal(draft);
    setPaidDate(new Date().toISOString().split("T")[0]);
  };

  const confirmMarkPaid = async () => {
    if (!canEditOrDelete) {
      toast.error(language === "ar" ? "اعتماد وصرف الرواتب مخصص للإدارة العليا فقط" : "Approving and paying payroll is restricted to administrators.");
      return;
    }
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

      // Apply and deduct loans (Multi-month installments & auto-settlement)
      if (draft.appliedLoanIds && draft.appliedLoanIds.length > 0) {
        for (const lId of draft.appliedLoanIds) {
          try {
            const loanRef = doc(db, "loans", lId);
            const loanDoc = await getDoc(loanRef);
            if (loanDoc.exists()) {
              const lData = loanDoc.data();
              const currentRem = Number(lData.remainingBalance !== undefined ? lData.remainingBalance : (lData.approved || lData.amount || 0));
              const curSettled = Number(lData.settledAmount || 0);

              let instAmt = 0;
              let updatedInstallments = lData.installments;

              if (Array.isArray(lData.installments) && lData.installments.length > 0) {
                let instMatched = false;
                updatedInstallments = lData.installments.map((inst: any) => {
                  if (!instMatched && (inst.month === draft.month || inst.month <= draft.month) && inst.status === "pending") {
                    instMatched = true;
                    instAmt = Number(inst.amount) || 0;
                    return { ...inst, status: "paid", payrollId: newDocRef.id, paidAt: new Date().toISOString() };
                  }
                  return inst;
                });
              }

              if (instAmt <= 0) {
                instAmt = Number(lData.monthlyInstallment || lData.amount || currentRem);
              }
              instAmt = Math.min(instAmt, currentRem);

              const nextRem = Math.max(0, currentRem - instAmt);
              const nextSettled = curSettled + instAmt;
              const isFullySettled = nextRem <= 0;

              await updateDoc(loanRef, {
                remainingBalance: nextRem,
                settledAmount: nextSettled,
                settled: isFullySettled,
                status: isFullySettled ? "settled" : "approved",
                installments: updatedInstallments || [],
                lastDeductionMonth: draft.month,
                lastPayrollId: newDocRef.id,
                ...(isFullySettled && { settledAt: serverTimestamp(), appliedPayrollId: newDocRef.id })
              });
            }
          } catch(e) { console.error("Failed to update loan", lId, e); }
        }
      }

      // Delete from drafts
      if (draft.id) {
        await deleteDoc(doc(db, "payroll_drafts", draft.id));
      }
      
      notifyFinancialsUpdated(draft.storeId || currentBranch);
      toast.success("Payroll Marked as Paid and posted to Finance");
      setShowPaidModal(null);
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    }
  };

  const deleteDraft = async (id: string) => {
    if (!canEditOrDelete) {
      toast.error(language === "ar" ? "غير مصرح: صلاحية المدير هي إضافة الرواتب فقط دون إمكانية الحذف" : "Managers can only add new salaries. Deleting is restricted.");
      return;
    }
    if (!confirm("Delete this draft permanently?")) return;
    try {
      await deleteDoc(doc(db, "payroll_drafts", id));
      toast.success("Draft deleted");
    } catch (err: any) {
      toast.error("Failed to delete draft: " + err.message);
    }
  };

  // Helper to normalize any date into YYYY-MM-DD for date inputs
  const getValidDateInput = (val: any): string => {
    if (!val) return new Date().toISOString().split("T")[0];
    try {
      if (typeof val === "string") {
        if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
        const dmy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dmy) {
          const [_, d, m, y] = dmy;
          return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        }
        const parsed = new Date(val);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
      }
      if (val && typeof val.toDate === "function") {
        return val.toDate().toISOString().slice(0, 10);
      }
      if (val && typeof val._seconds === "number") {
        return new Date(val._seconds * 1000).toISOString().slice(0, 10);
      }
      if (val && typeof val.seconds === "number") {
        return new Date(val.seconds * 1000).toISOString().slice(0, 10);
      }
    } catch {
      // Fallback
    }
    return new Date().toISOString().split("T")[0];
  };

  const handleOpenEditPaid = (record: PayrollRecord) => {
    if (!canEditOrDelete) {
      toast.error(language === "ar" ? "غير مصرح: صلاحية المدير هي إضافة الرواتب فقط دون إمكانية التعديل" : "Managers can only add new salaries. Editing paid records is restricted.");
      return;
    }
    const dateInput = getValidDateInput(record.postedToFinanceAt || record.createdAt);
    setEditingPaidRecord(record);
    setPaidEditForm({
      days: record.days ?? 30,
      standardPay: record.standardPay ?? 0,
      overtime: record.overtime ?? 0,
      bonus: record.bonus ?? 0,
      deductions: record.deductions ?? 0,
      loanThisMonth: record.loanThisMonth ?? 0,
      insurance: record.insurance ?? 0,
      paymentMethod: record.paymentMethod || 'cash',
      month: record.month || '',
      paidDateInput: dateInput,
      customStandardPay: false
    });
  };

  const calcPaidFormPays = () => {
    if (!editingPaidRecord) return { standardPay: 0, netPay: 0, baseSalary: 3000 };
    const emp = employees.find(e => e.id === editingPaidRecord.employeeId);
    const base = Number(emp?.baseSalary) || Number(emp?.salary) || 3000;
    const days = Number(paidEditForm.days) || 0;
    
    const standardPay = paidEditForm.customStandardPay 
      ? (Number(paidEditForm.standardPay) || 0) 
      : Math.round((base / 30) * days);

    const netPay = standardPay 
      + (Number(paidEditForm.overtime) || 0) 
      + (Number(paidEditForm.bonus) || 0) 
      - (Number(paidEditForm.deductions) || 0) 
      - (Number(paidEditForm.loanThisMonth) || 0) 
      - (Number(paidEditForm.insurance) || 0);

    return { standardPay, netPay, baseSalary: base };
  };

  const handleSavePaidRecord = async () => {
    if (!editingPaidRecord?.id) return;
    if (!canEditOrDelete) {
      toast.error(language === "ar" ? "غير مصرح: صلاحية المدير هي إضافة الرواتب فقط دون إمكانية التعديل" : "Managers can only add new salaries. Editing is restricted.");
      return;
    }
    setIsSavingPaid(true);
    try {
      const { standardPay, netPay } = calcPaidFormPays();
      
      let postedToFinanceAt = editingPaidRecord.postedToFinanceAt;
      if (paidEditForm.paidDateInput) {
        const dateObj = new Date(paidEditForm.paidDateInput + "T12:00:00");
        postedToFinanceAt = dateObj.toLocaleString('en-GB', { timeZone: 'Africa/Cairo' });
      }

      await updateDoc(doc(db, "payroll_lines", editingPaidRecord.id), {
        days: Number(paidEditForm.days) || 0,
        standardPay,
        overtime: Number(paidEditForm.overtime) || 0,
        bonus: Number(paidEditForm.bonus) || 0,
        deductions: Number(paidEditForm.deductions) || 0,
        loanThisMonth: Number(paidEditForm.loanThisMonth) || 0,
        insurance: Number(paidEditForm.insurance) || 0,
        paymentMethod: paidEditForm.paymentMethod,
        month: paidEditForm.month,
        netPay,
        postedToFinanceAt,
        updatedAt: new Date().toLocaleString('en-GB', { timeZone: 'Africa/Cairo' }),
        updatedBy: currentUserEmail
      });

      notifyFinancialsUpdated(editingPaidRecord.storeId || currentBranch);
      toast.success("Paid payroll record updated successfully");
      setEditingPaidRecord(null);
    } catch (err: any) {
      toast.error("Failed to update payroll record: " + err.message);
    } finally {
      setIsSavingPaid(false);
    }
  };

  const handleDeletePaidRecord = async () => {
    if (!editingPaidRecord?.id) return;
    if (!canEditOrDelete) {
      toast.error(language === "ar" ? "غير مصرح: صلاحية المدير هي إضافة الرواتب فقط دون إمكانية الحذف" : "Managers can only add new salaries. Deleting is restricted.");
      return;
    }
    if (!confirm("Are you sure you want to permanently delete this paid payroll record? This action cannot be undone and will affect financial reports.")) return;
    setIsSavingPaid(true);
    try {
      await deleteDoc(doc(db, "payroll_lines", editingPaidRecord.id));
      notifyFinancialsUpdated(editingPaidRecord.storeId || currentBranch);
      toast.success("Paid payroll record deleted");
      setEditingPaidRecord(null);
    } catch (err: any) {
      toast.error("Failed to delete record: " + err.message);
    } finally {
      setIsSavingPaid(false);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="p-8 space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-14 w-[320px] rounded-2xl bg-slate-800/60" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32 rounded-2xl bg-slate-800/60" />
          <Skeleton className="h-32 rounded-2xl bg-slate-800/60" />
          <Skeleton className="h-32 rounded-2xl bg-slate-800/60" />
          <Skeleton className="h-32 rounded-2xl bg-slate-800/60" />
        </div>
        <Skeleton className="h-[400px] w-full rounded-3xl bg-slate-800/60" />
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

  const isAr = language === "ar";

  const isBranchMatch = (emp: any, recordStoreId: string | undefined, filter: string) => {
    if (!filter || filter === "all") return true;
    
    const legacyMap: Record<string, string> = {
      "alamein4": "eL-alamein-4",
      "ola": "ola-el-koronfol"
    };
    const normFilter = filter.toLowerCase();
    const legacyId = (legacyMap[filter] || filter).toLowerCase();

    const empBranch = (emp?.branchId || "").toLowerCase();
    const empStore = (emp?.storeId || "").toLowerCase();
    const recStore = (recordStoreId || "").toLowerCase();

    if (empBranch === normFilter || empBranch === legacyId) return true;
    if (empStore === normFilter || empStore === legacyId) return true;
    if (recStore === normFilter || recStore === legacyId) return true;

    if (normFilter.includes("alamein") && (empStore.includes("alamein") || recStore.includes("alamein") || empBranch.includes("alamein"))) return true;
    if (normFilter.includes("ola") && (empStore.includes("ola") || recStore.includes("ola") || empStore.includes("koronfol") || recStore.includes("koronfol") || empBranch.includes("ola"))) return true;

    return false;
  };

  const matchesSearch = (record: PayrollRecord, emp: any, qStr: string) => {
    if (!qStr) return true;
    const q = qStr.toLowerCase().trim();
    const name = (emp?.name || "").toLowerCase();
    const nationalId = String(emp?.nationalId || "");
    const position = (emp?.position || "").toLowerCase();
    const empId = (record.employeeId || "").toLowerCase();
    const month = (record.month || "").toLowerCase();
    return name.includes(q) || nationalId.includes(q) || position.includes(q) || empId.includes(q) || month.includes(q);
  };

  const filteredDrafts = drafts.filter(d => {
    const emp = employees.find(e => e.id === d.employeeId);
    const branchMatch = isBranchMatch(emp, d.storeId, filterBranch);
    const monthMatch = filterMonth === "all" || d.month === filterMonth;
    const searchMatch = matchesSearch(d, emp, searchQuery);
    const methodMatch = paymentMethodFilter === "all" || (d.paymentMethod || "cash") === paymentMethodFilter;
    return branchMatch && monthMatch && searchMatch && methodMatch;
  });

  const filteredLines = paidLines.filter(d => {
    const emp = employees.find(e => e.id === d.employeeId);
    const branchMatch = isBranchMatch(emp, d.storeId, filterBranch);
    const monthMatch = filterMonth === "all" || d.month === filterMonth;
    const searchMatch = matchesSearch(d, emp, searchQuery);
    const methodMatch = paymentMethodFilter === "all" || (d.paymentMethod || "cash") === paymentMethodFilter;
    return branchMatch && monthMatch && searchMatch && methodMatch;
  });

  const allMonths = Array.from(new Set([...drafts, ...paidLines].map(d => d.month))).sort().reverse();

  const totalPendingPayment = filteredDrafts.reduce((sum, d) => sum + (Number(d.netPay) || 0), 0);
  const totalPaidPayment = filteredLines.reduce((sum, d) => sum + (Number(d.netPay) || 0), 0);
  const totalCombinedPayroll = totalPendingPayment + totalPaidPayment;
  
  const totalLoanRecoveries = [...filteredDrafts, ...filteredLines].reduce((sum, d) => sum + (Number(d.loanThisMonth) || 0), 0);
  const totalDeductionsRecovered = [...filteredDrafts, ...filteredLines].reduce((sum, d) => sum + (Number(d.deductions) || 0) + (Number(d.insurance) || 0), 0);
  const totalOvertimeVolume = [...filteredDrafts, ...filteredLines].reduce((sum, d) => sum + (Number(d.overtime) || 0), 0);
  const totalBonusVolume = [...filteredDrafts, ...filteredLines].reduce((sum, d) => sum + (Number(d.bonus) || 0), 0);

  const cashPaidTotal = filteredLines.filter(d => (d.paymentMethod || "cash") === "cash").reduce((s, d) => s + (Number(d.netPay) || 0), 0);
  const bankPaidTotal = filteredLines.filter(d => d.paymentMethod === "bank").reduce((s, d) => s + (Number(d.netPay) || 0), 0);

  const { standardPay, netPay } = calcPays();

  const getEmpAvatarColor = (name: string = "") => {
    const colors = [
      "from-indigo-600 to-indigo-800 text-indigo-100",
      "from-blue-600 to-cyan-700 text-blue-100",
      "from-emerald-600 to-teal-800 text-emerald-100",
      "from-purple-600 to-indigo-800 text-purple-100",
      "from-rose-600 to-pink-800 text-rose-100",
      "from-amber-600 to-orange-800 text-amber-100",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string = "") => {
    if (!name) return "EM";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const getBranchLabel = (storeId?: string, empBranchId?: string) => {
    const id = (storeId || empBranchId || "").toLowerCase();
    if (id.includes("alamein") || id === "alamein4" || id === "1") return isAr ? "العلمين 4" : "El Alamein 4";
    if (id.includes("ola") || id.includes("koronfol") || id === "ola" || id === "2") return isAr ? "أولا القرنفل" : "Ola Koronfol";
    return isAr ? "فرع معتمد" : "Corporate";
  };

  return (
    <>
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500 pb-32 print:hidden" dir={isAr ? "rtl" : "ltr"}>
      
      {/* 1. EXECUTIVE MASTER HERO BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/60 text-white p-6 md:p-8 rounded-3xl shadow-2xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/30">
                <DollarSign className="w-7 h-7" strokeWidth={2.5} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    <span>{isAr ? "نظام الرواتب والأجور المؤسسي" : "Enterprise Compensation Governance"}</span>
                  </span>
                  
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider bg-slate-800/90 text-slate-200 border border-slate-700 flex items-center gap-1.5 shadow-sm">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {filterBranch === "all" 
                        ? (isAr ? "جميع الفروع" : "All Branches") 
                        : (availableBranches.find(b => b.id === filterBranch)?.name || (filterBranch === "ola" ? "Ola El Koronfol" : "El Alamein 4"))}
                    </span>
                  </span>

                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider bg-slate-800/90 text-indigo-300 border border-indigo-900/60 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-400" />
                    <span>{filterMonth === "all" ? (isAr ? "كافة الشهور" : "All Periods") : filterMonth}</span>
                  </span>

                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-1">
                  {isAr ? "إدارة مسير المرتبات والتعويضات" : "Enterprise Payroll & Compensation Studio"}
                </h1>
              </div>
            </div>

            <p className="text-slate-400 text-xs md:text-sm font-medium max-w-2xl leading-relaxed">
              {isAr 
                ? "نظام احتساب الرواتب المتوافق مع قانون العمل المصري (مادة 34 و 38) • خصم آلي لأقساط السلف • صرف فوري من الخزينة والبنك • طباعة قانونية A4 معتمدة"
                : "Corporate payroll ledger compliant with Egyptian Labor Law (Art. 34 & 38) • Automated monthly loan recovery • Instant vault & bank disbursement • 2-Page legal payslips with National ID clearance"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isAdding && (
              <button 
                onClick={() => {
                  setEditingDraftId(null);
                  setSelectedEmp(null);
                  setEmpLoanInfo(null);
                  setEditForm({ bonus: 0, days: 30, deductions: 0, insurance: 0, loanThisMonth: 0, overtime: 0, paymentMethod: "cash" });
                  setIsAdding(true);
                  if (typeof window !== "undefined") {
                    window.scrollTo({ top: 300, behavior: "smooth" });
                  }
                }}
                className="group relative inline-flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Plus className="w-5 h-5 transition-transform group-hover:rotate-90 duration-300" />
                <span>{isAr ? "إضافة مسودة راتب جديدة" : "New Payroll Run"}</span>
              </button>
            )}

            {filteredDrafts.length > 0 && (
              <button
                onClick={() => setShowBatchModal(true)}
                className="inline-flex items-center gap-2 px-4 py-3 bg-slate-800/90 hover:bg-slate-700/90 text-white rounded-2xl font-bold text-sm border border-slate-700 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>{isAr ? "تصدير الدفعة (PDF & واتساب)" : "Batch Export & Dispatch"}</span>
              </button>
            )}

            <button
              onClick={() => {
                requestAnimationFrame(() => {
                  window.print();
                });
              }}
              className="p-3 bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-slate-700/70 transition-colors cursor-pointer"
              title={isAr ? "طباعة مسير الرواتب" : "Print Payroll Report"}
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. 4-CARD VIP TELEMETRY BENTO GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isAr ? "إجمالي الرواتب المعلقة" : "Pending Payout"}
            </span>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-900/40">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400 mr-1.5 font-sans">EGP</span>
            <AnimatedNumber value={totalPendingPayment} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{isAr ? "بانتظار الصرف" : "Awaiting disbursement"}</span>
            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full font-bold text-[11px]">
              {filteredDrafts.length} {isAr ? "مسودة" : "drafts"}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isAr ? "إجمالي المنصرف المعتمد" : "Disbursed Wages"}
            </span>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mr-1.5 font-sans">EGP</span>
            <AnimatedNumber value={totalPaidPayment} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{isAr ? "مسدد بالخزينة والبنك" : "Reconciled with vaults"}</span>
            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full font-bold text-[11px]">
              {filteredLines.length} {isAr ? "سجل معتمد" : "settled"}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isAr ? "إجمالي مسير الرواتب" : "Combined Wage Volume"}
            </span>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mr-1.5 font-sans">EGP</span>
            <AnimatedNumber value={totalCombinedPayroll} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{isAr ? "التزام الأجور الشامل" : "Total payroll commitment"}</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">
              {filteredDrafts.length + filteredLines.length} {isAr ? "سجل" : "records"}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-colors"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isAr ? "استردادات السلف والخصومات" : "Recovered Loans & Deductions"}
            </span>
            <div className="p-2.5 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 rounded-xl border border-cyan-100 dark:border-cyan-900/40">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-cyan-600 dark:text-cyan-400 font-mono tracking-tight">
            <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400 mr-1.5 font-sans">EGP</span>
            <AnimatedNumber value={totalLoanRecoveries + totalDeductionsRecovered} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span title={`Loans: ${totalLoanRecoveries.toLocaleString()} EGP`}>
              {isAr ? `سلف: ${totalLoanRecoveries.toLocaleString()}` : `Loans: ${totalLoanRecoveries.toLocaleString()}`}
            </span>
            <span className="font-bold text-slate-600 dark:text-slate-300">
              {isAr ? `خصومات: ${totalDeductionsRecovered.toLocaleString()}` : `Deductions: ${totalDeductionsRecovered.toLocaleString()}`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. GUIDED SMART PAYROLL STUDIO (CREATION / EDIT FORM) */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-900/95 border border-indigo-500/30 rounded-3xl p-6 md:p-8 shadow-2xl shadow-indigo-950/50 backdrop-blur-md relative overflow-hidden"
          >
            <div className="flex justify-between items-center pb-5 mb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <span>{editingDraftId ? (isAr ? "تعديل مسودة الراتب" : "Edit Unpaid Payroll Draft") : (isAr ? "إعداد كشف رواتب موظف" : "Smart Payroll Run Studio")}</span>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                      {isAr ? "مسودة غير مدفوعة" : "DRAFT UNPAID"}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isAr ? "احتساب تلقائي للراتب، البدلات، الجزاءات، وأقساط السلف المستحقة" : "Automated wage calculation, statutory loan deduction, and labor law compliance"}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => { setIsAdding(false); setSelectedEmp(null); setEditingDraftId(null); setEmpLoanInfo(null); }} 
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isAr ? "اختر الموظف" : "Select Employee"}</span>
                  </label>
                  <select 
                    value={editForm.employeeId || ""}
                    onChange={e => handleEmpSelect(e.target.value)}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm text-white font-medium cursor-pointer"
                  >
                    <option value="">{isAr ? "-- اضغط لاختيار موظف من القائمة --" : "-- Select an active employee --"}</option>
                    {employees.filter(e => e.status === 'active').map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.position || "Staff"}) - {getBranchLabel(e.storeId, e.branchId)}</option>
                    ))}
                  </select>
                </div>

                {selectedEmp ? (
                  <div className="space-y-3 pt-3 border-t border-slate-800/80 animate-in fade-in duration-300">
                    <div className="flex items-center gap-3 p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getEmpAvatarColor(selectedEmp.name)} flex items-center justify-center font-black text-sm shadow-md`}>
                        {getInitials(selectedEmp.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-white truncate">{selectedEmp.name}</div>
                        <div className="text-xs text-slate-400 truncate">{selectedEmp.position || "Employee"} • {getBranchLabel(selectedEmp.storeId, selectedEmp.branchId)}</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl text-xs">
                      <span className="text-indigo-300 font-bold">{isAr ? "الراتب الأساسي الثابت:" : "Contract Base Wage:"}</span>
                      <span className="text-sm font-black font-mono text-white">
                        {(Number(selectedEmp.baseSalary) || Number(selectedEmp.salary) || 3000).toLocaleString()} EGP
                      </span>
                    </div>

                    {empLoanInfo && empLoanInfo.activeLoanBal > 0 ? (
                      <div className="p-3.5 bg-amber-950/30 border border-amber-500/40 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5" />
                            {isAr ? "سلفة قائمة مستحقة" : "Active Loan Debt"}
                          </span>
                          <span className="text-xs font-mono font-black text-amber-300">
                            EGP {empLoanInfo.activeLoanBal.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-200/80 leading-tight">
                          {isAr 
                            ? `تم استقطاع قسط بقيمة ${empLoanInfo.nextInstallment.toLocaleString()} ج.م تلقائياً لهذا الشهر (${empLoanInfo.totalInstallments} أقساط متبقية).`
                            : `EGP ${empLoanInfo.nextInstallment.toLocaleString()} scheduled installment auto-applied (${empLoanInfo.totalInstallments} installments remaining).`}
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-400">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{isAr ? "لا توجد سلف أو ديون قائمة على الموظف" : "No outstanding loans on employee profile"}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                    {isAr ? "يرجى اختيار موظف لعرض بياناته وبدء الاحتساب" : "Select an employee to load base parameters"}
                  </div>
                )}
              </div>

              <div className="space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isAr ? "شهر الراتب (الدورة)" : "Payroll Cycle Month"}</span>
                  </label>
                  <input 
                    type="month" 
                    value={editForm.month || ""}
                    onChange={e => handleMonthChange(e.target.value)}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>{isAr ? "أيام العمل الفعلية" : "Days Worked"}</span>
                    <span className="text-indigo-400 font-mono font-bold text-xs">{editForm.days || 0} / 30 {isAr ? "يوم" : "days"}</span>
                  </label>
                  <input 
                    type="number" 
                    value={editForm.days ?? 30}
                    onChange={e => setEditForm({...editForm, days: Number(e.target.value)})}
                    className="w-full p-3 bg-slate-900 border border-indigo-500/50 rounded-xl text-base font-bold text-indigo-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <div className="flex gap-1.5 pt-1">
                    {[
                      { days: 30, label: isAr ? "شهر كامل (30)" : "Full (30d)" },
                      { days: 26, label: isAr ? "26 يوم" : "26 Days" },
                      { days: 15, label: isAr ? "نصف شهر (15)" : "Half (15d)" },
                    ].map(p => (
                      <button
                        key={p.days}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, days: p.days })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          editForm.days === p.days
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {isAr ? "إضافي ساعات / حوافز" : "Overtime (EGP)"}
                    </label>
                    <input 
                      type="number" 
                      value={editForm.overtime ?? 0}
                      onChange={e => setEditForm({...editForm, overtime: Number(e.target.value)})}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {isAr ? "مكافآت تشغيلية" : "Bonus (EGP)"}
                    </label>
                    <input 
                      type="number" 
                      value={editForm.bonus ?? 0}
                      onChange={e => setEditForm({...editForm, bonus: Number(e.target.value)})}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-emerald-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                      <span>{isAr ? "قسط السلفة" : "Loan Recovery"}</span>
                    </label>
                    <input 
                      type="number" 
                      value={editForm.loanThisMonth ?? 0}
                      onChange={e => setEditForm({...editForm, loanThisMonth: Number(e.target.value)})}
                      className="w-full p-2.5 bg-slate-900 border border-amber-500/50 rounded-xl text-sm font-mono text-amber-400 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                      {isAr ? "خصومات وجزاءات" : "Deductions"}
                    </label>
                    <input 
                      type="number" 
                      value={editForm.deductions ?? 0}
                      onChange={e => setEditForm({...editForm, deductions: Number(e.target.value)})}
                      className="w-full p-2.5 bg-slate-900 border border-rose-500/50 rounded-xl text-sm font-mono text-rose-400 font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {isAr ? "تأمينات اجتماعية (قانون 148/2019)" : "Social Insurance (EGP)"}
                  </label>
                  <input 
                    type="number" 
                    value={editForm.insurance ?? 0}
                    onChange={e => setEditForm({...editForm, insurance: Number(e.target.value)})}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    {isAr ? "طريقة صرف الراتب" : "Payment Method"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, paymentMethod: "cash" })}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        editForm.paymentMethod === "cash"
                          ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>{isAr ? "نقداً من الخزينة" : "Cash (Safe)"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, paymentMethod: "bank" })}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        editForm.paymentMethod === "bank"
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-400"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{isAr ? "تحويل بنكي" : "Bank Wire"}</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>

            <div className="mt-6 pt-6 border-t border-slate-800 bg-slate-950/80 p-5 rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center lg:text-start w-full lg:w-auto">
                <div className="text-xs text-slate-400 flex flex-wrap items-center justify-center lg:justify-start gap-2 font-mono">
                  <span>Standard: <strong className="text-white">{standardPay.toLocaleString()}</strong></span>
                  <span className="text-slate-600">+</span>
                  <span>Overtime: <strong className="text-emerald-400">+{Number(editForm.overtime || 0).toLocaleString()}</strong></span>
                  <span className="text-slate-600">+</span>
                  <span>Bonus: <strong className="text-emerald-400">+{Number(editForm.bonus || 0).toLocaleString()}</strong></span>
                  <span className="text-slate-600">−</span>
                  <span>Loans: <strong className="text-amber-400">−{Number(editForm.loanThisMonth || 0).toLocaleString()}</strong></span>
                  <span className="text-slate-600">−</span>
                  <span>Deductions: <strong className="text-rose-400">−{Number(editForm.deductions || 0).toLocaleString()}</strong></span>
                  <span className="text-slate-600">−</span>
                  <span>Ins: <strong className="text-slate-400">−{Number(editForm.insurance || 0).toLocaleString()}</strong></span>
                </div>

                <div className="flex items-center justify-center lg:justify-start gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {isAr ? "صافي الراتب المستحق:" : "Net Payable Wage:"}
                  </span>
                  <span className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
                    {netPay.toLocaleString()} <span className="text-sm font-sans font-bold">EGP</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isAr ? `فقط وقدره ${numberToArabicWords(netPay)} جنيهاً مصرياً لا غير` : numberToEnglishWords(netPay)}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                <button 
                  type="button"
                  onClick={() => { setIsAdding(false); setSelectedEmp(null); setEditingDraftId(null); setEmpLoanInfo(null); }}
                  className="px-5 py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button 
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-8 py-3 rounded-xl text-sm font-black bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingDraftId ? (isAr ? "تحديث المسودة" : "Update Draft") : (isAr ? "حفظ كمسودة (غير مدفوعة)" : "Save as Draft (Unpaid)")}</span>
                </button>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
            <button
              onClick={() => setActiveTab("drafts")}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "drafts"
                  ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md shadow-amber-600/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{isAr ? "المسودات المعلقة للصرف" : "Unpaid Drafts"}</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${activeTab === "drafts" ? "bg-black/20 text-white" : "bg-slate-800 text-amber-400"}`}>
                {filteredDrafts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "history"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-600/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isAr ? "سجل الرواتب المنصرفة" : "Paid History"}</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${activeTab === "history" ? "bg-black/20 text-white" : "bg-slate-800 text-emerald-400"}`}>
                {filteredLines.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "analytics"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>{isAr ? "تحليلات الأجور" : "Wage Analytics"}</span>
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-3 shadow-md">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isAr ? "بحث فوري بالاسم، الوظيفة، أو الرقم القومي..." : "Search employee by name, role, or ID..."}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs md:text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="w-full md:w-auto">
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value as BranchId | "all")}
              className="w-full md:w-auto py-2.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">{isAr ? "🏢 جميع الفروع" : "🏢 All Branches"}</option>
              {availableBranches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-auto">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full md:w-auto py-2.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">{isAr ? "📅 كافة الشهور" : "📅 All Months"}</option>
              {allMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-auto">
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
              className="w-full md:w-auto py-2.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">{isAr ? "💳 كافة طرق الصرف" : "💳 All Methods"}</option>
              <option value="cash">{isAr ? "💵 نقداً (الخزينة)" : "💵 Cash (Safe)"}</option>
              <option value="bank">{isAr ? "🏦 تحويل بنكي" : "🏦 Bank Transfer"}</option>
            </select>
          </div>

          {(searchQuery || filterBranch !== "all" || filterMonth !== "all" || paymentMethodFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterBranch("all");
                setFilterMonth("all");
                setPaymentMethodFilter("all");
              }}
              className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              {isAr ? "إعادة تعيين" : "Reset"}
            </button>
          )}
        </div>
      </div>

      {activeTab === "drafts" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>{isAr ? "المسودات الجاهزة للصرف والاعتماد" : "Unpaid Payroll Drafts"}</span>
              <span className="text-xs font-bold text-amber-400 px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                {filteredDrafts.length}
              </span>
            </h2>

            {filteredDrafts.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  <span>{isAr ? "طباعة وإرسال الدفعة كاملة" : "Batch Export & Dispatch"}</span>
                </button>
              </div>
            )}
          </div>

          {filteredDrafts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-12 rounded-3xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCheck className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">
                  {isAr ? "مسير الرواتب محدث بالكامل! 🎉" : "All Caught Up! 🎉"}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {isAr 
                    ? "لا توجد مسودات رواتب معلقة بانتظار الصرف للفترة المحددة. اضغط على 'إضافة مسودة جديدة' لإعداد رواتب الشهر."
                    : "No unpaid payroll drafts for the selected filters. Click 'New Payroll Run' to prepare upcoming wages."}
                </p>
              </div>
              {!isAdding && (
                <button
                  onClick={() => {
                    setEditingDraftId(null);
                    setSelectedEmp(null);
                    setEmpLoanInfo(null);
                    setEditForm({ bonus: 0, days: 30, deductions: 0, insurance: 0, loanThisMonth: 0, overtime: 0, paymentMethod: "cash" });
                    setIsAdding(true);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAr ? "بدء إعداد كشف رواتب" : "Start New Payroll Run"}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold text-xs uppercase tracking-wider">
                      <th className="px-5 py-4">{isAr ? "الموظف" : "Employee"}</th>
                      <th className="px-5 py-4">{isAr ? "الدورة والأيام" : "Period & Days"}</th>
                      <th className="px-5 py-4">{isAr ? "الأساسي" : "Standard Pay"}</th>
                      <th className="px-5 py-4">{isAr ? "البدلات والخصم" : "Additions / Deductions"}</th>
                      <th className="px-5 py-4">{isAr ? "صافي المستحق" : "Net Payable"}</th>
                      <th className="px-5 py-4">{isAr ? "طريقة الصرف" : "Payment Method"}</th>
                      <th className="px-5 py-4 text-right">{isAr ? "الإجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredDrafts.map(d => {
                      const emp = employees.find(e => e.id === d.employeeId);
                      return (
                        <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getEmpAvatarColor(emp?.name)} flex items-center justify-center font-bold text-xs shadow-sm`}>
                                {getInitials(emp?.name)}
                              </div>
                              <div>
                                <div className="font-bold text-white text-sm">{emp?.name || d.employeeId}</div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                  <span>{emp?.position || "Staff"}</span>
                                  <span>•</span>
                                  <span className="text-indigo-400">{getBranchLabel(d.storeId, emp?.storeId)}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-mono text-xs font-bold text-slate-200">{d.month}</div>
                            <div className="text-[11px] text-slate-400">{d.days} {isAr ? "يوم عمل" : "days worked"}</div>
                          </td>

                          <td className="px-5 py-4 font-mono font-bold text-slate-300">
                            {(d.standardPay || 0).toLocaleString()} EGP
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-0.5 text-xs font-mono">
                              {(Number(d.overtime || 0) > 0 || Number(d.bonus || 0) > 0) && (
                                <span className="text-emerald-400 text-[11px]">
                                  +{(Number(d.overtime || 0) + Number(d.bonus || 0)).toLocaleString()} {isAr ? "إضافي" : "add"}
                                </span>
                              )}
                              {(Number(d.loanThisMonth || 0) > 0 || Number(d.deductions || 0) > 0 || Number(d.insurance || 0) > 0) && (
                                <span className="text-rose-400 text-[11px]">
                                  −{(Number(d.loanThisMonth || 0) + Number(d.deductions || 0) + Number(d.insurance || 0)).toLocaleString()} {isAr ? "خصم/سلف" : "ded"}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-black font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                              {(d.netPay || 0).toLocaleString()} EGP
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                              (d.paymentMethod || "cash") === "cash"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            }`}>
                              {(d.paymentMethod || "cash") === "cash" ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                              <span>{(d.paymentMethod || "cash") === "cash" ? (isAr ? "نقداً (الخزينة)" : "Cash Safe") : (isAr ? "تحويل بنكي" : "Bank")}</span>
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end items-center gap-1.5">
                              {canEditOrDelete && (
                                <button 
                                  onClick={() => handleEditDraft(d)}
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Edit Draft"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>{isAr ? "تعديل" : "Edit"}</span>
                                </button>
                              )}

                              <button 
                                onClick={() => setPrintPayslipRecord(d)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                title="Print 2-Page Legal Payslip"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>{isAr ? "مفردات مرتب" : "Payslip"}</span>
                              </button>

                              {canEditOrDelete && (
                                <>
                                  <button 
                                    onClick={() => openMarkPaidModal(d)}
                                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                                    title="Disburse & Post"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{isAr ? "اعتماد وصرف" : "Mark Paid"}</span>
                                  </button>
                                  <button 
                                    onClick={() => deleteDraft(d.id!)}
                                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Draft"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
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
      )}

      {activeTab === "history" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>{isAr ? "سجل الرواتب المعتمدة والمنصرفة" : "Paid Payroll History"}</span>
              <span className="text-xs font-bold text-emerald-400 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                {filteredLines.length}
              </span>
            </h2>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold text-xs uppercase tracking-wider">
                    <th className="px-5 py-4">{isAr ? "الموظف" : "Employee"}</th>
                    <th className="px-5 py-4">{isAr ? "الشهر" : "Month"}</th>
                    <th className="px-5 py-4">{isAr ? "المبلغ المنصرف" : "Net Paid"}</th>
                    <th className="px-5 py-4">{isAr ? "طريقة الصرف" : "Method"}</th>
                    <th className="px-5 py-4">{isAr ? "تاريخ الصرف" : "Paid At"}</th>
                    <th className="px-5 py-4">{isAr ? "المسؤول" : "Processed By"}</th>
                    <th className="px-5 py-4 text-right">{isAr ? "الإجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLines.map((d, i) => {
                    const emp = employees.find(e => e.id === d.employeeId);
                    return (
                      <tr key={d.id || i} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getEmpAvatarColor(emp?.name)} flex items-center justify-center font-bold text-xs shadow-sm`}>
                              {getInitials(emp?.name)}
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm">{emp?.name || d.employeeId}</div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                <span>{emp?.position || "Staff"}</span>
                                <span>•</span>
                                <span className="text-emerald-400">{getBranchLabel(d.storeId, emp?.storeId)}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 font-mono text-xs font-bold text-slate-300">
                          {d.month}
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-black font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            {(d.netPay || 0).toLocaleString()} EGP
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            (d.paymentMethod || "cash") === "cash"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          }`}>
                            {(d.paymentMethod || "cash") === "cash" ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                            <span>{(d.paymentMethod || "cash") === "cash" ? (isAr ? "نقداً" : "Cash Safe") : (isAr ? "بنكي" : "Bank")}</span>
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs font-mono text-slate-400">
                          {typeof d.postedToFinanceAt === 'object' && d.postedToFinanceAt?.seconds 
                            ? new Date(d.postedToFinanceAt.seconds * 1000).toLocaleString('en-GB') 
                            : String(d.postedToFinanceAt || "N/A")}
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-400">
                          {String(d.createdBy || "").split("@")[0]}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {canEditOrDelete && (
                              <button
                                onClick={() => handleOpenEditPaid(d)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                                title="Edit Paid Payroll Record"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>{isAr ? "تعديل" : "Edit"}</span>
                              </button>
                            )}
                            <button
                              onClick={() => setPrintPayslipRecord(d)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg transition-colors cursor-pointer"
                              title="Print 2-Page Legal Slip"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>{isAr ? "طباعة المفردات" : "Print Payslip"}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                        {isAr ? "لا يوجد سجل رواتب منصرفة مطابق لخيارات البحث." : "No paid payroll records found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{isAr ? "توزيع الصرف" : "Vault vs Bank"}</span>
                <PieChart className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400 flex items-center gap-1"><Banknote className="w-3 h-3" /> Cash</span>
                  <span className="font-mono font-bold text-white">EGP {cashPaidTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-indigo-400 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Bank</span>
                  <span className="font-mono font-bold text-white">EGP {bankPaidTotal.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex mt-2">
                  <div 
                    style={{ width: `${totalPaidPayment > 0 ? (cashPaidTotal / totalPaidPayment) * 100 : 50}%` }}
                    className="bg-emerald-500 h-full transition-all"
                  />
                  <div 
                    style={{ width: `${totalPaidPayment > 0 ? (bankPaidTotal / totalPaidPayment) * 100 : 50}%` }}
                    className="bg-indigo-500 h-full transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{isAr ? "متوسط الراتب" : "Average Net Wage"}</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black font-mono text-white">
                <span className="text-xs font-bold text-emerald-400 mr-1">EGP</span>
                {filteredLines.length > 0 ? Math.round(totalPaidPayment / filteredLines.length).toLocaleString() : 0}
              </div>
              <p className="text-xs text-slate-400">
                {isAr ? `محسوب على إجمالي ${filteredLines.length} سجل منصرف` : `Based on ${filteredLines.length} settled payments`}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{isAr ? "حجم الحوافز والإضافي" : "Incentives Volume"}</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black font-mono text-amber-400">
                <span className="text-xs font-bold mr-1">EGP</span>
                {(totalOvertimeVolume + totalBonusVolume).toLocaleString()}
              </div>
              <p className="text-xs text-slate-400">
                {isAr ? `إضافي: ${totalOvertimeVolume.toLocaleString()} • مكافآت: ${totalBonusVolume.toLocaleString()}` : `Overtime: ${totalOvertimeVolume.toLocaleString()} • Bonus: ${totalBonusVolume.toLocaleString()}`}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{isAr ? "استردادات السلف" : "Loan Recoveries"}</span>
                <Coins className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black font-mono text-cyan-400">
                <span className="text-xs font-bold mr-1">EGP</span>
                {totalLoanRecoveries.toLocaleString()}
              </div>
              <p className="text-xs text-slate-400">
                {isAr ? "تم خصمها وإعادتها لخزينة الشركة" : "Directly credited back to company vault"}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>

    {/* BATCH DRAFT EXPORT MODAL */}
    {showBatchModal && (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 print:hidden">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">{isAr ? "تصدير دفعة الرواتب المعلقة" : "Batch Export Pending Payrolls"}</h3>
                <p className="text-xs text-slate-400">{filteredDrafts.length} {isAr ? "كشف راتب جاهز للتصدير" : "Pending Payroll Packets Ready"}</p>
              </div>
            </div>
            <button onClick={() => setShowBatchModal(false)} className="p-2 text-slate-400 hover:text-white rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl space-y-2 text-xs text-slate-300 border border-slate-800">
            <div className="flex justify-between font-medium">
              <span>{isAr ? "إجمالي الموظفين:" : "Total Employees:"}</span>
              <span className="font-bold text-white">{filteredDrafts.length}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>{isAr ? "إجمالي صافي المنصرف:" : "Total Pending Payout:"}</span>
              <span className="font-bold text-emerald-400">
                EGP {filteredDrafts.reduce((acc, c) => acc + (c.netPay || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-800 text-slate-400">
              📄 {isAr ? "يشمل الكتيب: جدول الملخص التنفيذي + كشف مفردات أجر وإقرار استلام من صفحتين لكل موظف." : "Multi-Page Packet Includes: Executive Summary Table + Per-Employee 2-Page Payslip & Receipt Packets."}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => {
                setShowBatchModal(false);
                handleTriggerBatchPrint();
              }}
              className="p-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold flex flex-col items-center gap-1.5 text-xs shadow-lg transition-all cursor-pointer"
            >
              <Printer className="w-5 h-5 text-indigo-400" />
              <span>{isAr ? "طباعة الكتيب" : "Print PDF Booklet"}</span>
              <span className="text-[9px] font-normal text-slate-400">{isAr ? "طباعة A4 فورية" : "Print A4 directly"}</span>
            </button>

            <button
              onClick={() => {
                setShowBatchModal(false);
                handleSendBatchToManager();
              }}
              className="p-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold flex flex-col items-center gap-1.5 text-xs shadow-lg transition-all border border-indigo-400/30 shadow-indigo-600/20 cursor-pointer"
            >
              <Send className="w-5 h-5 text-indigo-100 animate-pulse" />
              <span>{isAr ? "إرسال للمدير" : "Send to Manager"}</span>
              <span className="text-[9px] font-normal text-indigo-100">{isAr ? "إشعار ومستند رسمي" : "Dispatch Push & Link"}</span>
            </button>

            <button
              onClick={() => {
                setShowBatchModal(false);
                handleBatchWhatsApp();
              }}
              className="p-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold flex flex-col items-center gap-1.5 text-xs shadow-lg transition-all cursor-pointer"
            >
              <Share2 className="w-5 h-5 text-emerald-200" />
              <span>{isAr ? "ملخص واتساب" : "WhatsApp Summary"}</span>
              <span className="text-[9px] font-normal text-emerald-100">{isAr ? "إرسال نصي فوري" : "Send Breakdown"}</span>
            </button>
          </div>
        </div>
      </div>
    )}

    {/* MARK PAID MODAL WITH SLIDE TO RUN */}
    {showPaidModal && (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 print:hidden">
        <div className="bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
          <div className="p-6 border-b border-slate-800">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>{isAr ? "تأكيد تاريخ واعتماد الصرف" : "Confirm Payment Date"}</span>
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              {isAr ? "اعتماد وصرف راتب الموظف:" : "Mark payroll for:"} <strong className="text-white">{employees.find(e => e.id === showPaidModal.employeeId)?.name || 'Employee'}</strong>
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                {isAr ? "تاريخ الصرف الفعلي" : "Disbursement Date"}
              </label>
              <input 
                type="date" 
                value={paidDate}
                onChange={e => setPaidDate(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-medium text-white outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex justify-between items-center">
              <span>{isAr ? "المبلغ المنصرف من الخزينة/البنك:" : "Net Payout Amount:"}</span>
              <span className="font-mono font-black text-base text-white">{Number(showPaidModal.netPay || 0).toLocaleString()} EGP</span>
            </div>

            <div className="flex flex-col gap-4 pt-4 items-center">
              <SlideToRun onComplete={confirmMarkPaid} />
              <button 
                onClick={() => setShowPaidModal(null)}
                className="w-full max-w-[320px] py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* EDIT PAID RECORD MODAL */}
    {editingPaidRecord && (() => {
      const emp = employees.find(e => e.id === editingPaidRecord.employeeId);
      const { standardPay: calcStd, netPay: calcNet, baseSalary } = calcPaidFormPays();

      return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 print:hidden overflow-y-auto">
          <div className="bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200 my-8">
            <div className="p-6 border-b border-slate-800 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                    <Pencil className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-white">
                        {isAr ? "تعديل سجل راتب منصرف" : "Edit Paid Payroll Record"}
                      </h3>
                      <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                        PAID RECORD
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Employee: <strong className="text-white">{emp?.name || editingPaidRecord.employeeId}</strong> • Branch: {getBranchLabel(editingPaidRecord.storeId, emp?.storeId)}
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setEditingPaidRecord(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {isAr ? "شهر الراتب" : "Payroll Month"}
                  </label>
                  <input
                    type="month"
                    value={paidEditForm.month}
                    onChange={e => setPaidEditForm({ ...paidEditForm, month: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {isAr ? "تاريخ الصرف" : "Disbursement Date"}
                  </label>
                  <input 
                    type="date" 
                    value={paidEditForm.paidDateInput}
                    onChange={e => setPaidEditForm({ ...paidEditForm, paidDateInput: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Payment Method
                  </label>
                  <select 
                    value={paidEditForm.paymentMethod}
                    onChange={e => setPaidEditForm({ ...paidEditForm, paymentMethod: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium capitalize"
                  >
                    <option value="cash">Cash (Safe / الخزنة)</option>
                    <option value="bank">Bank (Bank Misr / بنك مصر)</option>
                    <option value="cheque">Cheque (شيك)</option>
                  </select>
                </div>
              </div>

              {/* Salary & Days Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Base Salary (Contract)
                  </label>
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-600 dark:text-slate-300 font-bold">
                    {baseSalary.toLocaleString()} EGP
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Days Worked
                  </label>
                  <input 
                    type="number" 
                    value={paidEditForm.days}
                    onChange={e => setPaidEditForm({ ...paidEditForm, days: Number(e.target.value), customStandardPay: false })}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-sm font-bold text-indigo-700 dark:text-indigo-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Standard Pay
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setPaidEditForm(f => ({ ...f, customStandardPay: !f.customStandardPay, standardPay: calcStd }))}
                      className="text-[10px] text-indigo-600 hover:underline"
                    >
                      {paidEditForm.customStandardPay ? "Auto-calculate" : "Manual override"}
                    </button>
                  </div>
                  {paidEditForm.customStandardPay ? (
                    <input 
                      type="number" 
                      value={paidEditForm.standardPay}
                      onChange={e => setPaidEditForm({ ...paidEditForm, standardPay: Number(e.target.value) })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-sm font-bold text-amber-700 dark:text-amber-400"
                    />
                  ) : (
                    <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono font-bold text-slate-800 dark:text-slate-200">
                      {calcStd.toLocaleString()} EGP
                    </div>
                  )}
                </div>
              </div>

              {/* Additions and Deductions */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                    + Overtime (EGP)
                  </label>
                  <input 
                    type="number" 
                    value={paidEditForm.overtime}
                    onChange={e => setPaidEditForm({ ...paidEditForm, overtime: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                    + Bonus (EGP)
                  </label>
                  <input 
                    type="number" 
                    value={paidEditForm.bonus}
                    onChange={e => setPaidEditForm({ ...paidEditForm, bonus: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm font-semibold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-red-500 uppercase tracking-wider block mb-1">
                    - Deductions (EGP)
                  </label>
                  <input 
                    type="number" 
                    value={paidEditForm.deductions}
                    onChange={e => setPaidEditForm({ ...paidEditForm, deductions: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-orange-500 uppercase tracking-wider block mb-1">
                    - Loan (EGP)
                  </label>
                  <input 
                    type="number" 
                    value={paidEditForm.loanThisMonth}
                    onChange={e => setPaidEditForm({ ...paidEditForm, loanThisMonth: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-orange-200 dark:border-orange-800 rounded-xl text-sm font-semibold text-orange-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    - Insurance (EGP)
                  </label>
                  <input 
                    type="number" 
                    value={paidEditForm.insurance}
                    onChange={e => setPaidEditForm({ ...paidEditForm, insurance: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold"
                  />
                </div>
              </div>

              {/* Net Pay Highlight Banner */}
              <div className="p-4 bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-transparent border border-indigo-100 dark:border-indigo-900/40 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Recalculated Net Paid Amount
                  </span>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Standard ({calcStd.toLocaleString()}) + Overtime ({paidEditForm.overtime}) + Bonus ({paidEditForm.bonus}) - Deductions ({Number(paidEditForm.deductions) + Number(paidEditForm.loanThisMonth) + Number(paidEditForm.insurance)})
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {calcNet.toLocaleString()} <span className="text-sm font-sans font-bold">EGP</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row justify-between items-center gap-3">
              <button
                type="button"
                onClick={handleDeletePaidRecord}
                disabled={isSavingPaid}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-xl transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete Record
              </button>

              <div className="w-full sm:w-auto flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingPaidRecord(null)}
                  disabled={isSavingPaid}
                  className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePaidRecord}
                  disabled={isSavingPaid}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSavingPaid ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {/* PRINTABLE REPORT */}
    <div className={`hidden ${printPayslipRecord || isBatchPrinting ? 'hidden' : 'print:block'} w-full text-black bg-white`} style={{ fontFamily: "Arial, sans-serif", fontSize: "11px" }}>
      <div style={{ boxSizing: "border-box", width: "100%", maxWidth: "190mm", margin: "0 auto", position: "relative", backgroundColor: "#ffffff" }}>
        
        {/* Corporate Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "8px", marginBottom: "12px" }}>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              {filterBranch === 'all' ? 'Circle K Franchise - All Branches' : availableBranches.find(b => b.id === filterBranch)?.name || 'Circle K Franchise'}
            </h1>
            <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: "10px" }}>Commercial Registry (س.ت): 123456 | Tax ID (ب.ض): 123-456-789</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Executive Payroll Report</h2>
            <h3 style={{ fontSize: "12px", fontWeight: "normal", color: "#475569", margin: "1px 0 0 0" }}>تقرير مسير المرتبات الشامل</h3>
          </div>
        </div>

        {/* Ink-Saving KPI Cards */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
          <div style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: "6px", padding: "8px 12px", backgroundColor: "#f8fafc" }}>
            <span style={{ fontSize: "9.5px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold", display: "block" }}>Filter Period / Month</span>
            <strong style={{ fontSize: "12px", color: "#0f172a" }}>{filterMonth === 'all' ? 'All Months' : filterMonth}</strong>
          </div>
          <div style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: "6px", padding: "8px 12px", backgroundColor: "#f8fafc" }}>
            <span style={{ fontSize: "9.5px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold", display: "block" }}>Total Pending (Unpaid)</span>
            <strong style={{ fontSize: "13px", color: "#d97706" }}>EGP {totalPendingPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
          </div>
          <div style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: "6px", padding: "8px 12px", backgroundColor: "#f8fafc" }}>
            <span style={{ fontSize: "9.5px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold", display: "block" }}>Total Settled (Paid)</span>
            <strong style={{ fontSize: "13px", color: "#059669" }}>EGP {totalPaidPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        {/* UNPAID DRAFTS TABLE */}
        {filteredDrafts.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: "bold", borderBottom: "1.5px solid #0f172a", paddingBottom: "2px", marginBottom: "6px", textTransform: "uppercase", fontSize: "11px" }}>
              <span>Pending Drafts (Unpaid)</span><span>مسودات غير مدفوعة ({filteredDrafts.length})</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1", textAlign: "left" }}>
                  <th style={{ padding: "5px 6px" }}>Employee</th>
                  <th style={{ padding: "5px 6px" }}>Branch</th>
                  <th style={{ padding: "5px 6px" }}>Month</th>
                  <th style={{ padding: "5px 6px", textAlign: "center" }}>Days</th>
                  <th style={{ padding: "5px 6px", textAlign: "right" }}>Basic</th>
                  <th style={{ padding: "5px 6px", textAlign: "right" }}>Overtime</th>
                  <th style={{ padding: "5px 6px", textAlign: "right" }}>Bonus</th>
                  <th style={{ padding: "5px 6px", textAlign: "right", color: "#dc2626" }}>Deds</th>
                  <th style={{ padding: "5px 6px", textAlign: "right", color: "#dc2626" }}>Loans</th>
                  <th style={{ padding: "5px 6px", textAlign: "right", color: "#dc2626" }}>Insur</th>
                  <th style={{ padding: "5px 6px", textAlign: "right", fontWeight: "bold" }}>Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrafts.map((d, i) => {
                  const emp = employees.find(e => e.id === d.employeeId);
                  const bName = availableBranches.find(b => b.id === (emp?.branchId || d.storeId))?.name || d.storeId || "-";
                  return (
                    <tr key={d.id || i} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                      <td style={{ padding: "5px 6px", fontWeight: "bold", color: "#0f172a" }}>{emp?.name || d.employeeId}</td>
                      <td style={{ padding: "5px 6px" }}>{bName}</td>
                      <td style={{ padding: "5px 6px" }}>{d.month}</td>
                      <td style={{ padding: "5px 6px", textAlign: "center" }}>{d.days}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" }}>{(d.standardPay || 0).toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" }}>{(d.overtime || 0).toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" }}>{(d.bonus || 0).toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", color: "#dc2626" }}>{(d.deductions || 0).toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", color: "#dc2626" }}>{(d.loanThisMonth || 0).toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", color: "#dc2626" }}>{(d.insurance || 0).toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: "bold", color: "#d97706" }}>EGP {(d.netPay || 0).toLocaleString()}</td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: "#e2e8f0", fontWeight: "bold", borderTop: "1.5px solid #0f172a" }}>
                  <td colSpan={10} style={{ padding: "6px 8px", textAlign: "right" }}>SUBTOTAL PENDING:</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#d97706" }}>EGP {totalPendingPayment.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* PAID HISTORY TABLE */}
        {filteredLines.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: "bold", borderBottom: "1.5px solid #0f172a", paddingBottom: "2px", marginBottom: "6px", textTransform: "uppercase", fontSize: "11px" }}>
              <span>Paid Payroll History</span><span>سجل المرتبات المدفوعة ({filteredLines.length})</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #cbd5e1", textAlign: "left" }}>
                  <th style={{ padding: "5px 6px" }}>Employee</th>
                  <th style={{ padding: "5px 6px" }}>Branch</th>
                  <th style={{ padding: "5px 6px" }}>Month</th>
                  <th style={{ padding: "5px 6px", textAlign: "center" }}>Days</th>
                  <th style={{ padding: "5px 6px", textAlign: "right" }}>Basic</th>
                  <th style={{ padding: "5px 6px", textAlign: "right" }}>Overtime</th>
                  <th style={{ padding: "5px 6px", textAlign: "right" }}>Bonus</th>
                  <th style={{ padding: "5px 6px", textAlign: "right", color: "#dc2626" }}>Deds</th>
                  <th style={{ padding: "5px 6px", textAlign: "right", color: "#dc2626" }}>Loans</th>
                  <th style={{ padding: "5px 6px", textAlign: "right", color: "#dc2626" }}>Insur</th>
                  <th style={{ padding: "5px 6px", textAlign: "right", fontWeight: "bold" }}>Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.map((d, i) => {
                  const emp = employees.find(e => e.id === d.employeeId);
                  const bName = availableBranches.find(b => b.id === (emp?.branchId || d.storeId))?.name || d.storeId || "-";
                  return (
                    <tr key={d.id || i} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                      <td style={{ padding: "5px 6px", fontWeight: "bold", color: "#0f172a" }}>{emp?.name || d.employeeId}</td>
                      <td style={{ padding: "5px 6px" }}>{bName}</td>
                      <td style={{ padding: "5px 6px" }}>{d.month}</td>
                      <td style={{ padding: "5px 6px", textAlign: "center" }}>{d.days}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" }}>{(d.standardPay || 0).toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" }}>{(d.overtime || 0).toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" }}>{(d.bonus || 0).toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", color: "#dc2626" }}>{(d.deductions || 0).toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", color: "#dc2626" }}>{(d.loanThisMonth || 0).toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", color: "#dc2626" }}>{(d.insurance || 0).toLocaleString()}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: "bold", color: "#059669" }}>EGP {(d.netPay || 0).toLocaleString()}</td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: "#e2e8f0", fontWeight: "bold", borderTop: "1.5px solid #0f172a" }}>
                  <td colSpan={10} style={{ padding: "6px 8px", textAlign: "right" }}>SUBTOTAL SETTLED:</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#059669" }}>EGP {totalPaidPayment.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {filteredDrafts.length === 0 && filteredLines.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b", fontStyle: "italic", border: "1px solid #cbd5e1", borderRadius: "6px", margin: "16px 0" }}>
            No records found for the selected filters.
          </div>
        )}

        {/* COMBINED GRAND TOTAL BOX */}
        <div style={{ border: "1.5px solid #0f172a", borderRadius: "6px", backgroundColor: "#f8fafc", padding: "10px 14px", marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "11px", fontWeight: "bold", color: "#0f172a", display: "block" }}>COMBINED GRAND TOTAL / الإجمالي الكلي للراتب</span>
            <span style={{ fontSize: "9.5px", color: "#64748b" }}>Includes {filteredDrafts.length} Unpaid Drafts + {filteredLines.length} Paid Records</span>
          </div>
          <span style={{ fontSize: "16px", fontWeight: "900", color: "#0f172a" }}>EGP {totalCombinedPayroll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        {/* SIGNATURES */}
        <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px", backgroundColor: "#ffffff" }}>
          <div style={{ width: "45%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#475569", fontWeight: "bold", marginBottom: "25px" }}>
              <span>Prepared By (Financial Controller)</span><span>إعداد المحاسب المسؤول</span>
            </div>
            <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
          </div>
          <div style={{ width: "45%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#475569", fontWeight: "bold", marginBottom: "25px" }}>
              <span>Approved By (General Manager)</span><span>اعتماد المدير العام</span>
            </div>
            <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
          </div>
        </div>
      </div>
    </div>

    {/* PRINTABLE PAYSLIP & RECEIPT */}
    {printPayslipRecord && (() => {
      const p = printPayslipRecord;
      const emp = employees.find(e => e.id === p.employeeId) || {};
      const dateString = new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const companyName = getBranchCompanyName(emp.storeId || p.storeId, emp.branchId);

      const netPay = p.netPay || 0;
      const netPayWordsAr = numberToArabicWords(netPay);
      const netPayWordsEn = numberToEnglishWords(netPay);
      const gross = (p.standardPay || 0) + (p.overtime || 0) + (p.bonus || 0);
      const totalDeds = (p.deductions || 0) + (p.insurance || 0) + (p.loanThisMonth || 0);
      const cycleMonthLabel = getArMonthName(p.month);
      const nidChars = String(emp?.nationalId || "").replace(/\D/g, "").slice(0, 14).padEnd(14, " ").split("");
      const docRef1 = `#CK-PAY-${p.month}-${String(p.employeeId || "").slice(-4).toUpperCase()}`;
      const docRef2 = `#CK-REC-${p.month}-${String(p.employeeId || "").slice(-4).toUpperCase()}`;

      return (
        <div className="hidden print:block w-full text-slate-900 bg-white" style={{ fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif", fontSize: "10px", lineHeight: "1.4" }} dir="rtl">
          <style dangerouslySetInnerHTML={{ __html: "@media print { @page { size: A4 portrait; margin: 6mm 8mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: #fff !important; margin: 0 !important; padding: 0 !important; } } table { page-break-inside: avoid; }" }} />
          
          {/* 🌟 SHEET 1: OFFICIAL MONTHLY PAYSLIP (كشف مفردات الأجر والراتب الشهري المعتمد) 🌟 */}
          <div
            style={{
              margin: "0 auto",
              width: "100%",
              maxWidth: "100%",
              minHeight: "282mm",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "2mm 2mm",
              pageBreakAfter: "always",
              breakAfter: "page",
              pageBreakInside: "avoid",
              breakInside: "avoid"
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* 1. CORPORATE & LEGAL HEADER */}
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 2fr 1.3fr", gap: "8px", alignItems: "center", borderBottom: "2.5px solid #0f172a", paddingBottom: "6px" }}>
                <div style={{ textAlign: "right", fontSize: "10px", lineHeight: "1.4", color: "#1e293b" }}>
                  <div style={{ fontWeight: "900", fontSize: "12.5px", color: "#0f172a" }}>شركة ايه ان اتش للتجارة والتوزيع</div>
                  <div style={{ fontSize: "9px", fontWeight: "800", textTransform: "uppercase", color: "#475569" }}>ANH TRADING & DISTRIBUTION • CIRCLE K</div>
                  <div style={{ fontSize: "9px", fontFamily: "monospace", marginTop: "2px" }}>س.ت: 216727 | ب.ض: 756-563-844</div>
                  <div style={{ fontSize: "8.5px", color: "#64748b" }}>الإدارة المالية وشؤون العاملين والموارد البشرية</div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div style={{ border: "2px solid #0f172a", borderRadius: "8px", padding: "5px 12px", background: "#f8fafc" }}>
                    <div style={{ fontSize: "13.5px", fontWeight: "900", color: "#0f172a" }}>
                      كشف مفردات الأجر والراتب الشهري المعتمد
                    </div>
                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#047857", marginTop: "1px" }}>
                      مسير أجور رسمي مدقق • معتمد ومصرح بالصرف الخزيني
                    </div>
                    <div style={{ fontSize: "8.5px", color: "#475569", marginTop: "1px" }}>
                      طبقاً لأحكام قانون العمل المصري رقم 12 لسنة 2003 وقانون التأمينات رقم 148 لسنة 2019
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "left", fontSize: "9.5px", lineHeight: "1.5", color: "#1e293b", fontFamily: "monospace" }}>
                  <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>رقم المسير:</strong> <span style={{ fontWeight: "bold", color: "#1e3a8a", fontSize: "11px" }}>{docRef1}</span></div>
                  <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>تاريخ التحرير:</strong> {dateString}</div>
                  <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>دورة الاستحقاق:</strong> شهر {cycleMonthLabel} ({p.month})</div>
                  <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>جهة الصرف:</strong> خزينة الفرع نقدياً (Branch Cash Safe)</div>
                </div>
              </div>

              {/* 2. SECTION 1: EMPLOYEE & EMPLOYMENT PROFILE */}
              <div>
                <div style={{ background: "#0f172a", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "3px 8px", borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between" }}>
                  <span>أولاً: بيانات العامل وجهة العمل (Employee & Employment Profile)</span>
                  <span>طرفا علاقة العمل والمسير</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", background: "#f8fafc" }}>
                  <tbody>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>اسم العامل:</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", width: "42%", fontWeight: "900", color: "#0f172a", fontSize: "11.5px" }}>{emp?.name || "-"}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>المسمى الوظيفي:</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", width: "22%", fontWeight: "bold" }}>{emp?.position || "-"}</td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", background: "#f1f5f9", fontWeight: "bold" }}>الرقم القومي (14 رقم):</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "2.5px" }}>
                          {nidChars.map((ch: string, i: number) => (
                            <span
                              key={i}
                              style={{
                                display: "inline-block",
                                width: "19px",
                                height: "20px",
                                border: "1.5px solid #475569",
                                borderRadius: "3px",
                                textAlign: "center",
                                lineHeight: "18px",
                                fontSize: "11.5px",
                                fontWeight: "bold",
                                fontFamily: "monospace",
                                background: "#fff"
                              }}
                            >
                              {ch.trim() || "-"}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", background: "#f1f5f9", fontWeight: "bold" }}>الراتب الأساسي / التأميني:</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", fontFamily: "monospace", fontWeight: "bold", color: "#047857" }}>
                        {(Number(emp?.baseSalary) || Number(p.standardPay) || 0).toLocaleString()} ج.م
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", background: "#f1f5f9", fontWeight: "bold" }}>الشركة الموظفة:</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px" }}>شركة ايه ان اتش للتجارة والتوزيع (س.ت: 216727)</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", background: "#f1f5f9", fontWeight: "bold" }}>الفرع وجهة العمل:</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", fontWeight: "bold" }}>{companyName}</td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", background: "#f1f5f9", fontWeight: "bold" }}>دورة وشهر الاستحقاق:</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", fontWeight: "bold", color: "#1e3a8a" }}>شهر {cycleMonthLabel} ({p.month})</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", background: "#f1f5f9", fontWeight: "bold" }}>أيام العمل الفعلية:</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", fontWeight: "bold" }}>{p.days || 30} يوم عمل فعلي</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 3. SECTION 2: PROMINENT NET PAYABLE BANNER & TAFQEET */}
              <div style={{
                background: "#eff6ff",
                border: "2px solid #2563eb",
                borderRadius: "7px",
                padding: "7px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 1px 3px rgba(37,99,235,0.08)"
              }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "900", color: "#1e3a8a" }}>
                    صافي الراتب المستحق للصرف الخزيني (Net Payable):
                  </div>
                  <div style={{ fontSize: "10.5px", fontWeight: "bold", color: "#0f172a", marginTop: "2px" }}>
                    فقط وقدره: <strong style={{ color: "#047857", fontSize: "11.5px" }}>{netPayWordsAr} جنيهاً مصرياً لا غير</strong>.
                  </div>
                  <div style={{ fontSize: "8.5px", color: "#475569", fontFamily: "monospace", marginTop: "1px" }}>
                    ({netPayWordsEn})
                  </div>
                </div>
                <div style={{
                  background: "#fff",
                  border: "2px solid #047857",
                  borderRadius: "6px",
                  padding: "4px 12px",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "8px", fontWeight: "bold", color: "#64748b" }}>المبلغ الصافي المعتمد</div>
                  <div style={{ fontSize: "15px", fontWeight: "900", color: "#047857", fontFamily: "monospace" }}>
                    {netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                  </div>
                </div>
              </div>

              {/* 4. SECTION 3: ITEMIZED EARNINGS BREAKDOWN */}
              <div>
                <div style={{ background: "#047857", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "3px 8px", borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between" }}>
                  <span>ثالثاً: جدول الاستحقاقات والأجر الشامل (Gross Earnings Breakdown)</span>
                  <span>المبالغ بالجنيه المصري (EGP)</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", background: "#f8fafc" }}>
                  <thead>
                    <tr style={{ background: "#e2e8f0", color: "#1e293b", fontWeight: "bold" }}>
                      <th style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "right", width: "70%" }}>بند الاستحقاق والأجر (Earning Description)</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", width: "30%" }}>القيمة المعتمدة (Amount)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px" }}>الراتب الأساسي عن أيام العمل الفعلية (Basic Salary)</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", fontFamily: "monospace", fontWeight: "bold", color: "#0f172a" }}>
                        {(p.standardPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                      </td>
                    </tr>
                    <tr style={{ background: "#fff" }}>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px" }}>أجر ساعات العمل الإضافية المعتمدة (Approved Overtime)</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", fontFamily: "monospace", fontWeight: "bold", color: "#047857" }}>
                        {(p.overtime || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px" }}>مكافآت أداء وحوافز انتظام وبدلات وظيفية (Incentives, Bonuses & Allowances)</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", fontFamily: "monospace", fontWeight: "bold", color: "#047857" }}>
                        {(p.bonus || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                      </td>
                    </tr>
                    <tr style={{ background: "#e2e8f0", fontWeight: "bold" }}>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 8px", color: "#0f172a" }}>إجمالي الأجر الشامل المستحق (Total Gross Earnings)</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 8px", textAlign: "left", fontFamily: "monospace", fontSize: "10.5px", color: "#0f172a" }}>
                        {gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 5. SECTION 4: ITEMIZED LAWFUL DEDUCTIONS BREAKDOWN */}
              <div>
                <div style={{ background: "#334155", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "3px 8px", borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between" }}>
                  <span>رابعاً: جدول الاستقطاعات والخصومات القانونية والمالية (Lawful Deductions Breakdown)</span>
                  <span>سقف الاستقطاع: طبقاً للمادة 34 من قانون العمل 12/2003</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", background: "#f8fafc" }}>
                  <thead>
                    <tr style={{ background: "#e2e8f0", color: "#1e293b", fontWeight: "bold" }}>
                      <th style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "right", width: "70%" }}>بند الاستقطاع والخصم (Deduction Description)</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", width: "30%" }}>القيمة المستقطعة (Amount)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px" }}>جزاءات تأخير وغياب إدارية معتمدة وفق لائحة العمل (Admin Penalties)</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", fontFamily: "monospace", fontWeight: "bold", color: "#b91c1c" }}>
                        {(p.deductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                      </td>
                    </tr>
                    <tr style={{ background: "#fff" }}>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px" }}>حصة العامل في التأمينات الاجتماعية (Social Insurance - Law 148/2019)</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", fontFamily: "monospace", fontWeight: "bold", color: "#b91c1c" }}>
                        {(p.insurance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px" }}>استقطاع قسط سلفة نقدية معتمدة من المرتب (Loan / Cash Advance Deduction - Art. 34)</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", fontFamily: "monospace", fontWeight: "bold", color: "#2563eb" }}>
                        {(p.loanThisMonth || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                      </td>
                    </tr>
                    <tr style={{ background: "#fee2e2", fontWeight: "bold" }}>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 8px", color: "#991b1b" }}>إجمالي الاستقطاعات والخصومات القانونية (Total Deductions)</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 8px", textAlign: "left", fontFamily: "monospace", fontSize: "10.5px", color: "#b91c1c" }}>
                        {totalDeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 6. SECTION 5: STATUTORY EGYPTIAN LABOR LAW UNDERTAKINGS */}
              <div style={{ fontSize: "9px", lineHeight: "1.55", background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: "6px", padding: "5px 10px", color: "#1e293b" }}>
                <strong style={{ color: "#0f172a", fontSize: "9.5px" }}>خامساً: الضوابط القانونية لمسير الأجور (وفقاً لقانون العمل المصري رقم 12 لسنة 2003 وقانون التأمينات 148 لسنة 2019):</strong>
                <ol style={{ margin: "2px 0 0 0", paddingRight: "16px" }}>
                  <li>
                    <strong>الالتزام بالمادة (34):</strong> لا تتجاوز إجمالي الاستقطاعات والخصومات المفروضة على أجر العامل الحدود والنسب القانونية المنصوص عليها، بما يضمن صيانة الحد الأدنى القانوني للأجر.
                  </li>
                  <li>
                    <strong>المطابقة للمادة (38):</strong> يؤدى الأجر للعامل في أحد أيام العمل وفي مقر عمله الرسمي، وتعد بيانات هذا الكشف إثباتاً رسمياً معتمداً ومطابقاً لسجلات الأجور المعمول بها لدى الشركة.
                  </li>
                  <li>
                    <strong>التأمينات الاجتماعية:</strong> تم احتساب واستقطاع اشتراكات التأمين الاجتماعي وفقاً لأحكام قانون التأمينات الاجتماعية والمعاشات رقم 148 لسنة 2019 وقرارات الهيئة القومية للتأمين الاجتماعي.
                  </li>
                </ol>
              </div>
            </div>

            {/* 7. SIGNATURES & CORPORATE STAMP BLOCK */}
            <div style={{ marginTop: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.1fr 1.2fr 1.2fr", gap: "8px", alignItems: "center", borderTop: "2px solid #0f172a", paddingTop: "5px", marginBottom: "3px" }}>
                <div style={{ textAlign: "center", fontSize: "9px" }}>
                  <div style={{ fontWeight: "900", color: "#0f172a" }}>المحاسب المالي (معد المسير):</div>
                  <div style={{ color: "#334155", margin: "1px 0" }}>تم التدقيق الحسابي والمطابقة</div>
                  <div style={{ color: "#64748b", margin: "16px 0 0 0" }}>التوقيع: .................................</div>
                </div>

                <div style={{ textAlign: "center", fontSize: "9px" }}>
                  <div style={{ fontWeight: "900", color: "#0f172a" }}>اعتماد الموارد البشرية والإدارة:</div>
                  <div style={{ color: "#334155", margin: "1px 0" }}>معتمد ومطابق لقانون العمل</div>
                  <div style={{ color: "#64748b", margin: "16px 0 0 0" }}>التوقيع: .................................</div>
                </div>

                <div style={{ textAlign: "center", fontSize: "9px" }}>
                  <div style={{ fontWeight: "900", color: "#0f172a" }}>خاتم الشركة الرسمي (Stamp):</div>
                  <div style={{
                    margin: "2px auto 0 auto",
                    width: "120px",
                    height: "52px",
                    border: "1.5px solid #1e3a8a",
                    borderRadius: "6px",
                    padding: "2px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f8fafc"
                  }}>
                    <div style={{ fontSize: "7.5px", fontWeight: "900", color: "#1e3a8a" }}>شركة ايه ان اتش للتجارة والتوزيع</div>
                    <div style={{ fontSize: "6.5px", color: "#475569" }}>س.ت: 216727 • ب.ض: 756-563-844</div>
                    <div style={{ fontSize: "7px", color: "#047857", fontWeight: "bold", marginTop: "1px" }}>[ مسير أجور معتمد ومسجل ]</div>
                  </div>
                </div>

                <div style={{ textAlign: "center", fontSize: "9px" }}>
                  <div style={{ fontWeight: "900", color: "#0f172a" }}>توقيع العامل بالعلم واستلام الكشف:</div>
                  <div style={{ color: "#334155", margin: "1px 0" }}>استلمت صورة طبق الأصل من الكشف</div>
                  <div style={{ color: "#64748b", margin: "16px 0 0 0" }}>التوقيع: .................................</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #cbd5e1", paddingTop: "3px", fontSize: "8px", color: "#64748b" }}>
                <div>وثيقة رسمية صادرة آلياً من نظام إدارة الموارد البشرية - شركة ايه ان اتش للتجارة (ANH) • صفحة 1 من 2 (كشف مفردات الأجر الشهري)</div>
                <div>المادتان 34 و 38 من قانون العمل رقم 12 لسنة 2003 • بيان مفردات الأجر المعتمد</div>
              </div>
            </div>
          </div>

          {/* 🌟 SHEET 2: SALARY RECEIPT & LEGAL CLEARANCE (إقرار استلام الراتب والمخالصة المالية والتأمينية التامة والنهائية) 🌟 */}
          <div
            style={{
              margin: "0 auto",
              width: "100%",
              maxWidth: "100%",
              minHeight: "282mm",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "2mm 2mm",
              pageBreakAfter: "avoid",
              breakAfter: "avoid",
              pageBreakInside: "avoid",
              breakInside: "avoid"
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* 1. CORPORATE & LEGAL HEADER */}
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 2fr 1.3fr", gap: "8px", alignItems: "center", borderBottom: "2.5px solid #0f172a", paddingBottom: "6px" }}>
                <div style={{ textAlign: "right", fontSize: "10px", lineHeight: "1.4", color: "#1e293b" }}>
                  <div style={{ fontWeight: "900", fontSize: "12.5px", color: "#0f172a" }}>شركة ايه ان اتش للتجارة والتوزيع</div>
                  <div style={{ fontSize: "9px", fontWeight: "800", textTransform: "uppercase", color: "#475569" }}>ANH TRADING & DISTRIBUTION • CIRCLE K</div>
                  <div style={{ fontSize: "9px", fontFamily: "monospace", marginTop: "2px" }}>س.ت: 216727 | ب.ض: 756-563-844</div>
                  <div style={{ fontSize: "8.5px", color: "#64748b" }}>الإدارة المالية وشؤون العاملين والموارد البشرية</div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div style={{ border: "2px solid #0f172a", borderRadius: "8px", padding: "5px 12px", background: "#f8fafc" }}>
                    <div style={{ fontSize: "13px", fontWeight: "900", color: "#0f172a" }}>
                      إقرار استلام الراتب والمخالصة المالية والتأمينية التامة والنهائية
                    </div>
                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#047857", marginTop: "1px" }}>
                      مخالصة نهائية تامة وناجزة وبراءة ذمة قانونية وقضائية مطلقة
                    </div>
                    <div style={{ fontSize: "8.5px", color: "#475569", marginTop: "1px" }}>
                      إعمالاً لأحكام المادتين (38) و (76) من قانون العمل المصري رقم 12 لسنة 2003
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "left", fontSize: "9.5px", lineHeight: "1.5", color: "#1e293b", fontFamily: "monospace" }}>
                  <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>رقم السند:</strong> <span style={{ fontWeight: "bold", color: "#1e3a8a", fontSize: "11px" }}>{docRef2}</span></div>
                  <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>تاريخ الصرف:</strong> {dateString}</div>
                  <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>دورة الراتب:</strong> شهر {cycleMonthLabel} ({p.month})</div>
                  <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>جهة الصرف:</strong> خزينة الفرع نقدياً (Branch Cash Safe)</div>
                </div>
              </div>

              {/* 2. SECTION 1: ACKNOWLEDGING EMPLOYEE PROFILE */}
              <div>
                <div style={{ background: "#0f172a", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "3px 8px", borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between" }}>
                  <span>أولاً: بيانات العامل والمُقر بالاستلام والتخالص (Acknowledging Employee Profile)</span>
                  <span>المقر بما فيه قانوناً</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", background: "#f8fafc" }}>
                  <tbody>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>اسم العامل المُقر:</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", width: "42%", fontWeight: "900", color: "#0f172a", fontSize: "11.5px" }}>{emp?.name || "-"}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>المسمى الوظيفي:</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", width: "22%", fontWeight: "bold" }}>{emp?.position || "-"}</td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", background: "#f1f5f9", fontWeight: "bold" }}>الرقم القومي (14 رقم):</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "2.5px" }}>
                          {nidChars.map((ch: string, i: number) => (
                            <span
                              key={i}
                              style={{
                                display: "inline-block",
                                width: "19px",
                                height: "20px",
                                border: "1.5px solid #475569",
                                borderRadius: "3px",
                                textAlign: "center",
                                lineHeight: "18px",
                                fontSize: "11.5px",
                                fontWeight: "bold",
                                fontFamily: "monospace",
                                background: "#fff"
                              }}
                            >
                              {ch.trim() || "-"}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", background: "#f1f5f9", fontWeight: "bold" }}>الشركة الموظفة:</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px" }}>شركة ايه ان اتش للتجارة والتوزيع</td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", background: "#f1f5f9", fontWeight: "bold" }}>الفرع وجهة العمل:</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", fontWeight: "bold" }}>{companyName}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", background: "#f1f5f9", fontWeight: "bold" }}>طريقة الصرف والتسليم:</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 7px", fontWeight: "bold", color: "#047857" }}>نقداً وعداً من خزينة الفرع</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 3. SECTION 2: NET AMOUNT RECEIVED & TAFQEET */}
              <div style={{
                background: "#ecfdf5",
                border: "2px solid #047857",
                borderRadius: "7px",
                padding: "7px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 1px 3px rgba(4,120,87,0.08)"
              }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "900", color: "#065f46" }}>
                    المبلغ الصافي المسلّم نقداً للعامل (Net Cash Received):
                  </div>
                  <div style={{ fontSize: "10.5px", fontWeight: "bold", color: "#0f172a", marginTop: "2px" }}>
                    فقط وقدره: <strong style={{ color: "#047857", fontSize: "11.5px" }}>{netPayWordsAr} جنيهاً مصرياً لا غير</strong>.
                  </div>
                  <div style={{ fontSize: "8.5px", color: "#475569", fontFamily: "monospace", marginTop: "1px" }}>
                    ({netPayWordsEn})
                  </div>
                </div>
                <div style={{
                  background: "#fff",
                  border: "2px solid #047857",
                  borderRadius: "6px",
                  padding: "4px 12px",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "8px", fontWeight: "bold", color: "#065f46" }}>إجمالي النقدية المستلمة</div>
                  <div style={{ fontSize: "15px", fontWeight: "900", color: "#047857", fontFamily: "monospace" }}>
                    {netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                  </div>
                </div>
              </div>

              {/* 4. SECTION 3: COMPREHENSIVE EGYPTIAN LABOR LAW CLEARANCE CLAUSES */}
              <div style={{ fontSize: "9px", lineHeight: "1.58", background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: "6px", padding: "7px 11px", color: "#1e293b" }}>
                <strong style={{ color: "#0f172a", fontSize: "10px" }}>ثالثاً: البنود القانونية للمخالصة وبراءة الذمة القضائية التامة (وفقاً لقانون العمل المصري رقم 12 لسنة 2003):</strong>
                <ol style={{ margin: "3px 0 0 0", paddingRight: "16px" }}>
                  <li style={{ marginBottom: "2.5px" }}>
                    <strong>إقرار استلام كامل الأجر والمستحقات:</strong> أقر أنا العامل المقر أدناه بكامل إرادتي وبصفتي موظفاً لدى شركة ايه ان اتش للتجارة والتوزيع، بأنني قد استلمت من إدارة الشركة وخزينة الفرع كامل صافي أجري ومستحقاتي المالية الموضحة أعلاه عن دورة شهر ({cycleMonthLabel}) نقداً وعداً دون أي نقص أو تأخير أو اقتطاع غير مشروع.
                  </li>
                  <li style={{ marginBottom: "2.5px" }}>
                    <strong>المخالصة المالية والتأمينية الشاملة والنهائية وبراءة الذمة:</strong> يُعد استلامي لصافي هذا الراتب وتوقيعي وبصمتي على هذا الإقرار بمثابة مخالصة مالية وتأمينية نهائية تامة وناجزة وبراءة ذمة مطلقة لشركة ايه ان اتش للتجارة والتوزيع (س.ت: 216727) وكافة فروعها وإداراتها ومسؤوليها، إبراءً شاملاً مسقطاً لكافة الحقوق والدعاوى والمطالبات العمالية والمدنية والمالية عن دورة هذا الشهر، بما يشمل الراتب الأساسي، بدلات الانتقال والسكن، البدلات الوظيفية، مكافآت وحوافز الإنتاج، وأجر ساعات العمل الإضافية.
                  </li>
                  <li style={{ marginBottom: "2.5px" }}>
                    <strong>الإقرار بصحة الاستقطاعات والجزاءات والتأمينات والسلف:</strong> أقر بموافقتي التامة والقطعية على صحة كافة الاستقطاعات المنفذة على راتبي لشهر الاستحقاق، سواء كانت جزاءات وتأخيرات إدارية، أو اشتراكات التأمينات الاجتماعية وفق القانون رقم 148 لسنة 2019، أو أقساط سداد سلف نقدية استقطعت وفقاً للتفويض الصادر مني وطبقاً للمادة (34) من قانون العمل، وليس لي الحق في الاعتراض عليها أو المطالبة باسترداد أي جزء منها.
                  </li>
                  <li>
                    <strong>الحجية القضائية والإلزام القانوني المطلق:</strong> تم تحرير وتوقيع هذا الإقرار والمخالصة بمحض إرادتي الحرة وبكامل الأهلية القانونية المعتبرة شرعاً وقانوناً، ودون أي ضغط أو إكراه أو تدليس، وتعد هذه الوثيقة بما تضمنته من توقيع وبصمة إبهامي حجة قانونية وقضائية قاطعة ونافذة في مواجهتي ومسؤوليتي المدنية والقضائية الكاملة أمام جميع مكاتب العمل، اللجان التوفيقية، المحاكم العمالية، وكافة جهات القضاء في جمهورية مصر العربية، ولا يجوز لي الطعن عليها أو الرجوع فيها بأي وجه من الوجوه، إعمالاً لأحكام المادتين (38) و(76) من قانون العمل المصري رقم 12 لسنة 2003.
                  </li>
                </ol>
              </div>
            </div>

            {/* 5. SIGNATURES, THUMBPRINT & CORPORATE STAMP BLOCK */}
            <div style={{ marginTop: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: "8px", alignItems: "center", borderTop: "2px solid #0f172a", paddingTop: "5px", marginBottom: "3px" }}>
                {/* Employee Signature */}
                <div style={{ textAlign: "center", fontSize: "9px" }}>
                  <div style={{ fontWeight: "900", color: "#0f172a" }}>المُقر بما فيه (العامل المستلم):</div>
                  <div style={{ color: "#334155", margin: "1px 0", fontWeight: "bold" }}>{emp?.name || "-"}</div>
                  <div style={{ color: "#64748b", margin: "16px 0 0 0" }}>التوقيع: .................................</div>
                </div>

                {/* OFFICIAL THUMBPRINT BOX */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: "8.5px", fontWeight: "900", color: "#0f172a", marginBottom: "1px" }}>
                    بصمة إبهام العامل (ختم إلزامي):
                  </div>
                  <div style={{
                    width: "100px",
                    height: "60px",
                    border: "2px solid #0f172a",
                    borderRadius: "6px",
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    fontSize: "8.5px",
                    color: "#94a3b8",
                    fontWeight: "bold",
                    boxShadow: "inset 0 0 4px rgba(0,0,0,0.05)"
                  }}>
                    [ بصمة الإبهام الأيمن ]
                  </div>
                </div>

                {/* Safe Custodian / Store Manager Witness */}
                <div style={{ textAlign: "center", fontSize: "9px" }}>
                  <div style={{ fontWeight: "900", color: "#0f172a" }}>أمين الخزينة / مدير الفرع:</div>
                  <div style={{ color: "#334155", margin: "1px 0" }}>تم الصرف والتسليم نقداً بالخزينة</div>
                  <div style={{ color: "#64748b", margin: "16px 0 0 0" }}>التوقيع: .................................</div>
                </div>

                {/* HR Approval & Corporate Stamp */}
                <div style={{ textAlign: "center", fontSize: "9px" }}>
                  <div style={{ fontWeight: "900", color: "#0f172a" }}>اعتماد الموارد البشرية وخاتم الشركة:</div>
                  <div style={{
                    margin: "2px auto 0 auto",
                    width: "115px",
                    height: "54px",
                    border: "1.5px solid #1e3a8a",
                    borderRadius: "6px",
                    padding: "2px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f8fafc"
                  }}>
                    <div style={{ fontSize: "7.5px", fontWeight: "900", color: "#1e3a8a" }}>شركة ايه ان اتش للتجارة</div>
                    <div style={{ fontSize: "6.5px", color: "#475569" }}>س.ت: 216727 • ب.ض: 756-563-844</div>
                    <div style={{ fontSize: "7px", color: "#047857", fontWeight: "bold", marginTop: "1px" }}>[ مخالصة معتمدة ومسجلة ]</div>
                  </div>
                </div>
              </div>

              {/* Footer Security Strip */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #cbd5e1", paddingTop: "3px", fontSize: "8px", color: "#64748b" }}>
                <div>وثيقة رسمية ومخالصة قضائية صادرة آلياً من نظام إدارة الموارد البشرية - شركة ايه ان اتش للتجارة (ANH) • صفحة 2 من 2 (المخالصة التامة)</div>
                <div>المادتان 38 و 76 من قانون العمل المصري رقم 12 لسنة 2003 • إقرار استلام راتب ومخالصة نهائية وناجزة</div>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {/* PRINTABLE BATCH PAYROLL BOOKLET */}
    {isBatchPrinting && (() => {
      const dateString = new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const totalBatchGross = filteredDrafts.reduce((acc, curr) => acc + (curr.standardPay || 0) + (curr.overtime || 0) + (curr.bonus || 0), 0);
      const totalBatchDeds = filteredDrafts.reduce((acc, curr) => acc + (curr.deductions || 0) + (curr.insurance || 0) + (curr.loanThisMonth || 0), 0);
      const totalBatchNet = filteredDrafts.reduce((acc, curr) => acc + (curr.netPay || 0), 0);
      
      const empBranchObj = availableBranches.find(b => b.id === currentBranch);
      const companyName = empBranchObj ? empBranchObj.name : "Circle K Franchise";

      return (
        <div className="hidden print:block w-full text-slate-900 bg-white" style={{ fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif", fontSize: "10.5px", lineHeight: "1.4" }} dir="rtl">
          <style dangerouslySetInnerHTML={{ __html: "@media print { @page { size: A4 portrait; margin: 6mm 8mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: #fff !important; margin: 0 !important; padding: 0 !important; } } table { page-break-inside: avoid; }" }} />
          
          {/* PAGE 1: EXECUTIVE SUMMARY TABLE */}
          <div style={{ margin: "0 auto", width: "100%", maxWidth: "100%", minHeight: "282mm", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "2mm 2mm", pageBreakAfter: "always", breakAfter: "page" }}>
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 2fr 1.3fr", gap: "8px", alignItems: "center", borderBottom: "2.5px solid #0f172a", paddingBottom: "6px", marginBottom: "10px" }}>
                <div style={{ textAlign: "right", fontSize: "10px", lineHeight: "1.4", color: "#1e293b" }}>
                  <div style={{ fontWeight: "900", fontSize: "12.5px", color: "#0f172a" }}>شركة ايه ان اتش للتجارة والتوزيع</div>
                  <div style={{ fontSize: "9px", fontWeight: "800", textTransform: "uppercase", color: "#475569" }}>ANH TRADING & DISTRIBUTION • CIRCLE K</div>
                  <div style={{ fontSize: "9px", fontFamily: "monospace", marginTop: "2px" }}>س.ت: 216727 | ب.ض: 756-563-844</div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div style={{ border: "2px solid #0f172a", borderRadius: "8px", padding: "5px 12px", background: "#f8fafc" }}>
                    <div style={{ fontSize: "14px", fontWeight: "900", color: "#0f172a" }}>
                      مسير رواتب ومستحقات العاملين الإجمالي (Executive Payroll Summary)
                    </div>
                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#047857", marginTop: "1px" }}>
                      كشف حصر واعتماد الرواتب الشهرية الشامل لفرع: {companyName}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "left", fontSize: "9.5px", lineHeight: "1.5", color: "#1e293b", fontFamily: "monospace" }}>
                  <div><strong>التاريخ:</strong> {dateString}</div>
                  <div><strong>إجمالي العاملين:</strong> {filteredDrafts.length} موظف</div>
                  <div><strong>صافي الرواتب:</strong> {totalBatchNet.toLocaleString()} ج.م</div>
                </div>
              </div>

              {/* Summary Metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
                <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "6px", padding: "6px 10px", background: "#f8fafc", textAlign: "center" }}>
                  <div style={{ fontSize: "9px", color: "#64748b" }}>عدد العاملين بالمسير</div>
                  <div style={{ fontSize: "14px", fontWeight: "900", color: "#0f172a" }}>{filteredDrafts.length} موظف</div>
                </div>
                <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "6px", padding: "6px 10px", background: "#f8fafc", textAlign: "center" }}>
                  <div style={{ fontSize: "9px", color: "#64748b" }}>إجمالي الأجر الشامل</div>
                  <div style={{ fontSize: "14px", fontWeight: "900", color: "#0f172a" }}>{totalBatchGross.toLocaleString()} ج.م</div>
                </div>
                <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "6px", padding: "6px 10px", background: "#fee2e2", textAlign: "center" }}>
                  <div style={{ fontSize: "9px", color: "#991b1b" }}>إجمالي الاستقطاعات</div>
                  <div style={{ fontSize: "14px", fontWeight: "900", color: "#b91c1c" }}>{totalBatchDeds.toLocaleString()} ج.م</div>
                </div>
                <div style={{ border: "1.5px solid #047857", borderRadius: "6px", padding: "6px 10px", background: "#ecfdf5", textAlign: "center" }}>
                  <div style={{ fontSize: "9px", color: "#065f46" }}>إجمالي الصافي المستحق</div>
                  <div style={{ fontSize: "14px", fontWeight: "900", color: "#047857" }}>{totalBatchNet.toLocaleString()} ج.م</div>
                </div>
              </div>

              {/* Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", textAlign: "center" }}>
                <thead>
                  <tr style={{ background: "#0f172a", color: "#ffffff" }}>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px" }}>#</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px", textAlign: "right" }}>اسم العامل</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px" }}>الشهر</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px" }}>الأيام</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px", textAlign: "left" }}>الأجر الشامل</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px", textAlign: "left" }}>الاستقطاعات</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px", textAlign: "left" }}>الصافي المستحق</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrafts.map((d, index) => {
                    const emp = employees.find(e => e.id === d.employeeId);
                    const gross = (d.standardPay || 0) + (d.overtime || 0) + (d.bonus || 0);
                    const deds = (d.deductions || 0) + (d.insurance || 0) + (d.loanThisMonth || 0);
                    return (
                      <tr key={d.id || index} style={{ background: index % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px", fontWeight: "bold" }}>{index + 1}</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px", textAlign: "right", fontWeight: "bold", color: "#0f172a" }}>{emp?.name || d.employeeId}</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px", fontFamily: "monospace" }}>{d.month}</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px" }}>{d.days}</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px", textAlign: "left", fontFamily: "monospace" }}>{gross.toLocaleString()} ج.م</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px", textAlign: "left", color: "#b91c1c", fontFamily: "monospace" }}>{deds.toLocaleString()} ج.م</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px", textAlign: "left", fontWeight: "900", color: "#047857", fontFamily: "monospace" }}>{(d.netPay || 0).toLocaleString()} ج.م</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "#e2e8f0", fontWeight: "bold", borderTop: "2px solid #0f172a" }}>
                    <td colSpan={4} style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "right" }}>الإجمالي العام (GRAND TOTALS):</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "left", fontFamily: "monospace" }}>{totalBatchGross.toLocaleString()} ج.م</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "left", color: "#b91c1c", fontFamily: "monospace" }}>{totalBatchDeds.toLocaleString()} ج.م</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "left", fontSize: "11px", color: "#047857", fontFamily: "monospace" }}>{totalBatchNet.toLocaleString()} ج.م</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Approvals */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", borderTop: "2px solid #0f172a", paddingTop: "8px", marginTop: "12px" }}>
              <div style={{ textAlign: "center", fontSize: "9.5px" }}>
                <div style={{ fontWeight: "900" }}>إعداد المحاسب المالي:</div>
                <div style={{ color: "#64748b", marginTop: "20px" }}>التوقيع: .................................</div>
              </div>
              <div style={{ textAlign: "center", fontSize: "9.5px" }}>
                <div style={{ fontWeight: "900" }}>اعتماد مدير الموارد البشرية:</div>
                <div style={{ color: "#64748b", marginTop: "20px" }}>التوقيع: .................................</div>
              </div>
              <div style={{ textAlign: "center", fontSize: "9.5px" }}>
                <div style={{ fontWeight: "900" }}>اعتماد المدير العام وخاتم الشركة:</div>
                <div style={{ color: "#64748b", marginTop: "20px" }}>التوقيع والختم: .................................</div>
              </div>
            </div>
          </div>

          {/* PER EMPLOYEE 2-PAGE PACKETS */}
          {filteredDrafts.map((d, idx) => {
            const emp = employees.find(e => e.id === d.employeeId) || {};
            const empCompName = getBranchCompanyName(d.storeId, emp.branchId || d.storeId);
            const netPay = d.netPay || 0;
            const netPayWordsAr = numberToArabicWords(netPay);
            const netPayWordsEn = numberToEnglishWords(netPay);
            const gross = (d.standardPay || 0) + (d.overtime || 0) + (d.bonus || 0);
            const totalDeds = (d.deductions || 0) + (d.insurance || 0) + (d.loanThisMonth || 0);
            const cycleMonthLabel = getArMonthName(d.month);
            const nidChars = String(emp?.nationalId || "").replace(/\D/g, "").slice(0, 14).padEnd(14, " ").split("");
            const docRef1 = `#CK-PAY-${d.month}-${String(d.employeeId || "").slice(-4).toUpperCase()}`;
            const docRef2 = `#CK-REC-${d.month}-${String(d.employeeId || "").slice(-4).toUpperCase()}`;
            const isLast = idx === filteredDrafts.length - 1;

            return (
              <React.Fragment key={d.id || idx}>
                {/* SHEET 1: PAYSLIP */}
                <div
                  style={{
                    margin: "0 auto",
                    width: "100%",
                    maxWidth: "100%",
                    minHeight: "282mm",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "2mm 2mm",
                    pageBreakAfter: "always",
                    breakAfter: "page",
                    pageBreakInside: "avoid",
                    breakInside: "avoid"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 2fr 1.3fr", gap: "8px", alignItems: "center", borderBottom: "2.5px solid #0f172a", paddingBottom: "6px" }}>
                      <div style={{ textAlign: "right", fontSize: "10px", lineHeight: "1.4", color: "#1e293b" }}>
                        <div style={{ fontWeight: "900", fontSize: "12.5px", color: "#0f172a" }}>شركة ايه ان اتش للتجارة والتوزيع</div>
                        <div style={{ fontSize: "9px", fontWeight: "800", textTransform: "uppercase", color: "#475569" }}>ANH TRADING & DISTRIBUTION • CIRCLE K</div>
                        <div style={{ fontSize: "9px", fontFamily: "monospace", marginTop: "2px" }}>س.ت: 216727 | ب.ض: 756-563-844</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ border: "2px solid #0f172a", borderRadius: "8px", padding: "5px 12px", background: "#f8fafc" }}>
                          <div style={{ fontSize: "13.5px", fontWeight: "900", color: "#0f172a" }}>كشف مفردات الأجر والراتب الشهري المعتمد</div>
                          <div style={{ fontSize: "10px", fontWeight: "bold", color: "#047857", marginTop: "1px" }}>مسير أجور رسمي مدقق • معتمد ومصرح بالصرف</div>
                          <div style={{ fontSize: "8.5px", color: "#475569", marginTop: "1px" }}>طبقاً لأحكام قانون العمل المصري رقم 12 لسنة 2003 وقانون 148 لسنة 2019</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "left", fontSize: "9.5px", lineHeight: "1.5", color: "#1e293b", fontFamily: "monospace" }}>
                        <div><strong>رقم المسير:</strong> {docRef1}</div>
                        <div><strong>تاريخ التحرير:</strong> {dateString}</div>
                        <div><strong>دورة الاستحقاق:</strong> شهر {cycleMonthLabel}</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ background: "#0f172a", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "3px 8px", borderRadius: "4px 4px 0 0" }}>
                        أولاً: بيانات العامل وجهة العمل (Employee & Employment Profile)
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", background: "#f8fafc" }}>
                        <tbody>
                          <tr>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>اسم العامل:</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", width: "42%", fontWeight: "900", color: "#0f172a", fontSize: "11.5px" }}>{emp?.name || "-"}</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>المسمى الوظيفي:</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", width: "22%", fontWeight: "bold" }}>{emp?.position || "-"}</td>
                          </tr>
                          <tr>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", background: "#f1f5f9", fontWeight: "bold" }}>الرقم القومي (14 رقم):</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "2.5px" }}>
                                {nidChars.map((ch: string, i: number) => (
                                  <span key={i} style={{ display: "inline-block", width: "19px", height: "20px", border: "1.5px solid #475569", borderRadius: "3px", textAlign: "center", lineHeight: "18px", fontSize: "11.5px", fontWeight: "bold", fontFamily: "monospace", background: "#fff" }}>
                                    {ch.trim() || "-"}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", background: "#f1f5f9", fontWeight: "bold" }}>الراتب الأساسي / التأميني:</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", fontFamily: "monospace", fontWeight: "bold", color: "#047857" }}>
                              {(Number(emp?.baseSalary) || Number(d.standardPay) || 0).toLocaleString()} ج.م
                            </td>
                          </tr>
                          <tr>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", background: "#f1f5f9", fontWeight: "bold" }}>الفرع وجهة العمل:</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", fontWeight: "bold" }}>{empCompName}</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", background: "#f1f5f9", fontWeight: "bold" }}>أيام العمل الفعلية:</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", fontWeight: "bold" }}>{d.days || 30} يوم</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ background: "#eff6ff", border: "2px solid #2563eb", borderRadius: "7px", padding: "7px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: "900", color: "#1e3a8a" }}>صافي الراتب المستحق للصرف الخزيني (Net Payable):</div>
                        <div style={{ fontSize: "10.5px", fontWeight: "bold", color: "#0f172a", marginTop: "2px" }}>
                          فقط وقدره: <strong style={{ color: "#047857", fontSize: "11.5px" }}>{netPayWordsAr} جنيهاً مصرياً لا غير</strong>.
                        </div>
                      </div>
                      <div style={{ background: "#fff", border: "2px solid #047857", borderRadius: "6px", padding: "4px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: "8px", fontWeight: "bold", color: "#64748b" }}>المبلغ الصافي المعتمد</div>
                        <div style={{ fontSize: "15px", fontWeight: "900", color: "#047857", fontFamily: "monospace" }}>{netPay.toLocaleString()} ج.م</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ background: "#047857", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "3px 8px", borderRadius: "4px 4px 0 0" }}>ثالثاً: تفاصيل الاستحقاقات والأجر الشامل</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", background: "#f8fafc" }}>
                        <tbody>
                          <tr>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", width: "70%" }}>الراتب الأساسي (Basic Salary)</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", fontFamily: "monospace", fontWeight: "bold" }}>{(d.standardPay || 0).toLocaleString()} ج.م</td>
                          </tr>
                          <tr style={{ background: "#fff" }}>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px" }}>أجر إضافي (Overtime)</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", fontFamily: "monospace", fontWeight: "bold", color: "#047857" }}>{(d.overtime || 0).toLocaleString()} ج.م</td>
                          </tr>
                          <tr>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px" }}>مكافآت وحوافز انتظام (Bonuses & Allowances)</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", fontFamily: "monospace", fontWeight: "bold", color: "#047857" }}>{(d.bonus || 0).toLocaleString()} ج.م</td>
                          </tr>
                          <tr style={{ background: "#e2e8f0", fontWeight: "bold" }}>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 8px" }}>إجمالي الأجر الشامل (Gross Earnings)</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 8px", textAlign: "left", fontFamily: "monospace", fontSize: "10.5px" }}>{gross.toLocaleString()} ج.م</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <div style={{ background: "#334155", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "3px 8px", borderRadius: "4px 4px 0 0" }}>رابعاً: تفاصيل الاستقطاعات والخصومات القانونية</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", background: "#f8fafc" }}>
                        <tbody>
                          <tr>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", width: "70%" }}>جزاءات تأخير وغياب إدارية (Admin Penalties)</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", fontFamily: "monospace", fontWeight: "bold", color: "#b91c1c" }}>{(d.deductions || 0).toLocaleString()} ج.م</td>
                          </tr>
                          <tr style={{ background: "#fff" }}>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px" }}>حصة العامل في التأمينات الاجتماعية (Social Insurance)</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", fontFamily: "monospace", fontWeight: "bold", color: "#b91c1c" }}>{(d.insurance || 0).toLocaleString()} ج.م</td>
                          </tr>
                          <tr>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px" }}>استقطاع قسط سلفة من المرتب (Loan Deduction - Art. 34)</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 8px", textAlign: "left", fontFamily: "monospace", fontWeight: "bold", color: "#2563eb" }}>{(d.loanThisMonth || 0).toLocaleString()} ج.م</td>
                          </tr>
                          <tr style={{ background: "#fee2e2", fontWeight: "bold" }}>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 8px", color: "#991b1b" }}>إجمالي الاستقطاعات والخصومات (Total Deductions)</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4.5px 8px", textAlign: "left", fontFamily: "monospace", fontSize: "10.5px", color: "#b91c1c" }}>{totalDeds.toLocaleString()} ج.م</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ fontSize: "9px", lineHeight: "1.55", background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: "6px", padding: "5px 10px", color: "#1e293b" }}>
                      <strong style={{ color: "#0f172a", fontSize: "9.5px" }}>خامساً: الضوابط القانونية لمسير الأجور (وفقاً لقانون العمل المصري رقم 12 لسنة 2003 وقانون التأمينات 148 لسنة 2019):</strong>
                      <ol style={{ margin: "2px 0 0 0", paddingRight: "16px" }}>
                        <li>الالتزام بالمادة (34): لا تتجاوز إجمالي الاستقطاعات والخصومات على أجر العامل الحدود المقررة قانوناً.</li>
                        <li>المطابقة للمادة (38): يؤدى الأجر للعامل في أحد أيام العمل وفي مقر عمله الرسمي ويثبت بالسجلات الرسمية.</li>
                      </ol>
                    </div>
                  </div>

                  <div style={{ marginTop: "6px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.1fr 1.2fr 1.2fr", gap: "8px", alignItems: "center", borderTop: "2px solid #0f172a", paddingTop: "5px", marginBottom: "3px" }}>
                      <div style={{ textAlign: "center", fontSize: "9px" }}>
                        <div style={{ fontWeight: "900", color: "#0f172a" }}>المحاسب المالي (معد المسير):</div>
                        <div style={{ color: "#64748b", margin: "16px 0 0 0" }}>التوقيع: .................................</div>
                      </div>
                      <div style={{ textAlign: "center", fontSize: "9px" }}>
                        <div style={{ fontWeight: "900", color: "#0f172a" }}>اعتماد الموارد البشرية:</div>
                        <div style={{ color: "#64748b", margin: "16px 0 0 0" }}>التوقيع: .................................</div>
                      </div>
                      <div style={{ textAlign: "center", fontSize: "9px" }}>
                        <div style={{ fontWeight: "900", color: "#0f172a" }}>خاتم الشركة الرسمي:</div>
                        <div style={{ margin: "2px auto 0 auto", width: "120px", height: "52px", border: "1.5px solid #1e3a8a", borderRadius: "6px", padding: "2px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
                          <div style={{ fontSize: "7.5px", fontWeight: "900", color: "#1e3a8a" }}>شركة ايه ان اتش للتجارة</div>
                          <div style={{ fontSize: "6.5px", color: "#475569" }}>س.ت: 216727 • ب.ض: 756-563-844</div>
                          <div style={{ fontSize: "7px", color: "#047857", fontWeight: "bold" }}>[ مسير أجور معتمد ]</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "center", fontSize: "9px" }}>
                        <div style={{ fontWeight: "900", color: "#0f172a" }}>توقيع العامل بالعلم:</div>
                        <div style={{ color: "#64748b", margin: "16px 0 0 0" }}>التوقيع: .................................</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #cbd5e1", paddingTop: "3px", fontSize: "8px", color: "#64748b" }}>
                      <div>وثيقة رسمية صادرة آلياً من نظام إدارة الموارد البشرية - شركة ايه ان اتش للتجارة (ANH) • صفحة 1 من 2</div>
                      <div>المادتان 34 و 38 من قانون العمل رقم 12 لسنة 2003</div>
                    </div>
                  </div>
                </div>

                {/* SHEET 2: SALARY RECEIPT & CLEARANCE */}
                <div
                  style={{
                    margin: "0 auto",
                    width: "100%",
                    maxWidth: "100%",
                    minHeight: "282mm",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "2mm 2mm",
                    pageBreakAfter: isLast ? "avoid" : "always",
                    breakAfter: isLast ? "avoid" : "page",
                    pageBreakInside: "avoid",
                    breakInside: "avoid"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 2fr 1.3fr", gap: "8px", alignItems: "center", borderBottom: "2.5px solid #0f172a", paddingBottom: "6px" }}>
                      <div style={{ textAlign: "right", fontSize: "10px", lineHeight: "1.4", color: "#1e293b" }}>
                        <div style={{ fontWeight: "900", fontSize: "12.5px", color: "#0f172a" }}>شركة ايه ان اتش للتجارة والتوزيع</div>
                        <div style={{ fontSize: "9px", fontWeight: "800", textTransform: "uppercase", color: "#475569" }}>ANH TRADING & DISTRIBUTION • CIRCLE K</div>
                        <div style={{ fontSize: "9px", fontFamily: "monospace", marginTop: "2px" }}>س.ت: 216727 | ب.ض: 756-563-844</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ border: "2px solid #0f172a", borderRadius: "8px", padding: "5px 12px", background: "#f8fafc" }}>
                          <div style={{ fontSize: "13px", fontWeight: "900", color: "#0f172a" }}>إقرار استلام الراتب والمخالصة المالية والتأمينية التامة والنهائية</div>
                          <div style={{ fontSize: "10px", fontWeight: "bold", color: "#047857", marginTop: "1px" }}>مخالصة نهائية تامة وناجزة وبراءة ذمة قانونية وقضائية مطلقة</div>
                          <div style={{ fontSize: "8.5px", color: "#475569", marginTop: "1px" }}>إعمالاً لأحكام المادتين (38) و (76) من قانون العمل المصري رقم 12 لسنة 2003</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "left", fontSize: "9.5px", lineHeight: "1.5", color: "#1e293b", fontFamily: "monospace" }}>
                        <div><strong>رقم السند:</strong> {docRef2}</div>
                        <div><strong>تاريخ الصرف:</strong> {dateString}</div>
                        <div><strong>دورة الراتب:</strong> شهر {cycleMonthLabel}</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ background: "#0f172a", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "3px 8px", borderRadius: "4px 4px 0 0" }}>
                        أولاً: بيانات العامل والمُقر بالاستلام والتخالص (Acknowledging Employee Profile)
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", background: "#f8fafc" }}>
                        <tbody>
                          <tr>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>اسم العامل المُقر:</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", width: "42%", fontWeight: "900", color: "#0f172a", fontSize: "11.5px" }}>{emp?.name || "-"}</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>المسمى الوظيفي:</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", width: "22%", fontWeight: "bold" }}>{emp?.position || "-"}</td>
                          </tr>
                          <tr>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", background: "#f1f5f9", fontWeight: "bold" }}>الرقم القومي (14 رقم):</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "2.5px" }}>
                                {nidChars.map((ch: string, i: number) => (
                                  <span key={i} style={{ display: "inline-block", width: "19px", height: "20px", border: "1.5px solid #475569", borderRadius: "3px", textAlign: "center", lineHeight: "18px", fontSize: "11.5px", fontWeight: "bold", fontFamily: "monospace", background: "#fff" }}>
                                    {ch.trim() || "-"}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", background: "#f1f5f9", fontWeight: "bold" }}>الشركة الموظفة:</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px" }}>شركة ايه ان اتش للتجارة والتوزيع</td>
                          </tr>
                          <tr>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", background: "#f1f5f9", fontWeight: "bold" }}>الفرع وجهة العمل:</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", fontWeight: "bold" }}>{empCompName}</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", background: "#f1f5f9", fontWeight: "bold" }}>طريقة الصرف:</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "4px 7px", fontWeight: "bold", color: "#047857" }}>نقداً وعداً من خزينة الفرع</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ background: "#ecfdf5", border: "2px solid #047857", borderRadius: "7px", padding: "7px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: "900", color: "#065f46" }}>المبلغ الصافي المسلّم نقداً للعامل (Net Cash Received):</div>
                        <div style={{ fontSize: "10.5px", fontWeight: "bold", color: "#0f172a", marginTop: "2px" }}>
                          فقط وقدره: <strong style={{ color: "#047857", fontSize: "11.5px" }}>{netPayWordsAr} جنيهاً مصرياً لا غير</strong>.
                        </div>
                      </div>
                      <div style={{ background: "#fff", border: "2px solid #047857", borderRadius: "6px", padding: "4px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: "8px", fontWeight: "bold", color: "#065f46" }}>إجمالي النقدية المستلمة</div>
                        <div style={{ fontSize: "15px", fontWeight: "900", color: "#047857", fontFamily: "monospace" }}>{netPay.toLocaleString()} ج.م</div>
                      </div>
                    </div>

                    <div style={{ fontSize: "9px", lineHeight: "1.58", background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: "6px", padding: "7px 11px", color: "#1e293b" }}>
                      <strong style={{ color: "#0f172a", fontSize: "10px" }}>ثالثاً: البنود القانونية للمخالصة وبراءة الذمة القضائية التامة (وفقاً لقانون العمل المصري رقم 12 لسنة 2003):</strong>
                      <ol style={{ margin: "3px 0 0 0", paddingRight: "16px" }}>
                        <li style={{ marginBottom: "2.5px" }}>
                          <strong>إقرار استلام كامل الأجر والمستحقات:</strong> أقر أنا العامل المقر أدناه بكامل إرادتي وبصفتي موظفاً لدى شركة ايه ان اتش للتجارة والتوزيع، بأنني قد استلمت من إدارة الشركة وخزينة الفرع كامل صافي أجري ومستحقاتي المالية الموضحة أعلاه عن دورة شهر ({cycleMonthLabel}) نقداً وعداً دون أي نقص أو تأخير أو اقتطاع غير مشروع.
                        </li>
                        <li style={{ marginBottom: "2.5px" }}>
                          <strong>المخالصة المالية والتأمينية الشاملة والنهائية وبراءة الذمة:</strong> يُعد استلامي لصافي هذا الراتب وتوقيعي وبصمتي على هذا الإقرار بمثابة مخالصة مالية وتأمينية نهائية تامة وناجزة وبراءة ذمة مطلقة لشركة ايه ان اتش للتجارة والتوزيع (س.ت: 216727) وكافة فروعها وإداراتها ومسؤوليها، إبراءً شاملاً مسقطاً لكافة الحقوق والدعاوى والمطالبات العمالية والمدنية والمالية عن دورة هذا الشهر، بما يشمل الراتب الأساسي، بدلات الانتقال والسكن، البدلات الوظيفية، مكافآت وحوافز الإنتاج، وأجر ساعات العمل الإضافية.
                        </li>
                        <li style={{ marginBottom: "2.5px" }}>
                          <strong>الإقرار بصحة الاستقطاعات والجزاءات والتأمينات والسلف:</strong> أقر بموافقتي التامة والقطعية على صحة كافة الاستقطاعات المنفذة على راتبي لشهر الاستحقاق، سواء كانت جزاءات وتأخيرات إدارية، أو اشتراكات التأمينات الاجتماعية وفق القانون رقم 148 لسنة 2019، أو أقساط سداد سلف نقدية استقطعت وفقاً للتفويض الصادر مني وطبقاً للمادة (34) من قانون العمل، وليس لي الحق في الاعتراض عليها أو المطالبة باسترداد أي جزء منها.
                        </li>
                        <li>
                          <strong>الحجية القضائية والإلزام القانوني المطلق:</strong> تم تحرير وتوقيع هذا الإقرار والمخالصة بمحض إرادتي الحرة وبكامل الأهلية القانونية المعتبرة شرعاً وقانوناً، ودون أي ضغط أو إكراه أو تدليس، وتعد هذه الوثيقة بما تضمنته من توقيع وبصمة إبهامي حجة قانونية وقضائية قاطعة ونافذة في مواجهتي ومسؤوليتي المدنية والقضائية الكاملة أمام جميع مكاتب العمل، اللجان التوفيقية، المحاكم العمالية، وكافة جهات القضاء في جمهورية مصر العربية، ولا يجوز لي الطعن عليها أو الرجوع فيها بأي وجه من الوجوه، إعمالاً لأحكام المادتين (38) و(76) من قانون العمل المصري رقم 12 لسنة 2003.
                        </li>
                      </ol>
                    </div>
                  </div>

                  <div style={{ marginTop: "6px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: "8px", alignItems: "center", borderTop: "2px solid #0f172a", paddingTop: "5px", marginBottom: "3px" }}>
                      <div style={{ textAlign: "center", fontSize: "9px" }}>
                        <div style={{ fontWeight: "900", color: "#0f172a" }}>المُقر بما فيه (العامل المستلم):</div>
                        <div style={{ color: "#334155", margin: "1px 0", fontWeight: "bold" }}>{emp?.name || "-"}</div>
                        <div style={{ color: "#64748b", margin: "16px 0 0 0" }}>التوقيع: .................................</div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ fontSize: "8.5px", fontWeight: "900", color: "#0f172a", marginBottom: "1px" }}>
                          بصمة إبهام العامل (ختم إلزامي):
                        </div>
                        <div style={{
                          width: "100px",
                          height: "60px",
                          border: "2px solid #0f172a",
                          borderRadius: "6px",
                          background: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          fontSize: "8.5px",
                          color: "#94a3b8",
                          fontWeight: "bold",
                          boxShadow: "inset 0 0 4px rgba(0,0,0,0.05)"
                        }}>
                          [ بصمة الإبهام الأيمن ]
                        </div>
                      </div>

                      <div style={{ textAlign: "center", fontSize: "9px" }}>
                        <div style={{ fontWeight: "900", color: "#0f172a" }}>أمين الخزينة / مدير الفرع:</div>
                        <div style={{ color: "#334155", margin: "1px 0" }}>تم الصرف والتسليم بالخزينة</div>
                        <div style={{ color: "#64748b", margin: "16px 0 0 0" }}>التوقيع: .................................</div>
                      </div>

                      <div style={{ textAlign: "center", fontSize: "9px" }}>
                        <div style={{ fontWeight: "900", color: "#0f172a" }}>اعتماد الموارد البشرية وخاتم الشركة:</div>
                        <div style={{
                          margin: "2px auto 0 auto",
                          width: "115px",
                          height: "54px",
                          border: "1.5px solid #1e3a8a",
                          borderRadius: "6px",
                          padding: "2px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#f8fafc"
                        }}>
                          <div style={{ fontSize: "7.5px", fontWeight: "900", color: "#1e3a8a" }}>شركة ايه ان اتش للتجارة</div>
                          <div style={{ fontSize: "6.5px", color: "#475569" }}>س.ت: 216727 • ب.ض: 756-563-844</div>
                          <div style={{ fontSize: "7px", color: "#047857", fontWeight: "bold", marginTop: "1px" }}>[ مخالصة معتمدة ومسجلة ]</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #cbd5e1", paddingTop: "3px", fontSize: "8px", color: "#64748b" }}>
                      <div>وثيقة رسمية ومخالصة قضائية صادرة آلياً من نظام إدارة الموارد البشرية - شركة ايه ان اتش للتجارة (ANH) • صفحة 2 من 2 (المخالصة التامة)</div>
                      <div>المادتان 38 و 76 من قانون العمل المصري رقم 12 لسنة 2003 • إقرار استلام راتب ومخالصة نهائية وناجزة</div>
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
