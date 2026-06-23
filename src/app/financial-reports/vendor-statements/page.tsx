"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy, limit } from "firebase/firestore";
import { ArrowLeft, Download, Filter, Building2, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import QRCode from "react-qr-code";

export default function VendorStatementsPage() {
  const [loading, setLoading] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  
  const [allReceipts, setAllReceipts] = useState<any[]>([]);
  const [uniqueCompanies, setUniqueCompanies] = useState<string[]>([]);
  const [filteredReceipts, setFilteredReceipts] = useState<any[]>([]);

  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReceipts();
  }, []);

  useEffect(() => {
    filterData();
  }, [allReceipts, selectedMonth, selectedCompany]);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      // 1. Fetch Cash Payments
      const cashQ = query(collection(db, "cash_payments"), orderBy("timestamp", "desc"), limit(2000));
      const cashSnap = await getDocs(cashQ);
      const cashData = cashSnap.docs.map(doc => {
        const d = doc.data();
        if (!d.companyName) return null;
        return {
          id: doc.id,
          companyName: d.companyName,
          receiptDate: d.date || new Date().toISOString().substring(0, 10),
          poNumber: d.poNumber || d.invoiceNumber || "",
          price: Number(d.total || 0),
          status: "Paid",
          paymentDate: d.date || null
        };
      }).filter(Boolean);

      // 2. Fetch Credits (User requested: "and credit if paid only")
      const creditQ = query(collection(db, "credits"), orderBy("timestamp", "desc"), limit(2000));
      const creditSnap = await getDocs(creditQ);
      const creditData = creditSnap.docs.map(doc => {
        const d = doc.data();
        if (!d.companyName) return null;
        
        // "credit if paid only"
        if (d.status !== "paid" && d.status !== "Paid") return null;
        
        let rDate = d.date || d.collectionDate;
        if (!rDate && d.createdAt && typeof d.createdAt.toDate === 'function') {
           rDate = d.createdAt.toDate().toISOString().substring(0, 10);
        }
        
        return {
          id: doc.id,
          companyName: d.companyName,
          receiptDate: rDate || new Date().toISOString().substring(0, 10),
          poNumber: d.poNumber || d.invoiceNumber || "",
          price: Number(d.amountDue || d.total || 0),
          status: "Paid",
          paymentDate: d.paidAt ? d.paidAt.substring(0, 10) : null
        };
      }).filter(Boolean);

      const data = [...cashData, ...creditData] as any[];
      
      // Sort by date ascending for the statement
      data.sort((a: any, b: any) => a.receiptDate.localeCompare(b.receiptDate));
      
      setAllReceipts(data);

      const companies = Array.from(new Set(data.map((d: any) => d.companyName).filter(Boolean)));
      setUniqueCompanies(companies as string[]);
      
      if (companies.length > 0 && !selectedCompany) {
        setSelectedCompany(companies[0] as string);
      }
    } catch (error) {
      console.error("Error fetching receipts from unified collections:", error);
    } finally {
      setLoading(false);
    }
  };

  function filterData() {
    if (!selectedCompany) {
      setFilteredReceipts([]);
      return;
    }
    const filtered = allReceipts.filter(r => 
      r.companyName === selectedCompany && 
      r.receiptDate && r.receiptDate.startsWith(selectedMonth)
    );
    setFilteredReceipts(filtered);
  }

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val: number) => {
    return `EGP ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalPurchased = filteredReceipts.reduce((sum, r) => sum + Number(r.price), 0);
  const totalPaid = filteredReceipts.filter(r => r.status === "Paid").reduce((sum, r) => sum + Number(r.price), 0);
  const totalCredit = filteredReceipts.filter(r => r.status === "Credit").reduce((sum, r) => sum + Number(r.price), 0);

  const [yearStr, monthStr] = selectedMonth.split('-');
  const monthName = new Date(Number(yearStr), Number(monthStr) - 1).toLocaleString('en-US', { month: 'long' });

  const generateQRData = () => {
    let text = `Vendor: ${selectedCompany}\nPeriod: ${monthName} ${yearStr}\n`;
    text += `Total Invoiced: EGP ${totalPurchased}\nTotal Paid: EGP ${totalPaid}\nBalance Due: EGP ${totalCredit}\n\n`;
    text += `--- Invoices ---\n`;
    filteredReceipts.forEach(r => {
      text += `${r.receiptDate} | PO: ${r.poNumber || "N/A"} | ${r.status} | EGP ${r.price}\n`;
    });
    return text;
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 pb-20 print:bg-white print:text-black print:pb-0">
      
      {/* Control Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm print:hidden">
        <div className="max-w-4xl mx-auto p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/financial-reports" className="text-slate-400 hover:text-orange-600 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black flex items-center gap-2">
                <Building2 className="h-5 w-5 text-orange-600" /> Vendor Statements
              </h1>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-slate-400 ml-2 shrink-0" />
              <select 
                value={selectedCompany} 
                onChange={e => setSelectedCompany(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-bold cursor-pointer w-full"
              >
                {uniqueCompanies.length === 0 ? <option value="">No Companies Found</option> : null}
                {uniqueCompanies.map((c, i) => <option key={i} value={c}>{c}</option>)}
              </select>
              <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-bold cursor-pointer"
              />
            </div>
            <button 
              onClick={handlePrint}
              disabled={loading || filteredReceipts.length === 0}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-orange-600 dark:hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition-colors disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              <Download className="h-4 w-4" />
              Print Statement
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-8 px-4">
        
        {loading ? (
           <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-600"></div></div>
        ) : filteredReceipts.length === 0 ? (
           <div className="text-center p-20 text-slate-500 font-bold bg-white rounded-xl shadow-sm">
             No receipts found for {selectedCompany || "this company"} in {monthName} {yearStr}.
           </div>
        ) : (
          <div 
            ref={pdfRef} 
            className="bg-white text-slate-900 w-full rounded-none sm:rounded-xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none print:m-0 print:border-none"
            style={{ minHeight: '297mm', margin: '0 auto', boxSizing: 'border-box', backgroundColor: '#ffffff' }}
          >
            {/* PDF HEADER */}
            <div className="border-b-4 border-slate-900 p-10 flex justify-between items-end bg-slate-50">
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Vendor Statement</h1>
                <p className="text-2xl font-bold text-orange-600 tracking-widest mt-1 uppercase">{selectedCompany}</p>
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
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Invoiced</p>
                <p className="text-2xl font-black text-slate-900">{formatCurrency(totalPurchased)}</p>
              </div>
              <div className="p-6 text-center border-r border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Paid</p>
                <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="p-6 text-center bg-slate-900 text-white">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Remaining Balance</p>
                <p className={`text-2xl font-black ${totalCredit > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {formatCurrency(totalCredit)}
                </p>
              </div>
            </div>

            {/* FINANCIAL TABLE */}
            <div className="p-10 space-y-8">
              
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900">
                    <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Date</th>
                    <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">PO Number</th>
                    <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Status</th>
                    <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((r, idx) => (
                    <tr key={r.id || idx} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="py-4 px-2 text-sm font-semibold text-slate-700">
                        {r.receiptDate}
                      </td>
                      <td className="py-4 px-2 text-sm text-slate-600 font-mono">
                        {r.poNumber || "-"}
                      </td>
                      <td className="py-4 px-2">
                        {r.status === "Paid" ? (
                          <div>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">PAID</span>
                            {r.paymentDate && <div className="text-[10px] text-slate-500 mt-1 font-semibold">on {r.paymentDate}</div>}
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-md">CREDIT</span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-sm font-black text-slate-900 text-right">
                        {formatCurrency(Number(r.price))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* TOTALS FOOTER */}
              <div className="flex justify-end mt-8">
                <div className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl p-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-slate-500">Total Amount</span>
                    <span className="text-sm font-mono font-bold text-slate-900">{formatCurrency(totalPurchased)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-bold text-slate-500">Amount Paid</span>
                    <span className="text-sm font-mono font-bold text-emerald-600">-{formatCurrency(totalPaid)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t-2 border-slate-900">
                    <span className="text-base font-black text-slate-900 uppercase">Balance Due</span>
                    <span className="text-xl font-mono font-black text-slate-900">{formatCurrency(totalCredit)}</span>
                  </div>
                </div>
              </div>
              
            </div>

            {/* PDF FOOTER & SIGNATURES */}
            <div className="mt-10 pt-10 border-t-2 border-slate-200 mx-10 pb-10 flex justify-between items-end">
              
              {/* QR Code Section */}
              <div className="w-1/4">
                <div className="bg-white p-2 border border-slate-200 rounded-lg inline-block shadow-sm">
                  <QRCode value={generateQRData()} size={80} level="L" />
                </div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-2 text-center w-24">Scan for Invoice Details</p>
              </div>

              <div className="w-1/3 border-t border-slate-400 pt-2 text-center">
                <p className="text-xs font-bold text-slate-600 uppercase">Vendor Representative</p>
                <p className="text-[10px] text-slate-400 mt-1">Signature & Stamp</p>
              </div>
              <div className="w-1/3 border-t border-slate-400 pt-2 text-center">
                <p className="text-xs font-bold text-slate-600 uppercase">Store Management</p>
                <p className="text-[10px] text-slate-400 mt-1">Circle K Authorized Signatory</p>
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
