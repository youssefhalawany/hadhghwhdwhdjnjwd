"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { PullToRefresh } from "@/components/MobileUX/PullToRefresh";
import { showIsland } from "@/components/MobileUX/DynamicIsland";
import { useLanguage } from "@/context/LanguageContext";
import { playPopSound } from "@/lib/sounds";
import { ArrowDownToLine, Calendar, User, FileText, ArrowRight, Building, Hash } from "lucide-react";

const D = {
  bg: "#0B1121",
  surface: "#151E32",
  surfaceHigh: "#1C2841",
  border: "rgba(34, 211, 238, 0.15)",
  borderMid: "rgba(34, 211, 238, 0.25)",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  textDim: "#64748b",
  cyan: "#22d3ee",
  cyanDim: "rgba(34, 211, 238, 0.1)",
  cyanBorder: "rgba(34, 211, 238, 0.25)",
  green: "#34d399",
  blue: "#60a5fa",
  blueDim: "rgba(96, 165, 250, 0.1)",
  blueBorder: "rgba(96, 165, 250, 0.25)",
  emerald: "#10b981",
  emeraldDim: "rgba(16, 185, 129, 0.1)",
  emeraldBorder: "rgba(16, 185, 129, 0.25)",
  greenDim: "rgba(16, 185, 129, 0.1)",
  greenBorder: "rgba(16, 185, 129, 0.25)",
};

export default function OwnerDepositsPage() {
  const { language: lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "deposits"), orderBy("createdAt", "desc"), limit(300));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeposits(data);
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
    showIsland("Deposits Updated", { type: "success" });
  };

  const filteredDeposits = deposits.filter(d => {
    if (dateFrom && d.date < dateFrom) return false;
    if (dateTo && d.date > dateTo) return false;
    if (searchQuery) {
       const q = searchQuery.toLowerCase();
       return d.bankName?.toLowerCase().includes(q) || 
              d.accountName?.toLowerCase().includes(q) || 
              d.receiptNumber?.toLowerCase().includes(q) ||
              d.notes?.toLowerCase().includes(q) ||
              d.createdBy?.toLowerCase().includes(q);
    }
    return true;
  });

  const totalFilteredDeposits = filteredDeposits.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
  const totalFilteredCount = filteredDeposits.length;

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
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: D.textPrimary }}>{lang === "en" ? "Deposits" : "الإيداعات"}</h1>
                <p style={{ fontSize: 14, color: D.textSecondary, marginTop: 4 }}>{lang === "en" ? "Bank deposits and transfers" : "الإيداعات والتحويلات البنكية"}</p>
            </div>

            {/* Totals Bar */}
            <div style={{ position: "sticky", top: 16, zIndex: 10, display: "flex", gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, background: "rgba(16, 185, 129, 0.1)", border: `1px solid rgba(16, 185, 129, 0.25)`, padding: "12px 16px", borderRadius: 16, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
                <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{lang === "en" ? "Total Deposits" : "إجمالي الإيداعات"}</div>
                <div style={{ fontSize: 18, color: D.emerald, fontWeight: 800 }}>EGP {totalFilteredDeposits.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
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
                  placeholder={lang === "en" ? "Search bank, account, receipt..." : "ابحث عن بنك، حساب، إيصال..."}
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
              {filteredDeposits.map((deposit) => {
                const amount = Number(deposit.amount) || 0;

                return (
                  <div key={deposit.id} style={{ backgroundColor: D.surface, borderRadius: 20, padding: "20px", border: `1px solid ${D.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: D.emeraldDim, border: `1px solid ${D.emeraldBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Building size={18} color={D.emerald} />
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: D.textPrimary, textTransform: "uppercase" }}>
                            {deposit.bankName || "Deposit"}
                          </div>
                          <div style={{ fontSize: 11, color: D.textDim, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            {deposit.accountName}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: D.textSecondary, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                          <Calendar size={10} /> {deposit.date}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: 28, fontWeight: 900, color: D.emerald, marginBottom: 16, letterSpacing: "-0.02em" }}>
                      EGP {amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </div>

                    {/* Grid Details */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, borderTop: `1px solid ${D.borderMid}`, paddingTop: 16, paddingBottom: 16 }}>
                        {deposit.receiptNumber && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <Hash size={12} color={D.textDim} />
                            <div>
                              <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Receipt Number" : "رقم الإيصال"}</div>
                              <div style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{deposit.receiptNumber}</div>
                            </div>
                          </div>
                        )}
                        
                        {deposit.depositType && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <Hash size={12} color={D.textDim} />
                            <div>
                              <div style={{ fontSize: 9, color: D.textDim, textTransform: "uppercase", fontWeight: 700 }}>{lang === "en" ? "Deposit Type" : "نوع الإيداع"}</div>
                              <div style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600, textTransform: "capitalize" }}>{deposit.depositType.replace('_', ' ')}</div>
                            </div>
                          </div>
                        )}
                    </div>

                    {deposit.createdBy && (
                      <div style={{ fontSize: 10, color: D.textDim, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                        <User size={10} /> {lang === "en" ? "Logged by:" : "بواسطة:"} {deposit.createdBy}
                      </div>
                    )}

                    {deposit.notes && (
                      <div style={{ fontSize: 12, color: D.textSecondary, display: "flex", gap: 6, alignItems: "flex-start", background: D.surfaceHigh, padding: "10px 14px", borderRadius: 10 }}>
                        <FileText size={14} style={{ marginTop: 2, flexShrink: 0, color: D.cyan }} />
                        <span style={{ lineHeight: 1.4 }}>{deposit.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredDeposits.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: D.textDim, fontSize: 14 }}>
                  {lang === "en" ? "No deposits recorded matching your filters." : "لا توجد إيداعات تطابق بحثك."}
                </div>
              )}
            </div>
          </div>
        </PullToRefresh>
      </div>
    </div>
  );
}
