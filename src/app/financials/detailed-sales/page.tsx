"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Upload, FileText, CheckCircle, Loader2, Save, Calendar, GitCompare, RefreshCcw, TrendingUp, TrendingDown, Minus, Search, Clipboard, AlertCircle, Coffee, Pizza, Banknote, CreditCard, Wallet, AlertTriangle, Eye } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useBranch } from "@/context/BranchContext";
import { productsDb, db } from "@/lib/firebase";
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
  id?: string;
  branchId?: string;
  storeId?: string;
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
  const [comparisonData, setComparisonData] = useState<DetailedSalesData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Comparison State
  const [comparisonDate, setComparisonDate] = useState("");
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  // Historical List State
  const [historicalReports, setHistoricalReports] = useState<DetailedSalesData[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchHistoricalReports = useCallback(async () => {
    if (!currentBranch) return;
    setIsLoadingHistory(true);
    try {
      const storeIdMap: Record<string, string> = {
        "alamein4": "eL-alamein-4",
        "ola": "ola-el-koronfol",
        "eL-alamein-4": "alamein4",
        "ola-el-koronfol": "ola"
      };
      const altBranch = storeIdMap[currentBranch] || currentBranch;

      // Fetch all reports and filter in memory to avoid missing composite index errors
      // and to catch both branchId aliases (eL-alamein-4 vs alamein4)
      const q = query(collection(productsDb, "detailed_sales_daily"), limit(300));
      const snapshot = await getDocs(q);
      const reports: DetailedSalesData[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (currentBranch === "all" || data.branchId === currentBranch || data.branchId === altBranch || data.storeId === currentBranch || data.storeId === altBranch) {
          reports.push({ id: doc.id, ...data } as unknown as DetailedSalesData);
        }
      });
      
      // Sort descending by date_sold
      reports.sort((a, b) => (b.date_sold || "").localeCompare(a.date_sold || ""));
      
      setHistoricalReports(reports);
    } catch (error) {
      console.error("Failed to fetch historical reports:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [currentBranch]);

  useEffect(() => {
    fetchHistoricalReports();
  }, [fetchHistoricalReports]);

  const filteredHistory = historicalReports.filter(report => 
    report.date_sold?.includes(searchQuery) ||
    report.overall_total_sales?.toString().includes(searchQuery)
  );

  // Shift Totals State
  interface ShiftTotals {
    cash: number;
    visa: number;
    total: number;
  }
  const [shiftTotals, setShiftTotals] = useState<ShiftTotals | null>(null);
  const [isLoadingShiftTotals, setIsLoadingShiftTotals] = useState(false);

  // Fetch shift totals
  const fetchShiftTotals = useCallback(async (date: string, branch: string) => {
    if (!date || !branch) return;
    setIsLoadingShiftTotals(true);
    setShiftTotals(null);
    try {
      const storeIdMap: Record<string, string> = {
        "alamein4": "eL-alamein-4",
        "ola": "ola-el-koronfol",
        "eL-alamein-4": "alamein4",
        "ola-el-koronfol": "ola"
      };
      const altBranch = storeIdMap[branch] || branch;

      // We can't easily do OR across two different fields in standard Firestore without composite indexes, 
      // so we'll just fetch all for the date and filter in memory since it's only a few docs per day!
      const q = query(
        collection(db, "sales"),
        where("date", "==", date)
      );
      const snapshot = await getDocs(q);
      let cash = 0;
      let visa = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.branchId === branch || data.branchId === altBranch || data.storeId === branch || data.storeId === altBranch) {
          cash += (Number(data.cash) || 0);
          visa += (Number(data.visa) || 0);
        }
      });
      setShiftTotals({ cash, visa, total: cash + visa });
    } catch (error) {
      console.error("Failed to fetch shift totals:", error);
    } finally {
      setIsLoadingShiftTotals(false);
    }
  }, []);

  useEffect(() => {
    if (extractedData?.date_sold && currentBranch) {
      let standardDate = extractedData.date_sold || "";
      if (standardDate.includes("/")) {
        const parts = standardDate.split("/");
        if (parts.length === 3) {
          standardDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      
      // If we are on "All Branches", pass the specific report's branch so shift totals query works correctly
      let targetBranchForTotals = currentBranch;
      if (currentBranch === "all") {
        targetBranchForTotals = (extractedData.branchId || extractedData.storeId || "all") as any;
      }
      
      fetchShiftTotals(standardDate, targetBranchForTotals);
    }
  }, [extractedData, currentBranch, fetchShiftTotals]);

  // Analytics Helper
  const calcAnalytics = () => {
    if (!extractedData) return null;
    const totalSales = extractedData.overall_total_sales || 1; 
    const deps = extractedData.departments || [];

    const coffee = deps.filter(d => 
      d.name?.toLowerCase().includes("coffee")
    ).reduce((sum, d) => sum + (d.total_sales || 0), 0);
    const coffeePct = ((coffee / totalSales) * 100).toFixed(1);

    const cig = deps.filter(d => 
      d.name?.toLowerCase().includes("cig") || d.name?.toLowerCase().includes("tobacco")
    ).reduce((sum, d) => sum + (d.total_sales || 0), 0);
    const cigPct = ((cig / totalSales) * 100).toFixed(1);

    const foodKeywords = ["cold cut", "bakery", "rich cut", "burger", "pizza", "donut", "cookie"];
    const food = deps.filter(d => 
      foodKeywords.some(kw => d.name?.toLowerCase().includes(kw))
    ).reduce((sum, d) => sum + (d.total_sales || 0), 0);
    const foodPct = ((food / totalSales) * 100).toFixed(1);

    return { coffee, coffeePct, cig, cigPct, food, foodPct, totalSales };
  };

  const analytics = calcAnalytics();

  // Handle image upload or paste
  const processImage = async (file: File) => {
    setErrorMsg(null);
    if (!file.type.startsWith("image/")) {
      const msg = "Please provide a valid image file.";
      toast.error(msg);
      setErrorMsg(msg);
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
              const MAX_WIDTH = 1800; // Lowered to prevent payload too large errors
              const MAX_HEIGHT = 2800;
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
                resolve(canvas.toDataURL('image/jpeg', 0.75));
              } else {
                resolve(event.target?.result as string);
              }
            };
            img.onerror = () => reject(new Error("Could not decode image. If this is an HEIC photo from an iPhone, please convert it to JPEG/PNG or take a direct screenshot."));
          };
          reader.onerror = () => reject(new Error("Failed to read the file."));
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
      const msg = error.message || "Something went wrong.";
      toast.error(msg);
      setErrorMsg(msg);
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

  const handlePasteButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // prevent triggering the file input click
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith("image/")) {
            const blob = await clipboardItem.getType(type);
            const file = new File([blob], "pasted-image.png", { type });
            processImage(file);
            return;
          }
        }
      }
      toast.error("No image found in clipboard.");
    } catch (err) {
      console.error(err);
      toast.error("Could not read clipboard. Try pressing Ctrl+V / Cmd+V instead.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
    // Clear the input value so the exact same file can be selected again if needed
    e.target.value = '';
  };

  const fetchComparisonData = async (isPrimaryLookup = false) => {
    if (!comparisonDate || !currentBranch) return;
    setIsLoadingComparison(true);
    if (!isPrimaryLookup) setComparisonData(null);
    
    try {
      const q = query(
        collection(productsDb, "detailed_sales_daily"),
        where("branchId", "==", currentBranch),
        where("date_sold", "==", comparisonDate),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as DetailedSalesData;
        if (isPrimaryLookup) {
          setExtractedData(data);
          toast.success(`Loaded historical report for ${comparisonDate}`);
        } else {
          setComparisonData(data);
          toast.success(`Loaded comparison data for ${comparisonDate}`);
        }
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
      let standardDate = extractedData.date_sold || "";
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

      {errorMsg && (
          <div className="mb-6 w-full max-w-2xl mx-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-xl shadow-sm">
            <h4 className="font-bold flex items-center gap-2 mb-1">
              <AlertCircle className="w-5 h-5" /> Extraction Error
            </h4>
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
        )}

      {!extractedData ? (
        <div className="flex flex-col gap-8">
          {/* Upload Area */}
          <div className={`glass-panel p-10 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            isProcessing ? "border-blue-500/50 bg-blue-500/5" : "border-border/50 hover:border-blue-500/50 hover:bg-blue-500/5"
          }`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files[0]) processImage(e.dataTransfer.files[0]); }}
          >
            <input 
              type="file" 
              accept="image/*" 
              className="hidden"
              id="report-upload-input"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            <label htmlFor="report-upload-input" className="absolute inset-0 w-full h-full cursor-pointer z-10"></label>

            {isProcessing ? (
              <div className="flex flex-col items-center z-20">
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
                <h3 className="text-lg font-bold">Analyzing Report...</h3>
                <p className="text-sm text-muted-foreground mt-2">Extracting sales data and categories using AI.</p>
              </div>
            ) : (
              <div className="z-20 flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold">Upload POS Report</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-4">
                  Drag & drop, click to upload, or simply <strong>Paste (Ctrl+V)</strong> your screenshot here.
                </p>
                <button
                  onClick={handlePasteButtonClick}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-foreground font-semibold rounded-lg transition-colors border border-border"
                >
                  <Clipboard className="h-4 w-4 text-blue-500" />
                  Paste from Clipboard
                </button>
              </div>
            )}
          </div>

          {/* Historical Reports List */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Historical Reports</h3>
                  <p className="text-xs text-muted-foreground">View and search past detailed sales for {currentBranch}</p>
                </div>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search by date (YYYY-MM-DD)..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:border-indigo-500 w-full sm:w-64"
                />
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No historical reports found for this branch.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date Sold</th>
                      {currentBranch === "all" && <th className="px-4 py-3 font-semibold">Branch</th>}
                      <th className="px-4 py-3 font-semibold">Total Revenue</th>
                      <th className="px-4 py-3 font-semibold text-center">Total Qty</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredHistory.map((report) => (
                      <tr key={report.id || report.date_sold} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {report.date_sold}
                        </td>
                        {currentBranch === "all" && (
                          <td className="px-4 py-3 text-xs font-medium text-muted-foreground">
                            {report.store_name || report.branchId}
                          </td>
                        )}
                        <td className="px-4 py-3 font-medium text-emerald-600 dark:text-emerald-400">
                          LE {(report.overall_total_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-bold">
                            {report.overall_qty_sold}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setExtractedData(report)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-md transition-colors shadow-sm"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                  onClick={() => fetchComparisonData(false)}
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

          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              {/* Coffee Alone */}
              <div className="glass-panel p-6 rounded-2xl border border-border shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                    <Coffee className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-muted-foreground">Coffee</div>
                    <div className="text-2xl font-black text-amber-600">{analytics.coffeePct}%</div>
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black">LE {analytics.coffee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="text-sm text-muted-foreground mt-1">Total revenue from Coffee</div>
                </div>
              </div>

              {/* Cigarettes Alone */}
              <div className="glass-panel p-6 rounded-2xl border border-border shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 bg-slate-500/10 rounded-xl flex items-center justify-center">
                    <Banknote className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-muted-foreground">Cigarettes</div>
                    <div className="text-2xl font-black text-slate-600">{analytics.cigPct}%</div>
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black">LE {analytics.cig.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="text-sm text-muted-foreground mt-1">Total revenue from Cigarettes</div>
                </div>
              </div>

              {/* Food Category */}
              <div className="glass-panel p-6 rounded-2xl border border-border shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <Pizza className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-muted-foreground">Food Category</div>
                    <div className="text-2xl font-black text-emerald-600">{analytics.foodPct}%</div>
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black">LE {analytics.food.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="text-sm text-muted-foreground mt-1">Bakery, Cold Cuts, Pizza, Burgers, etc.</div>
                </div>
              </div>

              {/* Actual Total Day */}
              <div className="glass-panel p-6 rounded-2xl border border-border shadow-sm flex flex-col justify-between bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-muted-foreground">Actual Shift Totals</div>
                    {isLoadingShiftTotals ? (
                      <Loader2 className="h-5 w-5 animate-spin ml-auto text-indigo-500" />
                    ) : (
                      <div className="text-2xl font-black text-indigo-600">
                        {shiftTotals ? `LE ${shiftTotals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "N/A"}
                      </div>
                    )}
                  </div>
                </div>
                
                {shiftTotals ? (
                  <div>
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span className="flex items-center gap-1 text-muted-foreground"><Banknote className="h-3.5 w-3.5" /> Cash</span>
                      <span>LE {shiftTotals.cash.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium mb-3">
                      <span className="flex items-center gap-1 text-muted-foreground"><CreditCard className="h-3.5 w-3.5" /> Visa</span>
                      <span>LE {shiftTotals.visa.toLocaleString()}</span>
                    </div>
                    
                    {/* Variance Calculation */}
                    {(() => {
                      const variance = shiftTotals.total - analytics.totalSales;
                      const isOver = variance > 0;
                      const isShort = variance < 0;
                      const isExact = variance === 0;
                      return (
                        <div className={`mt-3 pt-3 border-t border-border flex items-center justify-between font-bold ${isOver ? 'text-emerald-500' : isShort ? 'text-rose-500' : 'text-slate-500'}`}>
                          <span className="flex items-center gap-1 text-sm">
                            {isShort ? <AlertTriangle className="h-4 w-4" /> : null}
                            {isOver ? 'Over' : isShort ? 'Short' : 'Exact Match'}
                          </span>
                          <span>{variance > 0 ? '+' : ''}{variance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mt-1">No shift reports found for this date.</div>
                )}
              </div>
            </div>
          )}

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
                        {extractedData.overall_qty_sold || 0}
                        {comparisonData && renderComparisonDiff(extractedData.overall_qty_sold || 0, comparisonData.overall_qty_sold)}
                      </td>
                      <td className="px-4 py-4 font-semibold border-b border-border">
                        LE {Number(extractedData.overall_total_sales || 0).toFixed(2)}
                        {comparisonData && renderComparisonDiff(extractedData.overall_total_sales || 0, comparisonData.overall_total_sales, true)}
                      </td>
                      <td className="px-4 py-4 font-semibold border-b border-border">LE {Number(extractedData.overall_total_tax_ex || 0).toFixed(2)}</td>
                      <td className="px-4 py-4 font-semibold border-b border-border text-rose-500">LE {Number(extractedData.overall_sales_tax || 0).toFixed(2)}</td>
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
                    {(extractedData.departments || []).map((dept, idx) => {
                      const compDept = comparisonData?.departments?.find(d => d.name === dept.name);
                      
                      return (
                        <tr key={idx} className="hover:bg-muted/50 transition-colors border-b border-border last:border-0">
                          <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                            {dept.name || 'Unknown'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            {dept.qty_sold || 0}
                            {compDept && renderComparisonDiff(dept.qty_sold || 0, compDept.qty_sold)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            LE {Number(dept.total_sales || 0).toFixed(2)}
                            {compDept && renderComparisonDiff(dept.total_sales || 0, compDept.total_sales, true)}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{Number(dept.total_tax_ex || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{Number(dept.sales_tax || 0).toFixed(2)}</td>
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
