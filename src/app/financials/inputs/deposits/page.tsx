"use client";

import React, { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy
} from "firebase/firestore";
import { 
  Plus, 
  Trash2, 
  Banknote, 
  User, 
  Building2, 
  Vault, 
  ArrowRight,
  Download,
  Activity,
  AlertTriangle,
  Loader2,
  X,
  Printer
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import ExportFinancialsModal from "@/components/ExportFinancialsModal";

export default function DepositsPage() {
  const { currentBranch } = useBranch();
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"day" | "month" | "year" | "all">("month");
  const [filterValue, setFilterValue] = useState(new Date().toISOString().substring(0, 10));
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDeposit, setNewDeposit] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: "",
    from: "safe",
    to: "bank",
    note: "",
    ownerName: ""
  });
  
  const [selectedDepositForPrint, setSelectedDepositForPrint] = useState<any>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    if (!filterValue && filterType !== "all") return;
    setLoading(true);
    let q = collection(db, "deposits") as any;

    if (filterType === "day" && filterValue) {
      q = query(q, where("date", "==", filterValue));
    } else if (filterType === "month" && filterValue) {
      const monthPrefix = filterValue.substring(0, 7);
      const startOfMonth = monthPrefix + "-01";
      const endOfMonth = monthPrefix + "-31";
      q = query(q, where("date", ">=", startOfMonth), where("date", "<=", endOfMonth));
    } else if (filterType === "year" && filterValue) {
      const year = filterValue.substring(0, 4);
      const startOfYear = year + "-01-01";
      const endOfYear = year + "-12-31";
      q = query(q, where("date", ">=", startOfYear), where("date", "<=", endOfYear));
    }

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      let data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      // Client-side filtering for branch (handling older records fallback)
      if (currentBranch && currentBranch !== "all") {
        data = data.filter((item: any) => {
          const bId = (item as any).storeId?.toLowerCase() || "";
          let itemBranch = "alamein4"; 
          if (bId.includes("ola") || bId.includes("koronfol")) itemBranch = "ola";
          return itemBranch === currentBranch;
        });
      }

      // Client-side sorting because we removed orderBy from query to avoid missing composite index
      data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setDeposits(data);
      setLoading(false);
    }, (err: any) => {
      console.error(err);
      toast.error("Failed to load deposits");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filterType, filterValue, currentBranch]);

  const handleAddDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeposit.amount || isNaN(Number(newDeposit.amount)) || Number(newDeposit.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (newDeposit.from === newDeposit.to) {
      toast.error("Origin and destination cannot be the same");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      const bId = currentBranch === "all" ? "alamein4" : currentBranch;
      const storeId = bId === "ola" ? "ola" : "eL-alamein-4"; // map back to db format

      const depositData = {
        amount: Number(newDeposit.amount),
        date: newDeposit.date,
        from: newDeposit.from,
        to: newDeposit.to,
        note: newDeposit.note,
        ownerName: (newDeposit.from === "owner" || newDeposit.to === "owner") ? newDeposit.ownerName : "",
        storeId,
        createdAt: serverTimestamp(),
        createdBy: user?.email || "unknown"
      };

      const docRef = await addDoc(collection(db, "deposits"), depositData);

      toast.success("Deposit added successfully!");
      setShowAddModal(false);
      
      const savedDeposit = { id: docRef.id, ...depositData, createdAt: new Date() };
      
      setNewDeposit({
        date: new Date().toISOString().split('T')[0],
        amount: "",
        from: "safe",
        to: "bank",
        note: "",
        ownerName: ""
      });
      
      // Auto Print
      setSelectedDepositForPrint(savedDeposit);
      setTimeout(() => generatePDF(), 500);
      
    } catch (err) {
      console.error(err);
      toast.error("Error adding deposit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = async () => {
    setGeneratingPDF(true);
    const page = document.getElementById("pdf-deposit-slip");
    try {
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      if (page) {
        const canvas = await html2canvas(page, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL("image/png");
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      }

      pdf.autoPrint();
      window.open(pdf.output("bloburl"), "_blank");
      setSelectedDepositForPrint(null);
    } catch (error) {
      toast.error("Failed to generate PDF.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this deposit?")) return;
    try {
      await deleteDoc(doc(db, "deposits", id));
      toast.success("Deposit deleted");
    } catch (err) {
      console.error(err);
      toast.error("Error deleting deposit");
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const totalDeposited = deposits.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const avgDeposit = deposits.length ? totalDeposited / deposits.length : 0;
  const maxDeposit = deposits.reduce((max, d) => Math.max(max, Number(d.amount || 0)), 0);

  // Group unique flows
  const flowSet = new Set(deposits.map(d => `${d.from}-${d.to}`));
  const uniqueFlows = Array.from(flowSet).map(flow => {
    const [from, to] = flow.split('-');
    return { from, to, count: deposits.filter(d => d.from === from && d.to === to).length };
  });

  const getEntityIcon = (entity: string, size = 18) => {
    switch (entity) {
      case "safe": return <Vault size={size} />;
      case "owner": return <User size={size} />;
      case "bank": return <Building2 size={size} />;
      default: return <Banknote size={size} />;
    }
  };

  const getEntityName = (entity: string) => {
    switch (entity) {
      case "safe": return "Safe";
      case "owner": return "Owner";
      case "bank": return "Bank";
      default: return entity;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-card border border-border shadow-sm p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <select 
            value={filterType}
            onChange={(e: any) => setFilterType(e.target.value)}
            className="p-3 bg-muted border border-border rounded-xl font-bold text-sm text-foreground focus:ring-2 focus:ring-slate-500 outline-none"
          >
            <option value="day">Daily</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
            <option value="all">All Time</option>
          </select>

          {filterType === "day" && (
            <input 
              type="date" 
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="w-full sm:w-auto p-3 bg-muted border border-border rounded-xl font-bold text-lg text-foreground focus:ring-2 focus:ring-slate-500 outline-none"
            />
          )}

          {filterType === "month" && (
            <input 
              type="month" 
              value={filterValue.substring(0, 7)}
              onChange={(e) => setFilterValue(e.target.value + "-01")}
              className="w-full sm:w-auto p-3 bg-muted border border-border rounded-xl font-bold text-lg text-foreground focus:ring-2 focus:ring-slate-500 outline-none"
            />
          )}

          {filterType === "year" && (
            <input 
              type="number" 
              min="2020" max="2100"
              value={filterValue.substring(0, 4)}
              onChange={(e) => setFilterValue(e.target.value + "-01-01")}
              className="w-full sm:w-auto p-3 bg-muted border border-border rounded-xl font-bold text-lg text-foreground focus:ring-2 focus:ring-slate-500 outline-none"
            />
          )}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={18} /> Add Deposits
          </button>
          <button 
            onClick={() => setShowExportModal(true)}
            className="flex-1 sm:flex-none px-4 py-2 border border-border rounded-lg text-sm font-bold hover:bg-muted text-foreground flex items-center justify-center gap-2"
          >
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-sky-50 dark:bg-sky-900/20 p-5 rounded-2xl border border-sky-100 dark:border-sky-800">
          <p className="text-xs font-bold text-sky-600/70 dark:text-sky-400/70 mb-1">Total Deposited</p>
          <p className="text-2xl font-black text-sky-700 dark:text-sky-300">EGP {formatMoney(totalDeposited)}</p>
          <p className="text-xs font-semibold text-sky-600/60 dark:text-sky-400/60 mt-1">{deposits.length} transactions</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800">
          <p className="text-xs font-bold text-blue-600/70 dark:text-blue-400/70 mb-1">Average Deposit</p>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300">EGP {formatMoney(avgDeposit)}</p>
          <p className="text-xs font-semibold text-blue-600/60 dark:text-blue-400/60 mt-1">per transaction</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-2xl border border-purple-100 dark:border-purple-800">
          <p className="text-xs font-bold text-purple-600/70 dark:text-purple-400/70 mb-1">Largest</p>
          <p className="text-2xl font-black text-purple-700 dark:text-purple-300">EGP {formatMoney(maxDeposit)}</p>
          <p className="text-xs font-semibold text-purple-600/60 dark:text-purple-400/60 mt-1">single deposit</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-2xl border border-amber-100 dark:border-amber-800">
          <p className="text-xs font-bold text-amber-600/70 dark:text-amber-400/70 mb-1">Flow Types</p>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{uniqueFlows.length}</p>
          <p className="text-xs font-semibold text-amber-600/60 dark:text-amber-400/60 mt-1">active paths</p>
        </div>
      </div>

      {/* Flow Summary Badges */}
      {uniqueFlows.length > 0 && (
        <div className="flex items-center gap-3 text-sm font-bold">
          <span className="text-slate-500">All Flows ({deposits.length})</span>
          {uniqueFlows.map((flow, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {getEntityIcon(flow.from, 14)} <ArrowRight size={14} /> {getEntityIcon(flow.to, 14)} 
              <span className="ml-1 text-slate-900 dark:text-slate-100">{flow.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="p-4 font-bold text-sm text-foreground">Date</th>
                <th className="p-4 font-bold text-sm text-foreground">Flow</th>
                <th className="p-4 font-bold text-sm text-foreground">From</th>
                <th className="p-4 font-bold text-sm text-foreground">To</th>
                <th className="p-4 font-bold text-sm text-foreground text-right">Amount</th>
                <th className="p-4 font-bold text-sm text-foreground">Note</th>
                <th className="p-4 font-bold text-sm text-foreground text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : deposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                    No deposits found for this month.
                  </td>
                </tr>
              ) : (
                deposits.map((deposit) => (
                  <tr key={deposit.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-semibold text-sm">{deposit.date}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        {getEntityIcon(deposit.from)}
                        <ArrowRight size={14} />
                        {getEntityIcon(deposit.to)}
                      </div>
                    </td>
                    <td className="p-4 font-bold capitalize">{getEntityName(deposit.from)}</td>
                    <td className="p-4 font-bold capitalize">{getEntityName(deposit.to)}</td>
                    <td className="p-4 text-right font-black text-slate-900 dark:text-slate-50">EGP {formatMoney(deposit.amount)}</td>
                    <td className="p-4 text-sm text-slate-500">
                      {deposit.note}
                      {deposit.ownerName && <div className="text-xs font-bold text-slate-400 mt-1">Owner: {deposit.ownerName}</div>}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => {
                            setSelectedDepositForPrint(deposit);
                            setTimeout(() => generatePDF(), 500);
                          }}
                          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Printer size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(deposit.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-border">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/50">
              <h2 className="text-xl font-black text-foreground">Add deposits</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddDeposit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Date *</label>
                  <input 
                    type="date"
                    required
                    value={newDeposit.date}
                    onChange={e => setNewDeposit({...newDeposit, date: e.target.value})}
                    className="w-full p-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Amount *</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newDeposit.amount}
                    onChange={e => setNewDeposit({...newDeposit, amount: e.target.value})}
                    className="w-full p-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">From *</label>
                  <select 
                    value={newDeposit.from}
                    onChange={e => setNewDeposit({...newDeposit, from: e.target.value})}
                    className="w-full p-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-semibold capitalize"
                  >
                    <option value="safe">Safe</option>
                    <option value="owner">Owner</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">To *</label>
                  <select 
                    value={newDeposit.to}
                    onChange={e => setNewDeposit({...newDeposit, to: e.target.value})}
                    className="w-full p-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-semibold capitalize"
                  >
                    <option value="safe">Safe</option>
                    <option value="owner">Owner</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
              </div>

              {(newDeposit.from === "owner" || newDeposit.to === "owner") && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Owner Name *</label>
                  <input 
                    type="text"
                    required
                    value={newDeposit.ownerName}
                    onChange={e => setNewDeposit({...newDeposit, ownerName: e.target.value})}
                    className="w-full p-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Note</label>
                <textarea 
                  value={newDeposit.note}
                  onChange={e => setNewDeposit({...newDeposit, note: e.target.value})}
                  className="w-full p-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-rose-500 min-h-[100px] resize-none text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Save Deposit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Print Receipt container */}
      {selectedDepositForPrint && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div 
            id="pdf-deposit-slip" 
            style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'Arial, sans-serif' }}
          >
            <div style={{ padding: '60px', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1e293b', paddingBottom: '24px', marginBottom: '40px' }}>
                <div>
                  <h1 style={{ fontSize: '36px', fontWeight: '900', margin: '0 0 8px 0', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>Deposit Receipt</h1>
                  <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '3px', margin: 0 }}>Official Financial Record</h2>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Receipt ID</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1e293b', fontFamily: 'monospace' }}>{selectedDepositForPrint.id?.substring(0, 8).toUpperCase()}</p>
                </div>
              </div>

              {/* Company Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '48px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px', fontWeight: 'bold' }}>Company</p>
                  <p style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', margin: '0 0 4px 0' }}>El Masreya for Trade</p>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Branch: <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{currentBranch === "all" ? "El Alamein 4" : currentBranch === "ola" ? "Ola" : "El Alamein 4"}</span></p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px', fontWeight: 'bold' }}>Date & Time</p>
                  <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 4px 0' }}>{new Date(selectedDepositForPrint.createdAt?.toDate ? selectedDepositForPrint.createdAt.toDate() : selectedDepositForPrint.createdAt || Date.now()).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>{new Date(selectedDepositForPrint.createdAt?.toDate ? selectedDepositForPrint.createdAt.toDate() : selectedDepositForPrint.createdAt || Date.now()).toLocaleTimeString('en-US')}</p>
                </div>
              </div>

              {/* Transaction Details */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '32px', marginBottom: '40px' }}>
                <h3 style={{ fontSize: '14px', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '800', margin: '0 0 24px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>Transaction Details</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Transferred From</p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0, textTransform: 'capitalize' }}>{getEntityName(selectedDepositForPrint.from)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Transferred To</p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0, textTransform: 'capitalize' }}>{getEntityName(selectedDepositForPrint.to)}</p>
                  </div>
                </div>

                {selectedDepositForPrint.ownerName && (
                  <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px dashed #cbd5e1' }}>
                    <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Owner / Depositor Name</p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{selectedDepositForPrint.ownerName}</p>
                  </div>
                )}
              </div>

              {/* Amount Box */}
              <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Deposit Amount</span>
                <span style={{ fontSize: '36px', fontWeight: '900', color: '#ffffff' }}>EGP {formatMoney(selectedDepositForPrint.amount)}</span>
              </div>

              {/* Notes */}
              {selectedDepositForPrint.note && (
                <div style={{ marginBottom: '40px' }}>
                  <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Notes / Remarks</p>
                  <p style={{ fontSize: '16px', color: '#1e293b', margin: 0, lineHeight: '1.5' }}>{selectedDepositForPrint.note}</p>
                </div>
              )}

              {/* System Verification Stamp */}
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '40px' }}>
                <div style={{ border: '4px solid #16a34a', borderRadius: '8px', padding: '16px 32px', textAlign: 'center', transform: 'rotate(-2deg)' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '900', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '2px' }}>Approved & Saved</p>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#15803d', textTransform: 'uppercase', letterSpacing: '1px' }}>Recorded in Financial Database</p>
                </div>
              </div>

              {/* Footer */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px', marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Generated by: <span style={{ fontWeight: 'bold', color: '#64748b' }}>{selectedDepositForPrint.createdBy}</span></p>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Secure Automated Receipt</p>
              </div>

            </div>
          </div>
        </div>
      )}
      {/* Export Modal */}
      <ExportFinancialsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        currentTabName="Deposits"
        currentFilterType={filterType}
        currentFilterValue={filterValue}
        currentTabData={deposits}
        currentBranch={currentBranch}
      />
    </div>
  );
}
