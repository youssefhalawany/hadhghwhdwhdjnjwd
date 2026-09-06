"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, where, limit, deleteDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Plus, Check, X, ShieldAlert, DollarSign, Calendar, Save, Trash2, Printer, Search, FileText, Coins, TrendingUp, Users, CalendarCheck, Scale, Sparkles, Building2, AlertCircle, ArrowUpRight, CheckCircle2, ChevronRight, Banknote, ArrowDownLeft, ShieldCheck, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";

function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";
  
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
  
  const thousands = Math.floor(num / 1000);
  const remainder = num % 1000;
  
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
}

function numberToWordsEn(num: number): string {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function getBelow100(n: number): string {
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return tens[t] + (o > 0 ? " " + ones[o] : "");
  }

  function getBelow1000(n: number): string {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    if (h === 0) return getBelow100(rest);
    return ones[h] + " Hundred" + (rest > 0 ? " and " + getBelow100(rest) : "");
  }

  const thousands = Math.floor(num / 1000);
  const remainder = num % 1000;
  let result = "";
  if (thousands > 0) {
    result += getBelow1000(thousands) + " Thousand";
  }
  if (remainder > 0) {
    if (result !== "") result += " ";
    result += getBelow1000(remainder);
  }
  return result;
}

export const loanCategoryLabels: Record<string, { label: string; labelEn: string; icon: string; desc: string; descEn: string }> = {
  medical: { 
    label: "حالات طبية طارئة", 
    labelEn: "Medical Emergency", 
    icon: "🏥", 
    desc: "عمليات، أدوية، طوارئ صحية", 
    descEn: "Surgeries, medication & urgent healthcare" 
  },
  education: { 
    label: "مصاريف دراسية وجامعية", 
    labelEn: "Education & Tuition", 
    icon: "🎓", 
    desc: "أقساط مدارس، مستلزمات تعليمية", 
    descEn: "Tuition fees, books & supplies" 
  },
  marriage: { 
    label: "مناسبات زواج وعائلية", 
    labelEn: "Marriage & Family Events", 
    icon: "💍", 
    desc: "زواج، ارتباط، التزامات عائلية", 
    descEn: "Weddings, family milestones & commitments" 
  },
  seasons: { 
    label: "سلفة أعياد ومواسم", 
    labelEn: "Seasons & Holidays", 
    icon: "🌙", 
    desc: "عيد الفطر، الأضحى، رمضان، المدارس", 
    descEn: "Eid Al-Fitr, Adha, Ramadan, back to school" 
  },
  living: { 
    label: "التزامات معيشية وإيجار", 
    labelEn: "Living & Housing Costs", 
    icon: "🏠", 
    desc: "إيجار، فواتير، التزامات معيشية طارئة", 
    descEn: "Rent, bills & emergency living needs" 
  },
  other: { 
    label: "سلفة عامة أخرى", 
    labelEn: "General / Other Loan", 
    icon: "📋", 
    desc: "أسباب وظروف شخصية أخرى", 
    descEn: "Other personal circumstances" 
  },
};

export type AdjustmentRecord = {
  id?: string;
  employeeId: string;
  type: "deduction" | "loan";
  amount: number;
  reason: string;
  status: "pending" | "applied";
  createdAt: string | any;
  createdBy: string;
  daysWorkedAtRequest?: number;
  maxAllowedAmount?: number;
  payrollId?: string;
  category?: string;
  installmentCount?: number;
  monthlyInstallment?: number;
  loanDocId?: string;
  storeId?: string;
  remainingBalance?: number;
};

