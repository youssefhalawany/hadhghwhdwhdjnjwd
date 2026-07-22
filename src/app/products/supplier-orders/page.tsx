"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, onSnapshot, query, doc, updateDoc, where, orderBy } from "firebase/firestore";
import { db, productsDb } from "@/lib/firebase";
import { ShoppingCart, Truck, History, Plus, Phone, FileText, Send, Loader2, Package, Search, PackageX, Edit2, X, RefreshCcw, Eye } from "lucide-react";
import { useBranch } from "@/context/BranchContext";
import { toast } from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SupplierOrdersPage() {
  const [activeTab, setActiveTab] = useState<"order" | "suppliers" | "history">("order");
  const { currentBranch } = useBranch();
  
  // Suppliers State
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [searchSupplierTerm, setSearchSupplierTerm] = useState("");
  
  // Products/Order State
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<{ [barcode: string]: number }>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  
  // Past Orders State
  const [pastOrders, setPastOrders] = useState<any[]>([]);
  const [reorderState, setReorderState] = useState<any[] | null>(null);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  
  // Fetch System Suppliers from Products
  useEffect(() => {
    const fetchSystemSuppliers = async () => {
      try {
        const snap = await getDocs(collection(db, "products"));
        const uniqueSuppliers = new Set<string>();
        snap.forEach(doc => {
          const s = doc.data().supplier;
          if (s && typeof s === 'string') {
            uniqueSuppliers.add(s.trim());
          }
        });
        setAvailableSuppliers(Array.from(uniqueSuppliers).sort());
      } catch (err) {
        console.error("Error fetching system suppliers:", err);
      }
    };
    fetchSystemSuppliers();
  }, []);
  
  // Fetch Suppliers
  useEffect(() => {
    if (!currentBranch) return;
    
    // We fetch suppliers specific to this branch. 
    // To support old suppliers that have no branchId, we could fetch all and filter, 
    // but the user wants strict separation, so we will use client-side filtering 
    // to ensure we only show the current branch's suppliers, plus globally added ones if necessary.
    // Actually, strict branch filtering via query:
    const q = query(collection(productsDb, "suppliers"), where("branchId", "==", currentBranch));
    const unsub = onSnapshot(q, (snap) => {
      const data: any[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setSuppliers(data);
    });
    return () => unsub();
  }, [currentBranch]);

  // Fetch Past Orders
  useEffect(() => {
    if (activeTab === "history" && currentBranch) {
      const q = query(collection(productsDb, "supplier_orders"), where("branchId", "==", currentBranch));
      const unsub = onSnapshot(q, (snap) => {
        const data: any[] = [];
        snap.forEach(d => data.push({ id: d.id, ...d.data() }));
        // Client-side sort to avoid needing a composite index
        data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setPastOrders(data);
      });
      return () => unsub();
    }
  }, [activeTab, currentBranch]);

  // Fetch Supplier Products when supplier is selected
  useEffect(() => {
    if (selectedSupplierId) {
      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      if (supplier && supplier.name) {
        const q = query(collection(db, "products"), where("supplier", "==", supplier.name));
        getDocs(q).then(snap => {
          const prods: any[] = [];
          snap.forEach(d => prods.push({ id: d.id, ...d.data() }));
          setSupplierProducts(prods);
          
          if (reorderState) {
            const newOrderItems: any = {};
            reorderState.forEach((item: any) => {
              newOrderItems[item.barcode] = item.quantity;
            });
            setOrderItems(newOrderItems);
            setReorderState(null);
          } else {
            setOrderItems({}); // reset
          }
        });
      }
    } else {
      setSupplierProducts([]);
      setOrderItems({});
    }
  }, [selectedSupplierId, suppliers, reorderState]);

  const handleReorder = (order: any) => {
    setReorderState(order.items);
    setSelectedSupplierId(order.supplierId);
    setActiveTab("order");
  };

  const handleEditSupplier = (sup: any) => {
    setEditingSupplier(sup);
    setNewSupplierName(sup.name);
    setNewSupplierPhone(sup.phone);
    setShowAddSupplier(true);
  };

  const handleCancelEdit = () => {
    setEditingSupplier(null);
    setNewSupplierName("");
    setNewSupplierPhone("");
    setShowAddSupplier(false);
  };

  const handleAddOrUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName || !newSupplierPhone) return toast.error("Please fill all fields");
    
    try {
      if (editingSupplier) {
        await updateDoc(doc(productsDb, "suppliers", editingSupplier.id), {
          name: newSupplierName,
          phone: newSupplierPhone
        });
        toast.success("Supplier updated successfully!");
      } else {
        await addDoc(collection(productsDb, "suppliers"), {
          name: newSupplierName,
          phone: newSupplierPhone,
          branchId: currentBranch,
          createdAt: new Date().toISOString()
        });
        toast.success("Supplier added successfully!");
      }
      handleCancelEdit();
    } catch (err) {
      console.error(err);
      toast.error("Error saving supplier.");
    }
  };

  const handleUpdateQuantity = (barcode: string, qty: number) => {
    setOrderItems(prev => ({
      ...prev,
      [barcode]: qty
    }));
  };

  const generateAndSendOrder = async () => {
    const itemsToOrder = supplierProducts.filter(p => orderItems[p.barcode] > 0);
    if (itemsToOrder.length === 0) return toast.error("No items selected");
    
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (!supplier) return toast.error("Supplier not found");

    setIsGenerating(true);
    try {
      // 1. Generate Arabic WhatsApp Text via AI
      console.log("Generating Arabic WhatsApp message via AI...");
      const aiResponse = await fetch("/api/translate-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: supplier.name,
          branchName: currentBranch,
          items: itemsToOrder.map(item => ({
            description: item.description,
            quantity: orderItems[item.barcode]
          }))
        })
      });
      
      const aiData = await aiResponse.json();
      if (!aiResponse.ok || !aiData.success) {
        throw new Error(aiData.error || "Failed to generate Arabic message");
      }
      
      const arabicText = aiData.text;

      // 2. Save to Firestore
      console.log("Saving order to Firestore...");
      const orderData = {
        supplierId: supplier.id,
        supplierName: supplier.name,
        branchId: currentBranch,
        items: itemsToOrder.map(item => ({
          barcode: item.barcode,
          description: item.description,
          quantity: orderItems[item.barcode]
        })),
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(productsDb, "supplier_orders"), orderData);

      console.log("Order saved successfully.");
      // 3. Open WhatsApp
      const encodedText = encodeURIComponent(arabicText);
      let phoneStr = supplier.phone.replace(/\D/g, '');
      // Add Egypt country code if missing
      if (phoneStr.startsWith('01')) {
        phoneStr = '2' + phoneStr;
      } else if (phoneStr.startsWith('1')) {
        phoneStr = '20' + phoneStr;
      }
      
      const waLink = `https://api.whatsapp.com/send?phone=${phoneStr}&text=${encodedText}`;
      
      // Use location.href if window.open is blocked, but window.open usually works if user interaction started the chain.
      const newWin = window.open(waLink, '_blank');
      if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
        window.location.href = waLink;
      }
      
      toast.success("Order processed and WhatsApp opened!");
      setOrderItems({});
      setSelectedSupplierId("");

    } catch (err: any) {
      console.error("Order generation error:", err);
      toast.error(`Error: ${err.message || "Failed to process order"}`);
    }
    setIsGenerating(false);
  };

  const downloadPastOrderPDF = (order: any) => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("Supplier Purchase Order", 14, 22);
      
      doc.setFontSize(12);
      doc.text(`Supplier: ${order.supplierName}`, 14, 32);
      doc.text(`Branch: ${order.branchId}`, 14, 40);
      doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 14, 48);

      const tableData = order.items.map((item: any) => [
        item.barcode,
        item.description,
        item.quantity.toString()
      ]);

      autoTable(doc, {
        startY: 55,
        head: [['Barcode', 'Product Description', 'Qty Ordered']],
        body: tableData,
      });

      const filename = `order_${order.supplierName.replace(/\s/g, '_')}_${new Date(order.createdAt).getTime()}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error(err);
      toast.error("Error generating PDF");
    }
  };

  const filteredProducts = supplierProducts.filter(p => p.description.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode.includes(productSearch));
  const filteredSuppliers = suppliers.filter(s => s.name.toLowerCase().includes(searchSupplierTerm.toLowerCase()));

  return (
    <div className="p-3 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 md:p-8 shadow-lg text-white">
        <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
          <Truck className="w-64 h-64 -mt-10 -mr-10 transform rotate-12" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Orders & Suppliers Hub</h1>
            <p className="text-blue-100 max-w-xl text-sm md:text-base">
              Effortlessly manage your supplier directory, order products, and seamlessly communicate via automated AI-translated WhatsApp messages.
            </p>
          </div>
          <div className="flex w-full md:w-auto items-center justify-center bg-white/20 backdrop-blur-md px-4 py-2.5 rounded-xl text-sm font-medium border border-white/20">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Branch: {currentBranch}
          </div>
        </div>
      </div>

      {/* Modern Tabs - Scrollable on mobile */}
      <div className="overflow-x-auto hide-scrollbar -mx-3 px-3 md:mx-0 md:px-0">
        <div className="flex bg-muted/50 p-1.5 rounded-xl border border-border w-max md:w-max md:mx-auto shadow-sm">
          <button
            onClick={() => setActiveTab("order")}
            className={`whitespace-nowrap px-6 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${
              activeTab === "order" ? "bg-background text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            <ShoppingCart className="h-4 w-4" /> New Order
          </button>
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`whitespace-nowrap px-6 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${
              activeTab === "suppliers" ? "bg-background text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            <Truck className="h-4 w-4" /> Directory
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`whitespace-nowrap px-6 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${
              activeTab === "history" ? "bg-background text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            <History className="h-4 w-4" /> Past Orders
          </button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4 md:p-8 min-h-[500px] transition-all">
        
        {/* SUPPLIERS TAB */}
        {activeTab === "suppliers" && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Truck className="h-5 w-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold">Supplier Directory</h2>
              </div>
              <div className="flex flex-col sm:flex-row w-full md:w-auto items-stretch sm:items-center gap-3">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Search suppliers..." 
                    value={searchSupplierTerm}
                    onChange={(e) => setSearchSupplierTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <button 
                  onClick={() => {
                    setEditingSupplier(null);
                    setNewSupplierName("");
                    setNewSupplierPhone("");
                    setShowAddSupplier(!showAddSupplier);
                  }}
                  className="flex justify-center shrink-0 items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Add New
                </button>
              </div>
            </div>

            {showAddSupplier && (
              <div className="p-1 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <form onSubmit={handleAddOrUpdateSupplier} className="bg-card p-4 md:p-6 rounded-xl flex flex-col md:flex-row gap-4 md:gap-5 items-end shadow-inner">
                  <div className="flex-1 w-full">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Company Name</label>
                    <select
                      required
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                      <option value="">-- Select from Database --</option>
                      {availableSuppliers.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">WhatsApp Number (inc. country code)</label>
                    <input
                      type="text"
                      required
                      value={newSupplierPhone}
                      onChange={(e) => setNewSupplierPhone(e.target.value)}
                      placeholder="+201000000000"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
                    <button type="button" onClick={handleCancelEdit} className="flex-1 md:flex-none bg-muted text-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-muted/80 whitespace-nowrap transition-colors text-center">
                      Cancel
                    </button>
                    <button type="submit" className="flex-1 md:flex-none bg-blue-600 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap transition-colors shadow-sm text-center">
                      {editingSupplier ? "Update Details" : "Save Supplier"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map(sup => (
                <div key={sup.id} className="group relative bg-background border border-border rounded-2xl p-5 hover:shadow-md transition-all hover:border-primary/50">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                      {sup.name.charAt(0)}
                    </div>
                    <div className="flex space-x-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEditSupplier(sup)} className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors bg-muted md:bg-transparent">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg mb-1 truncate" title={sup.name}>{sup.name}</h3>
                  <div className="flex items-center text-sm text-muted-foreground bg-muted/50 w-max px-3 py-1 rounded-full">
                    <Phone className="h-3 w-3 mr-2" /> {sup.phone}
                  </div>
                </div>
              ))}
              {filteredSuppliers.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                  <Truck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-lg font-medium">No suppliers found.</p>
                  <p className="text-sm opacity-70">Try adding a new supplier to the directory.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ORDER TAB */}
        {activeTab === "order" && (
          <div className="space-y-6 md:space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <div className="bg-muted/30 border border-border p-4 md:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="p-3 bg-indigo-500/10 rounded-xl hidden md:block">
                <ShoppingCart className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="flex-1 w-full">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Step 1: Select Supplier</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full md:w-1/2 bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm transition-shadow"
                >
                  <option value="">-- Choose Supplier to load their products --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedSupplierId && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">Step 2: Choose Quantities</h3>
                    <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs px-2.5 py-0.5 rounded-full font-medium">
                      {supplierProducts.length} items
                    </span>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input 
                      type="text" 
                      placeholder="Filter products..." 
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>
                
                {filteredProducts.length > 0 ? (
                  <div className="border border-border rounded-2xl overflow-hidden shadow-sm">
                    {/* Desktop Table View */}
                    <div className="hidden md:block max-h-[600px] overflow-y-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted/80 backdrop-blur-md sticky top-0 z-10 border-b border-border">
                          <tr>
                            <th className="p-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Product Info</th>
                            <th className="p-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider text-right w-48">Order Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-background">
                          {filteredProducts.map(prod => {
                            const qty = orderItems[prod.barcode] || 0;
                            return (
                              <tr key={prod.id} className={`transition-colors ${qty > 0 ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-muted/30'}`}>
                                <td className="p-4">
                                  <div className="font-medium text-base mb-1">{prod.description}</div>
                                  <div className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                                    <Package className="h-3 w-3" /> {prod.barcode}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center justify-end gap-2">
                                    <button 
                                      onClick={() => handleUpdateQuantity(prod.barcode, Math.max(0, qty - 1))}
                                      className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-border transition-colors"
                                    >-</button>
                                    <input
                                      type="number"
                                      min="0"
                                      value={qty || ""}
                                      onChange={(e) => handleUpdateQuantity(prod.barcode, parseInt(e.target.value) || 0)}
                                      className="w-16 text-center bg-background border border-border rounded-lg px-2 py-1.5 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                    <button 
                                      onClick={() => handleUpdateQuantity(prod.barcode, qty + 1)}
                                      className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center hover:bg-indigo-200 transition-colors"
                                    >+</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Mobile Card View */}
                    <div className="block md:hidden max-h-[600px] overflow-y-auto bg-background divide-y divide-border">
                      {filteredProducts.map(prod => {
                        const qty = orderItems[prod.barcode] || 0;
                        return (
                          <div key={prod.id} className={`p-4 transition-colors ${qty > 0 ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-muted/30'}`}>
                            <div className="font-medium text-base mb-1">{prod.description}</div>
                            <div className="text-xs font-mono text-muted-foreground flex items-center gap-1 mb-4">
                              <Package className="h-3 w-3" /> {prod.barcode}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Order Qty</span>
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => handleUpdateQuantity(prod.barcode, Math.max(0, qty - 1))}
                                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-border transition-colors text-lg"
                                >-</button>
                                <input
                                  type="number"
                                  min="0"
                                  value={qty || ""}
                                  onChange={(e) => handleUpdateQuantity(prod.barcode, parseInt(e.target.value) || 0)}
                                  className="w-16 text-center bg-background border border-border rounded-lg px-2 py-2 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                                <button 
                                  onClick={() => handleUpdateQuantity(prod.barcode, qty + 1)}
                                  className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center hover:bg-indigo-200 transition-colors text-lg"
                                >+</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 md:p-12 text-center border-2 border-dashed border-border rounded-2xl text-muted-foreground">
                    <PackageX className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-medium">No products match your search.</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-between p-5 md:p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-2xl border border-green-200 dark:border-green-900/30 mt-6 sticky bottom-4 shadow-lg md:shadow-none z-20 md:static">
                  <div className="mb-4 sm:mb-0 text-center sm:text-left">
                    <h3 className="font-bold text-green-800 dark:text-green-400">Ready to place the order?</h3>
                    <p className="text-sm text-green-600 dark:text-green-500">{Object.values(orderItems).filter(v => v > 0).length} items selected</p>
                  </div>
                  <button
                    onClick={generateAndSendOrder}
                    disabled={isGenerating || Object.values(orderItems).filter(v => v > 0).length === 0}
                    className="w-full sm:w-auto bg-[#25D366] text-white px-8 py-3.5 rounded-xl font-bold hover:bg-[#128C7E] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-green-500/20 hover:shadow-lg flex items-center justify-center gap-3 text-lg"
                  >
                    {isGenerating ? (
                      <><Loader2 className="h-6 w-6 animate-spin" /> Processing...</>
                    ) : (
                      <><Send className="h-6 w-6" /> Order via WhatsApp</>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {!selectedSupplierId && (
              <div className="py-16 md:py-24 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-muted/10">
                <Package className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-xl font-medium">No Supplier Selected</p>
                <p className="text-sm opacity-70 mt-2 px-4">Select a supplier from the dropdown above to start an order.</p>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
             <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <History className="h-5 w-5 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold">Order History</h2>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden shadow-sm">
              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/80 backdrop-blur-md">
                    <tr>
                      <th className="p-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Date & Time</th>
                      <th className="p-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Supplier</th>
                      <th className="p-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Items Ordered</th>
                      <th className="p-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider text-right">Records</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {pastOrders.map(order => (
                      <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="font-medium text-foreground">{new Date(order.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                          <div className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold">{order.supplierName}</div>
                        </td>
                        <td className="p-4">
                          <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-semibold">
                            {order.items?.length || 0} Products
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setViewingOrder(order)}
                              className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-white border border-indigo-200 hover:bg-indigo-600 hover:border-indigo-600 px-3 py-2 rounded-xl transition-all shadow-sm"
                            >
                              <Eye className="h-4 w-4" /> View
                            </button>
                            <button 
                              onClick={() => handleReorder(order)}
                              className="inline-flex items-center gap-2 text-xs font-bold text-green-600 hover:text-white border border-green-200 hover:bg-green-600 hover:border-green-600 px-3 py-2 rounded-xl transition-all shadow-sm"
                            >
                              <RefreshCcw className="h-4 w-4" /> Reorder
                            </button>
                            <button 
                              onClick={() => downloadPastOrderPDF(order)}
                              className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-white border border-blue-200 hover:bg-blue-600 hover:border-blue-600 px-3 py-2 rounded-xl transition-all shadow-sm"
                            >
                              <FileText className="h-4 w-4" /> Save PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {pastOrders.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-muted-foreground">
                          <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p className="text-lg font-medium">No order history found.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Mobile Card View */}
              <div className="block md:hidden bg-background divide-y divide-border">
                {pastOrders.map(order => (
                  <div key={order.id} className="p-4 hover:bg-muted/30 transition-colors space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-base mb-1">{order.supplierName}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(order.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                        {order.items?.length || 0} Items
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => setViewingOrder(order)}
                        className="flex-1 min-w-[30%] flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-600 hover:text-white px-3 py-2.5 rounded-xl transition-all shadow-sm"
                      >
                        <Eye className="h-4 w-4" /> View
                      </button>
                      <button 
                        onClick={() => handleReorder(order)}
                        className="flex-1 min-w-[30%] flex items-center justify-center gap-2 text-sm font-bold text-green-600 border border-green-200 bg-green-50/50 hover:bg-green-600 hover:text-white px-3 py-2.5 rounded-xl transition-all shadow-sm"
                      >
                        <RefreshCcw className="h-4 w-4" /> Reorder
                      </button>
                      <button 
                        onClick={() => downloadPastOrderPDF(order)}
                        className="flex-1 min-w-[30%] flex items-center justify-center gap-2 text-sm font-bold text-blue-600 border border-blue-200 bg-blue-50/50 hover:bg-blue-600 hover:text-white px-3 py-2.5 rounded-xl transition-all shadow-sm"
                      >
                        <FileText className="h-4 w-4" /> PDF
                      </button>
                    </div>
                  </div>
                ))}
                {pastOrders.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-medium">No order history found.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Order Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Package className="h-5 w-5 text-indigo-600" />
                  Order Details
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Placed on {new Date(viewingOrder.createdAt).toLocaleDateString()} at {new Date(viewingOrder.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <button 
                onClick={() => setViewingOrder(null)}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-6 w-6 text-muted-foreground" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="bg-background border border-border p-4 rounded-xl">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Supplier</p>
                  <p className="font-medium">{viewingOrder.supplierName}</p>
                </div>
                <div className="bg-background border border-border p-4 rounded-xl">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Branch</p>
                  <p className="font-medium">{viewingOrder.branchId}</p>
                </div>
              </div>

              <h3 className="font-semibold text-lg mb-3">Items Ordered ({viewingOrder.items?.length || 0})</h3>
              
              <div className="border border-border rounded-xl overflow-hidden divide-y divide-border bg-background">
                {viewingOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-1">Barcode: {item.barcode}</p>
                    </div>
                    <div className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 px-4 py-1.5 rounded-lg font-bold">
                      x {item.quantity}
                    </div>
                  </div>
                ))}
                {!viewingOrder.items?.length && (
                  <div className="p-8 text-center text-muted-foreground">
                    No items found in this order.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3">
              <button 
                onClick={() => setViewingOrder(null)}
                className="px-6 py-2.5 rounded-xl font-medium border border-border hover:bg-muted transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  handleReorder(viewingOrder);
                  setViewingOrder(null);
                }}
                className="px-6 py-2.5 rounded-xl font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-2 transition-colors shadow-sm"
              >
                <RefreshCcw className="h-4 w-4" /> Reorder Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
