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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>("");
  const [processing, setProcessing] = useState<string | null>(null);

  // Advanced Filters
  const [reportFilters, setReportFilters] = useState({
    status: "all", // all, active, pulled, audited
    supplier: "",
    item: "",
    startDate: "",
    endDate: ""
  });

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
      const updatedDate = editingId === item.id ? editDate : item.expiryDate;
      
      const auditPayload = {
        status: "audited",
        quantity: updatedQuantity,
        expiryDate: updatedDate,
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

  const pendingItems = items.filter(i => i.status === "pulled" && i.itemName.toLowerCase().includes(reportFilters.item.toLowerCase()));
  
  // Apply Advanced Filters
  const filteredReportItems = items.filter(i => {
    // Status Filter
    if (reportFilters.status !== "all" && i.status !== reportFilters.status) return false;
    
    // Supplier Filter
    if (reportFilters.supplier && !(i.supplier || "").toLowerCase().includes(reportFilters.supplier.toLowerCase())) return false;
    
    // Item Name Filter
    if (reportFilters.item && !(i.itemName || "").toLowerCase().includes(reportFilters.item.toLowerCase())) return false;
    
    // Date Range Filter (based on Expiry Date, not Audited At)
    if (reportFilters.startDate && i.expiryDate < reportFilters.startDate) return false;
    if (reportFilters.endDate && i.expiryDate > reportFilters.endDate) return false;
    
    return true;
  });

  const totalFilteredQuantity = filteredReportItems.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
  const totalFilteredValue = filteredReportItems.reduce((acc, curr) => acc + (Number(curr.quantity || 0) * 2.5), 0); // Assuming 2.5 is a fallback

  const generateQRData = () => {
    let text = `Expiry Report\nFilters: Status=${reportFilters.status}, Dates=${reportFilters.startDate || 'Any'} to ${reportFilters.endDate || 'Any'}\n`;
    text += `Total Units: ${totalFilteredQuantity}\n\n`;
    text += `--- Item Breakdown ---\n`;
    filteredReportItems.forEach(i => {
      text += `${i.itemName} | Qty: ${i.quantity} | Exp: ${i.expiryDate}\n`;
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
            <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Detailed Expiry Report</h1>
            <p className="text-2xl font-bold text-red-600 tracking-widest mt-1 uppercase">Official Record</p>
          </div>
          <div className="text-right">
            <div className="h-12 w-12 bg-slate-900 text-white rounded-full flex items-center justify-center font-black text-2xl ml-auto mb-2">K</div>
            <p className="font-bold text-sm text-slate-700">Circle K Enterprise</p>
            <p className="text-xs font-semibold text-slate-500">Printed: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Print Summary */}
        <div className="p-10 border-b border-slate-200 bg-white">
          <div className="flex justify-between items-start">
            <div className="flex gap-10">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Units Impacted</p>
                <p className="text-3xl font-black text-slate-900">{totalFilteredQuantity} <span className="text-base text-slate-500 font-bold">Units</span></p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Estimated Value</p>
                <p className="text-3xl font-black text-red-600">{totalFilteredValue.toLocaleString()} <span className="text-base text-slate-500 font-bold">EGP</span></p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Filters Applied</p>
              <p className="text-sm font-semibold text-slate-700">Status: {reportFilters.status.toUpperCase()}</p>
              {reportFilters.supplier && <p className="text-sm font-semibold text-slate-700">Supplier: {reportFilters.supplier}</p>}
              {reportFilters.startDate && <p className="text-sm font-semibold text-slate-700">From: {reportFilters.startDate}</p>}
              {reportFilters.endDate && <p className="text-sm font-semibold text-slate-700">To: {reportFilters.endDate}</p>}
            </div>
          </div>
        </div>

        {/* Print Table */}
        <div className="p-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Item Description</th>
                <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Supplier</th>
                <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Store</th>
                <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Status</th>
                <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Expiry Date</th>
                <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {filteredReportItems.map(item => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="py-4 px-2 text-sm font-bold text-slate-900">
                    {item.itemName}
                    <div className="text-[10px] text-slate-500 font-mono">{item.barcode}</div>
                  </td>
                  <td className="py-4 px-2 text-sm text-slate-600">{item.supplier || "-"}</td>
                  <td className="py-4 px-2 text-sm text-slate-600">{item.storeId || "Unknown Store"}</td>
                  <td className="py-4 px-2 text-xs font-bold text-slate-600 uppercase">{item.status}</td>
                  <td className="py-4 px-2 text-sm font-mono text-slate-800">{item.expiryDate}</td>
                  <td className="py-4 px-2 text-base font-black text-slate-900 text-right">{item.quantity}</td>
                </tr>
              ))}
              {filteredReportItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 font-bold">No records found for the selected filters.</td>
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
                value={reportFilters.item}
                onChange={(e) => setReportFilters({...reportFilters, item: e.target.value})}
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
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Verify Quantity & Date</label>
                        {editingId === item.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              min="0"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(Number(e.target.value))}
                              className="w-16 bg-background border border-border rounded-lg p-2 text-sm font-bold text-center outline-none focus:border-red-500"
                            />
                            <input 
                              type="date" 
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="bg-background border border-border rounded-lg p-2 text-sm font-bold outline-none focus:border-red-500"
                            />
                            <button 
                              onClick={() => setEditingId(null)}
                              className="text-xs text-muted-foreground hover:text-foreground underline ml-2"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-black text-foreground">{item.quantity}</span>
                            <span className="text-sm font-mono text-muted-foreground border-l border-border pl-3">{item.expiryDate}</span>
                            <button 
                              onClick={() => { setEditingId(item.id); setEditQuantity(item.quantity); setEditDate(item.expiryDate); }}
                              className="text-xs text-blue-500 hover:text-blue-400 font-semibold ml-2"
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
            <div className="bg-card p-5 border border-border rounded-xl space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Search className="h-4 w-4" /> Report Filters
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Status</label>
                  <select 
                    value={reportFilters.status}
                    onChange={e => setReportFilters({...reportFilters, status: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm focus:border-red-500 outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="pulled">Pulled</option>
                    <option value="audited">Audited</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Supplier (Company)</label>
                  <input 
                    type="text" 
                    placeholder="All Suppliers"
                    value={reportFilters.supplier}
                    onChange={e => setReportFilters({...reportFilters, supplier: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm focus:border-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Item Name</label>
                  <input 
                    type="text" 
                    placeholder="All Items"
                    value={reportFilters.item}
                    onChange={e => setReportFilters({...reportFilters, item: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm focus:border-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">From Expiry Date</label>
                  <input 
                    type="date" 
                    value={reportFilters.startDate}
                    onChange={e => setReportFilters({...reportFilters, startDate: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm focus:border-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">To Expiry Date</label>
                  <input 
                    type="date" 
                    value={reportFilters.endDate}
                    onChange={e => setReportFilters({...reportFilters, endDate: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm focus:border-red-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button 
                  onClick={() => window.print()}
                  disabled={filteredReportItems.length === 0}
                  className="bg-foreground text-background hover:bg-muted-foreground px-6 py-2.5 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  Print Detailed A4 Report
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <div className="glass-panel p-6 rounded-xl border border-border">
                 <p className="text-sm font-bold text-muted-foreground">Filtered Items Expiring</p>
                 <p className="text-3xl font-black mt-1 text-foreground">{totalFilteredQuantity}</p>
               </div>
               <div className="glass-panel p-6 rounded-xl border border-border">
                 <p className="text-sm font-bold text-muted-foreground">Unique Products</p>
                 <p className="text-3xl font-black mt-1 text-foreground">{Array.from(new Set(filteredReportItems.map(i => i.itemName))).length}</p>
               </div>
               <div className="glass-panel p-6 rounded-xl border border-border">
                 <p className="text-sm font-bold text-muted-foreground">Estimated Value</p>
                 <p className="text-3xl font-black mt-1 text-red-500 flex items-center gap-2">{totalFilteredValue.toLocaleString()} EGP</p>
               </div>
            </div>

            {filteredReportItems.length > 0 ? (
              <div className="glass-panel border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Item Name</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Supplier</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Expiry Date</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredReportItems.map(item => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="p-4">
                          <p className="font-bold text-sm">{item.itemName}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.barcode}</p>
                        </td>
                        <td className="p-4 text-sm">{item.supplier || "-"}</td>
                        <td className="p-4 text-xs font-bold uppercase text-muted-foreground">{item.status}</td>
                        <td className="p-4 text-sm font-mono text-foreground">{item.expiryDate}</td>
                        <td className="p-4 text-base font-black text-foreground text-right">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-16 bg-card border border-border rounded-2xl">
                <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold">No Records Found</h3>
                <p className="text-muted-foreground text-sm mt-1">Adjust filters to see expiry records.</p>
              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
}
