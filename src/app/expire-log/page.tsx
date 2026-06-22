"use client";

import React, { useState, useRef, useEffect } from 'react';
import { dbService } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Search, PackageX } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    <div className="container mx-auto p-4 md:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <PackageX className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Log Expired Items</h1>
      </div>

      <Card className="mb-8 border-2 border-primary/20 shadow-md">
        <CardHeader className="bg-primary/5 pb-4">
          <CardTitle>Scan Barcode</CardTitle>
          <CardDescription>Scan or enter the item barcode to begin</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1">
              <Input
                ref={barcodeInputRef}
                type="text"
                placeholder="Enter Barcode..."
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="text-lg py-6"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={isSearching || !barcode.trim()} size="lg" className="px-8">
              {isSearching ? 'Searching...' : <><Search className="h-5 w-5 mr-2" /> Find</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {statusMessage && (
        <Alert variant={statusMessage.type === 'error' ? "destructive" : "default"} className={`mb-6 ${statusMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>{statusMessage.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
          <AlertDescription className={statusMessage.type === 'success' ? 'text-green-700' : ''}>
            {statusMessage.text}
          </AlertDescription>
        </Alert>
      )}

      {(product || isNewProduct) && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CardHeader>
            <CardTitle>{isNewProduct ? 'New Product Found' : 'Product Details'}</CardTitle>
            <CardDescription>
              {isNewProduct 
                ? 'This barcode was not found in the database. Please enter the details to save it.' 
                : 'Verify the product details and enter the expired quantity.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form id="expiry-form" onSubmit={handleLogExpiry} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Item Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Milk 1L"
                  required
                  readOnly={!isNewProduct}
                  className={!isNewProduct ? "bg-muted" : ""}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Almarai"
                  required
                  readOnly={!isNewProduct}
                  className={!isNewProduct ? "bg-muted" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity Expired</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              form="expiry-form" 
              className="w-full" 
              size="lg"
              disabled={isLogging}
            >
              {isLogging ? 'Logging...' : 'Log as Expired'}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
