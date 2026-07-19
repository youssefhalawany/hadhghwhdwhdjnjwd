"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { PullToRefresh } from "@/components/MobileUX/PullToRefresh";
import { showIsland } from "@/components/MobileUX/DynamicIsland";
import { useLanguage } from "@/context/LanguageContext";
import { playPopSound } from "@/lib/sounds";
import { TrendingUp, Calendar, Clock, User, Sun, Moon, FileText } from "lucide-react";

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
  green: "#34d399",
  greenDim: "rgba(52,211,153,0.12)",
  greenBorder: "rgba(52,211,153,0.25)",
  emerald: "#10b981",
  amber: "#f59e0b",
  amberDim: "rgba(245, 158, 11, 0.1)",
  amberBorder: "rgba(245, 158, 11, 0.25)",
  blue: "#3b82f6",
  blueDim: "rgba(59, 130, 246, 0.1)",
  blueBorder: "rgba(59, 130, 246, 0.25)",
};

export default function OwnerSalesPage() {
  const { language: lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewMode, setViewMode] = useState<"detailed" | "grouped">("detailed");

  const loadData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "sales"), orderBy("createdAt", "desc"), limit(300));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(data);
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
    showIsland("Sales Updated", { type: "success" });
  };

  const filteredSales = sales.filter(s => {
    if (dateFrom && s.date < dateFrom) return false;
    if (dateTo && s.date > dateTo) return false;
    if (searchQuery) {
       const q = searchQuery.toLowerCase();
       return s.cashierName?.toLowerCase().includes(q) || s.shift?.toLowerCase().includes(q) || s.notes?.toLowerCase().includes(q);
    }
    return true;
  });

  const totalFilteredSales = filteredSales.reduce((acc, s) => acc + (Number(s.cash) || 0) + (Number(s.visa) || 0), 0);
  const totalFilteredOverShort = filteredSales.reduce((acc, s) => acc + (Number(s.overShort) || 0), 0);

  const groupedSales = useMemo(() => {
    const groups: Record<string, any> = {};
    filteredSales.forEach(s => {
      const d = s.date || "Unknown Date";
      if (!groups[d]) {
        groups[d] = {
          id: `group-${d}`,
          date: d,
          cash: 0,
          visa: 0,
          overShort: 0,
          isGrouped: true,
          count: 0
        };
      }
      groups[d].cash += (Number(s.cash) || 0);
      groups[d].visa += (Number(s.visa) || 0);
      groups[d].overShort += (Number(s.overShort) || 0);
      groups[d].count += 1;
    });
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredSales]);

  const displayedSales = viewMode === "grouped" ? groupedSales : filteredSales;

  if (loading) {
    return (
      <div style={{ padding: "54px 20px 20px", maxWidth: 800, margin: "0 auto" }}>
          <div style={{ height: 30, width: 120, backgroundColor: D.surfaceHigh, borderRadius: 8, marginBottom: 20, animation: "pulse 2s infinite" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ height: 160, backgroundColor: D.surface, borderRadius: 20, animation: "pulse 2s infinite" }} />
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
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: D.textPrimary }}>{lang === "en" ? "Sales" : "المبيعات"}</h1>
                <p style={{ fontSize: 14, color: D.textSecondary, marginTop: 4 }}>{lang === "en" ? "Recent financial input records" : "سجلات الإدخال المالي الأخيرة"}</p>
            </div>

            {/* Totals Bar */}
            <div style={{ position: "sticky", top: 16, zIndex: 10, display: "flex", gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, background: "rgba(16, 185, 129, 0.1)", border: `1px solid ${D.greenBorder}`, padding: "12px 16px", borderRadius: 16, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
                <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{lang === "en" ? "Total Sales" : "إجمالي المبيعات"}</div>
                <div style={{ fontSize: 18, color: D.emerald, fontWeight: 800 }}>EGP {totalFilteredSales.toLocaleString()}</div>
              </div>
              <div style={{ flex: 1, background: "rgba(244, 63, 94, 0.1)", border: `1px solid rgba(244, 63, 94, 0.2)`, padding: "12px 16px", borderRadius: 16, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
                <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{lang === "en" ? "Over/Short" : "العجز/الزيادة"}</div>
                <div style={{ fontSize: 18, color: totalFilteredOverShort < 0 ? D.red : D.green, fontWeight: 800 }}>
                  {totalFilteredOverShort > 0 ? "+" : ""}EGP {totalFilteredOverShort.toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", background: D.surfaceHigh, padding: "10px 14px", borderRadius: 12, border: `1px solid ${D.border}` }}>
                <div style={{ marginRight: 10, display: "flex", alignItems: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <input 
                  type="text" 
                  placeholder={lang === "en" ? "Search shift, cashier, notes..." : "ابحث عن الوردية، الكاشير، الملاحظات..."}
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

            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button 
                onClick={() => { setViewMode("detailed"); playPopSound(); }}
                style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 700, border: `1px solid ${viewMode === "detailed" ? D.blueBorder : D.border}`, background: viewMode === "detailed" ? D.blueDim : D.surfaceHigh, color: viewMode === "detailed" ? D.blue : D.textPrimary }}
              >
                {lang === "en" ? "Detailed View" : "عرض مفصل"}
              </button>
              <button 
                onClick={() => { setViewMode("grouped"); playPopSound(); }}
                style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 700, border: `1px solid ${viewMode === "grouped" ? D.greenBorder : D.border}`, background: viewMode === "grouped" ? D.greenDim : D.surfaceHigh, color: viewMode === "grouped" ? D.green : D.textPrimary }}
              >
                {lang === "en" ? "Grouped by Day" : "تجميع باليوم"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {displayedSales.map((sale: any) => {
                const totalCash = Number(sale.cash) || 0;
                const totalVisa = Number(sale.visa) || 0;
                const totalSales = totalCash + totalVisa;
                const overShort = Number(sale.overShort) || 0;

                if (sale.isGrouped) {
                  return (
                    <div key={sale.id} style={{ backgroundColor: D.surface, borderRadius: 20, padding: "20px", border: `1px solid ${D.border}` }}>
                      <div style={{ display: "flex", justifyItems: "space-between", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ 
                            width: 36, height: 36, borderRadius: 10, 
                            background: D.greenDim, 
                            border: `1px solid ${D.greenBorder}`, 
                            display: "flex", alignItems: "center", justifyContent: "center" 
                          }}>
                              <Calendar size={18} color={D.green} />
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary }}>
                              {lang === "en" ? "Daily Total" : "إجمالي اليوم"}
                            </div>
                            <div style={{ fontSize: 11, color: D.textDim, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                              <FileText size={10} /> {sale.count} {lang === "en" ? "Transactions" : "عمليات"}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: D.textSecondary, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                            <Calendar size={10} /> {sale.date}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: 24, fontWeight: 800, color: D.textPrimary, marginBottom: 16 }}>
                        EGP {totalSales.toLocaleString()}
                      </div>

                      <div style={{ display: "flex", gap: 12, borderTop: `1px solid ${D.borderMid}`, paddingTop: 12 }}>
                          <div>
                              <div style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Cash" : "كاش"}</div>
                              <div style={{ fontSize: 13, color: D.green, fontWeight: 700 }}>{totalCash.toLocaleString()}</div>
                          </div>
                          <div style={{ width: 1, backgroundColor: D.borderMid }} />
                          <div>
                              <div style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Visa" : "فيزا"}</div>
                              <div style={{ fontSize: 13, color: D.blue, fontWeight: 700 }}>{totalVisa.toLocaleString()}</div>
                          </div>
                          <div style={{ width: 1, backgroundColor: D.borderMid }} />
                          <div>
                              <div style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Over/Short" : "العجز/الزيادة"}</div>
                              <div style={{ fontSize: 13, color: overShort < 0 ? D.red : D.green, fontWeight: 700 }}>{overShort.toLocaleString()}</div>
                          </div>
                      </div>
                    </div>
                  );
                }

                const isNight = sale.shift?.toLowerCase() === "night";

                return (
                  <div key={sale.id} style={{ backgroundColor: D.surface, borderRadius: 20, padding: "20px", border: `1px solid ${D.border}` }}>
                    <div style={{ display: "flex", justifyItems: "space-between", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ 
                          width: 36, height: 36, borderRadius: 10, 
                          background: isNight ? D.blueDim : D.amberDim, 
                          border: `1px solid ${isNight ? D.blueBorder : D.amberBorder}`, 
                          display: "flex", alignItems: "center", justifyContent: "center" 
                        }}>
                            {isNight ? <Moon size={18} color={D.blue} /> : <Sun size={18} color={D.amber} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary, textTransform: "capitalize" }}>
                            {lang === "en" ? `${sale.shift || "Unknown"} Shift` : (isNight ? "وردية ليلية" : "وردية صباحية")}
                          </div>
                          <div style={{ fontSize: 11, color: D.textDim, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <User size={10} /> {sale.cashierName || (lang === "en" ? "Unknown" : "غير معروف")}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: D.textSecondary, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                          <Calendar size={10} /> {sale.date}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: 24, fontWeight: 800, color: D.textPrimary, marginBottom: 16 }}>
                      EGP {totalSales.toLocaleString()}
                    </div>

                    <div style={{ display: "flex", gap: 12, borderTop: `1px solid ${D.borderMid}`, paddingTop: 12 }}>
                        <div>
                            <div style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Cash" : "كاش"}</div>
                            <div style={{ fontSize: 13, color: D.green, fontWeight: 700 }}>{totalCash.toLocaleString()}</div>
                        </div>
                        <div style={{ width: 1, backgroundColor: D.borderMid }} />
                        <div>
                            <div style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Visa" : "فيزا"}</div>
                            <div style={{ fontSize: 13, color: D.blue, fontWeight: 700 }}>{totalVisa.toLocaleString()}</div>
                        </div>
                        <div style={{ width: 1, backgroundColor: D.borderMid }} />
                        <div>
                            <div style={{ fontSize: 10, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Over/Short" : "العجز/الزيادة"}</div>
                            <div style={{ fontSize: 13, color: overShort < 0 ? D.red : D.green, fontWeight: 700 }}>{overShort.toLocaleString()}</div>
                        </div>
                    </div>

                    {sale.notes && (
                      <div style={{ fontSize: 12, color: D.textSecondary, display: "flex", gap: 6, alignItems: "flex-start", background: D.surfaceHigh, padding: "8px 12px", borderRadius: 8, marginTop: 12 }}>
                        <FileText size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>{sale.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {displayedSales.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: D.textDim, fontSize: 14 }}>
                  {lang === "en" ? "No sales records found matching your filters." : "لا توجد سجلات مبيعات تطابق بحثك."}
                </div>
              )}
            </div>
          </div>
        </PullToRefresh>
      </div>
    </div>
  );
}
