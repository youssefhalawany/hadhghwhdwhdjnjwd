"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, where, limit, deleteDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Plus, Check, X, ShieldAlert, DollarSign, Calendar, Save, Trash2, Printer, Search, FileText, Coins, TrendingUp, Users, CalendarCheck, Scale, Sparkles, Building2, AlertCircle, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranch } from "@/context/BranchContext";
import QRCode from "qrcode";

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

export const loanCategoryLabels: Record<string, { label: string; icon: string; desc: string }> = {
  medical: { label: "حالات طبية طارئة", icon: "🏥", desc: "عمليات، أدوية، طوارئ صحية" },
  education: { label: "مصاريف دراسية وجامعية", icon: "🎓", desc: "أقساط مدارس، مستلزمات تعليمية" },
  marriage: { label: "مناسبات زواج وعائلية", icon: "💍", desc: "زواج، ارتباط، التزامات عائلية" },
  seasons: { label: "سلفة أعياد ومواسم", icon: "🌙", desc: "عيد الفطر، الأضحى، رمضان، المدارس" },
  living: { label: "التزامات معيشية وإيجار", icon: "🏠", desc: "إيجار، فواتير، التزامات معيشية طارئة" },
  other: { label: "سلفة عامة أخرى", icon: "📋", desc: "أسباب وظروف شخصية أخرى" },
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
  daysWorkedAtRequest?: number; // for loans
  maxAllowedAmount?: number; // for loans
  payrollId?: string; // set when applied
  category?: string;
  installmentCount?: number;
  monthlyInstallment?: number;
  loanDocId?: string;
};

