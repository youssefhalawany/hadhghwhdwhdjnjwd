"use client";

import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { Truck, CheckCircle, Search, Calendar, FileText, ArrowLeft, Printer } from "lucide-react";
import Barcode from "react-barcode";
import Link from "next/link";

export default function SupplierReturnsDashboard() {
  const { currentBranch } = useBranch();
  const { t, language: lang } = useLanguage();

  const [supplierReturns, setSupplierReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "settlements" | "history">("pending");

  // Handover state
  const [handoverSupplier, setHandoverSupplier] = useState<string | null>(null);
  const [handoverItems, setHandoverItems] = useState<any[]>([]);
  const [agentName, setAgentName] = useState("");
  const [agentNationalId, setAgentNationalId] = useState("");
  const [agentMobile, setAgentMobile] = useState("");
  const [totalPrice, setTotalPrice] = useState<number | "">("");
  const [settlementMethod, setSettlementMethod] = useState<"money" | "products">("money");
  const [paymentTiming, setPaymentTiming] = useState<"now" | "later">("now");
  const [expectedPaymentDate, setExpectedPaymentDate] = useState("");
  const [printData, setPrintData] = useState<any | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Manual Return state
  const [showManualReturn, setShowManualReturn] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState(1);
  const [manualSupplier, setManualSupplier] = useState("");
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);

  useEffect(() => {
    const srQ = query(collection(db, "supplier_returns"), orderBy("createdAt", "desc"));
    const unsubSR = onSnapshot(srQ, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSupplierReturns(items);
      setLoading(false);
    });
    return () => unsubSR();
  }, []);

  const handleSearchProduct = async (barcodeStr: string) => {
    if (!barcodeStr) return;
    setIsSearchingProduct(true);
    try {
      const q = query(collection(db, "products"), where("barcode", "==", barcodeStr));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setManualName(snap.docs[0].data().name || "");
      } else {
        setManualName("Unknown Item (Not in DB)");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingProduct(false);
    }
  };

  const handleManualReturnSubmit = async () => {
    if (!manualBarcode || !manualName || !manualSupplier || manualQty <= 0) {
      alert("Please fill in all fields correctly.");
      return;
    }
    try {
      setProcessing("manual_return");
      const savedUserStr = localStorage.getItem("active_cashier_session");
      let managerEmail = "Unknown Manager";
      if (savedUserStr) {
        const sessionData = JSON.parse(savedUserStr);
        managerEmail = sessionData.email || sessionData.name || "Unknown Manager";
      }

      await addDoc(collection(db, "supplier_returns"), {
        barcode: manualBarcode,
        itemName: manualName,
        category: "manual",
        supplier: manualSupplier,
        quantity: manualQty,
        storeId: currentBranch === "all" ? "eL-alamein-4" : (currentBranch === "ola" ? "ola-el-koronfol" : "eL-alamein-4"),
        branchId: currentBranch === "all" ? "alamein4" : currentBranch,
        status: "pending",
        createdAt: new Date().toISOString(),
        createdBy: managerEmail
      });
      setShowManualReturn(false);
      setManualBarcode("");
      setManualName("");
      setManualQty(1);
      setManualSupplier("");
      alert("Manual return added successfully!");
    } catch (err: any) {
      alert("Failed to add manual return: " + err.message);
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
            agentMobile,
            totalPrice: Number(totalPrice) || 0,
            settlementMethod,
            paymentTiming: settlementMethod === "money" ? paymentTiming : null,
            expectedPaymentDate: settlementMethod === "money" && paymentTiming === "later" ? expectedPaymentDate : null,
            isSettled: settlementMethod === "products" || paymentTiming === "now"
          });
          finalItems.push({
            ...item,
            quantity: item.handoverQty
          });
        } else {
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
        items: finalItems,
        totalPrice: Number(totalPrice) || 0,
        settlementMethod,
        paymentTiming,
        expectedPaymentDate
      };

      setPrintData(receiptData);
      
      // Cleanup modal BUT DO NOT clear printData yet
      setHandoverSupplier(null);
      setHandoverItems([]);
      setAgentName("");
      setAgentNationalId("");
      setAgentMobile("");
      setTotalPrice("");
      setSettlementMethod("money");
      setPaymentTiming("now");
      setExpectedPaymentDate("");
      
      // We will rely on a "Print" button in the printData view to actually trigger print,
      // avoiding the pop-up blocking issues.
    } catch (error) {
      console.error("Error processing handover:", error);
      alert("Failed to process handover.");
    } finally {
      setProcessing(null);
    }
  };

  const handleSettlePayment = async (id: string) => {
    if (!confirm("Confirm that you have received the pending payment/products for this return?")) return;
    try {
      await updateDoc(doc(db, "supplier_returns", id), {
        isSettled: true,
        settledAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error settling payment:", err);
      alert("Failed to mark settlement.");
    }
  };

  const triggerPrint = () => {
    window.print();
    setTimeout(() => {
        setPrintData(null);
    }, 1000);
  };

  // Filtering
  const filteredReturns = supplierReturns.filter(item => {
    if (currentBranch === "all") return true;
    if (item.branchId && item.branchId === currentBranch) return true;
    const inferred = (item.storeId || "").toLowerCase().includes("ola") || (item.storeId || "").toLowerCase().includes("koronfol") ? "ola" : "alamein4";
    return inferred === currentBranch || item.branchId === "all";
  });

  const pendingReturns = filteredReturns.filter(r => r.status === "pending" || r.status === "pending_return");
  const pendingSettlements = filteredReturns.filter(r => r.status === "returned" && r.isSettled === false);
  const returnHistory = filteredReturns.filter(r => r.status === "returned" && r.isSettled === true);

  // Group pending returns by supplier
  const returnsBySupplier = pendingReturns.reduce((acc: any, item) => {
    if (!acc[item.supplier]) acc[item.supplier] = [];
    acc[item.supplier].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 lg:pb-0">
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8 animate-in fade-in duration-300">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 border border-border rounded-2xl shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Supplier Returns</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage return handovers, pending financial settlements, and history.</p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => setShowManualReturn(true)}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2"
            >
              + Manual Return
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex bg-muted/50 p-1 rounded-xl border border-border w-full md:w-fit overflow-x-auto">
          <button 
            onClick={() => setActiveTab("pending")}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === "pending" ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            Pending Returns
            {pendingReturns.length > 0 && <span className="ml-2 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs">{pendingReturns.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab("settlements")}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === "settlements" ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            Pending Settlements
            {pendingSettlements.length > 0 && <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">{pendingSettlements.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === "history" ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            Return History
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div></div>
        ) : (
          <div className="space-y-6">
            
            {/* PENDING RETURNS */}
            {activeTab === "pending" && (
              <div className="space-y-6">
                {Object.keys(returnsBySupplier).length === 0 ? (
                  <div className="glass-panel p-16 text-center border-2 border-dashed border-border rounded-2xl">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold">No Pending Returns</h3>
                    <p className="text-muted-foreground text-sm mt-1">There are no items waiting to be returned to suppliers.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.keys(returnsBySupplier).map(supplier => {
                      const rItems = returnsBySupplier[supplier];
                      const totalQty = rItems.reduce((sum: number, i: any) => sum + i.quantity, 0);
                      return (
                        <div 
                          key={supplier}
                          onClick={() => {
                            setHandoverSupplier(supplier);
                            setHandoverItems(rItems.map((i: any) => ({ ...i, handoverQty: i.quantity })));
                            setAgentName("");
                            setAgentNationalId("");
                            setAgentMobile("");
                          }}
                          className="glass-panel p-6 rounded-xl border border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left flex flex-col justify-between cursor-pointer group"
                        >
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <h3 className="font-black text-xl">{supplier}</h3>
                              <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-xs font-bold px-2 py-1 rounded-full">{rItems.length} items</span>
                            </div>
                            <p className="text-sm font-semibold text-muted-foreground mb-4">Total Qty: <span className="text-foreground">{totalQty} units</span></p>
                          </div>
                          <button className="w-full bg-muted group-hover:bg-blue-600 group-hover:text-white text-foreground font-bold py-2 rounded-lg text-sm transition-colors">
                            Process Handover
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* PENDING SETTLEMENTS */}
            {activeTab === "settlements" && (
              <div className="space-y-4">
                {pendingSettlements.length === 0 ? (
                  <div className="glass-panel p-16 text-center border-2 border-dashed border-border rounded-2xl">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold">All Settled</h3>
                    <p className="text-muted-foreground text-sm mt-1">No supplier returns are awaiting financial settlement.</p>
                  </div>
                ) : (
                  pendingSettlements.map((item) => (
                    <div key={item.id} className="bg-card border border-amber-500/30 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm hover:border-amber-500/50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-lg">{item.supplier}</h4>
                          <span className="bg-amber-500 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">Awaiting Payment</span>
                        </div>
                        <p className="text-sm font-semibold text-muted-foreground">Amount: <span className="text-foreground text-base">{item.totalPrice} EGP</span></p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Handed over to: <span className="font-medium text-foreground">{item.agentName}</span> • 
                          Expected: <span className="font-medium text-foreground">{item.expectedPaymentDate || "Not set"}</span>
                        </p>
                      </div>
                      <button 
                        onClick={() => handleSettlePayment(item.id)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors shrink-0 shadow-sm"
                      >
                        Mark as Paid
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* RETURN HISTORY */}
            {activeTab === "history" && (
              <div className="space-y-4">
                {returnHistory.length === 0 ? (
                  <div className="glass-panel p-16 text-center border-2 border-dashed border-border rounded-2xl">
                    <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-bold">No History</h3>
                    <p className="text-muted-foreground text-sm mt-1">Settled supplier returns will appear here.</p>
                  </div>
                ) : (
                  returnHistory.map((item) => (
                    <div key={item.id} className="bg-card border border-border rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 opacity-75 hover:opacity-100 transition-opacity">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-lg">{item.supplier}</h4>
                          <span className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">Settled</span>
                        </div>
                        <p className="text-sm font-semibold text-muted-foreground">Amount: <span className="text-foreground">{item.totalPrice || 0} EGP</span></p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Method: {item.settlementMethod === 'money' ? 'Cash/Transfer' : 'Products Exchange'} • 
                          Settled on: {new Date(item.settledAt || item.returnedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        )}

        {/* MANUAL RETURN MODAL */}
        {showManualReturn && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border">
              <div className="p-6">
                <h3 className="text-xl font-bold mb-4">Manual Supplier Return</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Barcode</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={manualBarcode}
                        onChange={e => setManualBarcode(e.target.value)}
                        onBlur={() => handleSearchProduct(manualBarcode)}
                        placeholder="Scan or type barcode"
                        className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                      />
                      <button 
                        onClick={() => handleSearchProduct(manualBarcode)}
                        disabled={isSearchingProduct || !manualBarcode}
                        className="bg-muted px-4 rounded-lg text-sm font-bold hover:bg-muted/80 disabled:opacity-50"
                      >
                        {isSearchingProduct ? "..." : "Search"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Item Name</label>
                    <input 
                      type="text" 
                      value={manualName}
                      onChange={e => setManualName(e.target.value)}
                      placeholder="Item Name"
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Quantity</label>
                    <input 
                      type="number" 
                      min="1"
                      value={manualQty}
                      onChange={e => setManualQty(Number(e.target.value))}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Supplier Name</label>
                    <input 
                      type="text" 
                      value={manualSupplier}
                      onChange={e => setManualSupplier(e.target.value)}
                      placeholder="E.g. Juhayna, Coca-Cola..."
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 bg-muted/50 flex gap-3 justify-end border-t border-border">
                <button 
                  onClick={() => setShowManualReturn(false)}
                  className="px-6 py-2 rounded-xl font-bold bg-background text-foreground hover:bg-muted border border-border transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleManualReturnSubmit}
                  disabled={processing === "manual_return"}
                  className="px-6 py-2 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors text-sm disabled:opacity-50"
                >
                  {processing === "manual_return" ? "Adding..." : "Add to Pending Returns"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HANDOVER MODAL */}
        {handoverSupplier && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-border bg-muted/30">
                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-500" />
                  Supplier Handover
                </h3>
                <p className="text-sm text-muted-foreground">Supplier: <span className="font-bold text-foreground">{handoverSupplier}</span></p>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                <div>
                  <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">Items Being Returned</h4>
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-2 font-semibold">Item</th>
                        <th className="pb-2 font-semibold">Barcode</th>
                        <th className="pb-2 font-semibold text-right">Handover Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {handoverItems.map((item, index) => (
                        <tr key={item.id}>
                          <td className="py-3 font-medium">{item.itemName}</td>
                          <td className="py-3 font-mono text-muted-foreground">{item.barcode}</td>
                          <td className="py-3 text-right">
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
                              className="w-20 p-2 border border-border rounded-lg bg-background font-black outline-none focus:border-blue-500 text-center"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border border-border rounded-xl bg-muted/20">
                  <div className="col-span-1 md:col-span-2">
                    <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">Delivery Agent Info</h4>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Agent Name</label>
                    <input 
                      type="text" 
                      value={agentName}
                      onChange={e => setAgentName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">National ID</label>
                    <input 
                      type="text" 
                      value={agentNationalId}
                      onChange={e => setAgentNationalId(e.target.value)}
                      placeholder="14-digit ID"
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border border-border rounded-xl bg-muted/20">
                  <div className="col-span-1 md:col-span-2">
                    <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">Settlement Details</h4>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Total Expected (EGP)</label>
                    <input 
                      type="number" 
                      value={totalPrice}
                      onChange={e => setTotalPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Total EGP"
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Settlement Method</label>
                    <select
                      value={settlementMethod}
                      onChange={e => setSettlementMethod(e.target.value as "money" | "products")}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    >
                      <option value="money">Money (Cash/Transfer)</option>
                      <option value="products">Products (Exchange)</option>
                    </select>
                  </div>
                  {settlementMethod === "money" && (
                    <>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">Payment Timing</label>
                        <select
                          value={paymentTiming}
                          onChange={e => setPaymentTiming(e.target.value as "now" | "later")}
                          className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                        >
                          <option value="now">Received Now</option>
                          <option value="later">Will Pay Later</option>
                        </select>
                      </div>
                      {paymentTiming === "later" && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">Expected Date</label>
                          <input 
                            type="date" 
                            value={expectedPaymentDate}
                            onChange={e => setExpectedPaymentDate(e.target.value)}
                            className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t border-border bg-muted/30 flex justify-end gap-3 shrink-0">
                <button 
                  onClick={() => setHandoverSupplier(null)}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-background text-foreground hover:bg-muted border border-border transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={processHandover}
                  disabled={processing === "handover"}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {processing === "handover" ? (
                    "Processing..."
                  ) : (
                    <>
                      Confirm & Generate Receipt
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PRINTABLE RECEIPT MODAL */}
        {printData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-border bg-muted/50 flex justify-between items-center no-print">
                <h3 className="font-bold flex items-center gap-2 text-blue-500"><Printer className="h-5 w-5"/> Print Ready</h3>
                <div className="flex gap-2">
                  <button onClick={() => setPrintData(null)} className="px-4 py-2 text-sm font-bold border border-border rounded-lg hover:bg-muted">Close</button>
                  <button onClick={triggerPrint} className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <Printer className="h-4 w-4" /> Print Invoice
                  </button>
                </div>
              </div>
              
              <div className="p-8 overflow-y-auto bg-white text-black print:p-0 print:block" id="print-area">
                <div className="border-b-2 border-black pb-6 mb-8 flex justify-between items-end">
                  <div>
                    <h1 className="text-4xl font-black mb-2 uppercase tracking-tighter text-black">Supplier Return Invoice</h1>
                    <p className="text-lg font-bold text-gray-700">Company: {printData.supplier}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-black">{printData.returnNumber}</p>
                    <p className="font-semibold text-gray-600 mt-1">Date: {printData.date}</p>
                  </div>
                </div>

                <div className="mb-8 p-6 border-2 border-black rounded-xl bg-gray-50/50">
                  <h3 className="font-bold uppercase tracking-wider text-sm mb-4 border-b border-gray-300 pb-2 text-black">Delivery Agent Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-black">
                    <p><span className="font-bold text-gray-500">Name:</span> <span className="font-bold text-lg ml-2">{printData.agentName}</span></p>
                    <p><span className="font-bold text-gray-500">Mobile:</span> <span className="font-bold text-lg ml-2">{printData.agentMobile}</span></p>
                    <p className="col-span-2"><span className="font-bold text-gray-500">National ID:</span> <span className="font-bold text-lg ml-2 tracking-widest">{printData.agentNationalId}</span></p>
                  </div>
                </div>

                <table className="w-full text-left border-collapse mb-8 text-black">
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
                        <td className="py-4 px-4 font-mono text-gray-600">{item.barcode}</td>
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

                <div className="mt-16 pt-8 border-t-2 border-black grid grid-cols-2 gap-16 text-black">
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
          </div>
        )}

        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            #print-area, #print-area * { visibility: visible; }
            #print-area { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}} />

      </div>
    </div>
  );
}
