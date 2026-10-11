import React from "react";

export function numberToArabicWords(num: number): string {
  if (isNaN(num) || num === 0) return "صفر جنيه مصري";

  const isNegative = num < 0;
  num = Math.abs(num);

  const integerPart = Math.floor(num);
  const fractionPart = Math.round((num - integerPart) * 100);

  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  function getBelow100(n: number): string {
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    if (o === 0) return tens[t];
    return ones[o] + " و" + tens[t];
  }

  function getBelow1000(n: number): string {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    if (h === 0) return getBelow100(rest);
    const hText = hundreds[h];
    if (rest === 0) return hText;
    return hText + " و" + getBelow100(rest);
  }

  function convertInteger(n: number): string {
    if (n === 0) return "صفر";
    let words = "";

    const millions = Math.floor(n / 1000000);
    let rem = n % 1000000;
    if (millions > 0) {
      if (millions === 1) words += "مليون";
      else if (millions === 2) words += "مليونان";
      else if (millions >= 3 && millions <= 10) words += getBelow100(millions) + " ملايين";
      else words += getBelow1000(millions) + " مليون";
    }

    const thousands = Math.floor(rem / 1000);
    rem = rem % 1000;
    if (thousands > 0) {
      if (words !== "") words += " و";
      if (thousands === 1) words += "ألف";
      else if (thousands === 2) words += "ألفان";
      else if (thousands >= 3 && thousands <= 10) words += getBelow100(thousands) + " آلاف";
      else words += getBelow1000(thousands) + " ألفاً";
    }

    if (rem > 0) {
      if (words !== "") words += " و";
      words += getBelow1000(rem);
    }

    return words;
  }

  let result = convertInteger(integerPart) + " جنيهاً مصرياً";
  if (fractionPart > 0) {
    result += " و" + getBelow100(fractionPart) + " قرشاً";
  }

  if (isNegative) result = "سالب " + result;
  return result;
}