export default function AdminAdjustmentsPage() {
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
    });

    // Fetch ONLY pending adjustments to save reads
    const adjQ = query(collection(db, "adjustments"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
    const unsubAdj = onSnapshot(adjQ, (snap) => {
      const adjs: any[] = [];
      snap.forEach(d => adjs.push({ id: d.id, ...d.data() }));
      setAdjustments(adjs);
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
          createdAt: data.date || data.createdAt || new Date().toISOString()
        } as AdjustmentRecord);
      });
      setOldDeductions(arr);
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
            amount: Number(data.approved) || 0,
            reason: data.reason || "Old System Loan",
            status: "pending",
            createdAt: data.createdAt || data.date || new Date().toISOString()
          } as AdjustmentRecord);
        }
      });
      setOldLoans(arr);
    });

    // Fetch all system loans for company/branch telemetry and forecasting
    const sysLoansQ = query(collection(db, "loans"), orderBy("createdAt", "desc"), limit(300));
    const unsubSysLoans = onSnapshot(sysLoansQ, (snap) => {
      const arr: any[] = [];
      snap.forEach(l => {
        arr.push({ id: l.id, ...l.data() });
      });
      setAllSystemLoans(arr);
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

  const allAdjustments = [...adjustments, ...oldDeductions, ...oldLoans].sort((a: any, b: any) => {
    return new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime();
  });

  const selectedEmp = employees.find(e => e.id === selectedEmpId);
  const dailyRate = selectedEmp ? ((Number(selectedEmp.baseSalary) || Number(selectedEmp.salary) || 3000) / 30) : 0;
  const maxAllowedLoan = activeTab === "loan" ? (dailyRate * addForm.daysWorked * 0.5) : 0;
  const finalApprovedLoan = activeTab === "loan" ? Math.min(addForm.amount, maxAllowedLoan) : 0;

  // -- COMPANY & BRANCH LOAN RECOVERY FORECAST TELEMETRY --
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

    allSystemLoans.forEach(loan => {
      const isSettled = loan.settled === true || loan.status === "settled";
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
  }, [allSystemLoans]);

  const handleSave = async () => {
    if (!selectedEmpId) return toast.error("اختر الموظف أولاً");
    if (activeTab === "deduction" && addForm.amount <= 0) return toast.error("أدخل مبلغ الخصم");
    if (activeTab === "loan" && addForm.daysWorked <= 0) return toast.error("أدخل عدد أيام العمل المحتسبة");
    if (activeTab === "loan" && addForm.amount <= 0) return toast.error("أدخل مبلغ السلفة المطلوب");
    if (!addForm.reason) return toast.error("أدخل سبب الطلب / التفاصيل");

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

        const targetBranchId = selectedEmp?.storeId || currentBranch || "alamein4";
        const catLabel = loanCategoryLabels[loanCategory]?.label || "سلفة نقدية";
        const finalReason = `${catLabel}${addForm.reason ? ` - ${addForm.reason}` : ""}`;

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
          notes: addForm.reason || "سلفة راتب نقدية معتمدة عبر لوحة التعديلات",
          date: new Date().toISOString().split("T")[0],
          month: new Date().toISOString().slice(0, 7),
          firstInstallmentMonth: schedule[0]?.month || new Date().toISOString().slice(0, 7),
          storeId: targetBranchId,
          disbursedFrom: "خزينة الفرع (Safe)",
          installments: schedule,
          repayments: [],
          type: "loan",
          daysWorkedAtRequest: addForm.daysWorked,
          maxAllowedAmount: maxAllowedLoan,
          createdAt: serverTimestamp(),
          createdBy: currentUserEmail
        };

        const docRef = await addDoc(collection(db, "loans"), loanDocPayload);

        // 2. Mirror into 'adjustments' for unified dashboard and history
        await addDoc(collection(db, "adjustments"), {
          employeeId: selectedEmpId,
          type: "loan",
          amount: finalApprovedLoan,
          reason: finalReason,
          status: "pending",
          createdAt: new Date().toISOString(),
          createdBy: currentUserEmail,
          loanDocId: docRef.id,
          category: loanCategory,
          installmentCount: months,
          monthlyInstallment: monthlyInst,
          daysWorkedAtRequest: addForm.daysWorked,
          maxAllowedAmount: maxAllowedLoan
        });

        toast.success("تم اعتماد وصرف السلفة وتخصيص الأقساط الشهرية بنجاح!");
      } else {
        const newAdj: AdjustmentRecord = {
          employeeId: selectedEmpId,
          type: "deduction",
          amount: addForm.amount,
          reason: addForm.reason,
          status: "pending",
          createdAt: new Date().toISOString(),
          createdBy: currentUserEmail
        };
        await addDoc(collection(db, "adjustments"), newAdj);
        toast.success("تم تسجيل الخصم بنجاح");
      }

      setIsAdding(false);
      setAddForm({ amount: 0, reason: "", daysWorked: 0 });
      setSelectedEmpId("");
      setLoanInstallmentMonths(1);
    } catch (e: any) {
      toast.error(e.message || "فشل الحفظ");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا السجل المعلق؟")) {
      await deleteDoc(doc(db, "adjustments", id));
      toast.success("تم الحذف بنجاح");
    }
  };

  if (isAdmin === null) return <div className="p-10"><Skeleton className="h-64 w-full" /></div>;
  if (isAdmin === false) return <div className="p-10 text-red-500">Access Denied. Admin only.</div>;

  const filteredAdjustments = adjustments.filter(a => a.type === activeTab);

  // -- PRINT HELPERS --
  const printEmp = printLoan ? employees.find(e => e.id === printLoan.employeeId) || {} : {};
  const printBranch = availableBranches.find(b => b.id === (printEmp.storeId || printLoan?.storeId));
  const companyName = printBranch ? printBranch.name : "شركة ايه ان اتش للتجارة (ANH)";
  const dateString = new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      {/* UI WRAPPER */}
      <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen pb-32 print:hidden space-y-8" dir="rtl">
      
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl">
                <Scale className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                إدارة السلف والتسويات والاستقطاعات
              </h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              نظام السلف المؤسسي المتوافق مع قانون العمل المصري (مادة 34) • تقسيط السلف • صرف مباشر من الخزينة • استقطاع آلي
            </p>
          </div>
          {!isAdding && (
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 self-start md:self-auto"
            >
              <Plus className="w-5 h-5" /> تسجيل سلفة / خصم جديد
            </button>
          )}
        </div>

        {/* 🏢 BRANCH & COMPANY-WIDE LOAN RECOVERY FORECAST TELEMETRY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Outstanding Loan Capital */}
          <div className="bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/20 dark:to-slate-900 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                إجمالي السلف القائمة
              </span>
              <div className="p-2 bg-rose-100 dark:bg-rose-900/50 text-rose-600 rounded-xl">
                <Coins className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              EGP {loanTelemetry.totalOutstanding.toLocaleString()}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>رأس مال السلف المتداول</span>
              <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded-full font-bold">
                {loanTelemetry.activeLoansCount} سلفة سارية
              </span>
            </div>
          </div>

          {/* Card 2: Next Month Recovery Forecast */}
          <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                تحصيلات الشهر القادم
              </span>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              EGP {loanTelemetry.nextMonthForecast.toLocaleString()}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>توقع الاستقطاع من الرواتب</span>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full font-bold">
                دورة {loanTelemetry.nextMonthStr}
              </span>
            </div>
          </div>

          {/* Card 3: Active Indebted Staff Count */}
          <div className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-slate-900 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                الموظفون المدينون بالسلف
              </span>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {loanTelemetry.activeIndebtedStaffCount} <span className="text-sm font-normal text-slate-500">موظفاً</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>نسبة المدينين بالقوى العاملة</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {employees.length > 0 ? Math.round((loanTelemetry.activeIndebtedStaffCount / employees.length) * 100) : 0}% من الطاقم
              </span>
            </div>
          </div>

          {/* Card 4: Cumulative Recovery Journey */}
          <div className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-slate-900 border border-purple-100 dark:border-purple-900/40 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                نسبة الاسترداد التراكمية
              </span>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/50 text-purple-600 rounded-xl">
                <CalendarCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
              {loanTelemetry.recoveryRate}%
            </div>
            <div className="w-full bg-purple-100 dark:bg-purple-950/50 rounded-full h-2 mt-2 overflow-hidden">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, loanTelemetry.recoveryRate))}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>تم تحصيل: EGP {loanTelemetry.totalSettled.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("loan")}
            className={`pb-4 px-4 font-bold text-sm transition-colors flex items-center gap-2 ${activeTab === "loan" ? "border-b-2 border-rose-600 text-rose-600" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
          >
            <Coins className="w-4 h-4" />
            السلف النقدية والأقساط ({allAdjustments.filter(a => a.type === "loan").length})
          </button>
          <button
            onClick={() => setActiveTab("deduction")}
            className={`pb-4 px-4 font-bold text-sm transition-colors flex items-center gap-2 ${activeTab === "deduction" ? "border-b-2 border-rose-600 text-rose-600" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
          >
            <FileText className="w-4 h-4" />
            الاستقطاعات والجزاءات ({allAdjustments.filter(a => a.type === "deduction").length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-4 px-4 font-bold text-sm transition-colors flex items-center gap-2 ${activeTab === "history" ? "border-b-2 border-slate-800 text-slate-800 dark:border-white dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
          >
            <Calendar className="w-4 h-4" />
            سجل التسويات المنتهية
          </button>
        </div>

        {/* ADD FORM */}
        {isAdding && activeTab !== "history" && (
          <div className="bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/50 rounded-2xl p-6 shadow-xl shadow-rose-100/20 dark:shadow-none animate-in slide-in-from-top-4 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                {activeTab === "deduction" ? "تسجيل استقطاع جديد" : "طلب واعتماد سلفة نقدية وتقسيط"}
              </h2>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* RETAIL LOAN CATEGORIZATION */}
            {activeTab === "loan" && (
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-2">
                  🏥 تصنيف سبب السلفة (Retail Loan Category):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {Object.entries(loanCategoryLabels).map(([key, item]) => {
                    const isSelected = loanCategory === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLoanCategory(key)}
                        className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                          isSelected
                            ? "bg-rose-50 dark:bg-rose-950/40 border-rose-600 text-rose-900 dark:text-rose-200 shadow-sm"
                            : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="text-xl mb-1">{item.icon}</div>
                        <div className="font-bold text-xs">{item.label}</div>
                        <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">الموظف المستفيد</label>
                <select 
                  value={selectedEmpId}
                  onChange={e => setSelectedEmpId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-bold"
                >
                  <option value="">اختر الموظف...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.position})</option>
                  ))}
                </select>
              </div>

              {selectedEmp && activeTab === "loan" && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">الراتب الأساسي الشهري</label>
                    <div className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-700 dark:text-slate-300 font-bold">
                      EGP {(Number(selectedEmp.baseSalary) || Number(selectedEmp.salary) || 3000).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">أيام العمل المحتسبة حتى الآن</label>
                    <input 
                      type="number" 
                      value={addForm.daysWorked || ""}
                      onChange={e => setAddForm({...addForm, daysWorked: Number(e.target.value)})}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold"
                      placeholder="مثال: 15"
                    />
                  </div>

                  {addForm.daysWorked > 0 && (
                    <div className="col-span-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex gap-4 items-center">
                      <ShieldAlert className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                      <div className="text-sm">
                        <h4 className="text-emerald-900 dark:text-emerald-300 font-bold">قاعدة سقف السلفة (المادة 34 من قانون العمل رقم 12 لسنة 2003)</h4>
                        <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                          معدل الأجر اليومي: <strong>EGP {dailyRate.toFixed(2)}</strong> &times; {addForm.daysWorked} يوماً = مستحق مكتسب قدره <strong>EGP {(dailyRate * addForm.daysWorked).toFixed(2)}</strong>.<br/>
                          الحد الأقصى المسموح لصرفه فورياً (50%): <strong className="underline font-black text-base">EGP {maxAllowedLoan.toFixed(2)}</strong>
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedEmp && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {activeTab === "loan" ? "المبلغ المطلوب" : "مبلغ الاستقطاع"}
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={addForm.amount || ""}
                        onChange={e => setAddForm({...addForm, amount: Number(e.target.value)})}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold pl-12"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">EGP</span>
                    </div>
                  </div>

                  {/* INSTALLMENT DURATION SELECTOR */}
                  {activeTab === "loan" && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">خطة التقسيط (أشهر السداد)</label>
                      <select
                        value={loanInstallmentMonths}
                        onChange={e => setLoanInstallmentMonths(Number(e.target.value))}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                      >
                        <option value={1}>شهر واحد (استقطاع كامل بالراتب القادم)</option>
                        <option value={2}>شهرين (قسطين متساويين)</option>
                        <option value={3}>3 أشهر (3 أقساط شهرية)</option>
                        <option value={4}>4 أشهر (4 أقساط شهرية)</option>
                        <option value={6}>6 أشهر (نصف سنة)</option>
                        <option value={10}>10 أشهر (خطة مدرسية/موسمية)</option>
                        <option value={12}>12 شهراً (سنة كاملة)</option>
                      </select>
                    </div>
                  )}

                  <div className="space-y-1 md:col-span-2 lg:col-span-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">السبب / البيان التفصيلي</label>
                    <input 
                      type="text" 
                      value={addForm.reason}
                      onChange={e => setAddForm({...addForm, reason: e.target.value})}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                      placeholder={activeTab === "loan" ? "مثال: ظرف عائلي طارئ / عملية جراحية" : "مثال: إتلاف عهدة / غياب بدون إذن"}
                    />
                  </div>
                </>
              )}
            </div>
            
            {/* TAFQEET & INSTALLMENT PREVIEW */}
            {selectedEmp && activeTab === "loan" && addForm.amount > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                  <div className="text-slate-600 dark:text-slate-300">
                    المبلغ المعتمد بالحروف: <strong className="text-rose-600 dark:text-rose-400">فقط وقدره {numberToArabicWords(finalApprovedLoan)} جنيهاً مصرياً لا غير</strong>
                  </div>
                  <div className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                    القسط الشهري: <span className="text-emerald-600 dark:text-emerald-400">EGP {Math.round(finalApprovedLoan / (loanInstallmentMonths || 1)).toLocaleString()} / شهر</span> ({loanInstallmentMonths} أشهر)
                  </div>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  يتم قيد السلفة مباشرة كحركة خروج نقدية من <strong>خزينة الفرع (Safe)</strong> وتخصم الأقساط آلياً عبر مسيرات الرواتب.
                </div>
              </div>
            )}

            {selectedEmp && activeTab === "loan" && addForm.amount > maxAllowedLoan && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 rounded-lg text-sm border border-amber-200 dark:border-amber-800/50 font-medium flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                تنبيه: المبلغ المطلوب (EGP {addForm.amount}) يتجاوز سقف العمل المكتسب (EGP {maxAllowedLoan.toFixed(2)}). سيتم اعتماد الحد الأقصى المسموح تلقائياً حفاظاً على السلامة القانونية.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm transition-colors"
              >
                إلغاء
              </button>
              <button 
                onClick={handleSave}
                className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
              >
                <Save className="w-5 h-5" /> حفظ واعتماد {activeTab === "deduction" ? "الاستقطاع" : "السلفة وصرفها"}
              </button>
            </div>
          </div>
        )}

      {/* LIST */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            {activeTab === "history" ? (
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            )}
            {activeTab === "history" ? "Settled Adjustments" : `Pending ${activeTab === "deduction" ? "Deductions" : "Loans"}`}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === "history" 
              ? "These have been successfully applied to past payroll runs." 
              : "These will automatically apply to the employee's next payroll run."}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/20 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 font-bold">Date</th>
                <th className="px-4 py-3 font-bold">Employee</th>
                <th className="px-4 py-3 font-bold">Type / Reason</th>
                <th className="px-4 py-3 font-bold">Amount</th>
                <th className="px-4 py-3 font-bold text-right">{activeTab === "history" ? "Status" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {activeTab === "history" && isFetchingHistory ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                    Loading history...
                  </td>
                </tr>
              ) : activeTab === "history" && historyAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                    No settled history found.
                  </td>
                </tr>
              ) : activeTab !== "history" && allAdjustments.filter(a => a.type === activeTab).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                    No pending {activeTab} found.
                  </td>
                </tr>
              ) : (
                (activeTab === "history" ? historyAdjustments : allAdjustments.filter(a => a.type === activeTab)).map((adj) => {
                  const emp = employees.find(e => e.id === adj.employeeId);
                  return (
                  <tr key={adj.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-500">{new Date(adj.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{emp?.name || "Unknown"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {activeTab === "history" && <span className="font-bold text-slate-800 dark:text-slate-300 mr-2 uppercase text-xs">{adj.type}:</span>}
                      {adj.reason}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">EGP {adj.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                      {activeTab === "history" ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 px-2 py-1 rounded-md text-xs font-bold">
                          Settled
                        </span>
                      ) : (
                        <>
                          {activeTab === "loan" && (
                            <button 
                              onClick={() => {
                                const matchingSysLoan = allSystemLoans.find(l => 
                                  l.id === (adj as any).loanDocId || 
                                  (l.employeeId === adj.employeeId && Math.abs((l.approved || l.amount) - adj.amount) < 0.1)
                                );
                                setPrintLoan(matchingSysLoan || adj);
                                setTimeout(() => window.print(), 150);
                              }}
                              className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 font-bold text-xs"
                              title="طباعة إقرار وتفويض السلفة الرسمي (A4)"
                            >
                              <Printer className="w-4 h-4" />
                              <span className="hidden sm:inline">إقرار وتفويض (A4)</span>
                            </button>
                          )}
                          {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && (
                            <button 
                              onClick={() => handleDelete(adj.id!)}
                              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>
      </div> {/* End UI wrapper */}

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
                    <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>رقم السلفة:</strong> <span style={{ fontWeight: "bold", color: "#1e3a8a", fontSize: "11px" }}>LN-{(printLoan.id || "NEW").slice(-6).toUpperCase()}</span></div>
                    <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>تاريخ التحرير:</strong> {dateString}</div>
                    <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>الفرع:</strong> {companyName}</div>
                    <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>جهة الصرف:</strong> خزينة الفرع (Safe)</div>
                  </div>
                </div>

                {/* 2. SECTION 1: EMPLOYEE & EMPLOYER IDENTIFICATION */}
                <div style={{ marginBottom: "6px" }}>
                  <div style={{ background: "#0f172a", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "2.5px 8px", borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between" }}>
                    <span>أولاً: بيانات العامل المقترض والجهة المانحة</span>
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
                    <span>ثانياً: تفاصيل السلفة المعتمدة والتفقيط المالي القانوني</span>
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
                          {instCount} قسط/أقساط شهرية متتالية
                        </td>
                      </tr>
                      <tr>
                        <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>التفقيط المالي الرسمي:</td>
                        <td colSpan={3} style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontWeight: "bold", color: "#1e293b", fontSize: "10px" }}>
                          فقط وقدره: <strong style={{ color: "#047857" }}>{numberToArabicWords(loanAmt)} جنيهاً مصرياً لا غير</strong>.
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
                    <span>ثالثاً: جدول استحقاق واستقطاع الأقساط الشهرية من الراتب</span>
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
