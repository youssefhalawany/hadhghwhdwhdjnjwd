"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, updateDoc, doc, orderBy, limit, addDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { CheckCircle, AlertTriangle, Printer, Calendar, Search, Package, Clock, ShieldCheck, Trash2 } from "lucide-react";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import Link from "next/link";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { DataTable } from "@/components/ui/DataTable";
import { PageTransition } from "@/components/PageTransition";
import { X } from "lucide-react";
import { ExpiryDeckGrid } from './ExpiryDeckGrid';
import { WasteAnalyticsPanel } from './WasteAnalyticsPanel';


export default function ExpiryAuditPage() {
  const { currentBranch } = useBranch();
  const { t } = useLanguage();
  const [allExpiries, setAllExpiries] = useState<any[]>([]);
  const [supplierReturns, setSupplierReturns] = useState<any[]>([]);
  const [alreadyExpired, setAlreadyExpired] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "pending" | "reports" | "already_expired" | "waste">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setActiveTab("active");
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getHistoricalExpiryAvg = (barcode: string) => {
    if (!barcode || barcode === "N/A") return 0;
    const history = allExpiries.filter(e => e.barcode === barcode && e.status === "audited");
    if (history.length === 0) return 0;
    const total = history.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
    return Math.round(total / history.length);
  };

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
    const q = query(collection(db, "expiries"), orderBy("createdAt", "desc"), limit(200));
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

    const qReturns = query(collection(db, "supplier_returns"), orderBy("createdAt", "desc"), limit(100));
    const unsubscribeReturns = onSnapshot(qReturns, (snap) => {
      setSupplierReturns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qExpired = query(collection(db, "expired_items"), orderBy("createdAt", "desc"), limit(200));
    const unsubscribeExpired = onSnapshot(qExpired, (snap) => {
      setAlreadyExpired(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeReturns();
      unsubscribeExpired();
    };
  }, []);

  
  const handleSwipeAction = async (item: any, action: "destroy" | "return") => {
    try {
      if (action === "return") {
        await addDoc(collection(db, "supplier_returns"), {
          itemName: item.itemName,
          barcode: item.barcode,
          quantity: item.quantity,
          supplier: item.supplier || "Unknown",
          createdAt: new Date().toISOString(),
          branchId: currentBranch || "master",
          status: "pending",
          expiryId: item.id
        });
        await updateDoc(doc(db, "expiries", item.id), { status: "pending_return" });
        setAllExpiries(prev => prev.map(i => i.id === item.id ? { ...i, status: "pending_return" } : i));
      } else {
        await updateDoc(doc(db, "expiries", item.id), { status: "pulled" });
        setAllExpiries(prev => prev.map(i => i.id === item.id ? { ...i, status: "pulled" } : i));
      }
    } catch (error) {
      console.error("Error processing swipe action:", error);
    }
  };

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
        quantity: expiredQty || 0,
        soldQuantity: soldQty || 0,
        originalQuantity: currentQty || 0,
        expiryDate: currentDate || "2026-01-01",
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
            itemName: item.itemName || "Unknown Item",
            category: item.category || "uncategorized",
            supplier: item.supplier || "Unknown Supplier",
            quantity: expiredQty,
            storeId: normalizedStoreId || "Unknown Store",
            branchId: targetBranch || "alamein4",
            status: "pending", // pending, returned
            createdAt: new Date().toISOString(),
            createdBy: managerEmail || "Unknown Manager",
            expiryId: item.id // Link back to expiries if needed
          });
        } else {
          await addDoc(collection(db, "expired_items"), {
            barcode: item.barcode || "1",
            category: item.category || "uncategorized",
            createdAt: new Date().toISOString(),
            createdBy: managerEmail || "Unknown Manager",
            date: todayStr,
            name: item.itemName || "Unknown Item",
            quantity: expiredQty,
            storeId: normalizedStoreId
          });
        }
      }
      
      setAuditModalItem(null); // Close modal
      setEditingId(null);
    } catch (err) {
      console.error("Error auditing item:", err);
      alert("Failed to audit item: " + ((err as any).message || JSON.stringify(err)));
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
    ((item.itemName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.barcode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.storeId || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.addedBy || "").toLowerCase().includes(searchQuery.toLowerCase())) &&
    item.status !== "audited" && item.status !== "pending_return" && item.status !== "returned" && item.status !== "damaged"
  );

  const pendingItems = items.filter(i => (i.status || "").toLowerCase() === "pulled" && (i.itemName || "").toLowerCase().includes((reportFilters.item || "").toLowerCase()));
  
  // Apply Advanced Filters
  const filteredReportItemsRaw = items.filter(i => {
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

  const filteredReportItems = React.useMemo(() => {
    const map = new Map<string, any>();
    filteredReportItemsRaw.forEach(item => {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) return; // exclude zero quantity

      const key = item.barcode || item.itemName;
      if (map.has(key)) {
        const existing = map.get(key);
        existing.quantity += qty;
        if (!existing.allDates.includes(item.expiryDate)) {
          existing.allDates.push(item.expiryDate);
        }
      } else {
        map.set(key, { ...item, quantity: qty, allDates: [item.expiryDate] });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const aDate = new Date(a.allDates[0]).getTime();
      const bDate = new Date(b.allDates[0]).getTime();
      return aDate - bDate;
    });
  }, [filteredReportItemsRaw]);

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
    <PageTransition>
    <div className="space-y-6 print:m-0 print:p-0 print:space-y-0">
      
      {/* --- PRINT ONLY A4 REPORT VIEW --- */}
      <div className="hidden print:flex bg-white text-slate-900 w-full font-sans flex-col relative overflow-hidden" style={{ width: '210mm', minHeight: '297mm', margin: '0 auto', boxSizing: 'border-box', padding: '15mm' }} dir="rtl">
        
        {/* Micro-Typography Security Borders */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px', overflow: 'hidden' }} dir="ltr">
          <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
            {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
          </div>
          <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
            {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
          </div>
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', padding: '4px', overflow: 'hidden', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} dir="ltr">
          <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
            {Array(35).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
          </div>
        </div>
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', padding: '4px', overflow: 'hidden', writingMode: 'vertical-rl' }} dir="ltr">
          <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
            {Array(35).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
          </div>
        </div>

        {/* Automated Digital Audit Stamp (Giant Watermark) */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-35deg)', fontSize: '80px', fontWeight: '900', color: 'rgba(239, 68, 68, 0.05)', zIndex: 5, whiteSpace: 'nowrap', pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '5px' }} dir="ltr">
          EXPIRY DESTRUCTION
        </div>

        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Corporate Header */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-4 mb-4" dir="ltr">
            <div className="flex items-center gap-3">
              <div className="bg-red-600 text-white p-2 rounded-xl font-black text-3xl tracking-tighter w-12 h-12 flex items-center justify-center">K</div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none">Circle K</h1>
                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">{currentBranch === "all" ? "HQ Portal" : (currentBranch === "ola" ? "Ola El Koronfol" : "Alamein 4")}</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter">تقرير الهوالك | EXPIRIES AUDIT</h2>
              <p className="text-sm font-bold text-red-600 mt-1 uppercase tracking-widest">Official Record</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">Date: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* AI Summary Sentence (Egyptian Arabic) */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRight: '4px solid #ef4444', borderRadius: '8px', padding: '6px 10px', textAlign: 'right', marginBottom: '15px' }}>
            <p style={{ margin: 0, fontSize: '10px', color: '#1e293b', lineHeight: 1.5, fontWeight: 'bold' }}>
              <span style={{ color: '#ef4444', marginLeft: '6px' }}>✦</span>
              {totalFilteredQuantity > 50 
                ? `تحليل الهوالك: إجمالي الوحدات الهالكة (${totalFilteredQuantity} وحدة) رقم عالي ومحتاجين نراجع تواريخ الصلاحية على الرفوف أسرع من كده. لازم يتم إعدام البضاعة قدام مدير الفرع.`
                : `تحليل الهوالك: إجمالي الوحدات الهالكة (${totalFilteredQuantity} وحدة) في المعدل الطبيعي. برجاء التأكد من إعدام البضاعة بشكل كامل قبل التوقيع.`}
            </p>
          </div>

          {/* Print Summary */}
          <div className="grid grid-cols-2 gap-4 mb-4 border-b-2 border-slate-200 pb-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1" dir="ltr">Total Units Impacted</h3>
              <p className="text-3xl font-black text-slate-900" dir="ltr">{totalFilteredQuantity} <span className="text-base text-slate-500 font-bold">Units</span></p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-right" dir="ltr">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Filters Applied</h3>
              <p className="text-sm font-semibold text-slate-700">Status: {reportFilters.status.toUpperCase()}</p>
              {reportFilters.supplier && <p className="text-sm font-semibold text-slate-700">Supplier: {reportFilters.supplier}</p>}
              {reportFilters.startDate && <p className="text-sm font-semibold text-slate-700">From: {reportFilters.startDate}</p>}
              {reportFilters.endDate && <p className="text-sm font-semibold text-slate-700">To: {reportFilters.endDate}</p>}
            </div>
          </div>

          {/* Print Table */}
          <div className="mb-4 flex-1">
            <table className="w-full text-left border-collapse border-2 border-slate-900 rounded-lg overflow-hidden" dir="ltr">
              <thead className="bg-slate-100">
                <tr className="border-b-2 border-slate-900">
                  <th className="py-2 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r-2 border-slate-900">Barcode</th>
                  <th className="py-2 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r-2 border-slate-900">Item</th>
                  <th className="py-2 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r-2 border-slate-900">Supplier</th>
                  <th className="py-2 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r-2 border-slate-900">Status</th>
                  <th className="py-2 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r-2 border-slate-900">Expiry Date</th>
                  <th className="py-2 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y border-slate-900">
                {filteredReportItems.map(item => (
                  <tr key={item.id}>
                    <td className="py-1 px-2 font-mono font-bold text-[10px] text-slate-800 border-r-2 border-slate-900 tracking-wider">
                      {item.barcode || "-"}
                    </td>
                    <td className="py-1 px-2 text-[10px] font-black text-slate-900 border-r-2 border-slate-900">
                      {item.itemName}
                    </td>
                    <td className="py-1 px-2 text-[10px] font-bold text-slate-600 border-r-2 border-slate-900">{item.supplier || "-"}</td>
                    <td className="py-1 px-2 text-[10px] font-bold text-slate-600 uppercase border-r-2 border-slate-900">{item.status}</td>
                    <td className="py-1 px-2 text-[10px] font-mono text-red-600 font-bold border-r-2 border-slate-900">{item.expiryDate}</td>
                    <td className="py-1 px-2 text-sm font-black text-slate-900 text-center">{item.quantity}</td>
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
          <div className="mt-auto pt-4 border-t-2 border-slate-200 flex justify-between items-end break-inside-avoid" dir="ltr">
            <div className="w-1/4">
              <div className="bg-white p-1 border border-slate-200 rounded-lg inline-block shadow-sm">
                <QRCode value={generateQRData()} size={60} level="L" />
              </div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 text-center w-16">Scan Data</p>
            </div>

            <div className="w-1/3 text-center relative px-2">
              <p className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-8">Store Manager</p>
              <div className="border-t-2 border-slate-900 pt-1">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Authorized By</p>
              </div>
            </div>

            {/* Official Stamp Box for Destruction Witness */}
            <div className="w-1/4 flex flex-col items-center justify-end mb-2">
              <div className="w-full height-12 border-2 border-dashed border-slate-400 rounded-md flex flex-col items-center justify-center bg-slate-50 py-3">
                <span className="text-[7px] font-black text-slate-400 uppercase text-center tracking-wider">Destruction<br/>Witness Stamp</span>
              </div>
            </div>
          </div>

          {/* Advanced Digital Forensics Footer */}
          <div className="border-t-2 border-slate-900 pt-1 text-center mt-4" dir="ltr">
            <p className="text-[7px] text-slate-500 font-mono m-0 tracking-widest font-bold uppercase">
              DOCUMENT EXP-{Date.now().toString().substring(5)} | VERIFIED: {new Date().toLocaleString('en-GB')} | SYSTEM: ANH PORTAL V2.0
            </p>
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
              {t("expiries_audit.tab_reports")}
            </button>
            
            <button 
              onClick={() => setActiveTab("already_expired")}
              className={`flex-1 py-3 px-4 text-center font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === "already_expired" 
                  ? "bg-foreground text-background shadow-md" 
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              Already Expired
            </button>
            <button 
              onClick={() => setActiveTab("waste")}
              className={`flex-1 py-3 px-4 text-center font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === "waste" 
                  ? "bg-orange-600 text-white shadow-md" 
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              🔥 Waste Cost
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div></div>
        ) : activeTab === "active" ? (
          <div className="space-y-8">
            {/* Top Dashboard Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-card rounded-xl border border-border shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Tracking</span>
                <span className="text-3xl font-black text-blue-600 dark:text-blue-500 mt-2">
                  {items.filter(e => !["pulled", "audited", "pending_return", "returned", "damaged"].includes(e.status || "")).length}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1">Active items</span>
              </div>
              
              {(() => {
                const expiredCount = items.filter(e => {
                  if (["pulled", "audited", "pending_return", "returned", "damaged"].includes(e.status || "")) return false;
                  const exp = new Date(e.expiryDate);
                  exp.setHours(0,0,0,0);
                  const t = new Date();
                  t.setHours(0,0,0,0);
                  return exp < t;
                }).length;
                return (
                  <div className="p-4 bg-card rounded-xl border border-border shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Expired</span>
                    <span className={`text-3xl font-black mt-2 ${expiredCount > 0 ? "text-red-600 animate-pulse" : "text-muted-foreground"}`}>
                      {expiredCount}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-1">Requires pulling</span>
                  </div>
                );
              })()}

              {(() => {
                const soonCount = items.filter(e => {
                  if (["pulled", "audited", "pending_return", "returned", "damaged"].includes(e.status || "")) return false;
                  const exp = new Date(e.expiryDate);
                  exp.setHours(0,0,0,0);
                  const t = new Date();
                  t.setHours(0,0,0,0);
                  const tom = new Date(t);
                  tom.setDate(tom.getDate() + 1);
                  return exp.getTime() === t.getTime() || exp.getTime() === tom.getTime();
                }).length;
                return (
                  <div className="p-4 bg-card rounded-xl border border-border shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Expires 48h</span>
                    <span className="text-3xl font-black text-orange-500 mt-2">{soonCount}</span>
                    <span className="text-[10px] text-muted-foreground mt-1">Pull window close</span>
                  </div>
                );
              })()}

              <div className="p-4 bg-card rounded-xl border border-border shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Pulled</span>
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-500 mt-2">
                  {items.filter(e => e.status === "pulled").length}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1">Awaiting Audit</span>
              </div>
            </div>

            {/* Data Grid for Active Expiries */}
            <div className="w-full">
              <ExpiryDeckGrid 
                items={filteredExpiries.filter(e => !["pulled", "audited", "pending_return", "returned", "damaged"].includes(e.status || ""))} 
                searchQuery={searchQuery} 
                onAuditAction={handleSwipeAction} 
              />
            </div>

            {/* Modal for Item Details & Audit */}
            {selectedExpiry && (
              <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
                <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  {/* Modal Header */}
                  <div className="bg-slate-900 text-white p-6 relative">
                    <button 
                      onClick={() => setSelectedExpiry(null)}
                      className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
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
                      <div className="text-right flex flex-col items-end gap-2">
                        {isEditingExpiry ? (
                          <div className="text-left bg-slate-800 p-2 rounded-lg">
                            <label className="text-[10px] text-slate-400 font-bold block uppercase mb-1">New Quantity</label>
                            <input type="number" value={editExpiryQty} onChange={e => setEditExpiryQty(e.target.value)} className="w-16 p-1 text-slate-900 font-bold rounded text-center outline-none" />
                          </div>
                        ) : (
                          <div className="text-right">
                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Quantity</p>
                            <p className="text-2xl font-black text-green-400">{selectedExpiry.quantity}</p>
                          </div>
                        )}
                        <div className="mt-2 text-right bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Historical Context</p>
                          <p className="text-xs text-white font-medium">Avg Audited: 
                            <span className="ml-1 font-black text-emerald-400">
                              {getHistoricalExpiryAvg(selectedExpiry.barcode)} units/pull
                            </span>
                          </p>
                        </div>
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
              </div>
            )}
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
                        <td className="p-4 text-sm font-mono text-foreground">
                          {item.allDates ? (
                            <div className="flex flex-col gap-1">
                              {item.allDates.map((d: string, idx: number) => (
                                <span key={idx}>{d}</span>
                              ))}
                            </div>
                          ) : item.expiryDate}
                        </td>
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
        ) : activeTab === "already_expired" ? (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <h2 className="text-xl font-black mb-4">Already Expired Database</h2>
              <DataTable
                columns={[
                  {
                    accessorKey: "name",
                    header: "Item Name",
                    cell: ({ row }) => (
                      <div>
                        <div className="font-bold">{row.getValue("name") || "Unknown"}</div>
                        <div className="text-xs font-mono text-muted-foreground">{row.original.barcode || "N/A"}</div>
                      </div>
                    )
                  },
                  {
                    accessorKey: "quantity",
                    header: "Qty",
                    cell: ({ row }) => <span className="font-black">{row.getValue("quantity")}</span>
                  },
                  {
                    accessorKey: "storeId",
                    header: "Store",
                    cell: ({ row }) => <span className="text-sm font-medium">{row.getValue("storeId")}</span>
                  },
                  {
                    accessorKey: "date",
                    header: "Date Logged",
                    cell: ({ row }) => <span className="text-sm">{row.getValue("date")}</span>
                  },
                  {
                    accessorKey: "createdBy",
                    header: "Logged By",
                    cell: ({ row }) => <span className="text-sm">{row.getValue("createdBy")}</span>
                  }
                ]}
                data={alreadyExpired.filter(i => {
                  if (currentBranch === "all") return true;
                  const bId = (i.storeId || "").toLowerCase();
                  if (currentBranch === "ola") return bId.includes("ola") || bId.includes("koronfol");
                  return bId.includes("alamein");
                }).filter(i => 
                  (i.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (i.barcode || "").toLowerCase().includes(searchQuery.toLowerCase())
                )}
                searchPlaceholder="Search expired items..."
              />
            </div>
          </div>
        ) : activeTab === "waste" ? (
          <WasteAnalyticsPanel alreadyExpired={alreadyExpired} currentBranch={currentBranch} />
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


    </div>
    </PageTransition>
  );
}
