"use client";

import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Printer, Shield, ShieldAlert, Image as ImageIcon, ArrowLeftRight, Calendar, CheckCircle, ArrowLeft, TrendingUp, X, Clock } from "lucide-react";
import Barcode from "react-barcode";
import { useBranch } from "@/context/BranchContext";
import { DataTable } from "@/components/ui/DataTable";
import { PageTransition } from "@/components/PageTransition";
import { DrawerProfile } from "@/components/DrawerProfile";

export default function ManagerVoidsPage() {
  const [voids, setVoids] = useState<any[]>([]);
  const [selectedVoid, setSelectedVoid] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const { currentBranch } = useBranch();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "void_requests"), orderBy("createdAt", "desc"), limit(500));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory to avoid missing index errors
      data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setVoids(data);
      setLoading(false);
      setErrorMsg("");
    }, (error) => {
      console.error("Firestore error:", error);
      if (error.code === 'permission-denied') {
        setErrorMsg("Missing Permissions: You need to add 'void_requests' to your Firebase Firestore Rules.");
      } else {
        setErrorMsg(error.message);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const generatePDF = () => {
    if (!selectedVoid) return;
    const printContent = document.getElementById("void-print-capture");
    if (!printContent) return;

    // Create a new window for printing
    const printWindow = window.open('', '', 'width=900,height=800');
    if (!printWindow) {
      alert("Please allow popups to print reports.");
      return;
    }

    // Write the content to the new window and print
    printWindow.document.write(`
      <html>
        <head>
          <title>Void Report - ${selectedVoid.transactionNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@700&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 0;
              -webkit-print-color-adjust: exact !important; 
              color-adjust: exact !important; 
              print-color-adjust: exact !important; 
              background-color: white;
            }
            @page { 
              size: A4 portrait; 
              margin: 0; 
            }
            .print-page {
              width: 210mm;
              height: 297mm;
              padding: 15mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              background: white;
              position: relative;
              page-break-after: avoid;
              overflow: hidden;
            }
            .print-hide { display: none !important; }
          </style>
        </head>
        <body>
          <div class="print-page">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();

    // Give images a second to load before triggering print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const filteredVoids = voids.filter(v => {
    // Branch Filter (handle legacy voids which have no branchId)
    const matchesBranch = !v.branchId || v.branchId === currentBranch;

    // Text Filter
    const matchesSearch = (v.transactionNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.customerName || "").toLowerCase().includes(searchQuery.toLowerCase());

    return matchesBranch && matchesSearch;
  });

  const getCashierHistory = (cashierName: string, currentVoidId: string) => {
    if (!cashierName) return null;
    const pastVoids = voids.filter(v => (v.cashierName || "").trim() === cashierName.trim() && v.id !== currentVoidId).slice(0, 5);
    if (pastVoids.length === 0) return null;

    const avg = pastVoids.reduce((sum, v) => sum + Number(v.amount), 0) / pastVoids.length;
    return {
      count: pastVoids.length,
      avg: avg.toFixed(2)
    };
  };

  const handleDeletePhoto = async (photoIndex: number) => {
    if (!selectedVoid || !selectedVoid.attachedPhotos) return;
    if (!confirm("Are you sure you want to permanently delete this evidence photo?")) return;

    try {
      const updatedPhotos = selectedVoid.attachedPhotos.filter((_: any, i: number) => i !== photoIndex);
      await updateDoc(doc(db, "void_requests", selectedVoid.id), { attachedPhotos: updatedPhotos });
      setSelectedVoid({ ...selectedVoid, attachedPhotos: updatedPhotos });
      setVoids(voids.map(v => v.id === selectedVoid.id ? { ...v, attachedPhotos: updatedPhotos } : v));
    } catch (e) {
      console.error("Failed to delete photo", e);
      alert("Failed to delete photo");
    }
  };

  const cashierHistory = selectedVoid ? getCashierHistory(selectedVoid.cashierName, selectedVoid.id) : null;


  // ── Analytics ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = React.useState<"table" | "analytics">("table");

  const analyticsData = React.useMemo(() => {
    const branchVoids = currentBranch === "all" 
      ? voids 
      : voids.filter(v => !v.branchId || v.branchId === currentBranch);

    // Reason frequency — extract keywords from free-text reason field
    const reasonMap = new Map<string, number>();
    branchVoids.forEach(v => {
      const r = (v.reason || "Other").trim();
      // Normalize: take first 40 chars to bucket similar reasons
      const key = r.length > 0 ? r.substring(0, 40) : "Other";
      reasonMap.set(key, (reasonMap.get(key) || 0) + 1);
    });
    const topReasons = Array.from(reasonMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([reason, count]) => ({ reason, count }));

    // Cashier frequency
    const cashierMap = new Map<string, { count: number; total: number }>();
    branchVoids.forEach(v => {
      const name = v.cashierName || "Unknown";
      const prev = cashierMap.get(name) || { count: 0, total: 0 };
      cashierMap.set(name, { count: prev.count + 1, total: prev.total + Number(v.amount || 0) });
    });
    const topCashiers = Array.from(cashierMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, data]) => ({ name, ...data }));

    // Weekly trend — last 7 days
    const weekTrend: { day: string; count: number; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];
      const dayVoids = branchVoids.filter(v => (v.createdAt || "").startsWith(dayStr));
      weekTrend.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        count: dayVoids.length,
        total: dayVoids.reduce((s, v) => s + Number(v.amount || 0), 0),
      });
    }

    const totalAmount = branchVoids.reduce((s, v) => s + Number(v.amount || 0), 0);
    const avgAmount = branchVoids.length > 0 ? totalAmount / branchVoids.length : 0;
    const highValue = branchVoids.filter(v => Number(v.amount || 0) > 150).length;

    return { topReasons, topCashiers, weekTrend, totalAmount, avgAmount, highValue, total: branchVoids.length };
  }, [voids, currentBranch]);

  if (loading) {
    return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-600"></div></div>;
  }

  if (errorMsg) {
    return (
      <div className="max-w-3xl mx-auto mt-20 p-8 glass-panel border border-red-500 rounded-2xl text-center">
        <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-600 mb-2">Database Access Denied</h2>
        <p className="text-slate-700 dark:text-slate-300 mb-6 font-medium">{errorMsg}</p>
        <div className="bg-slate-900 text-left p-4 rounded-xl overflow-x-auto">
          <p className="text-slate-400 text-sm font-bold mb-2">To fix this, add this to your Firebase Firestore Rules:</p>
          <pre className="text-emerald-400 text-sm font-mono">
            {`match /void_requests/{document=**} {
  allow read, write: if true;
}`}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        
        {/* Sticky Blur Header */}
        <div className="sticky top-0 z-40 -mx-4 px-4 sm:mx-0 sm:px-0 py-4 bg-white/80 dark:bg-[#050810]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/50 mb-8">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
            Void & Return Requests
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Review and print customer return logs and receipts.</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm relative z-10">
          <DataTable
            columns={[
              {
                accessorKey: "createdAt",
                header: "Date/Time",
                cell: ({ row }) => {
                  const voidData = row.original;
                  return (
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-200">{voidData.preciseTimestamp || new Date(voidData.createdAt).toLocaleString('en-GB')}</div>
                      {Number(voidData.amount) > 150 && (
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.1)] dark:shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                          High Value
                        </span>
                      )}
                    </div>
                  );
                }
              },
              {
                accessorKey: "transactionNumber",
                header: "TXN #",
                cell: ({ row }) => <span className="font-mono text-slate-600 dark:text-slate-500 font-bold">{row.getValue("transactionNumber")}</span>
              },
              {
                accessorKey: "cashierName",
                header: "Cashier",
                cell: ({ row }) => <span className="font-semibold text-slate-700 dark:text-slate-300">{row.getValue("cashierName") || 'N/A'}</span>
              },
              {
                accessorKey: "customerName",
                header: "Customer",
                cell: ({ row }) => <span className="font-semibold text-slate-700 dark:text-slate-300">{row.getValue("customerName")}</span>
              },
              {
                accessorKey: "amount",
                header: "Amount",
                cell: ({ row }) => (
                  <span className={`font-mono font-bold ${Number(row.getValue("amount")) > 150 ? 'text-red-600 dark:text-red-500' : 'text-slate-900 dark:text-slate-200'}`}>
                    {Number(row.getValue("amount")).toFixed(2)} EGP
                  </span>
                )
              },
              {
                accessorKey: "status",
                header: "Status",
                cell: ({ row }) => {
                  const status = row.getValue("status") as string;
                  const isClosed = status === "closed_on_system";
                  return (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                      isClosed 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                    }`}>
                      {isClosed ? "Closed" : "Pending"}
                    </span>
                  );
                }
              },
              {
                id: "actions",
                cell: ({ row }) => (
                  <button
                    onClick={() => setSelectedVoid(row.original)}
                    className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-xs font-bold hover:bg-cyan-500/20 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all"
                  >
                    Review
                  </button>
                )
              }
            ]}
            data={filteredVoids}
            searchPlaceholder="Search by TXN, Cashier, or Customer..."
          />
        </div>

        {/* Detail Drawer */}
        {selectedVoid && (
          <DrawerProfile 
            isOpen={!!selectedVoid} 
            onClose={() => setSelectedVoid(null)} 
            title={`Void Details - ${selectedVoid.transactionNumber}`}
          >
            <div className="flex flex-col h-full space-y-6">
              
              {/* Drawer Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, "void_requests", selectedVoid.id), {
                        status: selectedVoid.status === "closed_on_system" ? "pending" : "closed_on_system"
                      });
                    } catch (e) {
                      console.error("Failed to update status", e);
                      alert("Failed to update status. Check permissions.");
                    }
                  }}
                  className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-bold transition-all ${
                    selectedVoid.status === "closed_on_system"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                      : "bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                  }`}
                >
                  {selectedVoid.status === "closed_on_system" ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  {selectedVoid.status === "closed_on_system" ? "Closed on System" : "Pending (Mark as Closed)"}
                </button>
                <button
                  onClick={generatePDF}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl font-bold hover:bg-cyan-500/20 hover:shadow-[0_0_15px_rgba(34,211,238,0.15)] transition-all"
                >
                  <Printer className="h-5 w-5" />
                  Print Official Record
                </button>
              </div>

              <div className="bg-white rounded-lg p-2 overflow-x-auto print-container-wrapper relative">
                <div id="void-print-capture" style={{ width: '800px', height: '1131px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', transform: 'scale(0.45)', transformOrigin: 'top left', marginBottom: '-55%' }}>

                  {/* Micro-Typography Security Borders */}
                  <div style={{ position: 'absolute', top: '-15mm', left: '-15mm', right: '-15mm', bottom: '-15mm', zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px', overflow: 'hidden' }}>
                    <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                      {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                    </div>
                    <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                      {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                    </div>
                  </div>
                  <div style={{ position: 'absolute', top: '-15mm', left: '-15mm', bottom: '-15mm', zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', padding: '4px', overflow: 'hidden', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                      {Array(35).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                    </div>
                  </div>
                  <div style={{ position: 'absolute', top: '-15mm', right: '-15mm', bottom: '-15mm', zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', padding: '4px', overflow: 'hidden', writingMode: 'vertical-rl' }}>
                    <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                      {Array(35).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                    </div>
                  </div>

                  {/* Automated Digital Audit Stamp (Giant Watermark) */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-35deg)', fontSize: '70px', fontWeight: '900', color: Number(selectedVoid.amount) > 500 ? 'rgba(220, 38, 38, 0.08)' : 'rgba(22, 163, 74, 0.06)', zIndex: 5, whiteSpace: 'nowrap', pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '5px' }}>
                    {Number(selectedVoid.amount) > 500 ? "SUSPICIOUS VOID" : "VOID AUTHORIZED"}
                  </div>

                  {/* Header Section */}
                  <div style={{ paddingBottom: '10px', borderBottom: '4px solid #1e293b', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ width: '60px', height: '60px', backgroundColor: '#dc2626', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '36px', fontWeight: '900', color: '#ffffff', lineHeight: 1 }}>K</span>
                      </div>
                      <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>OFFICIAL VOID RECORD</h1>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0', fontWeight: '600' }}>CIRCLE K ANH PORTAL</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', gap: '15px', alignItems: 'center' }}>
                      <div style={{ border: `3px solid ${Number(selectedVoid.amount) > 500 ? '#ef4444' : '#1e293b'}`, padding: '8px 12px', borderRadius: '8px', backgroundColor: Number(selectedVoid.amount) > 500 ? '#fef2f2' : '#f8fafc' }}>
                        <p style={{ margin: 0, fontSize: '10px', color: Number(selectedVoid.amount) > 500 ? '#dc2626' : '#475569', textTransform: 'uppercase', fontWeight: '800', textAlign: 'center', marginBottom: '2px' }}>Total Void Amount</p>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: Number(selectedVoid.amount) > 500 ? '#dc2626' : '#0f172a', fontFamily: '"JetBrains Mono", monospace' }}>EGP {Number(selectedVoid.amount).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Summary Sentence (Egyptian Arabic) */}
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRight: '4px solid #3b82f6', borderRadius: '8px', padding: '6px 10px', direction: 'rtl', textAlign: 'right', marginBottom: '10px', position: 'relative', zIndex: 10 }}>
                    <p style={{ margin: 0, fontSize: '10px', color: '#1e293b', lineHeight: 1.5, fontWeight: 'bold' }}>
                      <span style={{ color: '#3b82f6', marginLeft: '6px' }}>✦</span>
                      {(() => {
                        const amount = Number(selectedVoid.amount) || 0;
                        if (amount > 500) {
                          return "تحليل المرتجعات: الكاشير عمل مرتجع بقيمة كبيرة (أكتر من ٥٠٠ جنيه). لازم تتأكد إن البضاعة رجعت فعلاً للمخزن، وتراجع الكاميرات وقت العملية.";
                        } else if (amount > 100) {
                          return "تحليل المرتجعات: قيمة المرتجع متوسطة. برجاء مراجعة سبب المرتجع والتأكد من استلام البضاعة المرتجعة.";
                        } else {
                          return "تحليل المرتجعات: قيمة المرتجع صغيرة وطبيعية. تم تسجيل العملية، برجاء الاحتفاظ بالريسيت مع التقرير اليومي.";
                        }
                      })()}
                    </p>
                  </div>

                  {/* Meta Info Row */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', position: 'relative', zIndex: 10 }}>
                    <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800', marginBottom: '2px' }}>Cashier</span>
                      <span style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a' }}>{selectedVoid.cashierName || 'N/A'}</span>
                    </div>
                    <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800', marginBottom: '2px' }}>TXN Number</span>
                      <span style={{ fontSize: '13px', fontWeight: '900', fontFamily: '"JetBrains Mono", monospace', color: '#0f172a' }}>{selectedVoid.transactionNumber}</span>
                    </div>
                    <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800', marginBottom: '2px' }}>Time</span>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{selectedVoid.preciseTimestamp ? selectedVoid.preciseTimestamp : new Date(selectedVoid.createdAt).toLocaleString('en-GB')}</span>
                    </div>
                    <div style={{ flex: 1.5, backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ display: 'block', fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800', marginBottom: '2px' }}>Customer / Phone</span>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{selectedVoid.customerName} - {selectedVoid.customerPhone}</span>
                    </div>
                  </div>

                  {/* Middle Section: 2 Columns */}
                  <div style={{ display: 'flex', gap: '15px', flex: 1, minHeight: 0, position: 'relative', zIndex: 10 }}>

                    {/* Left Column: Reason & Items */}
                    <div style={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                      {/* Reason Box */}
                      <div style={{ padding: '10px', backgroundColor: '#f1f5f9', borderLeft: '4px solid #94a3b8', borderRadius: '0 4px 4px 0' }}>
                        <span style={{ display: 'block', fontSize: '10px', color: '#475569', textTransform: 'uppercase', fontWeight: '800', marginBottom: '4px' }}>Reason for Void/Return</span>
                        <div style={{ fontSize: '11px', lineHeight: 1.4, fontWeight: '500', color: '#0f172a' }}>
                          {selectedVoid.reason}
                        </div>
                      </div>

                      {/* Receipt Data Table */}
                      {selectedVoid.extractedReceipt && selectedVoid.extractedReceipt.items && (
                        <div style={{ border: '2px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
                          <div style={{ backgroundColor: '#f8fafc', padding: '6px 10px', borderBottom: '2px solid #cbd5e1', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#1e293b' }}>
                            Scanned Items List
                          </div>
                          <div style={{ padding: '6px', flex: 1, overflow: 'hidden' }}>
                            <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b' }}>
                                  <th style={{ textAlign: 'left', padding: '4px 2px', fontWeight: '800' }}>Item</th>
                                  <th style={{ textAlign: 'center', padding: '4px 2px', fontWeight: '800' }}>Qty</th>
                                  <th style={{ textAlign: 'right', padding: '4px 2px', fontWeight: '800' }}>Price</th>
                                  <th style={{ textAlign: 'right', padding: '4px 2px', fontWeight: '800' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedVoid.extractedReceipt.items.map((item: any, i: number) => {
                                  const isReturned = selectedVoid.selectedReturnedItems?.some((s: any) => s.desc === item.description);
                                  return (
                                    <tr key={i} style={{ backgroundColor: isReturned ? '#fef2f2' : 'transparent', borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '4px 2px', fontWeight: isReturned ? '800' : '500', color: isReturned ? '#991b1b' : '#0f172a' }}>{item.description} {isReturned ? '(VOID)' : ''}</td>
                                      <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: '600' }}>{item.quantity}</td>
                                      <td style={{ padding: '4px 2px', textAlign: 'right', color: '#475569' }}>{item.price}</td>
                                      <td style={{ padding: '4px 2px', textAlign: 'right', fontWeight: '800' }}>{item.total}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Right Column: Large Photo */}
                    <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ border: '2px solid #cbd5e1', borderRadius: '4px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                        <div style={{ backgroundColor: '#e2e8f0', padding: '6px 10px', borderBottom: '2px solid #cbd5e1', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', color: '#1e293b', letterSpacing: '1px' }}>
                          Physical Receipt Evidence
                        </div>
                        <div style={{ flex: 1, padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          {selectedVoid.attachedPhotos && selectedVoid.attachedPhotos.length > 0 ? (
                            <img src={selectedVoid.attachedPhotos[0]} style={{ width: '100%', height: '100%', objectFit: 'contain', border: '1px solid #e2e8f0', backgroundColor: 'white', padding: '4px' }} alt="Receipt Evidence" />
                          ) : (
                            <div style={{ color: '#94a3b8', fontSize: '14px', fontWeight: '800' }}>No Photo Attached</div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Footer Signatures */}
                  <div style={{ borderTop: '2px solid #1e293b', paddingTop: '10px', marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '10px', position: 'relative', zIndex: 10 }}>
                    <div style={{ width: '25%' }}>
                      <p style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cashier Signature</p>
                      {selectedVoid.cashierSignature ? (
                        <img src={selectedVoid.cashierSignature} alt="Signature" style={{ display: 'block', maxWidth: '100%', height: '40px', objectFit: 'contain', marginBottom: '2px' }} />
                      ) : (
                        <div style={{ height: '40px', marginBottom: '2px' }}></div>
                      )}
                      <div style={{ borderBottom: '2px solid #0f172a', width: '100%', marginBottom: '4px' }}></div>
                      <p style={{ fontSize: '11px', fontWeight: '900', margin: 0, textTransform: 'uppercase', color: '#0f172a' }}>{selectedVoid.cashierName}</p>
                    </div>

                    <div style={{ width: '20%', textAlign: 'center' }}>
                      <Barcode
                        value={selectedVoid.transactionNumber}
                        width={1.2}
                        height={35}
                        fontSize={10}
                        font="monospace"
                        margin={0}
                        background="#ffffff"
                        displayValue={true}
                      />
                    </div>

                    <div style={{ width: '25%' }}>
                      <p style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Manager Authorization</p>
                      <div style={{ height: '40px', marginBottom: '2px' }}></div>
                      <div style={{ borderBottom: '2px solid #0f172a', width: '100%', marginBottom: '4px' }}></div>
                      <p style={{ fontSize: '11px', fontWeight: '900', margin: 0, textTransform: 'uppercase', color: '#0f172a' }}>Signature / Stamp</p>
                    </div>

                    {/* Official Stamp Box */}
                    <div style={{ width: '20%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', height: '60px', border: '2px dashed #94a3b8', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                        <span style={{ fontSize: '8px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.5px' }}>Official Branch<br />Stamp / Seal</span>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Digital Forensics Footer */}
                  <div style={{ marginTop: 'auto', borderTop: '2px solid #1e293b', paddingTop: '6px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                    <p style={{ fontSize: '7px', color: '#475569', fontFamily: 'monospace', margin: 0, letterSpacing: '0.5px', fontWeight: 'bold' }}>
                      DOCUMENT VOID-{selectedVoid.id.substring(0, 10).toUpperCase()} | TXN: {selectedVoid.transactionNumber} | PRINTED: {new Date().toLocaleString('en-GB')} | SYSTEM: ANH PORTAL V2.0
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </DrawerProfile>
        )}
      </div>
    </PageTransition>
  );
}
