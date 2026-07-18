"use client";

import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { Truck, CheckCircle, Search, Calendar, FileText, ArrowLeft, Printer, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { PageTransition } from "@/components/PageTransition";

export default function SupplierReturnsDashboard() {
  const { currentBranch } = useBranch();
  const { t, language: lang } = useLanguage();

  const [supplierReturns, setSupplierReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "settlements" | "history">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setActiveTab("history");
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  const [transferOutNumber, setTransferOutNumber] = useState("");
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
    // Derive all suppliers from the existing supplierReturns cache
    // This costs 0 extra reads!
    const suppliers = new Set<string>();
    supplierReturns.forEach(r => {
      if (r.supplier) suppliers.add(r.supplier);
    });
    setAllSuppliers(Array.from(suppliers).sort());
  }, [supplierReturns]);

  useEffect(() => {
    const srQ = query(collection(db, "supplier_returns"), orderBy("createdAt", "desc"), limit(100));
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
      const cleanStr = barcodeStr.toString().trim();
      
      // Query Firestore for this exact barcode (Costs 1 read instead of thousands)
      const q1 = query(collection(db, "products"), where("barcode", "==", cleanStr), limit(1));
      const snap1 = await getDocs(q1);
      
      if (!snap1.empty) {
        const match = snap1.docs[0].data();
        setCurrentName(match.description || match.name || match.itemName || "");
        if (match.supplier && !directSupplier) {
          setDirectSupplier(match.supplier);
        }
      } else {
        // Try stripping leading zeros
        const strNoZero = cleanStr.replace(/^0+/, '');
        if (strNoZero !== cleanStr) {
          const q2 = query(collection(db, "products"), where("barcode", "==", strNoZero), limit(1));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) {
            const match = snap2.docs[0].data();
            setCurrentName(match.description || match.name || match.itemName || "");
            if (match.supplier && !directSupplier) {
              setDirectSupplier(match.supplier);
            }
            setIsSearchingProduct(false);
            return;
          }
        }
        setCurrentName("Unknown Item (Not in DB)");
      }
    } catch (err) {
      console.error(err);
      setCurrentName("Unknown Item (Not in DB)");
    }
    
    setIsSearchingProduct(false);
  };
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentBarcode && currentBarcode.trim().length > 3) {
        handleSearchProduct(currentBarcode);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [currentBarcode]);
  
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
    if (!directSupplier) {
      alert("Please select a supplier.");
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

      const itemsToProcess = directItems.length > 0 ? directItems : [{
        barcode: "N/A",
        itemName: lang === "ar" ? "مطابق لمستند التحويل" : "Matches Transfer Out Document",
        quantity: 0,
        id: "dummy"
      }];

      for (const item of itemsToProcess) {
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
          transferOutNumber,
          agentName,
          agentNationalId,
          agentMobile,
          totalPrice: Number(totalPrice) || 0,
          settlementMethod,
          paymentTiming: paymentTiming,
          expectedPaymentDate: paymentTiming === "later" ? expectedPaymentDate : null,
          isSettled: paymentTiming === "now"
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
        transferOutNumber,
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
      setTransferOutNumber("");
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
            transferOutNumber,
            agentName,
            agentNationalId,
            agentMobile,
            totalPrice: Number(totalPrice) || 0,
            settlementMethod,
            paymentTiming: paymentTiming,
            expectedPaymentDate: paymentTiming === "later" ? expectedPaymentDate : null,
            isSettled: paymentTiming === "now"
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
        expectedPaymentDate,
        transferOutNumber
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
      setTransferOutNumber("");
      
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

  const handleDeleteReturn = async () => {
    if (!printData || !printData.eventIds) return;
    if (!confirm(lang === "ar" ? "هل أنت متأكد من حذف هذه الفاتورة نهائياً؟ لا يمكن التراجع عن هذا الإجراء." : "Are you sure you want to permanently delete this entire return invoice and all its items? This action cannot be undone.")) return;
    try {
      setProcessing("delete");
      for (const id of printData.eventIds) {
        await deleteDoc(doc(db, "supplier_returns", id));
      }
      setPrintData(null);
    } catch (err) {
      console.error("Error deleting return:", err);
      alert("Failed to delete the return.");
    } finally {
      setProcessing(null);
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

  const pendingSettlementEvents = groupReturnEvents(pendingSettlements).filter(eventItems => {
    const first = eventItems[0];
    const sStr = searchQuery.toLowerCase();
    return (first.supplier || "").toLowerCase().includes(sStr) ||
           (first.returnNumber || "").toLowerCase().includes(sStr);
  });
  
  const returnHistoryEventsRaw = groupReturnEvents(returnHistory);
  
  const returnHistoryEvents = returnHistoryEventsRaw.filter(eventItems => {
    const first = eventItems[0];
    const sStr = searchQuery.toLowerCase();
    return (first.supplier || "").toLowerCase().includes(sStr) ||
           (first.returnNumber || "").toLowerCase().includes(sStr);
  });

  const getSupplierTotalReturns = (supplierName: string) => {
    if (!supplierName) return { count: 0, total: 0 };
    const supplierEvents = returnHistoryEventsRaw.filter(ev => ev[0]?.supplier === supplierName);
    const count = supplierEvents.length;
    const total = supplierEvents.reduce((sum, ev) => sum + (Number(ev[0].totalPrice) || 0), 0);
    return { count, total };
  };

  const totalPendingMoney = pendingSettlementEvents.reduce((sum, ev) => sum + (Number(ev[0].totalPrice) || 0), 0);
  const totalSettledMoney = returnHistoryEvents.reduce((sum, ev) => sum + (Number(ev[0].totalPrice) || 0), 0);

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
      transferOutNumber: first.transferOutNumber,
      isSettled: first.isSettled,
      eventIds: eventItems.map(i => i.id) // keep track of ids in case we need to settle them all
    });
  };


  return (
    <PageTransition>
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

        {/* CORPORATE STATS & TABS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-amber-100 font-semibold text-sm uppercase tracking-wider mb-1">Pending Returns</p>
              <h3 className="text-3xl font-black">{pendingReturns.length} <span className="text-base font-medium opacity-80">items</span></h3>
            </div>
            <Truck className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-10" />
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-blue-100 font-semibold text-sm uppercase tracking-wider mb-1">Pending Settlements</p>
              <h3 className="text-3xl font-black">{totalPendingMoney.toLocaleString()} <span className="text-base font-medium opacity-80">EGP</span></h3>
            </div>
            <FileText className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-10" />
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-emerald-100 font-semibold text-sm uppercase tracking-wider mb-1">Settled History</p>
              <h3 className="text-3xl font-black">{totalSettledMoney.toLocaleString()} <span className="text-base font-medium opacity-80">EGP</span></h3>
            </div>
            <CheckCircle className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-10" />
          </div>
        </div>

        <div className="flex bg-muted/30 p-1.5 rounded-2xl border border-border w-full shadow-sm overflow-x-auto">
          <button 
            onClick={() => setActiveTab("pending")}
            className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === "pending" ? "bg-background text-blue-600 shadow-md border-b-2 border-blue-600" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            Pending Returns
          </button>
          <button 
            onClick={() => setActiveTab("settlements")}
            className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === "settlements" ? "bg-background text-amber-600 shadow-md border-b-2 border-amber-500" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            Pending Settlements
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === "history" ? "bg-background text-emerald-600 shadow-md border-b-2 border-emerald-500" : "text-muted-foreground hover:bg-muted/50"}`}
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
                <div className="sticky top-0 z-10 bg-background pb-2">
                  <div className="relative">
                    <input 
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search by Supplier or Return Number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-3 pl-10 rounded-xl border border-border bg-muted/50 focus:bg-background outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <kbd className="hidden sm:inline-flex items-center gap-1 bg-background border border-border px-1.5 rounded text-[10px] font-bold text-muted-foreground uppercase shadow-sm">
                        <span className="text-[12px]">⌘</span>K
                      </kbd>
                    </div>
                  </div>
                </div>

                {pendingSettlementEvents.length === 0 ? (
                  <div className="glass-panel p-16 text-center border-2 border-dashed border-border rounded-2xl">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold">All Settled</h3>
                    <p className="text-muted-foreground text-sm mt-1">No supplier returns are awaiting financial settlement.</p>
                  </div>
                ) : (
                  pendingSettlementEvents.map((eventItems, idx) => {
                    const first = eventItems[0];
                    const isHighValue = first.totalPrice > 500;
                    return (
                      <div key={idx} onClick={() => viewReturnDetails(eventItems)} className={`bg-card border ${isHighValue ? 'border-red-500/50' : 'border-amber-500/30'} rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 cursor-pointer transition-colors group`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-lg">{first.supplier}</h4>
                            <span className="bg-amber-500 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">Awaiting Payment</span>
                            <span className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border border-border">{first.returnNumber || "Legacy Return"}</span>
                            {isHighValue && (
                              <span className="animate-pulse flex items-center gap-1 bg-red-500 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold shadow-sm">
                                <AlertTriangle className="h-3 w-3" /> High Value
                              </span>
                            )}
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
                <div className="sticky top-0 z-10 bg-background pb-2">
                  <div className="relative">
                    <input 
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search by Supplier or Return Number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-3 pl-10 rounded-xl border border-border bg-muted/50 focus:bg-background outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <kbd className="hidden sm:inline-flex items-center gap-1 bg-background border border-border px-1.5 rounded text-[10px] font-bold text-muted-foreground uppercase shadow-sm">
                        <span className="text-[12px]">⌘</span>K
                      </kbd>
                    </div>
                  </div>
                </div>

                {returnHistoryEvents.length === 0 ? (
                  <div className="glass-panel p-16 text-center border-2 border-dashed border-border rounded-2xl">
                    <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-bold">No History</h3>
                    <p className="text-muted-foreground text-sm mt-1">Settled supplier returns will appear here.</p>
                  </div>
                ) : (
                  returnHistoryEvents.map((eventItems, idx) => {
                    const first = eventItems[0];
                    const isHighValue = first.totalPrice > 500;
                    return (
                      <div key={idx} onClick={() => viewReturnDetails(eventItems)} className={`bg-card border ${isHighValue ? 'border-red-500/50' : 'border-border'} rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 opacity-80 hover:opacity-100 hover:bg-muted/30 cursor-pointer transition-all`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-lg">{first.supplier}</h4>
                            <span className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border border-border">Settled</span>
                            <span className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border border-border">{first.returnNumber || "Legacy Return"}</span>
                            {isHighValue && (
                              <span className="animate-pulse flex items-center gap-1 bg-red-500 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold shadow-sm">
                                <AlertTriangle className="h-3 w-3" /> High Value
                              </span>
                            )}
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
                    <input 
                      type="text" 
                      list="supplier-list"
                      placeholder={lang === "ar" ? "اكتب أو اختر اسم مورد..." : "Type or select a supplier..."}
                      value={directSupplier}
                      onChange={e => setDirectSupplier(e.target.value)}
                      className="w-full p-3 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-bold text-sm"
                    />
                    <datalist id="supplier-list">
                      {allSuppliers.map(s => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
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
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Transfer Out / Credit Note No.</label>
                    <input 
                      type="text" 
                      value={transferOutNumber}
                      onChange={e => setTransferOutNumber(e.target.value)}
                      placeholder="e.g. TR-998822"
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
                      <div className="mt-4 md:mt-0">
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "وقت الدفع/التسليم" : "Payment/Delivery Timing"}</label>
                        <select
                          value={paymentTiming}
                          onChange={e => setPaymentTiming(e.target.value as "now" | "later")}
                          className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                        >
                          <option value="now">{lang === "ar" ? "تم الاستلام الآن (مسدد)" : "Received Now (Settled)"}</option>
                          <option value="later">{lang === "ar" ? "آجل (معلق)" : "Will Pay/Deliver Later (Pending)"}</option>
                        </select>
                      </div>
                      {paymentTiming === "later" && (
                        <div className="mt-4 md:mt-0">
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "التاريخ المتوقع" : "Expected Date"}</label>
                          <input 
                            type="date" 
                            value={expectedPaymentDate}
                            onChange={e => setExpectedPaymentDate(e.target.value)}
                            className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                          />
                        </div>
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
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Transfer Out / Credit Note No.</label>
                    <input 
                      type="text" 
                      value={transferOutNumber}
                      onChange={e => setTransferOutNumber(e.target.value)}
                      placeholder="e.g. TR-998822"
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
                      <div className="mt-4 md:mt-0">
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "وقت الدفع/التسليم" : "Payment/Delivery Timing"}</label>
                        <select
                          value={paymentTiming}
                          onChange={e => setPaymentTiming(e.target.value as "now" | "later")}
                          className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                        >
                          <option value="now">{lang === "ar" ? "تم الاستلام الآن (مسدد)" : "Received Now (Settled)"}</option>
                          <option value="later">{lang === "ar" ? "آجل (معلق)" : "Will Pay/Deliver Later (Pending)"}</option>
                        </select>
                      </div>
                      {paymentTiming === "later" && (
                        <div className="mt-4 md:mt-0">
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "التاريخ المتوقع" : "Expected Date"}</label>
                          <input 
                            type="date" 
                            value={expectedPaymentDate}
                            onChange={e => setExpectedPaymentDate(e.target.value)}
                            className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                          />
                        </div>
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
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 print-only-container">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl relative">
              <div className="p-6 border-b sticky top-0 bg-white/80 backdrop-blur-sm z-10 flex justify-between items-center no-print">
                <h3 className="text-xl font-bold text-black">{lang === "ar" ? "إيصال المرتجع" : "Return Receipt"}</h3>
                <div className="space-x-2 flex items-center">
                  <button 
                    onClick={handleDeleteReturn}
                    disabled={processing === "delete"}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold shadow-md hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                  >
                    {processing === "delete" ? "..." : (lang === "ar" ? "حذف الفاتورة" : "Delete Invoice")}
                  </button>
                  {!printData.isSettled && printData.eventIds && (
                    <button 
                      onClick={() => {
                        if (!confirm("Mark all items as paid?")) return;
                        printData.eventIds.forEach((id: string) => handleSettlePayment(id));
                        setPrintData({...printData, isSettled: true});
                      }}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors"
                    >
                      {lang === "ar" ? "تأكيد الدفع" : "Mark as Paid"}
                    </button>
                  )}
                  <button onClick={triggerPrint} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-colors">{lang === "ar" ? "طباعة" : "Print"}</button>
                  <button onClick={() => setPrintData(null)} className="px-6 py-2 bg-slate-200 text-slate-800 rounded-xl font-bold hover:bg-slate-300 transition-colors">{lang === "ar" ? "إغلاق" : "Close"}</button>
                </div>
              </div>

              {/* Printable Area - Advanced Corporate Style */}
              <div id="print-area" className="text-black bg-white" dir={lang === "ar" ? "rtl" : "ltr"} style={{ position: 'relative', overflow: 'hidden', padding: '15mm' }}>
                
                {/* Micro-Typography Security Borders */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px', overflow: 'hidden' }}>
                  <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                    {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                  </div>
                  <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                    {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                  </div>
                </div>
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', padding: '4px', overflow: 'hidden', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                  <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                    {Array(35).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                  </div>
                </div>
                <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', padding: '4px', overflow: 'hidden', writingMode: 'vertical-rl' }}>
                  <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                    {Array(35).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                  </div>
                </div>

                {/* Automated Digital Audit Stamp (Giant Watermark) */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-35deg)', fontSize: '80px', fontWeight: '900', color: 'rgba(59, 130, 246, 0.05)', zIndex: 5, whiteSpace: 'nowrap', pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '5px' }}>
                  RETURN MANIFEST
                </div>

                <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Corporate Header */}
                  <div className="flex justify-between items-start border-b-4 border-black pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-red-600 text-white p-2 rounded-xl font-black text-3xl tracking-tighter w-12 h-12 flex items-center justify-center">K</div>
                      <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight leading-none">Circle K</h1>
                        <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">{currentBranch === "all" ? "HQ Portal" : (currentBranch === "ola" ? "Ola El Koronfol" : "Alamein 4")}</p>
                      </div>
                    </div>
                    <div className="text-right" dir="ltr">
                      <h2 className="text-2xl font-black text-gray-900 tracking-tighter">إيصال مرتجع | RTV RECEIPT</h2>
                      <p className="text-lg font-bold text-red-600 mt-1"># {printData.returnNumber}</p>
                      {printData.transferOutNumber && (
                        <p className="text-sm font-bold text-gray-600 mt-1">TR/Credit Note: {printData.transferOutNumber}</p>
                      )}
                      <p className="text-xs font-semibold text-gray-500 mt-1">{printData.date}</p>
                    </div>
                  </div>

                  {/* AI Summary Sentence (Egyptian Arabic) */}
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRight: '4px solid #3b82f6', borderRadius: '8px', padding: '6px 10px', direction: 'rtl', textAlign: 'right', marginBottom: '15px' }}>
                    <p style={{ margin: 0, fontSize: '10px', color: '#1e293b', lineHeight: 1.5, fontWeight: 'bold' }}>
                      <span style={{ color: '#3b82f6', marginLeft: '6px' }}>✦</span>
                      تحليل المرتجعات للمورد: البضاعة دي هترجع للمورد بقيمة إجمالية {(printData.totalPrice || 0).toLocaleString()} جنيه. لازم مندوب الشركة ({printData.agentName}) يمضي تحت ويستلم البضاعة في إيده عشان نخلي مسؤولية الفرع وتتسجل على حساب المورد.
                    </p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-4 border-b-2 border-gray-200 pb-4">
                    {/* Supplier Box */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">بيانات المورد | Supplier Info</h3>
                      <p className="text-lg font-black text-gray-900 mb-3">{printData.supplier}</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between border-b border-gray-200 pb-1.5">
                          <span className="text-xs font-semibold text-gray-500">المندوب | Agent</span>
                          <span className="text-xs font-bold text-gray-900">{printData.agentName}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-1.5">
                          <span className="text-xs font-semibold text-gray-500">الهاتف | Mobile</span>
                          <span className="text-xs font-bold text-gray-900">{printData.agentMobile}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs font-semibold text-gray-500">الرقم القومي | National ID</span>
                          <span className="text-xs font-black tracking-widest text-gray-900">{printData.agentNationalId}</span>
                        </div>
                      </div>
                    </div>

                    {/* Financials Box */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
                      <div>
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">التسوية | Settlement</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-gray-500">الطريقة | Method</span>
                            <span className="text-xs font-black uppercase bg-gray-200 px-3 py-1.5 rounded-md text-gray-800">
                              {printData.settlementMethod === 'money' ? (lang === "ar" ? 'نقدى/تحويل' : 'Money/Transfer') : (lang === "ar" ? 'استبدال بضاعة' : 'Products Exchange')}
                            </span>
                          </div>
                          {printData.settlementMethod === 'money' && (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold text-gray-500">الوقت | Timing</span>
                                <span className="text-xs font-bold text-gray-900">{printData.paymentTiming === 'now' ? 'Immediate | فوري' : 'Later | آجل'}</span>
                              </div>
                              {printData.paymentTiming === 'later' && printData.expectedPaymentDate && (
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-semibold text-gray-500">تاريخ الاستحقاق | Due Date</span>
                                  <span className="text-xs font-bold text-red-600">{new Date(printData.expectedPaymentDate).toLocaleDateString()}</span>
                                </div>
                              )}
                            </>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-gray-500">الحالة | Status</span>
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${printData.isSettled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {printData.isSettled ? "Settled | تمت التسوية" : "Pending | قيد الانتظار"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 text-left" dir="ltr">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Total Value | إجمالي القيمة</span>
                        <div className="flex items-end gap-1">
                          <span className="text-3xl font-black text-gray-900 leading-none">{printData.totalPrice || 0}</span>
                          <span className="text-sm font-bold text-gray-500 mb-1">EGP</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items Block */}
                  <div className="mb-4">
                    <h3 className="text-sm font-black mb-2 uppercase tracking-tight text-gray-800">تفاصيل الأصناف المرتجعة | Returned Items</h3>
                    
                    {printData.items.length === 1 && printData.items[0].barcode === "N/A" ? (
                      <div className="border-2 border-gray-200 border-dashed rounded-xl p-4 text-center bg-gray-50 my-2">
                        <div className="mx-auto bg-green-100 w-10 h-10 rounded-full flex items-center justify-center mb-2">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <p className="text-sm font-black text-gray-800 mb-1">مطابق لمستند التحويل من النظام | MATCHES SYSTEM TRANSFER</p>
                        <p className="text-[10px] font-bold text-gray-500">لا يوجد إدخال يدوي للعناصر - تم استلام البضاعة كما هي في مستند التحويل المرفق</p>
                        <p className="text-[10px] font-bold text-gray-500 mt-1">No items manually appended - goods received exactly as per system transfer document.</p>
                      </div>
                    ) : (
                      <div className="border-2 border-black rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-gray-100">
                            <tr className="border-b-2 border-black">
                              <th className="py-2 px-3 font-black text-[10px] text-gray-500 uppercase tracking-wider w-12 text-center border-r-2 border-black">م</th>
                              <th className="py-2 px-3 font-black text-[10px] text-gray-500 uppercase tracking-wider w-40 border-r-2 border-black">Barcode | باركود</th>
                              <th className="py-2 px-3 font-black text-[10px] text-gray-500 uppercase tracking-wider border-r-2 border-black">Item | الصنف</th>
                              <th className="py-2 px-3 font-black text-[10px] text-gray-500 uppercase tracking-wider w-20 text-center">Qty | كمية</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y border-black">
                            {printData.items.map((it: any, i: number) => (
                              <tr key={it.id || i}>
                                <td className="py-1 px-3 font-bold text-gray-500 text-center border-r-2 border-black text-[10px]">{i + 1}</td>
                                <td className="py-1 px-3 font-mono font-bold text-[10px] text-gray-800 border-r-2 border-black tracking-wider">{it.barcode}</td>
                                <td className="py-1 px-3 font-black text-gray-900 border-r-2 border-black text-[10px]">{it.itemName}</td>
                                <td className="py-1 px-3 font-black text-gray-900 text-center text-sm">{it.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-100 border-t-2 border-black">
                            <tr>
                              <td colSpan={3} className="py-2 px-4 text-right font-black text-gray-600 uppercase tracking-wider border-r-2 border-black text-[10px]">
                                Total Units | إجمالي الوحدات
                              </td>
                              <td className="py-2 px-4 text-center font-black text-lg text-gray-900">
                                {printData.items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Signatures & Approvals */}
                  <div className="mt-auto pt-4 border-t-2 border-gray-100 break-inside-avoid">
                    <div className="text-center mb-4">
                      <p className="font-black text-[11px] text-gray-900 mb-1">* Copy of Agent ID is attached | مرفق صورة البطاقة *</p>
                      <p className="text-[9px] font-bold text-gray-500">Document valid only with authorized signatures.</p>
                    </div>

                    <div className="flex justify-between items-end px-4">
                      <div className="text-center relative w-1/3">
                        <p className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-10">المندوب | Supplier Agent</p>
                        <div className="border-t-2 border-black pt-2">
                          <p className="font-black text-gray-900 text-[11px] uppercase truncate">{printData.agentName}</p>
                          <p className="text-[9px] font-bold text-gray-500 mt-0.5 uppercase tracking-widest">Delivered By</p>
                        </div>
                      </div>

                      {/* Official Stamp Box */}
                      <div style={{ width: '25%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '5px' }}>
                        <div style={{ width: '100%', height: '50px', border: '2px dashed #94a3b8', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                          <span style={{ fontSize: '8px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.5px' }}>Official Branch<br />Stamp / Seal</span>
                        </div>
                      </div>

                      <div className="text-center relative w-1/3">
                        <p className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-10">المستلم | Store Manager</p>
                        <div className="border-t-2 border-black pt-2">
                          <p className="font-black text-gray-900 text-[11px] uppercase truncate">{printData.items[0]?.createdBy || "Store Manager"}</p>
                          <p className="text-[9px] font-bold text-gray-500 mt-0.5 uppercase tracking-widest">Received By</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Digital Forensics Footer */}
                  <div style={{ borderTop: '2px solid #1e293b', paddingTop: '6px', textAlign: 'center', marginTop: '10px' }}>
                    <p style={{ fontSize: '7px', color: '#475569', fontFamily: 'monospace', margin: 0, letterSpacing: '0.5px', fontWeight: 'bold' }}>
                      DOCUMENT RET-{printData.returnNumber} | DATE: {printData.date} | PRINTED: {new Date().toLocaleString('en-GB')} | SYSTEM: ANH PORTAL V2.0
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            html, body { 
              height: auto !important; 
              overflow: visible !important; 
              background: white !important; 
              margin: 0 !important;
              padding: 0 !important;
            }
            body * { 
              visibility: hidden; 
            }
            .print-only-container {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              height: auto !important;
              min-height: 100vh !important;
              background: white !important;
              display: block !important;
              overflow: visible !important;
              padding: 0 !important;
              margin: 0 !important;
              z-index: 999999 !important;
            }
            .print-only-container > div {
              display: block !important;
              max-height: none !important;
              height: auto !important;
              overflow: visible !important;
              box-shadow: none !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            #print-area, #print-area * { 
              visibility: visible; 
            }
            #print-area { 
              position: absolute !important;
              left: 0 !important; 
              top: 0 !important; 
              width: 100% !important; 
              margin: 0 !important; 
              padding: 10px !important; 
              display: block !important;
            }
            .no-print, .no-print * { 
              display: none !important; 
            }
            @page { 
              size: auto; 
              margin: 5mm; 
            }
          }
        `}} />

      </div>
    </div>
    </PageTransition>
  );
}
