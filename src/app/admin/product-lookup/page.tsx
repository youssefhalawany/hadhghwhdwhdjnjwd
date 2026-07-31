"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { db, productsDb } from "@/lib/firebase";
import { collection, getDocs, query, where, getDoc, doc, setDoc, limit } from "firebase/firestore";
import { Search, Package, Calendar, AlertTriangle, QrCode, Camera, X, CheckCircle, Edit, PlusCircle, DollarSign, Clock, TrendingUp, TrendingDown, History } from "lucide-react";
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

  // Helper function to normalize strings for grouping
  const normalizeKey = (str: string) => str ? str.trim().toLowerCase().replace(/[^a-z0-9]/g, "") : "";

  // Helper to build deduplicated price history array with price deltas
  const compilePriceHistory = (product: any, expiries: any[] = [], returns: any[] = []) => {
    const rawHistory: any[] = [];

    // 1. Direct price history array in product document
    if (product?.priceHistory && Array.isArray(product.priceHistory)) {
      product.priceHistory.forEach((ph: any) => {
        if (ph.price && Number(ph.price) > 0) {
          rawHistory.push({
            price: Number(ph.price),
            supplier: ph.supplier || product.supplier || "Supplier",
            date: ph.date || "Recorded",
            source: "catalog"
          });
        }
      });
    }

    // 2. Current catalog price
    const currentP = Number(product?.currentPrice || product?.price || 0);
    if (currentP > 0) {
      rawHistory.push({
        price: currentP,
        supplier: product?.supplier || "Current Supplier",
        date: product?.updatedAt ? new Date(product.updatedAt).toLocaleDateString('en-GB') : "Current Catalog",
        source: "catalog"
      });
    }

    // 3. Prices from supplier returns
    returns.forEach(r => {
      if (r.price && Number(r.price) > 0) {
        rawHistory.push({
          price: Number(r.price),
          supplier: r.supplier || "Supplier Return",
          date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB') : "Return Record",
          source: "returns"
        });
      }
    });

    // 4. Prices from expiries
    expiries.forEach(e => {
      if (e.price && Number(e.price) > 0) {
        rawHistory.push({
          price: Number(e.price),
          supplier: e.supplier || "Expiry Audit",
          date: e.expiryDate || "Expiry Record",
          source: "expiries"
        });
      }
    });

    // Deduplicate entries by price + supplier
    const seen = new Set<string>();
    const uniqueHistory: any[] = [];

    rawHistory.forEach(item => {
      const key = `${item.price}_${(item.supplier || "").trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueHistory.push(item);
      }
    });

    // Sort chronologically ascending to calculate price changes
    uniqueHistory.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    // Calculate price deltas
    const historyWithDeltas = uniqueHistory.map((item, idx) => {
      const prevPrice = idx > 0 ? uniqueHistory[idx - 1].price : item.price;
      const delta = item.price - prevPrice;
      return {
        ...item,
        delta: delta,
        isIncrease: delta > 0,
        isDecrease: delta < 0
      };
    });

    // Return in date descending order for timeline display
    return historyWithDeltas.reverse();
  };

  useEffect(() => {
    if (initialSearch) {
      performLookup(initialSearch);
    }
  }, [initialSearch]);

  // Main Product Search & Barcode/Name Grouping Engine
  useEffect(() => {
    const fetchSearchProducts = async () => {
      setFetchingProducts(true);
      try {
        const term = debouncedSearch.trim();
        const rawItems: any[] = [];
        
        if (!term) {
           const qProducts = query(collection(productsDb, "products"), limit(150));
           const snap = await getDocs(qProducts);
           snap.docs.forEach(doc => {
              rawItems.push({ id: doc.id, ...doc.data() });
           });
           
           const snapExpiries = await getDocs(query(collection(db, "expiries"), limit(50))).catch(() => ({ docs: [] } as any));
           snapExpiries.docs.forEach((doc: any) => {
              const data = doc.data();
              rawItems.push({
                 id: data.barcode || doc.id,
                 barcode: data.barcode || doc.id,
                 description: data.itemName || "Unknown Expiry",
                 itemName: data.itemName,
                 supplier: data.supplier || "",
                 isPhantom: true,
                 expiryDate: data.expiryDate
              });
           });
        } else {
          const termLower = term.toLowerCase();
          const termUpper = term.toUpperCase();
          const termTitle = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();

          const queries = [
            getDocs(query(collection(productsDb, "products"), where("description", ">=", termLower), where("description", "<=", termLower + '\uf8ff'), limit(30))).catch(() => ({ docs: [] } as any)),
            getDocs(query(collection(productsDb, "products"), where("description", ">=", termUpper), where("description", "<=", termUpper + '\uf8ff'), limit(30))).catch(() => ({ docs: [] } as any)),
            getDocs(query(collection(productsDb, "products"), where("description", ">=", termTitle), where("description", "<=", termTitle + '\uf8ff'), limit(30))).catch(() => ({ docs: [] } as any)),
            getDocs(query(collection(productsDb, "products"), where("itemName", ">=", termTitle), where("itemName", "<=", termTitle + '\uf8ff'), limit(30))).catch(() => ({ docs: [] } as any)),
            getDocs(query(collection(db, "expiries"), where("itemName", ">=", termTitle), where("itemName", "<=", termTitle + '\uf8ff'), limit(30))).catch(() => ({ docs: [] } as any)),
          ];

          const snaps = await Promise.all(queries);
          snaps.forEach((s: any, idx: number) => {
            if (!s || !s.docs) return;
            s.docs.forEach((doc: any) => {
              const data = doc.data();
              rawItems.push({
                 id: data.barcode || doc.id,
                 barcode: data.barcode || doc.id,
                 description: data.description || data.itemName || data.name || "Unknown Item",
                 itemName: data.itemName,
                 supplier: data.supplier || data.priceHistory?.[0]?.supplier || "",
                 price: data.currentPrice || data.price,
                 priceHistory: data.priceHistory || [],
                 expiryDate: data.expiryDate,
                 isPhantom: idx === 4
              });
            });
          });

          // Direct barcode lookup
          const directSnap = await getDoc(doc(productsDb, "products", term));
          if (directSnap.exists()) {
             rawItems.push({ id: term, barcode: term, ...directSnap.data() });
          }
        }

        // STRICT CONSOLIDATION BY NORMALIZED PRODUCT NAME IDENTITY & BARCODE
        const consolidatedMap = new Map<string, any>();

        rawItems.forEach(item => {
          const barcodeKey = (item.barcode || item.id || "").trim();
          const rawName = item.description || item.itemName || item.name || "";
          const nameKey = normalizeKey(rawName);
          
          // Primary Grouping Key: Normalized product name (e.g. "aquafinawater15l")
          // Group all items with identical product names into 1 single primary card!
          const groupKey = nameKey || (barcodeKey && barcodeKey !== "undefined" ? barcodeKey : item.id);

          const itemPrice = Number(item.currentPrice || item.price || 0);

          if (!consolidatedMap.has(groupKey)) {
            const initialPrices: any[] = [];
            if (itemPrice > 0) initialPrices.push({ price: itemPrice, supplier: item.supplier, date: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-GB') : "Catalog" });

            if (item.priceHistory && Array.isArray(item.priceHistory)) {
              item.priceHistory.forEach((ph: any) => {
                if (ph.price) initialPrices.push(ph);
              });
            }

            consolidatedMap.set(groupKey, {
              ...item,
              groupKey: groupKey,
              price: itemPrice,
              allBarcodes: (barcodeKey && barcodeKey !== "undefined" && barcodeKey !== "null") ? [barcodeKey] : [],
              collectedPrices: initialPrices
            });
          } else {
            const existing = consolidatedMap.get(groupKey);
            
            // Merge barcodes
            if (barcodeKey && barcodeKey !== "undefined" && barcodeKey !== "null" && !existing.allBarcodes.includes(barcodeKey)) {
              existing.allBarcodes.push(barcodeKey);
            }

            // Merge price history
            if (itemPrice > 0) {
              existing.collectedPrices.push({ price: itemPrice, supplier: item.supplier || existing.supplier, date: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-GB') : "Catalog" });
              // Keep the latest price as active display price
              existing.price = itemPrice;
              existing.currentPrice = itemPrice;
            }

            if (item.priceHistory && Array.isArray(item.priceHistory)) {
              item.priceHistory.forEach((ph: any) => {
                if (ph.price) existing.collectedPrices.push(ph);
              });
            }

            // Update display supplier if missing
            if (!existing.supplier && item.supplier) existing.supplier = item.supplier;
            if (item.expiryDate && (!existing.expiryDate || new Date(item.expiryDate) < new Date(existing.expiryDate))) {
              existing.expiryDate = item.expiryDate;
            }
          }
        });

        // Compute unique price history count and sort prices for each consolidated product
        const consolidatedList = Array.from(consolidatedMap.values()).map(prod => {
          const uniquePrices = new Set(prod.collectedPrices.map((p: any) => p.price));
          const sortedPrices = [...prod.collectedPrices].filter(p => Number(p.price) > 0);
          const latestPrice = sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1].price : prod.price;

          return {
            ...prod,
            price: latestPrice || prod.price,
            priceHistoryCount: uniquePrices.size
          };
        });

        setAllProducts(consolidatedList);
      } catch (e) {
        console.error("Search failed", e);
      } finally {
        setFetchingProducts(false);
      }
    };
    
    fetchSearchProducts();
  }, [debouncedSearch]);

  const performLookup = async (rawTerm: string, clickProductObj?: any) => {
    const term = rawTerm.trim();
    if (!term) return;
    setLoading(true);
    setProductData(null);
    setExpiriesData([]);
    setExpiredItemsData([]);
    setSupplierReturnsData([]);
    setIsEditing(false);

    try {
      let foundProduct = clickProductObj || null;

      if (!foundProduct) {
        const productRef = doc(productsDb, "products", term);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          foundProduct = { id: productSnap.id, ...productSnap.data() };
        } else {
          const termLower = term.toLowerCase();
          const termUpper = term.toUpperCase();
          const termTitle = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();

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
            foundProduct = results.find(p => p.description?.toLowerCase() === termLower || p.itemName?.toLowerCase() === termLower) || results[0];
          }
        }
      }

      const searchBarcode = foundProduct?.barcode || term;
      
      // Fetch Expiries, Expired Items & Supplier Returns gracefully
      const [expiriesSnap, expiredItemsSnap, returnsSnap] = await Promise.all([
        getDocs(query(collection(db, "expiries"), where("barcode", "==", searchBarcode))).catch(() => ({ docs: [] } as any)),
        getDocs(query(collection(db, "expired_items"), where("barcode", "==", searchBarcode))).catch(() => ({ docs: [] } as any)),
        getDocs(query(collection(db, "supplier_returns"), where("barcode", "==", searchBarcode))).catch(() => ({ docs: [] } as any))
      ]);

      const matchingExpiries = (expiriesSnap?.docs || []).map((d: any) => ({ id: d.id, ...d.data() } as any));
      const matchingExpiredItems = (expiredItemsSnap?.docs || []).map((d: any) => ({ id: d.id, ...d.data() } as any));
      const matchingReturns = (returnsSnap?.docs || []).map((d: any) => ({ id: d.id, ...d.data() } as any));

      setExpiriesData(matchingExpiries.sort((a: any, b: any) => (a.expiryDate || "").localeCompare(b.expiryDate || "")));
      setExpiredItemsData(matchingExpiredItems.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || "")));
      setSupplierReturnsData(matchingReturns.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || "")));

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

      const compiledHistory = compilePriceHistory(foundProduct, matchingExpiries, matchingReturns);

      setProductData({
        ...(foundProduct || { notFound: true, searchTerm: term }),
        compiledPriceHistory: compiledHistory
      });
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
          <p className="text-slate-500 font-medium mt-2">Manage your inventory, barcode groups, and price history.</p>
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
              onClick={() => performLookup(p.barcode || p.id, p)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg transition-all group flex flex-col h-full relative overflow-hidden"
            >
              <div className="aspect-video bg-slate-50 dark:bg-slate-800 rounded-xl mb-4 flex items-center justify-center border border-slate-100 dark:border-slate-700 overflow-hidden relative">
                <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 group-hover:scale-110 transition-transform duration-300" />
                
                {/* Price Tag */}
                {p.price && (
                  <div className="absolute bottom-2 right-2 bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider shadow-md flex items-center gap-1 border border-emerald-500/50">
                    <DollarSign className="w-3 h-3" /> {p.price} EGP
                  </div>
                )}

                {/* Price History Badge indicator */}
                {p.priceHistoryCount > 1 && (
                  <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider flex items-center gap-1 shadow-sm">
                    <History className="w-2.5 h-2.5" /> {p.priceHistoryCount} Prices
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
                <span className="font-mono text-[10px] truncate max-w-[85%] text-slate-400">
                  #{p.barcode || p.id}
                  {p.allBarcodes && p.allBarcodes.length > 1 && (
                    <span className="ml-1 text-blue-500 font-bold text-[9px]">(+{p.allBarcodes.length - 1} Barcode)</span>
                  )}
                </span>
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

      {/* Sliding Drawer for Quick Edit, Price History & Expiries */}
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
                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Registered Barcodes</p>
                            <div className="flex flex-wrap gap-1">
                              {productData.allBarcodes && productData.allBarcodes.length > 0 ? (
                                productData.allBarcodes.map((b: string, i: number) => (
                                  <span key={i} className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">#{b}</span>
                                ))
                              ) : (
                                <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">#{productData.barcode || productData.id}</p>
                              )}
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Supplier</p>
                            <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{productData.supplier || productData.priceHistory?.[0]?.supplier || "N/A"}</p>
                          </div>
                          <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/30 col-span-2 md:col-span-1">
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase mb-1">🏷️ Latest Price</p>
                            <p className="font-bold text-xl text-emerald-600 dark:text-emerald-400 font-mono">{productData.price ? `${productData.price} EGP` : productData.currentPrice ? `${productData.currentPrice} EGP` : "N/A"}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PRICE HISTORY TIMELINE & EXPIRE SECTIONS */}
                    {!isEditing && (
                      <div className="space-y-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                        
                        {/* Compiled Price History Timeline */}
                        {productData.compiledPriceHistory && productData.compiledPriceHistory.length > 0 && (
                          <div>
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <History className="h-4 w-4 text-blue-500" /> Price & Supplier History Timeline ({productData.compiledPriceHistory.length})
                            </h4>
                            <div className="space-y-3">
                              {productData.compiledPriceHistory.map((ph: any, idx: number) => (
                                <div key={idx} className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{ph.supplier || "Supplier"}</p>
                                      {ph.delta !== 0 && (
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 ${ph.delta > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
                                          {ph.delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                          {ph.delta > 0 ? `+${ph.delta.toFixed(2)} EGP` : `${ph.delta.toFixed(2)} EGP`}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs font-semibold mt-1 opacity-70">Date: {ph.date}</p>
                                  </div>
                                  <div className="text-right whitespace-nowrap ml-4">
                                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{ph.price} <span className="text-xs">EGP</span></p>
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
