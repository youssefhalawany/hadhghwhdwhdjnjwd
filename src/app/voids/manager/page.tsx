"use client";

import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, addDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Search, Printer, Shield, ShieldAlert, Image as ImageIcon, ArrowLeftRight, Calendar, CheckCircle, ArrowLeft, TrendingUp, X, Clock, XCircle, AlertCircle, Filter } from "lucide-react";
import Barcode from "react-barcode";
import { useBranch } from "@/context/BranchContext";
import { DataTable } from "@/components/ui/DataTable";
import { PageTransition } from "@/components/PageTransition";
import { DrawerProfile } from "@/components/DrawerProfile";
import { toast } from "sonner";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { playPopSound } from "@/lib/sounds";

export default function ManagerVoidsPage() {
  const [voids, setVoids] = useState<any[]>([]);
  const [selectedVoid, setSelectedVoid] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "closed" | "rejected">("all");
  const { currentBranch } = useBranch();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

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

  const handleUpdateStatus = async (targetVoid: any, newStatus: "closed_on_system" | "rejected" | "pending", customReason?: string) => {
    if (!targetVoid) return;
    setUpdatingStatus(true);
    triggerHapticFeedback([15, 30]);
    playPopSound();

    try {
      const updatePayload: any = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.email || "Manager Operations"
      };

      if (newStatus === "rejected") {
        updatePayload.rejectionReason = customReason || rejectReason || "Rejected by Manager";
        updatePayload.rejectedAt = new Date().toISOString();
      } else if (newStatus === "closed_on_system") {
        updatePayload.approvedAt = new Date().toISOString();
      }

      await updateDoc(doc(db, "void_requests", targetVoid.id), updatePayload);

      // Status Notification Dispatches
      const statusLabel = newStatus === "closed_on_system" 
        ? "APPROVED & CLOSED" 
        : newStatus === "rejected" 
        ? "REJECTED" 
        : "PENDING REVIEW";

      const notifTitle = newStatus === "closed_on_system" 
        ? "Void Return Approved 🚫" 
        : newStatus === "rejected" 
        ? "Void Request Rejected ❌" 
        : "Void Status Updated ⏳";

      const notifBody = `Void Inv #${targetVoid.invoiceNumber || targetVoid.id.substring(0,6)} for EGP ${Number(targetVoid.amount || 0).toLocaleString()} was ${statusLabel}.`;

      await addDoc(collection(db, "notifications"), {
        title: notifTitle,
        body: notifBody,
        createdAt: new Date().toISOString(),
        url: "/voids/manager",
        type: "void_updated"
      });

      fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: notifTitle,
          body: notifBody,
          url: "/voids/manager"
        })
      }).catch(err => console.debug("Push send error:", err));

      fetch("/api/notifications/notify-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: notifTitle,
          body: notifBody
        })
      }).catch(err => console.debug("Master notification error:", err));

      toast.success(`Void request ${targetVoid.transactionNumber} marked as ${statusLabel}!`);

      // Update local state
      const updatedVoidObj = { ...targetVoid, ...updatePayload };
      setSelectedVoid(updatedVoidObj);
      setShowRejectModal(false);
      setRejectReason("");

    } catch (e: any) {
      console.error("Failed to update status", e);
      toast.error("Failed to update status: " + (e.message || "Error"));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const generatePDF = () => {
    if (!selectedVoid) return;
    const printContent = document.getElementById("void-print-capture");
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=900,height=800');
    if (!printWindow) {
      alert("Please allow popups to print reports.");
      return;
    }

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

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const filteredVoids = voids.filter(v => {
    const matchesBranch = currentBranch === "all" || !v.branchId || v.branchId === currentBranch;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      (v.transactionNumber || "").toLowerCase().includes(q) ||
      (v.cashierName || "").toLowerCase().includes(q) ||
      (v.customerName || "").toLowerCase().includes(q) ||
      (v.reason || "").toLowerCase().includes(q);

    let matchesTab = true;
    if (filterTab === "pending") matchesTab = v.status !== "closed_on_system" && v.status !== "rejected";
    else if (filterTab === "closed") matchesTab = v.status === "closed_on_system";
    else if (filterTab === "rejected") matchesTab = v.status === "rejected";

    return matchesBranch && matchesSearch && matchesTab;
  });

  if (errorMsg) {
    return (
      <div className="p-8 text-center bg-rose-500/10 border border-rose-500/20 rounded-2xl max-w-2xl mx-auto my-12 text-rose-300">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-lg font-black mb-2">Firestore Security Rule Notice</h2>
        <p className="text-xs font-mono bg-black/40 p-3 rounded-lg border border-rose-500/20 text-left overflow-x-auto">{errorMsg}</p>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        
        {/* Sticky Blur Header */}
        <div className="sticky top-0 z-40 -mx-4 px-4 sm:mx-0 sm:px-0 py-4 bg-white/80 dark:bg-[#050810]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/50 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-amber-500" />
              Void & Return Requests
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Review, approve, or reject cashier return logs and print receipts.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                filterTab === "all"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                  : "bg-slate-100 dark:bg-[#0B1121] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
              }`}
            >
              All ({voids.length})
            </button>
            <button
              onClick={() => setFilterTab("pending")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                filterTab === "pending"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                  : "bg-slate-100 dark:bg-[#0B1121] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
              }`}
            >
              Pending ({voids.filter(v => v.status !== "closed_on_system" && v.status !== "rejected").length})
            </button>
            <button
              onClick={() => setFilterTab("closed")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                filterTab === "closed"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                  : "bg-slate-100 dark:bg-[#0B1121] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
              }`}
            >
              Approved ({voids.filter(v => v.status === "closed_on_system").length})
            </button>
            <button
              onClick={() => setFilterTab("rejected")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                filterTab === "rejected"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                  : "bg-slate-100 dark:bg-[#0B1121] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
              }`}
            >
              Rejected ({voids.filter(v => v.status === "rejected").length})
            </button>
          </div>
        </div>

        {/* Mobile View Cards (md:hidden) */}
        <div className="md:hidden space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">
              {filterTab.toUpperCase()} VOIDS ({filteredVoids.length})
            </span>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1 text-xs rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-cyan-400 w-36"
            />
          </div>

          {filteredVoids.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs rounded-2xl bg-white dark:bg-[#0B1121] border border-slate-200 dark:border-slate-800">
              No void requests found.
            </div>
          ) : (
            filteredVoids.map((v) => {
              const isClosed = v.status === "closed_on_system";
              const isRejected = v.status === "rejected";
              const isHighValue = Number(v.amount) > 150;

              return (
                <div
                  key={v.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0B1121] border border-slate-200 dark:border-slate-800 shadow-xl space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-cyan-600 dark:text-cyan-400">{v.transactionNumber}</span>
                        {isHighValue && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-sm animate-pulse">
                            HIGH VALUE
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">Cashier: {v.cashierName || "N/A"}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Reason: {v.reason || "N/A"}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-black font-mono text-slate-900 dark:text-white block">
                        {Number(v.amount || 0).toFixed(2)} EGP
                      </span>
                      <span className={`inline-block mt-1 text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${
                        isClosed 
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : isRejected
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      }`}>
                        {isClosed ? "Approved & Closed" : isRejected ? "Rejected ❌" : "Pending"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-[#1E293B] pt-2.5">
                    <span className="text-[10px] font-mono text-slate-400">
                      {v.preciseTimestamp || (v.createdAt ? new Date(v.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')}
                    </span>
                    <button
                      onClick={() => setSelectedVoid(v)}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 font-extrabold text-xs flex items-center gap-1.5 active:scale-95 transition-transform"
                    >
                      <Shield className="w-3.5 h-3.5" /> Review Details
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-4 sm:p-6 shadow-sm relative z-10">
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
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-full shadow-sm">
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
                cell: ({ row }) => <span className="font-mono text-slate-600 dark:text-slate-400 font-bold">{row.getValue("transactionNumber")}</span>
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
                  <span className={`font-mono font-bold ${Number(row.getValue("amount")) > 150 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-200'}`}>
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
                  const isRejected = status === "rejected";
                  return (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                      isClosed 
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                        : isRejected
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    }`}>
                      {isClosed ? "Closed" : isRejected ? "Rejected ❌" : "Pending"}
                    </span>
                  );
                }
              },
              {
                id: "actions",
                cell: ({ row }) => (
                  <button
                    onClick={() => setSelectedVoid(row.original)}
                    className="px-3 py-1.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 rounded-lg text-xs font-bold hover:bg-cyan-500/20 transition-all cursor-pointer"
                  >
                    Review
                  </button>
                )
              }
            ]}
            data={filteredVoids}
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
              
              {/* STATUS INDICATOR BANNER */}
              <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                selectedVoid.status === "closed_on_system"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : selectedVoid.status === "rejected"
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
                  : "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
              }`}>
                <span className="flex items-center gap-1.5 font-black">
                  {selectedVoid.status === "closed_on_system" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  {selectedVoid.status === "rejected" && <XCircle className="w-4 h-4 text-rose-500" />}
                  {(selectedVoid.status !== "closed_on_system" && selectedVoid.status !== "rejected") && <Clock className="w-4 h-4 text-amber-500" />}
                  {selectedVoid.status === "closed_on_system" ? "APPROVED & CLOSED ON SYSTEM" : selectedVoid.status === "rejected" ? "REJECTED BY MANAGER" : "PENDING MANAGER REVIEW"}
                </span>

                {selectedVoid.status === "rejected" && selectedVoid.rejectionReason && (
                  <span className="text-[10px] font-mono opacity-80 max-w-[180px] truncate">
                    Reason: {selectedVoid.rejectionReason}
                  </span>
                )}
              </div>

              {/* ACTION BUTTONS (APPROVE, REJECT, PENDING, PRINT) */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  disabled={updatingStatus}
                  onClick={() => handleUpdateStatus(selectedVoid, "closed_on_system")}
                  className={`px-3.5 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    selectedVoid.status === "closed_on_system"
                      ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  }`}
                >
                  <CheckCircle className="w-4 h-4" /> Approve & Close
                </button>

                <button
                  disabled={updatingStatus}
                  onClick={() => setShowRejectModal(true)}
                  className={`px-3.5 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    selectedVoid.status === "rejected"
                      ? "bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                  }`}
                >
                  <XCircle className="w-4 h-4" /> Reject Void Request
                </button>

                {selectedVoid.status && selectedVoid.status !== "pending" && (
                  <button
                    disabled={updatingStatus}
                    onClick={() => handleUpdateStatus(selectedVoid, "pending")}
                    className="col-span-2 px-3.5 py-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-500/20 transition-all cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" /> Reset Status to Pending
                  </button>
                )}

                <button
                  onClick={generatePDF}
                  className="col-span-2 px-3.5 py-3 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-cyan-500/20 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print Official Record
                </button>
              </div>

              {/* Printable Record Capture Preview */}
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

                  {/* Automated Digital Audit Stamp (Giant Watermark) */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-35deg)', fontSize: '65px', fontWeight: '900', color: selectedVoid.status === "rejected" ? 'rgba(225, 29, 72, 0.12)' : selectedVoid.status === "closed_on_system" ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', zIndex: 5, whiteSpace: 'nowrap', pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '5px' }}>
                    {selectedVoid.status === "rejected" ? "VOID REJECTED ❌" : selectedVoid.status === "closed_on_system" ? "VOID AUTHORIZED & CLOSED" : "PENDING REVIEW"}
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
                      <div style={{ border: `3px solid ${selectedVoid.status === "rejected" ? '#ef4444' : '#1e293b'}`, padding: '8px 12px', borderRadius: '8px', backgroundColor: selectedVoid.status === "rejected" ? '#fef2f2' : '#f8fafc' }}>
                        <p style={{ margin: 0, fontSize: '10px', color: selectedVoid.status === "rejected" ? '#dc2626' : '#475569', textTransform: 'uppercase', fontWeight: '800', textAlign: 'center', marginBottom: '2px' }}>Total Void Amount</p>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: selectedVoid.status === "rejected" ? '#dc2626' : '#0f172a', fontFamily: '"JetBrains Mono", monospace' }}>EGP {Number(selectedVoid.amount).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Metadata Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 2px 0' }}>Transaction #</p>
                      <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: 0, fontFamily: 'monospace' }}>{selectedVoid.transactionNumber}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 2px 0' }}>Status</p>
                      <p style={{ fontSize: '14px', fontWeight: 'bold', color: selectedVoid.status === 'rejected' ? '#dc2626' : selectedVoid.status === 'closed_on_system' ? '#16a34a' : '#d97706', margin: 0, textTransform: 'uppercase' }}>
                        {selectedVoid.status === "closed_on_system" ? "APPROVED & CLOSED" : selectedVoid.status === "rejected" ? `REJECTED (${selectedVoid.rejectionReason || "Manager Decision"})` : "PENDING REVIEW"}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 2px 0' }}>Cashier</p>
                      <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{selectedVoid.cashierName || 'N/A'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 2px 0' }}>Customer</p>
                      <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{selectedVoid.customerName || 'Walk-in'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 2px 0' }}>Reason</p>
                      <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{selectedVoid.reason || 'N/A'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 2px 0' }}>Logged Timestamp</p>
                      <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{selectedVoid.preciseTimestamp || selectedVoid.createdAt}</p>
                    </div>
                  </div>

                  {/* Attached Photos */}
                  {selectedVoid.attachedPhotos && selectedVoid.attachedPhotos.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>Attached Proof Image:</p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {selectedVoid.attachedPhotos.map((photo: string, i: number) => (
                          <img key={i} src={photo} alt={`Proof ${i}`} style={{ maxHeight: '200px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer Seal */}
                  <div style={{ marginTop: 'auto', paddingTop: '15px', borderTop: '2px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>
                      <p style={{ margin: 0 }}>OFFICIAL AUDIT REPORT • CIRCLE K FRANCHISE</p>
                      <p style={{ margin: '2px 0 0' }}>Generated by ANH Reports Operations Portal</p>
                    </div>
                    <div style={{ textAlign: 'center', width: '150px' }}>
                      <div style={{ height: '35px', borderBottom: '1px solid #94a3b8', marginBottom: '4px' }}></div>
                      <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>Manager Authorization</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </DrawerProfile>
        )}

        {/* REJECTION REASON PROMPT MODAL */}
        {showRejectModal && selectedVoid && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-white dark:bg-[#0B1121] border border-slate-200 dark:border-[#1E293B] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-900 dark:text-white">
              
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <XCircle className="w-5 h-5" /> Reject Void Request
                </h3>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                Provide a reason for rejecting void request <strong className="font-mono text-cyan-600 dark:text-cyan-400">#{selectedVoid.transactionNumber}</strong> (EGP {Number(selectedVoid.amount || 0).toFixed(2)}):
              </p>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Invalid Receipt",
                  "Duplicate Request",
                  "Customer Cancelled",
                  "Unverified Item Error",
                  "Policy Violation"
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectReason(preset)}
                    className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-100 dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] hover:border-rose-500/40 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection explanation for cashier..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-[#0F172A] border border-slate-300 dark:border-[#1E293B] text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 resize-none"
              />

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-200 dark:bg-[#1E293B] text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={updatingStatus}
                  onClick={() => handleUpdateStatus(selectedVoid, "rejected", rejectReason || "Rejected by Manager")}
                  className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
