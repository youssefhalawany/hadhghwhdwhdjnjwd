"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, updateDoc, doc } from "firebase/firestore";
import { CheckCircle, AlertTriangle, Printer, Calendar, Search, Package, Clock, ShieldCheck } from "lucide-react";
import QRCode from "react-qr-code";
import Link from "next/link";

export default function ExpiryAuditPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "reports">("pending");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "expiries"));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort by creation date descending
      data.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setItems(data);
    } catch (err) {
      console.error("Error fetching expiries:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAudit = async (item: any) => {
    setProcessing(item.id);
    try {
      const updatedQuantity = editingId === item.id ? editQuantity : item.quantity;
      const auditPayload = {
        status: "audited",
        quantity: updatedQuantity,
        auditedAt: new Date().toISOString(),
        auditedBy: localStorage.getItem("circlek_role") || "manager"
      };

      await updateDoc(doc(db, "expiries", item.id), auditPayload);
      
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...auditPayload } : i));
      setEditingId(null);
    } catch (err) {
      console.error("Error auditing item:", err);
      alert("Failed to audit item.");
    } finally {
      setProcessing(null);
    }
  };

  const pendingItems = items.filter(i => i.status === "pulled" && i.itemName.toLowerCase().includes(searchTerm.toLowerCase()));
  const auditedItems = items.filter(i => {
    if (i.status !== "audited" || !i.auditedAt) return false;
    const d = new Date(i.auditedAt);
    const itemMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return itemMonth === selectedMonth;
  });

  const totalAuditedQuantity = auditedItems.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);

  const [yearStr, monthStr] = selectedMonth.split('-');
  const monthName = new Date(Number(yearStr), Number(monthStr) - 1).toLocaleString('en-US', { month: 'long' });

  const generateQRData = () => {
    let text = `Damage & Expiry Audit Report\nPeriod: ${monthName} ${yearStr}\n`;
    text += `Total Items Destroyed/Audited: ${totalAuditedQuantity}\n\n`;
    text += `--- Item Breakdown ---\n`;
    auditedItems.forEach(i => {
      text += `${i.itemName} | Qty: ${i.quantity} | Barcode: ${i.barcode || "N/A"}\n`;
    });
    return text;
  };

  return (
    <div className="space-y-6 print:m-0 print:p-0 print:space-y-0">
      
      {/* --- PRINT ONLY A4 REPORT VIEW --- */}
      <div className="hidden print:block bg-white text-slate-900 w-full font-sans" style={{ width: '210mm', minHeight: '297mm', margin: '0 auto', boxSizing: 'border-box' }}>
        
        {/* Print Header */}
        <div className="border-b-4 border-slate-900 p-10 flex justify-between items-end bg-slate-50">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Damage & Expiry Audit</h1>
            <p className="text-2xl font-bold text-red-600 tracking-widest mt-1 uppercase">Official Report</p>
          </div>
          <div className="text-right">
            <div className="h-12 w-12 bg-slate-900 text-white rounded-full flex items-center justify-center font-black text-2xl ml-auto mb-2">K</div>
            <p className="font-bold text-sm text-slate-700">Circle K Enterprise</p>
            <p className="text-xs font-semibold text-slate-500">Period: {monthName} {yearStr}</p>
          </div>
        </div>

        {/* Print Summary */}
        <div className="p-10 border-b border-slate-200 bg-white">
          <div className="flex gap-10">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Items Processed</p>
              <p className="text-3xl font-black text-slate-900">{totalAuditedQuantity} <span className="text-base text-slate-500 font-bold">Units</span></p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Report Status</p>
              <p className="text-xl font-black text-emerald-600 flex items-center gap-2"><CheckCircle className="h-5 w-5"/> AUDITED & CLOSED</p>
            </div>
          </div>
        </div>

        {/* Print Table */}
        <div className="p-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Item Description</th>
                <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Barcode</th>
                <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Store / Origin</th>
                <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest text-right">Audited Qty</th>
              </tr>
            </thead>
            <tbody>
              {auditedItems.map(item => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="py-4 px-2 text-sm font-bold text-slate-900">{item.itemName}</td>
                  <td className="py-4 px-2 text-sm font-mono text-slate-600">{item.barcode || "-"}</td>
                  <td className="py-4 px-2 text-sm text-slate-600">{item.storeId || "Unknown Store"}</td>
                  <td className="py-4 px-2 text-base font-black text-slate-900 text-right">{item.quantity}</td>
                </tr>
              ))}
              {auditedItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-500 font-bold">No audited expiries for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Print Footer / Signatures */}
        <div className="mt-10 pt-10 border-t-2 border-slate-200 mx-10 pb-10 flex justify-between items-end">
          <div className="w-1/4">
            <div className="bg-white p-2 border border-slate-200 rounded-lg inline-block shadow-sm">
              <QRCode value={generateQRData()} size={80} level="L" />
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-2 text-center w-24">Scan for Summary</p>
          </div>
          <div className="w-1/3 border-t border-slate-400 pt-2 text-center">
            <p className="text-xs font-bold text-slate-600 uppercase">Inventory Manager</p>
            <p className="text-[10px] text-slate-400 mt-1">Signature & Date</p>
          </div>
          <div className="w-1/3 border-t border-slate-400 pt-2 text-center">
            <p className="text-xs font-bold text-slate-600 uppercase">Store Supervisor</p>
            <p className="text-[10px] text-slate-400 mt-1">Signature & Date</p>
          </div>
        </div>
      </div>
      {/* --- END PRINT VIEW --- */}


      {/* SCREEN UI */}
      <div className="print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-red-500" /> Damage & Expiry Audit
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Verify pulled items, adjust quantities, and generate destruction reports.</p>
          </div>
          
          <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
            <button 
              onClick={() => setActiveTab("pending")}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === "pending" ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
            >
              Pending Audits
              {pendingItems.length > 0 && <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">{pendingItems.length}</span>}
            </button>
            <button 
              onClick={() => setActiveTab("reports")}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === "reports" ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
            >
              Audit Reports
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div></div>
        ) : activeTab === "pending" ? (
          <div className="space-y-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search items by name..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:border-red-500 outline-none transition-colors"
              />
            </div>

            {pendingItems.length === 0 ? (
              <div className="text-center p-16 bg-card border border-border rounded-2xl">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold">All Caught Up!</h3>
                <p className="text-muted-foreground text-sm mt-1">There are no pending expiries waiting to be audited.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pendingItems.map(item => (
                  <div key={item.id} className="glass-panel p-5 rounded-xl border border-border hover:border-red-500/30 transition-all flex flex-col justify-between group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-500/10 text-red-500 rounded-xl group-hover:scale-110 transition-transform">
                          <Package className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{item.itemName}</h4>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="bg-muted px-2 py-0.5 rounded-md font-mono">{item.barcode || "No Barcode"}</span>
                            <span>Store: <span className="font-semibold text-foreground">{item.storeId || "Unknown"}</span></span>
                          </div>
                        </div>
                      </div>
                      <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                        <Clock className="h-3 w-3" /> PENDING AUDIT
                      </span>
                    </div>

                    <div className="flex items-end justify-between border-t border-border pt-4 mt-2">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Verify Quantity</label>
                        {editingId === item.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              min="0"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(Number(e.target.value))}
                              className="w-20 bg-background border border-border rounded-lg p-2 text-sm font-bold text-center outline-none focus:border-red-500"
                            />
                            <button 
                              onClick={() => setEditingId(null)}
                              className="text-xs text-muted-foreground hover:text-foreground underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-black text-foreground">{item.quantity}</span>
                            <button 
                              onClick={() => { setEditingId(item.id); setEditQuantity(item.quantity); }}
                              className="text-xs text-blue-500 hover:text-blue-400 font-semibold"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => handleAudit(item)}
                        disabled={processing === item.id}
                        className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-red-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {processing === item.id ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <ShieldCheck className="h-4 w-4" />}
                        Confirm Audit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-card p-4 border border-border rounded-xl">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-lg font-bold outline-none border-none cursor-pointer"
                />
              </div>
              <button 
                onClick={() => window.print()}
                disabled={auditedItems.length === 0}
                className="bg-foreground text-background hover:bg-muted-foreground px-5 py-2.5 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                Print A4 Report
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <div className="glass-panel p-6 rounded-xl border border-border">
                 <p className="text-sm font-bold text-muted-foreground">Total Audited Items</p>
                 <p className="text-3xl font-black mt-1 text-foreground">{totalAuditedQuantity}</p>
               </div>
               <div className="glass-panel p-6 rounded-xl border border-border">
                 <p className="text-sm font-bold text-muted-foreground">Unique Products</p>
                 <p className="text-3xl font-black mt-1 text-foreground">{Array.from(new Set(auditedItems.map(i => i.itemName))).length}</p>
               </div>
               <div className="glass-panel p-6 rounded-xl border border-border">
                 <p className="text-sm font-bold text-muted-foreground">Report Status</p>
                 <p className="text-3xl font-black mt-1 text-emerald-500 flex items-center gap-2"><CheckCircle className="h-6 w-6"/> Ready</p>
               </div>
            </div>

            {auditedItems.length > 0 ? (
              <div className="glass-panel border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Item Name</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Store</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Audited Qty</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Date Audited</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditedItems.map(item => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="p-4">
                          <p className="font-bold text-sm">{item.itemName}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.barcode}</p>
                        </td>
                        <td className="p-4 text-sm">{item.storeId || "-"}</td>
                        <td className="p-4 text-base font-black text-foreground">{item.quantity}</td>
                        <td className="p-4 text-sm text-right text-muted-foreground">
                          {new Date(item.auditedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-16 bg-card border border-border rounded-2xl">
                <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold">No Records Found</h3>
                <p className="text-muted-foreground text-sm mt-1">No items were audited in this month.</p>
              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
}
