"use client";

import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { Truck, CheckCircle, Search, Calendar, FileText, ArrowLeft, Printer, AlertTriangle, Edit, Trash2, Plus, X } from "lucide-react";
import Link from "next/link";
import { PageTransition } from "@/components/PageTransition";

function numberToArabicWords(num: number): string {
  if (!num || num === 0) return "صفر";
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

function formatArabicFullDate(dString?: string | Date) {
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

function getReturnBranchDetails(storeId?: string, branchId?: string, currentBranch?: string) {
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

function ReturnReceiptContent({ data, currentBranch }: { data: any; currentBranch?: string }) {
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px", width: "100%", color: "#0f172a", boxSizing: "border-box" }} dir="rtl">
      {/* 1. OFFICIAL CORPORATE HEADER */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 2fr 1.3fr", gap: "8px", alignItems: "center", borderBottom: "2.5px solid #0f172a", paddingBottom: "5px" }}>
        {/* Right: Company Identity */}
        <div style={{ textAlign: "right", fontSize: "10px", lineHeight: "1.4", color: "#1e293b" }}>
          <div style={{ fontWeight: "900", fontSize: "12px", color: "#0f172a" }}>{branchDetails.companyName}</div>
          <div style={{ fontSize: "9.5px", fontWeight: "800", color: "#dc2626", marginTop: "1px" }}>{branchDetails.brandName}</div>
          <div style={{ fontSize: "8.5px", fontFamily: "monospace", marginTop: "2px", color: "#475569" }}>س.ت: {branchDetails.cr} | ب.ض: {branchDetails.tax}</div>
          <div style={{ fontSize: "8px", color: "#64748b" }}>إدارة سلاسل الإمداد والمخازن • قسم مرتجعات الموردين (RTV)</div>
        </div>

        {/* Center: Title Badge */}
        <div style={{ textAlign: "center" }}>
          <div style={{ border: "2px solid #0f172a", borderRadius: "8px", padding: "4px 10px", background: "#f8fafc" }}>
            <div style={{ fontSize: "13px", fontWeight: "900", color: "#0f172a", letterSpacing: "0.3px" }}>
              إشعار مرتجع بضاعة رسمي للمورد
            </div>
            <div style={{ fontSize: "10px", fontWeight: "bold", color: "#dc2626", marginTop: "1px" }}>
              محضر تسليم مرتجعات وإخلاء طرف المخازن (RTV Manifest)
            </div>
            <div style={{ fontSize: "8px", color: "#475569", marginTop: "1px" }}>
              وثيقة تسليم ومقاصة مالية رسمية معتمدة
            </div>
          </div>
        </div>

        {/* Left: Metadata */}
        <div style={{ textAlign: "left", fontSize: "9px", lineHeight: "1.5", color: "#1e293b" }} dir="rtl">
          <div><strong>رقم الإشعار:</strong> <span style={{ fontWeight: "bold", color: "#dc2626", fontSize: "10.5px", fontFamily: "monospace" }}>#RET-{data.returnNumber}</span></div>
          {data.transferOutNumber && (
            <div><strong>إذن تحويل خارجي:</strong> <span style={{ fontWeight: "bold", color: "#2563eb", fontFamily: "monospace" }}>TR-{data.transferOutNumber}</span></div>
          )}
          <div><strong>تاريخ التسليم:</strong> <span style={{ fontSize: "8.5px" }}>{arabicDate}</span></div>
          <div><strong>الفرع المصدر:</strong> {branchDetails.tag}</div>
        </div>
      </div>

      {/* 2. OPERATIONAL NOTICE */}
      <div style={{ backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe', borderRight: '4px solid #2563eb', borderRadius: '6px', padding: '5px 8px' }}>
        <p style={{ margin: 0, fontSize: '9px', color: '#1e3a8a', lineHeight: 1.45, fontWeight: 'bold' }}>
          <span style={{ color: '#2563eb', marginLeft: '5px' }}>✦</span>
          إشعار تسليم رسمي: البضاعة الموضحة بهذا الكشف تم فحصها وإخراجها وتسليمها إلى مندوب الشركة الموردة ({data.agentName || "المندوب المعتمد"}) بقيمة إجمالية {(totalAmount || 0).toLocaleString()} ج.م، وتعتبر هذه الوثيقة إشعاراً رسمياً لإتمام المقاصة المحاسبية وإبراء ذمة الفرع من عهدتها.
        </p>
      </div>

      {/* 3. SUPPLIER & SETTLEMENT GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {/* Box 1: Supplier & Agent */}
        <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "7px", overflow: "hidden" }}>
          <div style={{ background: "#0f172a", color: "#fff", fontSize: "9px", fontWeight: "bold", padding: "3px 8px", display: "flex", justifyContent: "space-between" }}>
            <span>أولاً: بيانات الشركة الموردة والمندوب المستلم</span>
            <span style={{ fontSize: "8px", opacity: 0.85 }}>بيانات معتمدة</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", background: "#f8fafc" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "3.5px 8px", fontWeight: "bold", color: "#475569", width: "35%" }}>الشركة / المورد:</td>
                <td style={{ padding: "3.5px 8px", fontWeight: "900", color: "#0f172a", fontSize: "10.5px" }}>{data.supplier}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "3.5px 8px", fontWeight: "bold", color: "#475569" }}>مندوب الاستلام:</td>
                <td style={{ padding: "3.5px 8px", fontWeight: "bold", color: "#0f172a" }}>{data.agentName}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "3.5px 8px", fontWeight: "bold", color: "#475569" }}>هاتف المندوب:</td>
                <td style={{ padding: "3.5px 8px", fontWeight: "bold", color: "#0f172a", fontFamily: "monospace" }} dir="ltr">{data.agentMobile}</td>
              </tr>
              <tr>
                <td style={{ padding: "3.5px 8px", fontWeight: "bold", color: "#475569" }}>الرقم القومي:</td>
                <td style={{ padding: "3.5px 8px" }}>
                  <div style={{ display: "flex", gap: "2px", direction: "ltr", justifyContent: "flex-end" }}>
                    {nidChars.map((ch, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "14px",
                          height: "16px",
                          border: "1.2px solid #0f172a",
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

        {/* Box 2: Financial & Settlement Terms */}
        <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "7px", overflow: "hidden" }}>
          <div style={{ background: "#0f172a", color: "#fff", fontSize: "9px", fontWeight: "bold", padding: "3px 8px", display: "flex", justifyContent: "space-between" }}>
            <span>ثانياً: المعاملة المالية وطريقة التسوية</span>
            <span style={{ fontSize: "8px", opacity: 0.85 }}>المقاصة والحسابات</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", background: "#f8fafc" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "3.5px 8px", fontWeight: "bold", color: "#475569", width: "35%" }}>طريقة التسوية:</td>
                <td style={{ padding: "3.5px 8px", fontWeight: "bold", color: "#0f172a" }}>
                  {data.settlementMethod === 'money' ? "تسوية مالية (نقداً من الخزينة / تحويل)" : "استبدال بضاعة (تسوية عينية)"}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "3.5px 8px", fontWeight: "bold", color: "#475569" }}>توقيت السداد:</td>
                <td style={{ padding: "3.5px 8px", fontWeight: "bold", color: "#0f172a" }}>
                  {data.paymentTiming === 'now' 
                    ? "سداد فوري عند الاستلام (تم الصرف)" 
                    : `سداد آجل (تاريخ الاستحقاق: ${data.expectedPaymentDate ? formatArabicFullDate(data.expectedPaymentDate) : "مؤجل"})`}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "3.5px 8px", fontWeight: "bold", color: "#475569" }}>حالة المقاصة:</td>
                <td style={{ padding: "3.5px 8px" }}>
                  <span style={{
                    display: "inline-block",
                    padding: "1.5px 7px",
                    borderRadius: "4px",
                    fontSize: "8.5px",
                    fontWeight: "900",
                    background: data.isSettled ? "#dcfce7" : "#fef3c7",
                    color: data.isSettled ? "#166534" : "#92400e"
                  }}>
                    {data.isSettled ? "تمت التسوية والمقاصة بالكامل" : "قيد المتابعة والتحصيل"}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "3.5px 8px", fontWeight: "bold", color: "#475569" }}>إجمالي القيمة:</td>
                <td style={{ padding: "3.5px 8px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "5px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "900", color: "#0f172a" }}>{totalAmount.toLocaleString()}</span>
                    <span style={{ fontSize: "9.5px", fontWeight: "bold", color: "#475569" }}>جنيه مصري</span>
                  </div>
                  <div style={{ fontSize: "8px", fontWeight: "bold", color: "#047857", marginTop: "1px" }}>
                    فقط وقدره {totalAmountWords} جنيهاً مصرياً لا غير.
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. ITEMS TABLE OR TRANSFER CONFIRMATION */}
      <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "7px", overflow: "hidden" }}>
        <div style={{ background: "#0f172a", color: "#fff", fontSize: "9px", fontWeight: "bold", padding: "3px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>ثالثاً: تفاصيل وبيان الأصناف المرتجعة</span>
          {data.transferOutNumber && (
            <span style={{ fontSize: "8px", background: "#1e3a8a", padding: "1px 6px", borderRadius: "3px", color: "#93c5fd" }}>
              إذن خروج: TR-{data.transferOutNumber}
            </span>
          )}
        </div>

        {isGenericTransfer ? (
          <div style={{ padding: "12px 14px", background: "#f8fafc", textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#dcfce7", color: "#166534", padding: "3px 10px", borderRadius: "5px", fontWeight: "900", fontSize: "10.5px", marginBottom: "4px" }}>
              <span>✓</span>
              <span>مطابق لمستند التحويل الخارجي رقم: {data.transferOutNumber ? `(TR-${data.transferOutNumber})` : "المرفق"}</span>
            </div>
            <p style={{ margin: 0, fontSize: "9px", color: "#475569", fontWeight: "bold" }}>
              تم تسليم كامل محتويات ومشمول إذن التحويل الخارجي الصادر من الفرع إلى مندوب الشركة الموردة بعد الفحص والمطابقة التامة بحالة سليمة.
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5px" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", borderBottom: "1.2px solid #cbd5e1" }}>
                <th style={{ padding: "3.5px 6px", textAlign: "center", width: "32px", borderLeft: "1px solid #cbd5e1" }}>م</th>
                <th style={{ padding: "3.5px 8px", textAlign: "right", width: "120px", borderLeft: "1px solid #cbd5e1" }}>باركود الصنف</th>
                <th style={{ padding: "3.5px 8px", textAlign: "right", borderLeft: "1px solid #cbd5e1" }}>اسم وبيان الصنف</th>
                <th style={{ padding: "3.5px 8px", textAlign: "center", width: "65px" }}>الكمية</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it: any, idx: number) => (
                <tr key={it.id || idx} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={{ padding: "3px 6px", textAlign: "center", fontWeight: "bold", color: "#64748b", borderLeft: "1px solid #e2e8f0" }}>{idx + 1}</td>
                  <td style={{ padding: "3px 8px", fontWeight: "700", fontFamily: "monospace", color: "#334155", borderLeft: "1px solid #e2e8f0" }}>{it.barcode || "—"}</td>
                  <td style={{ padding: "3px 8px", fontWeight: "bold", color: "#0f172a", borderLeft: "1px solid #e2e8f0" }}>{it.itemName || it.description || it.name || "صنف مرتجع"}</td>
                  <td style={{ padding: "3px 8px", textAlign: "center", fontWeight: "900", color: "#0f172a" }}>{it.quantity || 1}</td>
                </tr>
              ))}
              <tr style={{ background: "#e2e8f0", borderTop: "1.5px solid #0f172a" }}>
                <td colSpan={3} style={{ padding: "4px 10px", textAlign: "right", fontWeight: "900", color: "#0f172a", borderLeft: "1px solid #cbd5e1" }}>
                  إجمالي عدد القطع والوحدات المرتجعة:
                </td>
                <td style={{ padding: "4px 8px", textAlign: "center", fontWeight: "900", fontSize: "10.5px", color: "#0f172a" }}>
                  {totalQty} قطعة
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* 5. LEGAL DECLARATION & CLEARANCE */}
      <div style={{ border: "1.5px solid #0f172a", borderRadius: "7px", padding: "5px 8px", background: "#f8fafc" }}>
        <div style={{ fontSize: "9px", fontWeight: "900", color: "#0f172a", marginBottom: "2px" }}>
          رابعاً: إقرار الاستلام الرسمي وإخلاء مسؤولية إدارة الفرع
        </div>
        <p style={{ margin: 0, fontSize: "8px", lineHeight: "1.45", color: "#334155", textAlign: "justify" }}>
          أقر أنا الموقع أدناه مندوب شركة ({data.supplier})، وبموجب هويتي ورقمي القومي المبينين أعلاه، بأنني قد عاينت واستلمت البضاعة الموضحة بهذا الإشعار بكامل كمياتها وبحالة سليمة ومطابقة لما تم الاتفاق عليه، وبذلك أصبحت البضاعة في عهدتي وتحت مسؤولية الشركة الموردة، وتعتبر ذمة فرع سيركل كيه ({branchDetails.companyName}) بريئة تماماً من عهدة هذه الأصناف اعتباراً من تاريخه وساعته، مع التزام الشركة الموردة بإتمام إجراءات التسوية المالية المقررة.
        </p>
      </div>

      {/* 6. SIGNATURES & SEALS */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.1fr 1.3fr", gap: "8px", alignItems: "end", marginTop: "2px" }}>
        {/* 1. Supplier Agent Signature */}
        <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "7px", padding: "5px 6px", background: "#fff", textAlign: "center" }}>
          <div style={{ fontSize: "8.5px", fontWeight: "bold", color: "#475569", marginBottom: "1px" }}>المستلم (مندوب الشركة الموردة)</div>
          <div style={{ fontSize: "9.5px", fontWeight: "900", color: "#0f172a" }}>{data.agentName}</div>
          <div style={{ fontSize: "7.5px", color: "#64748b", marginTop: "1px" }}>الرقم القومي: {data.agentNationalId}</div>
          <div style={{ borderBottom: "1.2px dashed #94a3b8", height: "20px", margin: "3px 6px" }} />
          <div style={{ fontSize: "7.5px", color: "#94a3b8" }}>التوقيع والاستلام / التاريخ</div>
        </div>

        {/* 2. Official Branch Stamp */}
        <div style={{ border: "2px dashed #0f172a", borderRadius: "7px", padding: "5px 6px", background: "#f8fafc", textAlign: "center", minHeight: "62px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ fontSize: "8px", fontWeight: "900", color: "#0f172a", textTransform: "uppercase" }}>خاتم الفرع المعتمد</div>
          <div style={{ fontSize: "7px", color: "#64748b", marginTop: "1px" }}>Official Branch Stamp</div>
          <div style={{ fontSize: "6.5px", color: "#94a3b8", marginTop: "1px" }}>لا يعتمد الإيصال إلا بالختم الرسمي</div>
        </div>

        {/* 3. Store Manager / Dispatcher Signature */}
        <div style={{ border: "1.5px solid #cbd5e1", borderRadius: "7px", padding: "5px 6px", background: "#fff", textAlign: "center" }}>
          <div style={{ fontSize: "8.5px", fontWeight: "bold", color: "#475569", marginBottom: "1px" }}>المُسلِّم (إدارة الفرع / أمين المخزن)</div>
          <div style={{ fontSize: "9.5px", fontWeight: "900", color: "#0f172a" }}>{data.items?.[0]?.createdBy || "مدير الفرع"}</div>
          <div style={{ fontSize: "7.5px", color: "#64748b", marginTop: "1px" }}>الصفة: مدير الفرع / أمين العهدة</div>
          <div style={{ borderBottom: "1.2px dashed #94a3b8", height: "20px", margin: "3px 6px" }} />
          <div style={{ fontSize: "7.5px", color: "#94a3b8" }}>التوقيع والاعتماد / التاريخ</div>
        </div>
      </div>

      {/* 7. AUDIT FOOTER */}
      <div style={{ borderTop: "1.2px solid #0f172a", paddingTop: "3px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "7px", color: "#475569" }}>
        <div>وثيقة إشعار مرتجع بضاعة رسمية للمورد (RTV) • معتمدة قانونياً ومحاسبياً</div>
        <div>كود الوثيقة: RET-{data.returnNumber} | تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</div>
        <div>منظومة التقارير المالية والإدارية الموحدة • ANH Circle K</div>
      </div>
    </div>
  );
}

export default function SupplierReturnsDashboard() {
  const { currentBranch } = useBranch();
  const { t, language: lang } = useLanguage();

  const [supplierReturns, setSupplierReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "settlements" | "history">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setActiveTab("history");
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handover state
  const [handoverSupplier, setHandoverSupplier] = useState<string | null>(null);
  const [handoverItems, setHandoverItems] = useState<any[]>([]);
  const [agentName, setAgentName] = useState("");
  const [agentNationalId, setAgentNationalId] = useState("");
  const [agentMobile, setAgentMobile] = useState("");
  const [totalPrice, setTotalPrice] = useState<number | "">("");
  const [settlementMethod, setSettlementMethod] = useState<"money" | "products">("money");
  const [paymentTiming, setPaymentTiming] = useState<"now" | "later">("now");
  const [expectedPaymentDate, setExpectedPaymentDate] = useState("");
  const [transferOutNumber, setTransferOutNumber] = useState("");
  const [printData, setPrintData] = useState<any | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Admin Role & Edit State
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingReturn, setEditingReturn] = useState<any | null>(null);

  useEffect(() => {
    const checkRole = () => {
      const storedRole = typeof window !== "undefined" ? (localStorage.getItem("circlek_role") || sessionStorage.getItem("circlek_role")) : null;
      let sessionRole = null;
      try {
        const sess = localStorage.getItem("active_cashier_session");
        if (sess) {
          sessionRole = JSON.parse(sess).role;
        }
      } catch (e) {}

      const effectiveRole = storedRole || sessionRole;
      const adminApproved = effectiveRole === "owner" || effectiveRole === "admin" || effectiveRole === "admin_editor" || (Boolean(effectiveRole) && effectiveRole !== "manager" && effectiveRole !== "cashier");
      setIsAdmin(Boolean(adminApproved));
    };

    checkRole();
    window.addEventListener("circlek_role_changed", checkRole);
    return () => window.removeEventListener("circlek_role_changed", checkRole);
  }, []);

  const handleOpenEdit = (eventItems: any[]) => {
    if (!eventItems || eventItems.length === 0) return;
    const first = eventItems[0];
    setEditingReturn({
      eventItems,
      supplier: first.supplier || "",
      returnNumber: first.returnNumber || "",
      transferOutNumber: first.transferOutNumber || "",
      returnedAt: first.returnedAt ? first.returnedAt.slice(0, 16) : new Date().toISOString().slice(0, 16),
      agentName: first.agentName || "",
      agentNationalId: first.agentNationalId || "",
      agentMobile: first.agentMobile || "",
      totalPrice: Number(first.totalPrice) || 0,
      settlementMethod: (first.settlementMethod || "money") as "money" | "products",
      paymentTiming: (first.paymentTiming || "now") as "now" | "later",
      expectedPaymentDate: first.expectedPaymentDate || "",
      isSettled: Boolean(first.isSettled),
      items: eventItems.map(item => ({
        id: item.id,
        barcode: item.barcode || "",
        itemName: item.itemName || "",
        quantity: Number(item.quantity) || 1,
        isDeleted: false
      }))
    });
  };

  const handleSaveEdit = async () => {
    if (!editingReturn) return;
    if (!editingReturn.supplier.trim()) {
      alert(lang === "ar" ? "يرجى كتابة اسم المورد" : "Please enter supplier name");
      return;
    }

    try {
      setProcessing("saving_edit");

      const sharedUpdate = {
        supplier: editingReturn.supplier.trim(),
        returnNumber: editingReturn.returnNumber.trim(),
        transferOutNumber: editingReturn.transferOutNumber.trim(),
        returnedAt: editingReturn.returnedAt,
        agentName: editingReturn.agentName.trim(),
        agentNationalId: editingReturn.agentNationalId.trim(),
        agentMobile: editingReturn.agentMobile.trim(),
        totalPrice: Number(editingReturn.totalPrice) || 0,
        settlementMethod: editingReturn.settlementMethod,
        paymentTiming: editingReturn.paymentTiming,
        expectedPaymentDate: editingReturn.paymentTiming === "later" ? editingReturn.expectedPaymentDate : null,
        isSettled: Boolean(editingReturn.isSettled),
        settledAt: editingReturn.isSettled ? (editingReturn.eventItems[0]?.settledAt || new Date().toISOString()) : null
      };

      const activeItems = editingReturn.items.filter((i: any) => !i.isDeleted);
      if (activeItems.length === 0) {
        alert(lang === "ar" ? "يجب أن تحتوي الفاتورة على صنف واحد على الأقل" : "Return must contain at least one item");
        setProcessing(null);
        return;
      }

      // Update or delete existing items
      for (const item of editingReturn.items) {
        if (item.id && !item.isNew) {
          if (item.isDeleted) {
            await deleteDoc(doc(db, "supplier_returns", item.id));
          } else {
            await updateDoc(doc(db, "supplier_returns", item.id), {
              ...sharedUpdate,
              barcode: item.barcode.trim() || "N/A",
              itemName: item.itemName.trim(),
              quantity: Number(item.quantity) || 1
            });
          }
        } else if (item.isNew && !item.isDeleted) {
          const first = editingReturn.eventItems[0] || {};
          await addDoc(collection(db, "supplier_returns"), {
            ...sharedUpdate,
            barcode: item.barcode.trim() || "N/A",
            itemName: item.itemName.trim() || (lang === "ar" ? "صنف مرتجع" : "Returned Item"),
            quantity: Number(item.quantity) || 1,
            category: first.category || "manual",
            storeId: first.storeId || (currentBranch === "all" ? "eL-alamein-4" : currentBranch),
            branchId: first.branchId || (currentBranch === "all" ? "alamein4" : currentBranch),
            status: "returned",
            createdAt: first.createdAt || new Date().toISOString(),
            createdBy: first.createdBy || "Admin"
          });
        }
      }

      // Synchronize printData if currently showing this return
      if (printData && (printData.returnNumber === editingReturn.returnNumber || printData.eventIds?.some((id: string) => editingReturn.eventItems.some((e: any) => e.id === id)))) {
        setPrintData({
          ...printData,
          supplier: sharedUpdate.supplier,
          returnNumber: sharedUpdate.returnNumber,
          transferOutNumber: sharedUpdate.transferOutNumber,
          returnedAt: sharedUpdate.returnedAt,
          date: new Date(sharedUpdate.returnedAt || new Date()).toLocaleDateString('en-GB'),
          agentName: sharedUpdate.agentName,
          agentNationalId: sharedUpdate.agentNationalId,
          agentMobile: sharedUpdate.agentMobile,
          totalPrice: sharedUpdate.totalPrice,
          settlementMethod: sharedUpdate.settlementMethod,
          paymentTiming: sharedUpdate.paymentTiming,
          expectedPaymentDate: sharedUpdate.expectedPaymentDate,
          isSettled: sharedUpdate.isSettled,
          items: activeItems
        });
      }

      setEditingReturn(null);
    } catch (err: any) {
      console.error("Error saving return edit:", err);
      alert("Failed to save changes: " + (err?.message || "Unknown error"));
    } finally {
      setProcessing(null);
    }
  };

  // Direct/Manual Return state
  const [showManualReturn, setShowManualReturn] = useState(false);
  const [directSupplier, setDirectSupplier] = useState("");
  const [directItems, setDirectItems] = useState<{barcode: string, itemName: string, quantity: number, id: string}[]>([]);
  const [currentBarcode, setCurrentBarcode] = useState("");
  const [currentName, setCurrentName] = useState("");
  const [currentQty, setCurrentQty] = useState(1);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [allSuppliers, setAllSuppliers] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  
  useEffect(() => {
    // Derive all suppliers from the existing supplierReturns cache
    // This costs 0 extra reads!
    const suppliers = new Set<string>();
    supplierReturns.forEach(r => {
      if (r.supplier) suppliers.add(r.supplier);
    });
    setAllSuppliers(Array.from(suppliers).sort());
  }, [supplierReturns]);

  useEffect(() => {
    const srQ = query(collection(db, "supplier_returns"), orderBy("createdAt", "desc"), limit(100));
    const unsubSR = onSnapshot(srQ, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSupplierReturns(items);
      setLoading(false);
    });
  
    return () => unsubSR();
  }, []);

  const handleSearchProduct = async (barcodeStr: string) => {
    if (!barcodeStr) return;
    setIsSearchingProduct(true);
    
    try {
      const cleanStr = barcodeStr.toString().trim();
      
      // Query Firestore for this exact barcode (Costs 1 read instead of thousands)
      const q1 = query(collection(db, "products"), where("barcode", "==", cleanStr), limit(1));
      const snap1 = await getDocs(q1);
      
      if (!snap1.empty) {
        const match = snap1.docs[0].data();
        setCurrentName(match.description || match.name || match.itemName || "");
        if (match.supplier && !directSupplier) {
          setDirectSupplier(match.supplier);
        }
      } else {
        // Try stripping leading zeros
        const strNoZero = cleanStr.replace(/^0+/, '');
        if (strNoZero !== cleanStr) {
          const q2 = query(collection(db, "products"), where("barcode", "==", strNoZero), limit(1));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) {
            const match = snap2.docs[0].data();
            setCurrentName(match.description || match.name || match.itemName || "");
            if (match.supplier && !directSupplier) {
              setDirectSupplier(match.supplier);
            }
            setIsSearchingProduct(false);
            return;
          }
        }
        setCurrentName("Unknown Item (Not in DB)");
      }
    } catch (err) {
      console.error(err);
      setCurrentName("Unknown Item (Not in DB)");
    }
    
    setIsSearchingProduct(false);
  };
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentBarcode && currentBarcode.trim().length > 3) {
        handleSearchProduct(currentBarcode);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [currentBarcode]);
  
  const handleAddDirectItem = () => {
    if (!currentBarcode && !currentName) return; // need at least one field
    setDirectItems([...directItems, {
      barcode: currentBarcode || "—",
      itemName: currentName || "—",
      quantity: currentQty > 0 ? currentQty : 1,
      id: Date.now().toString()
    }]);
    setCurrentBarcode("");
    setCurrentName("");
    setCurrentQty(1);
  };

  const handleDirectReturnSubmit = async () => {
    if (!directSupplier) {
      alert("Please select a supplier.");
      return;
    }
    if (!agentName.trim() || !agentNationalId.trim() || !agentMobile.trim()) {
      alert("Please fill in all Agent Information fields.");
      return;
    }
    // Items are OPTIONAL — if none added, receipt will note it matches transfer doc

    try {
      setProcessing("direct_return");
      const savedUserStr = localStorage.getItem("active_cashier_session");
      let managerEmail = "Unknown Manager";
      if (savedUserStr) {
        const sessionData = JSON.parse(savedUserStr);
        managerEmail = sessionData.email || sessionData.name || "Unknown Manager";
      }

      const generatedReturnNumber = `RTV-${Date.now().toString().slice(-6)}`;
      const generatedReturnedAt = new Date().toISOString();
      const finalItems = [];

      const itemsToProcess = directItems.length > 0 ? directItems : [{
        barcode: "N/A",
        itemName: lang === "ar" ? "مطابق لمستند التحويل" : "Matches Transfer Out Document",
        quantity: 0,
        id: "dummy"
      }];

      for (const item of itemsToProcess) {
        const docRef = await addDoc(collection(db, "supplier_returns"), {
          barcode: item.barcode,
          itemName: item.itemName,
          category: "manual",
          supplier: directSupplier,
          quantity: item.quantity,
          storeId: currentBranch === "all" ? "eL-alamein-4" : (currentBranch === "ola" ? "ola-el-koronfol" : "eL-alamein-4"),
          branchId: currentBranch === "all" ? "alamein4" : currentBranch,
          status: "returned",
          createdAt: generatedReturnedAt,
          createdBy: managerEmail,
          returnedAt: generatedReturnedAt,
          returnNumber: generatedReturnNumber,
          transferOutNumber,
          agentName,
          agentNationalId,
          agentMobile,
          totalPrice: Number(totalPrice) || 0,
          settlementMethod,
          paymentTiming: paymentTiming,
          expectedPaymentDate: paymentTiming === "later" ? expectedPaymentDate : null,
          isSettled: paymentTiming === "now"
        });
        finalItems.push({
          ...item,
          id: docRef.id
        });
      }

      const receiptData = {
        supplier: directSupplier,
        date: new Date(generatedReturnedAt).toLocaleDateString('en-GB'),
        returnNumber: generatedReturnNumber,
        agentName,
        agentNationalId,
        agentMobile,
        items: finalItems,
        totalPrice: Number(totalPrice) || 0,
        settlementMethod,
        paymentTiming,
        expectedPaymentDate,
        transferOutNumber,
        isSettled: settlementMethod === "products" || paymentTiming === "now",
        eventIds: finalItems.map(i => i.id),
        branchId: currentBranch === "all" ? "alamein4" : currentBranch,
        returnedAt: generatedReturnedAt
      };

      setPrintData(receiptData);
      
      setShowManualReturn(false);
      setDirectSupplier("");
      setDirectItems([]);
      setCurrentBarcode("");
      setCurrentName("");
      setCurrentQty(1);
      setAgentName("");
      setAgentNationalId("");
      setAgentMobile("");
      setTotalPrice("");
      setSettlementMethod("money");
      setPaymentTiming("now");
      setExpectedPaymentDate("");
      setTransferOutNumber("");
    } catch (err: any) {
      alert("Failed to submit direct return: " + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const processHandover = async () => {
    if (!handoverSupplier || handoverItems.length === 0) return;
    if (!agentName.trim() || !agentNationalId.trim() || !agentMobile.trim()) {
      alert("Please fill in all Agent Information fields.");
      return;
    }

    setProcessing("handover");
    try {
      const finalItems = [];
      const generatedReturnNumber = `RTV-${Date.now().toString().slice(-6)}`;
      const generatedReturnedAt = new Date().toISOString();

      for (const item of handoverItems) {
        if (item.handoverQty > 0) {
          await updateDoc(doc(db, "supplier_returns", item.id), {
            status: "returned",
            quantity: item.handoverQty,
            returnedAt: generatedReturnedAt,
            returnNumber: generatedReturnNumber,
            transferOutNumber,
            agentName,
            agentNationalId,
            agentMobile,
            totalPrice: Number(totalPrice) || 0,
            settlementMethod,
            paymentTiming: paymentTiming,
            expectedPaymentDate: paymentTiming === "later" ? expectedPaymentDate : null,
            isSettled: paymentTiming === "now"
          });
          finalItems.push({
            ...item,
            quantity: item.handoverQty
          });
        } else {
          await deleteDoc(doc(db, "supplier_returns", item.id));
        }
      }

      const receiptData = {
        supplier: handoverSupplier,
        date: new Date(generatedReturnedAt).toLocaleDateString('en-GB'),
        returnNumber: generatedReturnNumber,
        agentName,
        agentNationalId,
        agentMobile,
        items: finalItems,
        totalPrice: Number(totalPrice) || 0,
        settlementMethod,
        paymentTiming,
        expectedPaymentDate,
        transferOutNumber,
        isSettled: settlementMethod === "products" || paymentTiming === "now",
        eventIds: finalItems.map(i => i.id),
        branchId: handoverItems[0]?.branchId || handoverItems[0]?.storeId || currentBranch,
        returnedAt: generatedReturnedAt
      };

      setPrintData(receiptData);
      
      // Cleanup modal BUT DO NOT clear printData yet
      setHandoverSupplier(null);
      setHandoverItems([]);
      setAgentName("");
      setAgentNationalId("");
      setAgentMobile("");
      setTotalPrice("");
      setSettlementMethod("money");
      setPaymentTiming("now");
      setExpectedPaymentDate("");
      setTransferOutNumber("");
      
      // We will rely on a "Print" button in the printData view to actually trigger print,
      // avoiding the pop-up blocking issues.
    } catch (error) {
      console.error("Error processing handover:", error);
      alert("Failed to process handover.");
    } finally {
      setProcessing(null);
    }
  };

  const handleSettlePayment = async (id: string) => {
    try {
      await updateDoc(doc(db, "supplier_returns", id), {
        isSettled: true,
        settledAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error settling payment:", err);
      alert("Failed to mark settlement.");
    }
  };

  const handleDeleteReturn = async () => {
    if (!printData || !printData.eventIds) return;
    if (!confirm(lang === "ar" ? "هل أنت متأكد من حذف هذه الفاتورة نهائياً؟ لا يمكن التراجع عن هذا الإجراء." : "Are you sure you want to permanently delete this entire return invoice and all its items? This action cannot be undone.")) return;
    try {
      setProcessing("delete");
      for (const id of printData.eventIds) {
        await deleteDoc(doc(db, "supplier_returns", id));
      }
      setPrintData(null);
    } catch (err) {
      console.error("Error deleting return:", err);
      alert("Failed to delete the return.");
    } finally {
      setProcessing(null);
    }
  };


  const triggerPrint = () => {
    window.print();
  };

  // Filtering
  const filteredReturns = supplierReturns.filter(item => {
    if (currentBranch === "all") return true;
    if (item.branchId && item.branchId === currentBranch) return true;
    const inferred = (item.storeId || "").toLowerCase().includes("ola") || (item.storeId || "").toLowerCase().includes("koronfol") ? "ola" : "alamein4";
    return inferred === currentBranch || item.branchId === "all";
  });

  const pendingReturns = filteredReturns.filter(r => r.status === "pending" || r.status === "pending_return");
  const pendingSettlements = filteredReturns.filter(r => r.status === "returned" && r.isSettled === false);
  const returnHistory = filteredReturns.filter(r => r.status === "returned" && r.isSettled === true);

  // Group pending returns by supplier
  const returnsBySupplier = pendingReturns.reduce((acc: any, item) => {
    if (!acc[item.supplier]) acc[item.supplier] = [];
    acc[item.supplier].push(item);
    return acc;
  }, {});

  // Group settlements and history by Return Event
  const groupReturnEvents = (items: any[]) => {
    const groups: { [key: string]: any[] } = {};
    items.forEach(item => {
      // Use returnNumber if available, otherwise fallback to legacy grouping by supplier + agent + minute
      const key = item.returnNumber || `${item.supplier}_${item.agentName}_${item.totalPrice}_${item.returnedAt ? item.returnedAt.slice(0, 16) : 'legacy'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    // Convert to array and sort by latest returnedAt
    return Object.values(groups).sort((a, b) => {
      const dateA = a[0].returnedAt || "";
      const dateB = b[0].returnedAt || "";
      return dateB.localeCompare(dateA);
    });
  };

  const pendingSettlementEvents = groupReturnEvents(pendingSettlements).filter(eventItems => {
    const first = eventItems[0];
    const sStr = searchQuery.toLowerCase();
    return (first.supplier || "").toLowerCase().includes(sStr) ||
           (first.returnNumber || "").toLowerCase().includes(sStr);
  });
  
  const returnHistoryEventsRaw = groupReturnEvents(returnHistory);
  
  const returnHistoryEvents = returnHistoryEventsRaw.filter(eventItems => {
    const first = eventItems[0];
    const sStr = searchQuery.toLowerCase();
    return (first.supplier || "").toLowerCase().includes(sStr) ||
           (first.returnNumber || "").toLowerCase().includes(sStr);
  });

  const getSupplierTotalReturns = (supplierName: string) => {
    if (!supplierName) return { count: 0, total: 0 };
    const supplierEvents = returnHistoryEventsRaw.filter(ev => ev[0]?.supplier === supplierName);
    const count = supplierEvents.length;
    const total = supplierEvents.reduce((sum, ev) => sum + (Number(ev[0].totalPrice) || 0), 0);
    return { count, total };
  };

  const totalPendingMoney = pendingSettlementEvents.reduce((sum, ev) => sum + (Number(ev[0].totalPrice) || 0), 0);
  const totalSettledMoney = returnHistoryEvents.reduce((sum, ev) => sum + (Number(ev[0].totalPrice) || 0), 0);

  const viewReturnDetails = (eventItems: any[]) => {
    const first = eventItems[0];
    setPrintData({
      supplier: first.supplier,
      date: new Date(first.returnedAt || new Date()).toLocaleDateString('en-GB'),
      returnNumber: first.returnNumber || "LEGACY-RTV",
      agentName: first.agentName,
      agentNationalId: first.agentNationalId || "N/A",
      agentMobile: first.agentMobile || "N/A",
      items: eventItems,
      totalPrice: first.totalPrice || 0,
      settlementMethod: first.settlementMethod,
      paymentTiming: first.paymentTiming,
      expectedPaymentDate: first.expectedPaymentDate,
      transferOutNumber: first.transferOutNumber,
      isSettled: first.isSettled,
      eventIds: eventItems.map(i => i.id), // keep track of ids in case we need to settle them all
      branchId: first.branchId || first.storeId || currentBranch,
      returnedAt: first.returnedAt
    });
  };


  return (
    <PageTransition>
    <div className="min-h-screen bg-background text-foreground pb-20 lg:pb-0 no-print">
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8 animate-in fade-in duration-300">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 border border-border rounded-2xl shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Supplier Returns</h1>
              <p className="text-sm text-muted-foreground mt-1">{lang === "ar" ? "إدارة عمليات تسليم المرتجعات، والتسويات المالية المعلقة، والتاريخ." : "Manage return handovers, pending financial settlements, and history."}</p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => setShowManualReturn(true)}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2"
            >
              + {lang === "ar" ? "مرتجع يدوي" : "Manual Return"}
            </button>
          </div>
        </div>

        {/* CORPORATE STATS & TABS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-amber-100 font-semibold text-sm uppercase tracking-wider mb-1">Pending Returns</p>
              <h3 className="text-3xl font-black">{pendingReturns.length} <span className="text-base font-medium opacity-80">items</span></h3>
            </div>
            <Truck className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-10" />
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-blue-100 font-semibold text-sm uppercase tracking-wider mb-1">Pending Settlements</p>
              <h3 className="text-3xl font-black">{totalPendingMoney.toLocaleString()} <span className="text-base font-medium opacity-80">EGP</span></h3>
            </div>
            <FileText className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-10" />
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-emerald-100 font-semibold text-sm uppercase tracking-wider mb-1">Settled History</p>
              <h3 className="text-3xl font-black">{totalSettledMoney.toLocaleString()} <span className="text-base font-medium opacity-80">EGP</span></h3>
            </div>
            <CheckCircle className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-10" />
          </div>
        </div>

        <div className="flex bg-muted/30 p-1.5 rounded-2xl border border-border w-full shadow-sm overflow-x-auto">
          <button 
            onClick={() => setActiveTab("pending")}
            className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === "pending" ? "bg-background text-blue-600 shadow-md border-b-2 border-blue-600" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            Pending Returns
          </button>
          <button 
            onClick={() => setActiveTab("settlements")}
            className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === "settlements" ? "bg-background text-amber-600 shadow-md border-b-2 border-amber-500" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            Pending Settlements
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === "history" ? "bg-background text-emerald-600 shadow-md border-b-2 border-emerald-500" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            Return History
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div></div>
        ) : (
          <div className="space-y-6">
            
            {/* PENDING RETURNS */}
            {activeTab === "pending" && (
              <div className="space-y-6">
                {Object.keys(returnsBySupplier).length === 0 ? (
                  <div className="glass-panel p-16 text-center border-2 border-dashed border-border rounded-2xl">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold">{lang === "ar" ? "لا توجد مرتجعات معلقة" : "No Pending Returns"}</h3>
                    <p className="text-muted-foreground text-sm mt-1">There are no items waiting to be returned to suppliers.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.keys(returnsBySupplier).map(supplier => {
                      const rItems = returnsBySupplier[supplier];
                      const totalQty = rItems.reduce((sum: number, i: any) => sum + i.quantity, 0);
                      return (
                        <div 
                          key={supplier}
                          onClick={() => {
                            setHandoverSupplier(supplier);
                            setHandoverItems(rItems.map((i: any) => ({ ...i, handoverQty: i.quantity })));
                            setAgentName("");
                            setAgentNationalId("");
                            setAgentMobile("");
                          }}
                          className="glass-panel p-6 rounded-xl border border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left flex flex-col justify-between cursor-pointer group"
                        >
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <h3 className="font-black text-xl">{supplier}</h3>
                              <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-xs font-bold px-2 py-1 rounded-full">{rItems.length} items</span>
                            </div>
                            <p className="text-sm font-semibold text-muted-foreground mb-4">Total Qty: <span className="text-foreground">{totalQty} units</span></p>
                          </div>
                          <button className="w-full bg-muted group-hover:bg-blue-600 group-hover:text-white text-foreground font-bold py-2 rounded-lg text-sm transition-colors">
                            Process Handover
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* PENDING SETTLEMENTS */}
            {activeTab === "settlements" && (
              <div className="space-y-4">
                <div className="sticky top-0 z-10 bg-background pb-2">
                  <div className="relative">
                    <input 
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search by Supplier or Return Number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-3 pl-10 rounded-xl border border-border bg-muted/50 focus:bg-background outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <kbd className="hidden sm:inline-flex items-center gap-1 bg-background border border-border px-1.5 rounded text-[10px] font-bold text-muted-foreground uppercase shadow-sm">
                        <span className="text-[12px]">⌘</span>K
                      </kbd>
                    </div>
                  </div>
                </div>

                {pendingSettlementEvents.length === 0 ? (
                  <div className="glass-panel p-16 text-center border-2 border-dashed border-border rounded-2xl">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold">All Settled</h3>
                    <p className="text-muted-foreground text-sm mt-1">No supplier returns are awaiting financial settlement.</p>
                  </div>
                ) : (
                  pendingSettlementEvents.map((eventItems, idx) => {
                    const first = eventItems[0];
                    const isHighValue = first.totalPrice > 500;
                    return (
                      <div key={idx} onClick={() => viewReturnDetails(eventItems)} className={`bg-card border ${isHighValue ? 'border-red-500/50' : 'border-amber-500/30'} rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 cursor-pointer transition-colors group`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-lg">{first.supplier}</h4>
                            <span className="bg-amber-500 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">Awaiting Payment</span>
                            <span className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border border-border">{first.returnNumber || "Legacy Return"}</span>
                            {isHighValue && (
                              <span className="animate-pulse flex items-center gap-1 bg-red-500 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold shadow-sm">
                                <AlertTriangle className="h-3 w-3" /> High Value
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-muted-foreground">Amount: <span className="text-foreground text-base">{first.totalPrice} EGP</span> • <span className="text-foreground">{eventItems.length} items</span></p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Handed over to: <span className="font-medium text-foreground">{first.agentName}</span> • 
                            Expected: <span className="font-medium text-foreground">{first.expectedPaymentDate || "Not set"}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isAdmin && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(eventItems);
                              }}
                              className="bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-500/30 font-bold py-2.5 px-3.5 rounded-xl text-sm transition-all flex items-center gap-1.5 shadow-sm"
                              title={lang === "ar" ? "تعديل المرتجع (صلاحية الإدارة)" : "Edit Return (Admin Only)"}
                            >
                              <Edit className="w-4 h-4" />
                              <span>{lang === "ar" ? "تعديل" : "Edit"}</span>
                            </button>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              viewReturnDetails(eventItems);
                            }}
                            className="bg-background border border-border hover:bg-muted text-foreground font-bold py-2.5 px-4 rounded-xl text-sm transition-colors shrink-0 shadow-sm"
                          >
                            {lang === "ar" ? "عرض التفاصيل" : "View Details"}
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!confirm(lang === "ar" ? "تأكيد استلام وتسوية كافة بنود هذا الإشعار؟" : "Confirm that you have received the pending payment/products for ALL items in this return?")) return;
                              eventItems.forEach(item => {
                                handleSettlePayment(item.id);
                              });
                            }}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-colors shrink-0 shadow-sm"
                          >
                            {lang === "ar" ? "تأكيد الدفع" : "Mark as Paid"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* RETURN HISTORY */}
            {activeTab === "history" && (
              <div className="space-y-4">
                <div className="sticky top-0 z-10 bg-background pb-2">
                  <div className="relative">
                    <input 
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search by Supplier or Return Number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-3 pl-10 rounded-xl border border-border bg-muted/50 focus:bg-background outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <kbd className="hidden sm:inline-flex items-center gap-1 bg-background border border-border px-1.5 rounded text-[10px] font-bold text-muted-foreground uppercase shadow-sm">
                        <span className="text-[12px]">⌘</span>K
                      </kbd>
                    </div>
                  </div>
                </div>

                {returnHistoryEvents.length === 0 ? (
                  <div className="glass-panel p-16 text-center border-2 border-dashed border-border rounded-2xl">
                    <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-bold">No History</h3>
                    <p className="text-muted-foreground text-sm mt-1">Settled supplier returns will appear here.</p>
                  </div>
                ) : (
                  returnHistoryEvents.map((eventItems, idx) => {
                    const first = eventItems[0];
                    const isHighValue = first.totalPrice > 500;
                    return (
                      <div key={idx} onClick={() => viewReturnDetails(eventItems)} className={`bg-card border ${isHighValue ? 'border-red-500/50' : 'border-border'} rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 opacity-80 hover:opacity-100 hover:bg-muted/30 cursor-pointer transition-all`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-lg">{first.supplier}</h4>
                            <span className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border border-border">Settled</span>
                            <span className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border border-border">{first.returnNumber || "Legacy Return"}</span>
                            {isHighValue && (
                              <span className="animate-pulse flex items-center gap-1 bg-red-500 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold shadow-sm">
                                <AlertTriangle className="h-3 w-3" /> High Value
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-muted-foreground">Amount: <span className="text-foreground">{first.totalPrice || 0} EGP</span> • <span className="text-foreground">{eventItems.length} items</span></p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Method: {first.settlementMethod === 'money' ? 'Cash/Transfer' : 'Products Exchange'} • 
                            Settled on: {new Date(first.settledAt || first.returnedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isAdmin && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(eventItems);
                              }}
                              className="bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-500/30 font-bold py-2.5 px-3.5 rounded-xl text-sm transition-all flex items-center gap-1.5 shadow-sm"
                              title={lang === "ar" ? "تعديل المرتجع (صلاحية الإدارة)" : "Edit Return (Admin Only)"}
                            >
                              <Edit className="w-4 h-4" />
                              <span>{lang === "ar" ? "تعديل" : "Edit"}</span>
                            </button>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              viewReturnDetails(eventItems);
                            }}
                            className="bg-background border border-border hover:bg-muted text-foreground font-bold py-2.5 px-4 rounded-xl text-sm transition-colors shrink-0 shadow-sm"
                          >
                            {lang === "ar" ? "عرض الإيصال" : "View Receipt"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

          </div>
        )}

        {/* DIRECT (MANUAL) RETURN MODAL */}
        {showManualReturn && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[95vh]">
              <div className="p-6 border-b border-border bg-muted/30">
                <h3 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <Truck className="h-6 w-6 text-blue-500" />
                  {lang === "ar" ? "مرتجع مورد مباشر (يدوي)" : "Direct Supplier Return (Manual)"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{lang === "ar" ? "أدخل جميع الأصناف وبيانات المورد لإنشاء إيصال المرتجع فوراً." : "Input all items and supplier data to generate a return receipt immediately."}</p>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                {/* 1. Supplier Selection */}
                <div>
                  <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">{lang === "ar" ? "1. اختر المورد" : "1. Select Supplier"}</h4>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      list="supplier-list"
                      placeholder={lang === "ar" ? "اكتب أو اختر اسم مورد..." : "Type or select a supplier..."}
                      value={directSupplier}
                      onChange={e => setDirectSupplier(e.target.value)}
                      className="w-full p-3 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-bold text-sm"
                    />
                    <datalist id="supplier-list">
                      {allSuppliers.map(s => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* 2. Items List */}
                <div>
                  <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">{lang === "ar" ? "2. إضافة أصناف المرتجع" : "2. Add Return Items"}</h4>
                  
                  <div className="flex flex-col md:flex-row gap-2 mb-4 p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "الباركود" : "Barcode"}</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={currentBarcode}
                          onChange={e => setCurrentBarcode(e.target.value)}
                          onBlur={() => handleSearchProduct(currentBarcode)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSearchProduct(currentBarcode);
                          }}
                          placeholder={lang === "ar" ? "امسح أو اكتب..." : "Scan or type..."}
                          className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 font-mono text-sm"
                        />
                        <button 
                          onClick={() => handleSearchProduct(currentBarcode)}
                          disabled={isSearchingProduct || !currentBarcode}
                          className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-3 rounded-lg text-sm font-bold disabled:opacity-50"
                        >
                          {isSearchingProduct ? "..." : "Find"}
                        </button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "اسم الصنف" : "Item Name"}</label>
                      <input 
                        type="text" 
                        value={currentName}
                        onChange={e => setCurrentName(e.target.value)}
                        placeholder="Item Name"
                        className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "الكمية" : "Qty"}</label>
                      <input 
                        type="number" 
                        min="1"
                        value={currentQty}
                        onChange={e => setCurrentQty(Number(e.target.value))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddDirectItem();
                        }}
                        className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-center font-bold"
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={handleAddDirectItem}
                        disabled={!currentBarcode && !currentName}
                        className="h-[38px] px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {directItems.length > 0 ? (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 font-semibold">{lang === "ar" ? "اسم الصنف" : "Item Name"}</th>
                            <th className="p-3 font-semibold">{lang === "ar" ? "الباركود" : "Barcode"}</th>
                            <th className="p-3 font-semibold text-center">{lang === "ar" ? "الكمية" : "Qty"}</th>
                            <th className="p-3 font-semibold text-right">{lang === "ar" ? "إجراء" : "Action"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {directItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-muted/50">
                              <td className="p-3 font-medium">{item.itemName}</td>
                              <td className="p-3 font-mono text-muted-foreground">{item.barcode}</td>
                              <td className="p-3 text-center font-black text-lg">{item.quantity}</td>
                              <td className="p-3 text-right">
                                <button 
                                  onClick={() => setDirectItems(directItems.filter((_, i) => i !== idx))}
                                  className="text-red-500 hover:text-red-600 font-bold text-xs bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-lg"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/50">
                          <tr>
                            <td colSpan={2} className="p-3 font-bold text-right uppercase text-xs">{lang === "ar" ? "إجمالي الأصناف:" : "Total Items:"}</td>
                            <td className="p-3 text-center font-black text-xl">{directItems.reduce((sum, item) => sum + item.quantity, 0)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center border-2 border-dashed border-blue-200 dark:border-blue-900/40 rounded-xl">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 mb-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <p className="text-sm font-bold text-muted-foreground">{lang === "ar" ? "لا توجد أصناف — سيُشار في الإيصال أن البضاعة مطابقة لمستند التحويل" : "No items added — receipt will note items match the Transfer Out document"}</p>
                      <p className="text-xs text-muted-foreground mt-1 opacity-70">{lang === "ar" ? "يمكنك الاستمرار بدون إضافة أصناف" : "You can proceed without adding items"}</p>
                    </div>
                  )}
                </div>

                {/* 3. Agent Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-border rounded-xl bg-muted/20">
                  <div className="col-span-1 md:col-span-2">
                    <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">{lang === "ar" ? "3. بيانات المندوب" : "3. Delivery Agent Info"}</h4>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "اسم المندوب" : "Agent Name"}</label>
                    <input 
                      type="text" 
                      value={agentName}
                      onChange={e => setAgentName(e.target.value)}
                      placeholder={lang === "ar" ? "الاسم الكامل" : "Full Name"}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Transfer Out / Credit Note No.</label>
                    <input 
                      type="text" 
                      value={transferOutNumber}
                      onChange={e => setTransferOutNumber(e.target.value)}
                      placeholder="e.g. TR-998822"
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "الرقم القومي" : "National ID"}</label>
                    <input 
                      type="text" 
                      value={agentNationalId}
                      onChange={e => setAgentNationalId(e.target.value)}
                      placeholder={lang === "ar" ? "الرقم القومي المكون من 14 رقم" : "14-digit ID"}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "رقم الموبايل" : "Mobile Number"}</label>
                    <input 
                      type="text" 
                      value={agentMobile}
                      onChange={e => setAgentMobile(e.target.value)}
                      placeholder={lang === "ar" ? "مثال: 01012345678" : "E.g. 01012345678"}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                {/* 4. Settlement Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-border rounded-xl bg-amber-500/5 border-amber-500/20">
                  <div className="col-span-1 md:col-span-2">
                    <h4 className="font-bold text-sm text-amber-700 dark:text-amber-500 uppercase tracking-wider">{lang === "ar" ? "4. تفاصيل التسوية والدفع" : "4. Settlement Details & Payment"}</h4>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "إجمالي القيمة المتوقعة (ج.م)" : "Total Expected Value (EGP)"}</label>
                    <input 
                      type="number" 
                      value={totalPrice}
                      onChange={e => setTotalPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder={lang === "ar" ? "إجمالي قيمة المرتجع" : "Total EGP Value of Return"}
                      className="w-full p-2 border border-amber-500/30 rounded-lg bg-background outline-none focus:border-amber-500 font-bold text-amber-600 text-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "طريقة التسوية" : "Settlement Method"}</label>
                    <select
                      value={settlementMethod}
                      onChange={e => setSettlementMethod(e.target.value as "money" | "products")}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    >
                      <option value="money">{lang === "ar" ? "نقدي (كاش/تحويل)" : "Money (Cash/Transfer)"}</option>
                      <option value="products">{lang === "ar" ? "بضاعة (استبدال)" : "Products (Exchange)"}</option>
                    </select>
                  </div>
                      <div className="mt-4 md:mt-0">
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "وقت الدفع/التسليم" : "Payment/Delivery Timing"}</label>
                        <select
                          value={paymentTiming}
                          onChange={e => setPaymentTiming(e.target.value as "now" | "later")}
                          className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                        >
                          <option value="now">{lang === "ar" ? "تم الاستلام الآن (مسدد)" : "Received Now (Settled)"}</option>
                          <option value="later">{lang === "ar" ? "آجل (معلق)" : "Will Pay/Deliver Later (Pending)"}</option>
                        </select>
                      </div>
                      {paymentTiming === "later" && (
                        <div className="mt-4 md:mt-0">
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "التاريخ المتوقع" : "Expected Date"}</label>
                          <input 
                            type="date" 
                            value={expectedPaymentDate}
                            onChange={e => setExpectedPaymentDate(e.target.value)}
                            className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                          />
                        </div>
                      )}
                </div>

              </div>
              
              <div className="p-6 bg-muted/50 flex justify-end gap-3 border-t border-border shrink-0">
                <button 
                  onClick={() => setShowManualReturn(false)}
                  className="px-6 py-3 rounded-xl font-bold bg-background text-foreground hover:bg-muted border border-border transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDirectReturnSubmit}
                  disabled={processing === "direct_return"}
                  className="px-8 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2 text-lg shadow-lg"
                >
                  {processing === "direct_return" ? "Processing..." : "Complete Return & Print Receipt"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HANDOVER MODAL */}
        {handoverSupplier && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-border bg-muted/30">
                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-500" />
                  Supplier Handover
                </h3>
                <p className="text-sm text-muted-foreground">Supplier: <span className="font-bold text-foreground">{handoverSupplier}</span></p>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                <div>
                  <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">Items Being Returned</h4>
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-2 font-semibold">Item</th>
                        <th className="pb-2 font-semibold">{lang === "ar" ? "الباركود" : "Barcode"}</th>
                        <th className="pb-2 font-semibold text-right">Handover Qty</th>
                        <th className="pb-2 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {handoverItems.map((item, index) => (
                        <tr key={item.id}>
                          <td className="py-3 font-medium">{item.itemName}</td>
                          <td className="py-3 font-mono text-muted-foreground">{item.barcode}</td>
                          <td className="py-3 text-right">
                            <input 
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={item.handoverQty}
                              onChange={e => {
                                const newItems = [...handoverItems];
                                newItems[index].handoverQty = Number(e.target.value);
                                setHandoverItems(newItems);
                              }}
                              className="w-20 p-2 border border-border rounded-lg bg-background font-black outline-none focus:border-blue-500 text-center"
                            />
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={async () => {
                                const pin = window.prompt("Enter PIN to delete:");
                                if (pin === "1111") {
                                  try {
                                    await deleteDoc(doc(db, "supplier_returns", item.id));
                                    const newItems = handoverItems.filter((_, i) => i !== index);
                                    setHandoverItems(newItems);
                                    if (newItems.length === 0) setHandoverSupplier(null);
                                  } catch (e) {
                                    console.error("Failed to delete", e);
                                    alert("Failed to delete item.");
                                  }
                                } else if (pin !== null) {
                                  alert("Incorrect PIN");
                                }
                              }}
                              className="text-red-500 hover:text-red-600 font-bold text-xs bg-red-100 dark:bg-red-900/30 px-3 py-1.5 rounded-lg"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border border-border rounded-xl bg-muted/20">
                  <div className="col-span-1 md:col-span-2">
                    <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">Delivery Agent Info</h4>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "اسم المندوب" : "Agent Name"}</label>
                    <input 
                      type="text" 
                      value={agentName}
                      onChange={e => setAgentName(e.target.value)}
                      placeholder={lang === "ar" ? "الاسم الكامل" : "Full Name"}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Transfer Out / Credit Note No.</label>
                    <input 
                      type="text" 
                      value={transferOutNumber}
                      onChange={e => setTransferOutNumber(e.target.value)}
                      placeholder="e.g. TR-998822"
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "الرقم القومي" : "National ID"}</label>
                    <input 
                      type="text" 
                      value={agentNationalId}
                      onChange={e => setAgentNationalId(e.target.value)}
                      placeholder={lang === "ar" ? "الرقم القومي المكون من 14 رقم" : "14-digit ID"}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "رقم الموبايل" : "Mobile Number"}</label>
                    <input 
                      type="text" 
                      value={agentMobile}
                      onChange={e => setAgentMobile(e.target.value)}
                      placeholder={lang === "ar" ? "مثال: 01012345678" : "E.g. 01012345678"}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border border-border rounded-xl bg-muted/20">
                  <div className="col-span-1 md:col-span-2">
                    <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">Settlement Details</h4>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Total Expected (EGP)</label>
                    <input 
                      type="number" 
                      value={totalPrice}
                      onChange={e => setTotalPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Total EGP"
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "طريقة التسوية" : "Settlement Method"}</label>
                    <select
                      value={settlementMethod}
                      onChange={e => setSettlementMethod(e.target.value as "money" | "products")}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    >
                      <option value="money">{lang === "ar" ? "نقدي (كاش/تحويل)" : "Money (Cash/Transfer)"}</option>
                      <option value="products">{lang === "ar" ? "بضاعة (استبدال)" : "Products (Exchange)"}</option>
                    </select>
                  </div>
                      <div className="mt-4 md:mt-0">
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "وقت الدفع/التسليم" : "Payment/Delivery Timing"}</label>
                        <select
                          value={paymentTiming}
                          onChange={e => setPaymentTiming(e.target.value as "now" | "later")}
                          className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                        >
                          <option value="now">{lang === "ar" ? "تم الاستلام الآن (مسدد)" : "Received Now (Settled)"}</option>
                          <option value="later">{lang === "ar" ? "آجل (معلق)" : "Will Pay/Deliver Later (Pending)"}</option>
                        </select>
                      </div>
                      {paymentTiming === "later" && (
                        <div className="mt-4 md:mt-0">
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "التاريخ المتوقع" : "Expected Date"}</label>
                          <input 
                            type="date" 
                            value={expectedPaymentDate}
                            onChange={e => setExpectedPaymentDate(e.target.value)}
                            className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                          />
                        </div>
                      )}
                </div>
              </div>
              
              <div className="p-6 border-t border-border bg-muted/30 flex justify-end gap-3 shrink-0">
                <button 
                  onClick={() => setHandoverSupplier(null)}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-background text-foreground hover:bg-muted border border-border transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={processHandover}
                  disabled={processing === "handover"}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {processing === "handover" ? (
                    "Processing..."
                  ) : (
                    <>
                      Confirm & Generate Receipt
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN EDIT RETURN MODAL */}
        {editingReturn && isAdmin && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 no-print">
            <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="p-5 border-b border-border bg-muted/30 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Edit className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black tracking-tight text-foreground">
                        {lang === "ar" ? "تعديل إشعار المرتجع" : "Edit Supplier Return"}
                      </h3>
                      <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                        Admin Only
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lang === "ar" ? "تعديل بيانات المورد، تفاصيل التسوية، الأصناف، والحالة (مغلق / معلق)" : "Modify supplier info, settlement terms, items, and status (closed/pending)"}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingReturn(null)}
                  className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
                
                {/* 1. Basic Info */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-blue-500" />
                    <span>{lang === "ar" ? "1. البيانات الأساسية للمرتجع" : "1. Basic Return Information"}</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">
                        {lang === "ar" ? "اسم الشركة / المورد *" : "Supplier Name *"}
                      </label>
                      <input 
                        type="text" 
                        value={editingReturn.supplier}
                        onChange={e => setEditingReturn({...editingReturn, supplier: e.target.value})}
                        className="w-full p-2.5 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-bold text-sm"
                        placeholder="e.g. alshahin"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">
                        {lang === "ar" ? "رقم إذن المرتجع" : "Return Reference Number"}
                      </label>
                      <input 
                        type="text" 
                        value={editingReturn.returnNumber}
                        onChange={e => setEditingReturn({...editingReturn, returnNumber: e.target.value})}
                        className="w-full p-2.5 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-bold text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">
                        {lang === "ar" ? "رقم إذن التحويل الخارجي (TR)" : "Transfer Out / Credit Note (TR)"}
                      </label>
                      <input 
                        type="text" 
                        value={editingReturn.transferOutNumber}
                        onChange={e => setEditingReturn({...editingReturn, transferOutNumber: e.target.value})}
                        className="w-full p-2.5 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-bold text-sm font-mono"
                        placeholder="e.g. 2552120"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Agent Information */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">
                    {lang === "ar" ? "2. بيانات مندوب الاستلام" : "2. Delivery Agent Information"}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">
                        {lang === "ar" ? "اسم المندوب" : "Agent Name"}
                      </label>
                      <input 
                        type="text" 
                        value={editingReturn.agentName}
                        onChange={e => setEditingReturn({...editingReturn, agentName: e.target.value})}
                        className="w-full p-2.5 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-semibold text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">
                        {lang === "ar" ? "الرقم القومي (14 رقم)" : "National ID"}
                      </label>
                      <input 
                        type="text" 
                        value={editingReturn.agentNationalId}
                        onChange={e => setEditingReturn({...editingReturn, agentNationalId: e.target.value})}
                        className="w-full p-2.5 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-bold text-sm font-mono"
                        maxLength={14}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">
                        {lang === "ar" ? "رقم هاتف المندوب" : "Agent Mobile"}
                      </label>
                      <input 
                        type="text" 
                        value={editingReturn.agentMobile}
                        onChange={e => setEditingReturn({...editingReturn, agentMobile: e.target.value})}
                        className="w-full p-2.5 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-semibold text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Financials & Status */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">
                    {lang === "ar" ? "3. التسوية المالية وحالة الإشعار" : "3. Settlement & Financial Status"}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">
                        {lang === "ar" ? "طريقة التسوية" : "Settlement Method"}
                      </label>
                      <select 
                        value={editingReturn.settlementMethod}
                        onChange={e => setEditingReturn({...editingReturn, settlementMethod: e.target.value as any})}
                        className="w-full p-2.5 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-bold text-sm"
                      >
                        <option value="money">{lang === "ar" ? "نقدي / تحويل بنكي" : "Cash / Bank Transfer"}</option>
                        <option value="products">{lang === "ar" ? "استبدال بضاعة" : "Products Exchange"}</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">
                        {lang === "ar" ? "توقيت السداد" : "Payment Timing"}
                      </label>
                      <select 
                        value={editingReturn.paymentTiming}
                        onChange={e => setEditingReturn({...editingReturn, paymentTiming: e.target.value as any})}
                        className="w-full p-2.5 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-bold text-sm"
                      >
                        <option value="now">{lang === "ar" ? "سداد فوري" : "Immediate (Now)"}</option>
                        <option value="later">{lang === "ar" ? "آجل (استحقاق لاحق)" : "Later Date"}</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">
                        {lang === "ar" ? "إجمالي القيمة (ج.م)" : "Total Amount (EGP)"}
                      </label>
                      <input 
                        type="number" 
                        value={editingReturn.totalPrice}
                        onChange={e => setEditingReturn({...editingReturn, totalPrice: Number(e.target.value) || 0})}
                        className="w-full p-2.5 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-black text-sm text-emerald-600"
                        min={0}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">
                        {lang === "ar" ? "حالة الإغلاق والتسوية *" : "Status (Closed vs Open) *"}
                      </label>
                      <div className="flex gap-1.5 mt-0.5">
                        <button
                          type="button"
                          onClick={() => setEditingReturn({...editingReturn, isSettled: true})}
                          className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold border transition-all ${editingReturn.isSettled ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"}`}
                        >
                          {lang === "ar" ? "مسددة (مغلقة)" : "Settled"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingReturn({...editingReturn, isSettled: false})}
                          className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold border transition-all ${!editingReturn.isSettled ? "bg-amber-600 text-white border-amber-600 shadow-sm" : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"}`}
                        >
                          {lang === "ar" ? "معلقة (مفتوحة)" : "Pending"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {editingReturn.paymentTiming === "later" && (
                    <div className="w-full md:w-1/3">
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">
                        {lang === "ar" ? "تاريخ الاستحقاق المتوقع" : "Expected Payment Date"}
                      </label>
                      <input 
                        type="date" 
                        value={editingReturn.expectedPaymentDate}
                        onChange={e => setEditingReturn({...editingReturn, expectedPaymentDate: e.target.value})}
                        className="w-full p-2.5 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-semibold text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* 4. Items Table */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">
                      {lang === "ar" ? "4. الأصناف والكميات المرتجعة" : "4. Returned Items & Quantities"}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingReturn({
                          ...editingReturn,
                          items: [
                            ...editingReturn.items,
                            { barcode: "", itemName: "", quantity: 1, isNew: true }
                          ]
                        });
                      }}
                      className="text-xs bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-500/20 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "إضافة صنف" : "Add Item"}</span>
                    </button>
                  </div>

                  <div className="border border-border rounded-xl overflow-hidden bg-muted/20">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted text-muted-foreground font-bold border-b border-border">
                        <tr>
                          <th className="p-2.5 text-center w-10">#</th>
                          <th className="p-2.5 w-36">{lang === "ar" ? "الباركود" : "Barcode"}</th>
                          <th className="p-2.5">{lang === "ar" ? "اسم الصنف وتوصيفه" : "Item Description"}</th>
                          <th className="p-2.5 text-center w-24">{lang === "ar" ? "الكمية" : "Qty"}</th>
                          <th className="p-2.5 text-center w-14"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {editingReturn.items.map((item: any, idx: number) => {
                          if (item.isDeleted) return null;
                          return (
                            <tr key={item.id || idx} className="hover:bg-muted/40">
                              <td className="p-2 text-center font-bold text-muted-foreground">{idx + 1}</td>
                              <td className="p-2">
                                <input 
                                  type="text" 
                                  value={item.barcode}
                                  onChange={e => {
                                    const updated = [...editingReturn.items];
                                    updated[idx].barcode = e.target.value;
                                    setEditingReturn({...editingReturn, items: updated});
                                  }}
                                  className="w-full p-1.5 border border-border rounded-lg bg-background font-mono text-xs"
                                  placeholder="Barcode..."
                                />
                              </td>
                              <td className="p-2">
                                <input 
                                  type="text" 
                                  value={item.itemName}
                                  onChange={e => {
                                    const updated = [...editingReturn.items];
                                    updated[idx].itemName = e.target.value;
                                    setEditingReturn({...editingReturn, items: updated});
                                  }}
                                  className="w-full p-1.5 border border-border rounded-lg bg-background font-bold text-xs"
                                  placeholder="Item name..."
                                />
                              </td>
                              <td className="p-2">
                                <input 
                                  type="number" 
                                  min="1"
                                  value={item.quantity}
                                  onChange={e => {
                                    const updated = [...editingReturn.items];
                                    updated[idx].quantity = Number(e.target.value) || 1;
                                    setEditingReturn({...editingReturn, items: updated});
                                  }}
                                  className="w-full p-1.5 border border-border rounded-lg bg-background font-black text-xs text-center"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...editingReturn.items];
                                    if (item.isNew) {
                                      updated.splice(idx, 1);
                                    } else {
                                      updated[idx].isDeleted = true;
                                    }
                                    setEditingReturn({...editingReturn, items: updated});
                                  }}
                                  className="p-1 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border bg-muted/30 flex justify-between items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  {lang === "ar" ? "* سيتم تحديث كافة بيانات الفاتورة والمقاصة فوراً في قاعدة البيانات." : "* All changes will be saved to the database immediately."}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingReturn(null)}
                    disabled={processing === "saving_edit"}
                    className="px-5 py-2 rounded-xl text-xs font-bold border border-border hover:bg-muted transition-all"
                  >
                    {lang === "ar" ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={processing === "saving_edit"}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {processing === "saving_edit" ? "..." : (lang === "ar" ? "حفظ التعديلات" : "Save Changes")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ON-SCREEN RECEIPT PREVIEW MODAL */}
        {printData && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 no-print">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl relative border border-border">
              <div className="p-4 md:p-5 border-b border-border bg-white dark:bg-slate-900 sticky top-0 z-10 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-black">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">إيصال مرتجع رسمي للمورد (RTV)</h3>
                    <p className="text-xs text-slate-500">معاينة المستند الرسمي قبل الطباعة والاعتماد</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {isAdmin && (
                    <button 
                      onClick={() => {
                        const matchedEvent = returnHistoryEventsRaw.find(ev => ev[0]?.returnNumber === printData.returnNumber) ||
                          pendingSettlements.filter(item => item.returnNumber === printData.returnNumber);
                        if (matchedEvent && matchedEvent.length > 0) {
                          handleOpenEdit(matchedEvent);
                        } else if (printData.items && printData.items.length > 0) {
                          handleOpenEdit(printData.items);
                        }
                      }}
                      className="px-3.5 py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-500/30 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "تعديل المرتجع" : "Edit Return"}</span>
                    </button>
                  )}
                  {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && (
                    <button 
                      onClick={handleDeleteReturn}
                      disabled={processing === "delete"}
                      className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                    >
                      {processing === "delete" ? "..." : (lang === "ar" ? "حذف الفاتورة" : "Delete Invoice")}
                    </button>
                  )}
                  {!printData.isSettled && printData.eventIds && (
                    <button 
                      onClick={() => {
                        if (!confirm(lang === "ar" ? "تأكيد سداد وتسوية كافة بنود هذا الإيصال؟" : "Mark all items as paid?")) return;
                        printData.eventIds.forEach((id: string) => handleSettlePayment(id));
                        setPrintData({...printData, isSettled: true});
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
                    >
                      {lang === "ar" ? "تأكيد استلام المبلغ / التسوية" : "Mark as Paid"}
                    </button>
                  )}
                  <button 
                    onClick={triggerPrint} 
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{lang === "ar" ? "طباعة الإيصال (A4)" : "Print Receipt (A4)"}</span>
                  </button>
                  <button 
                    onClick={() => setPrintData(null)} 
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs transition-all"
                  >
                    {lang === "ar" ? "إغلاق" : "Close"}
                  </button>
                </div>
              </div>

              {/* On-screen paper preview */}
              <div className="p-4 md:p-6 overflow-y-auto bg-slate-100 dark:bg-slate-950 flex justify-center">
                <div className="bg-white shadow-xl rounded-xl border border-slate-200 w-full max-w-[190mm] p-6 text-slate-900" dir="rtl" style={{ fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif" }}>
                  <ReturnReceiptContent data={printData} currentBranch={currentBranch} />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>

    {/* 🌟 OFFICIAL EGYPTIAN ARABIC RETURN RECEIPT (RTV) - 100% CLEAN A4 PRINTABLE DOCUMENT 🌟 */}
    {printData && (
      <div className="hidden print:block w-full text-slate-900 bg-white" dir="rtl" style={{ fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif", fontSize: "10px", lineHeight: "1.4" }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 6mm 8mm;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background: #fff !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          }
          table {
            page-break-inside: avoid;
          }
        ` }} />
        <div style={{
          margin: "0 auto",
          width: "100%",
          maxWidth: "190mm",
          minHeight: "275mm",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "2mm 2mm",
          pageBreakInside: "avoid",
          breakInside: "avoid"
        }}>
          <ReturnReceiptContent data={printData} currentBranch={currentBranch} />
        </div>
      </div>
    )}
    </PageTransition>
  );
}
