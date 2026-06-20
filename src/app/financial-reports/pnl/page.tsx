"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ArrowLeft, TrendingUp, Download, Printer, Filter, DollarSign, PieChart, Activity, Briefcase, Package } from "lucide-react";
import Link from "next/link";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function PNLReportPage() {
  const [loading, setLoading] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

  // Financial Data
  const [revenueTotal, setRevenueTotal] = useState(0);
  const [expenses, setExpenses] = useState<any[]>([]);

  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFinancialData();
  }, [selectedMonth]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Sales (Revenue) for the selected month
      // We look for dates starting with the selected month (YYYY-MM)
      const salesQuery = query(collection(db, "sales"));
      const salesSnap = await getDocs(salesQuery);
      
      let totalRev = 0;
      salesSnap.forEach(doc => {
        const data = doc.data();
        if (data.date && data.date.startsWith(selectedMonth)) {
          totalRev += (Number(data.cash) || 0) + (Number(data.visa) || 0);
        }
      });
      setRevenueTotal(totalRev);

      // 2. Fetch Expenses for the selected month
      const expQuery = query(collection(db, "expenses"));
      const expSnap = await getDocs(expQuery);
      
      const exps: any[] = [];
      expSnap.forEach(doc => {
        const data = doc.data();
        if (data.date && data.date.startsWith(selectedMonth)) {
          exps.push({ id: doc.id, ...data });
        }
      });
      setExpenses(exps);

    } catch (error) {
      console.error("Error fetching financial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    const element = pdfRef.current;
    if (!element) return;
    setGeneratingPDF(true);
    
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Profit_Loss_Statement_${selectedMonth}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Calculations
  const cogsTotal = expenses.filter(e => e.category === "cogs").reduce((sum, e) => sum + e.amount, 0);
  const grossProfit = revenueTotal - cogsTotal;
  
  const opExTotal = expenses.filter(e => e.category !== "cogs").reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - opExTotal;

  // Breakdown for OpEx
  const breakdown = {
    rent: expenses.filter(e => e.category === "rent").reduce((s, e) => s + e.amount, 0),
    house_rent: expenses.filter(e => e.category === "house_rent").reduce((s, e) => s + e.amount, 0),
    utilities: expenses.filter(e => e.category === "utilities").reduce((s, e) => s + e.amount, 0),
    payroll: expenses.filter(e => e.category === "payroll").reduce((s, e) => s + e.amount, 0),
    taxes: expenses.filter(e => e.category === "taxes").reduce((s, e) => s + e.amount, 0),
    maintenance: expenses.filter(e => e.category === "maintenance").reduce((s, e) => s + e.amount, 0),
    misc: expenses.filter(e => e.category === "misc").reduce((s, e) => s + e.amount, 0),
  };

  const formatCurrency = (val: number) => {
    return `EGP ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const [yearStr, monthStr] = selectedMonth.split('-');
  const monthName = new Date(Number(yearStr), Number(monthStr) - 1).toLocaleString('en-US', { month: 'long' });

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 pb-20">
      
      {/* Control Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/financial-reports" className="text-slate-400 hover:text-blue-600 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" /> P&L / Cash Flow
              </h1>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <Filter className="h-4 w-4 text-slate-400 ml-2" />
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-bold cursor-pointer"
              />
            </div>
            <button 
              onClick={generatePDF}
              disabled={generatingPDF || loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition-colors disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              {generatingPDF ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : <Download className="h-4 w-4" />}
              {generatingPDF ? "Exporting..." : "Export PDF"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-8 px-4">
        
        {loading ? (
           <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div></div>
        ) : (
          <div 
            ref={pdfRef} 
            className="bg-white text-slate-900 w-full rounded-none sm:rounded-xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:m-0"
            style={{ width: '210mm', minHeight: '297mm', margin: '0 auto', boxSizing: 'border-box', backgroundColor: '#ffffff' }}
          >
            {/* PDF HEADER */}
            <div className="border-b-4 border-slate-900 p-10 flex justify-between items-end bg-slate-50">
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Statement of Operations</h1>
                <p className="text-lg font-bold text-slate-500 tracking-widest mt-1 uppercase">Profit & Loss (P&L)</p>
              </div>
              <div className="text-right">
                <div className="h-12 w-12 bg-slate-900 text-white rounded-full flex items-center justify-center font-black text-2xl ml-auto mb-2">K</div>
                <p className="font-bold text-sm text-slate-700">Circle K Retail</p>
                <p className="text-xs font-semibold text-slate-500">Period: {monthName} {yearStr}</p>
              </div>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-3 gap-0 border-b border-slate-200">
              <div className="p-6 text-center border-r border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Revenue</p>
                <p className="text-2xl font-black text-slate-900">{formatCurrency(revenueTotal)}</p>
              </div>
              <div className="p-6 text-center border-r border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Gross Profit</p>
                <p className="text-2xl font-black text-emerald-600">{formatCurrency(grossProfit)}</p>
              </div>
              <div className="p-6 text-center bg-slate-900 text-white">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Net Income</p>
                <p className={`text-2xl font-black ${netProfit < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {formatCurrency(netProfit)}
                </p>
              </div>
            </div>

            {/* FINANCIAL TABLE */}
            <div className="p-10 space-y-8">
              
              {/* REVENUE SECTION */}
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-2 mb-4 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> 1. Revenue
                </h3>
                <div className="flex justify-between items-center py-2 px-2 hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">Gross Sales Revenue</span>
                  <span className="font-mono">{formatCurrency(revenueTotal)}</span>
                </div>
                <div className="flex justify-between items-center py-2 px-2 hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">Other Revenue</span>
                  <span className="font-mono">EGP 0.00</span>
                </div>
                <div className="flex justify-between items-center py-3 px-2 mt-2 border-t border-slate-200 bg-slate-50 rounded font-bold">
                  <span className="uppercase text-xs tracking-wider">Total Revenue</span>
                  <span className="font-mono">{formatCurrency(revenueTotal)}</span>
                </div>
              </div>

              {/* COGS SECTION */}
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-2 mb-4 flex items-center gap-2">
                  <Package className="h-4 w-4" /> 2. Cost of Goods Sold (COGS)
                </h3>
                <div className="flex justify-between items-center py-2 px-2 hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">Inventory & Products Cost</span>
                  <span className="font-mono">{formatCurrency(cogsTotal)}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-2 mt-2 border-t border-slate-200 bg-slate-50 rounded font-bold">
                  <span className="uppercase text-xs tracking-wider">Total COGS</span>
                  <span className="font-mono">{formatCurrency(cogsTotal)}</span>
                </div>
              </div>

              {/* GROSS PROFIT */}
              <div className="flex justify-between items-center py-4 px-4 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200 font-black">
                <span className="uppercase tracking-widest">Gross Profit</span>
                <span className="font-mono text-xl">{formatCurrency(grossProfit)}</span>
              </div>

              {/* OPEX SECTION */}
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-2 mb-4 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> 3. Operating Expenses (OpEx)
                </h3>
                
                {Object.entries(breakdown).map(([key, value]) => {
                  if (value === 0) return null;
                  const label = key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                  return (
                    <div key={key} className="flex justify-between items-center py-2 px-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <span className="font-semibold text-slate-700">{label}</span>
                      <span className="font-mono">{formatCurrency(value)}</span>
                    </div>
                  );
                })}

                {opExTotal === 0 && (
                  <div className="py-4 text-center text-sm font-semibold text-slate-400 italic">No operating expenses recorded for this period.</div>
                )}

                <div className="flex justify-between items-center py-3 px-2 mt-2 border-t border-slate-200 bg-slate-50 rounded font-bold">
                  <span className="uppercase text-xs tracking-wider">Total Operating Expenses</span>
                  <span className="font-mono">{formatCurrency(opExTotal)}</span>
                </div>
              </div>

              {/* NET INCOME */}
              <div className={`flex justify-between items-center py-5 px-6 rounded-xl border-2 font-black mt-8 ${netProfit < 0 ? 'bg-red-50 text-red-900 border-red-200' : 'bg-slate-900 text-white border-slate-900'}`}>
                <div className="flex flex-col">
                  <span className="uppercase tracking-widest text-sm">Net Income</span>
                  <span className="text-[10px] font-semibold opacity-70 mt-1">Gross Profit - Total OpEx</span>
                </div>
                <span className="font-mono text-3xl">{formatCurrency(netProfit)}</span>
              </div>
              
            </div>

            {/* PDF FOOTER & SIGNATURES */}
            <div className="mt-20 pt-10 border-t-2 border-slate-200 mx-10 pb-10 flex justify-between items-end">
              <div className="w-1/3 border-t border-slate-400 pt-2 text-center">
                <p className="text-xs font-bold text-slate-600 uppercase">Prepared By</p>
                <p className="text-[10px] text-slate-400 mt-1">Financial Controller</p>
              </div>
              <div className="w-1/3 border-t border-slate-400 pt-2 text-center">
                <p className="text-xs font-bold text-slate-600 uppercase">Approved By</p>
                <p className="text-[10px] text-slate-400 mt-1">Store Owner / Manager</p>
              </div>
            </div>

            <div className="text-center text-[9px] font-semibold text-slate-300 uppercase tracking-widest pb-10">
              Generated by Circle K Automated Financial Systems • {new Date().toLocaleString('en-GB')}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
