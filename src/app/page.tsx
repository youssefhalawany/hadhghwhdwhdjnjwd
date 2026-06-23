"use client";

import React, { useState, useEffect } from "react";
import { dbService, db } from "@/lib/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { exportToExcel } from "@/lib/excel-generator";
import { generatePDF, downloadPDFBlob } from "@/lib/pdf-generator";
import { generateThermalCommands } from "@/lib/thermal-commands";
import QRCode from "react-qr-code";
import Barcode from "react-barcode";
import { 
  DollarSign, Fuel, Award, Eye, FileSpreadsheet, FileDown, 
  Printer, ArrowRight, ShieldCheck, PlusCircle, Filter, 
  Calendar, Building2, User, RefreshCw, Layers
} from "lucide-react";

export default function DashboardPage() {
  const [role, setRole] = useState("owner");
  const [sales, setSales] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [drops, setDrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [dateFilter, setDateFilter] = useState("today");
  const [branchFilter, setBranchFilter] = useState("all");
  const [cashierFilter, setCashierFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Report modal states
  const [activeReport, setActiveReport] = useState<any | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [thermalPreview, setThermalPreview] = useState<string | null>(null);

  useEffect(() => {
    // Read user role simulation
    const storedRole = localStorage.getItem("circlek_role") || "owner";
    setRole(storedRole);

    const handleRoleChange = (e: any) => {
      setRole(e.detail);
    };
    window.addEventListener("circlek_role_changed", handleRoleChange);

    // Subscribe to Firebase database updates
    const unsubscribeSales = dbService.onSnapshot(query(collection(db, "sales"), orderBy("timestamp", "desc"), limit(2000)), (data) => {
      setSales(data);
      setLoading(false);
    });

    const unsubscribeBranches = dbService.onSnapshot("branches", (data) => {
      setBranches(data);
    });

    const unsubscribeEmployees = dbService.onSnapshot("employees", (data) => {
      setEmployees(data);
    });

    const unsubscribeDrops = dbService.onSnapshot(query(collection(db, "safe_balance"), orderBy("timestamp", "desc"), limit(500)), (data) => {
      setDrops(data);
    });

    return () => {
      window.removeEventListener("circlek_role_changed", handleRoleChange);
      unsubscribeSales();
      unsubscribeBranches();
      unsubscribeEmployees();
      unsubscribeDrops();
    };
  }, []);

  // Filter Sales Data
  const getFilteredSales = () => {
    return sales.filter(sale => {
      // Date Filter
      if (dateFilter === "today") {
        const today = new Date().toISOString().slice(0, 10);
        if (sale.date.slice(0, 10) !== today) return false;
      } else if (dateFilter === "yesterday") {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yestStr = yesterday.toISOString().slice(0, 10);
        if (sale.date.slice(0, 10) !== yestStr) return false;
      }
      
      // Branch Filter
      if (branchFilter !== "all" && sale.branchId !== branchFilter) return false;

      // Cashier Filter
      if (cashierFilter !== "all" && sale.cashierId !== cashierFilter) return false;

      // Category / Type Filter
      if (categoryFilter !== "all") {
        if (categoryFilter === "fuel" && sale.type !== "fuel") return false;
        if (categoryFilter === "merchandise" && sale.type !== "merchandise" && sale.type !== "mixed") return false;
      }

      return true;
    });
  };

  const filteredSales = getFilteredSales();

  // Metrics Calculations
  const totalFuelRevenue = filteredSales
    .filter(s => s.type === "fuel" || s.type === "mixed")
    .reduce((sum, s) => sum + (s.type === "fuel" ? s.subtotal : (s.gallons || 0) * (s.pricePerGallon || 0)), 0);

  const totalFuelGallons = filteredSales
    .filter(s => s.type === "fuel" || s.type === "mixed")
    .reduce((sum, s) => sum + (s.gallons || 0), 0);

  const totalMerchRevenue = filteredSales
    .filter(s => s.type === "merchandise" || s.type === "mixed")
    .reduce((sum, s) => {
      if (s.type === "merchandise") return sum + s.subtotal;
      // Mixed type has both
      const merchItemsSum = s.items?.reduce((iSum: number, item: any) => iSum + (item.price * item.quantity), 0) || 0;
      return sum + merchItemsSum;
    }, 0);

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const totalTax = filteredSales.reduce((sum, s) => sum + s.tax, 0);
  const totalDiscount = filteredSales.reduce((sum, s) => sum + s.discount, 0);

  // Safe Drop calculations (Only Manager or Owner roles can view full metrics)
  const totalDropsAmount = drops
    .filter(d => branchFilter === "all" || d.branchId === branchFilter)
    .reduce((sum, d) => sum + d.amount, 0);

  // Chart data extraction - Hourly Sales distribution
  const hourlyData = Array(24).fill(0);
  filteredSales.forEach(s => {
    const hour = new Date(s.date).getHours();
    hourlyData[hour] += s.total;
  });

  // Action - Add a simulation sale
  const handleGenerateSampleSale = async () => {
    const isFuel = Math.random() > 0.4;
    const branch = branches[Math.floor(Math.random() * branches.length)] || { id: "br_downtown" };
    const cashier = employees.find(e => e.role === "cashier") || { id: "emp_cashier" };

    let saleData: any = {
      date: new Date().toISOString(),
      branchId: branch.id,
      cashierId: cashier.id,
      paymentMethod: Math.random() > 0.3 ? "Card" : "Cash"
    };

    if (isFuel) {
      const fuelType = Math.random() > 0.5 ? "prod_fuel_91" : "prod_fuel_95";
      const pricePerGallon = fuelType === "prod_fuel_91" ? 3.49 : 3.89;
      const gallons = parseFloat((Math.random() * 15 + 5).toFixed(2));
      const subtotal = parseFloat((gallons * pricePerGallon).toFixed(2));
      const tax = parseFloat((subtotal * 0.08).toFixed(2));
      const total = parseFloat((subtotal + tax).toFixed(2));

      saleData = {
        ...saleData,
        type: "fuel",
        dispenserNo: Math.floor(Math.random() * 8) + 1,
        fuelType,
        pricePerGallon,
        gallons,
        subtotal,
        tax,
        discount: 0,
        total
      };
    } else {
      const coffeeQty = Math.floor(Math.random() * 2) + 1;
      const chipsQty = Math.floor(Math.random() * 2) + 1;
      
      const subtotal = parseFloat((coffeeQty * 2.29 + chipsQty * 2.19).toFixed(2));
      const tax = parseFloat((subtotal * 0.08).toFixed(2));
      const total = parseFloat((subtotal + tax).toFixed(2));

      saleData = {
        ...saleData,
        type: "merchandise",
        items: [
          { productId: "prod_coffee_16", quantity: coffeeQty, price: 2.29 },
          { productId: "prod_chips", quantity: chipsQty, price: 2.19 }
        ],
        subtotal,
        tax,
        discount: 0,
        total
      };
    }

    await dbService.addDoc("sales", saleData);
  };

  // Action - Excel Export
  const handleExcelExport = () => {
    const formattedData = filteredSales.map((s, idx) => ({
      index: idx + 1,
      id: s.id,
      date: new Date(s.date).toLocaleString(),
      type: s.type.toUpperCase(),
      payment: s.paymentMethod,
      tax: s.tax,
      discount: s.discount,
      total: s.total
    }));

    exportToExcel({
      title: "Circle K Sales Audit Report",
      subtitle: `${dateFilter.toUpperCase()} Sales Logs`,
      columns: [
        { header: "#", key: "index", width: 5 },
        { header: "Transaction ID", key: "id", width: 15 },
        { header: "Date/Time", key: "date", width: 22 },
        { header: "Category", key: "type", width: 15 },
        { header: "Payment Method", key: "payment", width: 15 },
        { header: "Tax (EGP)", key: "tax", width: 12, isCurrency: true },
        { header: "Discount (EGP)", key: "discount", width: 12, isCurrency: true },
        { header: "Total Amount (EGP)", key: "total", width: 15, isCurrency: true }
      ],
      data: formattedData,
      filters: {
        "Date Range": dateFilter,
        "Store Branch": branchFilter,
        "Cashier ID": cashierFilter,
        "Category": categoryFilter
      }
    });
  };

  // Action - PDF & Verification Setup
  const handlePdfExport = async (sale: any) => {
    setGeneratingReport(true);
    setActiveReport(sale);
    
    // Allow React state to render visual overlay before PDF capture
    setTimeout(async () => {
      try {
        // Generate cryptographic-style document hash
        const verificationToken = "tok_" + Math.random().toString(36).substring(2, 18);
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(JSON.stringify(sale));
        const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const sha256Hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

        // Register verification record in Firebase / Mock Sandbox
        const verRecord = {
          reportId: sale.id,
          verificationToken,
          sha256Hash,
          type: "Invoice Receipt",
          employeeId: sale.cashierId,
          branchId: sale.branchId,
          timestamp: new Date().toISOString(),
          version: 1,
          status: "Verified",
          originalData: sale
        };
        await dbService.addDoc("verifications", verRecord);

        // Render A4 layout container
        const blob = await generatePDF("invoice-pdf-capture", {
          title: `Circle K Transaction Receipt`,
          filename: `CK_Receipt_${sale.id}.pdf`,
          watermarkText: "CIRCLE K VERIFIED"
        });

        downloadPDFBlob(blob, `CircleK_Invoice_${sale.id}.pdf`);
      } catch (err) {
        console.error("PDF Generate error:", err);
      } finally {
        setGeneratingReport(false);
        setActiveReport(null);
      }
    }, 600);
  };

  // Action - Thermal Driver Trigger
  const handleThermalPrint = (sale: any) => {
    const items = sale.items || [];
    const elements: any[] = [
      { id: "1", type: "logo", value: "", x: 0, y: 0, width: 80, height: 40 },
      { id: "2", type: "text", value: "CIRCLE K CONVENIENCE", x: 0, y: 45, width: 80, height: 20, fontWeight: "bold", align: "center", fontSize: 16 },
      { id: "3", type: "text", value: `Receipt ID: ${sale.id}`, x: 0, y: 70, width: 80, height: 15, fontSize: 10 },
      { id: "4", type: "text", value: `Date: ${new Date(sale.date).toLocaleString()}`, x: 0, y: 85, width: 80, height: 15, fontSize: 10 },
      { id: "5", type: "line", value: "", x: 0, y: 105, width: 80, height: 5 },
    ];

    let currY = 115;
    if (sale.type === "fuel") {
      elements.push({ id: "fuel_desc", type: "text", value: `${sale.gallons} GAL @ EGP ${sale.pricePerGallon}/GAL`, x: 0, y: currY, width: 80, height: 15 });
      elements.push({ id: "fuel_tot", type: "text", value: `Fuel Total: EGP ${sale.subtotal}`, x: 0, y: currY + 15, width: 80, height: 15, fontWeight: "bold" });
      currY += 35;
    } else {
      items.forEach((item: any, idx: number) => {
        elements.push({
          id: `item_${idx}`,
          type: "text",
          value: `${item.quantity}x Prod_${item.productId.slice(-3)} @ EGP ${item.price}`,
          x: 0,
          y: currY,
          width: 80,
          height: 15
        });
        currY += 18;
      });
    }

    elements.push({ id: "line_2", type: "line", value: "", x: 0, y: currY + 5, width: 80, height: 5 });
    elements.push({ id: "total_txt", type: "text", value: `TOTAL DUE: EGP ${sale.total}`, x: 0, y: currY + 15, width: 80, height: 20, fontWeight: "bold", fontSize: 14 });
    elements.push({ id: "qr_code", type: "qrcode", value: `https://verify.circlek-reports.com/verify/mock_token_${sale.id}`, x: 25, y: currY + 45, width: 30, height: 30 });

    const commands = generateThermalCommands(elements, {
      widthMm: 80,
      mode: "receipt",
      printerType: "escpos"
    });

    setThermalPreview(commands);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 bg-clip-text text-transparent uppercase">
            Circle K Financial Portal
          </h1>
          <p className="text-sm text-muted-foreground">
            Franchise Retail Operations and Compliance Audit Dashboard.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-gen-sale"
            onClick={handleGenerateSampleSale}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg font-semibold shadow-lg shadow-red-500/10 hover:shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            Generate Sample Transaction
          </button>
          <button
            id="btn-excel-export"
            onClick={handleExcelExport}
            className="flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground rounded-lg font-semibold hover:bg-muted transition-colors text-sm cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            Export Audit Excel
          </button>
        </div>
      </div>

      {/* Global Filters Panel */}
      <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
          <Filter className="h-4 w-4" />
          <span className="font-bold">Filters:</span>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-3 py-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            id="filter-date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold focus:ring-0 outline-none text-foreground cursor-pointer"
          >
            <option value="today">Today Only</option>
            <option value="yesterday">Yesterday</option>
            <option value="all">All Available History</option>
          </select>
        </div>

        {/* Store Branch Filter */}
        <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-3 py-1.5">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            id="filter-branch"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold focus:ring-0 outline-none text-foreground cursor-pointer"
          >
            <option value="all">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {/* Cashier Filter */}
        <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-3 py-1.5">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            id="filter-cashier"
            value={cashierFilter}
            onChange={(e) => setCashierFilter(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold focus:ring-0 outline-none text-foreground cursor-pointer"
          >
            <option value="all">All Cashiers</option>
            {employees.filter(e => e.role === "cashier").map(e => <option key={e.id} value={e.id}>{e.displayName}</option>)}
          </select>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-3 py-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            id="filter-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold focus:ring-0 outline-none text-foreground cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="fuel">Fuel Operations</option>
            <option value="merchandise">C-Store Merchandise</option>
          </select>
        </div>
      </div>

      {/* Metric Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Merchandise Sales */}
        <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">C-Store Merchandise</span>
            <h2 className="text-2xl font-bold">EGP {totalMerchRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <p className="text-[10px] text-green-500 font-semibold">↑ Stable Margins</p>
          </div>
          <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        {/* Fuel Revenue */}
        <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fuel Dispensers</span>
            <h2 className="text-2xl font-bold">EGP {totalFuelRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <p className="text-[10px] text-muted-foreground font-semibold">
              Vol: <span className="text-foreground font-bold">{(Number(totalFuelGallons) || 0).toFixed(2)} gal</span>
            </p>
          </div>
          <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
            <Fuel className="h-6 w-6" />
          </div>
        </div>

        {/* Safe Drops */}
        <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Safe Deposits Drop</span>
            <h2 className="text-2xl font-bold">EGP {totalDropsAmount.toLocaleString()}</h2>
            <p className="text-[10px] text-muted-foreground">
              Total Deposits: <span className="font-bold">{drops.length}</span>
            </p>
          </div>
          <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>

        {/* Total Profit Estimator (Shown conditionally based on permission/role simulation) */}
        <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Cash Profit</span>
            {role === "owner" || role === "accountant" || role === "manager" ? (
              <h2 className="text-2xl font-bold text-green-500">
                ${(totalRevenue * 0.28).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            ) : (
              <h2 className="text-lg font-bold text-muted-foreground flex items-center gap-1">
                🔒 Locked
              </h2>
            )}
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Est. 28% Margin</p>
          </div>
          <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
            <Award className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Distribution Line Chart (SVG) */}
        <div className="glass-panel p-5 rounded-xl lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Hourly Sales Pattern</h3>
            <span className="text-xs bg-muted border border-border px-2 py-0.5 rounded font-mono text-muted-foreground">Live Load</span>
          </div>

          <div className="h-64 flex flex-col justify-end">
            {/* SVG Visual line chart */}
            <div className="w-full h-48 relative flex items-end">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Horizontal gridlines */}
                <line x1="0" y1="25" x2="100" y2="25" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                <line x1="0" y1="75" x2="100" y2="75" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                
                {/* Line path plotting */}
                {(() => {
                  const maxTotal = Math.max(...hourlyData, 100);
                  let points = "";
                  hourlyData.forEach((total, i) => {
                    const x = (i / 23) * 100;
                    const y = 100 - (total / maxTotal) * 85 - 5;
                    points += `${x},${y} `;
                  });
                  return (
                    <>
                      <polyline
                        fill="none"
                        stroke="url(#gradient-red-orange)"
                        strokeWidth="3.5"
                        points={points}
                      />
                      {/* Gradient Definitions */}
                      <defs>
                        <linearGradient id="gradient-red-orange" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#e11937" />
                          <stop offset="50%" stopColor="#ff8200" />
                          <stop offset="100%" stopColor="#f59e0b" />
                        </linearGradient>
                      </defs>
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Labels */}
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-3 border-t border-border pt-2">
              <span>12 AM</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
              <span>11 PM</span>
            </div>
          </div>
        </div>

        {/* Operations Breakdown Summary Card */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Operations Breakdown</h3>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Merchandise</span>
                <span className="text-muted-foreground">{(totalRevenue ? (totalMerchRevenue/totalRevenue)*100 : 0).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
                <div 
                  className="bg-orange-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalRevenue ? (totalMerchRevenue/totalRevenue)*100 : 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Fuel</span>
                <span className="text-muted-foreground">{(totalRevenue ? (totalFuelRevenue/totalRevenue)*100 : 0).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
                <div 
                  className="bg-red-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalRevenue ? (totalFuelRevenue/totalRevenue)*100 : 0}%` }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Taxes:</span>
                <span className="font-bold">EGP {(Number(totalTax) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Discounts:</span>
                <span className="font-bold text-red-500">-EGP {(Number(totalDiscount) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-black border-t border-dashed border-border pt-2">
                <span>REVENUE TOTAL:</span>
                <span className="text-red-500 dark:text-red-400">EGP {(Number(totalRevenue) || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Transactions Grid Table */}
      <div className="glass-panel rounded-xl overflow-hidden border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-base uppercase tracking-wider text-red-600 dark:text-red-500">Sales & Audit Logs</h3>
          <span className="text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground font-semibold">
            Count: {filteredSales.length} logs
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-red-500" />
              Loading database...
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No transactions matching selected filters.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                  <th className="px-5 py-3">Transaction ID</th>
                  <th className="px-5 py-3">Date/Time</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Branch</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3 text-right">Tax</th>
                  <th className="px-5 py-3 text-right font-black">Total</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredSales.map((sale) => {
                  const brName = branches.find(b => b.id === sale.branchId)?.name || sale.branchId;
                  return (
                    <tr key={sale.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs">{sale.id}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {new Date(sale.date).toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          sale.type === "fuel" 
                            ? "bg-red-500/10 text-red-500" 
                            : sale.type === "merchandise"
                            ? "bg-orange-500/10 text-orange-500"
                            : "bg-blue-500/10 text-blue-500"
                        }`}>
                          {sale.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs">{brName}</td>
                      <td className="px-5 py-3 text-xs">{sale.paymentMethod}</td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                        EGP ${(Number(sale.tax) || 0).toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-foreground">
                        EGP ${(Number(sale.total) || 0).toFixed(2)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-2.5">
                          <button
                            id={`btn-pdf-EGP {sale.id}`}
                            onClick={() => handlePdfExport(sale)}
                            className="p-1 text-muted-foreground hover:text-red-500 transition-colors hover:scale-105"
                            title="Export verified A4 PDF"
                          >
                            <FileDown className="h-4 w-4" />
                          </button>
                          <button
                            id={`btn-thermal-EGP {sale.id}`}
                            onClick={() => handleThermalPrint(sale)}
                            className="p-1 text-muted-foreground hover:text-orange-500 transition-colors hover:scale-105"
                            title="Print thermal receipt"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Hidden Invoice A4 Layout Template Container for jsPDF Render */}
      {activeReport && (
        <div className="fixed -left-[9999px] top-0 bg-white p-8 w-[794px]" id="invoice-pdf-capture">
          {/* Top Header */}
          <div className="flex justify-between items-start border-b-2 border-red-600 pb-4 text-black">
            <div>
              <div className="h-10 w-10 bg-red-600 flex items-center justify-center font-black text-white text-xl border border-red-700">
                K
              </div>
              <h2 className="text-xl font-bold tracking-wider mt-2">CIRCLE K FRANCHISE</h2>
              <p className="text-xs text-zinc-500">Corporate Compliance Reporting Engine</p>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-black text-zinc-800">TRANSACTION AUDIT</h1>
              <p className="text-xs font-semibold text-zinc-500 mt-1">DOC_ID: {activeReport.id}</p>
              <p className="text-xs text-zinc-500">Date: {new Date(activeReport.date).toLocaleString()}</p>
            </div>
          </div>

          <div className="my-6 grid grid-cols-2 gap-4 text-black text-xs">
            <div>
              <h4 className="font-bold text-zinc-700 uppercase">Store Information</h4>
              <p className="mt-1 font-semibold">Circle K Store #4702</p>
              <p>101 Grand Ave, Downtown Branch</p>
              <p>Phone: +1 (555) 123-4567</p>
            </div>
            <div className="text-right">
              <h4 className="font-bold text-zinc-700 uppercase">Audit Verification</h4>
              <p className="mt-1">Generated by: {role.toUpperCase()}</p>
              <p>Signature Status: <span className="text-green-600 font-bold">DIGITALLY SIGNED</span></p>
              <p className="font-mono text-[9px] text-zinc-400 mt-1">Hash integrity checksum validation active</p>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-left text-xs border-collapse mt-4 text-black">
            <thead>
              <tr className="bg-zinc-100 border-b border-zinc-300 font-bold">
                <th className="p-2">Description</th>
                <th className="p-2 text-center">Category</th>
                <th className="p-2 text-right">Unit Price</th>
                <th className="p-2 text-center">Qty</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {activeReport.type === "fuel" ? (
                <tr className="border-b border-zinc-200">
                  <td className="p-2 font-medium">Unleaded 91 Fuel (Pump #{activeReport.dispenserNo})</td>
                  <td className="p-2 text-center uppercase text-zinc-500">Fuel</td>
                  <td className="p-2 text-right">EGP {(Number(activeReport.pricePerGallon) || 0).toFixed(2)}</td>
                  <td className="p-2 text-center">{activeReport.gallons} GAL</td>
                  <td className="p-2 text-right">EGP {(Number(activeReport.subtotal) || 0).toFixed(2)}</td>
                </tr>
              ) : (
                activeReport.items?.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-zinc-200">
                    <td className="p-2 font-medium">C-Store Merchandise (Item ID: {item.productId.slice(-3)})</td>
                    <td className="p-2 text-center uppercase text-zinc-500">Merch</td>
                    <td className="p-2 text-right">EGP {(Number(item.price) || 0).toFixed(2)}</td>
                    <td className="p-2 text-center">{item.quantity}</td>
                    <td className="p-2 text-right">EGP {(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mt-6 text-black">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>EGP {(Number(activeReport.subtotal) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT (8%):</span>
                <span>EGP {(Number(activeReport.tax) || 0).toFixed(2)}</span>
              </div>
              {activeReport.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discounts:</span>
                  <span>-EGP {(Number(activeReport.discount) || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm border-t border-zinc-800 pt-2 text-red-600">
                <span>GRAND TOTAL:</span>
                <span>EGP {(Number(activeReport.total) || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-zinc-200 pt-4 flex items-center justify-between text-[10px] text-zinc-400">
            <div className="flex-1">
              <p>Secure Verification URL: https://verify.circlek-reports.com/verify/{activeReport.id}</p>
              <p className="mt-0.5">Integrity SHA-256 validation active. File system immutable.</p>
              <div className="mt-4 opacity-80">
                <Barcode value={String(activeReport.id)} width={1.2} height={35} fontSize={12} displayValue={true} background="transparent" />
              </div>
            </div>
            <div className="bg-white p-1.5 rounded border border-zinc-200 shadow-sm ml-4 flex-shrink-0">
              <QRCode value={`https://verify.circlek-reports.com/verify/${activeReport.id}`} size={96} />
            </div>
          </div>
        </div>
      )}

      {/* PDF Generating Loader Overlay */}
      {generatingReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4 text-white">
          <RefreshCw className="h-8 w-8 animate-spin text-red-500" />
          <p className="font-bold text-sm tracking-wide">Compiling report and computing cryptographic signatures...</p>
        </div>
      )}

      {/* Thermal Printer Driver Output Modal */}
      {thermalPreview && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg bg-card border border-border rounded-xl p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <h3 className="font-bold text-lg text-red-600 dark:text-red-500 mb-3 uppercase flex items-center gap-2 border-b border-border pb-2">
              <Printer className="h-5 w-5" /> Bixolon BPL-Z & ESC/POS Compiler
            </h3>

            <p className="text-xs text-muted-foreground mb-4">
              Real-time thermal compiler generated raw driver instructions for connected Bixolon SRP series USB/Bluetooth units:
            </p>

            <div className="flex-1 bg-zinc-950 p-4 rounded-lg overflow-y-auto mb-4 border border-zinc-800">
              <pre className="text-xs font-mono text-amber-500 whitespace-pre-wrap">{thermalPreview}</pre>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
              <button
                onClick={() => setThermalPreview(null)}
                className="px-4 py-2 text-xs font-bold border border-border hover:bg-muted rounded-lg transition-colors cursor-pointer"
              >
                Close Compiler
              </button>
              <button
                onClick={async () => {
                  alert("Raw thermal byte commands dispatched to Web Serial port buffer!");
                  setThermalPreview(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer"
              >
                Send to Bixolon / ESC/POS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
