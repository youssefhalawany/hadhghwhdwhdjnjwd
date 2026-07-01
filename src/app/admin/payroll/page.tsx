"use client";

import React, { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, getDocs, getDoc, updateDoc, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Plus, Check, X, ShieldAlert, DollarSign, Calendar, Save, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type PayrollRecord = {
  id?: string;
  bonus: number;
  createdAt: string;
  createdBy: string;
  days: number;
  deductions: number;
  employeeId: string;
  employeeName?: string; // transient for UI
  insurance: number;
  loanThisMonth: number;
  month: string;
  netPay: number;
  overtime: number;
  paymentMethod: "cash" | "visa" | "bank";
  postedToFinanceAt?: string | null;
  standardPay: number;
  storeId: string;
  appliedDeductionIds?: string[];
  appliedLoanIds?: string[];
};

export default function AdminPayrollPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<PayrollRecord[]>([]);
  const [paidLines, setPaidLines] = useState<PayrollRecord[]>([]);
  
  const [isAdding, setIsAdding] = useState(false);
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

    const unsubDrafts = onSnapshot(collection(db, "payroll_drafts"), (snap) => {
      setDrafts(snap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollRecord)).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
    });

    const unsubLines = onSnapshot(query(collection(db, "payroll_lines"), orderBy("createdAt", "desc")), (snap) => {
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
    } catch (err) {
      console.error("Error fetching deductions/loans", err);
    }

    return { totalDeductions, totalLoans, appliedDeductionIds, appliedLoanIds };
  };

  const handleEmpSelect = async (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    
    setSelectedEmp(emp);
    
    const d = new Date();
    // Default to previous month if day < 15, else current month
    if (d.getDate() < 15) d.setMonth(d.getMonth() - 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const { totalDeductions, totalLoans, appliedDeductionIds, appliedLoanIds } = await fetchEmployeeDeductionsAndLoans(emp.id, monthStr);

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
      overtime: 0,
      paymentMethod: "cash",
    });
  };

  const handleMonthChange = async (newMonth: string) => {
    setEditForm({ ...editForm, month: newMonth });
    if (selectedEmp) {
      const { totalDeductions, totalLoans, appliedDeductionIds, appliedLoanIds } = await fetchEmployeeDeductionsAndLoans(selectedEmp.id, newMonth);
      setEditForm(prev => ({
        ...prev,
        month: newMonth,
        deductions: totalDeductions,
        loanThisMonth: totalLoans,
        appliedDeductionIds,
        appliedLoanIds,
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

  const handleSaveDraft = async () => {
    if (!selectedEmp || !editForm.employeeId) {
      toast.error("Please select an employee");
      return;
    }

    const { standardPay, netPay } = calcPays();

    const record: PayrollRecord = {
      bonus: Number(editForm.bonus) || 0,
      createdAt: new Date().toLocaleString('en-GB', { timeZone: 'Africa/Cairo' }),
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
      appliedLoanIds: editForm.appliedLoanIds || []
    };

    try {
      await addDoc(collection(db, "payroll_drafts"), record);
      toast.success("Saved as Unpaid Draft");
      setIsAdding(false);
      setSelectedEmp(null);
    } catch (err: any) {
      toast.error("Failed to save draft: " + err.message);
    }
  };

  const markAsPaid = async (draft: PayrollRecord) => {
    if (!confirm(`Mark payroll for ${employees.find(e => e.id === draft.employeeId)?.name || 'Employee'} as PAID?`)) return;

    try {
      // Create in payroll_lines
      const finalRecord = { ...draft };
      delete finalRecord.id;
      finalRecord.postedToFinanceAt = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Cairo' });
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

      // Delete from drafts
      if (draft.id) {
        await deleteDoc(doc(db, "payroll_drafts", draft.id));
      }
      
      toast.success("Payroll Marked as Paid and posted to Finance");
    } catch (err: any) {
      toast.error("Failed to mark as paid: " + err.message);
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

  const { standardPay, netPay } = calcPays();

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <DollarSign className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              Payroll System
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Process salaries, bonuses, and deductions securely.</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> New Payroll Run
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-6 shadow-xl shadow-indigo-100/20 dark:shadow-none animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" /> Draft New Payroll
            </h2>
            <button onClick={() => { setIsAdding(false); setSelectedEmp(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</label>
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Month</label>
                  <input 
                    type="month" 
                    value={editForm.month}
                    onChange={e => handleMonthChange(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Base Salary (Info)</label>
                  <div className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-500">
                    {(Number(selectedEmp.baseSalary) || Number(selectedEmp.salary) || 3000).toLocaleString()} EGP
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Days Worked</label>
                  <input 
                    type="number" 
                    value={editForm.days}
                    onChange={e => setEditForm({...editForm, days: Number(e.target.value)})}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-800 rounded-xl text-sm font-bold text-indigo-700 dark:text-indigo-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overtime (EGP)</label>
                  <input 
                    type="number" 
                    value={editForm.overtime}
                    onChange={e => setEditForm({...editForm, overtime: Number(e.target.value)})}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bonus (EGP)</label>
                  <input 
                    type="number" 
                    value={editForm.bonus}
                    onChange={e => setEditForm({...editForm, bonus: Number(e.target.value)})}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deductions (EGP)</label>
                  <input 
                    type="number" 
                    value={editForm.deductions}
                    onChange={e => setEditForm({...editForm, deductions: Number(e.target.value)})}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loan Repayment (EGP)</label>
                  <input 
                    type="number" 
                    value={editForm.loanThisMonth}
                    onChange={e => setEditForm({...editForm, loanThisMonth: Number(e.target.value)})}
                    className="w-full p-2.5 bg-white dark:bg-slate-950 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Insurance (EGP)</label>
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
                      <Save className="w-5 h-5" /> Save as Draft (Unpaid)
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DRAFTS */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
          Unpaid Drafts ({drafts.length})
        </h2>
        
        {drafts.length === 0 ? (
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
                  {drafts.map(d => {
                    const emp = employees.find(e => e.id === d.employeeId);
                    return (
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{emp?.name || d.employeeId}</td>
                        <td className="px-4 py-3 font-mono text-xs">{d.month}</td>
                        <td className="px-4 py-3">{d.days}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{(d.standardPay || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{(d.netPay || 0).toLocaleString()} EGP</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => deleteDraft(d.id!)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                              title="Delete Draft"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => markAsPaid(d)}
                              className="px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {paidLines.map((d, i) => {
                  const emp = employees.find(e => e.id === d.employeeId);
                  return (
                    <tr key={d.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-300">{emp?.name || d.employeeId}</td>
                      <td className="px-4 py-3 font-mono text-xs">{d.month}</td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{(d.netPay || 0).toLocaleString()} EGP</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{d.postedToFinanceAt}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{d.createdBy}</td>
                    </tr>
                  );
                })}
                {paidLines.length === 0 && (
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
  );
}
