"use client";

import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Printer, Shield, Image as ImageIcon, ArrowLeftRight, Calendar, CheckCircle, ArrowLeft, TrendingUp, X, Clock } from "lucide-react";
import Barcode from "react-barcode";
import { useBranch } from "@/context/BranchContext";

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
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=JetBrains+Mono:wght@700&display=swap');
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
              margin: 10mm; 
            }
            /* Hide print headers/footers in some browsers */
            @media print {
              body { padding: 0; }
              #print-container { width: 100%; }
            }
          </style>
        </head>
        <body>
          <div id="print-container">
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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="border-b border-border pb-4 mb-8">
        <h1 className="text-3xl font-black text-foreground tracking-tight">Void & Return Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and print customer return logs and receipts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: List */}
        <div className={`lg:col-span-1 space-y-4 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar ${selectedVoid ? 'hidden lg:block' : 'block'}`}>
          <div className="sticky top-0 z-10 bg-background pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                ref={searchInputRef}
                type="text"
                placeholder="Search by TXN or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-12 py-3 rounded-xl border border-border bg-muted/50 focus:bg-background outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 hidden sm:block">
                ⌘K
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {filteredVoids.map(v => {
              const isHighValue = Number(v.amount) > 150;
              const isUrgent = v.status === "pending" && (Date.now() - new Date(v.createdAt).getTime() > 5 * 60 * 1000);
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVoid(v)}
                  className={`w-full text-left p-4 rounded-xl transition-all border relative ${
                    selectedVoid?.id === v.id 
                      ? "bg-slate-900 text-white border-slate-900 shadow-lg" 
                      : "glass-panel hover:border-slate-400"
                  } ${isUrgent ? 'breathing-urgency' : ''}`}
                >
                  {isHighValue && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border-2 border-white dark:border-slate-900 flex items-center gap-1 animate-pulse">
                      ⚠️ High Value
                    </div>
                  )}
                  {v.isDuplicateFlag && (
                    <div className="absolute -bottom-2 -left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border-2 border-white dark:border-slate-900 flex items-center gap-1">
                      ⚠️ Duplicate
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${selectedVoid?.id === v.id ? 'bg-slate-800' : 'bg-red-500/10 text-red-500 border border-red-200/20 dark:border-red-950/30'}`}>
                      {v.transactionNumber}
                    </span>
                    <span className={`font-mono font-bold ${isHighValue && selectedVoid?.id !== v.id ? 'text-red-500' : ''}`}>{Number(v.amount).toFixed(2)} EGP</span>
                  </div>
                  <p className="font-semibold text-sm truncate">{v.customerName}</p>
                  <div className="flex justify-between items-end mt-1">
                    <p className={`text-xs ${selectedVoid?.id === v.id ? 'text-slate-400' : 'text-muted-foreground'}`}>
                      {new Date(v.createdAt).toLocaleString('en-GB')}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      v.status === "closed_on_system" 
                        ? (selectedVoid?.id === v.id ? "bg-green-900/50 text-green-300" : "bg-green-100 text-green-700") 
                        : (selectedVoid?.id === v.id ? "bg-amber-900/50 text-amber-300" : "bg-amber-100 text-amber-700")
                    }`}>
                      {v.status === "closed_on_system" ? "Closed" : "Pending"}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredVoids.length === 0 && (
              <p className="text-center text-muted-foreground py-10">No requests found.</p>
            )}
          </div>
        </div>

        {/* Right Column: Details & PDF Template */}
        <div className={`lg:col-span-2 ${!selectedVoid ? 'hidden lg:block' : 'block'}`}>
          {selectedVoid ? (
            <div className="space-y-6">
              
              <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-start sm:items-center gap-4">
                <button 
                  className="lg:hidden flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground p-2 -ml-2 rounded-lg" 
                  onClick={() => setSelectedVoid(null)}
                >
                  <ArrowLeft className="h-4 w-4" /> Back to list
                </button>

                <div className="flex w-full sm:w-auto justify-end gap-3">
                  <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, "void_requests", selectedVoid.id), {
                        status: selectedVoid.status === "closed_on_system" ? "pending" : "closed_on_system"
                      });
                    } catch(e) {
                      console.error("Failed to update status", e);
                      alert("Failed to update status. Check permissions.");
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow transition-all ${
                    selectedVoid.status === "closed_on_system" 
                      ? "bg-green-100 text-green-700 hover:bg-green-200 border border-green-200" 
                      : "bg-amber-100 border border-amber-200 text-amber-700 hover:bg-amber-200"
                  }`}
                >
                  {selectedVoid.status === "closed_on_system" ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  {selectedVoid.status === "closed_on_system" ? "Closed on System" : "Pending (Mark as Closed)"}
                </button>
                <button
                  onClick={generatePDF}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-bold shadow-lg hover:bg-slate-800 transition-all"
                >
                  <Printer className="h-4 w-4" />
                  Print Void Report
                </button>
                </div>
              </div>

              {/* PDF Container - Hidden on screen, only used for innerHTML extraction, or styled beautifully for preview */}
              <div className="bg-card text-foreground p-8 shadow-2xl rounded-xl border border-border overflow-x-auto print:p-0 print:shadow-none print:border-none print:rounded-none">
                <div id="void-print-capture" style={{ width: '100%', maxWidth: '210mm', margin: '0 auto', backgroundColor: 'white', boxSizing: 'border-box', color: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  
                  {/* Header */}
                  <div style={{ borderBottom: '4px solid #dc2626', paddingBottom: '10px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h1 style={{ fontSize: '28px', fontWeight: '900', margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '-0.5px', color: '#0f172a' }}>VOID & RETURN</h1>
                      <h2 style={{ fontSize: '16px', fontWeight: '800', margin: '0', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '2px' }}>OFFICIAL RECORD</h2>
                      <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#475569', fontWeight: '600' }}>Circle K Franchise Enterprise</p>
                    </div>
                    <div style={{ textAlign: 'right', backgroundColor: '#f8fafc', padding: '10px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <p style={{ margin: '0 0 5px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Date Logged</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{new Date(selectedVoid.createdAt).toLocaleString('en-GB')}</p>
                    </div>
                  </div>

                  {/* Amount Highlight */}
                  <div style={{ backgroundColor: '#fef2f2', border: '2px solid #fca5a5', borderRadius: '12px', padding: '15px', textAlign: 'center', marginBottom: '15px' }}>
                    <p style={{ margin: '0 0 5px', fontSize: '12px', color: '#991b1b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '1px' }}>Total Amount Returned</p>
                    <p style={{ margin: 0, fontSize: '32px', fontWeight: '900', color: '#dc2626', fontFamily: '"JetBrains Mono", monospace' }}>EGP {Number(selectedVoid.amount).toFixed(2)}</p>
                  </div>

                  {/* Body Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                    
                    {/* Left Info */}
                    <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '8px 15px', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.5px' }}>Transaction Info</div>
                      <div style={{ padding: '15px' }}>
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '700' }}>Transaction Number</span>
                          <span style={{ fontSize: '15px', fontWeight: '800', fontFamily: '"JetBrains Mono", monospace', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>{selectedVoid.transactionNumber}</span>
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '700' }}>Register Used</span>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{selectedVoid.register}</span>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '700' }}>Cashier Name</span>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{selectedVoid.cashierName || 'N/A'}</span>
                        </div>
                        {/* Historical Context Inserted into PDF Preview for Manager Context */}
                        <div className="print:hidden mt-4 pt-4 border-t border-slate-200" style={{ display: cashierHistory ? 'block' : 'none' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '700' }}>
                            <TrendingUp className="w-3 h-3 text-blue-500" /> Historical Context
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                            Last {cashierHistory?.count} voids avg: <span style={{ color: '#dc2626', fontWeight: '800' }}>{cashierHistory?.avg} EGP</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Info */}
                    <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '8px 15px', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.5px' }}>Customer Info</div>
                      <div style={{ padding: '15px' }}>
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '700' }}>Customer Name</span>
                          <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>{selectedVoid.customerName}</span>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '700' }}>Customer Phone</span>
                          <span style={{ fontSize: '15px', fontWeight: '700', fontFamily: '"JetBrains Mono", monospace', color: '#0f172a' }}>{selectedVoid.customerPhone}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Reason Block */}
                  <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', marginBottom: '15px', overflow: 'hidden', pageBreakInside: 'avoid' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '8px 15px', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.5px' }}>Reason For Void / Return</div>
                    <div style={{ padding: '12px 15px', fontSize: '14px', lineHeight: 1.4, color: '#1e293b', fontWeight: '500', backgroundColor: '#ffffff', minHeight: '40px' }}>
                      {selectedVoid.reason}
                    </div>
                  </div>

                  {/* Attached Evidence Photos (Not Printed directly, but shown in UI) */}
                  {selectedVoid.attachedPhotos && selectedVoid.attachedPhotos.length > 0 && (
                    <div className="print:hidden mb-6 border-2 border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-bold uppercase text-slate-800">
                        Attached Evidence Photos ({selectedVoid.attachedPhotos.length})
                      </div>
                      <div className="p-4 bg-white grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {selectedVoid.attachedPhotos.map((photo: string, i: number) => (
                          <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-200 shadow-sm aspect-square bg-slate-100">
                            <img src={photo} className="w-full h-full object-cover" alt="Evidence" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                              <a href={photo} target="_blank" rel="noreferrer" className="text-white text-xs font-bold px-3 py-1 bg-blue-600 rounded-full hover:bg-blue-700">View</a>
                              <button onClick={() => handleDeletePhoto(i)} className="text-white text-xs font-bold px-3 py-1 bg-red-600 rounded-full hover:bg-red-700">Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Barcode block */}
                  <div style={{ textAlign: 'center', marginBottom: '15px', padding: '10px', backgroundColor: '#ffffff', borderRadius: '12px', border: '2px dashed #cbd5e1', pageBreakInside: 'avoid', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <p style={{ margin: '0 0 5px 0', fontSize: '12px', fontWeight: '900', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '2px' }}>SCAN BARCODE</p>
                    <Barcode 
                      value={selectedVoid.transactionNumber} 
                      width={2.2} 
                      height={60} 
                      fontSize={16} 
                      font="monospace" 
                      margin={5} 
                      background="#ffffff" 
                      displayValue={true} 
                    />
                  </div>

                  {/* Signatures */}
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', paddingTop: '10px', pageBreakInside: 'avoid' }}>
                    {/* Cashier Signature */}
                    <div style={{ width: '40%' }}>
                      <p style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Cashier Signature</p>
                      {selectedVoid.cashierSignature ? (
                        <img src={selectedVoid.cashierSignature} alt="Signature" style={{ display: 'block', maxWidth: '100%', height: '80px', objectFit: 'contain', marginBottom: '5px' }} />
                      ) : (
                        <div style={{ height: '80px', marginBottom: '5px' }}></div>
                      )}
                      <div style={{ borderBottom: '2px solid #0f172a', width: '100%', marginBottom: '5px' }}></div>
                      <p style={{ fontSize: '16px', fontWeight: '900', color: '#000000', margin: 0 }}>{selectedVoid.cashierName}</p>
                    </div>

                    {/* Manager Signature */}
                    <div style={{ width: '40%' }}>
                      <p style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Manager Authorization</p>
                      <div style={{ height: '80px', marginBottom: '5px' }}></div>
                      <div style={{ borderBottom: '2px solid #0f172a', width: '100%', marginBottom: '5px' }}></div>
                      <p style={{ fontSize: '16px', fontWeight: '900', color: '#000000', margin: 0 }}>__________________</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ marginTop: '15px', textAlign: 'center', pageBreakInside: 'avoid', borderTop: '2px solid #e2e8f0', paddingTop: '10px' }}>
                    <p style={{ fontSize: '11px', color: '#0f172a', margin: '0 0 3px 0', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      ⚠️ IMPORTANT REQUIREMENT
                    </p>
                    <p style={{ fontSize: '10px', color: '#475569', margin: 0, fontWeight: '600' }}>
                      BOTH THE ORIGINAL PURCHASE RECEIPT AND THE SYSTEM VOID/RETURN RECEIPT MUST BE STAPLED OR ATTACHED TO THIS FORM.
                    </p>
                  </div>

                </div>
              </div>

            </div>
          ) : (
            <div className="glass-panel p-10 flex flex-col items-center justify-center text-center rounded-2xl border border-border h-full min-h-[400px]">
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
                <ArrowLeftRight className="h-10 w-10 text-slate-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">No Request Selected</h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                Select a void or return request from the sidebar to view its full details and print the physical report.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
