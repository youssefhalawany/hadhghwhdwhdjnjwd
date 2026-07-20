"use client";

import React, { useState, useEffect, useRef } from "react";
import { db, productsDb } from "@/lib/firebase";
import { collection, getDocs, query, where, getDoc, doc, setDoc, limit } from "firebase/firestore";
import { Search, Package, Calendar, AlertTriangle, QrCode, Camera, X, CheckCircle, Edit, PlusCircle, DollarSign, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CameraScanner } from "@/components/ui/CameraScanner";
import { useDebounce } from "use-debounce";

export default function ProductLookupPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div></div>}>
      <ProductLookupContent />
    </Suspense>
  );
}

function ProductLookupContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expiriesData, setExpiriesData] = useState<any[]>([]);
  const [expiredItemsData, setExpiredItemsData] = useState<any[]>([]);
  const [supplierReturnsData, setSupplierReturnsData] = useState<any[]>([]);

  // Editing States
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: "", supplier: "", barcode: "" });
  const [saveLoading, setSaveLoading] = useState(false);

  // Scanner States
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"search" | "form">("search");

  // Supplier State
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);

  // All Products State
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [fetchingProducts, setFetchingProducts] = useState(true);
  const [debouncedSearch] = useDebounce(searchTerm, 500);

  // If a search param was passed via URL, immediately look it up on mount
  useEffect(() => {
    if (initialSearch) {
      performLookup(initialSearch);
    }
  }, [initialSearch]);

  useEffect(() => {
    const fetchSearchProducts = async () => {
      setFetchingProducts(true);
      try {
        const term = debouncedSearch.trim();
        const productsMap = new Map();
        
        if (!term) {
           // If no term, just fetch random 100
           const qProducts = query(collection(productsDb, "products"), limit(100));
           const snap = await getDocs(qProducts);
           snap.docs.forEach(doc => {
              const data = doc.data();
              productsMap.set(data.barcode || doc.id, { id: doc.id, ...data });
           });
           
           // Also fetch some expiries to show
           const snapExpiries = await getDocs(query(collection(db, "expiries"), limit(50)));
           snapExpiries.docs.forEach(doc => {
              const data = doc.data();
              if (data.barcode && !productsMap.has(data.barcode)) {
                 productsMap.set(data.barcode, {
                     id: data.barcode, barcode: data.barcode, 
                     description: data.itemName || "Unknown Expiry", 
                     itemName: data.itemName, supplier: data.supplier || data.priceHistory?.[0]?.supplier || "",
                     isPhantom: true,
                     expiryDate: data.expiryDate
                 });
              } else if (data.barcode && productsMap.has(data.barcode)) {
                 const existing = productsMap.get(data.barcode);
                 if (!existing.expiryDate || new Date(data.expiryDate) < new Date(existing.expiryDate)) {
                    existing.expiryDate = data.expiryDate;
                 }
              }
           });
           
           setAllProducts(Array.from(productsMap.values()));
           setFetchingProducts(false);
           return;
        }
        
        // Search by prefix
        const termLower = term.toLowerCase();
        const termUpper = term.toUpperCase();
        const termTitle = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();

        const queries = [
          getDocs(query(collection(productsDb, "products"), where("description", ">=", termLower), where("description", "<=", termLower + '\uf8ff'), limit(20))),
          getDocs(query(collection(productsDb, "products"), where("description", ">=", termUpper), where("description", "<=", termUpper + '\uf8ff'), limit(20))),
          getDocs(query(collection(productsDb, "products"), where("description", ">=", termTitle), where("description", "<=", termTitle + '\uf8ff'), limit(20))),
          getDocs(query(collection(productsDb, "products"), where("itemName", ">=", termTitle), where("itemName", "<=", termTitle + '\uf8ff'), limit(20))),
          getDocs(query(collection(db, "expiries"), where("itemName", ">=", termTitle), where("itemName", "<=", termTitle + '\uf8ff'), limit(20))),
        ];

        const snaps = await Promise.all(queries);
        
        snaps.forEach((s, idx) => {
          s.docs.forEach(doc => {
            const data = doc.data();
            const barcode = data.barcode || doc.id;
            if (!productsMap.has(barcode)) {
               productsMap.set(barcode, {
                   id: barcode, barcode: barcode, 
                   description: data.description || data.itemName || data.name || "Unknown Item", 
                   itemName: data.itemName, supplier: data.supplier || data.priceHistory?.[0]?.supplier || "",
                   price: data.currentPrice || data.price,
                   expiryDate: data.expiryDate,
                   isPhantom: idx === 4 // if from expiries
               });
            } else {
               const existing = productsMap.get(barcode);
               if (data.expiryDate && (!existing.expiryDate || new Date(data.expiryDate) < new Date(existing.expiryDate))) {
                  existing.expiryDate = data.expiryDate;
               }
               if (data.supplier && !existing.supplier) {
                  existing.supplier = data.supplier;
               }
            }
          });
        });

        // Also try direct barcode match
        const directSnap = await getDoc(doc(productsDb, "products", term));
        if (directSnap.exists()) {
           const data = directSnap.data();
           productsMap.set(term, { id: term, barcode: term, ...data });
        }
        const directExpiries = await getDocs(query(collection(db, "expiries"), where("barcode", "==", term), limit(5)));
        directExpiries.docs.forEach(doc => {
            const data = doc.data();
            const barcode = data.barcode || doc.id;
            if (!productsMap.has(barcode)) {
               productsMap.set(barcode, {
                   id: barcode, barcode: barcode, 
                   description: data.itemName || "Unknown Item", 
                   itemName: data.itemName, supplier: data.supplier || data.priceHistory?.[0]?.supplier || "",
                   expiryDate: data.expiryDate,
                   isPhantom: true
               });
            } else {
               const existing = productsMap.get(barcode);
               if (data.expiryDate && (!existing.expiryDate || new Date(data.expiryDate) < new Date(existing.expiryDate))) {
                  existing.expiryDate = data.expiryDate;
               }
            }
        });

        setAllProducts(Array.from(productsMap.values()));
      } catch (e) {
        console.error("Search failed", e);
      } finally {
        setFetchingProducts(false);
      }
    };
    
    fetchSearchProducts();
  }, [debouncedSearch]);

  const performLookup = async (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term) return;
    setLoading(true);
    setProductData(null);
    setExpiriesData([]);
    setExpiredItemsData([]);
    setSupplierReturnsData([]);
    setIsEditing(false);

    try {
      // 1. First, try to look up by barcode directly in the central `products` collection.
      const productRef = doc(productsDb, "products", term);
      const productSnap = await getDoc(productRef);

      let foundProduct = null;

      if (productSnap.exists()) {
        foundProduct = { id: productSnap.id, ...productSnap.data() };
      } else {
        // 2. If not found by ID (barcode), do a pseudo case-insensitive name prefix search
        // We do not download the whole database anymore to save Firebase Reads!
        const termLower = term.toLowerCase();
        const termUpper = term.toUpperCase();
        const termTitle = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();

        // 4 targeted queries costing a max of 40 reads instead of 80,000
        const queries = [
          getDocs(query(collection(productsDb, "products"), where("description", ">=", termLower), where("description", "<=", termLower + '\uf8ff'), limit(10))),
          getDocs(query(collection(productsDb, "products"), where("description", ">=", termUpper), where("description", "<=", termUpper + '\uf8ff'), limit(10))),
          getDocs(query(collection(productsDb, "products"), where("description", ">=", termTitle), where("description", "<=", termTitle + '\uf8ff'), limit(10))),
          getDocs(query(collection(productsDb, "products"), where("itemName", ">=", termTitle), where("itemName", "<=", termTitle + '\uf8ff'), limit(10)))
        ];

        const snaps = await Promise.all(queries);
        const results: any[] = [];
        snaps.forEach(s => {
          s.docs.forEach(d => {
            if (!results.find(r => r.id === d.id)) results.push({ id: d.id, ...d.data() });
          });
        });

        if (results.length > 0) {
          // Prioritize exact match if available, otherwise take the first match
          foundProduct = results.find(p => p.description?.toLowerCase() === termLower || p.itemName?.toLowerCase() === termLower) || results[0];
        }
      }

      // We no longer setProductData here. We wait to see if we can construct a phantom product from history!

      // 3. Look up ALL expiries for this barcode (active and past)
      const searchBarcode = foundProduct?.barcode || term;
      const expiriesQuery = query(
        collection(db, "expiries"), 
        where("barcode", "==", searchBarcode)
      );
      const expiriesSnap = await getDocs(expiriesQuery);
      const matchingExpiries = expiriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setExpiriesData(matchingExpiries.sort((a: any, b: any) => (a.expiryDate || "").localeCompare(b.expiryDate || "")));

      // 4. Look up expired_items
      const expiredItemsQuery = query(collection(db, "expired_items"), where("barcode", "==", searchBarcode));
      const expiredItemsSnap = await getDocs(expiredItemsQuery);
      const matchingExpiredItems = expiredItemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setExpiredItemsData(matchingExpiredItems.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || "")));

      // 5. Look up supplier_returns
      const returnsQuery = query(collection(db, "supplier_returns"), where("barcode", "==", searchBarcode));
      const returnsSnap = await getDocs(returnsQuery);
      const matchingReturns = returnsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setSupplierReturnsData(matchingReturns.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || "")));

      // If not found in central catalog, but we have history data, construct a Phantom Product!
      if (!foundProduct && (matchingExpiries.length > 0 || matchingReturns.length > 0 || matchingExpiredItems.length > 0)) {
         const name = matchingExpiries[0]?.itemName || matchingReturns[0]?.itemName || matchingExpiredItems[0]?.name || "Unknown Item";
         const supplier = matchingReturns[0]?.supplier || matchingExpiries[0]?.supplier || "Unknown Supplier";
         foundProduct = {
             id: searchBarcode,
             barcode: searchBarcode,
             description: name,
             itemName: name,
             supplier: supplier,
             isPhantom: true
         };
      }

      setProductData(foundProduct || { notFound: true, searchTerm: term });
      setDrawerOpen(true);

    } catch (err: any) {
      console.error("Lookup failed:", err);
      setProductData({ notFound: true, searchTerm: term, error: err.message || "Unknown error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(searchTerm);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      const productRef = doc(productsDb, "products", editFormData.barcode);
      await setDoc(productRef, {
        barcode: editFormData.barcode,
        description: editFormData.name,
        name: editFormData.name,
        itemName: editFormData.name, 
        supplier: editFormData.supplier,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setIsEditing(false);
      performLookup(editFormData.barcode);
    } catch (err) {
      console.error("Save failed", err);
      alert("Failed to save product.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Scanner Actions
  const startScanning = (target: "search" | "form" = "search") => {
    setScannerTarget(target);
    setShowScanner(true);
  };

  const filteredProducts = allProducts;

  return (
    <div className="space-y-6 relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Package className="h-8 w-8 text-blue-600" /> Products
          </h1>
          <p className="text-slate-500 font-medium mt-2">Manage your inventory and expiries.</p>
        </div>
        <button 
          onClick={() => {
            setSearchTerm("");
            setProductData({ notFound: true, searchTerm: "" });
            setEditFormData({ name: "", supplier: "", barcode: "" });
            setIsEditing(true);
            setDrawerOpen(true);
          }}
          className="text-sm font-bold bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <PlusCircle className="h-5 w-5" /> Add Product
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') performLookup(searchTerm);
            }}
            placeholder="Search products by name or barcode..."
            className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors font-medium text-lg"
          />
        </div>
        <button 
          type="button" 
          onClick={() => startScanning("search")}
          className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <Camera className="h-6 w-6" />
        </button>
      </div>

      {fetchingProducts && !loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredProducts.map((p, idx) => (
            <div 
              key={p.id || idx}
              onClick={() => performLookup(p.barcode || p.id)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg transition-all group flex flex-col h-full"
            >
              <div className="aspect-video bg-slate-50 dark:bg-slate-800 rounded-xl mb-4 flex items-center justify-center border border-slate-100 dark:border-slate-700 overflow-hidden relative">
                <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 group-hover:scale-110 transition-transform duration-300" />
                {p.price && (
                  <div className="absolute bottom-2 right-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-400 px-2 py-1 rounded-md text-[10px] font-black tracking-wider shadow-sm flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> {p.price} EGP
                  </div>
                )}
              </div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 leading-tight mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {p.description || p.name || p.itemName || "Unnamed Product"}
              </h4>
              <div className="mt-auto flex flex-col gap-1 text-[10px] text-slate-500 font-medium">
                <div className="flex items-center gap-1">
                  <Package className="w-3 h-3 text-slate-400" /> <span className="line-clamp-1">{p.supplier || "Unknown Supplier"}</span>
                </div>
                {p.expiryDate && (
                  <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-bold">
                    <Clock className="w-3 h-3" /> Expiry: {p.expiryDate}
                  </div>
                )}
              </div>
              <div className="mt-3 text-xs text-slate-500 flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-2">
                <span className="font-mono text-[10px] truncate max-w-[80%] opacity-60">#{p.barcode || p.id}</span>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              No products found matching "{searchTerm}"
            </div>
          )}
        </div>
      )}

      {/* Sliding Drawer for Quick Edit & Expiries */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 z-50 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Product Details</h2>
                <button onClick={() => setDrawerOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                  </div>
                ) : productData && (
                  <>
                    {/* EDIT FORM or DISPLAY */}
                    {isEditing ? (
                      <form onSubmit={handleSaveProduct} className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Barcode</label>
                          <div className="flex gap-2">
                            <input 
                              required type="text" value={editFormData.barcode} onChange={(e) => setEditFormData({...editFormData, barcode: e.target.value})} disabled={!productData.notFound && !!productData.id}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none disabled:opacity-50"
                            />
                            <button type="button" onClick={() => startScanning("form")} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700"><Camera className="h-5 w-5" /></button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Product Name</label>
                          <input required type="text" value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Supplier</label>
                          {isAddingSupplier ? (
                            <div className="flex gap-2">
                              <input required type="text" placeholder="New supplier..." value={editFormData.supplier} onChange={(e) => setEditFormData({...editFormData, supplier: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none" />
                              <button type="button" onClick={() => { setIsAddingSupplier(false); setEditFormData({...editFormData, supplier: ""}); }} className="p-3 bg-red-50 text-red-600 rounded-lg font-bold"><X className="h-4 w-4" /></button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <select required value={editFormData.supplier} onChange={(e) => setEditFormData({...editFormData, supplier: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none">
                                <option value="" disabled>Select supplier</option>
                                {Array.from(new Set(allProducts.map(p => p.supplier).filter(Boolean))).sort().map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
                              </select>
                              <button type="button" onClick={() => { setIsAddingSupplier(true); setEditFormData({...editFormData, supplier: ""}); }} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold flex gap-1 items-center"><PlusCircle className="h-4 w-4" /> New</button>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-4">
                          <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700">Cancel</button>
                          <button type="submit" disabled={saveLoading} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">{saveLoading ? "Saving..." : "Save Changes"}</button>
                        </div>
                      </form>
                    ) : productData.notFound ? (
                      <div className="text-center py-8">
                        <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4 opacity-50" />
                        <p className="font-bold text-slate-700 dark:text-slate-300">Product not found.</p>
                        <p className="text-sm text-slate-500 mt-2">Barcode: <span className="font-mono">{productData.searchTerm}</span></p>
                        <button onClick={() => { setEditFormData({ name: "", supplier: "", barcode: productData.searchTerm }); setIsEditing(true); }} className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 inline-flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Add This Product</button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <p className="text-xs text-slate-500 font-bold uppercase mb-1">Name</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                              {productData.description || productData.name || productData.itemName}
                              {productData.isPhantom && (
                                <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-md font-bold uppercase tracking-wider">Unregistered</span>
                              )}
                            </h3>
                          </div>
                          <button onClick={() => { setEditFormData({ name: productData.description || productData.name || productData.itemName || "", supplier: productData.supplier || productData.priceHistory?.[0]?.supplier || "", barcode: productData.barcode || productData.id }); setIsEditing(true); }} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 p-2 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-700"><Edit className="h-4 w-4" /></button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Barcode</p>
                            <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">{productData.barcode || productData.id}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Supplier</p>
                            <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{productData.supplier || productData.priceHistory?.[0]?.supplier || "N/A"}</p>
                          </div>
                          <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30 col-span-2 md:col-span-1">
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold uppercase mb-1">Catalog Price</p>
                            <p className="font-bold text-lg text-emerald-700 dark:text-emerald-400">{productData.currentPrice ? `${productData.currentPrice} EGP` : productData.price ? `${productData.price} EGP` : "N/A"}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* HISTORY SECTIONS - Rendered for all, even if not found in catalog */}
                    {!isEditing && (
                      <div className="space-y-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                        {/* Price History */}
                        {!productData.notFound && productData.priceHistory && productData.priceHistory.length > 0 && (
                          <div>
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Calendar className="h-4 w-4" /> Price & Supplier History
                            </h4>
                            <div className="space-y-3">
                              {productData.priceHistory.map((ph: any, idx: number) => (
                                <div key={idx} className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                  <div>
                                    <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{ph.supplier || "Unknown Supplier"}</p>
                                    <p className="text-xs font-semibold mt-1 opacity-70">Date: {ph.date}</p>
                                  </div>
                                  <div className="text-right whitespace-nowrap ml-4">
                                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{ph.price} <span className="text-sm">EGP</span></p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Expiries */}
                        <div>
                          <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> All Expiry Records
                          </h4>
                          {expiriesData.length === 0 ? (
                            <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                              <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No active expiries tracked.</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {expiriesData.map((exp, idx) => {
                                const itemDate = new Date(exp.expiryDate); itemDate.setHours(0,0,0,0);
                                const today = new Date(); today.setHours(0,0,0,0);
                                const diffDays = Math.ceil((itemDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                let bgClass = "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700";
                                let dateClass = "text-slate-900 dark:text-white";
                                
                                if (exp.status === "removed" || exp.status === "resolved") {
                                  bgClass = "bg-slate-100 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800 opacity-75";
                                  dateClass = "text-slate-500 line-through";
                                } else if (diffDays < 0) { 
                                  bgClass = "bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800 animate-pulse"; 
                                  dateClass = "text-red-600 font-black"; 
                                } else if (diffDays <= 7) { 
                                  bgClass = "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900/50"; 
                                  dateClass = "text-orange-600 font-bold"; 
                                }

                                return (
                                  <div key={idx} className={`p-4 rounded-xl border ${bgClass} flex justify-between items-center`}>
                                    <div>
                                      <p className={`font-mono text-base ${dateClass}`}>
                                        {exp.expiryDate} {diffDays < 0 && exp.status !== "removed" && exp.status !== "resolved" && "(!)"}
                                      </p>
                                      <p className="text-xs font-semibold mt-1 opacity-70">By: {exp.addedBy} {exp.status !== "active" && `• ${exp.status}`}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xl font-black">{exp.quantity}</p>
                                      <p className="text-[10px] font-bold uppercase opacity-60">Qty</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Expired Items */}
                        <div>
                          <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" /> Expired Items History
                          </h4>
                          {expiredItemsData.length === 0 ? (
                            <p className="text-sm text-slate-500 font-bold">No expired items recorded.</p>
                          ) : (
                            <div className="space-y-3">
                              {expiredItemsData.map((exp, idx) => (
                                <div key={idx} className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                  <div>
                                    <p className="font-mono text-sm text-slate-900 dark:text-white">{exp.date ? new Date(exp.date).toLocaleDateString() : 'Unknown Date'}</p>
                                    <p className="text-xs font-semibold mt-1 opacity-70">By: {exp.createdBy || "System"} • {exp.storeId}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xl font-black text-red-600 dark:text-red-400">{exp.quantity}</p>
                                    <p className="text-[10px] font-bold uppercase opacity-60">Qty</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Supplier Returns */}
                        <div>
                          <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Package className="h-4 w-4" /> Supplier Returns History
                          </h4>
                          {supplierReturnsData.length === 0 ? (
                            <p className="text-sm text-slate-500 font-bold">No supplier returns recorded.</p>
                          ) : (
                            <div className="space-y-3">
                              {supplierReturnsData.map((ret, idx) => (
                                <div key={idx} className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                  <div>
                                    <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{ret.supplier || "Unknown Supplier"}</p>
                                    <p className="text-xs font-semibold mt-1 opacity-70">Status: {ret.status} • {ret.branchId || ret.storeId}</p>
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="text-xl font-black text-blue-600 dark:text-blue-400">{ret.quantity}</p>
                                    <p className="text-[10px] font-bold uppercase opacity-60">Qty</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Barcode Camera Scanner Modal */}
      {showScanner && (
        <CameraScanner 
          onScan={(decodedText) => {
            if (scannerTarget === "search") {
              setSearchTerm(decodedText);
              performLookup(decodedText);
            } else {
              setEditFormData(prev => ({...prev, barcode: decodedText}));
            }
            setShowScanner(false);
          }} 
          onClose={() => setShowScanner(false)} 
        />
      )}
    </div>
  );
}
