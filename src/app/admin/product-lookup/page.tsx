"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { db, productsDb } from "@/lib/firebase";
import { collection, getDocs, query, where, getDoc, doc, setDoc } from "firebase/firestore";
import { 
  Search, Package, Calendar, AlertTriangle, QrCode, Camera, X, CheckCircle, 
  Edit, PlusCircle, DollarSign, Clock, TrendingUp, TrendingDown, History, 
  Sparkles, Layers, ShieldCheck, Tag, Filter, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { CameraScanner } from "@/components/ui/CameraScanner";
import { useDebounce } from "use-debounce";

export default function ProductLookupPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    }>
      <ProductLookupContent />
    </Suspense>
  );
}

function ProductLookupContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [activeCategory, setActiveCategory] = useState("all");
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

  // All Products & Failed Image Tracking State
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [fetchingProducts, setFetchingProducts] = useState(true);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, boolean>>({});
  const [debouncedSearch] = useDebounce(searchTerm, 300);

  // Normalize keys for string comparisons
  const normalizeKey = (str: string) => str ? str.trim().toLowerCase().replace(/[^a-z0-9]/g, "") : "";

  // Compile Price History array with deltas
  const compilePriceHistory = (product: any, expiries: any[] = [], returns: any[] = []) => {
    const rawHistory: any[] = [];

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

    const currentP = Number(product?.currentPrice || product?.price || 0);
    if (currentP > 0) {
      rawHistory.push({
        price: currentP,
        supplier: product?.supplier || "Current Supplier",
        date: product?.updatedAt ? new Date(product.updatedAt).toLocaleDateString('en-GB') : "Current Catalog",
        source: "catalog"
      });
    }

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

    const seen = new Set<string>();
    const uniqueHistory: any[] = [];

    rawHistory.forEach(item => {
      const key = `${item.price}_${(item.supplier || "").trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueHistory.push(item);
      }
    });

    uniqueHistory.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

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

    return historyWithDeltas.reverse();
  };

  useEffect(() => {
    if (initialSearch) {
      performLookup(initialSearch);
    }
  }, [initialSearch]);

  // Main Catalog Fetching — Reads ALL products from Firebase with NO LIMIT caps
  useEffect(() => {
    const fetchSearchProducts = async () => {
      setFetchingProducts(true);
      try {
        const term = debouncedSearch.trim();
        const rawItems: any[] = [];
        
        if (!term) {
           // Read ALL products from productsDb without limit caps
           const qProducts = collection(productsDb, "products");
           const snap = await getDocs(qProducts);
           snap.docs.forEach(doc => {
              rawItems.push({ id: doc.id, ...doc.data() });
           });
        } else {
          const termLower = term.toLowerCase();
          const termUpper = term.toUpperCase();
          const termTitle = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();

          const queries = [
            getDocs(query(collection(productsDb, "products"), where("description", ">=", termLower), where("description", "<=", termLower + '\uf8ff'))).catch(() => ({ docs: [] } as any)),
            getDocs(query(collection(productsDb, "products"), where("description", ">=", termUpper), where("description", "<=", termUpper + '\uf8ff'))).catch(() => ({ docs: [] } as any)),
            getDocs(query(collection(productsDb, "products"), where("description", ">=", termTitle), where("description", "<=", termTitle + '\uf8ff'))).catch(() => ({ docs: [] } as any)),
            getDocs(query(collection(productsDb, "products"), where("itemName", ">=", termTitle), where("itemName", "<=", termTitle + '\uf8ff'))).catch(() => ({ docs: [] } as any)),
          ];

          const snaps = await Promise.all(queries);
          snaps.forEach((s: any) => {
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
                 expiryDate: data.expiryDate
              });
            });
          });

          const directSnap = await getDoc(doc(productsDb, "products", term));
          if (directSnap.exists()) {
             rawItems.push({ id: term, barcode: term, ...directSnap.data() });
          }
        }

        const consolidatedMap = new Map<string, any>();

        rawItems.forEach(item => {
          const barcodeKey = (item.barcode || item.id || "").trim();
          const rawName = item.description || item.itemName || item.name || "";
          const nameKey = normalizeKey(rawName);
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
            
            if (barcodeKey && barcodeKey !== "undefined" && barcodeKey !== "null" && !existing.allBarcodes.includes(barcodeKey)) {
              existing.allBarcodes.push(barcodeKey);
            }

            if (itemPrice > 0) {
              existing.collectedPrices.push({ price: itemPrice, supplier: item.supplier || existing.supplier, date: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-GB') : "Catalog" });
              existing.price = itemPrice;
              existing.currentPrice = itemPrice;
            }

            if (item.priceHistory && Array.isArray(item.priceHistory)) {
              item.priceHistory.forEach((ph: any) => {
                if (ph.price) existing.collectedPrices.push(ph);
              });
            }

            if (!existing.supplier && item.supplier) existing.supplier = item.supplier;
            if (item.expiryDate && (!existing.expiryDate || new Date(item.expiryDate) < new Date(existing.expiryDate))) {
              existing.expiryDate = item.expiryDate;
            }
          }
        });

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

        // Auto-fetch missing or broken images via AI resolution endpoint
        consolidatedList.forEach(async (prod) => {
          const nameLower = (prod.description || prod.itemName || prod.name || "").toLowerCase();
          const needsFetch = !prod.imageUrl || 
            prod.imageUrl.includes("photo-1542838132-92c53300491e") ||
            prod.imageUrl.includes("photo-1558961363-fa8fdf82db35") ||
            prod.imageUrl.includes("photo-1541781774459-bb2af2f05b55") ||
            ((nameLower.includes("marlboro") || nameLower.includes("merit") || nameLower.includes("l&m") || nameLower.includes("terea")) && !prod.imageUrl.includes("photo-1527061011665-3652c757a4d4")) ||
            (nameLower.includes("pringles") && !prod.imageUrl.includes("photo-1599490659213-e2b9527bd087")) ||
            (nameLower.includes("crunchos") && !prod.imageUrl.includes("photo-1566478989037-eec170784d0b"));

          if (needsFetch) {
            try {
              const res = await fetch("/api/products/fetch-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ barcode: prod.barcode || prod.id, name: prod.description || prod.itemName || prod.name })
              });
              if (res.ok) {
                const data = await res.json();
                if (data.imageUrl) {
                  setAllProducts(prev => prev.map(p => p.groupKey === prod.groupKey ? { ...p, imageUrl: data.imageUrl } : p));
                }
              }
            } catch (err) {
              console.warn("Auto image fetch failed:", err);
            }
          }
        });
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
            getDocs(query(collection(productsDb, "products"), where("description", ">=", termLower), where("description", "<=", termLower + '\uf8ff'))),
            getDocs(query(collection(productsDb, "products"), where("description", ">=", termUpper), where("description", "<=", termUpper + '\uf8ff'))),
            getDocs(query(collection(productsDb, "products"), where("description", ">=", termTitle), where("description", "<=", termTitle + '\uf8ff'))),
            getDocs(query(collection(productsDb, "products"), where("itemName", ">=", termTitle), where("itemName", "<=", termTitle + '\uf8ff')))
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
    if (searchTerm.trim()) {
      performLookup(searchTerm);
    }
  };

  const handleScanResult = (result: string) => {
    setShowScanner(false);
    if (scannerTarget === "search") {
      setSearchTerm(result);
      performLookup(result);
    } else {
      setEditFormData(prev => ({ ...prev, barcode: result }));
    }
  };

  const startScanning = (target: "search" | "form") => {
    setScannerTarget(target);
    setShowScanner(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);

    try {
      const barcodeToSave = editFormData.barcode || productData?.barcode || productData?.id;
      if (!barcodeToSave) throw new Error("No barcode specified");

      const currentPrices = productData?.priceHistory || [];
      const newPriceEntry = {
        price: Number(productData?.currentPrice || productData?.price || 0),
        supplier: editFormData.supplier,
        date: new Date().toISOString().split('T')[0]
      };

      const updatedHistory = [newPriceEntry, ...currentPrices];

      const productPayload = {
        barcode: barcodeToSave,
        description: editFormData.name,
        name: editFormData.name,
        supplier: editFormData.supplier,
        priceHistory: updatedHistory,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(productsDb, "products", barcodeToSave), productPayload, { merge: true });

      setProductData((prev: any) => ({
        ...prev,
        description: editFormData.name,
        name: editFormData.name,
        supplier: editFormData.supplier,
        barcode: barcodeToSave,
        priceHistory: updatedHistory,
        isPhantom: false
      }));

      setIsEditing(false);
    } catch (err: any) {
      console.error("Failed to save product:", err);
      alert("Error saving product: " + err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  // Live Category Quick Filtering
  const categoryFilteredProducts = useMemo(() => {
    if (activeCategory === "all") return allProducts;
    return allProducts.filter(p => {
      const name = (p.description || p.itemName || p.name || "").toLowerCase();
      if (activeCategory === "tobacco") return name.includes("marlboro") || name.includes("merit") || name.includes("l&m") || name.includes("terea") || name.includes("heets") || name.includes("cigaret");
      if (activeCategory === "beverages") return name.includes("water") || name.includes("aquafina") || name.includes("pepsi") || name.includes("coca") || name.includes("fanta") || name.includes("soda") || name.includes("drink");
      if (activeCategory === "snacks") return name.includes("chip") || name.includes("stix") || name.includes("pringles") || name.includes("crunchos") || name.includes("nut") || name.includes("cashew") || name.includes("pistachio");
      if (activeCategory === "coffee") return name.includes("coffee") || name.includes("brown") || name.includes("espres") || name.includes("nescafe");
      if (activeCategory === "sweets") return name.includes("chocolate") || name.includes("cadbury") || name.includes("wafer") || name.includes("biscuit");
      return true;
    });
  }, [allProducts, activeCategory]);

  const totalPricesLogged = useMemo(() => {
    return allProducts.reduce((acc, p) => acc + (p.priceHistoryCount || 1), 0);
  }, [allProducts]);

  // Immediate Product Image Resolver helper
  const getProductImage = (p: any) => {
    const key = p.groupKey || p.barcode || p.id;
    if (p.imageUrl && !failedImageUrls[key]) {
      return p.imageUrl;
    }
    const name = (p.description || p.itemName || p.name || "").toLowerCase();

    if (name.includes("aquafina") || name.includes("water") || name.includes("hayat")) {
      return "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80";
    }
    if (name.includes("pepsi")) {
      return "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=500&auto=format&fit=crop&q=80";
    }
    if (name.includes("coca") || name.includes("coke")) {
      return "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&auto=format&fit=crop&q=80";
    }
    if (name.includes("fanta")) {
      return "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80";
    }
    if (name.includes("marlboro") || name.includes("merit") || name.includes("l&m") || name.includes("terea") || name.includes("heets")) {
      return "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&auto=format&fit=crop&q=80";
    }
    if (name.includes("pringles")) {
      return "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=500&auto=format&fit=crop&q=80";
    }
    if (name.includes("crunchos") || name.includes("stix") || name.includes("chip")) {
      return "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80";
    }
    if (name.includes("brown") || name.includes("coffee") || name.includes("espres")) {
      return "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=80";
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#070C18] text-slate-900 dark:text-slate-100 p-4 md:p-8 space-y-6 font-sans transition-colors duration-200">
      
      {/* EXECUTIVE HEADER BANNER — Solid High Contrast Deep Dark Blue */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0F172A] border border-slate-800 p-6 md:p-8 shadow-xl text-white">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5" /> Circle K Hub
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black uppercase tracking-widest shadow-sm">
                Firebase Sync Active
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <Package className="w-8 h-8 text-cyan-400" /> Product & Price Catalog
            </h1>
            <p className="text-slate-300 text-sm font-medium mt-1 max-w-xl">
              Real-time barcode catalog, consolidated product identity, price change history, and supplier ledgers.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => {
                setEditFormData({ name: "", supplier: "", barcode: "" });
                setProductData({ notFound: true, searchTerm: "" });
                setIsEditing(true);
                setDrawerOpen(true);
              }}
              className="flex-1 md:flex-initial px-5 py-3.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-sm shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <PlusCircle className="w-5 h-5" /> Add New Product
            </button>
          </div>
        </div>

        {/* METRICS STATS BAR */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Total Products in Database</p>
            <p className="text-2xl font-black text-white font-mono mt-0.5">{allProducts.length}</p>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Price History Logs</p>
            <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">{totalPricesLogged}</p>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Filtered Items</p>
            <p className="text-2xl font-black text-cyan-300 font-mono mt-0.5">{categoryFilteredProducts.length}</p>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Scanner Status</p>
            <p className="text-xl font-black text-purple-300 font-mono mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Ready
            </p>
          </div>
        </div>
      </div>

      {/* SEARCH BAR & QUICK FILTERS */}
      <div className="space-y-4">
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search all products by name, barcode, supplier, or brand (e.g. Marlboro, Aquafina, Pepsi)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-cyan-500 rounded-2xl pl-12 pr-10 py-4 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none shadow-sm transition-all focus:ring-4 focus:ring-cyan-500/20"
            />
            {searchTerm && (
              <button 
                type="button" 
                onClick={() => setSearchTerm("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => startScanning("search")}
            className="p-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl transition-all shadow-md flex items-center justify-center shrink-0 active:scale-95 group"
            title="Scan Product Barcode"
          >
            <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        </form>

        {/* CATEGORY QUICK FILTER PILLS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: "all", label: "All Products" },
            { id: "tobacco", label: "🚬 Tobacco & Cigarettes" },
            { id: "beverages", label: "🥤 Beverages & Soda" },
            { id: "snacks", label: "🍟 Chips & Snacks" },
            { id: "coffee", label: "☕ Iced Coffee & Drinks" },
            { id: "sweets", label: "🍫 Chocolates & Sweets" }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black tracking-tight whitespace-nowrap transition-all border ${
                activeCategory === cat.id
                  ? "bg-cyan-600 border-cyan-600 text-white shadow-md"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* PRODUCT GRID — Seamless Light & Dark Mode Cards */}
      {fetchingProducts && !loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {categoryFilteredProducts.map((p, idx) => {
            const productImg = getProductImage(p);

            return (
              <motion.div
                key={p.id || idx}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => performLookup(p.barcode || p.id, p)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-cyan-500 dark:hover:border-cyan-500 hover:shadow-xl transition-all group flex flex-col h-full relative overflow-hidden active:scale-98"
              >
                {/* Product Thumbnail Box */}
                <div className="aspect-square bg-slate-50 dark:bg-slate-950 rounded-xl mb-3.5 flex items-center justify-center border border-slate-100 dark:border-slate-800 overflow-hidden relative">
                  {productImg ? (
                    <img 
                      src={productImg} 
                      alt={p.description || p.name} 
                      onError={() => {
                        setFailedImageUrls(prev => ({ ...prev, [p.groupKey || p.barcode || p.id]: true }));
                      }}
                      className="w-full h-full object-contain p-2 group-hover:scale-108 transition-transform duration-300" 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 group-hover:text-cyan-500 transition-colors">
                      <Package className="w-10 h-10 group-hover:scale-110 transition-transform duration-300" />
                    </div>
                  )}

                  {/* LATEST PRICE BADGE */}
                  {p.price && (
                    <div className="absolute bottom-2 right-2 bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-black tracking-wider shadow-md flex items-center gap-1 border border-emerald-500/50">
                      <DollarSign className="w-3 h-3" /> {p.price} EGP
                    </div>
                  )}

                  {/* PRICE HISTORY LOGS COUNT */}
                  {p.priceHistoryCount > 1 && (
                    <div className="absolute top-2 left-2 bg-cyan-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider flex items-center gap-1 shadow-sm">
                      <History className="w-2.5 h-2.5" /> {p.priceHistoryCount} Prices
                    </div>
                  )}
                </div>

                {/* PRODUCT TITLE */}
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight mb-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                  {p.description || p.name || p.itemName || "Unnamed Product"}
                </h4>

                {/* SUPPLIER & EXPIRY */}
                <div className="mt-auto flex flex-col gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  <div className="flex items-center gap-1">
                    <Package className="w-3 h-3 text-slate-400 shrink-0" /> 
                    <span className="line-clamp-1">{p.supplier || "Catalog Item"}</span>
                  </div>
                  {p.expiryDate && (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                      <Clock className="w-3 h-3 shrink-0" /> Expiry: {p.expiryDate}
                    </div>
                  )}
                </div>

                {/* BARCODE BADGE FOOTER */}
                <div className="mt-3 text-xs text-slate-500 flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-2">
                  <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[85%]">
                    #{p.barcode || p.id}
                    {p.allBarcodes && p.allBarcodes.length > 1 && (
                      <span className="ml-1 text-cyan-600 dark:text-cyan-400 font-bold text-[9px]">(+{p.allBarcodes.length - 1} Barcode)</span>
                    )}
                  </span>
                </div>
              </motion.div>
            );
          })}

          {categoryFilteredProducts.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800">
              <Package className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
              <p className="font-bold text-slate-700 dark:text-slate-300 text-base">No matching products found</p>
              <p className="text-xs text-slate-500 mt-1">Try searching with a different barcode or keyword.</p>
            </div>
          )}
        </div>
      )}

      {/* EXECUTIVE DETAILS SLIDING DRAWER */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 no-print"
            />

            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white dark:bg-[#0B1121] border-l border-slate-200 dark:border-white/10 shadow-2xl z-50 overflow-y-auto no-print p-6 flex flex-col text-slate-900 dark:text-slate-100"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">
                    Product Specification
                  </span>
                </div>
                <button 
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500"></div>
                </div>
              ) : productData ? (
                <div className="space-y-6 pt-4">
                  
                  {/* EDIT FORM VIEW */}
                  {isEditing ? (
                    <form onSubmit={handleSaveProduct} className="space-y-4 bg-slate-50 dark:bg-white/5 p-5 rounded-2xl border border-slate-200 dark:border-white/10">
                      <h4 className="font-black text-slate-900 dark:text-white text-base mb-2">Edit Product Catalog Entry</h4>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Barcode</label>
                        <div className="flex gap-2">
                          <input 
                            required type="text" value={editFormData.barcode} onChange={(e) => setEditFormData({...editFormData, barcode: e.target.value})} disabled={!productData.notFound && !!productData.id}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:border-cyan-500 outline-none disabled:opacity-50"
                          />
                          <button type="button" onClick={() => startScanning("form")} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700"><Camera className="h-5 w-5" /></button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Product Description</label>
                        <input required type="text" value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:border-cyan-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Supplier</label>
                        {isAddingSupplier ? (
                          <div className="flex gap-2">
                            <input required type="text" placeholder="New supplier..." value={editFormData.supplier} onChange={(e) => setEditFormData({...editFormData, supplier: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:border-cyan-500 outline-none" />
                            <button type="button" onClick={() => { setIsAddingSupplier(false); setEditFormData({...editFormData, supplier: ""}); }} className="p-3 bg-rose-50 text-rose-600 rounded-xl font-bold"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <select required value={editFormData.supplier} onChange={(e) => setEditFormData({...editFormData, supplier: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:border-cyan-500 outline-none">
                              <option value="" disabled>Select supplier</option>
                              {Array.from(new Set(allProducts.map(p => p.supplier).filter(Boolean))).sort().map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
                            </select>
                            <button type="button" onClick={() => { setIsAddingSupplier(true); setEditFormData({...editFormData, supplier: ""}); }} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold flex gap-1 items-center"><PlusCircle className="h-4 w-4" /> New</button>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-4">
                        <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700">Cancel</button>
                        <button type="submit" disabled={saveLoading} className="flex-1 bg-cyan-600 text-white py-3 rounded-xl font-extrabold hover:bg-cyan-500 disabled:opacity-50">{saveLoading ? "Saving..." : "Save Product"}</button>
                      </div>
                    </form>
                  ) : (
                    /* PRODUCT READ-ONLY DETAILS VIEW */
                    <div>
                      <div className="flex justify-between items-start mb-6 gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/10">
                        {productData.imageUrl && (
                          <img src={productData.imageUrl} alt="Product" className="w-20 h-20 object-contain bg-white dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 shrink-0 shadow-sm" />
                        )}
                        <div className="flex-1">
                          <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-black uppercase tracking-wider mb-0.5">Product Title</p>
                          <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                            {productData.description || productData.name || productData.itemName}
                          </h3>
                        </div>
                        <button 
                          onClick={() => { 
                            setEditFormData({ 
                              name: productData.description || productData.name || productData.itemName || "", 
                              supplier: productData.supplier || productData.priceHistory?.[0]?.supplier || "", 
                              barcode: productData.barcode || productData.id 
                            }); 
                            setIsEditing(true); 
                          }} 
                          className="bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white p-2.5 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-white/20 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>

                      {/* KEY METRICS GRID */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                        <div className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl border border-slate-200 dark:border-white/10">
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase mb-1">Registered Barcodes</p>
                          <div className="flex flex-wrap gap-1">
                            {productData.allBarcodes && productData.allBarcodes.length > 0 ? (
                              productData.allBarcodes.map((b: string, i: number) => (
                                <span key={i} className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-500/20">#{b}</span>
                              ))
                            ) : (
                              <span className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-300">#{productData.barcode || productData.id}</span>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl border border-slate-200 dark:border-white/10">
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase mb-1">Supplier</p>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{productData.supplier || productData.priceHistory?.[0]?.supplier || "Catalog Item"}</p>
                        </div>

                        <div className="bg-emerald-50 dark:bg-emerald-500/15 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 col-span-2 md:col-span-1">
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-black uppercase mb-1 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> Latest Price
                          </p>
                          <p className="font-black text-xl text-emerald-700 dark:text-emerald-400 font-mono">
                            {productData.price ? `${productData.price} EGP` : productData.currentPrice ? `${productData.currentPrice} EGP` : "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* CHRONOLOGICAL PRICE & SUPPLIER HISTORY TIMELINE */}
                      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/10">
                        <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <History className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> Compiled Price & Supplier Timeline ({productData.compiledPriceHistory?.length || 0})
                        </h4>

                        <div className="space-y-2.5">
                          {productData.compiledPriceHistory?.map((ph: any, idx: number) => (
                            <div key={idx} className="p-3.5 rounded-2xl border bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 flex justify-between items-center shadow-sm">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-sm text-slate-900 dark:text-white">{ph.supplier || "Supplier"}</p>
                                  {ph.delta !== 0 && (
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                                      ph.delta > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                                    }`}>
                                      {ph.delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                      {ph.delta > 0 ? `+${ph.delta.toFixed(2)} EGP` : `${ph.delta.toFixed(2)} EGP`}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Date: {ph.date}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">{ph.price} <span className="text-xs">EGP</span></p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CAMERA SCANNER MODAL */}
      {showScanner && (
        <CameraScanner
          onScan={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
