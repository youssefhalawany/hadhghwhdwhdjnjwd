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

  // Direct/Manual Return state
  const [showManualReturn, setShowManualReturn] = useState(false);
  const [directSupplier, setDirectSupplier] = useState("");
  const [directItems, setDirectItems] = useState<{barcode: string, itemName: string, quantity: number, id: string}[]>([]);
  const [currentBarcode, setCurrentBarcode] = useState("");
  const [currentName, setCurrentName] = useState("");
  const [currentQty, setCurrentQty] = useState(1);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [allSuppliers, setAllSuppliers] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  
  useEffect(() => {
    // Fetch all products to cache for instant barcode lookups and extract suppliers
    const fetchProductsAndSuppliers = async () => {
      try {
        const snap = await getDocs(collection(db, "products"));
        const suppliers = new Set<string>();
        const productsMap: any[] = [];
        snap.forEach(doc => {
          const data = doc.data();
          if (data.supplier) suppliers.add(data.supplier);
          productsMap.push({ id: doc.id, ...data });
        });
        setAllSuppliers(Array.from(suppliers).sort());
        setAllProducts(productsMap);
      } catch (e) {
        console.error("Error fetching products:", e);
      }
    };
    fetchProductsAndSuppliers();
  }, []);

  useEffect(() => {
    const srQ = query(collection(db, "supplier_returns"), orderBy("createdAt", "desc"));
    const unsubSR = onSnapshot(srQ, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSupplierReturns(items);
      setLoading(false);
    });
    return () => unsubSR();
  }, []);

  const handleSearchProduct = (barcodeStr: string) => {
    if (!barcodeStr) return;
    setIsSearchingProduct(true);
    
    // Fast, local, robust search handling leading zeros and string/number types
    const cleanStr = barcodeStr.toString().trim();
    const strNoZero = cleanStr.replace(/^0+/, '');
    
    const match = allProducts.find(p => {
      if (!p.barcode) return false;
      const pBarcodeStr = String(p.barcode).trim();
      const pStrNoZero = pBarcodeStr.replace(/^0+/, '');
      return pBarcodeStr === cleanStr || pStrNoZero === strNoZero;
    });

    if (match) {
      setCurrentName(match.name || "");
      if (match.supplier && !directSupplier) {
        setDirectSupplier(match.supplier);
      }
    } else {
      setCurrentName("Unknown Item (Not in DB)");
    }
    
    setIsSearchingProduct(false);
  };
  
  const handleAddDirectItem = () => {
    if (!currentBarcode || !currentName || currentQty <= 0) return;
    setDirectItems([...directItems, {
      barcode: currentBarcode,
      itemName: currentName,
      quantity: currentQty,
      id: Date.now().toString()
    }]);
    setCurrentBarcode("");
    setCurrentName("");
    setCurrentQty(1);
  };

  const handleDirectReturnSubmit = async () => {
    if (!directSupplier || directItems.length === 0) {
      alert("Please select a supplier and add at least one item.");
      return;
    }
    if (!agentName.trim() || !agentNationalId.trim() || !agentMobile.trim()) {
      alert("Please fill in all Agent Information fields.");
      return;
    }

    try {
      setProcessing("direct_return");
      const savedUserStr = localStorage.getItem("active_cashier_session");
      let managerEmail = "Unknown Manager";
      if (savedUserStr) {
        const sessionData = JSON.parse(savedUserStr);
        managerEmail = sessionData.email || sessionData.name || "Unknown Manager";
      }

      const generatedReturnNumber = `RTV-${Date.now().toString().slice(-6)}`;
      const generatedReturnedAt = new Date().toISOString();
      const finalItems = [];

      for (const item of directItems) {
        const docRef = await addDoc(collection(db, "supplier_returns"), {
          barcode: item.barcode,
          itemName: item.itemName,
          category: "manual",
          supplier: directSupplier,
          quantity: item.quantity,
          storeId: currentBranch === "all" ? "eL-alamein-4" : (currentBranch === "ola" ? "ola-el-koronfol" : "eL-alamein-4"),
          branchId: currentBranch === "all" ? "alamein4" : currentBranch,
          status: "returned",
          createdAt: generatedReturnedAt,
          createdBy: managerEmail,
          returnedAt: generatedReturnedAt,
          returnNumber: generatedReturnNumber,
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
          id: docRef.id
        });
      }

      const receiptData = {
        supplier: directSupplier,
        date: new Date(generatedReturnedAt).toLocaleDateString('en-GB'),
        returnNumber: generatedReturnNumber,
        agentName,
        agentNationalId,
        agentMobile,
        items: finalItems,
        totalPrice: Number(totalPrice) || 0,
        settlementMethod,
        paymentTiming,
        expectedPaymentDate,
        isSettled: settlementMethod === "products" || paymentTiming === "now",
        eventIds: finalItems.map(i => i.id)
      };

      setPrintData(receiptData);
      
      setShowManualReturn(false);
      setDirectSupplier("");
      setDirectItems([]);
      setCurrentBarcode("");
      setCurrentName("");
      setCurrentQty(1);
      setAgentName("");
      setAgentNationalId("");
      setAgentMobile("");
      setTotalPrice("");
      setSettlementMethod("money");
      setPaymentTiming("now");
      setExpectedPaymentDate("");
    } catch (err: any) {
      alert("Failed to submit direct return: " + err.message);
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
      const generatedReturnNumber = `RTV-${Date.now().toString().slice(-6)}`;
      const generatedReturnedAt = new Date().toISOString();

      for (const item of handoverItems) {
        if (item.handoverQty > 0) {
          await updateDoc(doc(db, "supplier_returns", item.id), {
            status: "returned",
            quantity: item.handoverQty,
            returnedAt: generatedReturnedAt,
            returnNumber: generatedReturnNumber,
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
        date: new Date(generatedReturnedAt).toLocaleDateString('en-GB'),
        returnNumber: generatedReturnNumber,
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

  // Group settlements and history by Return Event
  const groupReturnEvents = (items: any[]) => {
    const groups: { [key: string]: any[] } = {};
    items.forEach(item => {
      // Use returnNumber if available, otherwise fallback to legacy grouping by supplier + agent + minute
      const key = item.returnNumber || `${item.supplier}_${item.agentName}_${item.totalPrice}_${item.returnedAt ? item.returnedAt.slice(0, 16) : 'legacy'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    // Convert to array and sort by latest returnedAt
    return Object.values(groups).sort((a, b) => {
      const dateA = a[0].returnedAt || "";
      const dateB = b[0].returnedAt || "";
      return dateB.localeCompare(dateA);
    });
  };

  const pendingSettlementEvents = groupReturnEvents(pendingSettlements);
  const returnHistoryEvents = groupReturnEvents(returnHistory);

  const viewReturnDetails = (eventItems: any[]) => {
    const first = eventItems[0];
    setPrintData({
      supplier: first.supplier,
      date: new Date(first.returnedAt || new Date()).toLocaleDateString('en-GB'),
      returnNumber: first.returnNumber || "LEGACY-RTV",
      agentName: first.agentName,
      agentNationalId: first.agentNationalId || "N/A",
      agentMobile: first.agentMobile || "N/A",
      items: eventItems,
      totalPrice: first.totalPrice || 0,
      settlementMethod: first.settlementMethod,
      paymentTiming: first.paymentTiming,
      expectedPaymentDate: first.expectedPaymentDate,
      isSettled: first.isSettled,
      eventIds: eventItems.map(i => i.id) // keep track of ids in case we need to settle them all
    });
  };


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
              <p className="text-sm text-muted-foreground mt-1">{lang === "ar" ? "إدارة عمليات تسليم المرتجعات، والتسويات المالية المعلقة، والتاريخ." : "Manage return handovers, pending financial settlements, and history."}</p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => setShowManualReturn(true)}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2"
            >
              + {lang === "ar" ? "مرتجع يدوي" : "Manual Return"}
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
                    <h3 className="text-lg font-bold">{lang === "ar" ? "لا توجد مرتجعات معلقة" : "No Pending Returns"}</h3>
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
                  pendingSettlementEvents.map((eventItems, idx) => {
                    const first = eventItems[0];
                    return (
                      <div key={idx} onClick={() => viewReturnDetails(eventItems)} className="bg-card border border-amber-500/30 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 cursor-pointer transition-colors group">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-lg">{first.supplier}</h4>
                            <span className="bg-amber-500 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">Awaiting Payment</span>
                            <span className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border border-border">{first.returnNumber || "Legacy Return"}</span>
                          </div>
                          <p className="text-sm font-semibold text-muted-foreground">Amount: <span className="text-foreground text-base">{first.totalPrice} EGP</span> • <span className="text-foreground">{eventItems.length} items</span></p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Handed over to: <span className="font-medium text-foreground">{first.agentName}</span> • 
                            Expected: <span className="font-medium text-foreground">{first.expectedPaymentDate || "Not set"}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              viewReturnDetails(eventItems);
                            }}
                            className="bg-background border border-border hover:bg-muted text-foreground font-bold py-2.5 px-4 rounded-xl text-sm transition-colors shrink-0 shadow-sm"
                          >
                            View Details
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!confirm("Confirm that you have received the pending payment/products for ALL items in this return?")) return;
                              eventItems.forEach(item => {
                                handleSettlePayment(item.id);
                              });
                            }}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors shrink-0 shadow-sm"
                          >
                            Mark as Paid
                          </button>
                        </div>
                      </div>
                    );
                  })
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
                  returnHistoryEvents.map((eventItems, idx) => {
                    const first = eventItems[0];
                    return (
                      <div key={idx} onClick={() => viewReturnDetails(eventItems)} className="bg-card border border-border rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 opacity-80 hover:opacity-100 hover:bg-muted/30 cursor-pointer transition-all">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-lg">{first.supplier}</h4>
                            <span className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border border-border">Settled</span>
                            <span className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border border-border">{first.returnNumber || "Legacy Return"}</span>
                          </div>
                          <p className="text-sm font-semibold text-muted-foreground">Amount: <span className="text-foreground">{first.totalPrice || 0} EGP</span> • <span className="text-foreground">{eventItems.length} items</span></p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Method: {first.settlementMethod === 'money' ? 'Cash/Transfer' : 'Products Exchange'} • 
                            Settled on: {new Date(first.settledAt || first.returnedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            viewReturnDetails(eventItems);
                          }}
                          className="bg-background border border-border hover:bg-muted text-foreground font-bold py-2.5 px-4 rounded-xl text-sm transition-colors shrink-0 shadow-sm"
                        >
                          View Receipt
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

          </div>
        )}

        {/* DIRECT (MANUAL) RETURN MODAL */}
        {showManualReturn && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[95vh]">
              <div className="p-6 border-b border-border bg-muted/30">
                <h3 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <Truck className="h-6 w-6 text-blue-500" />
                  {lang === "ar" ? "مرتجع مورد مباشر (يدوي)" : "Direct Supplier Return (Manual)"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{lang === "ar" ? "أدخل جميع الأصناف وبيانات المورد لإنشاء إيصال المرتجع فوراً." : "Input all items and supplier data to generate a return receipt immediately."}</p>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                {/* 1. Supplier Selection */}
                <div>
                  <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">{lang === "ar" ? "1. اختر المورد" : "1. Select Supplier"}</h4>
                  <div className="flex gap-2">
                    <select 
                      value={directSupplier}
                      onChange={e => setDirectSupplier(e.target.value)}
                      className="w-full md:w-1/2 p-3 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-bold"
                    >
                      <option value="" disabled>{lang === "ar" ? "-- اختر المورد --" : "-- Select a Supplier --"}</option>
                      {allSuppliers.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <input 
                      type="text" 
                      placeholder={lang === "ar" ? "أو اكتب اسم مورد جديد..." : "Or type new supplier name..."}
                      value={directSupplier}
                      onChange={e => setDirectSupplier(e.target.value)}
                      className="w-full md:w-1/2 p-3 border border-border rounded-xl bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                {/* 2. Items List */}
                <div>
                  <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">{lang === "ar" ? "2. إضافة أصناف المرتجع" : "2. Add Return Items"}</h4>
                  
                  <div className="flex flex-col md:flex-row gap-2 mb-4 p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "الباركود" : "Barcode"}</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={currentBarcode}
                          onChange={e => setCurrentBarcode(e.target.value)}
                          onBlur={() => handleSearchProduct(currentBarcode)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSearchProduct(currentBarcode);
                          }}
                          placeholder={lang === "ar" ? "امسح أو اكتب..." : "Scan or type..."}
                          className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 font-mono text-sm"
                        />
                        <button 
                          onClick={() => handleSearchProduct(currentBarcode)}
                          disabled={isSearchingProduct || !currentBarcode}
                          className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-3 rounded-lg text-sm font-bold disabled:opacity-50"
                        >
                          {isSearchingProduct ? "..." : "Find"}
                        </button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "اسم الصنف" : "Item Name"}</label>
                      <input 
                        type="text" 
                        value={currentName}
                        onChange={e => setCurrentName(e.target.value)}
                        placeholder="Item Name"
                        className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "الكمية" : "Qty"}</label>
                      <input 
                        type="number" 
                        min="1"
                        value={currentQty}
                        onChange={e => setCurrentQty(Number(e.target.value))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddDirectItem();
                        }}
                        className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-center font-bold"
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={handleAddDirectItem}
                        disabled={!currentBarcode || !currentName || currentQty <= 0}
                        className="h-[38px] px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {directItems.length > 0 ? (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 font-semibold">{lang === "ar" ? "اسم الصنف" : "Item Name"}</th>
                            <th className="p-3 font-semibold">{lang === "ar" ? "الباركود" : "Barcode"}</th>
                            <th className="p-3 font-semibold text-center">{lang === "ar" ? "الكمية" : "Qty"}</th>
                            <th className="p-3 font-semibold text-right">{lang === "ar" ? "إجراء" : "Action"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {directItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-muted/50">
                              <td className="p-3 font-medium">{item.itemName}</td>
                              <td className="p-3 font-mono text-muted-foreground">{item.barcode}</td>
                              <td className="p-3 text-center font-black text-lg">{item.quantity}</td>
                              <td className="p-3 text-right">
                                <button 
                                  onClick={() => setDirectItems(directItems.filter((_, i) => i !== idx))}
                                  className="text-red-500 hover:text-red-600 font-bold text-xs bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-lg"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/50">
                          <tr>
                            <td colSpan={2} className="p-3 font-bold text-right uppercase text-xs">{lang === "ar" ? "إجمالي الأصناف:" : "Total Items:"}</td>
                            <td className="p-3 text-center font-black text-xl">{directItems.reduce((sum, item) => sum + item.quantity, 0)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center border-2 border-dashed border-border rounded-xl text-muted-foreground">
                      {lang === "ar" ? "لم تتم إضافة أصناف بعد. قم بمسح باركود لإضافة أصناف لهذا المرتجع." : "No items added yet. Scan a barcode above to add items to this return."}
                    </div>
                  )}
                </div>

                {/* 3. Agent Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-border rounded-xl bg-muted/20">
                  <div className="col-span-1 md:col-span-2">
                    <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">{lang === "ar" ? "3. بيانات المندوب" : "3. Delivery Agent Info"}</h4>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "اسم المندوب" : "Agent Name"}</label>
                    <input 
                      type="text" 
                      value={agentName}
                      onChange={e => setAgentName(e.target.value)}
                      placeholder={lang === "ar" ? "الاسم الكامل" : "Full Name"}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "الرقم القومي" : "National ID"}</label>
                    <input 
                      type="text" 
                      value={agentNationalId}
                      onChange={e => setAgentNationalId(e.target.value)}
                      placeholder={lang === "ar" ? "الرقم القومي المكون من 14 رقم" : "14-digit ID"}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "رقم الموبايل" : "Mobile Number"}</label>
                    <input 
                      type="text" 
                      value={agentMobile}
                      onChange={e => setAgentMobile(e.target.value)}
                      placeholder={lang === "ar" ? "مثال: 01012345678" : "E.g. 01012345678"}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                {/* 4. Settlement Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-border rounded-xl bg-amber-500/5 border-amber-500/20">
                  <div className="col-span-1 md:col-span-2">
                    <h4 className="font-bold text-sm text-amber-700 dark:text-amber-500 uppercase tracking-wider">{lang === "ar" ? "4. تفاصيل التسوية والدفع" : "4. Settlement Details & Payment"}</h4>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "إجمالي القيمة المتوقعة (ج.م)" : "Total Expected Value (EGP)"}</label>
                    <input 
                      type="number" 
                      value={totalPrice}
                      onChange={e => setTotalPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder={lang === "ar" ? "إجمالي قيمة المرتجع" : "Total EGP Value of Return"}
                      className="w-full p-2 border border-amber-500/30 rounded-lg bg-background outline-none focus:border-amber-500 font-bold text-amber-600 text-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "طريقة التسوية" : "Settlement Method"}</label>
                    <select
                      value={settlementMethod}
                      onChange={e => setSettlementMethod(e.target.value as "money" | "products")}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    >
                      <option value="money">{lang === "ar" ? "نقدي (كاش/تحويل)" : "Money (Cash/Transfer)"}</option>
                      <option value="products">{lang === "ar" ? "بضاعة (استبدال)" : "Products (Exchange)"}</option>
                    </select>
                  </div>
                  {settlementMethod === "money" && (
                    <>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "وقت الدفع" : "Payment Timing"}</label>
                        <select
                          value={paymentTiming}
                          onChange={e => setPaymentTiming(e.target.value as "now" | "later")}
                          className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                        >
                          <option value="now">{lang === "ar" ? "تم الاستلام الآن (مسدد)" : "Received Now (Settled)"}</option>
                          <option value="later">{lang === "ar" ? "الدفع لاحقاً (معلق)" : "Will Pay Later (Pending)"}</option>
                        </select>
                      </div>
                      {paymentTiming === "later" && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "التاريخ المتوقع" : "Expected Date"}</label>
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
              
              <div className="p-6 bg-muted/50 flex justify-end gap-3 border-t border-border shrink-0">
                <button 
                  onClick={() => setShowManualReturn(false)}
                  className="px-6 py-3 rounded-xl font-bold bg-background text-foreground hover:bg-muted border border-border transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDirectReturnSubmit}
                  disabled={processing === "direct_return"}
                  className="px-8 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2 text-lg shadow-lg"
                >
                  {processing === "direct_return" ? "Processing..." : "Complete Return & Print Receipt"}
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
                        <th className="pb-2 font-semibold">{lang === "ar" ? "الباركود" : "Barcode"}</th>
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
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "اسم المندوب" : "Agent Name"}</label>
                    <input 
                      type="text" 
                      value={agentName}
                      onChange={e => setAgentName(e.target.value)}
                      placeholder={lang === "ar" ? "الاسم الكامل" : "Full Name"}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "الرقم القومي" : "National ID"}</label>
                    <input 
                      type="text" 
                      value={agentNationalId}
                      onChange={e => setAgentNationalId(e.target.value)}
                      placeholder={lang === "ar" ? "الرقم القومي المكون من 14 رقم" : "14-digit ID"}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "رقم الموبايل" : "Mobile Number"}</label>
                    <input 
                      type="text" 
                      value={agentMobile}
                      onChange={e => setAgentMobile(e.target.value)}
                      placeholder={lang === "ar" ? "مثال: 01012345678" : "E.g. 01012345678"}
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
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "طريقة التسوية" : "Settlement Method"}</label>
                    <select
                      value={settlementMethod}
                      onChange={e => setSettlementMethod(e.target.value as "money" | "products")}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    >
                      <option value="money">{lang === "ar" ? "نقدي (كاش/تحويل)" : "Money (Cash/Transfer)"}</option>
                      <option value="products">{lang === "ar" ? "بضاعة (استبدال)" : "Products (Exchange)"}</option>
                    </select>
                  </div>
                  {settlementMethod === "money" && (
                    <>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "وقت الدفع" : "Payment Timing"}</label>
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
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "التاريخ المتوقع" : "Expected Date"}</label>
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
                  {!printData.isSettled && printData.eventIds && (
                    <button 
                      onClick={() => {
                        if (!confirm("Confirm that you have received the pending payment/products for ALL items in this return?")) return;
                        printData.eventIds.forEach((id: string) => handleSettlePayment(id));
                        setPrintData(null);
                      }}
                      className="px-4 py-2 text-sm font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm"
                    >
                      Mark as Paid
                    </button>
                  )}
                  <button onClick={() => setPrintData(null)} className="px-4 py-2 text-sm font-bold border border-border rounded-lg hover:bg-muted">Close</button>
                  <button onClick={triggerPrint} className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm">
                    <Printer className="h-4 w-4" /> Print Invoice
                  </button>
                </div>
              </div>
              
              <div className="p-8 overflow-y-auto bg-white text-black print:p-0 print:block w-full" id="print-area" dir="ltr">
                <style dangerouslySetInnerHTML={{__html: `
                  @media print {
                    @page { size: A4; margin: 15mm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  }
                `}} />
                
                {/* Header: Logo & Title */}
                <div className="text-center mb-8 border-b-2 border-black pb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                      <span className="text-white font-black text-3xl">K</span>
                    </div>
                  </div>
                  <h1 className="text-3xl font-bold text-black mb-1">نموذج استلام مرتجعات</h1>
                  <h2 className="text-xl font-bold text-gray-700">Return Receipt Form</h2>
                </div>

                {/* Return Information Section */}
                <div className="mb-8 relative">
                  <div className="absolute top-0 right-0 left-0 flex justify-between items-center -mt-3">
                    <span className="bg-white pr-4 font-bold text-red-600 text-lg" dir="rtl">بيانات المرتجع</span>
                    <span className="bg-white pl-4 font-bold text-red-600 text-lg">Return Information</span>
                  </div>
                  <div className="border-t-2 border-red-600 pt-6">
                    <div className="grid grid-cols-3 gap-6 text-center text-black">
                      <div>
                        <div className="flex justify-between text-sm font-bold text-gray-500 mb-1"><span>Company</span><span>الشركة</span></div>
                        <div className="border-b-2 border-black pb-1 font-bold text-lg">{printData.supplier}</div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-gray-500 mb-1"><span>Return Number</span><span>رقم المرتجع</span></div>
                        <div className="border-b-2 border-black pb-1 font-bold text-lg tracking-wider">{printData.returnNumber}</div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-gray-500 mb-1"><span>Date</span><span>التاريخ</span></div>
                        <div className="border-b-2 border-black pb-1 font-bold text-lg tracking-wider">{printData.date}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Declaration Section */}
                <div className="mb-8 relative">
                  <div className="absolute top-0 right-0 left-0 flex justify-between items-center -mt-3">
                    <span className="bg-white pr-4 font-bold text-red-600 text-lg" dir="rtl">إقرار الاستلام</span>
                    <span className="bg-white pl-4 font-bold text-red-600 text-lg">Declaration</span>
                  </div>
                  <div className="border-t-2 border-red-600 pt-6 text-center">
                    <p className="font-bold text-xl text-black mb-1">والكميات الموجوده صحيحه ومطابقه للنظام وهذا إقرار منا بذلك</p>
                    <p className="font-bold text-lg text-gray-700">All quantities are correct and match the system records</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="mb-8">
                  <table className="w-full text-center border-collapse border-2 border-black text-black">
                    <thead>
                      <tr className="bg-gray-100 border-b-2 border-black">
                        <th className="py-2 border-r-2 border-black font-bold">
                          <div>الصنف</div>
                          <div className="text-xs text-gray-600">{lang === "ar" ? "اسم الصنف" : "Item Name"}</div>
                        </th>
                        <th className="py-2 border-r-2 border-black font-bold">
                          <div>الباركود</div>
                          <div className="text-xs text-gray-600">{lang === "ar" ? "الباركود" : "Barcode"}</div>
                        </th>
                        <th className="py-2 font-bold w-32">
                          <div>الكمية</div>
                          <div className="text-xs text-gray-600">Quantity</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-black">
                      {printData.items.map((item: any, i: number) => (
                        <tr key={i}>
                          <td className="py-3 border-r-2 border-black font-bold text-lg">{item.itemName}</td>
                          <td className="py-3 border-r-2 border-black font-mono font-bold tracking-wider">{item.barcode}</td>
                          <td className="py-3 font-black text-2xl">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 border-t-2 border-black font-black">
                        <td colSpan={2} className="py-3 border-r-2 border-black text-xl">
                          <div className="flex justify-between px-8">
                            <span>Total Items Returned</span>
                            <span>إجمالي المرتجعات</span>
                          </div>
                        </td>
                        <td className="py-3 text-2xl">
                          {printData.items.reduce((sum: number, item: any) => sum + item.quantity, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Agent Information Section */}
                <div className="mb-8 relative">
                  <div className="absolute top-0 right-0 left-0 flex justify-between items-center -mt-3">
                    <span className="bg-white pr-4 font-bold text-red-600 text-lg" dir="rtl">بيانات المندوب</span>
                    <span className="bg-white pl-4 font-bold text-red-600 text-lg">Agent Information</span>
                  </div>
                  <div className="border-t-2 border-red-600 pt-6">
                    <div className="grid grid-cols-3 gap-6 text-center text-black mb-4">
                      <div>
                        <div className="flex justify-between text-sm font-bold text-gray-500 mb-1"><span>{lang === "ar" ? "اسم المندوب" : "Agent Name"}</span><span>اسم المندوب</span></div>
                        <div className="border-b-2 border-black pb-1 font-bold text-lg">{printData.agentName}</div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-gray-500 mb-1"><span>{lang === "ar" ? "الرقم القومي" : "National ID"}</span><span>رقم البطاقة</span></div>
                        <div className="border-b-2 border-black pb-1 font-bold text-lg tracking-widest">{printData.agentNationalId}</div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-gray-500 mb-1"><span>Mobile</span><span>رقم الموبايل</span></div>
                        <div className="border-b-2 border-black pb-1 font-bold text-lg tracking-wider">{printData.agentMobile}</div>
                      </div>
                    </div>
                    <div className="text-center mt-6">
                      <p className="font-bold text-lg text-black" dir="rtl">* مرفق صورة البطاقة الخاصة بالمندوب *</p>
                      <p className="font-bold text-md text-gray-700">* Copy of Agent ID is attached *</p>
                    </div>
                  </div>
                </div>

                {/* Signatures Section */}
                <div className="mt-8 grid grid-cols-2 gap-16 text-black pt-4">
                  <div className="text-center px-8">
                    <div className="flex justify-between text-sm font-bold text-gray-500 mb-16">
                      <span>Agent Signature</span>
                      <span>توقيع المندوب</span>
                    </div>
                    <div className="border-b-2 border-black w-full"></div>
                  </div>
                  <div className="text-center px-8">
                    <div className="flex justify-between text-sm font-bold text-gray-500 mb-16">
                      <span>Receiver Signature</span>
                      <span>توقيع المستلم</span>
                    </div>
                    <div className="border-b-2 border-black w-full"></div>
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
