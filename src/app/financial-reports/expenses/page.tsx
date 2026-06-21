"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { ArrowLeft, Wallet, PlusCircle, FileText, Calendar, Trash2, Tag, Building, Zap, Users, Shield, Package, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { vibrateSuccess, vibrateError } from "@/lib/haptics";
import { NumericFormat } from "react-number-format";

const EXPENSE_CATEGORIES = [
  { id: "cogs", label: "Cost of Goods Sold (Inventory)", icon: Package, color: "text-amber-500 bg-amber-500/10" },
  { id: "rent", label: "Store Rent", icon: Building, color: "text-indigo-500 bg-indigo-500/10" },
  { id: "house_rent", label: "Employee Housing Rent", icon: LayoutGrid, color: "text-violet-500 bg-violet-500/10" },
  { id: "utilities", label: "Utilities (Electricity, Water)", icon: Zap, color: "text-yellow-500 bg-yellow-500/10" },
  { id: "payroll", label: "Payroll & Wages", icon: Users, color: "text-emerald-500 bg-emerald-500/10" },
  { id: "taxes", label: "Taxes & Fees", icon: Shield, color: "text-rose-500 bg-rose-500/10" },
  { id: "maintenance", label: "Maintenance & Repairs", icon: Wallet, color: "text-cyan-500 bg-cyan-500/10" },
  { id: "misc", label: "Miscellaneous", icon: Tag, color: "text-slate-500 bg-slate-500/10" }
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("misc");
  const [subCategory, setSubCategory] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const q = query(collection(db, "expenses"), orderBy("date", "desc"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      vibrateError();
      alert("Please enter a valid amount.");
      return;
    }

    setSubmitting(true);
    try {
      let createdBy = "Unknown Admin";
      const sessionStr = localStorage.getItem("active_cashier_session");
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        createdBy = session.email || session.name || "Unknown Admin";
      }

      await addDoc(collection(db, "expenses"), {
        date,
        amount: Number(amount),
        category,
        subCategory: subCategory.trim(),
        notes: notes.trim(),
        createdBy,
        createdAt: new Date().toISOString()
      });

      setAmount("");
      setSubCategory("");
      setNotes("");
      vibrateSuccess();
      alert("Expense logged successfully!");
    } catch (error) {
      vibrateError();
      console.error("Error adding expense:", error);
      alert("Failed to log expense.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense record?")) return;
    try {
      await deleteDoc(doc(db, "expenses", id));
    } catch (error) {
      console.error("Error deleting expense:", error);
      alert("Failed to delete record.");
    }
  };

  const getCategoryDetails = (catId: string) => {
    return EXPENSE_CATEGORIES.find(c => c.id === catId) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100">
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/financial-reports" className="flex items-center gap-1 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <span className="font-bold text-sm">Back</span>
            </Link>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-500" />
                Expense & Payout Logger
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Add Expense Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <PlusCircle className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-black uppercase tracking-wider">Log New Expense</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Date incurred</label>
                <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-bold" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Amount (EGP)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 z-10">EGP</span>
                  <NumericFormat 
                    required 
                    value={amount} 
                    onValueChange={(values) => setAmount(values.value)} 
                    thousandSeparator=","
                    allowNegative={false}
                    decimalScale={2}
                    fixedDecimalScale={true}
                    className="w-full pl-12 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-lg font-black" 
                    placeholder="0.00" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-bold appearance-none cursor-pointer">
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Sub-Category / Vendor (Optional)</label>
                <input type="text" value={subCategory} onChange={e => setSubCategory(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-bold" placeholder="e.g. Edita, Electric Bill #123" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Internal Notes</label>
                <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm" placeholder="Any additional details..."></textarea>
              </div>

              <button type="submit" disabled={submitting} className={`w-full py-3.5 mt-2 ${submitting ? 'bg-slate-500 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] cursor-pointer'} text-white rounded-xl font-black uppercase tracking-wider text-sm shadow-lg shadow-emerald-500/20 transition-all`}>
                {submitting ? "Submitting..." : "Log Expense Record"}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Recent Expenses */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-black">Recent Logs</h2>
            <div className="text-sm font-bold text-slate-400">
              Total this month: EGP {
                expenses.filter(e => e.date.startsWith(new Date().toISOString().substring(0, 7))).reduce((sum, e) => sum + e.amount, 0).toLocaleString()
              }
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500"></div></div>
          ) : expenses.length === 0 ? (
            <div className="bg-white/50 dark:bg-slate-900/50 rounded-3xl p-12 text-center border border-dashed border-slate-300 dark:border-slate-700">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-500">No expenses logged yet.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
              {expenses.map((expense) => {
                const catInfo = getCategoryDetails(expense.category);
                const Icon = catInfo.icon;
                return (
                  <div key={expense.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${catInfo.color}`}>
                        <Icon className="h-5 w-5" strokeWidth={2.5} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-black text-slate-800 dark:text-white">{catInfo.label}</span>
                          {expense.subCategory && (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md">
                              {expense.subCategory}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                          <Calendar className="h-3 w-3" /> {expense.date} • Logged by {expense.createdBy.split('@')[0]}
                        </div>
                        {expense.notes && (
                          <p className="text-xs text-slate-500 mt-1 italic">"{expense.notes}"</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-lg font-black text-red-600 dark:text-red-400">
                        -EGP {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <button onClick={() => handleDelete(expense.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
