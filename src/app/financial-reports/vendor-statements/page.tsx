"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { ArrowLeft, Download, Filter, Building2, Printer } from "lucide-react";
import Link from "next/link";
import QRCode from "react-qr-code";

export default function VendorStatementsPage() {
  const [loading, setLoading] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [selectedCompany, setSelectedCompany] = useState<string>("ALL");
  
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

        // Strictly filter out deleted or cancelled credits
        if (d.status === "deleted" || d.status === "cancelled" || d.deleted === true || d.isDeleted === true || d.isCancelled === true) {
          return;
        }

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

        // Strictly filter out deleted or cancelled cash payments
        if (d.status === "deleted" || d.status === "cancelled" || d.deleted === true || d.isDeleted === true || d.isCancelled === true) {
          return;
        }

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

        // Strictly filter out deleted or cancelled credit payments
        if (d.status === "deleted" || d.status === "cancelled" || d.deleted === true || d.isDeleted === true || d.isCancelled === true) {
          return;
        }

        if (!d.creditId) return;

        // If parent credit was deleted, creditIdToNormCompany[d.creditId] will be undefined -> Automatically excluded!
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
  const statementId = `SOA-${(selectedCompany || "ALL").replace(/[^a-zA-Z0-9]/g, "").substring(0, 6).toUpperCase()}-${yearStr}${monthStr}`;

  const generateQRData = () => {
    let text = `Circle K Statement\nRef: ${statementId}\nVendor: ${displayCompanyTitle}\nPeriod: ${monthName} ${yearStr}\nInvoiced: EGP ${totalPurchased}\nPaid: EGP ${totalPaid}\nTax: EGP ${totalTaxPaid}\nBalance: EGP ${totalCredit}`;
    return text;
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 pb-20 print:bg-white print:text-black print:pb-0 print:m-0">
      
      {/* Control Bar (Hidden when printing) */}
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
              <p className="text-xs text-slate-400">Eco-print optimized professional statement of account</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Vendor Selector Dropdown */}
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
              <Printer className="h-4 w-4" />
              Print Statement
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-6 px-2 sm:px-4 print:max-w-none print:m-0 print:p-0">
        
        {loading ? (
           <div className="flex flex-col items-center justify-center p-20 gap-3 print:hidden">
             <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-600"></div>
             <p className="text-sm font-bold text-slate-500">Loading Vendor Ledger Data...</p>
           </div>
        ) : filteredReceipts.length === 0 ? (
           <div className="text-center p-16 text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 print:hidden">
             <Building2 className="mx-auto h-12 w-12 text-slate-400 mb-3" />
             <p className="text-lg text-slate-800 dark:text-slate-200">No records found for {displayCompanyTitle}</p>
             <p className="text-sm text-slate-400 font-normal mt-1">Try selecting a different month or vendor from the top filters.</p>
           </div>
        ) : (
          <div 
            ref={pdfRef} 
            className="bg-white text-slate-900 w-full rounded-xl shadow-xl overflow-hidden print:shadow-none print:w-full print:max-w-none print:m-0 print:p-0 print:border-none print:rounded-none"
            style={{ backgroundColor: '#ffffff', color: '#000000' }}
          >
            {/* ECO-PRINT HIGH-END CORPORATE HEADER */}
            <div className="p-8 border-b border-slate-300 print:p-4 print:border-b-2 print:border-black">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 border-2 border-black flex items-center justify-center font-black text-lg">K</div>
                    <div>
                      <h2 className="text-lg font-black tracking-tight uppercase text-black leading-none">Circle K Retail</h2>
                      <p className="text-[10px] font-bold text-slate-600 tracking-wider uppercase">Stores & Operations Financials</p>
                    </div>
                  </div>
                  <h1 className="text-2xl font-black text-black tracking-tight uppercase mt-6">Statement of Account</h1>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">كشف حساب مورد شامل الضريبة</p>
                </div>

                <div className="text-right border-l border-slate-200 pl-6 print:border-l print:border-slate-400">
                  <div className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider mb-1">Statement No</div>
                  <div className="text-sm font-mono font-black text-black border border-black px-2 py-0.5 inline-block mb-3">{statementId}</div>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-left text-xs">
                    <span className="font-bold text-slate-500 uppercase">Vendor:</span>
                    <span className="font-black text-black capitalize truncate max-w-[140px]">{displayCompanyTitle}</span>
                    
                    <span className="font-bold text-slate-500 uppercase">Period:</span>
                    <span className="font-bold text-black">{monthName} {yearStr}</span>
                    
                    <span className="font-bold text-slate-500 uppercase">Date:</span>
                    <span className="font-bold text-black">{new Date().toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* INK-SAVER OUTLINE SUMMARY CARDS */}
            <div className="p-8 pb-4 print:p-4">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="border border-slate-300 p-3 rounded-lg print:border-slate-400">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Invoiced (Incl. Tax)</p>
                  <p className="text-base font-black font-mono text-black">{formatCurrency(totalPurchased)}</p>
                </div>
                <div className="border border-slate-300 p-3 rounded-lg print:border-slate-400">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Payments</p>
                  <p className="text-base font-black font-mono text-black">{formatCurrency(totalPaid)}</p>
                </div>
                <div className="border border-slate-300 p-3 rounded-lg print:border-slate-400">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Tax Component</p>
                  <p className="text-base font-black font-mono text-black">{formatCurrency(totalTaxPaid)}</p>
                </div>
                <div className="border-2 border-black p-3 rounded-lg bg-white">
                  <p className="text-[10px] font-black text-black uppercase tracking-wider mb-0.5">Net Balance Due</p>
                  <p className="text-lg font-black font-mono text-black">{formatCurrency(totalCredit)}</p>
                </div>
              </div>
            </div>

            {/* FINANCIAL TABLE */}
            <div className="p-8 py-4 print:p-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-y-2 border-black text-xs font-black uppercase text-black tracking-wider">
                    <th className="py-2.5 px-2">Date</th>
                    {selectedCompany === "ALL" && (
                      <th className="py-2.5 px-2">Vendor Name</th>
                    )}
                    <th className="py-2.5 px-2">PO / Invoice Ref</th>
                    <th className="py-2.5 px-2 text-center">Type</th>
                    <th className="py-2.5 px-2 text-right">Tax Paid</th>
                    <th className="py-2.5 px-2 text-right">Total (Incl. Tax)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 print:divide-slate-300 text-xs">
                  {filteredReceipts.map((r, idx) => (
                    <tr key={r.id || idx} className="hover:bg-slate-50 print:hover:bg-transparent">
                      <td className="py-2.5 px-2 font-mono font-semibold text-slate-800">
                        {r.receiptDate}
                      </td>
                      {selectedCompany === "ALL" && (
                        <td className="py-2.5 px-2 font-bold text-black capitalize">
                          {r.originalCompany}
                        </td>
                      )}
                      <td className="py-2.5 px-2 font-mono text-slate-700">
                        {r.poNumber || "-"}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {r.status === "Payment" ? (
                          <span className="border border-black text-black text-[9px] font-black px-1.5 py-0.5 rounded uppercase">PAYMENT</span>
                        ) : (
                          <span className="border border-slate-400 text-slate-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">INVOICE</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-slate-600 text-right">
                        {r.tax > 0 ? formatCurrency(r.tax) : "EGP 0.00"}
                      </td>
                      <td className="py-2.5 px-2 font-mono font-black text-right text-black">
                        {r.status === "Payment" ? "-" : ""}{formatCurrency(Number(r.price))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* OUTLINE TOTALS SUMMARY BOX */}
              <div className="flex justify-end mt-6">
                <div className="w-full sm:w-72 border-2 border-black p-4 rounded-lg bg-white space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-semibold uppercase">Total Invoiced:</span>
                    <span className="font-mono font-bold text-black">{formatCurrency(totalPurchased)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-semibold uppercase">Less Payments:</span>
                    <span className="font-mono font-bold text-black">-{formatCurrency(totalPaid)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 border-t border-dashed border-slate-300 pt-1.5">
                    <span className="font-medium text-[11px] uppercase">Tax Included:</span>
                    <span className="font-mono font-semibold text-black">{formatCurrency(totalTaxPaid)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t-2 border-black pt-2 text-black">
                    <span className="font-black uppercase text-sm">Balance Due:</span>
                    <span className="font-mono font-black text-base">{formatCurrency(totalCredit)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* FORMAL SIGNATURES & STAMP SECTION */}
            <div className="p-8 pt-4 print:p-4 print:mt-4">
              <div className="border-t-2 border-slate-300 pt-6 flex justify-between items-end print:border-black">
                {/* QR Code */}
                <div className="w-1/4">
                  <div className="bg-white p-1.5 border border-black inline-block">
                    <QRCode value={generateQRData()} size={70} level="L" />
                  </div>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-1 text-center w-20">Scan Verification</p>
                </div>

                <div className="w-1/3 border-t border-black pt-2 text-center">
                  <p className="text-xs font-bold text-black uppercase">Vendor Representative</p>
                  <p className="text-[9px] text-slate-500 mt-1">Signature & Official Stamp</p>
                </div>
                <div className="w-1/3 border-t border-black pt-2 text-center">
                  <p className="text-xs font-bold text-black uppercase">Store Management</p>
                  <p className="text-[9px] text-slate-500 mt-1">Circle K Authorized Approval</p>
                </div>
              </div>

              <div className="text-center text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest mt-6">
                Circle K Operations System • Official Financial Record • Generated {new Date().toLocaleString('en-GB')}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* PRINT MEDIA STYLES */}
      <style jsx global>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm 10mm;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
