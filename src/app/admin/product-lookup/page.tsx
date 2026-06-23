"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, getDoc, doc, setDoc } from "firebase/firestore";
import { Search, Package, Calendar, AlertTriangle, QrCode, Camera, X, CheckCircle, Edit, PlusCircle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

export default function ProductLookupPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState<any | null>(null);
  const [expiriesData, setExpiriesData] = useState<any[]>([]);

  // Editing States
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: "", supplier: "", barcode: "" });
  const [saveLoading, setSaveLoading] = useState(false);

  // Scanner States
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // All Products State
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [fetchingProducts, setFetchingProducts] = useState(true);

  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const snap = await getDocs(collection(db, "products"));
        const products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        products.sort((a, b) => {
          const nameA = (a.description || a.name || a.itemName || "").toLowerCase();
          const nameB = (b.description || b.name || b.itemName || "").toLowerCase();
          return nameA.localeCompare(nameB);
        });
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
        // 2. If not found by ID (barcode), search by `description` or `itemName`
        const productsSnap = await getDocs(collection(db, "products"));
        const allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const termLower = term.toLowerCase();
        foundProduct = allProducts.find(p => 
          (p.barcode && p.barcode.toLowerCase() === termLower) || 
          p.description?.toLowerCase().includes(termLower) || 
          p.name?.toLowerCase().includes(termLower) ||
          p.itemName?.toLowerCase().includes(termLower) ||
          p.id.toLowerCase() === termLower
        );
      }

      setProductData(foundProduct || { notFound: true, searchTerm: term });

      // 3. Look up active expiries for this barcode or name
      const expiriesQuery = query(collection(db, "expiries"), where("status", "==", "active"));
      const expiriesSnap = await getDocs(expiriesQuery);
      const allExpiries = expiriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const matchingExpiries = allExpiries.filter(e => 
        e.barcode === term || 
        (foundProduct && e.barcode === foundProduct.barcode) ||
        e.itemName?.toLowerCase().includes(term.toLowerCase())
      );

      setExpiriesData(matchingExpiries.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)));

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
  const startScanning = () => {
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
              setSearchTerm(decodedText);
              performLookup(decodedText);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
          <Search className="h-8 w-8 text-blue-600" /> Product Lookup
        </h1>
        <p className="text-slate-500 font-medium mt-2">Scan a barcode or search by name to view product details and active expiries.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Search Barcode or Name</label>
            <input 
              type="text" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="e.g., 6223000000000 or Pepsi"
              className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors font-medium text-lg"
            />
          </div>
          <button 
            type="button" 
            onClick={startScanning}
            className="p-4 bg-slate-900 dark:bg-slate-800 text-white rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <Camera className="h-6 w-6" />
          </button>
          <button 
            type="submit" 
            className="p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold transition-colors shadow-sm"
          >
            Search
          </button>
        </form>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!loading && productData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Details Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Package className="h-4 w-4" /> Product Database
            </h3>
            
            {isEditing ? (
              <form onSubmit={handleSaveProduct} className="space-y-4 animate-in fade-in">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Barcode (ID)</label>
                  <input 
                    required
                    type="text"
                    value={editFormData.barcode}
                    onChange={(e) => setEditFormData({...editFormData, barcode: e.target.value})}
                    disabled={!productData.notFound}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Product Name</label>
                  <input 
                    required
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Supplier</label>
                  <input 
                    required
                    type="text"
                    value={editFormData.supplier}
                    onChange={(e) => setEditFormData({...editFormData, supplier: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2.5 rounded-lg font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saveLoading}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saveLoading ? "Saving..." : "Save Product"}
                  </button>
                </div>
              </form>
            ) : productData.notFound ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4 opacity-50" />
                <p className="font-bold text-slate-700 dark:text-slate-300">Product not found in database.</p>
                <p className="text-sm text-slate-500 mt-2">Searched for: <span className="font-mono">{productData.searchTerm}</span></p>
                {productData.error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-semibold border border-red-200 dark:border-red-800">
                    Error: {productData.error}
                  </div>
                )}
                <div className="mt-6">
                  <button 
                    onClick={() => {
                      setEditFormData({ name: "", supplier: "", barcode: productData.searchTerm });
                      setIsEditing(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors inline-flex items-center gap-2 shadow-sm"
                  >
                    <PlusCircle className="h-4 w-4" /> Add New Product
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Name</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{productData.description || productData.name || productData.itemName}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditFormData({ 
                        name: productData.description || productData.name || productData.itemName || "", 
                        supplier: productData.supplier || "", 
                        barcode: productData.barcode || productData.id 
                      });
                      setIsEditing(true);
                    }}
                    className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Edit className="h-3 w-3" /> Edit
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Barcode</p>
                    <span className="inline-flex items-center gap-1 font-mono text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-700 dark:text-slate-300">
                      <QrCode className="h-3 w-3" /> {productData.barcode || productData.id}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Supplier</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">{productData.supplier || "N/A"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Expiries Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Active Expiry Trackers
            </h3>

            {expiriesData.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4 opacity-50 animate-pulse" />
                <p className="font-bold text-slate-700 dark:text-slate-300">No active expiries tracked.</p>
                <p className="text-sm text-slate-500 mt-2">This product is safe.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {expiriesData.map((exp, idx) => {
                  const itemDate = new Date(exp.expiryDate);
                  itemDate.setHours(0,0,0,0);
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  const isExpired = itemDate < today;

                  return (
                    <div key={idx} className={`p-4 rounded-xl border ${isExpired ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'} flex items-center justify-between`}>
                      <div>
                        <p className={`font-mono font-bold text-lg ${isExpired ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                          {exp.expiryDate}
                        </p>
                        <p className="text-xs font-semibold text-slate-500 mt-1">Logged by: {exp.addedBy}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{exp.quantity}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase">Qty</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* All Products Scrollable List */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mt-8">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          <Package className="h-4 w-4" /> All Registered Products ({allProducts.length})
        </h3>
        {fetchingProducts ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {allProducts.map((p, idx) => (
              <div key={p.id || idx} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer" onClick={() => { setSearchTerm(p.barcode || p.id); performLookup(p.barcode || p.id); }}>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{p.description || p.name || p.itemName || "Unnamed Product"}</h4>
                  <div className="flex gap-4 mt-1">
                    <p className="text-xs text-slate-500 font-mono"><QrCode className="h-3 w-3 inline mr-1" />{p.barcode || p.id}</p>
                    <p className="text-xs text-slate-500"><span className="font-bold uppercase mr-1">Supplier:</span>{p.supplier || "N/A"}</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditFormData({ 
                      name: p.description || p.name || p.itemName || "", 
                      supplier: p.supplier || "", 
                      barcode: p.barcode || p.id 
                    });
                    setIsEditing(true);
                    setProductData({ id: p.id, ...p });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-xs bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barcode Camera Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-black text-base flex items-center gap-2">
                <Camera className="h-5 w-5 text-blue-500 animate-pulse" /> Scan Barcode
              </h3>
              <button onClick={stopScanning} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {scannerError ? (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-center">
                  <p className="text-sm font-semibold text-red-400">{scannerError}</p>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden bg-white">
                  <div id="scanner-reader-lookup" className="w-full"></div>
                </div>
              )}
              <button onClick={stopScanning} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
