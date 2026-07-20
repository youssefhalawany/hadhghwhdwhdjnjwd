"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ScannerOverlay } from "@/components/MobileUX/ScannerOverlay";
import { ChevronLeft, PackageSearch, Activity, Package, Banknote, Calendar, Tag, Factory, Search, ScanLine, X } from "lucide-react";
import { collection, query, where, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { db, auth, productsDb } from "@/lib/firebase";
import toast from "react-hot-toast";

export default function MasterScannerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [productData, setProductData] = useState<any | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState("");

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScan(manualInput.trim());
    }
  };

  useEffect(() => {
    // Fast path: Check local storage first for instant loading
    try {
      const cached = localStorage.getItem("active_cashier_session");
      if (cached) {
        const session = JSON.parse(cached);
        if (session.features?.canUseMasterScanner || session.role === "owner" || session.role === "admin_editor") {
          setCheckingAuth(false);
          return; // Skip Firebase auth check to load instantly!
        }
      }
    } catch (e) {
      console.log("Local storage session parse error", e);
    }

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push("/cashier/login");
        return;
      }
      // Check features
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const role = data.role || "manager";
        const hasScannerFeature = data.features?.canUseMasterScanner;

        if (role !== "owner" && role !== "admin_editor" && !hasScannerFeature) {
          toast.error("You do not have permission to access the Master Scanner.");
          router.push("/cashier");
          return;
        }
        setCheckingAuth(false);
      } else {
        router.push("/cashier");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleScan = async (barcode: string) => {
    setLoading(true);
    setProductData(null);
    try {
      // Find in productsDb (Secondary Firebase)
      const q = query(collection(productsDb, "products"), where("barcode", "==", barcode), limit(1));
      const snap = await getDocs(q);
      
      // Also try to check by document ID just in case
      let foundData = null;
      if (!snap.empty) {
        const pDoc = snap.docs[0];
        foundData = { id: pDoc.id, ...pDoc.data() };
      } else {
        const docRef = await getDoc(doc(productsDb, "products", barcode));
        if (docRef.exists()) {
          foundData = { id: docRef.id, ...docRef.data() };
        }
      }

      if (!foundData) {
        toast.error(`No product found for barcode: ${barcode}`);
        setLoading(false);
        return;
      }

      setProductData(foundData);
      toast.success("Product found!");
    } catch (error: any) {
      console.error(error);
      toast.error("Error looking up product.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center text-cyan-500">
        <Activity className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050810] text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0A101D]/90 backdrop-blur-md border-b border-cyan-900/30 px-4 py-4 flex items-center gap-3">
        <button 
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-slate-800/50 text-slate-400 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-cyan-400" />
            Master Scanner
          </h1>
          <p className="text-xs text-slate-400">Scan items to view detailed profile</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-6 pb-20">
        
        {/* Scanner Area */}
        <div className="relative z-10 mb-4">
          {!isScanning ? (
            <div className="bg-[#0A101D] border border-cyan-900/40 rounded-2xl p-6 text-center shadow-lg">
              <div className="w-16 h-16 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
                <Search className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Find Product</h2>
              <p className="text-sm text-slate-400 mb-6">Enter a barcode manually or use the camera to scan.</p>
              
              <form onSubmit={handleManualSearch} className="relative mb-4">
                <input
                  type="number"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="e.g. 6221000..."
                  className="w-full bg-[#151E32] border border-slate-700/50 rounded-xl py-3 pl-4 pr-12 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-2 p-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
                >
                  <Search size={20} />
                </button>
              </form>

              <div className="relative flex items-center gap-4 my-4">
                <div className="h-px bg-slate-800 flex-1"></div>
                <span className="text-xs text-slate-500 font-bold uppercase">OR</span>
                <div className="h-px bg-slate-800 flex-1"></div>
              </div>

              <button 
                onClick={() => setIsScanning(true)}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-900/50"
              >
                <ScanLine className="h-5 w-5" /> Open Camera Scanner
              </button>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-cyan-500/30 shadow-xl shadow-cyan-500/10">
              <div className="absolute top-2 right-2 z-50">
                <button 
                  onClick={() => setIsScanning(false)}
                  className="bg-slate-900/80 text-white p-2 rounded-full hover:bg-red-500 backdrop-blur-md border border-slate-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ScannerOverlay onScan={(code) => { handleScan(code); setIsScanning(false); }} onClose={() => setIsScanning(false)} />
            </div>
          )}
          
          {loading && (
            <div className="absolute inset-0 bg-[#050810]/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-20 border border-cyan-500/20">
              <Activity className="h-10 w-10 text-cyan-400 animate-spin mb-3" />
              <p className="text-cyan-400 font-medium animate-pulse">Querying Database...</p>
            </div>
          )}
        </div>

        {/* Results Area */}
        {productData && (
          <div className="bg-[#0A101D] border border-cyan-900/40 rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-2">
                  <Package className="h-3 w-3" />
                  Item Profile Found
                </span>
                <h2 className="text-xl font-bold text-white leading-tight">
                  {productData.itemName || productData.description || "Unknown Item"}
                </h2>
                <p className="text-sm text-slate-400 font-mono mt-1 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  {productData.barcode}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-[#151E32] rounded-xl p-3 border border-slate-800">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 flex items-center gap-1">
                  <Banknote className="h-3 w-3" /> Price
                </p>
                <p className="text-xl font-black text-emerald-400">
                  {productData.currentPrice || productData.sellPrice || productData.price || productData.sellingPrice ? `${productData.currentPrice || productData.sellPrice || productData.price || productData.sellingPrice} EGP` : 'N/A'}
                </p>
              </div>
              <div className="bg-[#151E32] rounded-xl p-3 border border-slate-800">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 flex items-center gap-1">
                  <Package className="h-3 w-3" /> Cost
                </p>
                <p className="text-xl font-black text-rose-400">
                  {productData.costPrice || productData.cost || productData.purchasePrice ? `${productData.costPrice || productData.cost || productData.purchasePrice} EGP` : 'N/A'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Factory className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Supplier</p>
                    <p className="text-sm font-semibold text-slate-200">{productData.supplier || productData.priceHistory?.[0]?.supplier || productData.priceHistory?.[productData.priceHistory.length - 1]?.supplier || "Not specified"}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Expiry Info</p>
                    <p className="text-sm font-semibold text-slate-200">{productData.expiryDate || "Not tracked"}</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
