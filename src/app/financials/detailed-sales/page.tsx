"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Upload, FileText, CheckCircle, Loader2, Save, Calendar, GitCompare, RefreshCcw, TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useBranch } from "@/context/BranchContext";
import { productsDb } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import toast from "react-hot-toast";

interface DepartmentData {
  name: string;
  qty_sold: number;
  total_sales: number;
  total_tax_ex: number;
  sales_tax: number;
}

interface DetailedSalesData {
  store_name: string;
  generated_on: string;
  date_sold: string;
  overall_qty_sold: number;
  overall_total_sales: number;
  overall_total_tax_ex: number;
  overall_sales_tax: number;
  departments: DepartmentData[];
}

export default function DetailedSalesPage() {
  const { currentBranch } = useBranch();
  const { language } = useLanguage();
  
  const [extractedData, setExtractedData] = useState<DetailedSalesData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Comparison State
  const [comparisonDate, setComparisonDate] = useState("");
  const [comparisonData, setComparisonData] = useState<DetailedSalesData | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  // Handle image upload or paste
  const processImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please provide a valid image file.");
      return;
    }

    setIsProcessing(true);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const getBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 1200;
              const MAX_HEIGHT = 1600;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
              } else {
                resolve(event.target?.result as string);
              }
            };
            img.onerror = (e) => reject(e);
          };
          reader.onerror = error => reject(error);
        });
      };

      const base64 = await getBase64(file);

      const res = await fetch("/api/extract-detailed-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      if (!res.ok) {
        let errorMessage = "Failed to extract data from image";
        try {
           const errJson = await res.json();
           errorMessage = errJson.error || errorMessage;
        } catch(e) {
           errorMessage = res.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setExtractedData(json.data);
        toast.success("Report data extracted successfully!");
      } else {
        throw new Error(json.error || "Invalid response format");
      }
      setIsProcessing(false);

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Something went wrong.");
      setIsProcessing(false);
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) processImage(file);
        break;
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const fetchComparisonData = async () => {
    if (!comparisonDate || !currentBranch) return;
    setIsLoadingComparison(true);
    setComparisonData(null);
    try {
      const q = query(
        collection(productsDb, "detailed_sales_daily"),
        where("branchId", "==", currentBranch),
        where("date_sold", "==", comparisonDate),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setComparisonData(snapshot.docs[0].data() as DetailedSalesData);
        toast.success(`Loaded data for ${comparisonDate}`);
      } else {
        toast.error(`No data found for ${comparisonDate}`);
      }
    } catch (error) {
      console.error("Error fetching comparison data:", error);
      toast.error("Failed to load comparison data.");
    } finally {
      setIsLoadingComparison(false);
    }
  };

  const handleSave = async () => {
    if (!extractedData || !currentBranch) return;
    setIsSaving(true);
    try {
      const savedUserStr = localStorage.getItem("active_cashier_session");
      let uploaderEmail = "Unknown User";
      if (savedUserStr) {
        const sessionData = JSON.parse(savedUserStr);
        uploaderEmail = sessionData.email || sessionData.name || "Unknown User";
      } else {
        uploaderEmail = localStorage.getItem("circlek_role") || "manager";
      }

      // Convert format for easier querying (DD/MM/YYYY -> YYYY-MM-DD if needed, but we keep raw for now, or standardize)
      let standardDate = extractedData.date_sold;
      if (standardDate.includes("/")) {
        const [day, month, year] = standardDate.split("/");
        standardDate = `${year}-${month}-${day}`;
      }

      await addDoc(collection(productsDb, "detailed_sales_daily"), {
        ...extractedData,
        date_sold: standardDate, // Use standard format for querying
        original_date_string: extractedData.date_sold,
        branchId: currentBranch,
        uploadedBy: uploaderEmail,
        createdAt: new Date().toISOString()
      });
      
      toast.success("Daily Sales Report saved successfully!");
      
      // Auto-set comparison date to what we just saved to encourage checking it next time
      setComparisonDate(standardDate);
      
      // Reset
      setExtractedData(null);
      setPreviewUrl(null);
      
    } catch (error) {
      console.error("Error saving detailed sales:", error);
      toast.error("Failed to save report.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderComparisonDiff = (currentValue: number, previousValue: number | undefined, isCurrency: boolean = false) => {
    if (previousValue === undefined) return null;
    const diff = currentValue - previousValue;
    if (diff === 0) {
      return (
        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
          <Minus className="h-3 w-3" /> Same
        </div>
      );
    }
    const isPositive = diff > 0;
    return (
      <div className={`flex items-center gap-1 text-xs font-semibold mt-1 ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isPositive ? '+' : ''}{isCurrency ? diff.toFixed(2) : diff}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8" onPaste={handlePaste}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-500" />
            Detailed Sales Daily
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload your POS Detailed Sales Report to extract and analyze daily performance.
          </p>
        </div>
      </div>

      {!extractedData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upload Area */}
          <div className="border-2 border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-card hover:bg-muted/50 transition-colors relative overflow-hidden group">
            <input 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            {isProcessing ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
                <h3 className="text-lg font-bold">Analyzing Report...</h3>
                <p className="text-sm text-muted-foreground mt-2">Extracting sales data and categories using AI.</p>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold">Upload POS Report</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                  Drag & drop, click to upload, or simply <strong>Paste (Ctrl+V)</strong> your screenshot here.
                </p>
              </>
            )}
          </div>

          {/* Historical Data Lookup */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                <Calendar className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Historical Lookup</h3>
                <p className="text-xs text-muted-foreground">View past detailed sales reports</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input 
                type="date" 
                value={comparisonDate}
                onChange={(e) => setComparisonDate(e.target.value)}
                className="flex-1 bg-muted/50 border border-border rounded-lg p-3 text-sm outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                onClick={fetchComparisonData}
                disabled={!comparisonDate || isLoadingComparison}
                className="bg-indigo-500 hover:bg-indigo-600 text-white p-3 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isLoadingComparison ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Lookup
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Controls */}
          <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => { setExtractedData(null); setPreviewUrl(null); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-semibold"
              >
                <RefreshCcw className="h-4 w-4" /> Cancel
              </button>
              
              <div className="h-8 w-px bg-border"></div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Compare with:</span>
                <input 
                  type="date" 
                  value={comparisonDate}
                  onChange={(e) => setComparisonDate(e.target.value)}
                  className="bg-muted border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  onClick={fetchComparisonData}
                  disabled={!comparisonDate || isLoadingComparison}
                  className="bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoadingComparison ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
                  Compare
                </button>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {isSaving ? "Saving..." : "Save Report"}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Meta Info */}
            <div className="lg:col-span-1 space-y-6">
              {previewUrl && (
                <div className="glass-panel p-2 rounded-2xl">
                  <img src={previewUrl} alt="Report Preview" className="w-full rounded-xl object-contain border border-border" />
                </div>
              )}
              
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <h3 className="font-bold text-foreground border-b border-border pb-2">Report Details</h3>
                
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Store Name</div>
                  <div className="font-medium mt-1">{extractedData.store_name}</div>
                </div>
                
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Date Sold</div>
                  <div className="font-medium mt-1 text-blue-500">{extractedData.date_sold}</div>
                </div>
                
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Generated On</div>
                  <div className="font-medium mt-1">{extractedData.generated_on}</div>
                </div>
              </div>
            </div>

            {/* Data Tables */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Overall Summary */}
              <div className="glass-panel p-1 rounded-2xl overflow-hidden border border-border shadow-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900/80">
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border rounded-tl-xl">Overall</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border">Qty Sold</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border">Total Sales</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border">Total (Tax Ex)</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border rounded-tr-xl">Sales Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-blue-500/5 hover:bg-blue-500/10 transition-colors">
                      <td className="px-4 py-4 font-black text-blue-600 dark:text-blue-400 border-b border-border">Totals</td>
                      <td className="px-4 py-4 font-semibold border-b border-border">
                        {extractedData.overall_qty_sold}
                        {comparisonData && renderComparisonDiff(extractedData.overall_qty_sold, comparisonData.overall_qty_sold)}
                      </td>
                      <td className="px-4 py-4 font-semibold border-b border-border">
                        LE {extractedData.overall_total_sales.toFixed(2)}
                        {comparisonData && renderComparisonDiff(extractedData.overall_total_sales, comparisonData.overall_total_sales, true)}
                      </td>
                      <td className="px-4 py-4 font-semibold border-b border-border">LE {extractedData.overall_total_tax_ex.toFixed(2)}</td>
                      <td className="px-4 py-4 font-semibold border-b border-border text-rose-500">LE {extractedData.overall_sales_tax.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Departments Table */}
              <div className="glass-panel p-1 rounded-2xl overflow-hidden border border-border shadow-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900/80">
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border rounded-tl-xl">Department</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border">Qty Sold</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border">Total Sales</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border">Total (Tax Ex)</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border rounded-tr-xl">Sales Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.departments.map((dept, idx) => {
                      const compDept = comparisonData?.departments.find(d => d.name === dept.name);
                      
                      return (
                        <tr key={idx} className="hover:bg-muted/50 transition-colors border-b border-border last:border-0">
                          <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                            {dept.name}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            {dept.qty_sold}
                            {compDept && renderComparisonDiff(dept.qty_sold, compDept.qty_sold)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            LE {dept.total_sales.toFixed(2)}
                            {compDept && renderComparisonDiff(dept.total_sales, compDept.total_sales, true)}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{dept.total_tax_ex.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{dept.sales_tax.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}
      
      {/* Search Icon is missing from lucide-react import above, need to add it if it complains but wait I didn't import Search in the current block, ah I did use <Search> on line 185 */}
    </div>
  );
}
