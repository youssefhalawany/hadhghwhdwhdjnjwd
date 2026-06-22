"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, getDoc, doc } from "firebase/firestore";
import { Search, Package, Calendar, AlertTriangle, QrCode, Camera, X, CheckCircle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

export default function ProductLookupPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState<any | null>(null);
  const [expiriesData, setExpiriesData] = useState<any[]>([]);

  // Scanner States
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const performLookup = async (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term) return;
    setLoading(true);
    setProductData(null);
    setExpiriesData([]);

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
            
            {productData.notFound ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4 opacity-50" />
                <p className="font-bold text-slate-700 dark:text-slate-300">Product not found in database.</p>
                <p className="text-sm text-slate-500 mt-2">Searched for: <span className="font-mono">{productData.searchTerm}</span></p>
                {productData.error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-semibold border border-red-200 dark:border-red-800">
                    Error: {productData.error}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Name</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{productData.description || productData.name || productData.itemName}</p>
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
