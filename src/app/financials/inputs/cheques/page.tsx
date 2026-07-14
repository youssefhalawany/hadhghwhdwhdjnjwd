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
  updateDoc
} from "firebase/firestore";
import { 
  Plus, 
  Trash2, 
  Download,
  Loader2,
  X,
  Printer,
  ChevronDown
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";

export default function ChequesPage() {
  const { currentBranch } = useBranch();
  const [cheques, setCheques] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newCheque, setNewCheque] = useState({
    bankName: "",
    chequeNumber: "",
    chequeDate: new Date().toISOString().substring(0, 10),
    amount: "",
    receiverName: "",
    receiverCompanyName: "",
    nationalId: ""
  });
  
  const [selectedForPrint, setSelectedForPrint] = useState<any>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    setLoading(true);
    let q = collection(db, "cheques") as any;



    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      let data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      if (currentBranch && currentBranch !== "all") {
        data = data.filter((item: any) => {
          const bId = (item as any).storeId?.toLowerCase() || "";
          let itemBranch = "alamein4"; 
          if (bId.includes("ola") || bId.includes("koronfol")) itemBranch = "ola";
          return itemBranch === currentBranch;
        });
      }

      data.sort((a: any, b: any) => new Date(b.chequeDate).getTime() - new Date(a.chequeDate).getTime());

      setCheques(data);
      setLoading(false);
    }, (err: any) => {
      console.error(err);
      toast.error("Failed to load cheques");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentBranch]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheque.amount || isNaN(Number(newCheque.amount)) || Number(newCheque.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      const bId = currentBranch === "all" ? "alamein4" : currentBranch;
      const storeId = bId === "ola" ? "ola" : "eL-alamein-4";

      const chequeData = {
        amount: Number(newCheque.amount),
        bankName: newCheque.bankName,
        chequeDate: newCheque.chequeDate,
        chequeNumber: newCheque.chequeNumber,
        receiverName: newCheque.receiverName,
        receiverCompanyName: newCheque.receiverCompanyName,
        nationalId: newCheque.nationalId,
        status: "issued", // Default
        storeId,
        createdAt: serverTimestamp(),
        createdBy: user?.email || "unknown",
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "cheques"), chequeData);

      toast.success("Cheque added successfully!");
      setShowAddModal(false);
      
      const savedCheque = { id: docRef.id, ...chequeData, createdAt: new Date() };
      
      setNewCheque({
        bankName: "",
        chequeNumber: "",
        chequeDate: new Date().toISOString().substring(0, 10),
        amount: "",
        receiverName: "",
        receiverCompanyName: "",
        nationalId: ""
      });
      
      setSelectedForPrint(savedCheque);
      setTimeout(() => generatePDF(), 500);
      
    } catch (err) {
      console.error(err);
      toast.error("Error adding cheque");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "cheques", id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success("Status updated");
    } catch (err) {
      console.error(err);
      toast.error("Error updating status");
    }
  };

  const generatePDF = async () => {
    setGeneratingPDF(true);
    try {
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const page = document.getElementById("pdf-cheque-slip");
      
      if (page) {
        const canvas = await html2canvas(page, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL("image/png");
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      }

      pdf.autoPrint();
      window.open(pdf.output("bloburl"), "_blank");
      setSelectedForPrint(null);
    } catch (error) {
      console.error("PDF ERROR:", error);
      toast.error("Failed to generate PDF.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cheque?")) return;
    try {
      await deleteDoc(doc(db, "cheques", id));
      toast.success("Cheque deleted");
    } catch (err) {
      console.error(err);
      toast.error("Error deleting cheque");
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const getBranchName = (bId: string) => {
    if (!bId) return "El Alamein 4";
    if (bId.toLowerCase().includes("ola")) return "Ola";
    return "El Alamein 4";
  };

  // Summaries
  const issuedCheques = cheques.filter(c => c.status === "issued");
  const clearedCheques = cheques.filter(c => c.status === "cleared");
  const cancelledCheques = cheques.filter(c => c.status === "cancelled");
  
  const issuedValue = issuedCheques.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const clearedValue = clearedCheques.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const cancelledValue = cancelledCheques.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const totalValue = cheques.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  
  const clearanceRate = cheques.length > 0 ? Math.round((clearedCheques.length / cheques.length) * 100) : 0;
  const uniqueBanks = new Set(cheques.map(c => c.bankName)).size;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-card border border-border shadow-sm p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">

        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={18} /> Add Cheques
          </button>
          <button className="flex-1 sm:flex-none px-4 py-2 border border-border rounded-lg text-sm font-bold hover:bg-muted text-foreground flex items-center justify-center gap-2">
            <Download size={18} /> Export Cheques
          </button>
          <button className="flex-1 sm:flex-none px-4 py-2 border border-border rounded-lg text-sm font-bold hover:bg-muted text-foreground flex items-center justify-center gap-2">
            <Download size={18} /> Export All
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800">
          <p className="text-xs font-bold text-blue-600/70 dark:text-blue-400/70 mb-1">Issued</p>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300">EGP {formatMoney(issuedValue)}</p>
          <p className="text-xs font-semibold text-blue-600/60 dark:text-blue-400/60 mt-1">{issuedCheques.length} cheques</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800">
          <p className="text-xs font-bold text-emerald-600/70 dark:text-emerald-400/70 mb-1">Clearance</p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{clearanceRate}%</p>
          <p className="text-xs font-semibold text-emerald-600/60 dark:text-emerald-400/60 mt-1">{clearedCheques.length} cleared</p>
        </div>
        <div className="bg-rose-50 dark:bg-rose-900/20 p-5 rounded-2xl border border-rose-100 dark:border-rose-800">
          <p className="text-xs font-bold text-rose-600/70 dark:text-rose-400/70 mb-1">Cancelled</p>
          <p className="text-2xl font-black text-rose-700 dark:text-rose-300">{cancelledCheques.length}</p>
          <p className="text-xs font-semibold text-rose-600/60 dark:text-rose-400/60 mt-1">EGP {formatMoney(cancelledValue)}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-2xl border border-purple-100 dark:border-purple-800">
          <p className="text-xs font-bold text-purple-600/70 dark:text-purple-400/70 mb-1">Banks</p>
          <p className="text-2xl font-black text-purple-700 dark:text-purple-300">{uniqueBanks}</p>
          <p className="text-xs font-semibold text-purple-600/60 dark:text-purple-400/60 mt-1">active</p>
        </div>
        <div className="bg-cyan-50 dark:bg-cyan-900/20 p-5 rounded-2xl border border-cyan-100 dark:border-cyan-800">
          <p className="text-xs font-bold text-cyan-600/70 dark:text-cyan-400/70 mb-1">Total Value</p>
          <p className="text-2xl font-black text-cyan-700 dark:text-cyan-300">EGP {formatMoney(totalValue)}</p>
          <p className="text-xs font-semibold text-cyan-600/60 dark:text-cyan-400/60 mt-1">{cheques.length} total</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="p-4 font-bold text-sm text-foreground">Date</th>
                <th className="p-4 font-bold text-sm text-foreground">Bank</th>
                <th className="p-4 font-bold text-sm text-foreground">Cheque #</th>
                <th className="p-4 font-bold text-sm text-foreground text-right">Amount</th>
                <th className="p-4 font-bold text-sm text-foreground">Receiver</th>
                <th className="p-4 font-bold text-sm text-foreground text-center">Status</th>
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
              ) : cheques.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                    No cheques found for this month.
                  </td>
                </tr>
              ) : (
                cheques.map((cheque) => (
                  <tr key={cheque.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-semibold text-sm">{cheque.chequeDate}</td>
                    <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{cheque.bankName}</td>
                    <td className="p-4 font-bold">{cheque.chequeNumber}</td>
                    <td className="p-4 text-right font-black text-slate-900 dark:text-slate-50">EGP {formatMoney(cheque.amount)}</td>
                    <td className="p-4 text-sm font-semibold">
                      <div className="flex flex-col">
                        <span className="text-slate-800 dark:text-slate-200">{cheque.receiverName}</span>
                        <span className="text-slate-500 text-xs">{cheque.receiverCompanyName}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <select 
                        value={cheque.status}
                        onChange={(e) => updateStatus(cheque.id, e.target.value)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full border appearance-none text-center cursor-pointer ${
                          cheque.status === 'cancelled' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                          cheque.status === 'cleared' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          'bg-blue-100 text-blue-700 border-blue-200'
                        }`}
                        style={{ paddingRight: '2rem', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '12px' }}
                      >
                        <option value="issued">Issued</option>
                        <option value="cleared">Cleared</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => {
                            setSelectedForPrint(cheque);
                            setTimeout(() => generatePDF(), 500);
                          }}
                          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Printer size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(cheque.id)}
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
          <div className="bg-card w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-border">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/50">
              <h2 className="text-xl font-black text-foreground">Add cheques</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Bank *</label>
                  <input 
                    type="text"
                    required
                    value={newCheque.bankName}
                    onChange={e => setNewCheque({...newCheque, bankName: e.target.value})}
                    className="w-full p-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Cheque # *</label>
                  <input 
                    type="text"
                    required
                    value={newCheque.chequeNumber}
                    onChange={e => setNewCheque({...newCheque, chequeNumber: e.target.value})}
                    className="w-full p-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Date</label>
                  <input 
                    type="date"
                    required
                    value={newCheque.chequeDate}
                    onChange={e => setNewCheque({...newCheque, chequeDate: e.target.value})}
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
                    value={newCheque.amount}
                    onChange={e => setNewCheque({...newCheque, amount: e.target.value})}
                    className="w-full p-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Receiver Name</label>
                  <input 
                    type="text"
                    required
                    value={newCheque.receiverName}
                    onChange={e => setNewCheque({...newCheque, receiverName: e.target.value})}
                    className="w-full p-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Receiver Company</label>
                  <input 
                    type="text"
                    required
                    value={newCheque.receiverCompanyName}
                    onChange={e => setNewCheque({...newCheque, receiverCompanyName: e.target.value})}
                    className="w-full p-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">National ID</label>
                <input 
                  type="text"
                  required
                  value={newCheque.nationalId}
                  onChange={e => setNewCheque({...newCheque, nationalId: e.target.value})}
                  className="w-full p-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-semibold tracking-widest"
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
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Save Cheque"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Print Receipt container */}
      {selectedForPrint && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div 
            id="pdf-cheque-slip" 
            style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'Arial, sans-serif' }}
          >
            <div style={{ padding: '60px', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #059669', paddingBottom: '24px', marginBottom: '40px' }}>
                <div>
                  <h1 style={{ fontSize: '36px', fontWeight: '900', margin: '0 0 8px 0', color: '#059669', textTransform: 'uppercase', letterSpacing: '1px' }}>Guarantee Cheque</h1>
                  <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '3px', margin: 0 }}>Official Financial Record</h2>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Cheque Number</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1e293b', fontFamily: 'monospace' }}>{selectedForPrint.chequeNumber}</p>
                </div>
              </div>

              {/* Company Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '48px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px', fontWeight: 'bold' }}>Company</p>
                  <p style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', margin: '0 0 4px 0' }}>El Masreya for Trade</p>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Branch: <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{getBranchName(selectedForPrint.storeId)}</span></p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px', fontWeight: 'bold' }}>Cheque Date</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 4px 0' }}>{selectedForPrint.chequeDate}</p>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Bank: <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{selectedForPrint.bankName}</span></p>
                </div>
              </div>

              {/* Transaction Details */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '32px', marginBottom: '40px' }}>
                <h3 style={{ fontSize: '14px', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '800', margin: '0 0 24px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>Receiver Details</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Receiver Company</p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{selectedForPrint.receiverCompanyName}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Receiver Name</p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{selectedForPrint.receiverName}</p>
                  </div>
                </div>

                <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px dashed #cbd5e1' }}>
                  <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>Receiver National ID</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0, letterSpacing: '2px', fontFamily: 'monospace' }}>{selectedForPrint.nationalId}</p>
                </div>
              </div>

              {/* Amount Box */}
              <div style={{ backgroundColor: '#059669', borderRadius: '12px', padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#d1fae5', textTransform: 'uppercase', letterSpacing: '2px' }}>Cheque Amount</span>
                <span style={{ fontSize: '36px', fontWeight: '900', color: '#ffffff' }}>EGP {formatMoney(selectedForPrint.amount)}</span>
              </div>

              {/* Legal Note */}
              <div style={{ marginBottom: '40px', padding: '16px', backgroundColor: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '0 8px 8px 0' }}>
                <p style={{ fontSize: '14px', color: '#b45309', margin: 0, fontWeight: '600', lineHeight: '1.5' }}>
                  This cheque is received solely as a guarantee cheque. A copy of the receiver's National ID must be attached with this document.
                </p>
              </div>

              {/* System Verification Stamp */}
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '20px' }}>
                <div style={{ border: '4px solid #16a34a', borderRadius: '8px', padding: '16px 32px', textAlign: 'center', transform: 'rotate(-2deg)' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '900', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '2px' }}>Approved & Saved</p>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#15803d', textTransform: 'uppercase', letterSpacing: '1px' }}>Recorded in Financial Database</p>
                </div>
              </div>

              {/* Footer */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px', marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Generated: <span style={{ fontWeight: 'bold', color: '#64748b' }}>{new Date(selectedForPrint.createdAt?.toDate ? selectedForPrint.createdAt.toDate() : selectedForPrint.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></p>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Secure Automated Receipt</p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
