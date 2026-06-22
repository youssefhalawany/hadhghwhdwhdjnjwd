"use client";

import React, { useState, useRef, useEffect } from 'react';
import { dbService } from '@/lib/firebase';
import { AlertCircle, CheckCircle2, Search, PackageX } from 'lucide-react';

export default function ExpireLogPage() {
  const [barcode, setBarcode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [product, setProduct] = useState<{ supplier: string; description: string } | null>(null);
  const [isNewProduct, setIsNewProduct] = useState(false);
  
  // Form fields for new product or expiry logging
  const [supplier, setSupplier] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  
  const [isLogging, setIsLogging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Focus barcode input on mount
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!barcode.trim()) return;

    setIsSearching(true);
    setStatusMessage(null);
    setProduct(null);
    setIsNewProduct(false);

    try {
      // Lookup product by barcode (which we use as document ID)
      const doc = await dbService.getDoc('products', barcode.trim());
      
      if (doc) {
        setProduct({
          supplier: doc.supplier,
          description: doc.description
        });
        setSupplier(doc.supplier);
        setDescription(doc.description);
      } else {
        setIsNewProduct(true);
        setSupplier('');
        setDescription('');
      }
    } catch (error) {
      console.error("Error searching product:", error);
      setStatusMessage({ type: 'error', text: 'Failed to search product database.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleLogExpiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim() || !supplier.trim() || !description.trim() || !quantity) return;

    setIsLogging(true);
    setStatusMessage(null);

    try {
      const currentBarcode = barcode.trim();
      
      // If it's a new product, save it to the products database first
      if (isNewProduct) {
        await dbService.setDoc('products', currentBarcode, {
          barcode: currentBarcode,
          supplier: supplier.trim(),
          description: description.trim(),
          updatedAt: new Date().toISOString()
        });
      }

      // Log the expiry
      await dbService.addDoc('expired_items', {
        barcode: currentBarcode,
        supplier: supplier.trim(),
        description: description.trim(),
        quantity: parseInt(quantity, 10),
        loggedAt: new Date().toISOString(),
      });

      setStatusMessage({ type: 'success', text: `Successfully logged expiry for ${description.trim()}!` });
      
      // Reset form for next scan
      setBarcode('');
      setProduct(null);
      setIsNewProduct(false);
      setSupplier('');
      setDescription('');
      setQuantity('1');
      barcodeInputRef.current?.focus();
      
    } catch (error) {
      console.error("Error logging expiry:", error);
      setStatusMessage({ type: 'error', text: 'Failed to log expired item.' });
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl text-foreground">
      <div className="flex items-center gap-3 mb-6">
        <PackageX className="h-8 w-8 text-red-600" />
        <h1 className="text-3xl font-bold tracking-tight">Log Expired Items</h1>
      </div>

      <div className="mb-8 border border-border shadow-sm rounded-xl overflow-hidden bg-card">
        <div className="bg-muted/30 p-4 border-b border-border">
          <h3 className="font-semibold text-lg">Scan Barcode</h3>
          <p className="text-sm text-muted-foreground">Scan or enter the item barcode to begin</p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1">
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Enter Barcode..."
                value={barcode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBarcode(e.target.value)}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-lg placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                autoFocus
              />
            </div>
            <button 
              type="submit" 
              disabled={isSearching || !barcode.trim()} 
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 h-12 px-8"
            >
              {isSearching ? 'Searching...' : <><Search className="h-5 w-5 mr-2" /> Find</>}
            </button>
          </form>
        </div>
      </div>

      {statusMessage && (
        <div className={`mb-6 relative w-full rounded-lg border p-4 flex items-start gap-3 ${
          statusMessage.type === 'success' 
            ? 'border-green-500/50 bg-green-500/10 text-green-700' 
            : 'border-red-500/50 bg-red-500/10 text-red-600'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 mt-0.5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 mt-0.5" />
          )}
          <div>
            <h5 className={`mb-1 font-medium leading-none tracking-tight ${statusMessage.type === 'success' ? 'text-green-800' : ''}`}>
              {statusMessage.type === 'success' ? 'Success' : 'Error'}
            </h5>
            <div className="text-sm opacity-90">
              {statusMessage.text}
            </div>
          </div>
        </div>
      )}

      {(product || isNewProduct) && (
        <div className="border border-border shadow-sm rounded-xl overflow-hidden bg-card animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold text-lg">{isNewProduct ? 'New Product Found' : 'Product Details'}</h3>
            <p className="text-sm text-muted-foreground">
              {isNewProduct 
                ? 'This barcode was not found in the database. Please enter the details to save it.' 
                : 'Verify the product details and enter the expired quantity.'}
            </p>
          </div>
          <div className="p-6">
            <form id="expiry-form" onSubmit={handleLogExpiry} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium leading-none">Item Description</label>
                <input
                  id="description"
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                  placeholder="e.g. Milk 1L"
                  required
                  readOnly={!isNewProduct}
                  className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 ${!isNewProduct ? "bg-muted" : ""}`}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="supplier" className="text-sm font-medium leading-none">Supplier</label>
                <input
                  id="supplier"
                  value={supplier}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplier(e.target.value)}
                  placeholder="e.g. Almarai"
                  required
                  readOnly={!isNewProduct}
                  className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 ${!isNewProduct ? "bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="quantity" className="text-sm font-medium leading-none">Quantity Expired</label>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </form>
          </div>
          <div className="p-6 border-t border-border flex items-center">
            <button 
              type="submit" 
              form="expiry-form" 
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 h-10 px-8 w-full"
              disabled={isLogging}
            >
              {isLogging ? 'Logging...' : 'Log as Expired'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
