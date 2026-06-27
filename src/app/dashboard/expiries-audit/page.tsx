"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, updateDoc, doc, orderBy, limit, addDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { CheckCircle, AlertTriangle, Printer, Calendar, Search, Package, Clock, ShieldCheck, Trash2 } from "lucide-react";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import Link from "next/link";
import { useBranch } from "@/context/BranchContext";

export default function ExpiryAuditPage() {
  const { currentBranch } = useBranch();
  const [allExpiries, setAllExpiries] = useState<any[]>([]);
  const [supplierReturns, setSupplierReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "pending" | "returns" | "reports">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExpiry, setSelectedExpiry] = useState<any | null>(null);
  const [isEditingExpiry, setIsEditingExpiry] = useState(false);
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [editExpiryQty, setEditExpiryQty] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>("");
  const [processing, setProcessing] = useState<string | null>(null);

  // Audit Modal State
  const [auditModalItem, setAuditModalItem] = useState<any | null>(null);
  const [auditSoldQty, setAuditSoldQty] = useState<string>("0");
  const [auditAction, setAuditAction] = useState<"destroy" | "return">("destroy");

  // Handover Modal State
  const [handoverSupplier, setHandoverSupplier] = useState<string | null>(null);
  const [handoverItems, setHandoverItems] = useState<any[]>([]);
  const [agentName, setAgentName] = useState("");
  const [agentNationalId, setAgentNationalId] = useState("");
  const [agentMobile, setAgentMobile] = useState("");
  const [printData, setPrintData] = useState<any | null>(null);

  // Advanced Filters
  const [reportFilters, setReportFilters] = useState({
    status: "all", // all, active, pulled, audited
    supplier: "",
    item: "",
    startDate: "",
    endDate: ""
  });

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "expiries"), orderBy("createdAt", "desc"), limit(2000));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort by expiry date ascending (closest to expire first)
      data.sort((a: any, b: any) => (a.expiryDate || "").localeCompare(b.expiryDate || ""));
      setAllExpiries(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching expiries:", error);
      setLoading(false);
    });

    const qReturns = query(collection(db, "supplier_returns"), orderBy("createdAt", "desc"));
    const unsubscribeReturns = onSnapshot(qReturns, (snap) => {
      setSupplierReturns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeReturns();
    };
  }, []);

  const handleOpenAuditModal = (item: any) => {
    setAuditModalItem(item);
    setAuditSoldQty("0");
    setAuditAction("destroy");
  };

  const processExpiryAudit = async () => {
    if (!auditModalItem) return;
    const item = auditModalItem;
    
    setProcessing(item.id);
    try {
      const currentQty = editingId === item.id ? editQuantity : (Number(item.quantity) || 0);
      const currentDate = editingId === item.id ? editDate : item.expiryDate;
      
      const soldQty = Number(auditSoldQty);
      if (isNaN(soldQty) || soldQty < 0 || soldQty > currentQty) {
        alert("Invalid sold quantity. It must be a number between 0 and " + currentQty + ".");
        setProcessing(null);
        return;
      }

      const expiredQty = currentQty - soldQty;
      
      const auditPayload = {
        status: auditAction === "return" ? "pending_return" : "audited",
        quantity: expiredQty,
        soldQuantity: soldQty,
        originalQuantity: currentQty,
        expiryDate: currentDate,
        auditedAt: new Date().toISOString(),
        auditedBy: localStorage.getItem("circlek_role") || "manager" // Fallback
      };

      if (expiredQty === 0) {
        await deleteDoc(doc(db, "expiries", item.id));
        setAllExpiries(prev => prev.filter(i => i.id !== item.id));
        if (selectedExpiry && selectedExpiry.id === item.id) {
          setSelectedExpiry(null);
        }
      } else {
        // 1. Update status in expiries
        await updateDoc(doc(db, "expiries", item.id), auditPayload);
        
        // Update local state
        if (selectedExpiry && selectedExpiry.id === item.id) {
          setSelectedExpiry({ ...selectedExpiry, ...auditPayload });
        }
        setAllExpiries(prev => prev.map(i => i.id === item.id ? { ...i, ...auditPayload } : i));
      }

      // 2. Add to appropriate collection ONLY if there's actually an expired quantity
      if (expiredQty > 0) {
        const savedUserStr = localStorage.getItem("active_cashier_session");
        let managerEmail = "Unknown Manager";
        if (savedUserStr) {
          const sessionData = JSON.parse(savedUserStr);
          managerEmail = sessionData.email || sessionData.name || "Unknown Manager";
        }

        const todayStr = new Date().toISOString().split('T')[0];

        let normalizedStoreId = "Unknown Store";
        let targetBranch = currentBranch;
        
        if (targetBranch === "all") {
          if (item.branchId) {
             targetBranch = item.branchId;
          } else {
             const storeStr = (item.storeId || "").toLowerCase();
             targetBranch = storeStr.includes("ola") || storeStr.includes("koronfol") ? "ola" : "alamein4";
          }
        }
        
        if (targetBranch === "alamein4") {
          normalizedStoreId = "eL-alamein-4";
        } else if (targetBranch === "ola") {
          normalizedStoreId = "ola-el-koronfol";
        }

        if (auditAction === "return") {
          await addDoc(collection(db, "supplier_returns"), {
            barcode: item.barcode || "1",
            itemName: item.itemName,
            category: item.category || "uncategorized",
            supplier: item.supplier || "Unknown Supplier",
            quantity: expiredQty,
            storeId: normalizedStoreId,
            branchId: targetBranch,
            status: "pending", // pending, returned
            createdAt: new Date().toISOString(),
            createdBy: managerEmail,
            expiryId: item.id // Link back to expiries if needed
          });
        } else {
          await addDoc(collection(db, "expired_items"), {
            barcode: item.barcode || "1",
            category: item.category || "uncategorized",
            createdAt: new Date().toISOString(),
            createdBy: managerEmail,
            date: todayStr,
            name: item.itemName,
            quantity: expiredQty,
            storeId: normalizedStoreId
          });
        }
      }
      
      setAuditModalItem(null); // Close modal
      setEditingId(null);
    } catch (err) {
      console.error("Error auditing item:", err);
      alert("Failed to audit item.");
    } finally {
      setProcessing(null);
    }
  };

  const processHandover = async () => {
    if (!handoverSupplier || handoverItems.length === 0) return;
    if (!agentName.trim() || !agentNationalId.trim() || !agentMobile.trim()) {
      alert("Please fill in all Agent Information fields.");
      return;
    }

    setProcessing("handover");
    try {
      const finalItems = [];

      for (const item of handoverItems) {
        if (item.handoverQty > 0) {
          await updateDoc(doc(db, "supplier_returns", item.id), {
            status: "returned",
            quantity: item.handoverQty,
            returnedAt: new Date().toISOString(),
            agentName,
            agentNationalId,
            agentMobile
          });
          finalItems.push({
            ...item,
            quantity: item.handoverQty
          });
        } else {
          // If 0, just delete it or leave it as pending? Let's delete it if they took 0.
          await deleteDoc(doc(db, "supplier_returns", item.id));
        }
      }

      const receiptData = {
        supplier: handoverSupplier,
        date: new Date().toLocaleDateString('en-GB'),
        returnNumber: `RTV-${Date.now().toString().slice(-6)}`,
        agentName,
        agentNationalId,
        agentMobile,
        items: finalItems
      };

      setPrintData(receiptData);
      
      // Cleanup modal
      setHandoverSupplier(null);
      setHandoverItems([]);
      setAgentName("");
      setAgentNationalId("");
      setAgentMobile("");
      
      // Give DOM time to render print view, then print
      setTimeout(() => {
        window.print();
        setTimeout(() => setPrintData(null), 1000); // clear after print dialog closes
      }, 500);

    } catch (error) {
      console.error("Error processing handover:", error);
      alert("Failed to process handover.");
    } finally {
      setProcessing(null);
    }
  };

  const handleAudit = (item: any) => {
    handleOpenAuditModal(item);
  };

  const handleMarkExpiryPulled = (item: any) => {
    handleOpenAuditModal(item);
  };

  const handleDeleteExpiry = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expiry record?")) return;
    try {
      await deleteDoc(doc(db, "expiries", id));
      setSelectedExpiry(null);
      setAllExpiries(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error("Error deleting expiry:", error);
      alert("Failed to delete record.");
    }
  };

  const handleSaveExpiryEdit = async () => {
    if (!selectedExpiry) return;
    try {
      await updateDoc(doc(db, "expiries", selectedExpiry.id), {
        expiryDate: editExpiryDate,
        quantity: Number(editExpiryQty) || 0
      });
      setSelectedExpiry({ ...selectedExpiry, expiryDate: editExpiryDate, quantity: Number(editExpiryQty) || 0 });
      setAllExpiries(prev => prev.map(i => i.id === selectedExpiry.id ? { ...i, expiryDate: editExpiryDate, quantity: Number(editExpiryQty) || 0 } : i));
      setIsEditingExpiry(false);
      alert("Expiry record updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to update expiry record.");
    }
  };

  const items = allExpiries.filter(i => {
    if (currentBranch === "all") return true;
    let bId = i.branchId;
    if (bId === "eL-alamein-4" || bId === "el-alamein-4") bId = "alamein4";
    if (bId === "ola-el-koronfol") bId = "ola";
    
    if (bId === "alamein4" || bId === "ola") return bId === currentBranch;
    
    const storeStr = (i.storeId || "").toLowerCase();
    const inferred = storeStr.includes("ola") || storeStr.includes("koronfol") ? "ola" : "alamein4";
    return inferred === currentBranch;
  });

  const filteredExpiries = items.filter(item => 
    (item.itemName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.barcode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.storeId || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.addedBy || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingItems = items.filter(i => (i.status || "").toLowerCase() === "pulled" && (i.itemName || "").toLowerCase().includes((reportFilters.item || "").toLowerCase()));
  
  // Apply Advanced Filters
  const filteredReportItems = items.filter(i => {
    // Status Filter
    if (reportFilters.status !== "all" && (i.status || "").toLowerCase() !== reportFilters.status.toLowerCase()) return false;
    
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

  const uniqueSuppliers = Array.from(new Set(items.map(i => i.supplier).filter(Boolean))).sort();

  const generateQRData = () => {
    let text = `Expiry Report\nFilters: Status=${reportFilters.status}, Dates=${reportFilters.startDate || 'Any'} to ${reportFilters.endDate || 'Any'}\n`;
    text += `Total Units: ${totalFilteredQuantity}\n\n`;
    
    // Prevent QR code data too large error
    if (filteredReportItems.length > 0) {
      text += `--- Sample Items ---\n`;
      filteredReportItems.slice(0, 5).forEach(i => {
        text += `${i.itemName.substring(0, 15)} | Qty: ${i.quantity} | Exp: ${i.expiryDate}\n`;
      });
      if (filteredReportItems.length > 5) {
        text += `...and ${filteredReportItems.length - 5} more items.\n`;
      }
    }
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
            <p suppressHydrationWarning className="text-xs font-semibold text-slate-500">Printed: {new Date().toLocaleDateString()}</p>
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
                <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Barcode</th>
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
                  <td className="py-2 px-2">
                    {item.barcode ? <div className="scale-75 origin-left -ml-2"><Barcode value={item.barcode} height={30} width={1.2} fontSize={12} margin={0} /></div> : <span className="text-slate-400 text-xs">-</span>}
                  </td>
                  <td className="py-4 px-2 text-sm font-bold text-slate-900">
                    {item.itemName}
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
                  <td colSpan={7} className="py-10 text-center text-slate-500 font-bold">No records found for the selected filters.</td>
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
              onClick={() => { setActiveTab("active"); setSelectedExpiry(null); }}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === "active" ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
            >
              Active Tracker
            </button>
            <button 
              onClick={() => setActiveTab("pending")}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === "pending" ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
            >
              Pending Audits
              {pendingItems.length > 0 && <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">{pendingItems.length}</span>}
            </button>
            <button 
              onClick={() => setActiveTab("reports")}
              className={`flex-1 py-3 px-4 text-center font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === "reports" 
                  ? "bg-foreground text-background shadow-md" 
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              Audit Reports
            </button>
            <button 
              onClick={() => setActiveTab("returns")}
              className={`flex-1 py-3 px-4 text-center font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === "returns" 
                  ? "bg-foreground text-background shadow-md" 
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              Supplier Returns
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div></div>
        ) : activeTab === "active" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN: LIST */}
            <div className="lg:col-span-1 space-y-4 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="sticky top-0 z-10 bg-background pb-2">
                <input 
                  type="text"
                  placeholder="Search by Item, Barcode, or Store..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-3 rounded-xl border border-border bg-muted/50 focus:bg-background outline-none focus:ring-2 focus:ring-red-500 text-sm"
                />
              </div>

              {filteredExpiries.length === 0 ? (
                <div className="glass-panel p-8 text-center rounded-2xl">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="font-bold text-foreground">No active expiries tracked.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredExpiries.map(item => {
                    const itemDate = new Date(item.expiryDate);
                    itemDate.setHours(0,0,0,0);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);

                    const diffTime = itemDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    let badgeClass = "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border border-green-200/30";
                    let badgeText = "Safe (>2M)";

                    if (item.status === "pulled") {
                      badgeClass = "bg-slate-200 text-slate-500 dark:bg-slate-800/80 dark:text-slate-500 border border-slate-300/30";
                      badgeText = "Pulled";
                    } else if (item.status === "audited") {
                      badgeClass = "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-200/30";
                      badgeText = "Audited";
                    } else if (diffDays < 0) {
                      badgeClass = "bg-red-200 text-red-800 dark:bg-red-950/40 dark:text-red-400 border border-red-400/50 font-black animate-pulse";
                      badgeText = "EXPIRED";
                    } else if (diffDays <= 2) {
                      badgeClass = "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border border-red-300/30 font-bold";
                      badgeText = "≤ 48 Hrs";
                    } else if (diffDays <= 7) {
                      badgeClass = "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 border border-orange-300/30";
                      badgeText = "Soon";
                    } else if (diffDays <= 30) {
                      badgeClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400 border border-yellow-300/30";
                      badgeText = "1 Month";
                    } else if (diffDays <= 60) {
                      badgeClass = "bg-[#f3e5d8] text-[#8b5a2b] dark:bg-[#3d2a1a] dark:text-[#d4b499] border border-[#d4b499]/30";
                      badgeText = "2 Months";
                    }

                    const isSelected = selectedExpiry?.id === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => { setSelectedExpiry(item); setEditExpiryDate(item.expiryDate); setEditExpiryQty(String(item.quantity)); setIsEditingExpiry(false); }}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${isSelected
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/15 shadow-md shadow-blue-500/10'
                            : 'border-border bg-card hover:border-blue-300'
                          }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-foreground text-sm">{item.expiryDate}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeClass}`}>{badgeText}</span>
                        </div>
                        <div className="font-semibold text-lg text-foreground mb-1">{item.itemName}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-2">
                          <div className="flex justify-between items-center mb-2">
                            <span>{item.barcode}</span>
                            <span className="font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">Qty: {item.quantity}</span>
                          </div>
                          {item.barcode && item.barcode !== "N/A" && (
                            <div className="scale-[0.8] origin-left -ml-1">
                              <Barcode value={item.barcode} height={30} width={1.2} fontSize={12} margin={0} background="transparent" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: AUDIT WORKSPACE */}
            <div className="lg:col-span-2">
              {!selectedExpiry ? (
                <div className="glass-panel h-full min-h-[500px] p-6 rounded-2xl border border-border bg-muted/10 space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-6 w-6 text-blue-500 animate-pulse" />
                    <h3 className="text-xl font-black text-foreground">Expiries Tracker Summary</h3>
                  </div>

                  {/* Stat Cards Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Total Active */}
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-border shadow-sm flex flex-col justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Tracking</span>
                      <span className="text-3xl font-black text-blue-600 mt-2">
                        {items.filter(e => e.status !== "pulled" && e.status !== "audited").length}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">Active items</span>
                    </div>

                    {/* Expired */}
                    {(() => {
                      const expiredCount = items.filter(e => {
                        if (e.status === "pulled" || e.status === "audited") return false;
                        const exp = new Date(e.expiryDate);
                        exp.setHours(0,0,0,0);
                        const t = new Date();
                        t.setHours(0,0,0,0);
                        return exp < t;
                      }).length;

                      return (
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-border shadow-sm flex flex-col justify-between">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Expired</span>
                          <span className={`text-3xl font-black mt-2 ${expiredCount > 0 ? "text-red-600 animate-pulse" : "text-slate-500"}`}>
                            {expiredCount}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1">Requires pulling</span>
                        </div>
                      );
                    })()}

                    {/* Expiring Soon */}
                    {(() => {
                      const soonCount = items.filter(e => {
                        if (e.status === "pulled" || e.status === "audited") return false;
                        const exp = new Date(e.expiryDate);
                        exp.setHours(0,0,0,0);
                        const t = new Date();
                        t.setHours(0,0,0,0);
                        const tom = new Date(t);
                        tom.setDate(tom.getDate() + 1);
                        return exp.getTime() === t.getTime() || exp.getTime() === tom.getTime();
                      }).length;

                      return (
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-border shadow-sm flex flex-col justify-between">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Expires 48h</span>
                          <span className="text-3xl font-black text-orange-500 mt-2">
                            {soonCount}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1">Pull window close</span>
                        </div>
                      );
                    })()}

                    {/* Total Pulled */}
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-border shadow-sm flex flex-col justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Pulled</span>
                      <span className="text-3xl font-black text-green-600 mt-2">
                        {items.filter(e => e.status === "pulled").length}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">Awaiting Audit</span>
                    </div>
                  </div>

                  {/* Expiry Action List (Critical First) */}
                  <div className="bg-white dark:bg-slate-850 p-5 rounded-xl border border-border space-y-4">
                    <h4 className="text-sm font-black text-foreground uppercase tracking-wider">Critical Daily Action List</h4>
                    
                    {(() => {
                      const criticalItems = items.filter(e => {
                        if (e.status === "pulled" || e.status === "audited") return false;
                        const exp = new Date(e.expiryDate);
                        exp.setHours(0,0,0,0);
                        const t = new Date();
                        t.setHours(0,0,0,0);
                        const tom = new Date(t);
                        tom.setDate(tom.getDate() + 1);
                        return exp < t || exp.getTime() === t.getTime() || exp.getTime() === tom.getTime();
                      });

                      if (criticalItems.length === 0) {
                        return (
                          <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-slate-500">No items expiring today, tomorrow, or already expired! Excellent work.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-muted text-muted-foreground uppercase text-[10px]">
                              <tr>
                                <th className="p-2.5">Item Name</th>
                                <th className="p-2.5">Barcode</th>
                                <th className="p-2.5">Store</th>
                                <th className="p-2.5">Expiry Date</th>
                                <th className="p-2.5 text-center">Qty</th>
                                <th className="p-2.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {criticalItems.map(item => {
                                const exp = new Date(item.expiryDate);
                                exp.setHours(0,0,0,0);
                                const t = new Date();
                                t.setHours(0,0,0,0);
                                const isExpired = exp < t;

                                return (
                                  <tr key={item.id} className={isExpired ? "bg-red-500/5" : "bg-transparent"}>
                                    <td className="p-2.5 font-bold text-foreground flex items-center gap-1.5">
                                      <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? "bg-red-500 animate-ping" : "bg-orange-500"}`}></span>
                                      {item.itemName}
                                    </td>
                                    <td className="p-2.5 font-mono text-muted-foreground">
                                      {item.barcode && item.barcode !== "N/A" ? (
                                        <div className="scale-75 origin-left -ml-2"><Barcode value={item.barcode} height={30} width={1.2} fontSize={12} margin={0} background="transparent" /></div>
                                      ) : item.barcode}
                                    </td>
                                    <td className="p-2.5 text-muted-foreground">{item.storeId}</td>
                                    <td className={`p-2.5 font-bold ${isExpired ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"}`}>
                                      {item.expiryDate} {isExpired ? "(EXPIRED)" : ""}
                                    </td>
                                    <td className="p-2.5 text-center font-bold text-foreground">{item.quantity}</td>
                                    <td className="p-2.5 text-right flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleMarkExpiryPulled(item)}
                                        className="px-2 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded font-bold text-[10px] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                      >
                                        Pull
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="glass-panel rounded-2xl border border-border overflow-hidden">
                  {/* Header */}
                  <div className="bg-slate-900 text-white p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-2xl font-black">{selectedExpiry.itemName}</h2>
                        <div className="text-slate-400 text-sm mt-1 flex items-center gap-3">
                          <div className="scale-75 origin-left bg-white/10 p-1 rounded">
                            <Barcode value={selectedExpiry.barcode || "N/A"} height={40} width={1.5} fontSize={14} margin={0} background="transparent" lineColor="#ffffff" />
                          </div>
                          <span>• Store: {selectedExpiry.storeId}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          {/* Status Badges */}
                          {selectedExpiry.status === "pulled" ? (
                            <span className="px-2.5 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-lg border border-slate-700">
                              Pulled
                            </span>
                          ) : selectedExpiry.status === "audited" ? (
                            <span className="px-2.5 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-lg border border-green-500/30">
                              Audited
                            </span>
                          ) : (() => {
                            const itemDate = new Date(selectedExpiry.expiryDate);
                            itemDate.setHours(0,0,0,0);
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const tomorrow = new Date(today);
                            tomorrow.setDate(tomorrow.getDate() + 1);

                            if (itemDate < today) {
                              return (
                                <span className="px-2.5 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/30 animate-pulse">
                                  EXPIRED! Pull Now!
                               </span>
                              );
                            } else if (itemDate.getTime() === today.getTime()) {
                              return (
                                <span className="px-2.5 py-1 bg-orange-500/20 text-orange-400 text-xs font-bold rounded-lg border border-orange-500/30">
                                  Expires Today
                                </span>
                              );
                            } else if (itemDate.getTime() === tomorrow.getTime()) {
                              return (
                                <span className="px-2.5 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-lg border border-yellow-500/30">
                                  Expires Tomorrow
                                </span>
                              );
                            } else {
                              return (
                                <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg border border-blue-500/30">
                                  Active Tracking
                                </span>
                              );
                            }
                          })()}
                        </div>
                      </div>
                      <div className="text-right flex items-center justify-end gap-4">
                        {isEditingExpiry ? (
                          <div className="text-left bg-slate-800 p-2 rounded-lg">
                            <label className="text-[10px] text-slate-400 font-bold block uppercase mb-1">New Quantity</label>
                            <input type="number" value={editExpiryQty} onChange={e => setEditExpiryQty(e.target.value)} className="w-16 p-1 text-slate-900 font-bold rounded text-center outline-none" />
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Quantity</p>
                            <p className="text-2xl font-black text-green-400">{selectedExpiry.quantity}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6 bg-background">
                    {/* 1. Barcode Render */}
                    <section className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border flex flex-col items-center justify-center">
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Item Barcode</p>
                      {selectedExpiry.barcode ? (
                        <div className="bg-white p-3 rounded">
                          <Barcode value={selectedExpiry.barcode} width={1.8} height={50} fontSize={14} />
                        </div>
                      ) : (
                        <span className="text-sm italic text-muted-foreground">No barcode recorded</span>
                      )}
                    </section>

                    {/* 2. Expiry Details */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/30 rounded-xl border border-border relative">
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Expiration Date</p>
                        {isEditingExpiry ? (
                          <input type="date" value={editExpiryDate} onChange={e => setEditExpiryDate(e.target.value)} className="w-full p-2 mt-1 rounded bg-background border border-border font-bold outline-none text-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{selectedExpiry.expiryDate}</p>
                        )}
                      </div>
                      <div className="p-4 bg-muted/30 rounded-xl border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Date Logged</p>
                        <p className="text-lg font-bold text-foreground">
                          {selectedExpiry.createdAt ? new Date(selectedExpiry.createdAt).toLocaleDateString('en-GB') : "N/A"}
                        </p>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-xl border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Logged By Staff</p>
                        <p className="text-lg font-bold text-foreground">{selectedExpiry.addedBy || "Unknown"}</p>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-xl border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Store Location</p>
                        <p className="text-lg font-bold text-foreground">{selectedExpiry.storeId || "Unknown"}</p>
                      </div>
                    </section>

                    {/* 3. Actions */}
                    <div className="pt-4 border-t border-border flex flex-col gap-3">
                      {isEditingExpiry ? (
                        <div className="flex gap-2">
                          <button onClick={() => setIsEditingExpiry(false)} className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-all">Cancel</button>
                          <button onClick={handleSaveExpiryEdit} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md">Save Changes</button>
                        </div>
                      ) : (
                        <>
                          {selectedExpiry.status !== "pulled" && selectedExpiry.status !== "audited" && (
                            <button
                              type="button"
                              onClick={() => handleMarkExpiryPulled(selectedExpiry)}
                              className="w-full py-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer animate-in fade-in"
                            >
                              <CheckCircle className="h-5 w-5 text-green-500" /> Mark Item as Pulled from Shelf
                            </button>
                          )}
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setIsEditingExpiry(true)}
                              className="flex-1 py-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl font-bold text-sm transition-all flex items-center justify-center cursor-pointer"
                            >
                              Edit Record
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteExpiry(selectedExpiry.id)}
                              className="flex-1 py-3 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:border-red-900/40 dark:hover:bg-red-900/50 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" /> Delete Expiry
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

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
        ) : activeTab === "returns" ? (
          <div className="space-y-6">
            <div className="bg-card p-5 border border-border rounded-xl space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" /> Pending Supplier Returns
              </h3>
              <p className="text-xs text-muted-foreground">Select a supplier below to initiate a handover and print a return receipt.</p>
            </div>
            {(() => {
              const pendingReturns = supplierReturns.filter(r => r.status === "pending" && (currentBranch === "all" || r.branchId === "all" || r.branchId === currentBranch || (r.storeId && r.storeId.toLowerCase().includes(currentBranch === "ola" ? "ola" : "alamein"))));
              if (pendingReturns.length === 0) {
                return (
                  <div className="text-center p-16 bg-card border border-border rounded-2xl">
                    <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold">No Pending Returns</h3>
                    <p className="text-muted-foreground text-sm mt-1">There are no items waiting to be returned to suppliers.</p>
                  </div>
                );
              }

              const groupedReturns = pendingReturns.reduce((acc: any, curr: any) => {
                const sup = curr.supplier || "Unknown Supplier";
                if (!acc[sup]) acc[sup] = [];
                acc[sup].push(curr);
                return acc;
              }, {});

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(groupedReturns).map(([supplier, rItems]: [string, any]) => (
                    <button
                      key={supplier}
                      onClick={() => {
                        setHandoverSupplier(supplier);
                        setHandoverItems(rItems.map((i: any) => ({ ...i, handoverQty: i.quantity })));
                        setAgentName("");
                        setAgentNationalId("");
                        setAgentMobile("");
                      }}
                      className="glass-panel p-6 rounded-xl border border-border hover:border-blue-500/50 transition-all text-left flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <h4 className="font-black text-xl mb-1">{supplier}</h4>
                        <p className="text-sm font-bold text-muted-foreground">{rItems.length} Unique Items</p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                        <span className="text-sm font-bold text-blue-500">Initiate Handover ➔</span>
                        <span className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-lg text-xs font-black">
                          {rItems.reduce((sum: number, i: any) => sum + Number(i.quantity), 0)} Total Units
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        ) : activeTab === "reports" ? (
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
                    <option value="active">Active (On Shelf)</option>
                    <option value="pulled">Pending Audit (Pulled)</option>
                    <option value="audited">Finalized (Audited)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Supplier (Company)</label>
                  <select 
                    value={reportFilters.supplier}
                    onChange={e => setReportFilters({...reportFilters, supplier: e.target.value})}
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm focus:border-red-500 outline-none"
                  >
                    <option value="">All Suppliers</option>
                    {uniqueSuppliers.map((s: any) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="glass-panel p-6 rounded-xl border border-border">
                 <p className="text-sm font-bold text-muted-foreground">Filtered Items Expiring</p>
                 <p className="text-3xl font-black mt-1 text-foreground">{totalFilteredQuantity}</p>
               </div>
               <div className="glass-panel p-6 rounded-xl border border-border">
                 <p className="text-sm font-bold text-muted-foreground">Unique Products</p>
                 <p className="text-3xl font-black mt-1 text-foreground">{Array.from(new Set(filteredReportItems.map(i => i.itemName))).length}</p>
               </div>
            </div>

            {filteredReportItems.length > 0 ? (
              <div className="glass-panel border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Barcode</th>
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
                        <td className="p-2">
                          {item.barcode ? <div className="scale-75 origin-left -ml-2"><Barcode value={item.barcode} height={40} width={1.2} fontSize={12} margin={0} background="transparent" /></div> : <span className="text-slate-400 text-xs">-</span>}
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-sm">{item.itemName}</p>
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
        ) : null}
      </div>

      {/* Audit Modal */}
      {auditModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
            <div className="bg-muted p-4 border-b border-border flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-red-500" /> Audit Expiry
              </h3>
              <button 
                onClick={() => setAuditModalItem(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="glass-panel p-4 rounded-xl text-center">
                <p className="text-sm text-muted-foreground font-bold">Item Name</p>
                <p className="text-xl font-black text-foreground">{auditModalItem.itemName}</p>
                <p className="text-xs text-muted-foreground mt-1">Barcode: {auditModalItem.barcode || "N/A"}</p>
              </div>

              <div className="flex justify-between items-center bg-background border border-border p-4 rounded-xl">
                <p className="text-sm font-bold text-muted-foreground">Total Tracked Quantity:</p>
                <p className="text-2xl font-black text-foreground">
                  {editingId === auditModalItem.id ? editQuantity : (Number(auditModalItem.quantity) || 0)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Were any of these SOLD before expiring?</label>
                <p className="text-xs text-muted-foreground">If yes, enter the SOLD quantity. If none were sold, leave as 0.</p>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max={editingId === auditModalItem.id ? editQuantity : (Number(auditModalItem.quantity) || 0)}
                    value={auditSoldQty}
                    onChange={(e) => setAuditSoldQty(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl p-3 pl-4 text-xl font-black text-foreground outline-none focus:border-red-500 transition-colors"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                    Units Sold
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 pb-2">
              <label className="text-sm font-bold text-muted-foreground mb-2 block">Action for Expired Quantity</label>
              <div className="flex gap-2 p-1 bg-muted rounded-xl">
                <button
                  type="button"
                  onClick={() => setAuditAction("destroy")}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${auditAction === "destroy" ? "bg-red-500 text-white shadow-md" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Destroy
                </button>
                <button
                  type="button"
                  onClick={() => setAuditAction("return")}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${auditAction === "return" ? "bg-blue-500 text-white shadow-md" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Return to Supplier
                </button>
              </div>
            </div>

            <div className="p-4 bg-muted/50 border-t border-border flex gap-3">
              <button
                onClick={() => setAuditModalItem(null)}
                className="flex-1 px-4 py-3 bg-background border border-border rounded-xl font-bold text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={processExpiryAudit}
                disabled={processing === auditModalItem.id}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing === auditModalItem.id ? (
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
                Confirm Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Handover Modal */}
      {handoverSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-blue-600 text-white p-5 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Package className="h-5 w-5" /> Supplier Return Handover: {handoverSupplier}
              </h3>
              <button 
                onClick={() => setHandoverSupplier(null)}
                className="text-blue-200 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="col-span-1 md:col-span-3">
                  <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">Delivery Agent Details</h4>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Agent Name</label>
                  <input 
                    type="text" 
                    value={agentName}
                    onChange={e => setAgentName(e.target.value)}
                    placeholder="E.g. Ahmed Ali"
                    className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">National ID</label>
                  <input 
                    type="text" 
                    value={agentNationalId}
                    onChange={e => setAgentNationalId(e.target.value)}
                    placeholder="14-digit National ID"
                    className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Mobile Number</label>
                  <input 
                    type="text" 
                    value={agentMobile}
                    onChange={e => setAgentMobile(e.target.value)}
                    placeholder="E.g. 01012345678"
                    className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3 mt-4">Items to Return</h4>
                <div className="bg-muted/30 border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 font-bold text-xs uppercase text-muted-foreground">Item Name</th>
                        <th className="p-3 font-bold text-xs uppercase text-muted-foreground w-32">Actual Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {handoverItems.map((item, index) => (
                        <tr key={item.id}>
                          <td className="p-3 font-semibold">{item.itemName}</td>
                          <td className="p-3">
                            <input 
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={item.handoverQty}
                              onChange={e => {
                                const newItems = [...handoverItems];
                                newItems[index].handoverQty = Number(e.target.value);
                                setHandoverItems(newItems);
                              }}
                              className="w-20 p-2 border border-border rounded-lg bg-background font-black outline-none focus:border-blue-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/50 border-t border-border flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setHandoverSupplier(null)}
                className="px-6 py-3 bg-background border border-border rounded-xl font-bold text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={processHandover}
                disabled={processing === "handover"}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {processing === "handover" ? (
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Printer className="h-5 w-5" />
                )}
                Complete Handover & Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print View for Return Receipt */}
      {printData && (
        <div className="fixed inset-0 z-[100] bg-white print-only-container hidden print:block text-black p-8">
          <div className="max-w-4xl mx-auto">
            <div className="border-b-2 border-black pb-6 mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-4xl font-black mb-2 uppercase tracking-tighter">Supplier Return Invoice</h1>
                <p className="text-lg font-bold text-gray-600">Company: {printData.supplier}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{printData.returnNumber}</p>
                <p className="font-semibold text-gray-600 mt-1">Date: {printData.date}</p>
              </div>
            </div>

            <div className="mb-8 p-6 border-2 border-black rounded-xl">
              <h3 className="font-bold uppercase tracking-wider text-sm mb-4 border-b border-gray-300 pb-2">Delivery Agent Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <p><span className="font-bold text-gray-500">Name:</span> <span className="font-bold text-lg ml-2">{printData.agentName}</span></p>
                <p><span className="font-bold text-gray-500">Mobile:</span> <span className="font-bold text-lg ml-2">{printData.agentMobile}</span></p>
                <p className="col-span-2"><span className="font-bold text-gray-500">National ID:</span> <span className="font-bold text-lg ml-2 tracking-widest">{printData.agentNationalId}</span></p>
              </div>
            </div>

            <table className="w-full text-left border-collapse mb-8">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Item Name / Description</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Barcode</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Returned Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {printData.items.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="py-4 px-4 font-semibold text-lg">{item.itemName}</td>
                    <td className="py-4 px-4 font-mono">{item.barcode}</td>
                    <td className="py-4 px-4 font-black text-2xl text-right">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black">
                  <td colSpan={2} className="py-4 px-4 font-bold text-right uppercase">Total Items Returned:</td>
                  <td className="py-4 px-4 font-black text-3xl text-right">
                    {printData.items.reduce((sum: number, item: any) => sum + item.quantity, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-16 pt-8 border-t-2 border-black grid grid-cols-2 gap-16">
              <div className="text-center">
                <p className="font-bold uppercase tracking-wider mb-16">Store Manager Signature</p>
                <div className="border-b-2 border-black w-64 mx-auto"></div>
              </div>
              <div className="text-center">
                <p className="font-bold uppercase tracking-wider mb-16">Delivery Agent Signature</p>
                <div className="border-b-2 border-black w-64 mx-auto"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inject print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print-only-container, .print-only-container * { visibility: visible !important; }
          .print-only-container { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}} />

    </div>
  );
}
