"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { ArrowLeft, Download, Filter, Building2, Search } from "lucide-react";
import Link from "next/link";
import QRCode from "react-qr-code";

export default function VendorStatementsPage() {
  const [loading, setLoading] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [selectedCompany, setSelectedCompany] = useState<string>("ALL");
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  
  const [allReceipts, setAllReceipts] = useState<any[]>([]);
  const [uniqueCompanies, setUniqueCompanies] = useState<string[]>([]);

  const pdfRef = useRef<HTMLDivElement>(null);

  // Single initial fetch on mount - 0 redundant Firebase calls!
  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const [creditsSnap, cashSnap, creditPaymentsSnap] = await Promise.all([
        getDocs(collection(db, "credits")),
        getDocs(collection(db, "cash_payments")),
        getDocs(collection(db, "credit_payments"))
      ]);

      const normalizeName = (name: string) => name ? name.trim().toLowerCase().replace(/[-_.\s]/g, "") : "";
      
      const companyDisplayNames: Record<string, string> = {}; 
      const creditIdToNormCompany: Record<string, string> = {};
      const companySet = new Set<string>();

      const allData: any[] = [];

      // 1. Process Credits (Invoices)
      creditsSnap.docs.forEach(doc => {
        const d = doc.data();
        const rawName = (d.companyName || d.supplierName || d.supplier || d.vendor || d.supplierRepName || d.name || "").trim();
        if (!rawName) return;

        const norm = normalizeName(rawName);
        if (!companyDisplayNames[norm]) companyDisplayNames[norm] = rawName;
        creditIdToNormCompany[doc.id] = norm;
        companySet.add(companyDisplayNames[norm]);

        let rDate = d.createdAt && typeof d.createdAt.toDate === 'function' 
          ? d.createdAt.toDate().toISOString().substring(0, 10) 
          : d.date || d.collectionDate || "";

        if (typeof d.createdAt === 'string' && !rDate) {
          rDate = d.createdAt.substring(0, 10);
        }

        const baseAmt = Number(d.amountDue || d.amount || 0);
        const taxAmt = Number(d.tax || 0);
        const totalInvoicePrice = Number(d.totalAmount || d.total || (baseAmt + taxAmt));
        const finalInvoicePriceWithTax = (totalInvoicePrice >= (baseAmt + taxAmt) && totalInvoicePrice > 0) 
          ? totalInvoicePrice 
          : (baseAmt + taxAmt);

        allData.push({
          id: doc.id,
          normalizedCompany: norm,
          originalCompany: companyDisplayNames[norm],
          receiptDate: rDate || new Date().toISOString().substring(0, 10),
          poNumber: d.poNumber || d.invoiceNumber || "-",
          price: finalInvoicePriceWithTax,
          tax: taxAmt,
          status: "Invoice",
          source: "credits"
        });
      });

      // 2. Process Cash Payments
      cashSnap.docs.forEach(doc => {
        const d = doc.data();
        const rawName = (d.companyName || d.supplierName || d.supplier || d.vendor || d.supplierRepName || d.name || "").trim();
        if (!rawName) return;

        const norm = normalizeName(rawName);
        if (!companyDisplayNames[norm]) companyDisplayNames[norm] = rawName;
        companySet.add(companyDisplayNames[norm]);

        let rDate = d.date || (d.createdAt && typeof d.createdAt.toDate === 'function' ? d.createdAt.toDate().toISOString().substring(0, 10) : "");
        if (typeof d.createdAt === 'string' && !rDate) rDate = d.createdAt.substring(0, 10);

        const pAmt = Number(d.amount || 0);
        const pTax = Number(d.tax || 0);
        const pTot = Number(d.total || 0);
        const finalPaymentPriceWithTax = (pTot >= (pAmt + pTax) && pTot > 0) ? pTot : (pAmt + pTax);

        allData.push({
          id: doc.id,
          normalizedCompany: norm,
          originalCompany: companyDisplayNames[norm],
          receiptDate: rDate || new Date().toISOString().substring(0, 10),
          poNumber: d.poNumber || d.invoiceNumber || "Cash Payment",
          price: finalPaymentPriceWithTax,
          tax: pTax,
          status: "Payment",
          source: "cash_payments"
        });
      });

      // 3. Process Credit Payments
      creditPaymentsSnap.docs.forEach(doc => {
        const d = doc.data();
        if (!d.creditId) return;

        const norm = creditIdToNormCompany[d.creditId];
        if (!norm) return;

        let rDate = d.date || (d.createdAt && typeof d.createdAt.toDate === 'function' ? d.createdAt.toDate().toISOString().substring(0, 10) : "");
        if (typeof d.createdAt === 'string' && !rDate) rDate = d.createdAt.substring(0, 10);

        const pAmt = Number(d.amount || 0);
        const pTax = Number(d.tax || 0);
        const pTot = Number(d.total || 0);
        const finalPaymentPriceWithTax = (pTot >= (pAmt + pTax) && pTot > 0) ? pTot : (pAmt + pTax);

        allData.push({
          id: doc.id,
          normalizedCompany: norm,
          originalCompany: companyDisplayNames[norm] || "Unknown Supplier",
          receiptDate: rDate || new Date().toISOString().substring(0, 10),
          poNumber: `Pmt ref: ${d.creditId.substring(0, 6)}`,
          price: finalPaymentPriceWithTax,
          tax: pTax,
          status: "Payment",
          source: "credit_payments"
        });
      });

      // Sort globally by date ascending
      allData.sort((a, b) => a.receiptDate.localeCompare(b.receiptDate));
      setAllReceipts(allData);

      // Unique companies sorted alphabetically
      const sortedCompanies = Array.from(companySet).sort((a, b) => a.localeCompare(b));
      setUniqueCompanies(sortedCompanies);
    } catch (error) {
      console.error("Error fetching vendor records:", error);
    } finally {
      setLoading(false);
    }
  };

  // Instantaneous in-memory filtering (0ms response speed!)
  const filteredReceipts = useMemo(() => {
    if (!allReceipts.length) return [];

    const normalizeName = (name: string) => name ? name.trim().toLowerCase().replace(/[-_.\s]/g, "") : "";
    const selectedNorm = selectedCompany === "ALL" ? "" : normalizeName(selectedCompany);

    return allReceipts.filter(r => {
      const matchCompany = !selectedNorm || r.normalizedCompany === selectedNorm;
      const matchMonth = !selectedMonth || (r.receiptDate && r.receiptDate.startsWith(selectedMonth));
      return matchCompany && matchMonth;
    });
  }, [allReceipts, selectedCompany, selectedMonth]);

  // Filter company dropdown list by search query
  const searchedCompanies = useMemo(() => {
    if (!companySearchQuery.trim()) return uniqueCompanies;
    const q = companySearchQuery.toLowerCase();
    return uniqueCompanies.filter(c => c.toLowerCase().includes(q));
  }, [uniqueCompanies, companySearchQuery]);

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val: number) => {
    return `EGP ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalPurchased = filteredReceipts.filter(r => r.status === "Invoice").reduce((sum, r) => sum + r.price, 0);
  const totalPaid = filteredReceipts.filter(r => r.status === "Payment").reduce((sum, r) => sum + r.price, 0);
  const totalTaxPaid = filteredReceipts.reduce((sum, r) => sum + (r.tax || 0), 0);
  const totalCredit = totalPurchased - totalPaid;

  const [yearStr = "", monthStr = ""] = (selectedMonth || "").split('-');
  const monthName = (yearStr && monthStr) 
    ? new Date(Number(yearStr), Number(monthStr) - 1).toLocaleString('en-US', { month: 'long' })
    : "";

  const displayCompanyTitle = selectedCompany === "ALL" ? "All Vendors Summary" : selectedCompany;

  const generateQRData = () => {
    let text = `Vendor: ${displayCompanyTitle}\nPeriod: ${monthName} ${yearStr}\n`;
    text += `Total Invoiced: EGP ${totalPurchased}\nTotal Paid: EGP ${totalPaid}\nTotal Tax Paid: EGP ${totalTaxPaid}\nBalance Due: EGP ${totalCredit}\n\n`;
    text += `--- Ledger ---\n`;
    filteredReceipts.slice(0, 30).forEach(r => {
      text += `${r.receiptDate} | ${r.originalCompany} | ${r.poNumber || "N/A"} | ${r.status} | EGP ${r.price}\n`;
    });
    return text;
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 pb-20 print:bg-white print:text-black print:pb-0">
      
      {/* Control Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            
            {/* Vendor Selector Dropdown with Contrast Styling */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-slate-500 ml-2 shrink-0" />
              <select 
                value={selectedCompany} 
                onChange={e => setSelectedCompany(e.target.value)}
                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold border border-slate-300 dark:border-slate-700 outline-none text-sm cursor-pointer px-3 py-1.5 rounded-lg shadow-sm w-full sm:w-[220px]"
              >
                <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                  🏢 All Vendors ({uniqueCompanies.length})
                </option>
                {uniqueCompanies.map((c, i) => (
                  <option key={i} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                    {c}
                  </option>
                ))}
              </select>
              <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold border border-slate-300 dark:border-slate-700 outline-none text-sm cursor-pointer px-3 py-1.5 rounded-lg shadow-sm"
              />
            </div>

            <button 
              onClick={handlePrint}
              disabled={loading || filteredReceipts.length === 0}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-orange-600 dark:hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              <Download className="h-4 w-4" />
              Print Statement
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto mt-6 px-4">
        
        {loading ? (
           <div className="flex flex-col items-center justify-center p-20 gap-3">
             <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-600"></div>
             <p className="text-sm font-bold text-slate-500">Loading Vendor Ledger Data...</p>
           </div>
        ) : filteredReceipts.length === 0 ? (
           <div className="text-center p-16 text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
             <Building2 className="mx-auto h-12 w-12 text-slate-400 mb-3" />
             <p className="text-lg text-slate-800 dark:text-slate-200">No records found for {displayCompanyTitle}</p>
             <p className="text-sm text-slate-400 font-normal mt-1">Try selecting a different month or vendor from the top filters.</p>
           </div>
        ) : (
          <div 
            ref={pdfRef} 
            className="bg-white text-slate-900 w-full rounded-none sm:rounded-xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none print:m-0 print:border-none"
            style={{ minHeight: '297mm', margin: '0 auto', boxSizing: 'border-box', backgroundColor: '#ffffff' }}
          >
            {/* PDF HEADER */}
            <div className="border-b-4 border-slate-900 p-8 sm:p-10 flex justify-between items-end bg-slate-50">
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase">Vendor Statement</h1>
                <p className="text-xl sm:text-2xl font-bold text-orange-600 tracking-wider mt-1 uppercase">{displayCompanyTitle}</p>
              </div>
              <div className="text-right">
                <div className="h-12 w-12 bg-slate-900 text-white rounded-full flex items-center justify-center font-black text-2xl ml-auto mb-2">K</div>
                <p className="font-bold text-sm text-slate-700">Circle K Retail</p>
                <p className="text-xs font-semibold text-slate-500">Period: {monthName} {yearStr}</p>
              </div>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-slate-200 text-center">
              <div className="p-5 border-r border-b md:border-b-0 border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Invoiced (Incl. Tax)</p>
                <p className="text-xl font-black text-slate-900">{formatCurrency(totalPurchased)}</p>
              </div>
              <div className="p-5 border-r border-b md:border-b-0 border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Paid</p>
                <p className="text-xl font-black text-emerald-600">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="p-5 border-r border-slate-200 bg-slate-50">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tax Included</p>
                <p className="text-xl font-black text-cyan-600">{formatCurrency(totalTaxPaid)}</p>
              </div>
              <div className="p-5 bg-slate-900 text-white">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Remaining Balance</p>
                <p className={`text-xl font-black ${totalCredit > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {formatCurrency(totalCredit)}
                </p>
              </div>
            </div>

            {/* FINANCIAL TABLE */}
            <div className="p-6 sm:p-10 space-y-8">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Date</th>
                      {selectedCompany === "ALL" && (
                        <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Vendor</th>
                      )}
                      <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">PO / Invoice #</th>
                      <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest">Type</th>
                      <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest text-right">Tax Paid</th>
                      <th className="py-3 px-2 text-xs font-black text-slate-900 uppercase tracking-widest text-right">Total Amount (Incl. Tax)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceipts.map((r, idx) => (
                      <tr key={r.id || idx} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="py-4 px-2 text-sm font-semibold text-slate-700">
                          {r.receiptDate}
                        </td>
                        {selectedCompany === "ALL" && (
                          <td className="py-4 px-2 text-sm font-bold text-slate-900 capitalize">
                            {r.originalCompany}
                          </td>
                        )}
                        <td className="py-4 px-2 text-sm text-slate-600 font-mono">
                          {r.poNumber || "-"}
                        </td>
                        <td className="py-4 px-2">
                          {r.status === "Payment" ? (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md uppercase">PAYMENT</span>
                          ) : (
                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-md uppercase">INVOICE</span>
                          )}
                        </td>
                        <td className="py-4 px-2 text-sm font-mono text-slate-500 text-right">
                          {r.tax > 0 ? formatCurrency(r.tax) : "EGP 0.00"}
                        </td>
                        <td className={`py-4 px-2 text-sm font-black text-right ${r.status === 'Payment' ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {r.status === "Payment" ? "-" : ""}{formatCurrency(Number(r.price))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TOTALS FOOTER */}
              <div className="flex justify-end mt-8">
                <div className="w-full sm:w-1/2 bg-slate-50 border border-slate-200 rounded-xl p-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-slate-500">Total Invoiced (Incl. Tax)</span>
                    <span className="text-sm font-mono font-bold text-slate-900">{formatCurrency(totalPurchased)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-slate-500">Total Tax Paid Component</span>
                    <span className="text-sm font-mono font-bold text-cyan-600">{formatCurrency(totalTaxPaid)}</span>
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
