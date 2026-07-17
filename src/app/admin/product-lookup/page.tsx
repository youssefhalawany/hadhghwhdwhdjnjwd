"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, getDoc, doc, setDoc, limit } from "firebase/firestore";
import { Search, Package, Calendar, AlertTriangle, QrCode, Camera, X, CheckCircle, Edit, PlusCircle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";

export default function ProductLookupPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expiriesData, setExpiriesData] = useState<any[]>([]);

  // Editing States
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: "", supplier: "", barcode: "" });
  const [saveLoading, setSaveLoading] = useState(false);

  // Scanner States
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scannerTarget, setScannerTarget] = useState<"search" | "form">("search");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Supplier State
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);

  // All Products State
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [fetchingProducts, setFetchingProducts] = useState(true);

  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const qProducts = query(collection(db, "products"), limit(200));
        const snap = await getDocs(qProducts);
        const products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        setAllProducts(products);
      } catch (e) {
        console.error("Failed to fetch products", e);
      } finally {
        setFetchingProducts(false);
      }
    };
    fetchAllProducts();
  }, []);

  const performLookup = async (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term) return;
    setLoading(true);
    setProductData(null);
    setExpiriesData([]);
    setIsEditing(false);

    try {
      // 1. First, try to look up by barcode directly in the `products` collection.
      const productRef = doc(db, "products", term);
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
          getDocs(query(collection(db, "products"), where("description", ">=", termLower), where("description", "<=", termLower + '\uf8ff'), limit(10))),
          getDocs(query(collection(db, "products"), where("description", ">=", termUpper), where("description", "<=", termUpper + '\uf8ff'), limit(10))),
          getDocs(query(collection(db, "products"), where("description", ">=", termTitle), where("description", "<=", termTitle + '\uf8ff'), limit(10))),
          getDocs(query(collection(db, "products"), where("itemName", ">=", termTitle), where("itemName", "<=", termTitle + '\uf8ff'), limit(10)))
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

      setProductData(foundProduct || { notFound: true, searchTerm: term });
      setDrawerOpen(true);

      // 3. Look up active expiries for this barcode
      const searchBarcode = foundProduct?.barcode || term;
      const expiriesQuery = query(
        collection(db, "expiries"), 
        where("status", "==", "active"),
        where("barcode", "==", searchBarcode)
      );
      const expiriesSnap = await getDocs(expiriesQuery);
      const matchingExpiries = expiriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      setExpiriesData(matchingExpiries.sort((a: any, b: any) => (a.expiryDate || "").localeCompare(b.expiryDate || "")));

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
      const productRef = doc(db, "products", editFormData.barcode);
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

  const initAudio = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    } catch(e) {}
  };

  // Scanner Actions
  const startScanning = (target: "search" | "form" = "search") => {
    setScannerTarget(target);
    initAudio();
    setShowScanner(true);
    setScannerError("");
    
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("scanner-reader-lookup");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        const startWithConstraints = async (constraints: any) => {
          return html5QrCode.start(
            constraints,
            config,
            (decodedText) => {
              try {
                const ctx = audioCtxRef.current;
                if (ctx) {
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.type = "sine";
                  osc.frequency.setValueAtTime(800, ctx.currentTime);
                  gain.gain.setValueAtTime(0.1, ctx.currentTime);
                  osc.start();
                  osc.stop(ctx.currentTime + 0.15);
                }
              } catch (e) {}
              if (target === "search") {
                setSearchTerm(decodedText);
                performLookup(decodedText);
              } else {
                setEditFormData(prev => ({...prev, barcode: decodedText}));
              }
              stopScanning();
            },
            undefined
          );
        };

        try {
          await startWithConstraints({ facingMode: "environment" });
          scannerRef.current = html5QrCode;
        } catch (err) {
          try {
            await startWithConstraints({ video: true });
            scannerRef.current = html5QrCode;
          } catch (fallbackErr) {
            setScannerError("Camera error. Please grant permissions.");
          }
        }
      } catch (err: any) {
        setScannerError("Scanner error.");
      }
    }, 250);
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      try { scannerRef.current.stop(); } catch (e) {}
      scannerRef.current = null;
    }
    setShowScanner(false);
  };

  const filteredProducts = searchTerm
    ? allProducts.filter(p => 
        (p.description || p.name || p.itemName || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.barcode || p.id).includes(searchTerm)
      )
    : allProducts;

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
              <div className="aspect-square bg-slate-50 dark:bg-slate-800 rounded-xl mb-4 flex items-center justify-center border border-slate-100 dark:border-slate-700 overflow-hidden relative">
                {/* Placeholder Image */}
                <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 leading-tight mb-auto group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {p.description || p.name || p.itemName || "Unnamed Product"}
              </h4>
              <div className="mt-3 text-xs text-slate-500 flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-2">
                <span className="font-mono text-[10px] truncate max-w-[80%]">{p.barcode || p.id}</span>
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
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{productData.description || productData.name || productData.itemName}</h3>
                          </div>
                          <button onClick={() => { setEditFormData({ name: productData.description || productData.name || productData.itemName || "", supplier: productData.supplier || "", barcode: productData.barcode || productData.id }); setIsEditing(true); }} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 p-2 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-700"><Edit className="h-4 w-4" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-8">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Barcode</p>
                            <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">{productData.barcode || productData.id}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Supplier</p>
                            <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{productData.supplier || "N/A"}</p>
                          </div>
                        </div>

                        {/* Expiries */}
                        <div>
                          <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> Active Expiries
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
                                if (diffDays < 0) { bgClass = "bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800 animate-pulse"; dateClass = "text-red-600 font-black"; }
                                else if (diffDays <= 7) { bgClass = "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900/50"; dateClass = "text-orange-600 font-bold"; }
                                return (
                                  <div key={idx} className={`p-4 rounded-xl border ${bgClass} flex justify-between items-center`}>
                                    <div>
                                      <p className={`font-mono text-base ${dateClass}`}>{exp.expiryDate} {diffDays < 0 && "(!)"}</p>
                                      <p className="text-xs font-semibold mt-1 opacity-70">By: {exp.addedBy}</p>
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
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-black text-base flex items-center gap-2"><Camera className="h-5 w-5 text-blue-500 animate-pulse" /> Scan Barcode</h3>
              <button onClick={stopScanning} className="p-1 text-slate-400 hover:text-white rounded-lg"><X className="h-6 w-6" /></button>
            </div>
            <div className="p-4 space-y-4">
              {scannerError ? (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-center"><p className="text-sm font-semibold text-red-400">{scannerError}</p></div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden bg-white"><div id="scanner-reader-lookup" className="w-full"></div></div>
              )}
              <button onClick={stopScanning} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
