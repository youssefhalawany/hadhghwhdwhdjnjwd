"use client";

import React, { useState, useEffect } from "react";
import { db, messaging, dbService } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, FileText, Shield, Calendar, RefreshCw, LogOut, Activity, TrendingUp, Clock, AlertTriangle, Archive, Check, X } from "lucide-react";
import { RubberStamp } from "@/components/SkeuomorphicUX/RubberStamp";
import { DocumentShredder } from "@/components/SkeuomorphicUX/DocumentShredder";

// ── Design Tokens ────────────────────────────────────────────
const D = {
  bg:           "#0B1121",
  surface:      "#151E32",
  surfaceHigh:  "#1C2841",
  border:       "rgba(34, 211, 238, 0.15)",
  borderMid:    "rgba(34, 211, 238, 0.25)",
  textPrimary:  "#f8fafc",
  textSecondary:"#94a3b8",
  textDim:      "#64748b",
  cyan:         "#22d3ee",
  cyanDim:      "rgba(34, 211, 238, 0.1)",
  cyanBorder:   "rgba(34, 211, 238, 0.25)",
  red:          "#ef4444",
  redDim:       "rgba(239,68,68,0.12)",
  redBorder:    "rgba(239,68,68,0.30)",
  green:        "#34d399",
  greenDim:     "rgba(52,211,153,0.12)",
  greenBorder:  "rgba(52,211,153,0.25)",
  amber:        "#f59e0b",
  amberDim:     "rgba(245,158,11,0.12)",
  amberBorder:  "rgba(245,158,11,0.3)",
  blue:         "#60a5fa",
  blueDim:      "rgba(96,165,250,0.12)",
  blueBorder:   "rgba(96,165,250,0.3)",
};

