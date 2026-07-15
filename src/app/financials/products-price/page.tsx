"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, PackageSearch, History, TrendingUp, TrendingDown, Clock, Barcode, ArrowRight, X } from "lucide-react";
import { productsDb } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import Link from "next/link";

export default function ProductsPricePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) {
      setProducts([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const term = searchTerm.trim().toUpperCase();
      const productsRef = collection(productsDb, "products");
      
      // Try exact barcode match first
      let q = query(productsRef, where("barcode", "==", term), limit(50));
      let snapshot = await getDocs(q);
      
      let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // If no exact match, try a rudimentary search on description
      if (results.length === 0) {
         // Firestore doesn't do great text search natively without extensions, 
         // but we can pull a batch and filter in memory if the dataset isn't millions.
         // Given this is a local client app, we will fetch recent updated or just query all and filter if small,
         // but best is to rely on exact barcode or prefix if they typed it exactly.
         // For now, let's just query limit 200 and filter in memory for name.
         const allQ = query(productsRef, limit(300));
         const allSnap = await getDocs(allQ);
         const allDocs = allSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
         results = allDocs.filter(doc => 
           doc.description?.toUpperCase().includes(term) || 
           doc.barcode?.toUpperCase().includes(term)
         );
      }

      setProducts(results);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                <PackageSearch size={24} />
              </div>
              Product Price Lookup
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Search the master product database for current prices and historical pricing trends.</p>
          </div>
          <Link href="/financials" className="text-sm font-bold text-slate-500 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
            <ArrowRight size={16} className="rotate-180" />
            Back to Dashboard
          </Link>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
            <Search size={24} />
          </div>
          <input
            type="text"
            placeholder="Scan barcode or type product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-12 py-5 bg-white border-2 border-slate-200 rounded-2xl text-lg font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
          />
          {searchTerm && (
            <button 
              type="button"
              onClick={() => { setSearchTerm(''); setProducts([]); setHasSearched(false); }}
              className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </form>

        {/* Results */}
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-20 text-indigo-500">
            <div className="animate-spin w-10 h-10 border-4 border-current border-t-transparent rounded-full mb-4"></div>
            <p className="font-bold animate-pulse">Searching Master Database...</p>
          </div>
        ) : hasSearched && products.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <PackageSearch size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">No Products Found</h3>
            <p className="text-slate-500">We couldn't find any products matching "{searchTerm}". They might not have been synced from POs yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {products.map((product, idx) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 mb-1 leading-tight">{product.description || "Unknown Product"}</h3>
                      <div className="flex items-center gap-1.5 text-slate-500 bg-slate-100 w-max px-2.5 py-1 rounded-md font-mono text-xs font-bold">
                        <Barcode size={14} />
                        {product.barcode}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Current Price</div>
                      <div className="text-3xl font-black text-indigo-600 tracking-tight">
                        {Number(product.currentPrice).toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-sm text-indigo-400 font-bold">EGP</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <History size={16} className="text-slate-400" />
                      Price History
                    </h4>
                    
                    {product.priceHistory && product.priceHistory.length > 0 ? (
                      <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                        {/* Sort history newest first */}
                        {[...product.priceHistory].sort((a, b) => b.timestamp - a.timestamp).map((entry, i, arr) => {
                          const prevEntry = arr[i + 1];
                          const priceDiff = prevEntry ? entry.price - prevEntry.price : 0;
                          
                          return (
                            <div key={i} className="flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 group-hover:border-indigo-200 transition-colors">
                                  <Clock size={14} />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-700">{entry.price.toLocaleString(undefined, {minimumFractionDigits: 2})} EGP</div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {entry.date ? new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}
                                  </div>
                                </div>
                              </div>
                              
                              {priceDiff !== 0 && (
                                <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${priceDiff > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                  {priceDiff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                  {Math.abs(priceDiff).toLocaleString(undefined, {minimumFractionDigits: 2})} EGP
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-400 text-sm font-medium">
                        No history available.
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

      </div>
    </div>
  );
}
