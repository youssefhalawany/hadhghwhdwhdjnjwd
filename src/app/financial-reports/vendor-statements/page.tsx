"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { ArrowLeft, Download, Filter, Building2, Printer, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import QRCode from "react-qr-code";

export default function VendorStatementsPage() {
  const [loading, setLoading] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [selectedCompany, setSelectedCompany] = useState<string>("ALL");
  const [paidOnly, setPaidOnly] = useState<boolean>(true); // DEFAULT: Paid invoices only!
  
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
      const creditIdToPoNumber: Record<string, string> = {};
      const companySet = new Set<string>();

      const creditItems: any[] = [];
      const paymentItems: any[] = [];

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

        const rawPo = (d.poNumber || d.invoiceNumber || "").trim();
        if (rawPo && rawPo !== "-") {
          creditIdToPoNumber[doc.id] = rawPo;
        }

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

        const paidAmt = Number(d.paidAmount || 0);
        const isPaid = d.status === "paid" || d.isPaid === true || paidAmt > 0;
        const pMethod = d.paymentMethod || d.method || d.paymentType || d.type || "Credit / آجل";

        creditItems.push({
          id: doc.id,
          normalizedCompany: norm,
          originalCompany: companyDisplayNames[norm],
          receiptDate: rDate || new Date().toISOString().substring(0, 10),
          poNumber: rawPo || "-",
          price: finalInvoicePriceWithTax,
          tax: taxAmt,
          status: "Invoice",
          paymentMethod: pMethod,
          isPaid: isPaid,
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

        const parentPo = d.creditId ? creditIdToPoNumber[d.creditId] : "";
        const rawPo = (d.poNumber || d.invoiceNumber || parentPo || "").trim();
        const pMethod = d.paymentMethod || d.method || d.paymentType || d.type || "Cash / الخزينة";

        paymentItems.push({
          id: doc.id,
          creditId: d.creditId || null,
          normalizedCompany: norm,
          originalCompany: companyDisplayNames[norm],
          receiptDate: rDate || new Date().toISOString().substring(0, 10),
          poNumber: rawPo || "Cash Payment",
          price: finalPaymentPriceWithTax,
          tax: pTax,
          status: "Payment",
          paymentMethod: pMethod,
          isPaid: true,
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

        const norm = creditIdToNormCompany[d.creditId];
        if (!norm) return;

        let rDate = d.date || (d.createdAt && typeof d.createdAt.toDate === 'function' ? d.createdAt.toDate().toISOString().substring(0, 10) : "");
        if (typeof d.createdAt === 'string' && !rDate) rDate = d.createdAt.substring(0, 10);

        const pAmt = Number(d.amount || 0);
        const pTax = Number(d.tax || 0);
        const pTot = Number(d.total || 0);
        const finalPaymentPriceWithTax = (pTot >= (pAmt + pTax) && pTot > 0) ? pTot : (pAmt + pTax);

        const parentPo = creditIdToPoNumber[d.creditId] || "";
        const rawPo = (d.poNumber || d.invoiceNumber || parentPo || "").trim();
        const pMethod = d.paymentMethod || d.method || d.paymentType || d.type || (d.isVisa ? "Visa / Bank" : "Cash / الخزينة");

        paymentItems.push({
          id: doc.id,
          creditId: d.creditId,
          normalizedCompany: norm,
          originalCompany: companyDisplayNames[norm] || "Unknown Supplier",
          receiptDate: rDate || new Date().toISOString().substring(0, 10),
          poNumber: rawPo || "-",
          price: finalPaymentPriceWithTax,
          tax: pTax,
          status: "Payment",
          paymentMethod: pMethod,
          isPaid: true,
          source: "credit_payments"
        });
      });

      // STRICT GLOBAL DEDUPLICATION BY VENDOR + PO NUMBER
      const poGroupMap = new Map<string, any[]>();
      const standaloneRecords: any[] = [];

      const allCandidates = [...creditItems, ...paymentItems];

      allCandidates.forEach(item => {
        let rawPo = (item.poNumber || "").trim();
        let cleanPo = rawPo.toLowerCase().replace(/[^a-z0-9]/g, "");
        cleanPo = cleanPo.replace(/^(po|inv|invoice|ref|pmt|pmtref)+/g, "");

        const poKey = (cleanPo && cleanPo !== "-" && cleanPo !== "cashpayment" && cleanPo !== "na" && cleanPo !== "none") 
          ? `${item.normalizedCompany}_${cleanPo}` 
          : null;

        if (poKey) {
          if (!poGroupMap.has(poKey)) {
            poGroupMap.set(poKey, []);
          }
          poGroupMap.get(poKey)!.push({ ...item, cleanPoKey: poKey });
        } else {
          standaloneRecords.push(item);
        }
      });

      const allData: any[] = [];
      const seenPaymentCreditIds = new Set<string>();

      poGroupMap.forEach((group) => {
        const paymentItem = group.find(i => i.status === "Payment");
        if (paymentItem) {
          allData.push(paymentItem);
          if (paymentItem.creditId) {
            seenPaymentCreditIds.add(paymentItem.creditId);
          }
        } else {
          allData.push(group[0]);
        }
      });

      standaloneRecords.forEach(item => {
        if (item.source === "credits" && seenPaymentCreditIds.has(item.id)) {
          return;
        }
        allData.push(item);
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

    const items = allReceipts.filter(r => {
      const matchCompany = !selectedNorm || r.normalizedCompany === selectedNorm;
      const matchMonth = !selectedMonth || (r.receiptDate && r.receiptDate.startsWith(selectedMonth));
      const matchPaid = !paidOnly || r.isPaid === true || r.status === "Payment";
      return matchCompany && matchMonth && matchPaid;
    });

    if (selectedCompany === "ALL") {
      // Group by company name alphabetically, then by date ascending
      items.sort((a, b) => {
        const compCompare = (a.originalCompany || "").localeCompare(b.originalCompany || "");
        if (compCompare !== 0) return compCompare;
        return (a.receiptDate || "").localeCompare(b.receiptDate || "");
      });
    } else {
      items.sort((a, b) => (a.receiptDate || "").localeCompare(b.receiptDate || ""));
    }

    return items;
  }, [allReceipts, selectedCompany, selectedMonth, paidOnly]);

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

  const displayCompanyTitle = selectedCompany === "ALL" ? "ALL VENDORS STATEMENT" : selectedCompany;
  const statementId = `SOA-${(selectedCompany || "ALL").replace(/[^a-zA-Z0-9]/g, "").substring(0, 6).toUpperCase()}-${yearStr}${monthStr}`;

  const generateQRData = () => {
    return `Circle K Statement | Ref: ${statementId} | Vendor: ${displayCompanyTitle} | Period: ${monthName} ${yearStr} | Invoiced: EGP ${totalPurchased} | Paid: EGP ${totalPaid} | Tax: EGP ${totalTaxPaid} | Balance: EGP ${totalCredit}`;
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
              <p className="text-xs text-slate-400">Statement of Account (Multi-Page Flow Supported)</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            
            {/* Filter Toggle: Paid Invoices Only */}
            <button
              onClick={() => setPaidOnly(!paidOnly)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${paidOnly ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'}`}
            >
              <CheckCircle2 className={`h-4 w-4 ${paidOnly ? 'text-emerald-600' : 'text-slate-400'}`} />
              Paid Invoices Only
            </button>

            {/* Vendor Selector Dropdown */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-slate-500 ml-2 shrink-0" />
              <select 
                value={selectedCompany} 
                onChange={e => setSelectedCompany(e.target.value)}
                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold border border-slate-300 dark:border-slate-700 outline-none text-sm cursor-pointer px-3 py-1.5 rounded-lg shadow-sm w-full sm:w-[200px]"
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
              Print A4 Statement
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto mt-6 px-2 sm:px-4 print:max-w-none print:m-0 print:p-0">
        
        {loading ? (
           <div className="flex flex-col items-center justify-center p-20 gap-3 print:hidden">
             <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-600"></div>
             <p className="text-sm font-bold text-slate-500">Loading Vendor Ledger Data...</p>
           </div>
        ) : filteredReceipts.length === 0 ? (
           <div className="text-center p-16 text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 print:hidden">
             <Building2 className="mx-auto h-12 w-12 text-slate-400 mb-3" />
             <p className="text-lg text-slate-800 dark:text-slate-200">No paid records found for {displayCompanyTitle}</p>
             <p className="text-sm text-slate-400 font-normal mt-1">Try selecting a different month or vendor, or toggle "Paid Invoices Only".</p>
           </div>
        ) : (
          <div 
            ref={pdfRef} 
            className="bg-white text-slate-900 w-full rounded-xl shadow-xl overflow-visible print:shadow-none print:w-full print:max-w-none print:m-0 print:p-0 print:border-none print:rounded-none flex flex-col justify-between"
            style={{ backgroundColor: '#ffffff', color: '#000000', boxSizing: 'border-box' }}
          >
            <div>
              {/* TOP HEADER */}
              <div className="p-6 pb-4 border-b border-slate-300 print:p-3 print:border-b-2 print:border-black flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 border-2 border-black flex items-center justify-center font-black text-xl">K</div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight uppercase text-black leading-none">CIRCLE K RETAIL</h2>
                    <p className="text-[9px] font-bold text-slate-600 tracking-wider uppercase mt-0.5">STORES & FINANCIAL OPERATIONS</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">STATEMENT OF ACCOUNT</div>
                  <div className="text-xs font-mono font-black text-black border border-black px-2 py-0.5 inline-block mt-0.5">{statementId}</div>
                </div>
              </div>

              {/* PROMINENT HIGH-VISIBILITY SUPPLIER COMPANY BANNER */}
              <div className="p-6 py-4 print:p-3">
                <div className="border-2 border-black p-4 rounded-xl print:rounded-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50 print:bg-transparent">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">SUPPLIER / VENDOR COMPANY</span>
                    <h1 className="text-2xl sm:text-3xl font-black text-black uppercase tracking-tight leading-tight mt-0.5">
                      {displayCompanyTitle}
                    </h1>
                  </div>
                  <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-slate-300 sm:pl-4 pt-2 sm:pt-0">
                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">STATEMENT PERIOD</span>
                    <span className="text-sm font-mono font-black text-black">{monthName} {yearStr}</span>
                    <span className="text-[10px] text-slate-600 block mt-0.5 font-bold">Issued: {new Date().toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
              </div>

              {/* INK-SAVER SUMMARY CARDS */}
              <div className="px-6 print:px-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="border border-slate-300 p-2.5 rounded-lg print:border-slate-400">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Invoiced</p>
                    <p className="text-sm sm:text-base font-black font-mono text-black">{formatCurrency(totalPurchased)}</p>
                  </div>
                  <div className="border border-slate-300 p-2.5 rounded-lg print:border-slate-400">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Payments</p>
                    <p className="text-sm sm:text-base font-black font-mono text-black">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div className="border border-slate-300 p-2.5 rounded-lg print:border-slate-400">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Tax Included</p>
                    <p className="text-sm sm:text-base font-black font-mono text-black">{formatCurrency(totalTaxPaid)}</p>
                  </div>
                  <div className="border-2 border-black p-2.5 rounded-lg bg-white">
                    <p className="text-[9px] font-black text-black uppercase tracking-wider mb-0.5">Balance Due</p>
                    <p className="text-base sm:text-lg font-black font-mono text-black">{formatCurrency(totalCredit)}</p>
                  </div>
                </div>
              </div>

              {/* FINANCIAL TABLE WITH PAYMENT METHOD & COMPANY GROUPING */}
              <div className="px-6 py-4 print:px-3 print:py-2">
                <table className="w-full text-left border-collapse print:w-full">
                  <thead className="print:table-header-group">
                    <tr className="border-y-2 border-black text-[10px] font-black uppercase text-black tracking-wider">
                      <th className="py-2 px-2">Date</th>
                      {selectedCompany === "ALL" && (
                        <th className="py-2 px-2">Vendor Name</th>
                      )}
                      <th className="py-2 px-2">PO / Invoice Ref</th>
                      <th className="py-2 px-2 text-center">Type</th>
                      <th className="py-2 px-2 text-center">Payment Method</th>
                      <th className="py-2 px-2 text-right">Tax Paid</th>
                      <th className="py-2 px-2 text-right">Total Amount (Incl. Tax)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 print:divide-slate-300 text-[11px]">
                    {filteredReceipts.map((r, idx) => {
                      const isFirstOfCompany = selectedCompany === "ALL" && (idx === 0 || filteredReceipts[idx - 1].normalizedCompany !== r.normalizedCompany);

                      return (
                        <React.Fragment key={r.id || idx}>
                          {isFirstOfCompany && (
                            <tr className="bg-slate-100 dark:bg-slate-800 print:bg-slate-200 border-t-2 border-b border-black print:break-inside-avoid">
                              <td colSpan={7} className="py-1.5 px-2 font-black text-xs uppercase tracking-wider text-black">
                                🏢 {r.originalCompany}
                              </td>
                            </tr>
                          )}
                          <tr className="hover:bg-slate-50 print:hover:bg-transparent print:break-inside-avoid">
                            <td className="py-1.5 px-2 font-mono font-semibold text-slate-800">
                              {r.receiptDate}
                            </td>
                            {selectedCompany === "ALL" && (
                              <td className="py-1.5 px-2 font-bold text-black capitalize truncate max-w-[120px]">
                                {r.originalCompany}
                              </td>
                            )}
                            <td className="py-1.5 px-2 font-mono text-slate-700">
                              {r.poNumber || "-"}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              {r.status === "Payment" ? (
                                <span className="border border-black text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase">PAYMENT</span>
                              ) : (
                                <span className="border border-amber-600 text-amber-800 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">INVOICE</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <span className="border border-slate-400 text-slate-800 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
                                {r.paymentMethod || (r.status === "Payment" ? (r.source === "cash_payments" ? "Cash / الخزينة" : "Visa / Bank") : "Credit / آجل")}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 font-mono text-slate-600 text-right">
                              {r.tax > 0 ? formatCurrency(r.tax) : "EGP 0.00"}
                            </td>
                            <td className="py-1.5 px-2 font-mono font-black text-right text-black">
                              {r.status === "Payment" ? "-" : ""}{formatCurrency(Number(r.price))}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* COMBINED FOOTER (TOTALS + SIGNATURES + QR CODE - STAYS INTACT ON LAST PAGE) */}
            <div className="p-6 pt-2 print:p-3 print:pt-1 border-t-2 border-slate-300 print:border-black mt-2 print:break-inside-avoid">
              <div className="flex flex-col sm:flex-row justify-between items-end gap-4">
                
                {/* QR Code & System Info */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="bg-white p-1 border border-black inline-block shrink-0">
                    <QRCode value={generateQRData()} size={60} level="L" />
                  </div>
                  <div>
                    <p className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider">Verification QR</p>
                    <p className="text-[8px] text-slate-400 font-mono mt-0.5">Circle K Operations System</p>
                    <p className="text-[8px] text-slate-400 font-mono">Generated: {new Date().toLocaleDateString('en-GB')}</p>
                  </div>
                </div>

                {/* Signatures */}
                <div className="flex items-center gap-6 text-center w-full sm:w-auto justify-around">
                  <div className="border-t border-black pt-1 w-32">
                    <p className="text-[10px] font-bold text-black uppercase">Vendor Signature</p>
                    <p className="text-[8px] text-slate-500">Stamp & Date</p>
                  </div>
                  <div className="border-t border-black pt-1 w-32">
                    <p className="text-[10px] font-bold text-black uppercase">Manager Approval</p>
                    <p className="text-[8px] text-slate-500">Authorized Signatory</p>
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="border-2 border-black p-2.5 rounded-lg bg-white w-full sm:w-64 text-xs space-y-1">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-semibold text-[10px] uppercase">Total Invoiced:</span>
                    <span className="font-mono font-bold text-black text-[11px]">{formatCurrency(totalPurchased)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-semibold text-[10px] uppercase">Less Payments:</span>
                    <span className="font-mono font-bold text-black text-[11px]">-{formatCurrency(totalPaid)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 border-t border-dashed border-slate-300 pt-1">
                    <span className="font-medium text-[9px] uppercase">Tax Included:</span>
                    <span className="font-mono font-semibold text-black text-[10px]">{formatCurrency(totalTaxPaid)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t-2 border-black pt-1 text-black">
                    <span className="font-black uppercase text-xs">Balance Due:</span>
                    <span className="font-mono font-black text-sm">{formatCurrency(totalCredit)}</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}
      </div>

      {/* MULTI-PAGE A4 PRINT MEDIA STYLES */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden, nav, footer, [class*="bottom-nav"], [class*="BottomNav"], [class*="FAB"], [class*="QuickActions"] {
            display: none !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

    </div>
  );
}
