"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { PullToRefresh } from "@/components/MobileUX/PullToRefresh";
import { showIsland } from "@/components/MobileUX/DynamicIsland";
import { useLanguage } from "@/context/LanguageContext";
import { playPopSound } from "@/lib/sounds";
import { Building, Calendar, User, FileText, Hash, Percent, ChevronDown, ChevronUp } from "lucide-react";

const D = {
  bg: "#0B1121",
  surface: "#151E32",
  surfaceHigh: "#1C2841",
  border: "rgba(34, 211, 238, 0.15)",
  borderMid: "rgba(34, 211, 238, 0.25)",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  textDim: "#64748b",
  amber: "#f59e0b",
  amberDim: "rgba(245, 158, 11, 0.1)",
  amberBorder: "rgba(245, 158, 11, 0.25)",
  emerald: "#10b981",
  cyan: "#22d3ee",
};

export default function OwnerCreditsPage() {
  const { language: lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<any[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "credits"), orderBy("createdAt", "desc"), limit(300));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCredits(data);
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
    showIsland("Credits Updated", { type: "success" });
  };

  const toggleExpand = (id: string) => {
    if (navigator.vibrate) navigator.vibrate(20);
    playPopSound();
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredCredits = credits.filter(c => {
    const d = c.collectionDate || c.date;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    if (searchQuery) {
       const q = searchQuery.toLowerCase();
       return c.companyName?.toLowerCase().includes(q) || 
              c.invoiceNumber?.toLowerCase().includes(q) || 
              c.poNumber?.toLowerCase().includes(q) ||
              c.notes?.toLowerCase().includes(q) ||
              c.createdBy?.toLowerCase().includes(q) ||
              c.status?.toLowerCase().includes(q);
    }
    return true;
  });

  const totalFilteredCredits = filteredCredits.reduce((acc, c) => acc + (Number(c.amountDue) || 0) + (Number(c.tax) || 0), 0);
  const totalFilteredPaid = filteredCredits.reduce((acc, c) => acc + (Number(c.paidAmount) || 0), 0);

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
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: D.textPrimary }}>{lang === "en" ? "Credits" : "الذمم"}</h1>
                <p style={{ fontSize: 14, color: D.textSecondary, marginTop: 4 }}>{lang === "en" ? "Detailed corporate credits" : "الذمم المؤسسية المفصلة"}</p>
            </div>

            {/* Totals Bar */}
            <div style={{ position: "sticky", top: 16, zIndex: 10, display: "flex", gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, background: "rgba(245, 158, 11, 0.1)", border: `1px solid rgba(245, 158, 11, 0.25)`, padding: "12px 16px", borderRadius: 16, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
                <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{lang === "en" ? "Total Credit Issued" : "إجمالي الذمم المصدرة"}</div>
                <div style={{ fontSize: 18, color: D.amber, fontWeight: 800 }}>EGP {totalFilteredCredits.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              </div>
              <div style={{ flex: 1, background: "rgba(16, 185, 129, 0.1)", border: `1px solid rgba(16, 185, 129, 0.25)`, padding: "12px 16px", borderRadius: 16, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
                <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{lang === "en" ? "Total Paid Back" : "إجمالي المسدد"}</div>
                <div style={{ fontSize: 18, color: D.emerald, fontWeight: 800 }}>EGP {totalFilteredPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", background: D.surfaceHigh, padding: "10px 14px", borderRadius: 12, border: `1px solid ${D.border}` }}>
                <div style={{ marginRight: 10, display: "flex", alignItems: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <input 
                  type="text" 
                  placeholder={lang === "en" ? "Search company, status, invoice..." : "ابحث عن الشركة، الحالة، الفاتورة..."}
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
              {filteredCredits.map((credit) => {
                const amountDue = Number(credit.amountDue) || 0;
                const tax = Number(credit.tax) || 0;
                const paidAmount = Number(credit.paidAmount) || 0;
                const priceAdjustment = Number(credit.priceAdjustment) || 0;
                const isExpanded = expandedItems[credit.id];
                const totalAmount = amountDue + tax;

                return (
                  <div key={credit.id} style={{ backgroundColor: D.surface, borderRadius: 20, padding: "20px", border: `1px solid ${D.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: D.amberDim, border: `1px solid ${D.amberBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Building size={18} color={D.amber} />
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: D.textPrimary, textTransform: "uppercase" }}>
                            {credit.companyName || "Credit"}
                          </div>
                          <div style={{ fontSize: 11, color: D.textDim, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <span style={{ 
                              padding: "2px 6px", 
                              borderRadius: 4, 
                              backgroundColor: credit.status === "closed" ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                              color: credit.status === "closed" ? D.emerald : D.amber,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              fontSize: 9
                            }}>
                              {credit.status || "open"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: D.textSecondary, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                          <Calendar size={10} /> {credit.collectionDate || credit.date}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: 28, fontWeight: 900, color: D.amber, marginBottom: 16, letterSpacing: "-0.02em" }}>
                      EGP {totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </div>

                    {/* Grid Details */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: `1px solid ${D.borderMid}`, paddingTop: 16, paddingBottom: 16 }}>
                        {credit.invoiceNumber && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <Hash size={12} color={D.textDim} />
                            <div>
                              <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Invoice" : "رقم الفاتورة"}</div>
                              <div style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{credit.invoiceNumber}</div>
                            </div>
                          </div>
                        )}
                        
                        {credit.poNumber && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <Hash size={12} color={D.textDim} />
                            <div>
                              <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "PO Number" : "رقم أمر الشراء"}</div>
                              <div style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{credit.poNumber}</div>
                            </div>
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <Building size={12} color={D.textDim} />
                          <div>
                            <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Base Amount" : "المبلغ الأساسي"}</div>
                            <div style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{amountDue.toLocaleString()}</div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <Percent size={12} color={D.textDim} />
                          <div>
                            <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Tax" : "الضريبة"}</div>
                            <div style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{tax.toLocaleString()}</div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <Building size={12} color={D.textDim} />
                          <div>
                            <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Paid Amount" : "المبلغ المسدد"}</div>
                            <div style={{ fontSize: 12, color: D.emerald, fontWeight: 600 }}>{paidAmount.toLocaleString()}</div>
                          </div>
                        </div>

                        {priceAdjustment > 0 && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <Building size={12} color={D.textDim} />
                            <div>
                              <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Price Adj." : "تعديل السعر"}</div>
                              <div style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{priceAdjustment.toLocaleString()}</div>
                            </div>
                          </div>
                        )}
                    </div>

                    {credit.createdBy && (
                      <div style={{ fontSize: 10, color: D.textDim, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                        <User size={10} /> {lang === "en" ? "Logged by:" : "بواسطة:"} {credit.createdBy}
                      </div>
                    )}

                    {credit.notes && (
                      <div style={{ fontSize: 12, color: D.textSecondary, display: "flex", gap: 6, alignItems: "flex-start", background: D.surfaceHigh, padding: "10px 14px", borderRadius: 10 }}>
                        <FileText size={14} style={{ marginTop: 2, flexShrink: 0, color: D.cyan }} />
                        <span style={{ lineHeight: 1.4 }}>{credit.notes}</span>
                      </div>
                    )}

                    {credit.items && credit.items.length > 0 && (
                      <div style={{ marginTop: 12, background: D.surfaceHigh, padding: "12px", borderRadius: 10 }}>
                        <div 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleExpand(credit.id);
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
                            {lang === "en" ? `Included Items (${credit.items.length})` : `العناصر المضمنة (${credit.items.length})`}
                          </div>
                          {isExpanded ? <ChevronUp size={14} color={D.textSecondary} /> : <ChevronDown size={14} color={D.textSecondary} />}
                        </div>
                        
                        {isExpanded && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                            {credit.items.map((item: any, idx: number) => (
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

              {filteredCredits.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: D.textDim, fontSize: 14 }}>
                  {lang === "en" ? "No credits recorded matching your filters." : "لا توجد ذمم تطابق بحثك."}
                </div>
              )}
            </div>
          </div>
        </PullToRefresh>
      </div>
    </div>
  );
}