export function formatArabicFullDate(dString?: string | Date) {
  try {
    const d = dString ? new Date(dString) : new Date();
    if (isNaN(d.getTime())) return String(dString || "");
    return d.toLocaleDateString('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (e) {
    return String(dString || "");
  }
}

export function getReturnBranchDetails(storeId?: string, branchId?: string, currentBranch?: string) {
  const s = (storeId || branchId || currentBranch || "").toLowerCase();
  if (s.includes("ola") || s.includes("koronfol")) {
    return {
      companyName: "شركة أولاد القرنفل للتجارة والتوريدات",
      brandName: "سلسلة محلات سيركل كيه - مصر (Circle K Egypt)",
      branchName: "فرع سيركل كيه (أولاد القرنفل - التجمع الخامس)",
      cr: "216727",
      tax: "756-563-844",
      tag: "أولاد القرنفل"
    };
  }
  return {
    companyName: "شركة ايه ان اتش للتجارة والتوزيع",
    brandName: "سلسلة محلات سيركل كيه - مصر (Circle K Egypt)",
    branchName: "فرع سيركل كيه (مارينا العلمين - بوابة 4)",
    cr: "216727",
    tax: "756-563-844",
    tag: "العلمين 4"
  };
}

export interface ReturnReceiptData {
  supplier?: string;
  date?: string;
  returnedAt?: string | Date;
  returnNumber?: string;
  transferOutNumber?: string;
  agentName?: string;
  agentNationalId?: string;
  agentMobile?: string;
  items?: any[];
  totalPrice?: number | string;
  settlementMethod?: string;
  paymentTiming?: string;
  expectedPaymentDate?: string;
  isSettled?: boolean;
  branchId?: string;
  storeId?: string;
  settledByVoucher?: string;
  paymentVoucherNumber?: string;
}

export interface PendingReturnTicket {
  id: string;
  allDocIds: string[];
  returnNumber: string;
  transferOutNumber: string;
  supplier: string;
  totalPrice: number;
  date: string;
  returnedAt: string;
  reason: string;
  agentName: string;
  agentNationalId: string;
  agentMobile: string;
  items: any[];
  status: string;
  isSettled: boolean;
}

export function groupPendingReturns(rawDocs: any[]): PendingReturnTicket[] {
  const groups: Record<string, PendingReturnTicket> = {};

  rawDocs.forEach(raw => {
    const data = raw.data ? { id: raw.id, ...raw.data() } : raw;
    if (data.isSettled === true || !!data.settledByVoucher) return;
    if (data.status !== "pending" && data.status !== "pending_return" && data.status !== "returned" && data.status) return;

    const key = data.returnNumber || data.id;
    if (!groups[key]) {
      const itemsList = Array.isArray(data.items) && data.items.length > 0
        ? [...data.items]
        : [{
            barcode: data.barcode || "N/A",
            itemName: data.itemName || data.reason || "مرتجع بضاعة",
            quantity: Number(data.quantity) || 1,
            unitPrice: Number(data.totalPrice) || 0,
            totalPrice: Number(data.totalPrice) || 0
          }];

      const initialTotal = Number(data.totalPrice) || 0;

      groups[key] = {
        id: data.id,
        allDocIds: [data.id],
        returnNumber: data.returnNumber || `RTV-${data.id.slice(-6)}`,
        transferOutNumber: data.transferOutNumber || "",
        supplier: data.supplier || "Unknown",
        totalPrice: initialTotal,
        date: data.date || data.returnedAt || data.createdAt || "",
        returnedAt: data.returnedAt || data.createdAt || "",
        reason: data.reason || data.itemName || "مرتجع بضاعة",
        agentName: data.agentName || "",
        agentNationalId: data.agentNationalId || "",
        agentMobile: data.agentMobile || "",
        items: itemsList,
        status: data.status || "pending",
        isSettled: false
      };
    } else {
      if (!groups[key].allDocIds.includes(data.id)) {
        groups[key].allDocIds.push(data.id);
      }
      if (Array.isArray(data.items) && data.items.length > 0) {
        data.items.forEach((it: any) => {
          if (!groups[key].items.some((existing: any) => existing.barcode === it.barcode && existing.itemName === it.itemName)) {
            groups[key].items.push(it);
          }
        });
      } else if (data.itemName && !groups[key].items.some((existing: any) => existing.itemName === data.itemName)) {
        groups[key].items.push({
          barcode: data.barcode || "N/A",
          itemName: data.itemName,
          quantity: Number(data.quantity) || 1,
          unitPrice: Number(data.totalPrice) || 0,
          totalPrice: Number(data.totalPrice) || 0
        });
      }

      if (data.totalPrice && Number(data.totalPrice) > groups[key].totalPrice) {
        groups[key].totalPrice = Number(data.totalPrice);
      }
      if (!groups[key].transferOutNumber && data.transferOutNumber) {
        groups[key].transferOutNumber = data.transferOutNumber;
      }
      if (!groups[key].agentName && data.agentName) {
        groups[key].agentName = data.agentName;
      }
      if (!groups[key].agentNationalId && data.agentNationalId) {
        groups[key].agentNationalId = data.agentNationalId;
      }
      if (!groups[key].agentMobile && data.agentMobile) {
        groups[key].agentMobile = data.agentMobile;
      }
      if (!groups[key].reason && data.reason) {
        groups[key].reason = data.reason;
      }
    }
  });

  // Calculate sum of items if higher than totalPrice
  Object.values(groups).forEach(grp => {
    if (grp.items && grp.items.length > 0) {
      const itemsSum = grp.items.reduce((sum: number, it: any) => {
        const itemTot = Number(it.totalPrice) || ((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0));
        return sum + itemTot;
      }, 0);
      if (itemsSum > grp.totalPrice && itemsSum > 0) {
        grp.totalPrice = itemsSum;
      }
    }
  });

  return Object.values(groups).sort((a, b) => {
    const da = new Date(a.returnedAt || a.date || 0).getTime();
    const db = new Date(b.returnedAt || b.date || 0).getTime();
    return db - da;
  });
}

/**
 * Smart items chunking algorithm for guaranteed professional A4 pagination:
 * - Up to 8 items fit completely on 1 single full A4 page.
 * - When items exceed 8:
 *   Page 1 holds header, notices, supplier & financial cards, plus first 5 items.
 *   Subsequent pages hold 8 to 10 items.
 *   The final page holds remaining items + declaration + signatures + stamp.
 */
function chunkReturnItems(items?: any[]): any[][] {
  if (!items || items.length === 0) return [[]];
  if (items.length <= 8) {
    return [items];
  }

  const page1Items = items.slice(0, 5);
  const remaining = items.slice(5);

  if (remaining.length <= 8) {
    return [page1Items, remaining];
  }

  const pages: any[][] = [page1Items];
  let cur = 5;
  while (cur < items.length) {
    const left = items.length - cur;
    if (left <= 8) {
      pages.push(items.slice(cur));
      break;
    } else {
      const take = left > 16 ? 10 : (left - 8);
      pages.push(items.slice(cur, cur + take));
      cur += take;
    }
  }
  return pages;
}

export function ReturnReceiptContent({ 
  data, 
  currentBranch,
  isPrint 
}: { 
  data: ReturnReceiptData | any; 
  currentBranch?: string;
  isPrint?: boolean;
}) {
  if (!data) return null;
  const branchDetails = getReturnBranchDetails(data.branchId || data.storeId, undefined, currentBranch);
  const arabicDate = formatArabicFullDate(data.returnedAt || data.date);
  const totalAmount = Number(data.totalPrice || 0);
  const totalAmountWords = numberToArabicWords(totalAmount);
  const nidChars = String(data.agentNationalId || "").replace(/\D/g, "").slice(0, 14).padEnd(14, " ").split("");
  
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const totalQty = rawItems.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
  const isGenericTransfer = (rawItems.length === 1 && (rawItems[0].barcode === "N/A" || !rawItems[0].barcode)) || (rawItems.length === 0);
  const voucherRef = data.settledByVoucher || data.paymentVoucherNumber;

  const itemChunks = isGenericTransfer ? [rawItems] : chunkReturnItems(rawItems);
  const totalPages = Math.max(1, itemChunks.length);

  return (
    <div className="rtv-document-wrapper w-full" dir="rtl" style={{ fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif" }}>
      {itemChunks.map((chunk, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === totalPages - 1;
        const startItemIndex = itemChunks.slice(0, pageIndex).reduce((sum, c) => sum + c.length, 0);

        return (
          <div
            key={pageIndex}
            className={`rtv-print-page ${totalPages === 1 ? 'rtv-print-page-single' : ''} bg-white`}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxSizing: "border-box",
              width: "100%",
              maxWidth: "194mm",
              minHeight: "274mm",
              height: "274mm",
              maxHeight: "274mm",
              margin: isPrint ? "0 auto" : (totalPages > 1 ? "0 auto 20px auto" : "0 auto"),
              padding: "5mm 6mm",
              color: "#0f172a",
              backgroundColor: "#ffffff",
              borderRadius: isPrint ? "0px" : "12px",
              boxShadow: isPrint ? "none" : "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              border: isPrint ? "none" : "1px solid #e2e8f0",
              overflow: "hidden",
              pageBreakAfter: isLastPage ? "avoid" : "always",
              breakAfter: isLastPage ? "avoid" : "page",
              pageBreakInside: "avoid",
              breakInside: "avoid"
            }}
          >
            {/* TOP CONTAINER: Header, Notice & Metadata */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {/* 1. CORPORATE HEADER */}
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 2.1fr 1.3fr", gap: "8px", alignItems: "center", borderBottom: "2px solid #0f172a", paddingBottom: "6px" }}>
                {/* Right: Company Identity */}
                <div style={{ textAlign: "right", fontSize: "10px", lineHeight: "1.35", color: "#1e293b" }}>
                  <div style={{ fontWeight: "900", fontSize: "13.5px", color: "#0f172a", whiteSpace: "nowrap" }}>{branchDetails.companyName}</div>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#dc2626", marginTop: "1px" }}>{branchDetails.brandName}</div>
                  <div style={{ fontSize: "9.5px", fontFamily: "monospace", marginTop: "2px", color: "#334155", fontWeight: "700" }}>س.ت: {branchDetails.cr} | ب.ض: {branchDetails.tax}</div>
                  <div style={{ fontSize: "9px", color: "#64748b", marginTop: "1px" }}>إدارة سلاسل الإمداد والمخازن • قسم المرتجعات (RTV)</div>
                </div>

                {/* Center: Title Emblem */}
                <div style={{ textAlign: "center" }}>
                  <div style={{ border: "2px solid #0f172a", borderRadius: "8px", padding: "6px 10px", background: "#f8fafc" }}>
                    <div style={{ fontSize: "14.5px", fontWeight: "900", color: "#0f172a", letterSpacing: "0.3px" }}>
                      إشعار مرتجع بضاعة رسمي للمورد
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: "800", color: "#dc2626", marginTop: "2px" }}>
                      محضر تسليم مرتجعات وإخلاء طرف المخازن (RTV Manifest)
                    </div>
                    <div style={{ fontSize: "9px", color: "#475569", marginTop: "1px" }}>
                      وثيقة تسليم ومقاصة مالية رسمية معتمدة
                    </div>
                  </div>
                </div>

                {/* Left: Metadata Box (Clean key-value alignment) */}
                <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "6px", background: "#f8fafc", padding: "4px 8px", fontSize: "9.5px", lineHeight: "1.4" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed #e2e8f0", paddingBottom: "2px" }}>
                    <span style={{ color: "#475569", fontWeight: "700" }}>رقم الإشعار:</span>
                    <span style={{ fontWeight: "900", color: "#dc2626", fontFamily: "monospace", fontSize: "11.5px" }}>#RET-{data.returnNumber}</span>
                  </div>
                  {data.transferOutNumber && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed #e2e8f0", padding: "2px 0" }}>
                      <span style={{ color: "#475569", fontWeight: "700" }}>إذن تحويل:</span>
                      <span style={{ fontWeight: "800", color: "#2563eb", fontFamily: "monospace", fontSize: "10.5px" }}>TR-{data.transferOutNumber}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed #e2e8f0", padding: "2px 0" }}>
                    <span style={{ color: "#475569", fontWeight: "700" }}>تاريخ التسليم:</span>
                    <span style={{ fontWeight: "700", color: "#0f172a", fontSize: "9px" }}>{arabicDate}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "2px" }}>
                    <span style={{ color: "#475569", fontWeight: "700" }}>الصفحة / الفرع:</span>
                    <span style={{ fontWeight: "800", color: "#0f172a" }}>صفحة {pageIndex + 1} من {totalPages} • {branchDetails.tag}</span>
                  </div>
                </div>
              </div>

              {/* 2. OPERATIONAL NOTICE (Always on Page 1) */}
              {isFirstPage && (
                <div style={{ backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe', borderRight: '4px solid #2563eb', borderRadius: '6px', padding: '6px 10px' }}>
                  <p style={{ margin: 0, fontSize: '10px', color: '#1e3a8a', lineHeight: 1.45, fontWeight: '700' }}>
                    <span style={{ color: '#2563eb', marginLeft: '6px', fontSize: '11px' }}>✦</span>
                    إشعار تسليم رسمي: البضاعة الموضحة بهذا الكشف تم فحصها وإخراجها وتسليمها إلى مندوب الشركة الموردة ({data.agentName || "المندوب المعتمد"}) بقيمة إجمالية {(totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م، وتعتبر هذه الوثيقة إشعاراً رسمياً لإتمام المقاصة المحاسبية وإبراء ذمة الفرع من عهدتها
                    {voucherRef ? ` (تمت المقاصة والخصم بموجب سند الصرف رقم ${voucherRef}).` : "."}
                  </p>
                </div>
              )}

              {/* 3. SUPPLIER & FINANCIAL TERMS GRID (Only on Page 1) */}
              {isFirstPage && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {/* Box 1: Supplier & Agent */}
                  <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "6px", overflow: "hidden", background: "#f8fafc" }}>
                    <div style={{ background: "#0f172a", color: "#fff", fontSize: "9.5px", fontWeight: "bold", padding: "4px 8px", display: "flex", justifyContent: "space-between" }}>
                      <span>أولاً: بيانات الشركة الموردة والمندوب المستلم</span>
                      <span style={{ fontSize: "8.5px", opacity: 0.85 }}>بيانات معتمدة</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px" }}>
                      <tbody>
                        <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "4px 8px", fontWeight: "bold", color: "#475569", width: "34%" }}>الشركة / المورد:</td>
                          <td style={{ padding: "4px 8px", fontWeight: "900", color: "#0f172a", fontSize: "11px" }}>{data.supplier}</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "4px 8px", fontWeight: "bold", color: "#475569" }}>مندوب الاستلام:</td>
                          <td style={{ padding: "4px 8px", fontWeight: "800", color: "#0f172a", fontSize: "10.5px" }}>{data.agentName || "المندوب المعتمد"}</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "4px 8px", fontWeight: "bold", color: "#475569" }}>هاتف المندوب:</td>
                          <td style={{ padding: "4px 8px", fontWeight: "800", color: "#0f172a", fontFamily: "monospace", fontSize: "10.5px" }} dir="ltr">{data.agentMobile || "—"}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: "4px 8px", fontWeight: "bold", color: "#475569" }}>الرقم القومي:</td>
                          <td style={{ padding: "4px 8px" }}>
                            <div style={{ display: "flex", gap: "2px", direction: "ltr", alignItems: "center" }}>
                              {nidChars.map((ch, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "13px",
                                    height: "17px",
                                    border: "1px solid #0f172a",
                                    borderRadius: "2px",
                                    fontSize: "9.5px",
                                    fontWeight: "900",
                                    background: ch.trim() ? "#ffffff" : "#f1f5f9",
                                    color: "#0f172a",
                                    fontFamily: "monospace"
                                  }}
                                >
                                  {ch.trim() || "-"}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Box 2: Financial Terms */}
                  <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "6px", overflow: "hidden", background: "#f8fafc" }}>
                    <div style={{ background: "#0f172a", color: "#fff", fontSize: "9.5px", fontWeight: "bold", padding: "4px 8px", display: "flex", justifyContent: "space-between" }}>
                      <span>ثانياً: المعاملة المالية وطريقة التسوية</span>
                      <span style={{ fontSize: "8.5px", opacity: 0.85 }}>المقاصة والحسابات</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px" }}>
                      <tbody>
                        <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "4px 8px", fontWeight: "bold", color: "#475569", width: "34%" }}>طريقة التسوية:</td>
                          <td style={{ padding: "4px 8px", fontWeight: "800", color: "#0f172a", fontSize: "10px" }}>
                            {voucherRef ? `مقاصة وخصم مباشر من سند صرف (${voucherRef})` : (data.settlementMethod === 'money' ? "تسوية مالية (نقداً من الخزينة / تحويل)" : "استبدال بضاعة (تسوية عينية)")}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "4px 8px", fontWeight: "bold", color: "#475569" }}>توقيت السداد:</td>
                          <td style={{ padding: "4px 8px", fontWeight: "800", color: "#0f172a", fontSize: "10px" }}>
                            {data.paymentTiming === 'now' || voucherRef
                              ? "سداد فوري ومقاصة عند الاستلام (تم الخصم)" 
                              : `سداد آجل (تاريخ الاستحقاق: ${data.expectedPaymentDate ? formatArabicFullDate(data.expectedPaymentDate) : "مؤجل"})`}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "4px 8px", fontWeight: "bold", color: "#475569" }}>حالة المقاصة:</td>
                          <td style={{ padding: "4px 8px" }}>
                            <span style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "3px",
                              fontSize: "9px",
                              fontWeight: "900",
                              background: (data.isSettled || voucherRef) ? "#dcfce7" : "#fef3c7",
                              color: (data.isSettled || voucherRef) ? "#166534" : "#92400e"
                            }}>
                              {(data.isSettled || voucherRef) ? "✓ تمت التسوية والمقاصة بالكامل (مغلق)" : "⏱ قيد المتابعة والتحصيل"}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: "4px 8px", fontWeight: "bold", color: "#475569" }}>إجمالي القيمة:</td>
                          <td style={{ padding: "4px 8px" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                              <span style={{ fontSize: "15px", fontWeight: "900", color: "#0f172a" }}>
                                {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span style={{ fontSize: "10px", fontWeight: "bold", color: "#475569" }}>جنيه مصري</span>
                            </div>
                            <div style={{ fontSize: "8.5px", fontWeight: "bold", color: "#047857", marginTop: "1px" }}>
                              فقط وقدره {totalAmountWords} لا غير.
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* MIDDLE CONTAINER: Items Table / Transfer Note */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1.5px solid #cbd5e1", borderRadius: "6px", overflow: "hidden", margin: "6px 0" }}>
              <div style={{ background: "#0f172a", color: "#fff", fontSize: "9.5px", fontWeight: "bold", padding: "5px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  {isFirstPage ? "ثالثاً: تفاصيل وبيان الأصناف المرتجعة" : `تابع تفاصيل الأصناف المرتجعة (صفحة ${pageIndex + 1} من ${totalPages})`}
                </span>
                {data.transferOutNumber && (
                  <span style={{ fontSize: "9px", background: "#1e3a8a", padding: "1px 6px", borderRadius: "3px", color: "#93c5fd", fontWeight: "bold" }}>
                    إذن خروج: TR-{data.transferOutNumber}
                  </span>
                )}
              </div>

              {isGenericTransfer ? (
                <div style={{ padding: "16px", background: "#f8fafc", textAlign: "center", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "8px" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#dcfce7", border: "1px solid #86efac", color: "#166534", padding: "6px 14px", borderRadius: "6px", fontWeight: "900", fontSize: "12px" }}>
                    <span>✓</span>
                    <span>مطابق لمستند التحويل الخارجي رقم: {data.transferOutNumber ? `(TR-${data.transferOutNumber})` : "المرفق"}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "10.5px", color: "#334155", fontWeight: "700", maxWidth: "85%", lineHeight: 1.5 }}>
                    تم تسليم كامل محتويات ومشمول إذن التحويل الخارجي الصادر من الفرع إلى مندوب الشركة الموردة بعد الفحص والمطابقة التامة بحالة سليمة وبحضور الأطراف المعنية.
                  </p>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap", marginTop: "2px" }}>
                    <span style={{ fontSize: "9px", fontWeight: "800", color: "#475569", background: "#e2e8f0", padding: "2px 8px", borderRadius: "3px" }}>
                      ✓ حالة الأصناف: فحص ومطابقة 100% بحالة جيدة
                    </span>
                    <span style={{ fontSize: "9px", fontWeight: "800", color: "#475569", background: "#e2e8f0", padding: "2px 8px", borderRadius: "3px" }}>
                      ✓ إذن التحويل: مستند خروج معتمد ومرفق بالأصل
                    </span>
                    <span style={{ fontSize: "9px", fontWeight: "800", color: "#475569", background: "#e2e8f0", padding: "2px 8px", borderRadius: "3px" }}>
                      ✓ إخلاء الطرف: إبراء ذمة الفرع وسريان مسؤولية المورد
                    </span>
                  </div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", flex: 1 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1.5px solid #cbd5e1" }}>
                      <th style={{ padding: "5px 6px", textAlign: "center", width: "32px", borderLeft: "1px solid #cbd5e1" }}>م</th>
                      <th style={{ padding: "5px 8px", textAlign: "center", width: "120px", borderLeft: "1px solid #cbd5e1" }}>باركود الصنف</th>
                      <th style={{ padding: "5px 8px", textAlign: "right", borderLeft: "1px solid #cbd5e1" }}>اسم وبيان الصنف</th>
                      <th style={{ padding: "5px 8px", textAlign: "center", width: "70px" }}>الكمية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunk.map((it: any, idx: number) => {
                      const itemNumber = startItemIndex + idx + 1;
                      return (
                        <tr key={it.id || idx} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                          <td style={{ padding: "4.5px 6px", textAlign: "center", fontWeight: "bold", color: "#64748b", borderLeft: "1px solid #e2e8f0" }}>{itemNumber}</td>
                          <td style={{ padding: "4.5px 8px", textAlign: "center", fontWeight: "700", fontFamily: "monospace", color: "#334155", borderLeft: "1px solid #e2e8f0" }}>{it.barcode || "—"}</td>
                          <td style={{ padding: "4.5px 8px", fontWeight: "bold", color: "#0f172a", borderLeft: "1px solid #e2e8f0" }}>{it.itemName || it.description || it.name || "صنف مرتجع"}</td>
                          <td style={{ padding: "4.5px 8px", textAlign: "center", fontWeight: "900", color: "#0f172a" }}>{it.quantity || 1}</td>
                        </tr>
                      );
                    })}

                    {/* Table Summary Row */}
                    {isLastPage ? (
                      <tr style={{ background: "#e2e8f0", borderTop: "2px solid #0f172a" }}>
                        <td colSpan={3} style={{ padding: "5px 10px", textAlign: "right", fontWeight: "900", color: "#0f172a", borderLeft: "1px solid #cbd5e1" }}>
                          إجمالي عدد القطع والوحدات المرتجعة بالكشف:
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: "900", fontSize: "10.5px", color: "#0f172a" }}>
                          {totalQty} قطعة
                        </td>
                      </tr>
                    ) : (
                      <tr style={{ background: "#eff6ff", borderTop: "1.5px solid #93c5fd" }}>
                        <td colSpan={4} style={{ padding: "5px 10px", textAlign: "center", fontWeight: "800", color: "#1e3a8a", fontSize: "9px" }}>
                          يتبع باقي تفاصيل الأصناف والتوقيعات الرسمية في الصفحة رقم ({pageIndex + 2}) ...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* BOTTOM CONTAINER: Legal Declaration, Signatures & Audit Footer (Only on Last Page) */}
            {isLastPage ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {/* 5. LEGAL DECLARATION */}
                <div style={{ border: "1.5px solid #0f172a", borderRadius: "6px", padding: "6px 10px", background: "#f8fafc" }}>
                  <div style={{ fontSize: "10px", fontWeight: "900", color: "#0f172a", marginBottom: "2px" }}>
                    رابعاً: إقرار الاستلام الرسمي وإخلاء مسؤولية إدارة الفرع
                  </div>
                  <p style={{ margin: 0, fontSize: "9px", lineHeight: "1.45", color: "#1e293b", textAlign: "justify", fontWeight: "600" }}>
                    أقر أنا الموقع أدناه مندوب شركة ({data.supplier})، وبموجب هويتي ورقمي القومي المبينين أعلاه، بأنني قد عاينت واستلمت البضاعة الموضحة بهذا الإشعار بكامل كمياتها وبحالة سليمة ومطابقة لما تم الاتفاق عليه، وبذلك أصبحت البضاعة في عهدتي وتحت مسؤولية الشركة الموردة، وتعتبر ذمة فرع سيركل كيه ({branchDetails.companyName}) بريئة تماماً من عهدة هذه الأصناف اعتباراً من تاريخه وساعته، مع التزام الشركة الموردة بإتمام إجراءات التسوية المالية المقررة.
                  </p>
                </div>

                {/* 6. SIGNATURES & SEALS (3 Equal Columns) */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.2fr", gap: "8px", alignItems: "stretch" }}>
                  {/* Supplier Agent */}
                  <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "6px", padding: "6px 8px", background: "#fff", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "75px" }}>
                    <div>
                      <div style={{ fontSize: "9.5px", fontWeight: "bold", color: "#475569" }}>المستلم (مندوب الشركة الموردة)</div>
                      <div style={{ fontSize: "11px", fontWeight: "900", color: "#0f172a", marginTop: "1px" }}>{data.agentName || "المندوب المعتمد"}</div>
                      <div style={{ fontSize: "8.5px", color: "#64748b", marginTop: "1px" }}>الرقم القومي: {data.agentNationalId || "مرفق بالأصل"}</div>
                    </div>
                    <div>
                      <div style={{ borderBottom: "1.5px dashed #94a3b8", height: "24px", margin: "2px 6px" }} />
                      <div style={{ fontSize: "8.5px", color: "#94a3b8" }}>التوقيع والاستلام / التاريخ</div>
                    </div>
                  </div>

                  {/* Official Stamp */}
                  <div style={{ border: "2px dashed #0f172a", borderRadius: "6px", padding: "6px", background: "#f8fafc", textAlign: "center", minHeight: "75px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative" }}>
                    <div style={{ width: "50px", height: "50px", border: "1px dashed #cbd5e1", borderRadius: "50%", position: "absolute", opacity: 0.35 }} />
                    <div style={{ fontSize: "10px", fontWeight: "900", color: "#0f172a", textTransform: "uppercase", zIndex: 1 }}>خاتم الفرع المعتمد</div>
                    <div style={{ fontSize: "8px", color: "#64748b", marginTop: "1px", zIndex: 1 }}>Official Branch Stamp</div>
                    <div style={{ fontSize: "7.5px", color: "#94a3b8", marginTop: "2px", zIndex: 1 }}>لا يعتمد الإيصال إلا بالختم الرسمي</div>
                  </div>

                  {/* Branch Manager */}
                  <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "6px", padding: "6px 8px", background: "#fff", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "75px" }}>
                    <div>
                      <div style={{ fontSize: "9.5px", fontWeight: "bold", color: "#475569" }}>المُسلِّم (إدارة الفرع / أمين المخزن)</div>
                      <div style={{ fontSize: "11px", fontWeight: "900", color: "#0f172a", marginTop: "1px" }}>{data.items?.[0]?.createdBy || "مدير الفرع"}</div>
                      <div style={{ fontSize: "8.5px", color: "#64748b", marginTop: "1px" }}>الصفة: مدير الفرع / أمين العهدة</div>
                    </div>
                    <div>
                      <div style={{ borderBottom: "1.5px dashed #94a3b8", height: "24px", margin: "2px 6px" }} />
                      <div style={{ fontSize: "8.5px", color: "#94a3b8" }}>التوقيع والاعتماد / التاريخ</div>
                    </div>
                  </div>
                </div>

                {/* 7. AUDIT FOOTER */}
                <div style={{ borderTop: "1.5px solid #0f172a", paddingTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "8px", color: "#475569" }}>
                  <div>وثيقة إشعار مرتجع بضاعة رسمية للمورد (RTV) • معتمدة قانونياً ومحاسبياً</div>
                  <div>كود: RET-{data.returnNumber} | تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</div>
                  <div>صفحة {pageIndex + 1} من {totalPages} • ANH Circle K Egypt</div>
                </div>
              </div>
            ) : (
              /* Intermediate Page Footer */
              <div style={{ borderTop: "1.5px solid #0f172a", paddingTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "8px", color: "#475569" }}>
                <div>إشعار مرتجع بضاعة رسمي للمورد (RTV) • مستند محاسبي وقانوني</div>
                <div>كود: RET-{data.returnNumber} | تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</div>
                <div>صفحة {pageIndex + 1} من {totalPages} • ANH Circle K Egypt</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
