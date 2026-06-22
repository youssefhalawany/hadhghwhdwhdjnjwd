"use client";

import React, { useState } from 'react';
import Papa from 'papaparse';
import { dbService } from '@/lib/firebase';
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react';

export default function ImportCSVPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
      setError(null);
      setProgress(0);
    }
  };

  const handleUpload = () => {
    if (!file) return;

    setIsUploading(true);
    setResults(null);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          // Assuming columns are Supplier, Item, Description based on screenshot
          const barcode = row.Item || row.item || row.Barcode || row.barcode;
          const supplier = row.Supplier || row.supplier || '';
          const description = row.Description || row.description || '';

          if (barcode) {
            try {
              // Convert barcode to string in case it parsed as a number
              const barcodeStr = String(barcode).trim();
              await dbService.setDoc('products', barcodeStr, {
                barcode: barcodeStr,
                supplier,
                description,
                updatedAt: new Date().toISOString()
              });
              successCount++;
            } catch (err) {
              console.error("Error adding row:", row, err);
              failCount++;
            }
          } else {
            failCount++;
          }
          
          setProgress(Math.round(((i + 1) / rows.length) * 100));
        }

        setResults({ success: successCount, failed: failCount });
        setIsUploading(false);
      },
      error: (error) => {
        setError("Failed to parse CSV: " + error.message);
        setIsUploading(false);
      }
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="bg-card text-card-foreground border border-border shadow-sm rounded-xl overflow-hidden">
        <div className="flex flex-col space-y-1.5 p-6 border-b border-border">
          <h3 className="font-semibold leading-none tracking-tight text-xl">Import Products Database</h3>
          <p className="text-sm text-muted-foreground">
            Upload your items/Book1.csv file to populate the products database. 
            The CSV must contain columns for "Item" (Barcode), "Supplier", and "Description".
          </p>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <label htmlFor="csv-upload" className="text-sm font-medium leading-none">
              CSV File
            </label>
            <input 
              id="csv-upload" 
              type="file" 
              accept=".csv"
              onChange={handleFileChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <button 
            onClick={handleUpload} 
            disabled={!file || isUploading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 h-10 px-4 py-2 w-full sm:w-auto"
          >
            {isUploading ? (
              <>Processing...</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" /> Start Import</>
            )}
          </button>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div className="bg-red-600 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          {error && (
            <div className="relative w-full rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-600 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <div>
                <h5 className="mb-1 font-medium leading-none tracking-tight">Error</h5>
                <div className="text-sm opacity-90">{error}</div>
              </div>
            </div>
          )}

          {results && (
            <div className="relative w-full rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-green-700 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 mt-0.5 text-green-600" />
              <div>
                <h5 className="mb-1 font-medium leading-none tracking-tight text-green-800">Import Complete</h5>
                <div className="text-sm opacity-90 text-green-700">
                  Successfully imported {results.success} products. 
                  {results.failed > 0 && ` Failed to import ${results.failed} rows (check if they had a valid barcode).`}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
