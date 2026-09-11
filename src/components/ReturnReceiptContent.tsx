import React from "react";

export function numberToArabicWords(num: number): string {
  num = Math.floor(Math.abs(num));
  if (num === 0) return "صفر";

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

  const thousands = Math.floor(num / 1000);
  const remainder = Math.round(num % 1000);

  let result = "";

  if (thousands > 0) {
    if (thousands === 1) result += "ألف";
    else if (thousands === 2) result += "ألفان";
    else if (thousands >= 3 && thousands <= 10) result += getBelow100(thousands) + " آلاف";
    else result += getBelow1000(thousands) + " ألف";
  }

  if (remainder > 0) {
    if (result !== "") result += " و";
    result += getBelow1000(remainder);
  }

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
      branchName: "فرع سيركل كيه (أولا القرنفل - التجمع الخامس)",
      cr: "216727",
      tax: "756-563-844",
      tag: "أولا القرنفل"
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

export function ReturnReceiptContent({ data, currentBranch }: { data: ReturnReceiptData | any; currentBranch?: string }) {
  if (!data) return null;
  const branchDetails = getReturnBranchDetails(data.branchId || data.storeId, undefined, currentBranch);
  const arabicDate = formatArabicFullDate(data.returnedAt || data.date);
  const totalAmount = Number(data.totalPrice || 0);
  const totalAmountWords = numberToArabicWords(totalAmount);
  const nidChars = String(data.agentNationalId || "").replace(/\D/g, "").slice(0, 14).padEnd(14, " ").split("");
  const totalQty = Array.isArray(data.items) 
    ? data.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0)
    : 0;
  const isGenericTransfer = (data.items?.length === 1 && (data.items[0].barcode === "N/A" || !data.items[0].barcode)) || (!data.items || data.items.length === 0);
  const voucherRef = data.settledByVoucher || data.paymentVoucherNumber;

  return (
    <div
      className="rtv-content-root"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        minHeight: "274mm",
        height: "100%",
        color: "#0f172a",
        boxSizing: "border-box",
        gap: "10px"
      }}
      dir="rtl"
    >
      {/* 1. OFFICIAL CORPORATE HEADER */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 2fr 1.3fr", gap: "10px", alignItems: "center", borderBottom: "2.5px solid #0f172a", paddingBottom: "10px" }}>
        {/* Right: Company Identity */}
        <div style={{ textAlign: "right", fontSize: "11px", lineHeight: "1.45", color: "#1e293b" }}>
          <div style={{ fontWeight: "900", fontSize: "14.5px", color: "#0f172a" }}>{branchDetails.companyName}</div>
          <div style={{ fontSize: "12px", fontWeight: "800", color: "#dc2626", marginTop: "2px" }}>{branchDetails.brandName}</div>
          <div style={{ fontSize: "10px", fontFamily: "monospace", marginTop: "3px", color: "#334155" }}>س.ت: {branchDetails.cr} | ب.ض: {branchDetails.tax}</div>
          <div style={{ fontSize: "9.5px", color: "#64748b", marginTop: "2px" }}>إدارة سلاسل الإمداد والمخازن • قسم مرتجعات الموردين (RTV)</div>
        </div>

        {/* Center: Title Badge */}
        <div style={{ textAlign: "center" }}>
          <div style={{ border: "2.5px solid #0f172a", borderRadius: "10px", padding: "8px 14px", background: "#f8fafc", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "15.5px", fontWeight: "900", color: "#0f172a", letterSpacing: "0.5px" }}>
              إشعار مرتجع بضاعة رسمي للمورد
            </div>
            <div style={{ fontSize: "12px", fontWeight: "800", color: "#dc2626", marginTop: "3px" }}>
              محضر تسليم مرتجعات وإخلاء طرف المخازن (RTV Manifest)
            </div>
            <div style={{ fontSize: "9.5px", color: "#475569", marginTop: "2px" }}>
              وثيقة تسليم ومقاصة مالية رسمية معتمدة
            </div>
          </div>
        </div>

        {/* Left: Metadata */}
        <div style={{ textAlign: "left", fontSize: "10.5px", lineHeight: "1.6", color: "#1e293b" }} dir="rtl">
          <div><strong>رقم الإشعار:</strong> <span style={{ fontWeight: "900", color: "#dc2626", fontSize: "12.5px", fontFamily: "monospace" }}>#RET-{data.returnNumber}</span></div>
          {data.transferOutNumber && (
            <div><strong>إذن تحويل خارجي:</strong> <span style={{ fontWeight: "800", color: "#2563eb", fontFamily: "monospace", fontSize: "11.5px" }}>TR-{data.transferOutNumber}</span></div>
          )}
          <div><strong>تاريخ التسليم:</strong> <span style={{ fontSize: "10.5px", fontWeight: "600" }}>{arabicDate}</span></div>
          <div><strong>الفرع المصدر:</strong> <span style={{ fontWeight: "800" }}>{branchDetails.tag}</span></div>
        </div>
      </div>

      {/* 2. OPERATIONAL NOTICE */}
      <div style={{ backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe', borderRight: '5px solid #2563eb', borderRadius: '8px', padding: '9px 14px' }}>
        <p style={{ margin: 0, fontSize: '11px', color: '#1e3a8a', lineHeight: 1.5, fontWeight: '700' }}>
          <span style={{ color: '#2563eb', marginLeft: '6px', fontSize: '12px' }}>✦</span>
          إشعار تسليم رسمي: البضاعة الموضحة بهذا الكشف تم فحصها وإخراجها وتسليمها إلى مندوب الشركة الموردة ({data.agentName || "المندوب المعتمد"}) بقيمة إجمالية {(totalAmount || 0).toLocaleString()} ج.م، وتعتبر هذه الوثيقة إشعاراً رسمياً لإتمام المقاصة المحاسبية وإبراء ذمة الفرع من عهدتها
          {voucherRef ? ` (تمت المقاصة والخصم بموجب سند الصرف رقم ${voucherRef}).` : "."}
        </p>
      </div>

      {/* 3. SUPPLIER & SETTLEMENT GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {/* Box 1: Supplier & Agent */}
        <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "8px", overflow: "hidden", background: "#f8fafc" }}>
          <div style={{ background: "#0f172a", color: "#fff", fontSize: "10.5px", fontWeight: "bold", padding: "6px 12px", display: "flex", justifyContent: "space-between" }}>
            <span>أولاً: بيانات الشركة الموردة والمندوب المستلم</span>
            <span style={{ fontSize: "9px", opacity: 0.85 }}>بيانات معتمدة</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5px", background: "#f8fafc" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "7px 12px", fontWeight: "bold", color: "#475569", width: "35%" }}>الشركة / المورد:</td>
                <td style={{ padding: "7px 12px", fontWeight: "900", color: "#0f172a", fontSize: "12.5px" }}>{data.supplier}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "7px 12px", fontWeight: "bold", color: "#475569" }}>مندوب الاستلام:</td>
                <td style={{ padding: "7px 12px", fontWeight: "800", color: "#0f172a", fontSize: "11.5px" }}>{data.agentName}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "7px 12px", fontWeight: "bold", color: "#475569" }}>هاتف المندوب:</td>
                <td style={{ padding: "7px 12px", fontWeight: "800", color: "#0f172a", fontFamily: "monospace", fontSize: "11.5px" }} dir="ltr">{data.agentMobile || "—"}</td>
              </tr>
              <tr>
                <td style={{ padding: "7px 12px", fontWeight: "bold", color: "#475569" }}>الرقم القومي:</td>
                <td style={{ padding: "7px 12px" }}>
                  <div style={{ display: "flex", gap: "2px", direction: "ltr", justifyContent: "flex-end" }}>
                    {nidChars.map((ch, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "17px",
                          height: "21px",
                          border: "1.5px solid #0f172a",
                          borderRadius: "3px",
                          fontSize: "11.5px",
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

        {/* Box 2: Financial & Settlement Terms */}
        <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "8px", overflow: "hidden", background: "#f8fafc" }}>
          <div style={{ background: "#0f172a", color: "#fff", fontSize: "10.5px", fontWeight: "bold", padding: "6px 12px", display: "flex", justifyContent: "space-between" }}>
            <span>ثانياً: المعاملة المالية وطريقة التسوية</span>
            <span style={{ fontSize: "9px", opacity: 0.85 }}>المقاصة والحسابات</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5px", background: "#f8fafc" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "7px 12px", fontWeight: "bold", color: "#475569", width: "35%" }}>طريقة التسوية:</td>
                <td style={{ padding: "7px 12px", fontWeight: "800", color: "#0f172a", fontSize: "11px" }}>
                  {voucherRef ? `مقاصة وخصم مباشر من سند صرف (${voucherRef})` : (data.settlementMethod === 'money' ? "تسوية مالية (نقداً من الخزينة / تحويل)" : "استبدال بضاعة (تسوية عينية)")}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "7px 12px", fontWeight: "bold", color: "#475569" }}>توقيت السداد:</td>
                <td style={{ padding: "7px 12px", fontWeight: "800", color: "#0f172a", fontSize: "11px" }}>
                  {data.paymentTiming === 'now' || voucherRef
                    ? "سداد فوري ومقاصة عند الاستلام (تم الخصم)" 
                    : `سداد آجل (تاريخ الاستحقاق: ${data.expectedPaymentDate ? formatArabicFullDate(data.expectedPaymentDate) : "مؤجل"})`}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "7px 12px", fontWeight: "bold", color: "#475569" }}>حالة المقاصة:</td>
                <td style={{ padding: "7px 12px" }}>
                  <span style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: "900",
                    background: (data.isSettled || voucherRef) ? "#dcfce7" : "#fef3c7",
                    color: (data.isSettled || voucherRef) ? "#166534" : "#92400e"
                  }}>
                    {(data.isSettled || voucherRef) ? "تمت التسوية والمقاصة بالكامل (مغلق)" : "قيد المتابعة والتحصيل"}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "7px 12px", fontWeight: "bold", color: "#475569" }}>إجمالي القيمة:</td>
                <td style={{ padding: "7px 12px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                    <span style={{ fontSize: "17px", fontWeight: "900", color: "#0f172a" }}>{totalAmount.toLocaleString()}</span>
                    <span style={{ fontSize: "11px", fontWeight: "bold", color: "#475569" }}>جنيه مصري</span>
                  </div>
                  <div style={{ fontSize: "9.5px", fontWeight: "bold", color: "#047857", marginTop: "2px" }}>
                    فقط وقدره {totalAmountWords} جنيهاً مصرياً لا غير.
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. ITEMS TABLE OR TRANSFER CONFIRMATION */}
      <div className="rtv-items-box" style={{ border: "1.5px solid #cbd5e1", borderRadius: "8px", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#0f172a", color: "#fff", fontSize: "10.5px", fontWeight: "bold", padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>ثالثاً: تفاصيل وبيان الأصناف المرتجعة</span>
          {data.transferOutNumber && (
            <span style={{ fontSize: "9.5px", background: "#1e3a8a", padding: "2px 8px", borderRadius: "4px", color: "#93c5fd", fontWeight: "bold" }}>
              إذن خروج: TR-{data.transferOutNumber}
            </span>
          )}
        </div>

        {isGenericTransfer ? (
          <div style={{ padding: "24px 20px", background: "#f8fafc", textAlign: "center", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#dcfce7", border: "1px solid #86efac", color: "#166534", padding: "8px 18px", borderRadius: "8px", fontWeight: "900", fontSize: "13px" }}>
              <span>✓</span>
              <span>مطابق لمستند التحويل الخارجي رقم: {data.transferOutNumber ? `(TR-${data.transferOutNumber})` : "المرفق"}</span>
            </div>
            <p style={{ margin: 0, fontSize: "11.5px", color: "#334155", fontWeight: "700", maxWidth: "85%", lineHeight: 1.65 }}>
              تم تسليم كامل محتويات ومشمول إذن التحويل الخارجي الصادر من الفرع إلى مندوب الشركة الموردة بعد الفحص والمطابقة التامة بحالة سليمة وبحضور الأطراف المعنية.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "4px" }}>
              <span style={{ fontSize: "10px", fontWeight: "800", color: "#475569", background: "#e2e8f0", padding: "3px 10px", borderRadius: "4px" }}>
                ✓ حالة الأصناف: فحص ومطابقة 100% بحالة جيدة
              </span>
              <span style={{ fontSize: "10px", fontWeight: "800", color: "#475569", background: "#e2e8f0", padding: "3px 10px", borderRadius: "4px" }}>
                ✓ إذن التحويل: مستند خروج معتمد ومرفق بالأصل
              </span>
              <span style={{ fontSize: "10px", fontWeight: "800", color: "#475569", background: "#e2e8f0", padding: "3px 10px", borderRadius: "4px" }}>
                ✓ إخلاء الطرف: إبراء ذمة الفرع وسريان مسؤولية المورد
              </span>
            </div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", flex: 1 }}>
            <thead>
              <tr style={{ background: "#f1f5f9", borderBottom: "1.5px solid #cbd5e1" }}>
                <th style={{ padding: "6px 8px", textAlign: "center", width: "36px", borderLeft: "1px solid #cbd5e1" }}>م</th>
                <th style={{ padding: "6px 10px", textAlign: "right", width: "130px", borderLeft: "1px solid #cbd5e1" }}>باركود الصنف</th>
                <th style={{ padding: "6px 10px", textAlign: "right", borderLeft: "1px solid #cbd5e1" }}>اسم وبيان الصنف</th>
                <th style={{ padding: "6px 10px", textAlign: "center", width: "75px" }}>الكمية</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it: any, idx: number) => (
                <tr key={it.id || idx} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: "bold", color: "#64748b", borderLeft: "1px solid #e2e8f0" }}>{idx + 1}</td>
                  <td style={{ padding: "6px 10px", fontWeight: "700", fontFamily: "monospace", color: "#334155", borderLeft: "1px solid #e2e8f0" }}>{it.barcode || "—"}</td>
                  <td style={{ padding: "6px 10px", fontWeight: "bold", color: "#0f172a", borderLeft: "1px solid #e2e8f0" }}>{it.itemName || it.description || it.name || "صنف مرتجع"}</td>
                  <td style={{ padding: "6px 10px", textAlign: "center", fontWeight: "900", color: "#0f172a" }}>{it.quantity || 1}</td>
                </tr>
              ))}
              <tr style={{ background: "#e2e8f0", borderTop: "2px solid #0f172a" }}>
                <td colSpan={3} style={{ padding: "7px 12px", textAlign: "right", fontWeight: "900", color: "#0f172a", borderLeft: "1px solid #cbd5e1" }}>
                  إجمالي عدد القطع والوحدات المرتجعة:
                </td>
                <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: "900", fontSize: "11.5px", color: "#0f172a" }}>
                  {totalQty} قطعة
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* 5. LEGAL DECLARATION & CLEARANCE */}
      <div style={{ border: "1.5px solid #0f172a", borderRadius: "8px", padding: "9px 14px", background: "#f8fafc" }}>
        <div style={{ fontSize: "11px", fontWeight: "900", color: "#0f172a", marginBottom: "3px" }}>
          رابعاً: إقرار الاستلام الرسمي وإخلاء مسؤولية إدارة الفرع
        </div>
        <p style={{ margin: 0, fontSize: "10px", lineHeight: "1.6", color: "#1e293b", textAlign: "justify", fontWeight: "500" }}>
          أقر أنا الموقع أدناه مندوب شركة ({data.supplier})، وبموجب هويتي ورقمي القومي المبينين أعلاه، بأنني قد عاينت واستلمت البضاعة الموضحة بهذا الإشعار بكامل كمياتها وبحالة سليمة ومطابقة لما تم الاتفاق عليه، وبذلك أصبحت البضاعة في عهدتي وتحت مسؤولية الشركة الموردة، وتعتبر ذمة فرع سيركل كيه ({branchDetails.companyName}) بريئة تماماً من عهدة هذه الأصناف اعتباراً من تاريخه وساعته، مع التزام الشركة الموردة بإتمام إجراءات التسوية المالية المقررة.
        </p>
      </div>

      {/* 6. SIGNATURES & SEALS */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.1fr 1.3fr", gap: "10px", alignItems: "stretch", marginTop: "2px" }}>
        {/* 1. Supplier Agent Signature */}
        <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "10px 12px", background: "#fff", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "100px" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: "bold", color: "#475569", marginBottom: "2px" }}>المستلم (مندوب الشركة الموردة)</div>
            <div style={{ fontSize: "12px", fontWeight: "900", color: "#0f172a" }}>{data.agentName || "المندوب المعتمد"}</div>
            <div style={{ fontSize: "9px", color: "#64748b", marginTop: "2px" }}>الرقم القومي: {data.agentNationalId || "مرفق"}</div>
          </div>
          <div>
            <div style={{ borderBottom: "1.5px dashed #94a3b8", height: "40px", margin: "4px 8px" }} />
            <div style={{ fontSize: "9px", color: "#94a3b8" }}>التوقيع والاستلام / التاريخ</div>
          </div>
        </div>

        {/* 2. Official Branch Stamp */}
        <div style={{ border: "2px dashed #0f172a", borderRadius: "8px", padding: "10px", background: "#f8fafc", textAlign: "center", minHeight: "100px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative" }}>
          <div style={{ width: "65px", height: "65px", border: "1px dashed #cbd5e1", borderRadius: "50%", position: "absolute", opacity: 0.4 }} />
          <div style={{ fontSize: "10.5px", fontWeight: "900", color: "#0f172a", textTransform: "uppercase", zIndex: 1 }}>خاتم الفرع المعتمد</div>
          <div style={{ fontSize: "8.5px", color: "#64748b", marginTop: "2px", zIndex: 1 }}>Official Branch Stamp</div>
          <div style={{ fontSize: "8px", color: "#94a3b8", marginTop: "4px", zIndex: 1 }}>لا يعتمد الإيصال إلا بالختم الرسمي</div>
        </div>

        {/* 3. Store Manager / Dispatcher Signature */}
        <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "10px 12px", background: "#fff", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "100px" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: "bold", color: "#475569", marginBottom: "2px" }}>المُسلِّم (إدارة الفرع / أمين المخزن)</div>
            <div style={{ fontSize: "12px", fontWeight: "900", color: "#0f172a" }}>{data.items?.[0]?.createdBy || "مدير الفرع"}</div>
            <div style={{ fontSize: "9px", color: "#64748b", marginTop: "2px" }}>الصفة: مدير الفرع / أمين العهدة</div>
          </div>
          <div>
            <div style={{ borderBottom: "1.5px dashed #94a3b8", height: "40px", margin: "4px 8px" }} />
            <div style={{ fontSize: "9px", color: "#94a3b8" }}>التوقيع والاعتماد / التاريخ</div>
          </div>
        </div>
      </div>

      {/* 7. AUDIT FOOTER */}
      <div style={{ borderTop: "1.5px solid #0f172a", paddingTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "8.5px", color: "#475569" }}>
        <div>وثيقة إشعار مرتجع بضاعة رسمية للمورد (RTV) • معتمدة قانونياً ومحاسبياً</div>
        <div>كود الوثيقة: RET-{data.returnNumber} | تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</div>
        <div>منظومة التقارير المالية والإدارية الموحدة • ANH Circle K</div>
      </div>
    </div>
  );
}
