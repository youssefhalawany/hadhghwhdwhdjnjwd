"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, PackageSearch, History, TrendingUp, TrendingDown, Clock, Barcode, ArrowRight, X, ArrowUpRight, ArrowDownRight, Activity, Camera } from "lucide-react";
import { productsDb } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ProductsPricePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isScanning) return;
    
    let scanner: any;
    import("html5-qrcode").then((module) => {
      const Html5QrcodeScanner = module.Html5QrcodeScanner;
      scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 150 } },
        false
      );
      scanner.render(
        (decodedText: string) => {
          setSearchTerm(decodedText);
          setIsScanning(false);
          scanner.clear();
        },
        () => {
          // ignore scan errors
        }
      );
    });

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [isScanning]);

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
      
      let q = query(productsRef, where("barcode", "==", term), limit(50));
      let snapshot = await getDocs(q);
      
      let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (results.length === 0) {
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

  const processProductData = (product: any) => {
    if (!product.priceHistory || product.priceHistory.length === 0) {
      return { chartData: [], min: 0, max: 0, avg: 0 };
    }

    // Sort ascending for the chart (oldest to newest)
    const sortedHistory = [...product.priceHistory].sort((a, b) => a.timestamp - b.timestamp);
    
    // Map to chart format
    const chartData = sortedHistory.map(entry => {
      const d = entry.date ? new Date(entry.date) : new Date(entry.timestamp);
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
        fullDate: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        price: entry.price,
        timestamp: entry.timestamp
      };
    });

    const prices = sortedHistory.map(h => h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

    return { chartData, min, max, avg };
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-md border border-slate-200 p-4 rounded-xl shadow-xl">
          <p className="text-sm font-bold text-slate-500 mb-1 uppercase tracking-wider">{payload[0].payload.fullDate}</p>
          <p className="text-2xl font-black text-indigo-600">
            {payload[0].value.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-sm text-indigo-400">EGP</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <PackageSearch size={24} />
              </div>
              Advanced Price Lookup
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Search the master database for historical pricing trends and analytics.</p>
          </div>
          <Link href="/financials" className="text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2">
            <ArrowRight size={16} className="rotate-180" />
            Back to Dashboard
          </Link>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative group z-10">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
            <Search size={24} />
          </div>
          <input
            type="text"
            placeholder="Scan barcode or type product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-14 py-6 bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl text-xl font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-xl shadow-slate-200/50"
          />
          {!searchTerm && (
            <button 
              type="button"
              onClick={() => setIsScanning(true)}
              className="absolute inset-y-0 right-5 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
            >
              <div className="bg-slate-100 hover:bg-indigo-50 p-2.5 rounded-2xl transition-colors flex items-center gap-2">
                <Camera size={20} />
                <span className="hidden md:inline text-sm font-bold">Scan</span>
              </div>
            </button>
          )}
          {searchTerm && (
            <button 
              type="button"
              onClick={() => { setSearchTerm(''); setProducts([]); setHasSearched(false); }}
              className="absolute inset-y-0 right-5 flex items-center text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 justify-center my-auto"
            >
              <X size={16} />
            </button>
          )}
        </form>

        <AnimatePresence>
          {isScanning && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
              >
                <button 
                  onClick={() => setIsScanning(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 p-2 rounded-full transition-colors z-10"
                >
                  <X size={20} />
                </button>
                <h3 className="text-xl font-black text-slate-900 mb-4 tracking-tight flex items-center gap-2">
                  <Camera size={20} className="text-indigo-600" />
                  Scan Barcode
                </h3>
                <div className="rounded-2xl overflow-hidden border-2 border-slate-100">
                  <div id="reader" className="w-full"></div>
                </div>
                <p className="text-center text-slate-500 text-sm mt-4 font-medium">Point your camera at the barcode</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-32 text-indigo-500">
            <div className="animate-spin w-12 h-12 border-4 border-current border-t-transparent rounded-full mb-6 shadow-lg"></div>
            <p className="font-bold animate-pulse text-lg">Analyzing Master Database...</p>
          </div>
        ) : hasSearched && products.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] p-16 text-center shadow-xl shadow-slate-200/40 border border-slate-100"
          >
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
              <PackageSearch size={48} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">No Products Found</h3>
            <p className="text-slate-500 text-lg max-w-md mx-auto">We couldn't find any products matching "{searchTerm}". They might not have been synced from POs yet.</p>
          </motion.div>
        ) : (
          <div className="space-y-8">
            <AnimatePresence>
              {products.map((product, idx) => {
                const { chartData, min, max, avg } = processProductData(product);
                const currentPrice = Number(product.currentPrice);
                const isGoodDeal = currentPrice <= avg;

                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.4, ease: "easeOut" }}
                    className="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/40 border border-slate-100 flex flex-col overflow-hidden relative"
                  >
                    {/* Decorative Blur Background */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-100/40 via-purple-100/20 to-transparent rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

                    {/* Header Row */}
                    <div className="flex flex-col md:flex-row md:justify-between items-start md:items-end gap-6 mb-10">
                      <div>
                        <h3 className="text-3xl font-black text-slate-900 mb-3 leading-tight tracking-tight">{product.description || "Unknown Product"}</h3>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5 text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg font-mono text-sm font-bold shadow-sm">
                            <Barcode size={16} />
                            {product.barcode}
                          </div>
                          {chartData.length > 1 && (
                            <div className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg shadow-sm ${isGoodDeal ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {isGoodDeal ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                              {isGoodDeal ? "Below Average" : "Above Average"}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-left md:text-right bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50 backdrop-blur-sm min-w-[200px]">
                        <div className="text-sm font-bold text-indigo-500 uppercase tracking-widest mb-1 flex items-center md:justify-end gap-2">
                          <Activity size={14} /> Current Price
                        </div>
                        <div className="text-4xl font-black text-indigo-900 tracking-tight">
                          {currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-lg text-indigo-400 font-bold">EGP</span>
                        </div>
                      </div>
                    </div>

                    {/* Analytics Cards */}
                    {chartData.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100/80">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Lowest Recorded</p>
                          <p className="text-xl font-black text-slate-700">{min.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-xs text-slate-400">EGP</span></p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100/80">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Average Price</p>
                          <p className="text-xl font-black text-slate-700">{avg.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-xs text-slate-400">EGP</span></p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100/80">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Highest Recorded</p>
                          <p className="text-xl font-black text-slate-700">{max.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-xs text-slate-400">EGP</span></p>
                        </div>
                      </div>
                    )}

                    {/* Interactive Chart */}
                    {chartData.length > 1 && (
                      <div className="mb-10 h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis 
                              dataKey="date" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                              domain={['dataMin - 10', 'dataMax + 10']}
                              tickFormatter={(value: number) => `${value}`}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '4 4' }} />
                            <Area 
                              type="monotone" 
                              dataKey="price" 
                              stroke="#6366f1" 
                              strokeWidth={4}
                              fillOpacity={1} 
                              fill="url(#colorPrice)" 
                              activeDot={{ r: 8, stroke: '#fff', strokeWidth: 3, fill: '#4f46e5' }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Detailed History Table */}
                    <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                      <h4 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <History size={18} className="text-slate-400" />
                        Detailed Log
                      </h4>
                      
                      {product.priceHistory && product.priceHistory.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                          {[...product.priceHistory].sort((a, b) => b.timestamp - a.timestamp).map((entry, i, arr) => {
                            const prevEntry = arr[i + 1];
                            const priceDiff = prevEntry ? entry.price - prevEntry.price : 0;
                            const d = entry.date ? new Date(entry.date) : new Date(entry.timestamp);
                            
                            return (
                              <div key={i} className="flex flex-col gap-2 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                                      <Clock size={16} />
                                    </div>
                                    <div>
                                      <div className="font-black text-slate-800 text-lg">{entry.price.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-xs text-slate-400 font-bold">EGP</span></div>
                                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {priceDiff !== 0 && (
                                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${priceDiff > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                      {priceDiff > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                      {Math.abs(priceDiff).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </div>
                                  )}
                                </div>
                                {entry.supplier && entry.supplier !== "Unknown Supplier" && (
                                  <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg w-fit mt-1">
                                    🏢 {entry.supplier}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-400 text-sm font-medium">
                          No history available for this product.
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

      </div>
    </div>
  );
}
