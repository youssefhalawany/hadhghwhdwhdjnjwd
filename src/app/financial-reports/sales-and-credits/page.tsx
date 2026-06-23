"use client";

import React, { useState, useEffect } from "react";
import { dbService, db } from "@/lib/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Download, Printer, Filter, Search, FileText, ChevronDown, RefreshCw } from "lucide-react";
import * as ExcelJS from "exceljs";
import { generatePDF, downloadPDFBlob } from "@/lib/pdf-generator";
import QRCode from "react-qr-code";
import Barcode from "react-barcode";

export default function FinancialReportsPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [creditPayments, setCreditPayments] = useState<any[]>([]);
  const [cashPayments, setCashPayments] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState("sales");
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [storeId, setStoreId] = useState("all");
  const [reportId, setReportId] = useState("");

  useEffect(() => {
    setReportId(`CK-REP-${Math.floor(Math.random() * 1000000)}`);
    let unsubSales = () => { };
    let unsubCredits = () => { };
    let unsubCreditPayments = () => { };
    let unsubCashPayments = () => { };

    const loadData = async () => {
      setLoading(true);
      unsubSales = dbService.onSnapshot(query(collection(db, "sales"), orderBy("timestamp", "desc"), limit(2000)), setSales);
      unsubCredits = dbService.onSnapshot(query(collection(db, "credits"), orderBy("timestamp", "desc"), limit(1000)), setCredits);
      unsubCreditPayments = dbService.onSnapshot(query(collection(db, "credit_payments"), orderBy("timestamp", "desc"), limit(1000)), setCreditPayments);
      unsubCashPayments = dbService.onSnapshot(query(collection(db, "cash_payments"), orderBy("timestamp", "desc"), limit(1000)), setCashPayments);
      setLoading(false);
    };

    loadData();

    return () => {
      unsubSales();
      unsubCredits();
      unsubCreditPayments();
      unsubCashPayments();
    };
  }, []);

  const filterData = (data: any[], dateField = "date", storeField = "storeId") => {
    return data.filter(item => {
      let d = item[dateField] || item.createdAt || item.collectionDate;
      let itemYMD = "";

      if (d) {
        if (d.toDate) d = d.toDate();

        if (typeof d === 'string' && /^\\d{4}-\\d{2}-\\d{2}/.test(d)) {
          // It's already YYYY-MM-DD or ISO string, safe to just slice
          itemYMD = d.substring(0, 10);
        } else if (typeof d === 'string' && d.includes('/')) {
          const parts = d.split(/[/\s:-]/);
          if (parts.length >= 3 && parts[2].length === 4) {
            itemYMD = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        } else {
          // Fallback to JS Date parsing
          const parsedDate = new Date(d);
          if (!isNaN(parsedDate.getTime())) {
            const year = parsedDate.getFullYear();
            const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
            const day = String(parsedDate.getDate()).padStart(2, '0');
            itemYMD = `${year}-${month}-${day}`;
          }
        }
      }

      const storeMatch = storeId === "all" || item[storeField] === storeId;

      if (startDate || endDate) {
        if (!itemYMD) return false;
        const passStart = startDate ? itemYMD >= startDate : true;
        const passEnd = endDate ? itemYMD <= endDate : true;
        return passStart && passEnd && storeMatch;
      }
      return storeMatch;
    });
  };

  const getExportData = () => {
    if (activeTab === "sales") return filterData(sales, "date", "storeId");
    if (activeTab === "credits") return filterData(credits, "collectionDate", "storeId");
    if (activeTab === "credit_payments") return filterData(creditPayments, "date", "storeId");
    if (activeTab === "cash_payments") return filterData(cashPayments, "date", "storeId");
    return [];
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(activeTab.toUpperCase());
    const data = getExportData();
    if (data.length === 0) { alert("No data to export"); return; }

    const columns = Object.keys(data[0]).map(key => ({ header: key.toUpperCase(), key: key, width: 20 }));
    worksheet.columns = columns;
    data.forEach(item => worksheet.addRow(item));
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE53E3E" } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CircleK_${activeTab}_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReportA4 = async () => {
    setGeneratingPDF(true);
    const newReportId = `CK-REP-${Math.floor(Math.random() * 1000000)}`;
    setReportId(newReportId); // Refresh ID on print

    // Save report to verifications ledger securely
    try {
      const reportPayload = {
        filters: { startDate, endDate, storeId, grandTotal: 0 },
        data: activeDataArray
      };

      const localString = JSON.stringify(reportPayload);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(localString);
      const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const sha256Hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      await dbService.addDoc("verifications", {
        verificationToken: newReportId,
        reportId: newReportId,
        type: `Financial Report - ${activeTab.toUpperCase()}`,
        timestamp: new Date().toISOString(),
        sha256Hash,
        originalData: reportPayload
      });

      await dbService.logAction(
        "system@circlek",
        "Automated System",
        "system",
        `Generated formal A4 Report: ${newReportId}`,
        "",
        `Type: ${activeTab}`
      );
    } catch (err) {
      console.warn("Could not securely save report to verifications ledger. PDF will still generate.", err);
    }

    // Short delay to ensure React state has rendered the new ID in the hidden div
    await new Promise(r => setTimeout(r, 200));
    try {
      const blob = await generatePDF("financial-report-pdf-capture", {
        title: `Circle K ${activeTab.toUpperCase()} Report`,
        filename: `CK_Report_${activeTab}.pdf`,
        watermarkText: "",
        orientation: "p"
      });
      downloadPDFBlob(blob, `CK_A4_Report_${activeTab}_${new Date().toISOString().substring(0, 10)}.pdf`);
    } catch (error) {
      console.error("PDF Generate Error:", error);
      alert("Failed to generate PDF Report. Please try again.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  // AGGREGATION LOGIC
  let activeDataArray: any[] = [];
  let printTableHeaders: string[] = [];
  let printTableRows: React.ReactNode[] = [];
  let totalCash = 0, totalVisa = 0, totalOverShort = 0, grandTotal = 0;

  if (activeTab === "sales") {
    const data = filterData(sales, "date", "storeId");
    const grouped: Record<string, any> = {};
    data.forEach(item => {
      const d = item.date;
      let itemYMD = d;
      if (typeof d === 'string' && d.includes('T')) itemYMD = d.substring(0, 10);
      const key = `${itemYMD}_${item.storeId || 'UNKNOWN'}`;
      if (!grouped[key]) grouped[key] = { date: itemYMD, store: item.storeId || 'UNKNOWN', cash: 0, visa: 0, overShort: 0 };
      grouped[key].cash += (Number(item.cash) || 0);
      grouped[key].visa += (Number(item.visa) || 0);
      grouped[key].overShort += (Number(item.overShort) || 0);
    });
    activeDataArray = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
    totalCash = activeDataArray.reduce((sum, item) => sum + item.cash, 0);
    totalVisa = activeDataArray.reduce((sum, item) => sum + item.visa, 0);
    totalOverShort = activeDataArray.reduce((sum, item) => sum + item.overShort, 0);
    grandTotal = totalCash + totalVisa;

    printTableHeaders = ["DATE", "STORE", "CASH TOTAL", "VISA TOTAL", "TOTAL REV", "OVER/SHORT"];
    printTableRows = activeDataArray.map((row, i) => (
      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <td style={{ padding: '12px 16px', color: '#334155' }}>{row.date}</td>
        <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 'bold' }}>{row.store}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>EGP {row.cash.toLocaleString()}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>EGP {row.visa.toLocaleString()}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>EGP {(row.cash + row.visa).toLocaleString()}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: row.overShort < 0 ? '#e11937' : '#10b981' }}>EGP {row.overShort.toLocaleString()}</td>
      </tr>
    ));
  } else if (activeTab === "credits") {
    const data = filterData(credits, "collectionDate", "storeId");
    const grouped: Record<string, any> = {};
    data.forEach(item => {
      const comp = item.companyName || "UNKNOWN";
      if (!grouped[comp]) grouped[comp] = { company: comp, amountDue: 0, tax: 0, total: 0, openInvoices: 0, paidInvoices: 0 };
      grouped[comp].amountDue += (Number(item.amountDue) || 0);
      grouped[comp].tax += (Number(item.tax) || 0);
      grouped[comp].total += (Number(item.total) || 0);
      if (item.status === 'paid') grouped[comp].paidInvoices++;
      else grouped[comp].openInvoices++;
    });
    activeDataArray = Object.values(grouped).sort((a, b) => b.total - a.total);

    printTableHeaders = ["COMPANY", "OPEN INVOICES", "PAID INVOICES", "TOTAL TAX", "TOTAL CREDITS (DUE)"];
    printTableRows = activeDataArray.map((row, i) => (
      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#0f172a' }}>{row.company}</td>
        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#e11937', fontWeight: 'bold' }}>{row.openInvoices}</td>
        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#10b981', fontWeight: 'bold' }}>{row.paidInvoices}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>EGP {row.tax.toLocaleString()}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>EGP {row.total.toLocaleString()}</td>
      </tr>
    ));
  } else if (activeTab === "cash_payments") {
    const data = filterData(cashPayments, "date", "storeId");
    const grouped: Record<string, any> = {};
    data.forEach(item => {
      const cat = item.category || "Uncategorized";
      if (!grouped[cat]) grouped[cat] = { category: cat, amount: 0, count: 0 };
      const val = Number(item.amount) || Number(item.total) || 0;
      grouped[cat].amount += val;
      grouped[cat].count++;
      grandTotal += val;
    });
    activeDataArray = Object.values(grouped).sort((a, b) => b.amount - a.amount);

    printTableHeaders = ["EXPENSE CATEGORY", "TRANSACTIONS", "TOTAL SPENT"];
    printTableRows = activeDataArray.map((row, i) => (
      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#0f172a' }}>{row.category}</td>
        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b' }}>{row.count}</td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: '#e11937' }}>EGP {row.amount.toLocaleString()}</td>
      </tr>
    ));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Financial Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Aggregated summaries designed for A4 exporting and printing.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={printReportA4}
            disabled={generatingPDF}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50"
          >
            {generatingPDF ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Print Report (A4)
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-green-500/20"
          >
            <Download className="h-4 w-4" />
            Export Raw to Excel
          </button>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-xl border border-border space-y-6">
        {/* FILTERS */}
        <div className="flex flex-col md:flex-row gap-4 items-end bg-muted/20 p-4 rounded-lg border border-border/50">
          <div className="flex-1 w-full space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1"><Filter className="h-3 w-3" /> From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:border-red-500 transition-colors"
            />
          </div>
          <div className="flex-1 w-full space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:border-red-500 transition-colors"
            />
          </div>
          <div className="flex-1 w-full space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase">Store ID</label>
            <input
              type="text"
              placeholder="e.g. eL-alamein-4 (Empty = all)"
              value={storeId === "all" ? "" : storeId}
              onChange={(e) => setStoreId(e.target.value || "all")}
              className="w-full bg-background border border-border rounded-lg p-2.5 text-sm outline-none focus:border-red-500 transition-colors"
            />
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 border-b border-border pb-px overflow-x-auto">
          {[
            { id: "sales", label: "💰 Daily Sales Summary" },
            { id: "credits", label: "🏢 Corporate Credits" },
            { id: "cash_payments", label: "💵 Expenses Summary" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                  ? "border-red-500 text-red-500"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ON-SCREEN DARK MODE UI */}
        <div className="pt-2">
          {activeTab === "sales" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="glass-panel p-4 rounded-xl text-center"><p className="text-xs text-muted-foreground uppercase">Cash Total</p><p className="text-xl font-bold text-green-500">EGP {totalCash.toLocaleString()}</p></div>
                <div className="glass-panel p-4 rounded-xl text-center"><p className="text-xs text-muted-foreground uppercase">Visa Total</p><p className="text-xl font-bold text-blue-500">EGP {totalVisa.toLocaleString()}</p></div>
                <div className="glass-panel p-4 rounded-xl text-center"><p className="text-xs text-muted-foreground uppercase">Grand Total</p><p className="text-xl font-bold text-red-500">EGP {grandTotal.toLocaleString()}</p></div>
                <div className="glass-panel p-4 rounded-xl text-center"><p className="text-xs text-muted-foreground uppercase">Over/Short</p><p className={`text-xl font-bold ${totalOverShort < 0 ? 'text-red-500' : 'text-green-500'}`}>EGP {totalOverShort.toLocaleString()}</p></div>
              </div>
              <div className="overflow-x-auto rounded border border-border bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground border-b border-border">
                    <tr>{printTableHeaders.map((h, i) => <th key={i} className="p-3 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeDataArray.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3">{row.date}</td>
                        <td className="p-3">{row.store}</td>
                        <td className="p-3 text-muted-foreground">EGP {row.cash.toLocaleString()}</td>
                        <td className="p-3 text-muted-foreground">EGP {row.visa.toLocaleString()}</td>
                        <td className="p-3 font-bold text-foreground">EGP {(row.cash + row.visa).toLocaleString()}</td>
                        <td className={`p-3 font-bold ${row.overShort < 0 ? 'text-red-500' : 'text-green-500'}`}>EGP {row.overShort.toLocaleString()}</td>
                      </tr>
                    ))}
                    {activeDataArray.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No records found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === "credits" && (
            <div className="overflow-x-auto rounded border border-border bg-card mt-6">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground border-b border-border">
                  <tr>{printTableHeaders.map((h, i) => <th key={i} className="p-3 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeDataArray.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="p-3 font-bold">{row.company}</td>
                      <td className="p-3 text-red-500">{row.openInvoices}</td>
                      <td className="p-3 text-green-500">{row.paidInvoices}</td>
                      <td className="p-3 text-muted-foreground">EGP {row.tax.toLocaleString()}</td>
                      <td className="p-3 font-bold text-amber-500">EGP {row.total.toLocaleString()}</td>
                    </tr>
                  ))}
                  {activeDataArray.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No records found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {activeTab === "cash_payments" && (
            <div className="space-y-4">
              <div className="glass-panel p-4 rounded-xl max-w-xs text-center mb-4 mt-6">
                <p className="text-xs text-muted-foreground uppercase">Total Cash Expenses</p>
                <p className="text-2xl font-black text-red-500">EGP {grandTotal.toLocaleString()}</p>
              </div>
              <div className="overflow-hidden rounded border border-border bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground border-b border-border">
                    <tr>{printTableHeaders.map((h, i) => <th key={i} className="p-3 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeDataArray.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-semibold">{row.category}</td>
                        <td className="p-3">{row.count}</td>
                        <td className="p-3 font-bold text-red-500">EGP {row.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    {activeDataArray.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No records found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- HIDDEN FORMAL A4 PRINT TEMPLATE --- */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div id="financial-report-pdf-capture" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', color: '#1e293b', fontFamily: '"Inter", sans-serif', position: 'relative', overflow: 'hidden' }}>

          {/* No Watermark */}

          {/* Top Red Corporate Ribbon */}
          <div style={{ height: '12px', width: '100%', backgroundColor: '#e11937', position: 'absolute', top: 0, left: 0 }}></div>

          {/* Content Container */}
          <div style={{ padding: '60px 50px', position: 'relative', zIndex: 1, minHeight: '1123px', display: 'flex', flexDirection: 'column' }}>

            {/* Formal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '30px', marginBottom: '40px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ backgroundColor: '#e11937', color: '#ffffff', fontWeight: '900', fontSize: '28px', padding: '4px 12px', borderRadius: '4px', letterSpacing: '-1px' }}>K</div>
                  <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', margin: 0, letterSpacing: '-1px' }}>CIRCLE K</h1>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', fontWeight: 'bold', color: '#64748b', letterSpacing: '2px', textTransform: 'uppercase' }}>Financial Intelligence & Audit</p>
                <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#e11937', margin: '20px 0 0 0' }}>{activeTab.toUpperCase().replace('_', ' ')} REPORT</h2>
              </div>

              <div style={{ textAlign: 'right', fontSize: '12px', color: '#475569', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '250px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Audit Document Details</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><strong>ID:</strong> <span style={{ fontFamily: 'monospace' }}>{reportId}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><strong>Generated:</strong> <span>{new Date().toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><strong>Period:</strong> <span>{startDate || 'All Time'} to {endDate || 'Present'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 0 }}><strong>Store Scope:</strong> <span>{storeId === 'all' ? 'Enterprise-Wide' : storeId}</span></div>
              </div>
            </div>

            {/* Special KPI Header for Sales */}
            {activeTab === 'sales' && (
              <div style={{ display: 'flex', gap: '20px', marginBottom: '40px' }}>
                <div style={{ flex: 1, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '4px solid #10b981', borderRadius: '6px', padding: '20px' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Cash Revenue</p>
                  <p style={{ margin: '8px 0 0 0', fontSize: '28px', fontWeight: '900', color: '#0f172a' }}>EGP {totalCash.toLocaleString()}</p>
                </div>
                <div style={{ flex: 1, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '4px solid #3b82f6', borderRadius: '6px', padding: '20px' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Visa Revenue</p>
                  <p style={{ margin: '8px 0 0 0', fontSize: '28px', fontWeight: '900', color: '#0f172a' }}>EGP {totalVisa.toLocaleString()}</p>
                </div>
                <div style={{ flex: 1, backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderLeft: '4px solid #e11937', borderRadius: '6px', padding: '20px' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#be123c', textTransform: 'uppercase', letterSpacing: '1px' }}>Combined Grand Total</p>
                  <p style={{ margin: '8px 0 0 0', fontSize: '28px', fontWeight: '900', color: '#e11937' }}>EGP {grandTotal.toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* Special KPI Header for Expenses */}
            {activeTab === 'cash_payments' && (
              <div style={{ marginBottom: '40px' }}>
                <div style={{ display: 'inline-block', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderLeft: '4px solid #e11937', borderRadius: '6px', padding: '20px', minWidth: '300px' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#be123c', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Cash Expenses</p>
                  <p style={{ margin: '8px 0 0 0', fontSize: '28px', fontWeight: '900', color: '#e11937' }}>EGP {grandTotal.toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* Formal Data Table */}
            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', marginBottom: '40px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                    {printTableHeaders.map((h, i) => (
                      <th key={i} style={{ padding: '14px 16px', textAlign: h.includes('TOTAL') || h.includes('OVER/SHORT') || h.includes('SPENT') ? 'right' : 'left', fontWeight: 'bold', letterSpacing: '0.5px', fontSize: '11px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {printTableRows}
                </tbody>
              </table>
              {activeDataArray.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontStyle: 'italic' }}>No records found for this period.</div>
              )}
            </div>

            {/* Formal Footer */}
            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <Barcode value={reportId} width={1.2} height={35} fontSize={10} background="transparent" displayValue={true} />
                <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '20px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#e11937', margin: '0 0 4px 0', letterSpacing: '1px', textTransform: 'uppercase' }}>Strictly Confidential</p>
                  <p style={{ fontSize: '10px', color: '#64748b', margin: 0, maxWidth: '250px', lineHeight: '1.4' }}>This document contains proprietary financial data. Unauthorized distribution is strictly prohibited under corporate policy.</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>Digital Verification</p>
                  <p style={{ fontSize: '10px', color: '#64748b', margin: 0 }}>Scan to authenticate ledger entry</p>
                </div>
                <div style={{ padding: '4px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <QRCode value={`https://verify.circlek-reports.com/audit/${reportId}`} size={60} />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
