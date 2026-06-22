"use client";

import React, { useState, useEffect } from 'react';
import { dbService, db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Search, Package, CalendarX2, ArrowRight } from 'lucide-react';

type Product = {
  id: string; // barcode
  barcode: string;
  description: string;
  supplier: string;
};

type ExpiryRecord = {
  id: string;
  barcode: string;
  description: string;
  supplier: string;
  quantity: number;
  loggedAt: string;
};

export default function ProductLookupPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [productResult, setProductResult] = useState<Product | null>(null);
  const [expiryHistory, setExpiryHistory] = useState<ExpiryRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;

    setIsSearching(true);
    setErrorMessage('');
    setProductResult(null);
    setExpiryHistory([]);

    try {
      let foundProduct: Product | null = null;

      // 1. First try to find it directly by barcode (document ID)
      const directDoc = await dbService.getDoc('products', term);
      if (directDoc) {
        foundProduct = directDoc as Product;
      } else {
        // 2. If not found by barcode, search by description locally
        // In a very large DB, this should be done differently, but this works for thousands of items
        const allProducts = await dbService.getDocs('products');
        const matches = allProducts.filter((p: any) => 
          p.description?.toLowerCase().includes(term.toLowerCase()) || 
          p.supplier?.toLowerCase().includes(term.toLowerCase())
        );

        if (matches.length > 0) {
          // Just take the first match for simplicity in this view
          foundProduct = matches[0] as Product;
        }
      }

      if (foundProduct) {
        setProductResult(foundProduct);
        
        // 3. Fetch expiry history for this specific barcode
        const expQuery = query(
          collection(db, 'expired_items'),
          where('barcode', '==', foundProduct.id || foundProduct.barcode)
        );
        
        const expSnapshot = await getDocs(expQuery);
        const history: ExpiryRecord[] = [];
        expSnapshot.forEach(doc => {
          history.push({ id: doc.id, ...doc.data() } as ExpiryRecord);
        });
        
        // Sort history by date descending
        history.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
        setExpiryHistory(history);
      } else {
        setErrorMessage("No product found matching that barcode or name.");
      }
      
    } catch (error) {
      console.error("Search error:", error);
      setErrorMessage("An error occurred while searching. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return 'Unknown date';
    return new Date(isoString).toLocaleString();
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl text-foreground">
      <div className="flex items-center gap-3 mb-6">
        <Package className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold tracking-tight">Product Lookup</h1>
      </div>

      <div className="mb-8 border border-border shadow-sm rounded-xl overflow-hidden bg-card">
        <div className="bg-muted/30 p-4 border-b border-border">
          <h3 className="font-semibold text-lg">Search Database</h3>
          <p className="text-sm text-muted-foreground">Scan a barcode or type a product name/supplier to view details and expiry history.</p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Scan Barcode or Enter Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-lg placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                autoFocus
              />
            </div>
            <button 
              type="submit" 
              disabled={isSearching || !searchTerm.trim()} 
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-12 px-8 disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : <><Search className="h-5 w-5 mr-2" /> Lookup</>}
            </button>
          </form>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-600">
          <p className="font-medium">{errorMessage}</p>
        </div>
      )}

      {productResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Product Details Card */}
          <div className="md:col-span-1 flex flex-col gap-6">
            <div className="border border-border shadow-sm rounded-xl overflow-hidden bg-card">
              <div className="p-4 border-b border-border bg-blue-50/50 dark:bg-blue-900/20">
                <h3 className="font-semibold text-lg text-blue-800 dark:text-blue-300">Product Info</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-1">Description</p>
                  <p className="text-lg font-bold">{productResult.description}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-1">Barcode / Item ID</p>
                  <p className="font-mono bg-muted px-2 py-1 rounded inline-block text-sm">{productResult.id || productResult.barcode}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-1">Supplier</p>
                  <p className="font-medium">{productResult.supplier || 'Not specified'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Expiry History Card */}
          <div className="md:col-span-2 border border-border shadow-sm rounded-xl overflow-hidden bg-card">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarX2 className="h-5 w-5 text-red-500" />
                <h3 className="font-semibold text-lg">Expiry History</h3>
              </div>
              <span className="bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs font-bold">
                {expiryHistory.length} Records
              </span>
            </div>
            
            <div className="p-0">
              {expiryHistory.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No expired items logged for this product.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-6 py-3">Date Logged</th>
                        <th className="px-6 py-3">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiryHistory.map((record, index) => (
                        <tr key={record.id || index} className="border-b border-border hover:bg-muted/30">
                          <td className="px-6 py-4 font-medium">
                            {formatDate(record.loggedAt)}
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 font-bold px-2.5 py-0.5 rounded">
                              {record.quantity} units
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
