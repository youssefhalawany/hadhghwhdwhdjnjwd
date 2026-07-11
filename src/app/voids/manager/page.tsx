"use client";

import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Printer, Shield, Image as ImageIcon, ArrowLeftRight, Calendar, CheckCircle, ArrowLeft, TrendingUp, X, Clock } from "lucide-react";
import Barcode from "react-barcode";
import { useBranch } from "@/context/BranchContext";
import { DataTable } from "@/components/ui/DataTable";
import { PageTransition } from "@/components/PageTransition";

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
              .print-hide { display: none !important; }
            }
            .print-hide { display: none !important; } /* Fallback */
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
    <PageTransition>
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="border-b border-border pb-4 mb-8">
        <h1 className="text-3xl font-black text-foreground tracking-tight">Void & Return Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and print customer return logs and receipts.</p>
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
                    <div className="font-bold">{voidData.preciseTimestamp || new Date(voidData.createdAt).toLocaleString('en-GB')}</div>
                    {Number(voidData.amount) > 150 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-red-500 text-white rounded-full">High Value</span>
                    )}
                  </div>
                );
              }
            },
            {
              accessorKey: "transactionNumber",
              header: "TXN #",
              cell: ({ row }) => <span className="font-mono text-slate-500 font-bold">{row.getValue("transactionNumber")}</span>
            },
            {
              accessorKey: "cashierName",
              header: "Cashier",
              cell: ({ row }) => <span className="font-semibold">{row.getValue("cashierName") || 'N/A'}</span>
            },
            {
              accessorKey: "customerName",
              header: "Customer",
              cell: ({ row }) => <span className="font-semibold">{row.getValue("customerName")}</span>
            },
            {
              accessorKey: "amount",
              header: "Amount",
              cell: ({ row }) => (
                <span className={`font-mono font-bold ${Number(row.getValue("amount")) > 150 ? 'text-red-600' : ''}`}>
                  {Number(row.getValue("amount")).toFixed(2)} EGP
                </span>
              )
            },
            {
              accessorKey: "status",
              header: "Status",
              cell: ({ row }) => {
                const status = row.getValue("status") as string;
                return (
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                    status === "closed_on_system" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {status === "closed_on_system" ? "Closed" : "Pending"}
                  </span>
                );
              }
            },
            {
              id: "actions",
              cell: ({ row }) => (
                <button
                  onClick={() => setSelectedVoid(row.original)}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-slate-800 transition-colors"
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

      {/* Detail Modal */}
      {selectedVoid && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-4 sm:p-6 border-b border-border bg-muted/30">
                <h2 className="text-xl font-black flex items-center gap-2">
                  <span className="bg-red-500/10 text-red-500 p-2 rounded-lg"><ArrowLeftRight className="h-5 w-5" /></span>
                  Void/Return Review
                </h2>
                <div className="flex items-center gap-3">
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
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-bold shadow hover:bg-slate-800 transition-all"
                  >
                    <Printer className="h-4 w-4" />
                    Print PDF
                  </button>
                  <button
                    onClick={() => setSelectedVoid(null)}
                    className="p-2 bg-muted hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar bg-background">
                <div id="void-print-capture" style={{ width: '100%', maxWidth: '210mm', margin: '0 auto', backgroundColor: 'white', boxSizing: 'border-box', color: '#0f172a', padding: '15px', borderRadius: '8px' }}>
                  
                  {/* Header */}
                  <div style={{ borderBottom: '2px solid #dc2626', paddingBottom: '5px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <h1 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 2px 0', textTransform: 'uppercase', color: '#0f172a' }}>VOID & RETURN RECORD</h1>
                      <p style={{ margin: '0', fontSize: '10px', color: '#475569', fontWeight: '600' }}>Circle K Franchise Enterprise</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '0 0 2px', fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Time: {selectedVoid.preciseTimestamp ? selectedVoid.preciseTimestamp : new Date(selectedVoid.createdAt).toLocaleString('en-GB')}</p>
                      <p style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#dc2626', fontFamily: '"JetBrains Mono", monospace' }}>Total Returned: EGP {Number(selectedVoid.amount).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* 2-Column Main Body */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '10px' }}>
                    
                    {/* Left Column: Details & Items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      
                      {/* Info Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '6px' }}>
                          <span style={{ display: 'block', fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>TXN Number</span>
                          <span style={{ fontSize: '11px', fontWeight: '800', fontFamily: '"JetBrains Mono", monospace' }}>{selectedVoid.transactionNumber}</span>
                        </div>
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '6px' }}>
                          <span style={{ display: 'block', fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Register</span>
                          <span style={{ fontSize: '11px', fontWeight: '700' }}>{selectedVoid.register}</span>
                        </div>
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '6px' }}>
                          <span style={{ display: 'block', fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Customer</span>
                          <span style={{ fontSize: '11px', fontWeight: '700' }}>{selectedVoid.customerName}</span>
                        </div>
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '6px' }}>
                          <span style={{ display: 'block', fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Phone</span>
                          <span style={{ fontSize: '11px', fontWeight: '700', fontFamily: '"JetBrains Mono", monospace' }}>{selectedVoid.customerPhone}</span>
                        </div>
                      </div>

                      {/* Reason */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '6px' }}>
                        <span style={{ display: 'block', fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', marginBottom: '2px' }}>Reason for Void</span>
                        <div style={{ fontSize: '10px', lineHeight: 1.3, fontWeight: '500' }}>
                          {selectedVoid.reason}
                        </div>
                      </div>

                      {/* Extracted Receipt Data (Items) */}
                      {selectedVoid.extractedReceipt && selectedVoid.extractedReceipt.items && (
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden', flex: 1 }}>
                          <div style={{ backgroundColor: '#f8fafc', padding: '4px 6px', borderBottom: '1px solid #e2e8f0', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase' }}>
                            Scanned Receipt Items
                          </div>
                          <div style={{ padding: '4px' }}>
                            <table style={{ width: '100%', fontSize: '8px', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                                  <th style={{ textAlign: 'left', padding: '2px' }}>Item</th>
                                  <th style={{ textAlign: 'center', padding: '2px' }}>Qty</th>
                                  <th style={{ textAlign: 'right', padding: '2px' }}>Price</th>
                                  <th style={{ textAlign: 'right', padding: '2px' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedVoid.extractedReceipt.items.map((item: any, i: number) => {
                                  const isReturned = selectedVoid.selectedReturnedItems?.some((s:any) => s.desc === item.description);
                                  return (
                                    <tr key={i} style={{ backgroundColor: isReturned ? '#fee2e2' : 'transparent', borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '2px', fontWeight: isReturned ? '700' : '500', color: isReturned ? '#991b1b' : '#0f172a' }}>{item.description} {isReturned ? '(Returned)' : ''}</td>
                                      <td style={{ padding: '2px', textAlign: 'center' }}>{item.quantity}</td>
                                      <td style={{ padding: '2px', textAlign: 'right' }}>{item.price}</td>
                                      <td style={{ padding: '2px', textAlign: 'right', fontWeight: '700' }}>{item.total}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                              <div>
                                <div style={{ color: '#64748b' }}>Net: <span style={{ color: '#0f172a', fontWeight: '700' }}>{selectedVoid.extractedReceipt.net_amount || '0'} EGP</span></div>
                                <div style={{ color: '#64748b' }}>Tax: <span style={{ color: '#0f172a', fontWeight: '700' }}>{selectedVoid.extractedReceipt.tax_amount || '0'} EGP</span></div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ color: '#64748b', fontWeight: 'bold' }}>Receipt Total: <span style={{ color: '#0f172a', fontWeight: '900' }}>{selectedVoid.extractedReceipt.total_amount || '0'} EGP</span></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Evidence Photo */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {selectedVoid.attachedPhotos && selectedVoid.attachedPhotos.length > 0 ? (
                        <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '350px' }}>
                          <div style={{ backgroundColor: '#f8fafc', padding: '4px 6px', borderBottom: '1px solid #e2e8f0', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', textAlign: 'center' }}>
                            Original Receipt Evidence
                          </div>
                          <div style={{ flex: 1, padding: '5px', backgroundColor: '#f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <img src={selectedVoid.attachedPhotos[0]} style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain' }} alt="Receipt Evidence" />
                          </div>
                        </div>
                      ) : (
                        <div style={{ flex: 1, border: '1px dashed #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#94a3b8', fontSize: '12px', fontWeight: '600', minHeight: '350px' }}>
                          No Photo Evidence Attached
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Signatures & Barcode */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #e2e8f0', paddingTop: '10px', pageBreakInside: 'avoid' }}>
                    <div style={{ width: '30%' }}>
                      <p style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Cashier Signature</p>
                      {selectedVoid.cashierSignature ? (
                        <img src={selectedVoid.cashierSignature} alt="Signature" style={{ display: 'block', maxWidth: '100%', height: '40px', objectFit: 'contain', marginBottom: '2px' }} />
                      ) : (
                        <div style={{ height: '40px', marginBottom: '2px' }}></div>
                      )}
                      <div style={{ borderBottom: '1px solid #0f172a', width: '100%', marginBottom: '2px' }}></div>
                      <p style={{ fontSize: '11px', fontWeight: '900', margin: 0 }}>{selectedVoid.cashierName}</p>
                    </div>

                    <div style={{ width: '30%', textAlign: 'center' }}>
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

                    <div style={{ width: '30%' }}>
                      <p style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Manager Authorization</p>
                      <div style={{ height: '40px', marginBottom: '2px' }}></div>
                      <div style={{ borderBottom: '1px solid #0f172a', width: '100%', marginBottom: '2px' }}></div>
                      <p style={{ fontSize: '11px', fontWeight: '900', margin: 0 }}>__________________</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
      )}
    </div>
    </PageTransition>
  );
}
