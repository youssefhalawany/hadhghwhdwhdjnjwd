"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShieldAlert, Package, TrendingUp, Activity, X } from "lucide-react";
import { db, productsDb } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { useDebounce } from "use-debounce";

export function CommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const [dbResults, setDbResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [debouncedSearch] = useDebounce(search, 400);

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const fetchDb = async () => {
      const term = debouncedSearch.trim();
      if (term.length < 2) {
        setDbResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const termTitle = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();
        const termLower = term.toLowerCase();
        const termUpper = term.toUpperCase();

        const queries = [
          getDocs(query(collection(productsDb, "products"), where("description", ">=", termLower), where("description", "<=", termLower + '\uf8ff'), limit(3))),
          getDocs(query(collection(productsDb, "products"), where("description", ">=", termUpper), where("description", "<=", termUpper + '\uf8ff'), limit(3))),
          getDocs(query(collection(productsDb, "products"), where("description", ">=", termTitle), where("description", "<=", termTitle + '\uf8ff'), limit(3))),
          getDocs(query(collection(productsDb, "products"), where("itemName", ">=", termTitle), where("itemName", "<=", termTitle + '\uf8ff'), limit(3)))
        ];

        const snaps = await Promise.all(queries);
        const resultsMap = new Map();
        snaps.forEach(s => {
          s.docs.forEach(doc => {
            if (!resultsMap.has(doc.id)) {
              resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
            }
          });
        });
        
        setDbResults(Array.from(resultsMap.values()).slice(0, 8)); // Max 8 results
      } catch (err) {
        console.error("CommandBar search error:", err);
      } finally {
        setIsSearching(false);
      }
    };
    fetchDb();
  }, [debouncedSearch]);

  const commands = [
    { name: "Command Center Dashboard", href: "/financials/inputs", icon: <Activity className="w-5 h-5 text-cyan-400" /> },
    { name: "Voids Manager", href: "/voids/manager", icon: <ShieldAlert className="w-5 h-5 text-amber-400" /> },
    { name: "Out of Stock Tracker", href: "/financials/out-of-stock", icon: <Package className="w-5 h-5 text-rose-400" /> },
    { name: "Expiries Audit", href: "/products/expiries-audit", icon: <Package className="w-5 h-5 text-blue-400" /> },
    { name: "Product Lookup", href: "/admin/product-lookup", icon: <Search className="w-5 h-5 text-emerald-400" /> },
    { name: "Sales Overview", href: "/financials/sales", icon: <TrendingUp className="w-5 h-5 text-emerald-400" /> }
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(search.toLowerCase())
  );

  const productCommands = dbResults.map(p => ({
    name: p.itemName || p.description || p.name || "Unknown Product",
    barcode: p.barcode || p.id,
    href: `/admin/product-lookup?search=${encodeURIComponent(p.barcode || p.id)}`,
    icon: <Package className="w-5 h-5 text-purple-400" />,
    isProduct: true
  }));

  const allFiltered = [...filteredCommands, ...productCommands];

  const handleSelect = (href: string) => {
    setIsOpen(false);
    setSearch("");
    router.push(href);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-white/60 dark:bg-[#050810]/60 backdrop-blur-md"
            onClick={() => setIsOpen(false)}
          />

          {/* Command Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-[9999] px-4"
          >
            <div className="bg-white/90 dark:bg-[#0A101D]/90 backdrop-blur-xl border border-slate-200 dark:border-cyan-500/20 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(34,211,238,0.2)] overflow-hidden flex flex-col">
              
              {/* Search Input */}
              <div className="flex items-center px-4 border-b border-slate-100 dark:border-slate-800">
                <Search className="w-5 h-5 text-slate-400 dark:text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type a command or search for a product..."
                  className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 px-4 py-5 outline-none font-medium text-lg"
                />
                {isSearching && (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-cyan-500 mr-3"></div>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Results List */}
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {allFiltered.length > 0 ? (
                  <div className="space-y-1">
                    {filteredCommands.length > 0 && (
                       <>
                         <p className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Actions</p>
                         {filteredCommands.map((cmd) => (
                           <button
                             key={cmd.name}
                             onClick={() => handleSelect(cmd.href)}
                             className="w-full flex items-center gap-3 px-3 py-4 rounded-xl hover:bg-cyan-500/10 text-left transition-colors group"
                           >
                             <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 group-hover:bg-white dark:group-hover:bg-[#0A101D] transition-colors">
                               {cmd.icon}
                             </div>
                             <span className="text-slate-700 dark:text-slate-300 font-medium group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                               {cmd.name}
                             </span>
                             <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded">Jump</span>
                             </div>
                           </button>
                         ))}
                       </>
                    )}

                    {productCommands.length > 0 && (
                       <>
                         <p className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Products</p>
                         {productCommands.map((cmd) => (
                           <button
                             key={cmd.barcode}
                             onClick={() => handleSelect(cmd.href)}
                             className="w-full flex items-center gap-3 px-3 py-4 rounded-xl hover:bg-purple-500/10 text-left transition-colors group"
                           >
                             <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 group-hover:bg-white dark:group-hover:bg-[#0A101D] transition-colors">
                               {cmd.icon}
                             </div>
                             <div className="flex flex-col">
                               <span className="text-slate-700 dark:text-slate-300 font-medium group-hover:text-slate-900 dark:group-hover:text-white transition-colors line-clamp-1">
                                 {cmd.name}
                               </span>
                               <span className="text-[10px] text-slate-500 font-mono mt-0.5">#{cmd.barcode}</span>
                             </div>
                             <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                               <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded">View Details</span>
                             </div>
                           </button>
                         ))}
                       </>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-slate-500">
                    No results found for "{search}"
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="bg-slate-50/50 dark:bg-[#050810]/50 px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-400">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-400">↓</kbd> to navigate</span>
                  <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-400">enter</kbd> to select</span>
                </div>
                <span><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-400">esc</kbd> to close</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
