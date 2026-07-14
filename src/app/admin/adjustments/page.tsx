"use client";

import React, { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, where, limit, deleteDoc, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Plus, Check, X, ShieldAlert, DollarSign, Calendar, Save, Trash2, Printer, Search, FileText } from "lucide-react";
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
};

export default function AdminAdjustmentsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [oldDeductions, setOldDeductions] = useState<AdjustmentRecord[]>([]);
  const [oldLoans, setOldLoans] = useState<AdjustmentRecord[]>([]);
  const [historyAdjustments, setHistoryAdjustments] = useState<AdjustmentRecord[]>([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"deduction" | "loan" | "history">("deduction");
  
  const [isAdding, setIsAdding] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [addForm, setAddForm] = useState<{ amount: number, reason: string, daysWorked: number }>({
    amount: 0,
    reason: "",
    daysWorked: 0
  });

  const { availableBranches } = useBranch();
  
  const [printLoan, setPrintLoan] = useState<AdjustmentRecord | null>(null);
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

    return () => {
      unsubEmp();
      unsubAdj();
      unsubOldD();
      unsubOldL();
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

  const handleSave = async () => {
    if (!selectedEmpId) return toast.error("Select an employee");
    if (activeTab === "deduction" && addForm.amount <= 0) return toast.error("Enter deduction amount");
    if (activeTab === "loan" && addForm.daysWorked <= 0) return toast.error("Enter days worked");
    if (activeTab === "loan" && addForm.amount <= 0) return toast.error("Enter requested loan amount");
    if (!addForm.reason) return toast.error("Enter reason");

    try {
      const newAdj: AdjustmentRecord = {
        employeeId: selectedEmpId,
        type: activeTab as "deduction" | "loan",
        amount: activeTab === "loan" ? finalApprovedLoan : addForm.amount,
        reason: addForm.reason,
        status: "pending",
        createdAt: new Date().toISOString(),
        createdBy: currentUserEmail,
        ...(activeTab === "loan" && {
          daysWorkedAtRequest: addForm.daysWorked,
          maxAllowedAmount: maxAllowedLoan
        })
      };

      await addDoc(collection(db, "adjustments"), newAdj);
      toast.success(`${activeTab === "loan" ? "Loan" : "Deduction"} recorded successfully`);
      setIsAdding(false);
      setAddForm({ amount: 0, reason: "", daysWorked: 0 });
      setSelectedEmpId("");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this pending adjustment?")) {
      await deleteDoc(doc(db, "adjustments", id));
      toast.success("Deleted");
    }
  };

  if (isAdmin === null) return <div className="p-10"><Skeleton className="h-64 w-full" /></div>;
  if (isAdmin === false) return <div className="p-10 text-red-500">Access Denied. Admin only.</div>;

  const filteredAdjustments = adjustments.filter(a => a.type === activeTab);

  // -- PRINT HELPERS --
  const printEmp = printLoan ? employees.find(e => e.id === printLoan.employeeId) || {} : {};
  const printBranch = availableBranches.find(b => b.id === printEmp.storeId);
  const companyName = printBranch ? printBranch.name : "Company Name";
  const dateString = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      {/* UI WRAPPER */}
      <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen pb-32 print:hidden space-y-8">
      
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl">
              <FileText className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              Adjustments & Loans
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Manage pending payroll deductions and auto-capped loans.</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> New Record
          </button>
        )}
      </div>

      {/* TABS */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("deduction")}
          className={`pb-4 px-4 font-bold text-sm transition-colors ${activeTab === "deduction" ? "border-b-2 border-rose-600 text-rose-600" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
        >
          Deductions ({allAdjustments.filter(a => a.type === "deduction").length})
        </button>
        <button
          onClick={() => setActiveTab("loan")}
          className={`pb-4 px-4 font-bold text-sm transition-colors ${activeTab === "loan" ? "border-b-2 border-rose-600 text-rose-600" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
        >
          Loans ({allAdjustments.filter(a => a.type === "loan").length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-4 px-4 font-bold text-sm transition-colors ${activeTab === "history" ? "border-b-2 border-slate-800 text-slate-800 dark:border-white dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
        >
          History
        </button>
      </div>

      {/* ADD FORM */}
      {isAdding && activeTab !== "history" && (
        <div className="bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/50 rounded-2xl p-6 shadow-xl shadow-rose-100/20 dark:shadow-none animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              {activeTab === "deduction" ? "New Deduction" : "New Loan Request"}
            </h2>
            <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</label>
              <select 
                value={selectedEmpId}
                onChange={e => setSelectedEmpId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm"
              >
                <option value="">Select an employee...</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.position})</option>
                ))}
              </select>
            </div>

            {selectedEmp && activeTab === "loan" && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Base Salary</label>
                  <div className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-500">
                    EGP {(Number(selectedEmp.baseSalary) || Number(selectedEmp.salary) || 3000).toLocaleString()}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Days Worked So Far</label>
                  <input 
                    type="number" 
                    value={addForm.daysWorked || ""}
                    onChange={e => setAddForm({...addForm, daysWorked: Number(e.target.value)})}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                    placeholder="e.g., 10"
                  />
                </div>

                {addForm.daysWorked > 0 && (
                  <div className="col-span-full md:col-span-2 lg:col-span-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex gap-4 items-center">
                    <ShieldAlert className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                    <div>
                      <h4 className="text-emerald-800 dark:text-emerald-300 font-bold">50% Salary Cap Rule</h4>
                      <p className="text-emerald-600 dark:text-emerald-400 text-sm">
                        Daily Rate: <strong>EGP {dailyRate.toFixed(2)}</strong> &times; {addForm.daysWorked} days = EGP {(dailyRate * addForm.daysWorked).toFixed(2)} earned.<br/>
                        Maximum Allowed Loan (50%): <strong>EGP {maxAllowedLoan.toFixed(2)}</strong>
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {selectedEmp && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{activeTab === "loan" ? "Requested Amount" : "Deduction Amount"}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">EGP</span>
                    <input 
                      type="number" 
                      value={addForm.amount || ""}
                      onChange={e => setAddForm({...addForm, amount: Number(e.target.value)})}
                      className="w-full pl-10 p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason / Description</label>
                  <input 
                    type="text" 
                    value={addForm.reason}
                    onChange={e => setAddForm({...addForm, reason: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                    placeholder={activeTab === "loan" ? "e.g., Emergency (Funeral)" : "e.g., Damaged equipment"}
                  />
                </div>
              </>
            )}
          </div>
          
          {selectedEmp && activeTab === "loan" && addForm.amount > maxAllowedLoan && (
             <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 rounded-lg text-sm border border-amber-200 dark:border-amber-800/50 font-medium flex items-center gap-2">
               <ShieldAlert className="w-5 h-5 flex-shrink-0" />
               Warning: Requested amount (EGP {addForm.amount}) exceeds max allowed (EGP {maxAllowedLoan.toFixed(2)}). System will auto-approve up to the max allowed.
             </div>
          )}

          <div className="mt-6 flex justify-end">
            <button 
              onClick={handleSave}
              className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors"
            >
              <Save className="w-5 h-5" /> Save {activeTab === "deduction" ? "Deduction" : "Loan Request"}
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
                                setPrintLoan(adj);
                                setTimeout(() => window.print(), 100);
                              }}
                              className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                              title="Print Receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDelete(adj.id!)}
                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Generate QR code when printLoan is set */}
      {(() => {
        if (printLoan && selectedEmpId) {
          const emp = employees.find(e => e.id === selectedEmpId);
          if (emp && !qrCodeData) {
             const text = `Loan ID: ${printLoan.id || "NEW"}\nEmp ID: ${emp.id}\nNational ID: ${emp.nationalId}\nAmount: ${printLoan.amount} EGP\nDate: ${new Date(printLoan.createdAt).toLocaleDateString('en-GB')}`;
             QRCode.toDataURL(text)
              .then(url => setQrCodeData(url))
              .catch(err => console.error(err));
          }
        }
        return null;
      })()}

      {/* PRINT: LOAN RECEIPT */}
      {printLoan && (
        <div className="hidden print:block w-full text-black bg-white" style={{ fontFamily: "Arial, sans-serif", fontSize: "14px", pageBreakInside: "avoid" }}>
          <style dangerouslySetInnerHTML={{ __html: "@media print { @page { size: A4; margin: 5mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }" }} />
          
          <div style={{ margin: "0 auto", maxWidth: "800px", padding: "20px", height: "260mm", maxHeight: "260mm", position: "relative", overflow: "hidden", pageBreakInside: "avoid" }}>
            
            {/* WATERMARK STAMP */}
            <div style={{
              position: "absolute",
              top: "35%",
              left: "50%",
              transform: "translate(-50%, -50%) rotate(-15deg)",
              fontSize: "120px",
              fontWeight: "900",
              color: "rgba(16, 185, 129, 0.08)",
              border: "10px solid rgba(16, 185, 129, 0.08)",
              borderRadius: "20px",
              padding: "20px",
              textTransform: "uppercase",
              pointerEvents: "none",
              zIndex: 0,
              whiteSpace: "nowrap"
            }}>
              APPROVED
            </div>

            {/* Header */}
            <div style={{ backgroundColor: "#be123c", color: "white", padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
              <span style={{ fontSize: "18px" }}>Employee Loan Approval</span>
              <span style={{ fontSize: "22px", fontWeight: "bold" }}>إقرار منح قرض</span>
            </div>

            <div style={{ border: "1px solid #cbd5e1", borderBottomLeftRadius: "8px", borderBottomRightRadius: "8px", borderTop: "none", display: "flex" }}>
              <div style={{ flex: 1, display: "flex", flexWrap: "wrap" }}>
                <div style={{ width: "50%", padding: "15px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                  <div style={{ color: "#64748b", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                    <span>Employee Name</span><span>اسم الموظف</span>
                  </div>
                  <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "6px", fontSize: "16px", color: "#0f172a" }}>{printEmp.name || "-"}</div>
                </div>
                <div style={{ width: "50%", padding: "15px", borderBottom: "1px solid #cbd5e1" }}>
                  <div style={{ color: "#64748b", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                    <span>Employee ID</span><span>الرقم الوظيفي</span>
                  </div>
                  <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "6px", fontSize: "14px", wordBreak: "break-all", color: "#0f172a" }}>{printEmp.id || "-"}</div>
                </div>
                <div style={{ width: "50%", padding: "15px", borderBottom: "1px solid #cbd5e1", borderRight: "1px solid #cbd5e1" }}>
                  <div style={{ color: "#64748b", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                    <span>National ID</span><span>الرقم القومي</span>
                  </div>
                  <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "6px", letterSpacing: "1px", color: "#0f172a" }}>{printEmp.nationalId || "-"}</div>
                </div>
                <div style={{ width: "50%", padding: "15px", borderBottom: "1px solid #cbd5e1" }}>
                  <div style={{ color: "#64748b", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                    <span>Request Date</span><span>تاريخ الطلب</span>
                  </div>
                  <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "6px", color: "#0f172a" }}>{new Date(printLoan.createdAt).toLocaleDateString('en-GB')}</div>
                </div>
                <div style={{ width: "50%", padding: "15px", borderRight: "1px solid #cbd5e1" }}>
                  <div style={{ color: "#64748b", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                    <span>Issue Date</span><span>تاريخ الإصدار</span>
                  </div>
                  <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "6px", color: "#0f172a" }}>{dateString}</div>
                </div>
                <div style={{ width: "50%", padding: "15px" }}>
                  <div style={{ color: "#64748b", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                    <span>Days Worked</span><span>أيام العمل</span>
                  </div>
                  <div style={{ fontWeight: "bold", textAlign: "right", marginTop: "6px", color: "#0f172a" }}>يوم {printLoan.daysWorkedAtRequest || "-"}</div>
                </div>
              </div>
              {/* QR Code Section */}
              <div style={{ width: "140px", borderLeft: "1px solid #cbd5e1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px", backgroundColor: "#f8fafc" }}>
                {qrCodeData && (
                  <>
                    <img src={qrCodeData} alt="QR Code" style={{ width: "100px", height: "100px" }} />
                    <span style={{ fontSize: "10px", color: "#64748b", marginTop: "5px", textAlign: "center" }}>Scan to Verify<br/>التحقق المرجعي</span>
                  </>
                )}
              </div>
            </div>

            {/* Approved Amount Box */}
            <div style={{ backgroundColor: "#16a34a", color: "white", padding: "15px 20px", marginTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold" }}>(Approved Amount) المبلغ المعتمد</span>
              <span style={{ fontSize: "24px", fontWeight: "900" }}>EGP {printLoan.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={{ textAlign: "right", fontSize: "13px", marginTop: "8px", color: "#475569", fontWeight: "500", direction: "rtl", display: "flex", justifyContent: "space-between" }}>
              <span>
                {printLoan.maxAllowedAmount && (
                  <span>% النسبة المعتمدة من الحد الأقصى: {Math.round((printLoan.amount / printLoan.maxAllowedAmount) * 100)}</span>
                )}
              </span>
              <span style={{ fontWeight: "bold" }}>
                فقط وقدره: {numberToArabicWords(printLoan.amount)} جنيهاً مصرياً لا غير
              </span>
            </div>

            {/* Values Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
              <thead>
                <tr style={{ backgroundColor: "#16a34a", color: "white", fontSize: "13px" }}>
                  <th style={{ padding: "10px", textAlign: "center", fontWeight: "bold" }}>البند</th>
                  <th style={{ padding: "10px", textAlign: "center", width: "180px", fontWeight: "bold" }}>القيمة</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  <td style={{ padding: "12px", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>المبلغ المطلوب</td>
                  <td style={{ padding: "12px", textAlign: "center", borderBottom: "1px solid #e2e8f0", fontWeight: "bold", color: "#0f172a" }}>
                    EGP {printLoan.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "12px", textAlign: "center", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f0fdf4" }}>المبلغ المعتمد</td>
                  <td style={{ padding: "12px", textAlign: "center", borderBottom: "1px solid #e2e8f0", fontWeight: "bold", color: "#16a34a", backgroundColor: "#f0fdf4" }}>
                    EGP {printLoan.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  <td style={{ padding: "12px", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>الحد الأقصى المسموح</td>
                  <td style={{ padding: "12px", textAlign: "center", borderBottom: "1px solid #e2e8f0", fontWeight: "bold", color: "#0f172a" }}>
                    EGP {(printLoan.maxAllowedAmount || printLoan.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "12px", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>أيام العمل المحتسبة</td>
                  <td style={{ padding: "12px", textAlign: "center", borderBottom: "1px solid #e2e8f0", fontWeight: "bold", color: "#0f172a" }}>
                    يوم {printLoan.daysWorkedAtRequest || "-"}
                  </td>
                </tr>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  <td style={{ padding: "12px", textAlign: "center", borderBottom: "1px solid #e2e8f0", color: "#3b82f6" }}>Loan Reason</td>
                  <td style={{ padding: "12px", textAlign: "center", borderBottom: "1px solid #e2e8f0", fontWeight: "bold", color: "#3b82f6" }}>سبب الطلب</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ padding: "12px", textAlign: "center", fontWeight: "500", color: "#0f172a" }}>
                    {printLoan.reason}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Terms */}
            <div style={{ marginTop: "30px", borderTop: "2px solid #e2e8f0", paddingTop: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#be123c", fontWeight: "bold", marginBottom: "12px" }}>
                <span>Terms & Repayment</span>
                <span>الشروط وجدول السداد</span>
              </div>
              <ol style={{ direction: "rtl", textAlign: "right", margin: 0, paddingRight: "20px", color: "#334155", fontSize: "13px", lineHeight: "2" }}>
                <li>سيتم خصم الأقساط تلقائياً من الراتب الشهري دون فوائد إضافية.</li>
                <li>يمكن للموظف السداد المبكر أو الجزئي في أي وقت دون غرامة.</li>
                <li>في حال انتهاء الخدمة، يتم خصم الرصيد المتبقي من المستحقات النهائية.</li>
                <li>تسري جميع الشروط وفق سياسات الشركة وقانون العمل المصري.</li>
              </ol>

              <div style={{ display: "flex", justifyContent: "space-between", color: "#3b82f6", fontWeight: "bold", marginTop: "20px", marginBottom: "8px" }}>
                <span>English Summary</span>
                <span>English Summary</span>
              </div>
              <p style={{ margin: 0, color: "#334155", fontSize: "12px", lineHeight: "1.6" }}>
                Loan request approved for EGP {printLoan.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (ratio {printLoan.maxAllowedAmount ? Math.round((printLoan.amount / printLoan.maxAllowedAmount) * 100) : 100}% of allowance).<br/>
                Repayments will be deducted from payroll with zero interest and early settlement is allowed without penalties.
              </p>
            </div>

            {/* SIGNATURES BOX */}
            <div style={{ position: "absolute", bottom: "30px", left: "20px", right: "20px", display: "flex", justifyContent: "space-between", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "20px", backgroundColor: "#f8fafc" }}>
              <div style={{ width: "30%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#475569", fontWeight: "bold", marginBottom: "50px" }}>
                  <span>Finance Manager</span>
                  <span>مدير مالية</span>
                </div>
                <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
              </div>
              <div style={{ width: "30%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#475569", fontWeight: "bold", marginBottom: "50px" }}>
                  <span>HR Manager</span>
                  <span>مدير الموارد البشرية</span>
                </div>
                <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
              </div>
              <div style={{ width: "30%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#475569", fontWeight: "bold", marginBottom: "50px" }}>
                  <span>Employee Sign</span>
                  <span>توقيع الموظف</span>
                </div>
                <div style={{ borderBottom: "1px solid #94a3b8" }}></div>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
