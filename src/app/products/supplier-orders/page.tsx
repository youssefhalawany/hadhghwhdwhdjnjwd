"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, onSnapshot, query, doc, updateDoc, where, orderBy, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, productsDb, productsStorage } from "@/lib/firebase";
import { ShoppingCart, Truck, History, Plus, Phone, FileText, Send, Loader2, Package, Search, PackageX } from "lucide-react";
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
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  
  // Products/Order State
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<{ [barcode: string]: number }>({});
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Past Orders State
  const [pastOrders, setPastOrders] = useState<any[]>([]);
  
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
    const unsub = onSnapshot(collection(productsDb, "suppliers"), (snap) => {
      const data: any[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setSuppliers(data);
    });
    return () => unsub();
  }, []);

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
          setOrderItems({}); // reset
        });
      }
    } else {
      setSupplierProducts([]);
      setOrderItems({});
    }
  }, [selectedSupplierId, suppliers]);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName || !newSupplierPhone) return toast.error("Please fill all fields");
    
    try {
      await addDoc(collection(productsDb, "suppliers"), {
        name: newSupplierName,
        phone: newSupplierPhone,
        createdAt: new Date().toISOString()
      });
      toast.success("Supplier added!");
      setNewSupplierName("");
      setNewSupplierPhone("");
      setShowAddSupplier(false);
    } catch (err) {
      console.error(err);
      toast.error("Error adding supplier. Check rules.");
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

      // 3. Save to Firestore
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
      
      const waLink = `https://wa.me/${phoneStr}?text=${encodedText}`;
      
      // Use location.href if window.open is blocked, but window.open usually works if user interaction started the chain.
      // We will try window.open, and if it's blocked, we can fallback, but _blank is best.
      const newWin = window.open(waLink, '_blank');
      if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
        // Popup blocked, use location.href
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

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Order with Supplier</h1>
          <p className="text-muted-foreground">Manage suppliers and send professional PDF purchase orders via WhatsApp.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("order")}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${
            activeTab === "order" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingCart className="h-4 w-4" /> New Order
        </button>
        <button
          onClick={() => setActiveTab("suppliers")}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${
            activeTab === "suppliers" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Truck className="h-4 w-4" /> Suppliers
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${
            activeTab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" /> Past Orders
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-4 md:p-6 min-h-[500px]">
        {/* SUPPLIERS TAB */}
        {activeTab === "suppliers" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Registered Suppliers</h2>
              <button 
                onClick={() => setShowAddSupplier(!showAddSupplier)}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> Add Supplier
              </button>
            </div>

            {showAddSupplier && (
              <form onSubmit={handleAddSupplier} className="bg-muted p-4 rounded-lg flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Company Name</label>
                  <select
                    required
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="">-- Select Supplier from System --</option>
                    {availableSuppliers.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 w-full">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">WhatsApp Number (with country code)</label>
                  <input
                    type="text"
                    required
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    placeholder="+201000000000"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full md:w-auto bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap">
                  Save
                </button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="p-3 font-medium">Supplier Name</th>
                    <th className="p-3 font-medium">WhatsApp Number</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {suppliers.map(sup => (
                    <tr key={sup.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3 font-medium">{sup.name}</td>
                      <td className="p-3 text-muted-foreground flex items-center gap-2">
                        <Phone className="h-4 w-4" /> {sup.phone}
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-xs text-muted-foreground">Saved</span>
                      </td>
                    </tr>
                  ))}
                  {suppliers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-muted-foreground">
                        No suppliers added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ORDER TAB */}
        {activeTab === "order" && (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Select Supplier</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full md:w-1/3 bg-background border border-border rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">-- Choose Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {selectedSupplierId && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold flex items-center gap-2"><Package className="h-4 w-4" /> Products available to order</h3>
                  <span className="text-sm text-muted-foreground">{supplierProducts.length} items found</span>
                </div>
                
                {supplierProducts.length > 0 ? (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="max-h-[500px] overflow-y-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="p-3 font-medium">Barcode</th>
                            <th className="p-3 font-medium">Description</th>
                            <th className="p-3 font-medium text-right w-40">Order Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {supplierProducts.map(prod => (
                            <tr key={prod.id} className="hover:bg-muted/50 transition-colors">
                              <td className="p-3 font-mono text-xs">{prod.barcode}</td>
                              <td className="p-3 font-medium">{prod.description}</td>
                              <td className="p-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={orderItems[prod.barcode] || ""}
                                  onChange={(e) => handleUpdateQuantity(prod.barcode, parseInt(e.target.value) || 0)}
                                  className="w-24 text-right bg-background border border-border rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-border rounded-lg text-muted-foreground">
                    <PackageX className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No products found for this supplier in the database.</p>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-border">
                  <button
                    onClick={generateAndSendOrder}
                    disabled={isGenerating || Object.values(orderItems).filter(v => v > 0).length === 0}
                    className="bg-[#25D366] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#128C7E] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isGenerating ? (
                      <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Generating Order...</span>
                    ) : (
                      <span className="flex items-center gap-2"><Send className="h-5 w-5" /> Send Order via WhatsApp</span>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {!selectedSupplierId && (
              <div className="py-20 text-center text-muted-foreground border border-dashed border-border rounded-lg">
                <Truck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>Please select a supplier to view their products and create an order.</p>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div className="space-y-6">
             <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Past Orders</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Supplier</th>
                    <th className="p-3 font-medium">Branch</th>
                    <th className="p-3 font-medium">Items Ordered</th>
                    <th className="p-3 font-medium text-right">Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pastOrders.map(order => (
                    <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3 text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 font-medium">{order.supplierName}</td>
                      <td className="p-3 font-medium text-muted-foreground">{order.branchId}</td>
                      <td className="p-3 font-medium">
                        <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs">
                          {order.items?.length || 0} unique items
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => downloadPastOrderPDF(order)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-700 bg-blue-500/10 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <FileText className="h-4 w-4" /> Download PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pastOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No past orders found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
