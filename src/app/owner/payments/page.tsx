"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { PullToRefresh } from "@/components/MobileUX/PullToRefresh";
import { showIsland } from "@/components/MobileUX/DynamicIsland";
import { useLanguage } from "@/context/LanguageContext";
import { playPopSound } from "@/lib/sounds";
import { Wallet, Calendar, User, FileText, Hash, Percent, CreditCard, Banknote, Building, ChevronDown, ChevronUp } from "lucide-react";

const D = {
  bg: "#0B1121",
  surface: "#151E32",
  surfaceHigh: "#1C2841",
  border: "rgba(34, 211, 238, 0.15)",
  borderMid: "rgba(34, 211, 238, 0.25)",
  red: "#ef4444",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  textDim: "#64748b",
  cyan: "#22d3ee",
  cyanDim: "rgba(34, 211, 238, 0.1)",
  cyanBorder: "rgba(34, 211, 238, 0.25)",
  emerald: "#10b981",
  purple: "#8b5cf6"
};

const METHOD_ICONS: Record<string, any> = {
  cash: Banknote,
  visa: CreditCard,
  bank_transfer: Building,
  bank: Building,
};

const CATEGORY_EMOJIS: Record<string, string> = {
  order: "📦",
  maintenance: "🔧",
  utilities: "💡",
  transportation: "🚚",
  other: "📝"
};