export default function AdminAdjustmentsPage() {
  const { language: lang } = useLanguage();
  const isAr = lang === "ar";

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [oldDeductions, setOldDeductions] = useState<AdjustmentRecord[]>([]);
  const [oldLoans, setOldLoans] = useState<AdjustmentRecord[]>([]);
  const [allSystemLoans, setAllSystemLoans] = useState<any[]>([]);
  const [historyAdjustments, setHistoryAdjustments] = useState<AdjustmentRecord[]>([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"deduction" | "loan" | "history">("loan");
  
  const [isAdding, setIsAdding] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [loanInstallmentMonths, setLoanInstallmentMonths] = useState<number>(1);
  const [loanCategory, setLoanCategory] = useState<string>("living");
  const [addForm, setAddForm] = useState<{ amount: number, reason: string, daysWorked: number }>({
    amount: 0,
    reason: "",
    daysWorked: 0
  });

  const { availableBranches, currentBranch } = useBranch();
  
  const [printLoan, setPrintLoan] = useState<any | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string>("");

  // Early Repayment & Safe Inflow State
  const [repayLoan, setRepayLoan] = useState<any | null>(null);
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [repayNote, setRepayNote] = useState<string>("");
  const [isRepaying, setIsRepaying] = useState<boolean>(false);
  const [repaymentReceipt, setRepaymentReceipt] = useState<any | null>(null);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintLoan(null);
      setQrCodeData("");
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserEmail(user.email || "");
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    
    // Fetch active employees
    const empQ = query(collection(db, "employees"), where("status", "==", "active"));
    const unsubEmp = onSnapshot(empQ, (snap) => {
      const emps: any[] = [];
      snap.forEach(d => emps.push({ id: d.id, ...d.data() }));
      setEmployees(emps);
    }, (err) => {
      console.error("employees snapshot error:", err);
    });

    // Fetch pending adjustments
    const adjQ = query(collection(db, "adjustments"), where("status", "==", "pending"));
    const unsubAdj = onSnapshot(adjQ, (snap) => {
      const adjs: any[] = [];
      snap.forEach(d => adjs.push({ id: d.id, ...d.data() }));
      setAdjustments(adjs);
    }, (err) => {
      console.error("adjustments snapshot error:", err);
    });

    // Fetch old deductions that are not yet applied
    const dQ = query(collection(db, "deductions"), where("applied", "==", false));
    const unsubOldD = onSnapshot(dQ, (snap) => {
      const arr: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        arr.push({
          id: d.id,
          employeeId: data.employeeId,
          type: "deduction",
          amount: Number(data.amount) || 0,
          reason: data.reason || "Old System Deduction",
          status: "pending",
          storeId: data.storeId || data.branchId,
          createdAt: data.date || data.createdAt || new Date().toISOString()
        } as AdjustmentRecord);
      });
      setOldDeductions(arr);
    }, (err) => {
      console.error("deductions snapshot error:", err);
    });

    // Fetch old loans for the current payroll month (approximate)
    const d = new Date();
    if (d.getDate() < 15) d.setMonth(d.getMonth() - 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lQ = query(collection(db, "loans"), where("date", ">=", monthStr));
    const unsubOldL = onSnapshot(lQ, (snap) => {
      const arr: any[] = [];
      snap.forEach(l => {
        const data = l.data();
        if (data.date && data.date.startsWith(monthStr)) {
          arr.push({
            id: l.id,
            employeeId: data.employeeId,
            type: "loan",
            amount: Number(data.approved || data.amount) || 0,
            reason: data.reason || "Old System Loan",
            status: "pending",
            storeId: data.storeId || data.branchId,
            createdAt: data.createdAt || data.date || new Date().toISOString()
          } as AdjustmentRecord);
        }
      });
      setOldLoans(arr);
    }, (err) => {
      console.error("loans snapshot error:", err);
    });

    // Fetch all system loans for company/branch telemetry and forecasting
    const sysLoansQ = query(collection(db, "loans"), limit(300));
    const unsubSysLoans = onSnapshot(sysLoansQ, (snap) => {
      const arr: any[] = [];
      snap.forEach(l => {
        arr.push({ id: l.id, ...l.data() });
      });
      setAllSystemLoans(arr);
    }, (err) => {
      console.error("sys loans snapshot error:", err);
    });

    return () => {
      unsubEmp();
      unsubAdj();
      unsubOldD();
      unsubOldL();
      unsubSysLoans();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === "history" && historyAdjustments.length === 0 && !isFetchingHistory) {
      setIsFetchingHistory(true);
      const fetchHistory = async () => {
        try {
          const q = query(collection(db, "adjustments"), where("status", "==", "applied"), limit(100));
          const snap = await getDocs(q);
          const arr = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as AdjustmentRecord));
          
          const dQ = query(collection(db, "deductions"), where("applied", "==", true), limit(100));
          const dSnap = await getDocs(dQ);
          dSnap.forEach((d: any) => {
            const data = d.data();
            arr.push({
              id: d.id,
              employeeId: data.employeeId,
              type: "deduction",
              amount: Number(data.amount) || 0,
              reason: data.reason || "Old System Deduction",
              status: "applied",
              storeId: data.storeId || data.branchId,
              createdAt: data.date || data.createdAt || new Date().toISOString()
            } as AdjustmentRecord);
          });

          arr.sort((a: any, b: any) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime());
          setHistoryAdjustments(arr);
        } catch (e) {
          console.error("Failed to fetch history", e);
        } finally {
          setIsFetchingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [activeTab, historyAdjustments.length, isFetchingHistory]);

  // Branch helper: match record storeId or associated employee storeId/branchId
  const isBranchMatch = useCallback((itemStoreOrBranchId?: string, emp?: any, targetBranch?: string): boolean => {
    const branchToMatch = (targetBranch || currentBranch || "").toLowerCase();
    if (!branchToMatch || branchToMatch === "all") return true;

    const rawItemStore = (itemStoreOrBranchId || "").toLowerCase();
    const empStore = (emp?.storeId || "").toLowerCase();
    const empBranch = (emp?.branchId || "").toLowerCase();

    const isOlaMatch = (val: string) => 
      val.includes("ola") || val.includes("koronfol") || val === "store_2" || val === "2";
    const isAlameinMatch = (val: string) => 
      val.includes("alamein") || val.includes("elalamein") || val === "store_1" || val === "1";

    if (branchToMatch.includes("ola") || branchToMatch.includes("koronfol") || branchToMatch === "store_2" || branchToMatch === "2") {
      return isOlaMatch(rawItemStore) || isOlaMatch(empStore) || isOlaMatch(empBranch);
    }

    if (branchToMatch.includes("alamein") || branchToMatch.includes("elalamein") || branchToMatch === "store_1" || branchToMatch === "1") {
      return isAlameinMatch(rawItemStore) || isAlameinMatch(empStore) || isAlameinMatch(empBranch);
    }

    return rawItemStore === branchToMatch || empStore === branchToMatch || empBranch === branchToMatch;
  }, [currentBranch]);

  // Branch-filtered active employees (used for staff ratio and dropdown)
  const branchEmployees = useMemo(() => {
    return employees.filter(emp => isBranchMatch(emp.storeId || emp.branchId, emp));
  }, [employees, isBranchMatch]);

  // Branch-filtered loans from Firestore 'loans' collection
  const branchSystemLoans = useMemo(() => {
    return allSystemLoans.filter(loan => {
      const emp = employees.find(e => e.id === loan.employeeId);
      return isBranchMatch(loan.storeId || loan.branchId, emp);
    });
  }, [allSystemLoans, employees, isBranchMatch]);

  // Transform active un-settled branch loans into adjustments if not already present
  const activeSystemLoansAsAdjustments = useMemo(() => {
    return branchSystemLoans
      .filter(loan => {
        const isSettled = loan.settled === true || loan.status === "settled" || loan.status === "cancelled" || loan.status === "rejected";
        const approvedAmt = Number(loan.approved || loan.amount || 0);
        const settledAmt = Number(loan.settledAmount || 0);
        const remaining = Number(loan.remainingBalance !== undefined ? loan.remainingBalance : Math.max(0, approvedAmt - settledAmt));
        if (isSettled || remaining <= 0) return false;

        const existsInAdj = adjustments.some(a => a.id === loan.id || (a as any).loanDocId === loan.id);
        return !existsInAdj;
      })
      .map(loan => {
        const approvedAmt = Number(loan.approved || loan.amount || 0);
        const settledAmt = Number(loan.settledAmount || 0);
        const remaining = Number(loan.remainingBalance !== undefined ? loan.remainingBalance : Math.max(0, approvedAmt - settledAmt));

        let dateStr = new Date().toISOString();
        if (loan.createdAt) {
          if (typeof loan.createdAt.toDate === "function") dateStr = loan.createdAt.toDate().toISOString();
          else if (loan.createdAt.seconds) dateStr = new Date(loan.createdAt.seconds * 1000).toISOString();
          else dateStr = String(loan.createdAt);
        } else if (loan.date) {
          dateStr = loan.date;
        }

        return {
          id: loan.id,
          employeeId: loan.employeeId,
          type: "loan",
          amount: remaining > 0 ? remaining : approvedAmt,
          reason: loan.reason || loan.categoryLabel || (isAr ? "سلفة نقدية معتمدة" : "Approved Cash Loan"),
          status: "pending",
          createdAt: dateStr,
          createdBy: loan.createdBy || "System",
          loanDocId: loan.id,
          storeId: loan.storeId,
          monthlyInstallment: loan.monthlyInstallment,
          installmentCount: loan.installmentCount,
          remainingBalance: remaining
        } as AdjustmentRecord;
      });
  }, [branchSystemLoans, adjustments, isAr]);

  // Combined & branch-filtered adjustments
  const allAdjustments = useMemo(() => {
    const combined = [...adjustments, ...oldDeductions, ...oldLoans, ...activeSystemLoansAsAdjustments];
    return combined
      .filter(item => {
        const emp = employees.find(e => e.id === item.employeeId);
        return isBranchMatch((item as any).storeId, emp);
      })
      .sort((a: any, b: any) => {
        return new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime();
      });
  }, [adjustments, oldDeductions, oldLoans, activeSystemLoansAsAdjustments, employees, isBranchMatch]);

  // Branch-filtered history adjustments
  const filteredHistoryAdjustments = useMemo(() => {
    return historyAdjustments
      .filter(item => {
        const emp = employees.find(e => e.id === item.employeeId);
        return isBranchMatch((item as any).storeId, emp);
      })
      .sort((a: any, b: any) => {
        return new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime();
      });
  }, [historyAdjustments, employees, isBranchMatch]);

  const selectedEmp = employees.find(e => e.id === selectedEmpId);
  const dailyRate = selectedEmp ? ((Number(selectedEmp.baseSalary) || Number(selectedEmp.salary) || 3000) / 30) : 0;
  const maxAllowedLoan = activeTab === "loan" ? (dailyRate * addForm.daysWorked * 0.5) : 0;
  const finalApprovedLoan = activeTab === "loan" ? Math.min(addForm.amount, maxAllowedLoan) : 0;

  // -- BRANCH LOAN RECOVERY FORECAST TELEMETRY --
  const loanTelemetry = useMemo(() => {
    let totalOutstanding = 0;
    let totalOriginated = 0;
    let totalSettled = 0;
    let nextMonthForecast = 0;
    let activeLoansCount = 0;
    const indebtedEmpIds = new Set<string>();

    const today = new Date();
    const nextMonthD = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthStr = `${nextMonthD.getFullYear()}-${String(nextMonthD.getMonth() + 1).padStart(2, "0")}`;

    branchSystemLoans.forEach(loan => {
      const isSettled = loan.settled === true || loan.status === "settled" || loan.status === "cancelled" || loan.status === "rejected";
      const approvedAmt = Number(loan.approved || loan.amount || 0);
      const settledAmt = Number(loan.settledAmount || 0);
      const remaining = Number(loan.remainingBalance !== undefined ? loan.remainingBalance : Math.max(0, approvedAmt - settledAmt));

      totalOriginated += approvedAmt;
      totalSettled += settledAmt;

      if (!isSettled && remaining > 0) {
        totalOutstanding += remaining;
        activeLoansCount++;
        indebtedEmpIds.add(loan.employeeId);

        // Forecast next month deduction
        if (Array.isArray(loan.installments) && loan.installments.length > 0) {
          const target = loan.installments.find((inst: any) => inst.month === nextMonthStr && inst.status === "pending");
          if (target) {
            nextMonthForecast += Math.min(Number(target.amount) || 0, remaining);
          } else {
            const mInst = Number(loan.monthlyInstallment) || (loan.installments[0]?.amount) || 0;
            if (mInst > 0) {
              nextMonthForecast += Math.min(mInst, remaining);
            }
          }
        } else if (loan.monthlyInstallment && Number(loan.monthlyInstallment) > 0) {
          nextMonthForecast += Math.min(Number(loan.monthlyInstallment), remaining);
        } else {
          nextMonthForecast += remaining;
        }
      }
    });

    const recoveryRate = totalOriginated > 0 ? Math.round((totalSettled / totalOriginated) * 100) : 0;

    return {
      totalOutstanding,
      totalOriginated,
      totalSettled,
      nextMonthForecast,
      activeLoansCount,
      activeIndebtedStaffCount: indebtedEmpIds.size,
      recoveryRate,
      nextMonthStr
    };
  }, [branchSystemLoans]);

  const handleSave = async () => {
    if (!selectedEmpId) return toast.error(isAr ? "اختر الموظف أولاً" : "Please select an employee first");
    if (activeTab === "deduction" && addForm.amount <= 0) return toast.error(isAr ? "أدخل مبلغ الخصم" : "Please enter deduction amount");
    if (activeTab === "loan" && addForm.daysWorked <= 0) return toast.error(isAr ? "أدخل عدد أيام العمل المحتسبة" : "Please enter accrued days worked");
    if (activeTab === "loan" && addForm.amount <= 0) return toast.error(isAr ? "أدخل مبلغ السلفة المطلوب" : "Please enter requested loan amount");
    if (!addForm.reason) return toast.error(isAr ? "أدخل سبب الطلب / التفاصيل" : "Please enter request reason / details");

    try {
      if (activeTab === "loan") {
        const months = Number(loanInstallmentMonths) || 1;
        const monthlyInst = Math.round(finalApprovedLoan / months);
        const startD = new Date();
        const firstMonthOffset = startD.getDate() > 20 ? 1 : 0;
        const schedule: any[] = [];
        for (let i = 0; i < months; i++) {
          const mDate = new Date(startD.getFullYear(), startD.getMonth() + firstMonthOffset + i, 1);
          const mStr = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, "0")}`;
          const isLast = i === months - 1;
          const instAmt = isLast ? (finalApprovedLoan - (monthlyInst * (months - 1))) : monthlyInst;
          schedule.push({
            month: mStr,
            installmentNumber: i + 1,
            amount: instAmt,
            status: "pending"
          });
        }

        const targetBranchId = selectedEmp?.storeId || selectedEmp?.branchId || (currentBranch !== "all" ? currentBranch : "alamein4");
        const catLabel = loanCategoryLabels[loanCategory]?.label || "سلفة نقدية";
        const catLabelEn = loanCategoryLabels[loanCategory]?.labelEn || "Cash Loan";
        const finalReason = `${isAr ? catLabel : catLabelEn}${addForm.reason ? ` - ${addForm.reason}` : ""}`;

        // 1. Direct Safe Outflow & Multi-Month Master Loan in 'loans' collection
        const loanDocPayload = {
          employeeId: selectedEmp!.id,
          employeeName: selectedEmp!.name,
          employeeNationalId: selectedEmp!.nationalId || "",
          employeePosition: selectedEmp!.position || "",
          amount: finalApprovedLoan,
          requested: addForm.amount,
          approved: finalApprovedLoan,
          installmentCount: months,
          monthlyInstallment: monthlyInst,
          remainingBalance: finalApprovedLoan,
          settledAmount: 0,
          settled: false,
          status: "approved",
          category: loanCategory,
          categoryLabel: catLabel,
          reason: finalReason,
          notes: addForm.reason || (isAr ? "سلفة راتب نقدية معتمدة عبر لوحة التعديلات" : "Cash loan approved via adjustments portal"),
          date: new Date().toISOString().split("T")[0],
          month: new Date().toISOString().slice(0, 7),
          firstInstallmentMonth: schedule[0]?.month || new Date().toISOString().slice(0, 7),
          storeId: targetBranchId,
          disbursedFrom: isAr ? "خزينة الفرع (Safe)" : "Branch Safe Cash",
          installments: schedule,
          repayments: [],
          type: "loan",
          daysWorkedAtRequest: addForm.daysWorked,
          maxAllowedAmount: maxAllowedLoan,
          createdAt: serverTimestamp(),
          createdBy: currentUserEmail
        };

        await addDoc(collection(db, "loans"), loanDocPayload);

        toast.success(isAr ? "تم اعتماد وصرف السلفة وتخصيص الأقساط الشهرية بنجاح!" : "Loan approved, disbursed from safe, and installment schedule created!");
      } else {
        const targetBranchId = selectedEmp?.storeId || selectedEmp?.branchId || (currentBranch !== "all" ? currentBranch : "alamein4");
        const newAdj: AdjustmentRecord = {
          employeeId: selectedEmpId,
          type: "deduction",
          amount: addForm.amount,
          reason: addForm.reason,
          status: "pending",
          storeId: targetBranchId,
          createdAt: new Date().toISOString(),
          createdBy: currentUserEmail
        };
        await addDoc(collection(db, "adjustments"), newAdj);
        toast.success(isAr ? "تم تسجيل الخصم بنجاح" : "Deduction recorded successfully");
      }

      setIsAdding(false);
      setAddForm({ amount: 0, reason: "", daysWorked: 0 });
      setSelectedEmpId("");
      setLoanInstallmentMonths(1);
    } catch (e: any) {
      toast.error(e.message || (isAr ? "فشل الحفظ" : "Save failed"));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(isAr ? "هل أنت متأكد من حذف هذا السجل المعلق؟" : "Are you sure you want to delete this pending record?")) {
      try {
        const adj = allAdjustments.find(a => a.id === id);
        const loanId = (adj as any)?.loanDocId || (adj?.type === "loan" ? adj.id : null);
        if (loanId) {
          try {
            await deleteDoc(doc(db, "loans", loanId));
          } catch (err) {
            console.warn("Could not delete from loans collection:", err);
          }
        }
        try {
          await deleteDoc(doc(db, "adjustments", id));
        } catch (err) {
          console.warn("Could not delete from adjustments collection:", err);
        }
        toast.success(isAr ? "تم الحذف بنجاح" : "Successfully deleted");
      } catch (e: any) {
        toast.error(e.message || (isAr ? "فشل الحذف" : "Failed to delete"));
      }
    }
  };

  const handleExecuteRepayment = async () => {
    if (!repayLoan) return;
    if (repayAmount <= 0) {
      toast.error(isAr ? "يرجى إدخال مبلغ سداد صحيح أكبر من الصفر" : "Please enter a valid repayment amount greater than 0");
      return;
    }

    const currentBal = Number(repayLoan.remainingBalance !== undefined ? repayLoan.remainingBalance : (repayLoan.approved || repayLoan.amount || 0));
    if (repayAmount > currentBal) {
      toast.error(isAr ? `مبلغ السداد (${repayAmount.toLocaleString()} ج.م) أكبر من الرصيد المتبقي (${currentBal.toLocaleString()} ج.م)` : `Repayment amount (${repayAmount} EGP) exceeds remaining balance (${currentBal} EGP)`);
      return;
    }

    setIsRepaying(true);
    try {
      const targetBranchId = repayLoan.storeId || repayLoan.branchId || (currentBranch !== "all" ? currentBranch : "ola");
      const emp = employees.find(e => e.id === repayLoan.employeeId) || {};
      const empName = emp.name || repayLoan.employeeName || (isAr ? "موظف" : "Employee");
      const receiptNo = `RCP-SAFE-${Date.now().toString().slice(-6)}`;
      const todayStr = new Date().toISOString().split("T")[0];

      // 1. Log direct cash inflow deposit into the branch safe
      await addDoc(collection(db, "deposits"), {
        amount: repayAmount,
        category: "loan_repayment",
        date: todayStr,
        from: "employee",
        to: "safe",
        employeeId: repayLoan.employeeId,
        employeeName: empName,
        loanDocId: repayLoan.id,
        note: repayNote || (isAr ? `سداد نقدي لسلفة الموظف ${empName} - توريد بالخزينة` : `Early cash loan repayment by ${empName} - Vault deposit`),
        storeId: targetBranchId,
        createdBy: currentUserEmail,
        receiptNumber: receiptNo,
        createdAt: serverTimestamp()
      });

      // 2. Update the master loan document
      const newRemaining = Math.max(0, currentBal - repayAmount);
      const prevSettled = Number(repayLoan.settledAmount || 0);
      const newSettledAmt = prevSettled + repayAmount;
      const isFullySettled = newRemaining === 0;

      const repaymentEntry = {
        amount: repayAmount,
        date: todayStr,
        receiptNumber: receiptNo,
        method: "cash_safe",
        receivedBy: currentUserEmail,
        note: repayNote || (isAr ? "سداد نقدي وتوريد بخزينة الفرع" : "Cash settlement to branch safe")
      };

      const existingRepayments = Array.isArray(repayLoan.repayments) ? repayLoan.repayments : [];

      await updateDoc(doc(db, "loans", repayLoan.id), {
        remainingBalance: newRemaining,
        settledAmount: newSettledAmt,
        settled: isFullySettled,
        status: isFullySettled ? "settled" : "active",
        repayments: [...existingRepayments, repaymentEntry],
        lastRepaymentDate: todayStr,
        updatedAt: serverTimestamp()
      });

      // Update cached safe balance immediately in localStorage so changes reflect instantly
      try {
        const cachedSafe = localStorage.getItem(`cached_safe_balance_${targetBranchId}`);
        if (cachedSafe !== null) {
          const updatedSafe = (parseFloat(cachedSafe) || 0) + repayAmount;
          localStorage.setItem(`cached_safe_balance_${targetBranchId}`, updatedSafe.toString());
        }
      } catch (_) {}

      toast.success(isAr 
        ? `تم توريد مبلغ ${repayAmount.toLocaleString()} ج.م إلى الخزينة بنجاح وتسوية السلفة!` 
        : `Successfully deposited ${repayAmount.toLocaleString()} EGP into the safe and updated loan!`);

      // Set digital receipt for presentation / printing
      setRepaymentReceipt({
        receiptNumber: receiptNo,
        date: todayStr,
        employeeName: empName,
        employeeId: repayLoan.employeeId,
        nationalId: emp.nationalId || repayLoan.employeeNationalId || "",
        branchId: targetBranchId,
        repaidAmount: repayAmount,
        previousBalance: currentBal,
        newRemainingBalance: newRemaining,
        isFullySettled,
        receivedBy: currentUserEmail,
        notes: repayNote
      });

      setRepayLoan(null);
      setRepayAmount(0);
      setRepayNote("");
    } catch (err: any) {
      console.error("Repayment error:", err);
      toast.error(err.message || (isAr ? "فشل تنفيذ السداد" : "Failed to process repayment"));
    } finally {
      setIsRepaying(false);
    }
  };

  if (isAdmin === null) return <div className="p-10"><Skeleton className="h-64 w-full" /></div>;
  if (isAdmin === false) return <div className="p-10 text-red-500">{isAr ? "تم رفض الوصول. لوحة المسؤولين فقط." : "Access Denied. Admin only."}</div>;

  // -- PRINT HELPERS --
  const printEmp = printLoan ? employees.find(e => e.id === printLoan.employeeId) || {} : {};
  const printBranch = availableBranches.find(b => b.id === (printEmp.storeId || printLoan?.storeId || (currentBranch !== "all" ? currentBranch : undefined)));
  const companyName = printBranch ? printBranch.name : (isAr ? "شركة ايه ان اتش للتجارة (ANH)" : "ANH Trading & Distribution");
  const dateString = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      {/* UI WRAPPER */}
      <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen pb-32 print:hidden space-y-8" dir={isAr ? "rtl" : "ltr"}>
      
        {/* HEADER */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl border border-slate-800">
          {/* Subtle decorative glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-2xl shadow-lg shadow-rose-500/30">
                  <Scale className="w-7 h-7" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {isAr ? "إدارة الموارد البشرية والمالية" : "HR & Payroll Governance"}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider bg-slate-800/90 text-slate-200 border border-slate-700 flex items-center gap-1.5 shadow-sm">
                      <Building2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>
                        {currentBranch === "all" 
                          ? (isAr ? "جميع الفروع" : "All Branches") 
                          : (availableBranches.find(b => b.id === currentBranch)?.name || (currentBranch === "ola" ? "Ola El Koronfol" : "El Alamein 4"))}
                      </span>
                    </span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-1">
                    {isAr ? "إدارة السلف والتسويات والاستقطاعات" : "Loans, Adjustments & Deductions"}
                  </h1>
                </div>
              </div>
              <p className="text-slate-400 text-xs md:text-sm font-medium max-w-2xl">
                {isAr 
                  ? "نظام السلف المؤسسي المتوافق مع قانون العمل المصري (مادة 34) • تقسيط السلف • صرف مباشر من الخزينة • استقطاع آلي"
                  : "Enterprise loan management compliant with Egyptian Labor Law (Art. 34) • Multi-month installments • Direct safe outflow • Automated payroll deductions"}
              </p>
            </div>

            {!isAdding && (
              <button 
                onClick={() => setIsAdding(true)}
                className="group relative inline-flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-rose-600/30 hover:shadow-rose-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 self-start md:self-auto"
              >
                <Plus className="w-5 h-5 transition-transform group-hover:rotate-90 duration-300" />
                <span>{isAr ? "تسجيل سلفة / خصم جديد" : "New Loan / Deduction"}</span>
              </button>
            )}
          </div>
        </div>

        {/* 🏢 BRANCH & COMPANY-WIDE LOAN RECOVERY FORECAST TELEMETRY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {/* Card 1: Total Outstanding Loan Capital */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "إجمالي السلف القائمة" : "Total Outstanding Loans"}
              </span>
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/40">
                <Coins className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              <span className="text-sm font-bold text-rose-600 dark:text-rose-400 mr-1.5 font-sans">EGP</span>
              {loanTelemetry.totalOutstanding.toLocaleString()}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>{isAr ? "رأس مال السلف المتداول" : "Active Capital"}</span>
              <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded-full font-bold text-[11px]">
                {isAr ? `${loanTelemetry.activeLoansCount} سلفة سارية` : `${loanTelemetry.activeLoansCount} active loans`}
              </span>
            </div>
          </div>

          {/* Card 2: Next Month Recovery Forecast */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "تحصيلات الشهر القادم" : "Next Month Recovery"}
              </span>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mr-1.5 font-sans">EGP</span>
              {loanTelemetry.nextMonthForecast.toLocaleString()}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>{isAr ? "توقع الاستقطاع من الرواتب" : "Forecasted Deduction"}</span>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full font-bold text-[11px]">
                {isAr ? `دورة ${loanTelemetry.nextMonthStr}` : `Cycle ${loanTelemetry.nextMonthStr}`}
              </span>
            </div>
          </div>

          {/* Card 3: Active Indebted Staff Count */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "الموظفون المدينون بالسلف" : "Indebted Staff Count"}
              </span>
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-900/40">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {loanTelemetry.activeIndebtedStaffCount} <span className="text-sm font-normal text-slate-500">{isAr ? "موظفاً" : "employees"}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>{isAr ? "نسبة المدينين بالقوى العاملة" : "Staff Ratio"}</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {branchEmployees.length > 0 ? Math.round((loanTelemetry.activeIndebtedStaffCount / branchEmployees.length) * 100) : 0}% {isAr ? "من الطاقم" : "of team"}
              </span>
            </div>
          </div>

          {/* Card 4: Cumulative Recovery Journey */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "نسبة الاسترداد التراكمية" : "Cumulative Recovery Rate"}
              </span>
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-100 dark:border-purple-900/40">
                <CalendarCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-purple-600 dark:text-purple-400 font-mono tracking-tight">
              {loanTelemetry.recoveryRate}%
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-700" 
                style={{ width: `${Math.min(100, Math.max(0, loanTelemetry.recoveryRate))}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>{isAr ? `تم تحصيل: EGP ${loanTelemetry.totalSettled.toLocaleString()}` : `Recovered: EGP ${loanTelemetry.totalSettled.toLocaleString()}`}</span>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("loan")}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 ${
              activeTab === "loan" 
                ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm border border-slate-200/60 dark:border-slate-700" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>{isAr ? "السلف النقدية والأقساط" : "Cash Loans & Installments"}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeTab === "loan" ? "bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-black" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
              {allAdjustments.filter(a => a.type === "loan").length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("deduction")}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 ${
              activeTab === "deduction" 
                ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm border border-slate-200/60 dark:border-slate-700" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{isAr ? "الاستقطاعات والجزاءات" : "Deductions & Penalties"}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeTab === "deduction" ? "bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-black" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
              {allAdjustments.filter(a => a.type === "deduction").length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 ${
              activeTab === "history" 
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-slate-700" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{isAr ? "سجل التسويات المنتهية" : "Settled History"}</span>
          </button>
        </div>

        {/* ADD FORM */}
        {isAdding && activeTab !== "history" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl animate-in slide-in-from-top-4 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                    {activeTab === "deduction" 
                      ? (isAr ? "تسجيل استقطاع جديد" : "Record New Deduction")
                      : (isAr ? "طلب واعتماد سلفة نقدية وتقسيط" : "Request & Approve Cash Loan Installment")}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isAr 
                      ? "قم بتحديد الموظف والشروط والبيانات للاعتماد الفوري" 
                      : "Specify employee, terms, and reasons for instant authorization"}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsAdding(false)} 
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* RETAIL LOAN CATEGORIZATION */}
            {activeTab === "loan" && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {isAr ? "🏥 تصنيف سبب السلفة:" : "🏥 Loan Purpose / Category:"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {Object.entries(loanCategoryLabels).map(([key, item]) => {
                    const isSelected = loanCategory === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLoanCategory(key)}
                        className={`p-3.5 rounded-2xl border text-start transition-all flex flex-col justify-between relative group ${
                          isSelected
                            ? "bg-rose-50/80 dark:bg-rose-950/40 border-rose-500 text-rose-950 dark:text-rose-200 shadow-sm ring-2 ring-rose-500/20"
                            : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300"
                        }`}
                      >
                        {isSelected && (
                          <div className={`absolute top-2 ${isAr ? "left-2" : "right-2"}`}>
                            <CheckCircle2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          </div>
                        )}
                        <div className="text-2xl mb-1.5">{item.icon}</div>
                        <div className="font-bold text-xs leading-tight mb-1">{isAr ? item.label : item.labelEn}</div>
                        <div className="text-[10px] text-slate-400 leading-normal line-clamp-2">{isAr ? item.desc : item.descEn}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {isAr ? "الموظف المستفيد" : "Beneficiary Employee"}
                </label>
                <select 
                  value={selectedEmpId}
                  onChange={e => setSelectedEmpId(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-bold"
                >
                  <option value="">{isAr ? "اختر الموظف..." : "Select employee..."}</option>
                  {branchEmployees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.position})</option>
                  ))}
                </select>
              </div>

              {selectedEmp && activeTab === "loan" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {isAr ? "الراتب الأساسي الشهري" : "Monthly Base Salary"}
                    </label>
                    <div className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-700 dark:text-slate-300 font-bold flex items-center justify-between">
                      <span>EGP {(Number(selectedEmp.baseSalary) || Number(selectedEmp.salary) || 3000).toLocaleString()}</span>
                      <span className="text-xs font-sans text-slate-400 font-normal">{isAr ? "مسجل بالنظام" : "On File"}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {isAr ? "أيام العمل المحتسبة حتى الآن" : "Days Worked Accrued to Date"}
                    </label>
                    <input 
                      type="number" 
                      value={addForm.daysWorked || ""}
                      onChange={e => setAddForm({...addForm, daysWorked: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                      placeholder={isAr ? "مثال: 15" : "e.g. 15"}
                    />
                  </div>

                  {addForm.daysWorked > 0 && (
                    <div className="col-span-full bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 flex gap-4 items-center">
                      <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-xl flex-shrink-0">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div className="text-sm">
                        <h4 className="text-emerald-900 dark:text-emerald-300 font-bold">
                          {isAr ? "قاعدة سقف السلفة (المادة 34 من قانون العمل رقم 12 لسنة 2003)" : "Loan Ceiling Rule (Article 34 of Egyptian Labor Law 12/2003)"}
                        </h4>
                        <p className="text-emerald-700 dark:text-emerald-400 text-xs mt-0.5 leading-relaxed">
                          {isAr ? (
                            <>
                              معدل الأجر اليومي: <strong>EGP {dailyRate.toFixed(2)}</strong> &times; {addForm.daysWorked} يوماً = مستحق مكتسب قدره <strong>EGP {(dailyRate * addForm.daysWorked).toFixed(2)}</strong>.<br/>
                              الحد الأقصى المسموح لصرفه فورياً (50%): <strong className="underline font-black text-sm">EGP {maxAllowedLoan.toFixed(2)}</strong>
                            </>
                          ) : (
                            <>
                              Daily wage rate: <strong>EGP {dailyRate.toFixed(2)}</strong> &times; {addForm.daysWorked} days = accrued earned wage of <strong>EGP {(dailyRate * addForm.daysWorked).toFixed(2)}</strong>.<br/>
                              Statutory maximum immediate disbursement (50% cap): <strong className="underline font-black text-sm">EGP {maxAllowedLoan.toFixed(2)}</strong>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedEmp && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {activeTab === "loan" ? (isAr ? "المبلغ المطلوب" : "Requested Loan Amount") : (isAr ? "مبلغ الاستقطاع" : "Deduction Amount")}
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={addForm.amount || ""}
                        onChange={e => setAddForm({...addForm, amount: Number(e.target.value)})}
                        className={`w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500 outline-none ${isAr ? "pl-14" : "pr-14"}`}
                        placeholder="0.00"
                      />
                      <span className={`absolute ${isAr ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold`}>EGP</span>
                    </div>
                  </div>

                  {/* INSTALLMENT DURATION SELECTOR */}
                  {activeTab === "loan" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {isAr ? "خطة التقسيط (أشهر السداد)" : "Installment Plan (Repayment Months)"}
                      </label>
                      <select
                        value={loanInstallmentMonths}
                        onChange={e => setLoanInstallmentMonths(Number(e.target.value))}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                      >
                        <option value={1}>{isAr ? "شهر واحد (استقطاع كامل بالراتب القادم)" : "1 Month (Full deduction on next payroll)"}</option>
                        <option value={2}>{isAr ? "شهرين (قسطين متساويين)" : "2 Months (2 equal installments)"}</option>
                        <option value={3}>{isAr ? "3 أشهر (3 أقساط شهرية)" : "3 Months (3 monthly installments)"}</option>
                        <option value={4}>{isAr ? "4 أشهر (4 أقساط شهرية)" : "4 Months (4 monthly installments)"}</option>
                        <option value={6}>{isAr ? "6 أشهر (نصف سنة)" : "6 Months (Half-year plan)"}</option>
                        <option value={10}>{isAr ? "10 أشهر (خطة مدرسية/موسمية)" : "10 Months (Academic/Seasonal plan)"}</option>
                        <option value={12}>{isAr ? "12 شهراً (سنة كاملة)" : "12 Months (Full year plan)"}</option>
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {isAr ? "السبب / البيان التفصيلي" : "Reason / Detailed Description"}
                    </label>
                    <input 
                      type="text" 
                      value={addForm.reason}
                      onChange={e => setAddForm({...addForm, reason: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                      placeholder={activeTab === "loan" ? (isAr ? "مثال: ظرف عائلي طارئ / عملية جراحية" : "e.g. Urgent medical expense / family emergency") : (isAr ? "مثال: إتلاف عهدة / غياب بدون إذن" : "e.g. Broken merchandise / unexcused absence")}
                    />
                  </div>
                </>
              )}
            </div>
            
            {/* TAFQEET & INSTALLMENT PREVIEW */}
            {selectedEmp && activeTab === "loan" && addForm.amount > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-medium text-slate-500">{isAr ? "المبلغ المعتمد بالحروف: " : "Approved in Words: "}</span>
                    <strong className="text-rose-600 dark:text-rose-400">
                      {isAr 
                        ? `فقط وقدره ${numberToArabicWords(finalApprovedLoan)} جنيهاً مصرياً لا غير`
                        : `Only ${numberToWordsEn(finalApprovedLoan)} Egyptian Pounds`}
                    </strong>
                  </div>
                  <div className="font-bold text-slate-800 dark:text-slate-100 font-mono bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 font-sans text-xs mr-1">{isAr ? "القسط الشهري:" : "Monthly Installment:"}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">EGP {Math.round(finalApprovedLoan / (loanInstallmentMonths || 1)).toLocaleString()}</span>
                    <span className="text-slate-400 font-sans text-xs ml-1 font-normal">({loanInstallmentMonths} {isAr ? "أشهر" : "months"})</span>
                  </div>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>
                    {isAr 
                      ? "يتم قيد السلفة مباشرة كحركة خروج نقدية من خزينة الفرع (Safe) وتخصم الأقساط آلياً عبر مسيرات الرواتب."
                      : "The loan is recorded immediately as a cash disbursement from the Branch Safe and deducted automatically across monthly payroll runs."}
                  </span>
                </div>
              </div>
            )}

            {selectedEmp && activeTab === "loan" && addForm.amount > maxAllowedLoan && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 rounded-2xl text-xs md:text-sm border border-amber-200 dark:border-amber-800/50 font-medium flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-600" />
                <span>
                  {isAr 
                    ? `تنبيه: المبلغ المطلوب (EGP ${addForm.amount}) يتجاوز سقف العمل المكتسب (EGP ${maxAllowedLoan.toFixed(2)}). سيتم اعتماد الحد الأقصى المسموح تلقائياً حفاظاً على السلامة القانونية.`
                    : `Notice: The requested amount (EGP ${addForm.amount}) exceeds accrued earned wage cap (EGP ${maxAllowedLoan.toFixed(2)}). Statutory ceiling will be enforced automatically.`}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm transition-colors"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button 
                onClick={handleSave}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-md active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isAr 
                    ? `حفظ واعتماد ${activeTab === "deduction" ? "الاستقطاع" : "السلفة وصرفها"}`
                    : `Save & Approve ${activeTab === "deduction" ? "Deduction" : "Loan Disbursement"}`}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* LIST / TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-base">
                {activeTab === "history" ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                )}
                {activeTab === "history" 
                  ? (isAr ? "سجل التسويات المعتمدة والمنتهية" : "Settled Adjustments & Deductions") 
                  : (activeTab === "deduction" 
                      ? (isAr ? "الاستقطاعات والجزاءات المعلقة" : "Pending Deductions & Penalties") 
                      : (isAr ? "السلف النقدية المعلقة والمجدولة" : "Pending & Active Cash Loans"))}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {activeTab === "history" 
                  ? (isAr ? "تم تطبيق هذه التسويات بنجاح على مسيرات الرواتب السابقة." : "These adjustments have been successfully applied to past payroll runs.") 
                  : (isAr ? "سيتم تطبيق هذه البنود آلياً على مسير الرواتب القادم للموظف." : "These records will automatically apply to the employee's next payroll run.")}
              </p>
            </div>
            
            <div className="text-xs text-slate-400 font-mono">
              {activeTab === "history" ? `${filteredHistoryAdjustments.length} ${isAr ? "سجل" : "records"}` : `${allAdjustments.filter(a => a.type === activeTab).length} ${isAr ? "معلق" : "pending"}`}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className={`w-full ${isAr ? "text-right" : "text-left"} border-collapse`}>
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-3.5 font-bold">{isAr ? "التاريخ" : "Date"}</th>
                  <th className="px-5 py-3.5 font-bold">{isAr ? "الموظف" : "Employee"}</th>
                  <th className="px-5 py-3.5 font-bold">{isAr ? "النوع / البيان" : "Type / Reason"}</th>
                  <th className="px-5 py-3.5 font-bold">{isAr ? "المبلغ" : "Amount"}</th>
                  <th className={`px-5 py-3.5 font-bold ${isAr ? "text-left" : "text-right"}`}>{activeTab === "history" ? (isAr ? "الحالة" : "Status") : (isAr ? "الإجراءات" : "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {activeTab === "history" && isFetchingHistory ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 font-medium text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>{isAr ? "جاري تحميل السجل..." : "Loading history..."}</span>
                      </div>
                    </td>
                  </tr>
                ) : activeTab === "history" && filteredHistoryAdjustments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 font-medium text-sm">
                      {isAr ? "لا توجد تسويات منتهية سابقة لهذا الفرع." : "No settled history found for this branch."}
                    </td>
                  </tr>
                ) : activeTab !== "history" && allAdjustments.filter(a => a.type === activeTab).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 font-medium text-sm">
                      {isAr 
                        ? `لا توجد ${activeTab === "deduction" ? "استقطاعات" : "سلف"} معلقة حالياً لهذا الفرع.` 
                        : `No pending ${activeTab} records found for this branch.`}
                    </td>
                  </tr>
                ) : (
                  (activeTab === "history" ? filteredHistoryAdjustments : allAdjustments.filter(a => a.type === activeTab)).map((adj) => {
                    const emp = employees.find(e => e.id === adj.employeeId);
                    return (
                    <tr key={adj.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-4 text-xs font-mono text-slate-500">{new Date(adj.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</td>
                      <td className="px-5 py-4 font-bold text-sm text-slate-800 dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center">
                            {(emp?.name || "U")[0]}
                          </div>
                          <span>{emp?.name || (isAr ? "موظف غير معروف" : "Unknown Employee")}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          {activeTab === "history" && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${adj.type === "loan" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"}`}>
                              {adj.type}
                            </span>
                          )}
                          <span className="truncate">{adj.reason}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-black text-sm text-slate-900 dark:text-white font-mono">
                        <span className="text-xs text-rose-600 font-sans mr-1">EGP</span>
                        {adj.amount.toLocaleString()}
                      </td>
                      <td className={`px-5 py-4 ${isAr ? "text-left" : "text-right"}`}>
                        <div className={`flex items-center gap-2 ${isAr ? "justify-start" : "justify-end"}`}>
                          {activeTab === "history" ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                              <Check className="w-3 h-3" />
                              <span>{isAr ? "تمت التسوية" : "Settled"}</span>
                            </span>
                          ) : (
                            <>
                              {activeTab === "loan" && (
                                <>
                                  <button
                                    onClick={() => {
                                      const matchingSysLoan = allSystemLoans.find(l => 
                                        l.id === (adj as any).loanDocId || 
                                        (l.employeeId === adj.employeeId && Math.abs((l.approved || l.amount) - adj.amount) < 0.1)
                                      );
                                      const targetLoan = matchingSysLoan || adj;
                                      setRepayLoan(targetLoan);
                                      const rem = Number(targetLoan.remainingBalance !== undefined ? targetLoan.remainingBalance : (targetLoan.approved || targetLoan.amount || 0));
                                      setRepayAmount(rem);
                                    }}
                                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-400 rounded-xl transition-all flex items-center gap-1.5 font-bold text-xs border border-blue-200 dark:border-blue-800 shadow-sm"
                                    title={isAr ? "سداد نقدي مبكر للسلفة وتوريد بالخزينة" : "Early cash repayment to vault"}
                                  >
                                    <Banknote className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">{isAr ? "سداد نقدي" : "Cash Repay"}</span>
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const matchingSysLoan = allSystemLoans.find(l => 
                                        l.id === (adj as any).loanDocId || 
                                        (l.employeeId === adj.employeeId && Math.abs((l.approved || l.amount) - adj.amount) < 0.1)
                                      );
                                      setPrintLoan(matchingSysLoan || adj);
                                      setTimeout(() => window.print(), 150);
                                    }}
                                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-400 rounded-xl transition-all flex items-center gap-1.5 font-bold text-xs border border-emerald-200 dark:border-emerald-800"
                                    title={isAr ? "طباعة إقرار وتفويض السلفة الرسمي (A4)" : "Print official A4 loan agreement"}
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">{isAr ? "إقرار وتفويض (A4)" : "A4 Agreement"}</span>
                                  </button>
                                </>
                              )}
                              {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && (
                                <button 
                                  onClick={() => handleDelete(adj.id!)}
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-900"
                                  title={isAr ? "حذف السجل المعلق" : "Delete pending record"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>
      </div> {/* End UI wrapper */}

      {/* 💰 EARLY CASH REPAYMENT & SAFE INFLOW MODAL */}
      {repayLoan && (() => {
        const emp = employees.find(e => e.id === repayLoan.employeeId) || {};
        const empName = emp.name || repayLoan.employeeName || (isAr ? "موظف" : "Employee");
        const loanTotal = Number(repayLoan.approved || repayLoan.amount || 0);
        const curRemaining = Number(repayLoan.remainingBalance !== undefined ? repayLoan.remainingBalance : loanTotal);
        const branchName = repayLoan.storeId === "ola" ? "Ola Koronfol" : "Alamein 4";
        const newCalculatedBalance = Math.max(0, curRemaining - (Number(repayAmount) || 0));

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0f1422] border border-white/10 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative text-white space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">
                      {isAr ? "سداد نقدي مبكر للسلفة" : "Early Cash Loan Repayment"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isAr ? "توريد نقدي فوري بالخزينة وتسوية رصيد السلفة" : "Immediate vault deposit & loan balance settlement"}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setRepayLoan(null); setRepayAmount(0); }}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Employee & Loan Details */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{isAr ? "الموظف المستفيد:" : "Employee:"}</span>
                  <span className="font-bold text-white text-sm">{empName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{isAr ? "الفرع المودع به (الخزينة):" : "Branch Vault:"}</span>
                  <span className="font-bold text-blue-400">{branchName}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                  <div>
                    <span className="text-[11px] text-slate-400 block">{isAr ? "أصل السلفة المصروفة" : "Original Loan"}</span>
                    <span className="text-sm font-bold text-slate-300 font-mono">{loanTotal.toLocaleString()} EGP</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">{isAr ? "الرصيد المتبقي الحالي" : "Current Outstanding"}</span>
                    <span className="text-sm font-black text-amber-400 font-mono">{curRemaining.toLocaleString()} EGP</span>
                  </div>
                </div>
              </div>

              {/* Input Form */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300">
                      {isAr ? "مبلغ التوريد النقدي للخزينة (EGP)" : "Cash Deposit Amount (EGP)"}
                    </label>
                    <button 
                      type="button"
                      onClick={() => setRepayAmount(curRemaining)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-bold underline"
                    >
                      {isAr ? "سداد كامل الرصيد" : "Settle Full Balance"}
                    </button>
                  </div>
                  <div className="relative">
                    <input 
                      type="number"
                      min={1}
                      max={curRemaining}
                      value={repayAmount || ""}
                      onChange={(e) => setRepayAmount(Number(e.target.value))}
                      placeholder={curRemaining.toString()}
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white font-mono font-bold text-lg focus:border-blue-500 focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      EGP
                    </span>
                  </div>
                </div>

                {/* Live simulation */}
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between text-xs">
                  <span className="text-blue-300">
                    {isAr ? "الرصيد المتبقي بعد هذا السداد:" : "Remaining Balance After Payment:"}
                  </span>
                  <span className="font-mono font-black text-sm text-blue-200">
                    {newCalculatedBalance.toLocaleString()} EGP
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    {isAr ? "ملاحظات أو رقم الإيصال اليدوي (اختياري)" : "Notes or Manual Receipt Ref (Optional)"}
                  </label>
                  <input 
                    type="text"
                    value={repayNote}
                    onChange={(e) => setRepayNote(e.target.value)}
                    placeholder={isAr ? "سداد نقدي لخزينة الفرع" : "Early cash repayment to vault"}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setRepayLoan(null); setRepayAmount(0); }}
                  className="flex-1 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={isRepaying || repayAmount <= 0 || repayAmount > curRemaining}
                  onClick={handleExecuteRepayment}
                  className="flex-[2] py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isRepaying ? (
                    <span>{isAr ? "جاري التوريد بالخزينة..." : "Processing Safe Deposit..."}</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isAr ? "تأكيد السداد وتوريد الخزينة" : "Confirm & Deposit into Safe"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 🧾 DIGITAL REPAYMENT RECEIPT & SAFE DEPOSIT VOUCHER */}
      {repaymentReceipt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative space-y-6">
            <div className="text-center space-y-1 pb-4 border-b border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black tracking-tight">CIRCLE K ENTERPRISE</h3>
              <p className="text-xs font-bold text-slate-500">
                {isAr ? "إيصال توريد نقدي رسمي - سداد سلفة" : "Official Cash Loan Repayment Receipt"}
              </p>
              <span className="inline-block font-mono text-[11px] bg-slate-100 px-2.5 py-0.5 rounded-full text-slate-600 mt-1">
                {repaymentReceipt.receiptNumber}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">{isAr ? "اسم الموظف:" : "Employee Name:"}</span>
                <span className="font-bold">{repaymentReceipt.employeeName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">{isAr ? "الفرع والخزينة:" : "Branch Safe:"}</span>
                <span className="font-bold uppercase">{repaymentReceipt.branchId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">{isAr ? "تاريخ التوريد:" : "Deposit Date:"}</span>
                <span className="font-bold font-mono">{repaymentReceipt.date}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200 bg-emerald-50 px-3 rounded-xl">
                <span className="font-bold text-emerald-800">{isAr ? "المبلغ المسدد نقداً:" : "Repaid Amount:"}</span>
                <span className="font-black text-emerald-700 text-base font-mono">
                  {repaymentReceipt.repaidAmount.toLocaleString()} EGP
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">{isAr ? "الرصيد المتبقي على الموظف:" : "Remaining Balance:"}</span>
                <span className="font-bold font-mono text-slate-800">
                  {repaymentReceipt.newRemainingBalance.toLocaleString()} EGP
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">{isAr ? "حالة السلفة:" : "Loan Status:"}</span>
                <span className={`font-bold ${repaymentReceipt.isFullySettled ? "text-emerald-600" : "text-amber-600"}`}>
                  {repaymentReceipt.isFullySettled 
                    ? (isAr ? "مسددة بالكامل (Settled)" : "Fully Settled") 
                    : (isAr ? "سداد جزئي (Partial)" : "Partially Settled")}
                </span>
              </div>
              <div className="flex justify-between py-1 text-[11px] text-slate-400">
                <span>{isAr ? "المستلم بالخزينة:" : "Received By:"}</span>
                <span>{repaymentReceipt.receivedBy}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRepaymentReceipt(null)}
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>{isAr ? "طباعة الإيصال" : "Print Receipt"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚖️ 100% LEGAL EGYPTIAN LOAN AGREEMENT & DEDUCTION AUTHORIZATION (ARTICLE 34 LAW 12/2003) */}
      {printLoan && (() => {
        const emp = employees.find(e => e.id === printLoan.employeeId) || {};
        const loanAmt = Number(printLoan.approved || printLoan.amount || 0);
        const instCount = Number(printLoan.installmentCount || (Array.isArray(printLoan.installments) ? printLoan.installments.length : 1)) || 1;
        const monthlyInst = Number(printLoan.monthlyInstallment || Math.round(loanAmt / instCount));
        const nidChars = (emp.nationalId || "").padEnd(14, " ").slice(0, 14).split("");

        let installmentsList = Array.isArray(printLoan.installments) && printLoan.installments.length > 0
          ? printLoan.installments
          : [];

        if (installmentsList.length === 0) {
          const startD = new Date(printLoan.createdAt || Date.now());
          for (let i = 0; i < instCount; i++) {
            const mDate = new Date(startD.getFullYear(), startD.getMonth() + i, 1);
            const mStr = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, "0")}`;
            installmentsList.push({
              installmentNumber: i + 1,
              month: mStr,
              amount: i === instCount - 1 ? (loanAmt - monthlyInst * (instCount - 1)) : monthlyInst,
              status: "pending"
            });
          }
        }

        let runningBalance = loanAmt;

        return (
          <div className="hidden print:block w-full text-black bg-white" style={{ fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif", fontSize: "10.5px", pageBreakInside: "avoid" }} dir="rtl">
            <style dangerouslySetInnerHTML={{ __html: "@media print { @page { size: A4 portrait; margin: 6mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; } }" }} />
            
            <div style={{ margin: "0 auto", width: "100%", maxWidth: "100%", height: "277mm", maxHeight: "277mm", padding: "4mm 6mm", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              
              <div>
                {/* 1. CORPORATE & LEGAL HEADER */}
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 2fr 1.4fr", gap: "8px", alignItems: "center", borderBottom: "2.5px solid #0f172a", paddingBottom: "5px", marginBottom: "7px" }}>
                  {/* Right: Company Identity */}
                  <div style={{ textAlign: "right", fontSize: "10px", lineHeight: "1.4", color: "#1e293b" }}>
                    <div style={{ fontWeight: "900", fontSize: "12px" }}>شركة ايه ان اتش للتجارة (ANH)</div>
                    <div style={{ fontSize: "8.5px", fontWeight: "700", textTransform: "uppercase", color: "#475569" }}>ANH TRADING & DISTRIBUTION</div>
                    <div style={{ fontSize: "9px", fontFamily: "monospace", marginTop: "1px" }}>س.ت: 216727 | ب.ض: 756-563-844</div>
                    <div style={{ fontSize: "8.5px", color: "#64748b" }}>قطاع التجزئة والمتاجر - إدارة الموارد البشرية والمالية</div>
                  </div>

                  {/* Center: Official Legal Agreement Badge */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ border: "2px solid #0f172a", borderRadius: "8px", padding: "4px 10px", background: "#f8fafc" }}>
                      <div style={{ fontSize: "13.5px", fontWeight: "900", color: "#0f172a" }}>
                        إقرار استلام سلفة نقدية وتفويض رسمي بالاستقطاع من الراتب
                      </div>
                      <div style={{ fontSize: "10px", fontWeight: "bold", color: "#047857" }}>
                        سلفة قرض حسن بدون فوائد • تفويض قانوني ملزم ونافذ
                      </div>
                      <div style={{ fontSize: "8px", color: "#475569", marginTop: "1px" }}>
                        طبقاً لأحكام المادة (34) من قانون العمل المصري رقم 12 لسنة 2003
                      </div>
                    </div>
                  </div>

                  {/* Left: Metadata & Branch Details */}
                  <div style={{ textAlign: "left", fontSize: "9.5px", lineHeight: "1.5", color: "#1e293b", fontFamily: "monospace" }}>
                    <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>رقم السلفة / Ref:</strong> <span style={{ fontWeight: "bold", color: "#1e3a8a", fontSize: "11px" }}>LN-{(printLoan.id || "NEW").slice(-6).toUpperCase()}</span></div>
                    <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>تاريخ التحرير:</strong> {dateString}</div>
                    <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>الفرع / Branch:</strong> {companyName}</div>
                    <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>جهة الصرف:</strong> خزينة الفرع (Safe)</div>
                  </div>
                </div>

                {/* 2. SECTION 1: EMPLOYEE & EMPLOYER IDENTIFICATION */}
                <div style={{ marginBottom: "6px" }}>
                  <div style={{ background: "#0f172a", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "2.5px 8px", borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between" }}>
                    <span>أولاً: بيانات العامل المقترض والجهة المانحة (Borrower & Employer Details)</span>
                    <span>عقد ملزم للطرفين</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", background: "#f8fafc" }}>
                    <tbody>
                      <tr>
                        <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>اسم العامل المقترض:</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", width: "42%", fontWeight: "900", color: "#0f172a", fontSize: "11px" }}>{emp.name || "-"}</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>المسمى الوظيفي:</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", width: "22%", fontWeight: "bold" }}>{emp.position || "-"}</td>
                      </tr>
                      <tr>
                        <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", background: "#f1f5f9", fontWeight: "bold" }}>الرقم القومي (14 رقم):</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "2.5px" }}>
                            {nidChars.map((ch: string, i: number) => (
                              <span
                                key={i}
                                style={{
                                  display: "inline-block",
                                  width: "18px",
                                  height: "19px",
                                  border: "1.5px solid #475569",
                                  borderRadius: "3px",
                                  textAlign: "center",
                                  lineHeight: "17px",
                                  fontSize: "11px",
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
                        <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", background: "#f1f5f9", fontWeight: "bold" }}>الراتب الأساسي الشهري:</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", fontFamily: "monospace", fontWeight: "bold", color: "#047857" }}>
                          {(Number(emp.baseSalary) || Number(emp.salary) || 0).toLocaleString()} ج.م
                        </td>
                      </tr>
                      <tr>
                        <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", background: "#f1f5f9", fontWeight: "bold" }}>الشركة المانحة:</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px" }}>شركة ايه ان اتش للتجارة (س.ت: 216727)</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", background: "#f1f5f9", fontWeight: "bold" }}>الفرع وجهة العمل:</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px" }}>{companyName}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. SECTION 2: LOAN FINANCIAL DETAILS & TAFQEET */}
                <div style={{ marginBottom: "6px" }}>
                  <div style={{ background: "#047857", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "2.5px 8px", borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between" }}>
                    <span>ثانياً: تفاصيل السلفة المعتمدة والتفقيط المالي القانوني (Approved Loan Terms)</span>
                    <span>المبالغ بالجنيه المصري (EGP)</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", background: "#f8fafc" }}>
                    <tbody>
                      <tr>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "20%", background: "#ecfdf5", fontWeight: "bold", color: "#065f46" }}>إجمالي مبلغ السلفة:</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "30%", fontWeight: "900", fontSize: "12px", color: "#047857", fontFamily: "monospace" }}>
                          {loanAmt.toLocaleString()} ج.م
                        </td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "20%", background: "#f1f5f9", fontWeight: "bold" }}>مدة ونظام التقسيط:</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "30%", fontWeight: "bold" }}>
                          {instCount} قسط/أقساط شهرية متتالية ({instCount} Months)
                        </td>
                      </tr>
                      <tr>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>التفقيط المالي الرسمي:</td>
                        <td colSpan={3} style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontWeight: "bold", color: "#1e293b", fontSize: "10px" }}>
                          فقط وقدره: <strong style={{ color: "#047857" }}>{numberToArabicWords(loanAmt)} جنيهاً مصرياً لا غير</strong> ({numberToWordsEn(loanAmt)} Egyptian Pounds).
                        </td>
                      </tr>
                      <tr>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>قيمة القسط الشهري:</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontFamily: "monospace", fontWeight: "bold", color: "#1e3a8a" }}>
                          {monthlyInst.toLocaleString()} ج.م شهرياً
                        </td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>تاريخ بدء أول قسط:</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontFamily: "monospace", fontWeight: "bold" }}>
                          راتب شهر: {printLoan.firstInstallmentMonth || installmentsList[0]?.month || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>سبب وتصنيف السلفة:</td>
                        <td colSpan={3} style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}>
                          {printLoan.categoryLabel || printLoan.reason || "سلفة راتب نقدية معتمدة وفقاً لاحتياجات العامل"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. SECTION 3: ITEMIZED INSTALLMENT SCHEDULE GRID */}
                <div style={{ marginBottom: "6px" }}>
                  <div style={{ background: "#334155", color: "#fff", fontSize: "9.5px", fontWeight: "bold", padding: "2px 8px", borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between" }}>
                    <span>ثالثاً: جدول استحقاق واستقطاع الأقساط الشهرية من الراتب (Installment Recovery Schedule)</span>
                    <span>سقف الخصم القانوني: لا يجاوز 50% من الأجر</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", textAlign: "center" }}>
                    <thead>
                      <tr style={{ background: "#e2e8f0", color: "#1e293b", fontWeight: "bold" }}>
                        <th style={{ border: "1px solid #cbd5e1", padding: "3px" }}>القسط</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "3px" }}>شهر الاستحقاق</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "3px" }}>قيمة القسط الشهري</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "3px" }}>الرصيد المتبقي بعد الخصم</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "3px" }}>حالة القسط</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "3px" }}>توقيع العامل بالعلم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installmentsList.slice(0, 12).map((inst: any, idx: number) => {
                        runningBalance = Math.max(0, runningBalance - Number(inst.amount));
                        return (
                          <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                            <td style={{ border: "1px solid #cbd5e1", padding: "3px", fontWeight: "bold", fontFamily: "monospace" }}>#{inst.installmentNumber || idx + 1}</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "3px", fontFamily: "monospace", fontWeight: "bold" }}>{inst.month}</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "3px", fontFamily: "monospace", fontWeight: "bold", color: "#047857" }}>
                              {Number(inst.amount).toLocaleString()} ج.م
                            </td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "3px", fontFamily: "monospace" }}>
                              {runningBalance.toLocaleString()} ج.م
                            </td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "3px" }}>
                              {inst.status === "paid" ? "تم الخصم بالراتب ✓" : "مجدول بالراتب"}
                            </td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "3px", color: "#94a3b8" }}>..........................</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 5. SECTION 4: STATUTORY EGYPTIAN LABOR LAW UNDERTAKINGS */}
                <div style={{ fontSize: "8.5px", lineHeight: "1.55", background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: "6px", padding: "5px 8px", marginBottom: "6px", color: "#1e293b" }}>
                  <strong style={{ color: "#0f172a", fontSize: "9px" }}>رابعاً: البنود القانونية والتفويض الإلزامي بالاستقطاع:</strong>
                  <ol style={{ margin: "2px 0 0 0", paddingRight: "16px" }}>
                    <li>
                      <strong>إقرار الاستلام:</strong> أقر أنا الموقع أدناه بأنني قد استلمت من إدارة الشركة كامل مبلغ السلفة الموضح بعاليه نقداً من خزينة الفرع على سبيل القرض الحسن دون أي فوائد، وتعد ذمتي مشغولة به قانوناً.
                    </li>
                    <li>
                      <strong>تفويض الخصم القانوني:</strong> أفوض إدارة الشركة تفويضاً رسمياً ونهائياً لا رجعة فيه باستقطاع قيمة القسط الشهري الموضح بالجدول من راتبي الشهري اعتباراً من شهر الاستحقاق وحتى تمام السداد، وذلك إعمالاً لنص المادة (34) من قانون العمل رقم 12 لسنة 2003.
                    </li>
                    <li>
                      <strong>تسوية نهاية الخدمة:</strong> في حال انتهاء علاقة العمل لأي سبب من الأسباب (استقالة، فسخ، انتهاء العقد، أو ترك العمل) قبل إتمام سداد كامل السلفة، فإنني أفوض الشركة تفويضاً صريحاً باستقطاع كامل الرصيد المتبقي ذمتي دفعة واحدة من أي مستحقات نهائية لي طرف الشركة (مكافأة نهاية الخدمة، رصيد الإجازات، أجر آخر شهر، أو أي مستحقات أخرى). وفي حال عدم كفايتها أتعهد بسداد المتبقي نقداً فوراً.
                    </li>
                    <li>
                      <strong>الحجية القضائية:</strong> تم تحرير هذا الإقرار بمحض إرادتي الحرة ودون أي إكراه، ويعد حجة قانونية نافذة وقاطعة في مواجهتي ومسؤوليتي المدنية والقضائية الكاملة أمام كافة الجهات الرسمية.
                    </li>
                  </ol>
                </div>
              </div>

              {/* 6. SIGNATURES & THUMBPRINT BLOCK */}
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: "6px", alignItems: "center", borderTop: "2px solid #0f172a", paddingTop: "4px", marginBottom: "4px" }}>
                  {/* Employee Signature */}
                  <div style={{ textAlign: "center", fontSize: "9px" }}>
                    <div style={{ fontWeight: "bold", color: "#0f172a" }}>المقر بما فيه (العامل المقترض):</div>
                    <div style={{ color: "#475569", margin: "1px 0" }}>{emp.name || "-"}</div>
                    <div style={{ color: "#64748b", margin: "15px 0 0 0" }}>التوقيع: .................................</div>
                  </div>

                  {/* OFFICIAL THUMBPRINT BOX (بصمة الإبهام الأيمن للعامل) */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ fontSize: "8.5px", fontWeight: "bold", color: "#0f172a", marginBottom: "2px" }}>
                      بصمة إبهام العامل (ختم إلزامي):
                    </div>
                    <div style={{
                      width: "95px",
                      height: "58px",
                      border: "2px solid #0f172a",
                      borderRadius: "5px",
                      background: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      fontSize: "8px",
                      color: "#94a3b8",
                      fontWeight: "bold",
                      boxShadow: "inset 0 0 4px rgba(0,0,0,0.05)"
                    }}>
                      [ بصمة الإبهام الأيمن ]
                    </div>
                  </div>

                  {/* Safe Custodian / Finance */}
                  <div style={{ textAlign: "center", fontSize: "9px" }}>
                    <div style={{ fontWeight: "bold", color: "#0f172a" }}>أمين الخزينة / المسؤول المالي:</div>
                    <div style={{ color: "#475569", margin: "1px 0" }}>تم الصرف نقداً من الخزينة</div>
                    <div style={{ color: "#64748b", margin: "15px 0 0 0" }}>التوقيع: .................................</div>
                  </div>

                  {/* HR Approval & Corporate Stamp */}
                  <div style={{ textAlign: "center", fontSize: "9px" }}>
                    <div style={{ fontWeight: "bold", color: "#0f172a" }}>اعتماد الموارد البشرية:</div>
                    <div style={{
                      margin: "3px auto 0 auto",
                      width: "115px",
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
                      <div style={{ fontSize: "7.5px", fontWeight: "bold", color: "#1e3a8a" }}>شركة ايه ان اتش للتجارة</div>
                      <div style={{ fontSize: "6.5px", color: "#475569" }}>س.ت: 216727 • ب.ض: 756-563-844</div>
                      <div style={{ fontSize: "7px", color: "#047857", fontWeight: "bold", marginTop: "1px" }}>[ معتمد ومصرح بالصرف ]</div>
                    </div>
                  </div>
                </div>

                {/* Footer Security Strip */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #cbd5e1", paddingTop: "3px", fontSize: "8px", color: "#64748b" }}>
                  <div>وثيقة رسمية صادرة آلياً من نظام إدارة الموارد البشرية - شركة ايه ان اتش للتجارة</div>
                  <div>المادة 34 من قانون العمل رقم 12 لسنة 2003 • إقرار وتفويض رسمي بالسداد والاستقطاع</div>
                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </>
  );
}
