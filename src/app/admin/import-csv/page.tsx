"use client";

import React, { useState } from 'react';
import Papa from 'papaparse';
import { dbService } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

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
      <Card>
        <CardHeader>
          <CardTitle>Import Products Database</CardTitle>
          <CardDescription>
            Upload your items/Book1.csv file to populate the products database. 
            The CSV must contain columns for "Item" (Barcode), "Supplier", and "Description".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <label htmlFor="csv-upload" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              CSV File
            </label>
            <input 
              id="csv-upload" 
              type="file" 
              accept=".csv"
              onChange={handleFileChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <Button 
            onClick={handleUpload} 
            disabled={!file || isUploading}
            className="w-full sm:w-auto"
          >
            {isUploading ? (
              <>Processing...</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" /> Start Import</>
            )}
          </Button>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {results && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Import Complete</AlertTitle>
              <AlertDescription className="text-green-700">
                Successfully imported {results.success} products. 
                {results.failed > 0 && ` Failed to import ${results.failed} rows (check if they had a valid barcode).`}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
