"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy
} from "firebase/firestore";
import {
  Plus,
  Trash2,
  CheckCircle2,
  CircleDashed,
  FileText,
  Loader2,
  X,
  Printer,
  Search,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import { useBranch } from "@/context/BranchContext";

interface TmtInvoice {
  id: string;
  date: string;
  poNumber: string;
  source: string;
  status: "paid" | "unpaid";
  storeId: string;
  createdAt: any;
  createdBy: string;
}

const SOURCES = ["TMT Food", "TMT Warehouse"];

export default function TmtInvoicesPage() {
  const { currentBranch } = useBranch();
  const [invoices, setInvoices] = useState<TmtInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [monthFilter, setMonthFilter] = useState(
    new Date().toISOString().substring(0, 7)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [newInvoice, setNewInvoice] = useState({
    date: new Date().toISOString().split("T")[0],
    source: "TMT Food",
    poNumber: ""
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return () => unsub();
  }, []);

  useEffect(() => {
    setLoading(true);

    let q: any = collection(db, "tmt_invoices");

    if (monthFilter) {
      const start = monthFilter + "-01";
      const end = monthFilter + "-31";
      q = query(q, where("date", ">=", start), where("date", "<=", end));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot: any) => {
        let data: TmtInvoice[] = snapshot.docs.map((d: any) => ({
          id: d.id,
          ...d.data()
        }));

        // Branch filtering
        if (currentBranch && currentBranch !== "all") {
          data = data.filter((item) => {
            const sid = item.storeId?.toLowerCase() || "";
            const itemBranch = sid.includes("ola") || sid.includes("koronfol") ? "ola" : "alamein4";
            return itemBranch === currentBranch;
          });
        }

        data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setInvoices(data);
        setLoading(false);
      },
      (err: any) => {
        console.error(err);
        toast.error("Failed to load TMT invoices");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [monthFilter, currentBranch]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoice.poNumber.trim()) {
      toast.error("PO Number is required");
      return;
    }
    setIsSubmitting(true);
    try {
      const bId = currentBranch === "all" ? "alamein4" : currentBranch;
      const storeId = bId === "ola" ? "ola" : "eL-alamein-4";

      await addDoc(collection(db, "tmt_invoices"), {
        date: newInvoice.date,
        source: newInvoice.source,
        poNumber: newInvoice.poNumber.trim(),
        status: "unpaid",
        storeId,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "unknown"
      });

      toast.success("Invoice added!");
      setShowAddModal(false);
      setNewInvoice({
        date: new Date().toISOString().split("T")[0],
        source: "TMT Food",
        poNumber: ""
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to add invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (invoice: TmtInvoice) => {
    setTogglingId(invoice.id);
    try {
      const newStatus = invoice.status === "paid" ? "unpaid" : "paid";
      await updateDoc(doc(db, "tmt_invoices", invoice.id), { status: newStatus });
      toast.success(`Marked as ${newStatus}`);
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this invoice?")) return;
    try {
      await deleteDoc(doc(db, "tmt_invoices", id));
      toast.success("Invoice deleted");
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          inv.poNumber?.toLowerCase().includes(q) ||
          inv.source?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  const paidCount = invoices.filter((i) => i.status === "paid").length;
  const unpaidCount = invoices.filter((i) => i.status === "unpaid").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-6 w-6 text-rose-500" />
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-50">TMT Invoices</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track and manage warehouse invoices</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold shadow hover:bg-rose-700 transition"
        >
          <Plus size={18} /> Add Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total</p>
          <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{invoices.length}</p>
        </div>
        <div className="bg-card border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Paid</p>
          <p className="text-3xl font-black text-emerald-600">{paidCount}</p>
        </div>
        <div className="bg-card border border-red-200 dark:border-red-800 rounded-2xl p-5">
          <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Unpaid</p>
          <p className="text-3xl font-black text-red-500">{unpaidCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <Filter size={16} className="text-slate-400" />
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 flex-1">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search by PO number or source..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
          />
        </div>

        <div className="flex gap-2">
          {(["all", "paid", "unpaid"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all capitalize ${
                statusFilter === s
                  ? s === "paid"
                    ? "bg-emerald-500 text-white"
                    : s === "unpaid"
                    ? "bg-red-500 text-white"
                    : "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-card border border-border text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="animate-spin text-rose-500" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileText size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">No invoices found</p>
            <p className="text-sm">Try adjusting the filters or add a new invoice</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-border">
              <tr>
                <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-widest text-xs w-8">
                  <CircleDashed size={14} />
                </th>
                <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-widest text-xs">Date</th>
                <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-widest text-xs">PO Number</th>
                <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-widest text-xs">Source</th>
                <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-widest text-xs">Status</th>
                <th className="text-right p-4 font-bold text-slate-500 uppercase tracking-widest text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <button
                      onClick={() => handleToggleStatus(invoice)}
                      disabled={togglingId === invoice.id}
                      className="flex items-center justify-center"
                      title={invoice.status === "paid" ? "Mark as Unpaid" : "Mark as Paid"}
                    >
                      {togglingId === invoice.id ? (
                        <Loader2 size={20} className="animate-spin text-slate-400" />
                      ) : invoice.status === "paid" ? (
                        <CheckCircle2 size={20} className="text-emerald-500" />
                      ) : (
                        <CircleDashed size={20} className="text-slate-300 hover:text-emerald-400 transition-colors" />
                      )}
                    </button>
                  </td>
                  <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">{invoice.date}</td>
                  <td className="p-4 font-bold text-slate-900 dark:text-slate-50 font-mono">{invoice.poNumber}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      invoice.source?.toLowerCase().includes("food")
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    }`}>
                      {invoice.source}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleToggleStatus(invoice)}
                      disabled={togglingId === invoice.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        invoice.status === "paid"
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {invoice.status === "paid" ? (
                        <><CheckCircle2 size={12} /> Paid</>
                      ) : (
                        <><CircleDashed size={12} /> Unpaid</>
                      )}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(invoice.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Count badge */}
      {!loading && filtered.length > 0 && (
        <p className="text-center text-sm text-slate-400 font-medium">
          Showing {filtered.length} of {invoices.length} invoices this month
        </p>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">Add TMT Invoice</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Date *</label>
                <input
                  type="date"
                  required
                  value={newInvoice.date}
                  onChange={(e) => setNewInvoice({ ...newInvoice, date: e.target.value })}
                  className="w-full p-3 rounded-xl border border-border bg-background text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Source *</label>
                <select
                  value={newInvoice.source}
                  onChange={(e) => setNewInvoice({ ...newInvoice, source: e.target.value })}
                  className="w-full p-3 rounded-xl border border-border bg-background text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">PO Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PO-12345"
                  value={newInvoice.poNumber}
                  onChange={(e) => setNewInvoice({ ...newInvoice, poNumber: e.target.value })}
                  className="w-full p-3 rounded-xl border border-border bg-background text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 outline-none font-mono"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 border border-border rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  + Save Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