export default function OwnerPaymentsPage() {
  const { language: lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "cash_payments"), orderBy("createdAt", "desc"), limit(300));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPayments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRefresh = async () => {
    if (navigator.vibrate) navigator.vibrate(50);
    await loadData();
    showIsland("Payments Updated", { type: "success" });
  };

  const toggleExpand = (id: string) => {
    if (navigator.vibrate) navigator.vibrate(20);
    playPopSound();
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredPayments = payments.filter(p => {
    if (dateFrom && p.date < dateFrom) return false;
    if (dateTo && p.date > dateTo) return false;
    if (searchQuery) {
       const q = searchQuery.toLowerCase();
       return p.companyName?.toLowerCase().includes(q) || 
              p.category?.toLowerCase().includes(q) || 
              p.invoiceNumber?.toLowerCase().includes(q) || 
              p.poNumber?.toLowerCase().includes(q) ||
              p.supplierRepName?.toLowerCase().includes(q) ||
              p.notes?.toLowerCase().includes(q) ||
              p.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const totalFilteredAmount = filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0) + (Number(p.tax) || 0), 0);
  const totalFilteredCount = filteredPayments.length;

  if (loading) {
    return (
      <div style={{ padding: "54px 20px 20px", maxWidth: 800, margin: "0 auto" }}>
          <div style={{ height: 30, width: 120, backgroundColor: D.surfaceHigh, borderRadius: 8, marginBottom: 20, animation: "pulse 2s infinite" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ height: 180, backgroundColor: D.surface, borderRadius: 20, animation: "pulse 2s infinite" }} />
              ))}
          </div>
      </div>
    );
  }

  return (
    <div style={{ direction: "ltr", color: D.textPrimary }}>
      <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: 100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "54px 20px 10px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: D.textSecondary, textTransform: "uppercase" }}>
            CIRCLE K <span style={{ color: D.textDim, fontWeight: 500 }}>{lang === "en" ? "Owner" : "المالك"}</span>
          </div>
        </div>

        <PullToRefresh onRefresh={handleRefresh}>
          <div style={{ padding: "0 20px" }}>
            <div style={{ marginBottom: 16 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: D.textPrimary }}>{lang === "en" ? "Payments" : "المدفوعات"}</h1>
                <p style={{ fontSize: 14, color: D.textSecondary, marginTop: 4 }}>{lang === "en" ? "Detailed corporate outgoings" : "المصروفات المؤسسية المفصلة"}</p>
            </div>

            {/* Totals Bar */}
            <div style={{ position: "sticky", top: 16, zIndex: 10, display: "flex", gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, background: "rgba(244, 63, 94, 0.1)", border: `1px solid rgba(244, 63, 94, 0.25)`, padding: "12px 16px", borderRadius: 16, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
                <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{lang === "en" ? "Total Outgoings" : "إجمالي المصروفات"}</div>
                <div style={{ fontSize: 18, color: D.red, fontWeight: 800 }}>EGP {totalFilteredAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              </div>
              <div style={{ background: D.surfaceHigh, border: `1px solid ${D.border}`, padding: "12px 16px", borderRadius: 16, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{lang === "en" ? "Count" : "العدد"}</div>
                <div style={{ fontSize: 18, color: D.textPrimary, fontWeight: 800 }}>{totalFilteredCount}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", background: D.surfaceHigh, padding: "10px 14px", borderRadius: 12, border: `1px solid ${D.border}` }}>
                <div style={{ marginRight: 10, display: "flex", alignItems: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <input 
                  type="text" 
                  placeholder={lang === "en" ? "Search company, category, invoice..." : "ابحث عن الشركة، الفئة، الفاتورة..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if (navigator.vibrate) navigator.vibrate(20); playPopSound(); }}
                  style={{ background: "transparent", border: "none", color: D.textPrimary, outline: "none", width: "100%", fontSize: 14 }}
                />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "From Date" : "من تاريخ"}</label>
                  <input 
                    type="date" 
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); if (navigator.vibrate) navigator.vibrate(20); playPopSound(); }}
                    style={{ background: D.surfaceHigh, border: `1px solid ${D.border}`, color: D.textPrimary, padding: "8px 12px", borderRadius: 10, fontSize: 14, outline: "none", colorScheme: "dark" }}
                  />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "To Date" : "إلى تاريخ"}</label>
                  <input 
                    type="date" 
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); if (navigator.vibrate) navigator.vibrate(20); playPopSound(); }}
                    style={{ background: D.surfaceHigh, border: `1px solid ${D.border}`, color: D.textPrimary, padding: "8px 12px", borderRadius: 10, fontSize: 14, outline: "none", colorScheme: "dark" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {filteredPayments.map((payment) => {
                const amount = Number(payment.amount) || 0;
                const tax = Number(payment.tax) || 0;
                const total = Number(payment.total) || amount + tax;
                const MethodIcon = METHOD_ICONS[payment.method] || Wallet;
                const emoji = CATEGORY_EMOJIS[payment.category] || "📝";
                const isExpanded = expandedItems[payment.id];

                return (
                  <div key={payment.id} style={{ backgroundColor: D.surface, borderRadius: 20, padding: "20px", border: `1px solid ${D.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: D.cyanDim, border: `1px solid ${D.cyanBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <MethodIcon size={18} color={D.cyan} />
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: D.textPrimary, textTransform: "capitalize", display: "flex", alignItems: "center", gap: 6 }}>
                            {payment.companyName || payment.category || "Expense"}
                          </div>
                          <div style={{ fontSize: 11, color: D.textDim, display: "flex", alignItems: "center", gap: 4, marginTop: 2, textTransform: "capitalize" }}>
                            <span>{emoji} {payment.category}</span>
                            <span style={{ margin: "0 4px" }}>•</span>
                            <span>{payment.method?.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: D.textSecondary, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                          <Calendar size={10} /> {payment.date}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: 28, fontWeight: 900, color: D.red, marginBottom: 16, letterSpacing: "-0.02em" }}>
                      EGP {total.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </div>

                    {/* Grid Details */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: `1px solid ${D.borderMid}`, paddingTop: 16, paddingBottom: 16 }}>
                        {payment.invoiceNumber && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <Hash size={12} color={D.textDim} />
                            <div>
                              <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Invoice" : "رقم الفاتورة"}</div>
                              <div style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{payment.invoiceNumber}</div>
                            </div>
                          </div>
                        )}
                        
                        {payment.poNumber && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <Hash size={12} color={D.textDim} />
                            <div>
                              <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "PO Number" : "رقم أمر الشراء"}</div>
                              <div style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{payment.poNumber}</div>
                            </div>
                          </div>
                        )}

                        {payment.supplierRepName && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <User size={12} color={D.textDim} />
                            <div>
                              <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Representative" : "المندوب"}</div>
                              <div style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{payment.supplierRepName}</div>
                            </div>
                          </div>
                        )}

                        {payment.supplierNationalId && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <CreditCard size={12} color={D.textDim} />
                            <div>
                              <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "National ID" : "الرقم القومي"}</div>
                              <div style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{payment.supplierNationalId}</div>
                            </div>
                          </div>
                        )}
                        
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <Wallet size={12} color={D.textDim} />
                          <div>
                            <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Base Amount" : "المبلغ الأساسي"}</div>
                            <div style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{amount.toLocaleString()}</div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <Percent size={12} color={D.textDim} />
                          <div>
                            <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Tax" : "الضريبة"}</div>
                            <div style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{tax.toLocaleString()}</div>
                          </div>
                        </div>
                    </div>

                    {payment.createdBy && (
                      <div style={{ fontSize: 10, color: D.textDim, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                        <User size={10} /> {lang === "en" ? "Logged by:" : "بواسطة:"} {payment.createdBy}
                      </div>
                    )}

                    {(payment.description || payment.categoryNote || payment.notes) && (
                      <div style={{ fontSize: 12, color: D.textSecondary, display: "flex", gap: 6, alignItems: "flex-start", background: D.surfaceHigh, padding: "10px 14px", borderRadius: 10 }}>
                        <FileText size={14} style={{ marginTop: 2, flexShrink: 0, color: D.cyan }} />
                        <span style={{ lineHeight: 1.4 }}>{payment.description || payment.categoryNote || payment.notes}</span>
                      </div>
                    )}

                    {payment.items && payment.items.length > 0 && (
                      <div style={{ marginTop: 12, background: D.surfaceHigh, padding: "12px", borderRadius: 10 }}>
                        <div 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleExpand(payment.id);
                          }}
                          style={{ 
                            width: "100%", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "space-between",
                            padding: "4px 0",
                            cursor: "pointer"
                          }}
                        >
                          <div style={{ fontSize: 10, color: D.textSecondary, textTransform: "uppercase", fontWeight: 800 }}>
                            {lang === "en" ? `Included Items (${payment.items.length})` : `العناصر المضمنة (${payment.items.length})`}
                          </div>
                          {isExpanded ? <ChevronUp size={14} color={D.textSecondary} /> : <ChevronDown size={14} color={D.textSecondary} />}
                        </div>
                        
                        {isExpanded && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                            {payment.items.map((item: any, idx: number) => (
                              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: D.textPrimary }}>
                                <span>{item.quantity}x {item.description}</span>
                                <span style={{ color: D.textDim }}>{item.unitPrice ? `EGP ${item.unitPrice}` : ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredPayments.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: D.textDim, fontSize: 14 }}>
                  {lang === "en" ? "No payments recorded matching your filters." : "لا توجد مدفوعات تطابق بحثك."}
                </div>
              )}
            </div>
          </div>
        </PullToRefresh>
      </div>
    </div>
  );
}