function HeaderClock() {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span>· {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>;
}


const MemoizedShiftReportCard = React.memo(({ item, expandedId, setExpandedId, shredId, stampId, stampType, handleShredComplete, handleApproveAction, handleRejectAction, router }: any) => {
  const isExpanded = expandedId === item.id;
  const isPending = item.status === 'pending_manager';
  const systemSales = isPending ? null : ((item.managerAudit?.expectedCash || 0) + (item.managerAudit?.expectedVisa || 0));
  const actualSales = item.cashierCounts?.total || item.totalActualSales || 0;
  const shortOverage = isPending ? null : (item.managerAudit?.overShort ?? (actualSales - (systemSales || 0)));
  const totalDrops = item.safeDrops?.reduce((sum: number, drop: any) => sum + Number(drop.amount), 0) || 0;

  return (
    <DocumentShredder key={item.id} isShredding={shredId === item.id} onComplete={() => handleShredComplete(item.id)}>
      <RubberStamp stampType={stampId === item.id ? stampType : null}>
        <div className="feed-card" style={{ backgroundColor: D.surface, borderRadius: 20, border: `1px solid ${D.border}`, overflow: "hidden" }}>
          {/* Left accent bar */}
          <div style={{ display: "flex" }}>
            <div style={{ width: 4, flexShrink: 0, background: `linear-gradient(to bottom, ${D.blue}, ${D.cyan})`, borderRadius: "20px 0 0 20px" }} />
            <div style={{ flex: 1 }}>
              <div onClick={() => setExpandedId(isExpanded ? null : item.id)} style={{ padding: "16px 16px 16px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, flex: 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: D.blueDim, border: `1px solid ${D.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FileText size={18} color={D.blue} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary }}>{item.cashierDetails?.name}</div>
                    <div style={{ fontSize: 11, color: D.textSecondary, fontWeight: 600, marginTop: 3 }}>
                      {item.cashierDetails?.storeId} · {item.cashierDetails?.shift}
                    </div>
                    <div style={{ fontSize: 10, color: D.textDim, fontWeight: 600, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={10} /> {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 800, padding: "4px 8px", borderRadius: 6, border: "1px solid", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", flexShrink: 0, ...(isPending ? { background: D.amberDim, color: D.amber, borderColor: D.amberBorder } : { background: D.greenDim, color: D.green, borderColor: D.greenBorder }) }}>
                  {item.status?.replace("_", " ")}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: `1px solid ${D.border}`, cursor: "pointer" }} onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                {[
                  { label: "System", value: isPending ? "—" : `${Number(systemSales).toLocaleString()}`, sub: "EGP" },
                  { label: "Actual", value: Number(actualSales).toLocaleString(), sub: "EGP" },
                  { label: "Diff", value: isPending ? "—" : `${shortOverage! < 0 ? "-" : "+"}${Math.abs(shortOverage!).toLocaleString()}`, sub: "EGP", color: isPending ? D.textDim : shortOverage! < 0 ? D.red : shortOverage! > 0 ? D.blue : D.green },
                  { label: "Drops", value: Number(totalDrops).toLocaleString(), sub: "EGP" },
                ].map((stat, i) => (
                  <div key={i} style={{ padding: "10px 10px", textAlign: "center", borderRight: i < 3 ? `1px solid ${D.border}` : "none" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>{stat.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: stat.color || D.textPrimary, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {isExpanded && (
                <div style={{ padding: "16px", borderTop: `1px solid ${D.border}`, background: D.surfaceHigh, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Cash", value: `EGP ${Number(item.cashierCounts?.cash || 0).toLocaleString()}` },
                      { label: "Visa", value: `EGP ${Number(item.cashierCounts?.visa || 0).toLocaleString()}` },
                    ].map((r, i) => (
                      <div key={i} style={{ background: D.surface, borderRadius: 12, padding: "10px 14px", border: `1px solid ${D.border}` }}>
                        <div style={{ fontSize: 9, color: D.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{r.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{r.value}</div>
                      </div>
                    ))}
                  </div>
                  {item.expenses && item.expenses.length > 0 && (
                    <div style={{ background: D.surface, borderRadius: 12, padding: "12px 14px", border: `1px solid ${D.border}` }}>
                      <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Expenses</div>
                      {item.expenses.map((exp: any, i: number) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: D.textSecondary, padding: "4px 0", borderBottom: i < item.expenses.length - 1 ? `1px solid ${D.border}` : "none" }}>
                          <span>{exp.reason}</span>
                          <span style={{ color: D.red, fontWeight: 800 }}>{Number(exp.amount).toLocaleString()} EGP</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {item.managerAudit && (
                    <div style={{ background: D.surface, borderRadius: 12, padding: "12px 14px", border: `1px solid ${D.border}` }}>
                      <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Manager Audit</div>
                      <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600 }}>By: {item.managerAudit.managerName || item.managerAudit.auditedBy || 'Manager'}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: item.status === 'approved' ? D.green : D.red, marginTop: 4 }}>Status: {item.status}</div>
                      {item.managerAudit.comments && <div style={{ fontSize: 11, color: D.textDim, fontStyle: "italic", marginTop: 4 }}>"{item.managerAudit.comments}"</div>}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    {isPending && (
                      <>
                        <button onClick={(e) => handleApproveAction(item.id, e)} style={{ flex: 1, padding: "10px", borderRadius: 10, background: D.greenDim, border: `1px solid ${D.greenBorder}`, color: D.green, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <Check size={16} /> Approve
                        </button>
                        <button onClick={(e) => handleRejectAction(item.id, false, e)} style={{ flex: 1, padding: "10px", borderRadius: 10, background: D.redDim, border: `1px solid ${D.redBorder}`, color: D.red, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <X size={16} /> Reject
                        </button>
                      </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); router.push(`/shift-reports/view?id=${item.id}`); }} style={{ flex: 1, padding: "10px", borderRadius: 10, background: D.blueDim, border: `1px solid ${D.blueBorder}`, color: D.blue, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                      View Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </RubberStamp>
    </DocumentShredder>
  );
});

const MemoizedVoidRequestCard = React.memo(({ item, expandedId, setExpandedId, shredId, stampId, stampType, handleShredComplete, handleApproveAction, handleRejectAction }: any) => {
  const isExpanded = expandedId === item.id;
  return (
    <DocumentShredder key={item.id} isShredding={shredId === item.id} onComplete={() => handleShredComplete(item.id)}>
      <RubberStamp stampType={stampId === item.id ? stampType : null}>
        <div className="feed-card" style={{ backgroundColor: D.surface, borderRadius: 20, border: `1px solid ${D.border}`, overflow: "hidden" }}>
          <div style={{ display: "flex" }}>
            <div style={{ width: 4, flexShrink: 0, background: `linear-gradient(to bottom, ${D.red}, #f97316)`, borderRadius: "20px 0 0 20px" }} />
            <div style={{ flex: 1, padding: "16px 16px 16px 14px" }}>
              <div onClick={() => setExpandedId(isExpanded ? null : item.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, cursor: "pointer", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: D.redDim, border: `1px solid ${D.redBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Shield size={18} color={D.red} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary }}>{item.cashierDetails?.name || "Cashier"}</div>
                    <div style={{ fontSize: 11, color: D.textSecondary, fontWeight: 600, marginTop: 3 }}>
                      {item.cashierDetails?.storeId} · Ref: {item.receiptNumber || 'N/A'}
                    </div>
                    <div style={{ fontSize: 10, color: D.textDim, fontWeight: 600, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={10} /> {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 800, padding: "4px 8px", borderRadius: 6, border: "1px solid", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0, ...(item.status === 'approved' ? { background: D.greenDim, color: D.green, borderColor: D.greenBorder } : { background: D.redDim, color: D.red, borderColor: D.redBorder }) }}>
                  {item.status || "LOGGED"}
                </span>
              </div>
              <div style={{ background: D.redDim, border: `1px solid ${D.redBorder}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: D.red, fontVariantNumeric: "tabular-nums" }}>-EGP {Number(item.amount || 0).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600, marginTop: 4 }}>
                  <span style={{ color: D.textDim }}>Reason: </span>{item.reason || 'No reason provided'}
                </div>
                {item.managerApproval && (
                  <div style={{ fontSize: 11, color: D.green, fontWeight: 700, marginTop: 6 }}>✓ Approved by Manager ({item.managerApproval})</div>
                )}
              </div>
              {isExpanded && (
                <div style={{ marginTop: 12, padding: "12px 14px", background: D.surfaceHigh, borderRadius: 12, border: `1px solid ${D.border}` }}>
                  <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600, marginBottom: 12 }}>
                    <span style={{ color: D.textDim }}>Item Details: </span>{item.itemDetails || 'N/A'}
                  </div>
                  {item.status !== 'approved' && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={(e) => handleApproveAction(item.id, e)} style={{ flex: 1, padding: "8px", borderRadius: 8, background: D.greenDim, border: `1px solid ${D.greenBorder}`, color: D.green, fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <Check size={14} /> Authorize Void
                      </button>
                      <button onClick={(e) => handleRejectAction(item.id, true, e)} style={{ flex: 1, padding: "8px", borderRadius: 8, background: D.redDim, border: `1px solid ${D.redBorder}`, color: D.red, fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <X size={14} /> Reject & Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </RubberStamp>
    </DocumentShredder>
  );
});

const MemoizedExpiryCard = React.memo(({ item, expandedId, setExpandedId }: any) => {
  const isExpanded = expandedId === item.id;
  return (
    <div className="feed-card" onClick={() => setExpandedId(isExpanded ? null : item.id)} style={{ backgroundColor: D.surface, borderRadius: 20, border: `1px solid ${D.border}`, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ display: "flex" }}>
        <div style={{ width: 4, flexShrink: 0, background: `linear-gradient(to bottom, ${D.amber}, #f97316)`, borderRadius: "20px 0 0 20px" }} />
        <div style={{ flex: 1, padding: "16px 16px 16px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: D.amberDim, border: `1px solid ${D.amberBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Calendar size={18} color={D.amber} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary }}>{item.itemName}</div>
                <div style={{ fontSize: 11, color: D.textSecondary, fontWeight: 600, marginTop: 3 }}>
                  {item.storeId || item.branchId || 'Unknown Store'}
                </div>
                <div style={{ fontSize: 10, color: D.textDim, fontWeight: 600, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={10} /> {new Date(item.createdAt || item.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, padding: "4px 8px", borderRadius: 6, border: `1px solid ${D.amberBorder}`, background: D.amberDim, color: D.amber, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
              EXPIRED
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            <div style={{ background: D.surfaceHigh, borderRadius: 10, padding: "8px 12px", border: `1px solid ${D.border}` }}>
              <div style={{ fontSize: 9, color: D.textDim, fontWeight: 700, textTransform: "uppercase" }}>Quantity</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary, marginTop: 2 }}>{item.quantity} units</div>
            </div>
            {item.supplier && (
              <div style={{ background: D.surfaceHigh, borderRadius: 10, padding: "8px 12px", border: `1px solid ${D.border}` }}>
                <div style={{ fontSize: 9, color: D.textDim, fontWeight: 700, textTransform: "uppercase" }}>Supplier</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary, marginTop: 2 }}>{item.supplier}</div>
              </div>
            )}
          </div>
          {isExpanded && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: D.surfaceHigh, borderRadius: 12, border: `1px solid ${D.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600 }}><span style={{ color: D.textDim }}>Expiry Date: </span>{item.expiryDate || 'N/A'}</div>
              <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600 }}><span style={{ color: D.textDim }}>Logged By: </span>{item.loggedBy || 'Unknown'}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const MemoizedCleaningCard = React.memo(({ item, expandedId, setExpandedId }: any) => {
  const isExpanded = expandedId === item.id;
  return (
    <div className="feed-card" onClick={() => setExpandedId(isExpanded ? null : item.id)} style={{ backgroundColor: D.surface, borderRadius: 20, border: `1px solid ${D.border}`, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ display: "flex" }}>
        <div style={{ width: 4, flexShrink: 0, background: `linear-gradient(to bottom, ${D.cyan}, ${D.blue})`, borderRadius: "20px 0 0 20px" }} />
        <div style={{ flex: 1, padding: "16px 16px 16px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: D.cyanDim, border: `1px solid ${D.cyanBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Activity size={18} color={D.cyan} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary }}>Cleaning: {item.areaNameEn || 'Area'}</div>
                <div style={{ fontSize: 11, color: D.textSecondary, fontWeight: 600, marginTop: 3 }}>
                  {item.cashierName || 'Unknown'}
                </div>
                <div style={{ fontSize: 10, color: D.textDim, fontWeight: 600, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={10} /> {new Date(item.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, padding: "4px 8px", borderRadius: 6, border: `1px solid ${D.cyanBorder}`, background: D.cyanDim, color: D.cyan, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
              CLEANING
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

const MemoizedOutOfStockCard = React.memo(({ item, expandedId, setExpandedId }: any) => {
  const isExpanded = expandedId === item.id;
  return (
    <div className="feed-card" onClick={() => setExpandedId(isExpanded ? null : item.id)} style={{ backgroundColor: D.surface, borderRadius: 20, border: `1px solid ${D.border}`, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ display: "flex" }}>
        <div style={{ width: 4, flexShrink: 0, background: `linear-gradient(to bottom, ${D.amber}, ${D.red})`, borderRadius: "20px 0 0 20px" }} />
        <div style={{ flex: 1, padding: "16px 16px 16px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: D.amberDim, border: `1px solid ${D.amberBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle size={18} color={D.amber} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary }}>Out of Stock Log</div>
                <div style={{ fontSize: 11, color: D.textSecondary, fontWeight: 600, marginTop: 3 }}>
                  {item.cashierName || 'Unknown'} · {item.storeId || 'Store'}
                </div>
                <div style={{ fontSize: 10, color: D.textDim, fontWeight: 600, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={10} /> {new Date(item.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, padding: "4px 8px", borderRadius: 6, border: `1px solid ${D.amberBorder}`, background: D.amberDim, color: D.amber, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
              OOS
            </span>
          </div>
          {isExpanded && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: D.surfaceHigh, borderRadius: 12, border: `1px solid ${D.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600 }}><span style={{ color: D.textDim }}>Total Missing Qty: </span>{item.totalMissingQuantity}</div>
              <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600 }}><span style={{ color: D.textDim }}>Total Value: </span>EGP {Number(item.totalValue || 0).toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const MemoizedLostAndFoundCard = React.memo(({ item, expandedId, setExpandedId }: any) => {
  const isExpanded = expandedId === item.id;
  return (
    <div className="feed-card" onClick={() => setExpandedId(isExpanded ? null : item.id)} style={{ backgroundColor: D.surface, borderRadius: 20, border: `1px solid ${D.border}`, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ display: "flex" }}>
        <div style={{ width: 4, flexShrink: 0, background: `linear-gradient(to bottom, ${D.blue}, ${D.green})`, borderRadius: "20px 0 0 20px" }} />
        <div style={{ flex: 1, padding: "16px 16px 16px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: D.blueDim, border: `1px solid ${D.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Archive size={18} color={D.blue} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: D.textPrimary }}>Lost & Found</div>
                <div style={{ fontSize: 11, color: D.textSecondary, fontWeight: 600, marginTop: 3 }}>
                  {item.cashierName || 'Unknown'} · {item.storeId || 'Store'}
                </div>
                <div style={{ fontSize: 10, color: D.textDim, fontWeight: 600, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={10} /> {new Date(item.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, padding: "4px 8px", borderRadius: 6, border: `1px solid ${D.blueBorder}`, background: D.blueDim, color: D.blue, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
              FOUND
            </span>
          </div>
          {isExpanded && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: D.surfaceHigh, borderRadius: 12, border: `1px solid ${D.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600 }}><span style={{ color: D.textDim }}>Description: </span>{item.description}</div>
              <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600 }}><span style={{ color: D.textDim }}>Location: </span>{item.locationFound}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default function MasterCashierDashboard() {
  const router = useRouter();
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Skeuomorphic State
  const [stampId, setStampId] = useState<string | null>(null);
  const [stampType, setStampType] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [shredId, setShredId] = useState<string | null>(null);

  const handleApproveAction = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStampId(id);
    setStampType("APPROVED");
    setTimeout(() => { setStampId(null); setStampType(null); }, 2500);
  };

  const handleRejectAction = (id: string, isVoid: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isVoid) {
      setShredId(id);
    } else {
      setStampId(id);
      setStampType("REJECTED");
      setTimeout(() => { setStampId(null); setStampType(null); }, 2500);
    }
  };

  const handleShredComplete = (id: string) => {
    setFeed(prev => prev.filter(f => f.id !== id));
    setShredId(null);
  };

  useEffect(() => {
    const session = localStorage.getItem("active_cashier_session");
    if (!session) { router.push("/cashier"); return; }
    const user = JSON.parse(session);
    if (user.role !== "master") { router.push("/cashier"); return; }
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") setIsNotificationEnabled(true);
    }
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const reportsQuery = query(collection(db, "shift_reports"), orderBy("createdAt", "desc"), limit(10));
      const voidsQuery = query(collection(db, "void_requests"), orderBy("createdAt", "desc"), limit(10));
      const expiriesQuery = query(collection(db, "expiries"), orderBy("createdAt", "desc"), limit(10));
      const cleaningQuery = query(collection(db, "cleaning_logs"), orderBy("timestamp", "desc"), limit(10));
      const outOfStockQuery = query(collection(db, "out_of_stock_logs"), orderBy("timestamp", "desc"), limit(10));
      const lostQuery = query(collection(db, "lost_and_found"), orderBy("timestamp", "desc"), limit(10));

      const [
        reportsSnap,
        voidsSnap,
        expiriesSnap,
        cleaningSnap,
        outOfStockSnap,
        lostSnap
      ] = await Promise.all([
        getDocs(reportsQuery),
        getDocs(voidsQuery),
        getDocs(expiriesQuery),
        getDocs(cleaningQuery),
        getDocs(outOfStockQuery),
        getDocs(lostQuery)
      ]);

      const reports = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id, _type: "shift_report" }));
      const voids = voidsSnap.docs.map(d => ({ ...d.data(), id: d.id, _type: "void_request" }));
      const expiries = expiriesSnap.docs.map(d => ({ ...d.data(), id: d.id, _type: "expiry" }));
      const cleaning = cleaningSnap.docs.map(d => ({ ...d.data(), id: d.id, _type: "cleaning" }));
      const outOfStock = outOfStockSnap.docs.map(d => ({ ...d.data(), id: d.id, _type: "out_of_stock" }));
      const lostAndFound = lostSnap.docs.map(d => ({ ...d.data(), id: d.id, _type: "lost_and_found" }));

      const all = [...reports, ...voids, ...expiries, ...cleaning, ...outOfStock, ...lostAndFound];
      all.sort((a: any, b: any) => {
        const dateA = a.createdAt || a.timestamp;
        const dateB = b.createdAt || b.timestamp;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      setFeed(all.slice(0, 30));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) { alert("This browser does not support notifications."); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted" && messaging) {
        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const messagingInstance = await messaging;
        if (messagingInstance) {
          const token = await getToken(messagingInstance, {
            vapidKey: "BHiDvLTbQ2DTED8p7X1BQ8Vu811fuu3dmpVfclmA5P7n-DuRltU7kkai9E2_2VkbLpS7Ns5ekNQClP5CsTeWf7M",
            serviceWorkerRegistration: swReg
          });
          if (token) {
            await dbService.setDoc("user_tokens", "master_youssef", {
              fcmToken: token, name: "Mr Youssef", role: "master", updatedAt: new Date().toISOString()
            });
            setIsNotificationEnabled(true);
            alert("Master Notifications enabled successfully!");
          }
        }
      } else {
        alert("Notification permission denied. Please enable in your device settings.");
      }
    } catch (err: any) { console.error(err); alert("Failed to enable notifications. Error: " + err.message); }
  };

  const handleLogout = () => {
    localStorage.removeItem("active_cashier_session");
    router.push("/cashier");
  };

  const root: React.CSSProperties = {
    backgroundColor: D.bg, color: D.textPrimary, minHeight: "100dvh",
    fontFamily: "'Inter', 'Cairo', -apple-system, system-ui, sans-serif",
    colorScheme: "dark",
  };

  if (loading) return (
    <div style={{ ...root, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#b91c1c,#ef4444)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 900, color: "#fff", boxShadow: "0 0 40px rgba(239,68,68,0.4)" }}>K</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: D.cyan, opacity: 0.7, animation: `bounce 1s ${i*0.15}s infinite` }} />
        ))}
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: D.textSecondary, letterSpacing: "0.1em" }}>LOADING MASTER FEED...</span>
    </div>
  );

  return (
    <div style={root}>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .feed-card { transition: border-color 0.15s, background 0.15s; }
        .feed-card:hover { border-color: ${D.cyanBorder} !important; }
        .icon-btn { transition: background 0.15s; cursor: pointer; border: none; }
        .icon-btn:hover { opacity: 0.8; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: D.bg, borderBottom: `1px solid ${D.border}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="icon-btn" onClick={() => router.push("/cashier")} style={{ width: 34, height: 34, borderRadius: 10, background: D.surfaceHigh, border: `1px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={16} color={D.textSecondary} />
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: D.textPrimary, letterSpacing: "0.05em" }}>
              MASTER FEED
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: D.green, animation: "pulse-dot 2s infinite" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: D.green, textTransform: "uppercase", letterSpacing: "0.1em" }}>LIVE</span>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
              Active Session <HeaderClock />
            </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="icon-btn" onClick={handleEnableNotifications} style={{ width: 36, height: 36, borderRadius: 10, background: isNotificationEnabled ? D.greenDim : D.surfaceHigh, border: `1px solid ${isNotificationEnabled ? D.greenBorder : D.border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <Bell size={16} color={isNotificationEnabled ? D.green : D.textSecondary} />
            {isNotificationEnabled && <span style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: "50%", backgroundColor: D.green, border: `2px solid ${D.bg}` }} />}
          </button>
          <button className="icon-btn" onClick={fetchFeed} style={{ width: 36, height: 36, borderRadius: 10, background: D.surfaceHigh, border: `1px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={16} color={D.cyan} />
          </button>
          <button className="icon-btn" onClick={handleLogout} style={{ width: 36, height: 36, borderRadius: 10, background: D.redDim, border: `1px solid ${D.redBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LogOut size={16} color={D.red} />
          </button>
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, borderBottom: `1px solid ${D.border}` }}>
        {[
          { label: "SHIFT REPORTS", value: feed.filter(f => f._type === "shift_report").length, color: D.blue, dim: D.blueDim },
          { label: "VOIDS / RETURNS", value: feed.filter(f => f._type === "void_request").length, color: D.red, dim: D.redDim },
          { label: "EXPIRY LOGS", value: feed.filter(f => f._type === "expiry").length, color: D.amber, dim: D.amberDim },
        ].map((s, i) => (
          <div key={i} style={{ padding: "14px 16px", background: D.surface, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── FEED ── */}
      <div style={{ padding: "16px 16px 100px", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: D.textDim, textTransform: "uppercase", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <Activity size={12} color={D.cyan} /> OPERATIONAL FEED
        </div>

        {feed.map((item) => {
          if (item._type === "shift_report") return <MemoizedShiftReportCard key={item.id} item={item} expandedId={expandedId} setExpandedId={setExpandedId} shredId={shredId} stampId={stampId} stampType={stampType} handleShredComplete={handleShredComplete} handleApproveAction={handleApproveAction} handleRejectAction={handleRejectAction} router={router} />;
          if (item._type === "void_request") return <MemoizedVoidRequestCard key={item.id} item={item} expandedId={expandedId} setExpandedId={setExpandedId} shredId={shredId} stampId={stampId} stampType={stampType} handleShredComplete={handleShredComplete} handleApproveAction={handleApproveAction} handleRejectAction={handleRejectAction} />;
          if (item._type === "expiry") return <MemoizedExpiryCard key={item.id} item={item} expandedId={expandedId} setExpandedId={setExpandedId} />;
          if (item._type === "cleaning") return <MemoizedCleaningCard key={item.id} item={item} expandedId={expandedId} setExpandedId={setExpandedId} />;
          if (item._type === "out_of_stock") return <MemoizedOutOfStockCard key={item.id} item={item} expandedId={expandedId} setExpandedId={setExpandedId} />;
          if (item._type === "lost_and_found") return <MemoizedLostAndFoundCard key={item.id} item={item} expandedId={expandedId} setExpandedId={setExpandedId} />;
          return null;
        })}        {feed.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: D.textDim }}>
            <Activity size={40} color={D.textDim} style={{ margin: "0 auto 12px", display: "block" }} />
            <div style={{ fontWeight: 700, fontSize: 14 }}>No recent activity.</div>
          </div>
        )}
      </div>
    </div>
  );
}
