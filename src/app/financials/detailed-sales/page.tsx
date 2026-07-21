"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Upload, FileText, CheckCircle, Loader2, Save, Calendar, GitCompare, RefreshCcw, TrendingUp, TrendingDown, Minus, Search, Clipboard, AlertCircle, Coffee, Pizza, Banknote, CreditCard, Wallet, AlertTriangle, Eye, Download, Printer, Sparkles, Target, BarChart2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useBranch } from "@/context/BranchContext";
import { productsDb, db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where, limit } from "firebase/firestore";
import toast from "react-hot-toast";
import Papa from "papaparse";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];

export default function DetailedSalesPage() {
  const { currentBranch } = useBranch();
  const { language } = useLanguage();
  
  const [extractedData, setExtractedData] = useState<DetailedSalesData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [comparisonData, setComparisonData] = useState<DetailedSalesData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // View Mode State
  const [viewMode, setViewMode] = useState<"daily" | "monthly" | "range">("daily");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [isAggregating, setIsAggregating] = useState(false);

  // Comparison State
  const [comparisonDate, setComparisonDate] = useState("");
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  // Historical List State
  const [historicalReports, setHistoricalReports] = useState<DetailedSalesData[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Target State
  const [dailyTarget, setDailyTarget] = useState<number>(10000);

  // AI State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

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

      const q = query(collection(productsDb, "detailed_sales_daily"), limit(300));
      const snapshot = await getDocs(q);
      const reports: DetailedSalesData[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (currentBranch === "all" || data.branchId === currentBranch || data.branchId === altBranch || data.storeId === currentBranch || data.storeId === altBranch) {
          reports.push({ id: doc.id, ...data } as unknown as DetailedSalesData);
        }
      });
      
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

  // Monthly/Range Aggregation Engine
  const aggregateData = useCallback(async (start: string, end: string, label: string): Promise<DetailedSalesData | null> => {
    if (!start || !end || !currentBranch) return null;
    
    const storeIdMap: Record<string, string> = {
      "alamein4": "eL-alamein-4",
      "ola": "ola-el-koronfol",
      "eL-alamein-4": "alamein4",
      "ola-el-koronfol": "ola"
    };
    const altBranch = storeIdMap[currentBranch] || currentBranch;
    
    const q = query(collection(productsDb, "detailed_sales_daily"), limit(2000));
    const snapshot = await getDocs(q);
    
    let overall_qty = 0;
    let overall_sales = 0;
    let overall_tax_ex = 0;
    let overall_tax = 0;
    
    const deptMap: Record<string, DepartmentData> = {};
    
    snapshot.forEach(doc => {
      const data = doc.data() as DetailedSalesData;
      if (data.date_sold >= start && data.date_sold <= end) {
        if (currentBranch === "all" || data.branchId === currentBranch || data.branchId === altBranch || data.storeId === currentBranch || data.storeId === altBranch) {
           overall_qty += data.overall_qty_sold || 0;
           overall_sales += data.overall_total_sales || 0;
           overall_tax_ex += data.overall_total_tax_ex || 0;
           overall_tax += data.overall_sales_tax || 0;
           
           (data.departments || []).forEach(d => {
             const lowerName = d.name.toLowerCase();
             if (!deptMap[lowerName]) {
               deptMap[lowerName] = { ...d, name: d.name };
             } else {
               deptMap[lowerName].qty_sold += (d.qty_sold || 0);
               deptMap[lowerName].total_sales += (d.total_sales || 0);
               deptMap[lowerName].total_tax_ex += (d.total_tax_ex || 0);
               deptMap[lowerName].sales_tax += (d.sales_tax || 0);
             }
           });
        }
      }
    });
    
    if (overall_sales === 0) return null;

    const aggregatedDeps = Object.values(deptMap).sort((a, b) => b.total_sales - a.total_sales);
    
    return {
      store_name: currentBranch === "all" ? "All Branches" : currentBranch,
      branchId: currentBranch,
      storeId: altBranch,
      generated_on: new Date().toLocaleDateString('en-GB'),
      date_sold: label,
      overall_qty_sold: overall_qty,
      overall_total_sales: overall_sales,
      overall_total_tax_ex: overall_tax_ex,
      overall_sales_tax: overall_tax,
      departments: aggregatedDeps
    };
  }, [currentBranch]);

  const handleGenerateMonthly = async () => {
    if (!selectedMonth) { toast.error("Please select a month."); return; }
    setIsAggregating(true);
    try {
      const start = `${selectedMonth}-01`;
      const end = `${selectedMonth}-31`;
      const report = await aggregateData(start, end, selectedMonth);
      if (report) { setExtractedData(report); setAiAnalysis(null); } 
      else { toast.error("No reports found for this month."); }
    } catch (err) {
      console.error(err); toast.error("Failed to aggregate data.");
    } finally { setIsAggregating(false); }
  };

  const handleGenerateRange = async () => {
    if (!dateRange.start || !dateRange.end) { toast.error("Please select a date range."); return; }
    setIsAggregating(true);
    try {
      const report = await aggregateData(dateRange.start, dateRange.end, `${dateRange.start} to ${dateRange.end}`);
      if (report) { setExtractedData(report); setAiAnalysis(null); } 
      else { toast.error("No reports found for this range."); }
    } catch (err) {
      console.error(err); toast.error("Failed to aggregate data.");
    } finally { setIsAggregating(false); }
  };

  // Shift Totals State
  interface ShiftTotals { cash: number; visa: number; total: number; }
  const [shiftTotals, setShiftTotals] = useState<ShiftTotals | null>(null);
  const [isLoadingShiftTotals, setIsLoadingShiftTotals] = useState(false);

  const fetchShiftTotals = useCallback(async (date: string, branch: string) => {
    if (!date || !branch || date.includes("to")) return; // skip for custom ranges
    setIsLoadingShiftTotals(true);
    setShiftTotals(null);
    try {
      const storeIdMap: Record<string, string> = {
        "alamein4": "eL-alamein-4", "ola": "ola-el-koronfol", "eL-alamein-4": "alamein4", "ola-el-koronfol": "ola"
      };
      const altBranch = storeIdMap[branch] || branch;

      let q;
      if (date.length === 7) {
        q = query(collection(db, "sales"), where("date", ">=", date + "-01"), where("date", "<=", date + "-31"));
      } else {
        q = query(collection(db, "sales"), where("date", "==", date));
      }
      const snapshot = await getDocs(q);
      let cash = 0; let visa = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.branchId === branch || data.branchId === altBranch || data.storeId === branch || data.storeId === altBranch) {
          cash += (Number(data.cash) || 0); visa += (Number(data.visa) || 0);
        }
      });
      setShiftTotals({ cash, visa, total: cash + visa });
    } catch (error) { console.error("Failed to fetch shift totals:", error); } 
    finally { setIsLoadingShiftTotals(false); }
  }, []);

  useEffect(() => {
    if (extractedData?.date_sold && currentBranch) {
      let standardDate = extractedData.date_sold || "";
      if (standardDate.includes("/") && !standardDate.includes("to")) {
        const parts = standardDate.split("/");
        if (parts.length === 3) standardDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      let targetBranchForTotals = currentBranch === "all" ? (extractedData.branchId || extractedData.storeId || "all") as any : currentBranch;
      fetchShiftTotals(standardDate, targetBranchForTotals);
    }
  }, [extractedData, currentBranch, fetchShiftTotals]);

  // Analytics Helper
  const calcAnalytics = () => {
    if (!extractedData) return null;
    const totalSales = extractedData.overall_total_sales || 1; 
    const deps = extractedData.departments || [];

    const coffee = deps.filter(d => d.name?.toLowerCase().includes("coffee")).reduce((sum, d) => sum + (d.total_sales || 0), 0);
    const coffeePct = ((coffee / totalSales) * 100).toFixed(1);

    const cig = deps.filter(d => d.name?.toLowerCase().includes("cig") || d.name?.toLowerCase().includes("tobacco")).reduce((sum, d) => sum + (d.total_sales || 0), 0);
    const cigPct = ((cig / totalSales) * 100).toFixed(1);

    const foodKeywords = ["cold cut", "bakery", "rich cut", "burger", "pizza", "donut", "cookie"];
    const food = deps.filter(d => foodKeywords.some(kw => d.name?.toLowerCase().includes(kw))).reduce((sum, d) => sum + (d.total_sales || 0), 0);
    const foodPct = ((food / totalSales) * 100).toFixed(1);

    return { coffee, coffeePct, cig, cigPct, food, foodPct, totalSales };
  };

  const analytics = calcAnalytics();

  // Predictive & Insights
  const getTypicalDayAverage = useMemo(() => {
    if (!extractedData || extractedData.date_sold.length !== 10) return null; // Only for daily
    const d = new Date(extractedData.date_sold);
    if (isNaN(d.getTime())) return null;
    const dayOfWeek = d.getDay();
    
    const sameDays = historicalReports.filter(r => {
      const rd = new Date(r.date_sold);
      return !isNaN(rd.getTime()) && rd.getDay() === dayOfWeek && r.date_sold !== extractedData.date_sold;
    });

    if (sameDays.length === 0) return null;
    const avg = sameDays.reduce((sum, r) => sum + r.overall_total_sales, 0) / sameDays.length;
    const diff = extractedData.overall_total_sales - avg;
    const pct = (diff / avg) * 100;
    
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return { name: dayNames[dayOfWeek], avg, diff, pct };
  }, [extractedData, historicalReports]);

  const getSevenDayAverages = useMemo(() => {
    if (!extractedData || extractedData.date_sold.length !== 10) return {};
    const d = new Date(extractedData.date_sold);
    if (isNaN(d.getTime())) return {};
    
    const past7Days = historicalReports.filter(r => {
      const rd = new Date(r.date_sold);
      const diffTime = Math.abs(d.getTime() - rd.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return diffDays > 0 && diffDays <= 7;
    });

    if (past7Days.length === 0) return {};

    const deptAverages: Record<string, number> = {};
    const deptCounts: Record<string, number> = {};

    past7Days.forEach(r => {
      (r.departments || []).forEach(dept => {
        deptAverages[dept.name] = (deptAverages[dept.name] || 0) + dept.total_sales;
        deptCounts[dept.name] = (deptCounts[dept.name] || 0) + 1;
      });
    });

    Object.keys(deptAverages).forEach(k => {
      deptAverages[k] = deptAverages[k] / past7Days.length; // Average over 7 days
    });

    return deptAverages;
  }, [extractedData, historicalReports]);

  const topBottomPerformers = useMemo(() => {
    if (!extractedData || !extractedData.departments) return null;
    const sorted = [...extractedData.departments].sort((a, b) => b.total_sales - a.total_sales);
    return { top: sorted.slice(0, 3), bottom: sorted.slice(-3).reverse() };
  }, [extractedData]);

  // Handle image upload or paste
  const processImage = async (file: File) => {
    setErrorMsg(null);
    if (!file.type.startsWith("image/")) {
      const msg = "Please provide a valid image file."; toast.error(msg); setErrorMsg(msg); return;
    }

    setIsProcessing(true); setPreviewUrl(URL.createObjectURL(file));

    try {
      const getBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.readAsDataURL(file);
          reader.onload = (event) => {
            const img = new Image(); img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 1800; const MAX_HEIGHT = 2800;
              let width = img.width; let height = img.height;
              if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
              else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
              canvas.width = width; canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) { ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', 0.75)); } 
              else { resolve(event.target?.result as string); }
            };
            img.onerror = () => reject(new Error("Could not decode image."));
          };
          reader.onerror = () => reject(new Error("Failed to read the file."));
        });
      };

      const base64 = await getBase64(file);
      const res = await fetch("/api/extract-detailed-sales", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: base64 }),
      });

      if (!res.ok) {
        let errorMessage = "Failed to extract data from image";
        try { const errJson = await res.json(); errorMessage = errJson.error || errorMessage; } catch(e) {}
        throw new Error(errorMessage);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setExtractedData(json.data); setAiAnalysis(null); toast.success("Report data extracted successfully!");
      } else { throw new Error(json.error || "Invalid response format"); }
    } catch (error: any) {
      console.error(error); const msg = error.message || "Something went wrong."; toast.error(msg); setErrorMsg(msg);
    } finally { setIsProcessing(false); }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items; if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) { const file = items[i].getAsFile(); if (file) processImage(file); break; }
    }
  }, []);

  const handlePasteButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith("image/")) {
            const blob = await clipboardItem.getType(type);
            const file = new File([blob], "pasted-image.png", { type }); processImage(file); return;
          }
        }
      }
      toast.error("No image found in clipboard.");
    } catch (err) { console.error(err); toast.error("Could not read clipboard. Try pressing Ctrl+V / Cmd+V instead."); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) processImage(file); e.target.value = '';
  };

  const fetchComparisonData = async (isPrimaryLookup = false) => {
    if (!comparisonDate || !currentBranch) return;
    setIsLoadingComparison(true);
    if (!isPrimaryLookup) setComparisonData(null);
    
    try {
      if (comparisonDate.length === 7) {
        const aggregated = await aggregateData(`${comparisonDate}-01`, `${comparisonDate}-31`, comparisonDate);
        if (aggregated) {
          if (isPrimaryLookup) { setExtractedData(aggregated); setAiAnalysis(null); toast.success(`Loaded historical report`); } 
          else { setComparisonData(aggregated); toast.success(`Loaded comparison data`); }
        } else { toast.error(`No data found for ${comparisonDate}`); }
      } else {
        const q = query(collection(productsDb, "detailed_sales_daily"), where("branchId", "==", currentBranch), where("date_sold", "==", comparisonDate), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data() as DetailedSalesData;
          if (isPrimaryLookup) { setExtractedData(data); setAiAnalysis(null); toast.success(`Loaded historical report`); } 
          else { setComparisonData(data); toast.success(`Loaded comparison data`); }
        } else { toast.error(`No data found for ${comparisonDate}`); }
      }
    } catch (error) { console.error("Error fetching comparison data:", error); toast.error("Failed to load comparison data."); } 
    finally { setIsLoadingComparison(false); }
  };

  const handleSave = async () => {
    if (!extractedData || !currentBranch) return;
    setIsSaving(true);
    try {
      const savedUserStr = localStorage.getItem("active_cashier_session");
      let uploaderEmail = savedUserStr ? (JSON.parse(savedUserStr).email || "Unknown") : (localStorage.getItem("circlek_role") || "manager");
      let standardDate = extractedData.date_sold || "";
      if (standardDate.includes("/") && !standardDate.includes("to")) {
        const [day, month, year] = standardDate.split("/"); standardDate = `${year}-${month}-${day}`;
      }

      await addDoc(collection(productsDb, "detailed_sales_daily"), {
        ...extractedData, date_sold: standardDate, original_date_string: extractedData.date_sold, branchId: currentBranch, uploadedBy: uploaderEmail, createdAt: new Date().toISOString()
      });
      toast.success("Daily Sales Report saved successfully!");
      setComparisonDate(standardDate); setExtractedData(null); setPreviewUrl(null); setAiAnalysis(null);
    } catch (error) { console.error("Error saving detailed sales:", error); toast.error("Failed to save report."); } 
    finally { setIsSaving(false); }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!extractedData) return;
    const csvData = extractedData.departments.map(d => ({
      Department: d.name, "Qty Sold": d.qty_sold, "Total Sales": d.total_sales, "Total Tax Ex": d.total_tax_ex, "Sales Tax": d.sales_tax
    }));
    csvData.push({ Department: "OVERALL TOTAL", "Qty Sold": extractedData.overall_qty_sold, "Total Sales": extractedData.overall_total_sales, "Total Tax Ex": extractedData.overall_total_tax_ex, "Sales Tax": extractedData.overall_sales_tax });
    
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.setAttribute("download", `detailed_sales_${extractedData.date_sold}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // Print
  const handlePrint = () => { window.print(); };

  // AI Analysis
  const generateAiAnalysis = async () => {
    if (!extractedData) return;
    setIsGeneratingAi(true);
    try {
      const res = await fetch("/api/analyze-sales", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportData: extractedData, historicalContext: getTypicalDayAverage, comparisonData, type: viewMode })
      });
      const data = await res.json();
      if (data.success) { setAiAnalysis(data.analysis); toast.success("AI Analysis generated!"); } 
      else throw new Error(data.error);
    } catch (err: any) { toast.error("AI Analysis failed: " + err.message); } 
    finally { setIsGeneratingAi(false); }
  };

  const renderComparisonDiff = (currentValue: number, previousValue: number | undefined, isCurrency: boolean = false) => {
    if (previousValue === undefined) return null;
    const diff = currentValue - previousValue;
    if (diff === 0) return (<div className="flex items-center gap-1 text-xs text-slate-400 mt-1"><Minus className="h-3 w-3" /> Same</div>);
    const isPositive = diff > 0;
    return (
      <div className={`flex items-center gap-1 text-xs font-semibold mt-1 ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isPositive ? '+' : ''}{isCurrency ? diff.toFixed(2) : diff}
      </div>
    );
  };

  // Prepare chart data
  const pieData = extractedData?.departments.filter(d => d.total_sales > 0).map(d => ({ name: d.name, value: d.total_sales })).slice(0, 10);
  const comparisonBarData = comparisonData ? extractedData?.departments.map(d => {
    const comp = comparisonData.departments.find(x => x.name === d.name);
    return { name: d.name, Current: d.total_sales, Previous: comp ? comp.total_sales : 0 };
  }).filter(d => d.Current > 0 || d.Previous > 0).slice(0, 8) : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8" onPaste={handlePaste}>
      
      {/* Header - Hidden on Print */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-500" /> Detailed Sales Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Extract, analyze, and gain predictive insights from your POS reports.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 w-full max-w-2xl mx-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-xl shadow-sm print:hidden">
          <h4 className="font-bold flex items-center gap-2 mb-1"><AlertCircle className="w-5 h-5" /> Extraction Error</h4>
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      {!extractedData ? (
        <div className="flex flex-col gap-8 print:hidden">
          {/* Upload Area - Added relative to fix overlay bug */}
          <div className={`relative glass-panel p-10 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isProcessing ? "border-blue-500/50 bg-blue-500/5" : "border-border/50 hover:border-blue-500/50 hover:bg-blue-500/5"}`} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files[0]) processImage(e.dataTransfer.files[0]); }}>
            <input type="file" accept="image/*" className="hidden" id="report-upload-input" onChange={handleFileChange} disabled={isProcessing} />
            <label htmlFor="report-upload-input" className="absolute inset-0 w-full h-full cursor-pointer z-10"></label>
            {isProcessing ? (
              <div className="flex flex-col items-center z-20"><Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" /><h3 className="text-lg font-bold">Analyzing Report...</h3></div>
            ) : (
              <div className="z-20 flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Upload className="h-8 w-8" /></div>
                <h3 className="text-lg font-bold">Upload POS Report</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-4">Drag & drop, click to upload, or simply <strong>Paste (Ctrl+V)</strong> your screenshot here.</p>
                <button onClick={handlePasteButtonClick} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-foreground font-semibold rounded-lg transition-colors border border-border relative z-20">
                  <Clipboard className="h-4 w-4 text-blue-500" /> Paste from Clipboard
                </button>
              </div>
            )}
          </div>

          {/* Historical & Aggregation Area */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col mb-6">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center"><Calendar className="h-5 w-5 text-indigo-500" /></div>
                <div><h3 className="font-bold text-foreground">Historical & Insights</h3><p className="text-xs text-muted-foreground">View past reports and aggregated metrics</p></div>
              </div>
              <div className="flex bg-muted p-1 rounded-lg overflow-x-auto">
                {["daily", "monthly", "range"].map(mode => (
                  <button key={mode} onClick={() => setViewMode(mode as any)} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${viewMode === mode ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)} View
                  </button>
                ))}
              </div>
            </div>

            {viewMode === "monthly" && (
              <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl bg-muted/20">
                <Calendar className="h-12 w-12 text-indigo-500/50 mb-4" />
                <h3 className="text-xl font-bold mb-2">Monthly Aggregator</h3>
                <div className="flex items-center gap-3 mt-4">
                  <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-muted border border-border rounded-lg px-4 py-2 outline-none focus:border-indigo-500 transition-colors" />
                  <button onClick={handleGenerateMonthly} disabled={isAggregating || !selectedMonth} className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                    {isAggregating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Generate
                  </button>
                </div>
              </div>
            )}

            {viewMode === "range" && (
              <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl bg-muted/20">
                <Calendar className="h-12 w-12 text-indigo-500/50 mb-4" />
                <h3 className="text-xl font-bold mb-2">Custom Date Range</h3>
                <div className="flex items-center gap-3 mt-4 flex-wrap justify-center">
                  <input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="bg-muted border border-border rounded-lg px-4 py-2" />
                  <span className="text-muted-foreground font-semibold">to</span>
                  <input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="bg-muted border border-border rounded-lg px-4 py-2" />
                  <button onClick={handleGenerateRange} disabled={isAggregating || !dateRange.start || !dateRange.end} className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                    {isAggregating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Aggregate
                  </button>
                </div>
              </div>
            )}

            {viewMode === "daily" && (
              <>
                <div className="flex justify-end mb-6">
                  <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input type="text" placeholder="Search by date..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:border-indigo-500 w-full" /></div>
                </div>
                {isLoadingHistory ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border"><p>No historical reports found.</p></div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border"><tr><th className="px-4 py-3 font-semibold">Date Sold</th>{currentBranch === "all" && <th className="px-4 py-3 font-semibold">Branch</th>}<th className="px-4 py-3 font-semibold">Total Revenue</th><th className="px-4 py-3 font-semibold text-center">Total Qty</th><th className="px-4 py-3 font-semibold text-right">Action</th></tr></thead>
                      <tbody className="divide-y divide-border">
                        {filteredHistory.map((report) => (
                          <tr key={report.id || report.date_sold} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-semibold text-foreground">{report.date_sold}</td>
                            {currentBranch === "all" && <td className="px-4 py-3 text-xs font-medium text-muted-foreground">{report.store_name || report.branchId}</td>}
                            <td className="px-4 py-3 font-medium text-emerald-600 dark:text-emerald-400">LE {(report.overall_total_sales || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-center"><span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-xs font-bold">{report.overall_qty_sold}</span></td>
                            <td className="px-4 py-3 text-right"><button onClick={() => { setExtractedData(report); setAiAnalysis(null); }} className="relative z-20 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-md transition-colors shadow-sm"><Eye className="h-3.5 w-3.5" /> View</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Action Bar - Hidden on Print */}
          <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <button onClick={() => { setExtractedData(null); setPreviewUrl(null); setComparisonData(null); setAiAnalysis(null); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-semibold">
                <RefreshCcw className="h-4 w-4" /> Cancel
              </button>
              <div className="h-8 w-px bg-border hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <input type={viewMode === "monthly" ? "month" : "date"} value={comparisonDate} onChange={(e) => setComparisonDate(e.target.value)} className="bg-muted border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500 transition-colors" />
                <button onClick={() => fetchComparisonData(false)} disabled={!comparisonDate || isLoadingComparison} className="bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
                  {isLoadingComparison ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />} Compare
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-sm font-semibold"><Printer className="h-4 w-4" /> Print</button>
              <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-sm font-semibold"><Download className="h-4 w-4" /> CSV</button>
              <button onClick={handleSave} disabled={isSaving || extractedData.id !== undefined} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {extractedData.id !== undefined ? "Saved" : "Save Report"}
              </button>
            </div>
          </div>

          {/* Target Tracking & AI */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
            {/* AI Analysis */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-center bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20 shadow-inner">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-500" /><h3 className="font-bold text-indigo-600 dark:text-indigo-400">AI Manager Briefing</h3></div>
                {!aiAnalysis && <button onClick={generateAiAnalysis} disabled={isGeneratingAi} className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md text-xs font-bold flex items-center gap-2 print:hidden">{isGeneratingAi ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate Insights"}</button>}
              </div>
              {aiAnalysis ? (
                <p className="text-sm text-foreground/90 leading-relaxed font-medium">{aiAnalysis}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Click &quot;Generate Insights&quot; to receive an automated operational summary analyzing performance, anomalies, and driving departments.</p>
              )}
            </div>

            {/* Target & Benchmarking */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-center">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2"><Target className="h-5 w-5 text-emerald-500" /><h3 className="font-bold text-foreground">Revenue Target</h3></div>
                <div className="flex items-center gap-2 text-xs font-semibold print:hidden"><span className="text-muted-foreground">Goal:</span> <input type="number" value={dailyTarget} onChange={e=>setDailyTarget(Number(e.target.value))} className="w-24 bg-muted border border-border rounded px-2 py-1 outline-none text-right" /></div>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 mb-2">
                <div className="bg-emerald-500 h-3 rounded-full" style={{ width: `${Math.min((extractedData.overall_total_sales / dailyTarget) * 100, 100)}%` }}></div>
              </div>
              <div className="flex justify-between text-sm font-bold text-muted-foreground"><span>LE 0</span><span>{((extractedData.overall_total_sales / dailyTarget) * 100).toFixed(1)}% Achieved</span><span>LE {dailyTarget.toLocaleString()}</span></div>
            </div>
          </div>

          {/* Quick Analytics */}
          {analytics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
              <div className="glass-panel p-4 rounded-xl border border-border shadow-sm"><div className="text-sm font-semibold text-muted-foreground flex justify-between"><Coffee className="h-4 w-4 text-amber-600"/>{analytics.coffeePct}%</div><div className="text-xl font-black mt-2">LE {analytics.coffee.toLocaleString()}</div></div>
              <div className="glass-panel p-4 rounded-xl border border-border shadow-sm"><div className="text-sm font-semibold text-muted-foreground flex justify-between"><Banknote className="h-4 w-4 text-slate-600"/>{analytics.cigPct}%</div><div className="text-xl font-black mt-2">LE {analytics.cig.toLocaleString()}</div></div>
              <div className="glass-panel p-4 rounded-xl border border-border shadow-sm"><div className="text-sm font-semibold text-muted-foreground flex justify-between"><Pizza className="h-4 w-4 text-emerald-600"/>{analytics.foodPct}%</div><div className="text-xl font-black mt-2">LE {analytics.food.toLocaleString()}</div></div>
              <div className="glass-panel p-4 rounded-xl border border-border shadow-sm bg-indigo-500/5"><div className="text-sm font-semibold text-muted-foreground flex justify-between"><Wallet className="h-4 w-4 text-indigo-600"/>Shift Total</div><div className="text-xl font-black mt-2 text-indigo-600">{shiftTotals ? `LE ${shiftTotals.total.toLocaleString()}` : "N/A"}</div>
                {shiftTotals && (
                  <div className="text-xs font-bold mt-1">Var: {shiftTotals.total - analytics.totalSales > 0 ? <span className="text-emerald-500">+{shiftTotals.total - analytics.totalSales}</span> : shiftTotals.total - analytics.totalSales < 0 ? <span className="text-rose-500">{shiftTotals.total - analytics.totalSales}</span> : <span className="text-slate-500">Exact</span>}</div>
                )}
              </div>
            </div>
          )}

          {/* Charts & Advanced Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Visualizations */}
            <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-6 border-b border-border pb-2"><h3 className="font-bold flex items-center gap-2"><BarChart2 className="h-5 w-5 text-blue-500" /> Department Breakdown</h3></div>
              
              {comparisonData ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonBarData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" tick={{fontSize: 10}} />
                      <YAxis tick={{fontSize: 10}} />
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', backgroundColor: '#1e293b', border: 'none', color: '#f8fafc' }} />
                      <Legend />
                      <Bar dataKey="Current" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Previous" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                        {pieData?.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value: any) => `LE ${Number(value || 0).toLocaleString()}`} contentStyle={{ borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Smart Insights Sidebar */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col gap-6">
              <div>
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">Top Performers</h3>
                {topBottomPerformers?.top.map((d, i) => (
                  <div key={i} className="flex justify-between items-center mb-2 text-sm"><span className="font-medium text-emerald-600 dark:text-emerald-400">{d.name}</span><span className="font-bold">LE {d.total_sales.toLocaleString()}</span></div>
                ))}
              </div>
              <div className="h-px w-full bg-border"></div>
              <div>
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">Needs Attention</h3>
                {topBottomPerformers?.bottom.map((d, i) => (
                  <div key={i} className="flex justify-between items-center mb-2 text-sm"><span className="font-medium text-rose-500">{d.name}</span><span className="font-bold">LE {d.total_sales.toLocaleString()}</span></div>
                ))}
              </div>
              
              {getTypicalDayAverage && (
                <>
                  <div className="h-px w-full bg-border"></div>
                  <div>
                    <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">Typical {getTypicalDayAverage.name}</h3>
                    <div className="text-xs text-muted-foreground mb-2">Vs historical {getTypicalDayAverage.name}s</div>
                    <div className={`text-lg font-black ${getTypicalDayAverage.diff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {getTypicalDayAverage.diff > 0 ? '+' : ''}{getTypicalDayAverage.pct.toFixed(1)}% 
                      <span className="text-sm font-medium text-muted-foreground ml-2">({getTypicalDayAverage.diff > 0 ? 'above' : 'below'} avg LE {getTypicalDayAverage.avg.toFixed(0)})</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 7-Day Anomaly Warnings */}
          {Object.keys(getSevenDayAverages).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {extractedData.departments.map(d => {
                const avg7 = getSevenDayAverages[d.name];
                if (!avg7) return null;
                const diff = ((d.total_sales - avg7) / avg7) * 100;
                if (diff < -30) {
                  return (
                    <div key={d.name} className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 p-3 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
                      <div><h4 className="text-sm font-bold text-rose-700 dark:text-rose-400">{d.name} Drop</h4><p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">Down {Math.abs(diff).toFixed(0)}% vs 7-day avg.</p></div>
                    </div>
                  );
                } else if (diff > 40) {
                  return (
                    <div key={d.name} className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl flex items-start gap-3">
                      <TrendingUp className="h-5 w-5 text-emerald-500 shrink-0" />
                      <div><h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{d.name} Spike</h4><p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">Up {diff.toFixed(0)}% vs 7-day avg.</p></div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}

          {/* Main Data Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
            {/* Meta Info */}
            <div className="lg:col-span-1 space-y-6 print:hidden">
              {previewUrl && <div className="glass-panel p-2 rounded-2xl"><img src={previewUrl} alt="Report Preview" className="w-full rounded-xl object-contain border border-border" /></div>}
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <h3 className="font-bold text-foreground border-b border-border pb-2">Report Details</h3>
                <div><div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Store Name</div><div className="font-medium mt-1">{extractedData.store_name}</div></div>
                <div><div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Date Sold</div><div className="font-medium mt-1 text-blue-500">{extractedData.date_sold}</div></div>
                <div><div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Generated On</div><div className="font-medium mt-1">{extractedData.generated_on}</div></div>
              </div>
            </div>

            {/* Data Tables */}
            <div className="lg:col-span-3 space-y-6 print:w-full print:col-span-4">
              <div className="glass-panel p-1 rounded-2xl overflow-hidden border border-border shadow-md print:shadow-none print:border-none">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-slate-100 dark:bg-slate-900/80"><th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border rounded-tl-xl">Overall</th><th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border">Qty Sold</th><th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border">Total Sales</th><th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border">Total (Tax Ex)</th><th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border rounded-tr-xl">Sales Tax</th></tr></thead>
                  <tbody>
                    <tr className="bg-blue-500/5 hover:bg-blue-500/10 transition-colors">
                      <td className="px-4 py-4 font-black text-blue-600 dark:text-blue-400 border-b border-border">Totals</td>
                      <td className="px-4 py-4 font-semibold border-b border-border">{extractedData.overall_qty_sold || 0}{comparisonData && renderComparisonDiff(extractedData.overall_qty_sold || 0, comparisonData.overall_qty_sold)}</td>
                      <td className="px-4 py-4 font-semibold border-b border-border">LE {Number(extractedData.overall_total_sales || 0).toFixed(2)}{comparisonData && renderComparisonDiff(extractedData.overall_total_sales || 0, comparisonData.overall_total_sales, true)}</td>
                      <td className="px-4 py-4 font-semibold border-b border-border">LE {Number(extractedData.overall_total_tax_ex || 0).toFixed(2)}</td>
                      <td className="px-4 py-4 font-semibold border-b border-border text-rose-500">LE {Number(extractedData.overall_sales_tax || 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="glass-panel p-1 rounded-2xl overflow-hidden border border-border shadow-md print:shadow-none print:border-none">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-slate-100 dark:bg-slate-900/80"><th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border rounded-tl-xl">Department</th><th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border">Qty Sold</th><th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border">Total Sales</th><th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border">Total (Tax Ex)</th><th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-border rounded-tr-xl">Sales Tax</th></tr></thead>
                  <tbody>
                    {(extractedData.departments || []).map((dept, idx) => {
                      const compDept = comparisonData?.departments?.find(d => d.name === dept.name);
                      return (
                        <tr key={idx} className="hover:bg-muted/50 transition-colors border-b border-border last:border-0">
                          <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>{dept.name || 'Unknown'}</td>
                          <td className="px-4 py-3 text-sm font-medium">{dept.qty_sold || 0}{compDept && renderComparisonDiff(dept.qty_sold || 0, compDept.qty_sold)}</td>
                          <td className="px-4 py-3 text-sm font-medium">LE {Number(dept.total_sales || 0).toFixed(2)}{compDept && renderComparisonDiff(dept.total_sales || 0, compDept.total_sales, true)}</td>
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
    </div>
  );
}
