"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FileText, Calendar, Clock, User, Store, Banknote, Package, CheckCircle, XCircle } from "lucide-react";

function PublicShiftReportContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") as string;
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      try {
        if (!id) return;
        const snap = await getDoc(doc(db, "shift_reports", id));
        if (snap.exists()) {
          setReport(snap.data());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [id]);

  const formatTimeMinus2Hours = (dateString: string) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    d.setHours(d.getHours() - 2);
    return d.toLocaleString('en-GB');
  };

  if (loading) return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-600"></div></div>;
  if (!report) return <div className="p-10 text-center text-xl font-bold">Report not found</div>;

  const isApproved = report.status === "approved";
  const isRejected = report.status === "rejected";

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <div className="text-center py-6 border-b border-border">
        <div className="w-16 h-16 bg-red-600 rounded-full mx-auto flex items-center justify-center mb-4">
          <span className="text-3xl font-black text-white">K</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight">Shift Details</h1>
        <p className="text-muted-foreground font-mono text-sm mt-2">{id.substring(0, 10).toUpperCase()}</p>
        
        <div className="mt-4 flex justify-center">
          {isApproved ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold">
              <CheckCircle className="h-4 w-4" /> Approved
            </span>
          ) : isRejected ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">
              <XCircle className="h-4 w-4" /> Rejected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-bold">
              <Clock className="h-4 w-4" /> Pending Manager Audit
            </span>
          )}
        </div>
      </div>

      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <h2 className="font-bold text-lg border-b border-border pb-2 flex items-center gap-2">
          <Store className="h-5 w-5 text-red-500" /> General Info
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase font-bold">Cashier</p>
            <p className="font-semibold">{report.cashierDetails.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase font-bold">Store ID</p>
            <p className="font-semibold">{report.cashierDetails.storeId}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase font-bold">Date</p>
            <p className="font-semibold">{report.cashierDetails.date}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase font-bold">Shift</p>
            <p className="font-semibold">{report.cashierDetails.shift}</p>
          </div>
          <div className="col-span-2">
            <p className="text-muted-foreground text-xs uppercase font-bold">Submitted At</p>
            <p className="font-semibold font-mono">{formatTimeMinus2Hours(report.createdAt)}</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <h2 className="font-bold text-lg border-b border-border pb-2 flex items-center gap-2">
          <Banknote className="h-5 w-5 text-emerald-500" /> Financials
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Actual Cash</span>
            <span className="font-mono font-bold text-emerald-600">{Number(report?.cashierCounts?.cash || 0).toFixed(2)} EGP</span>
          </div>

          {report?.cashierCounts?.denominations && (
            <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 text-xs">
              <p className="font-bold text-slate-500 mb-2 border-b border-emerald-100 pb-1">Cash Breakdown</p>
              <div className="grid grid-cols-2 gap-2 font-mono">
                {Object.entries(report.cashierCounts.denominations).map(([bill, count]) => {
                  if (!count || count === 0 || count === "0") return null;
                  return (
                    <div key={bill} className="flex justify-between bg-white p-1 px-2 rounded border border-emerald-50">
                      <span className="text-slate-500">{bill === 'coins' ? 'Coins' : `${bill} x`}</span>
                      <span className="font-bold text-slate-700">{String(count)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <span className="text-muted-foreground">Total Visa</span>
            <span className="font-mono font-bold text-blue-600">{Number(report?.cashierCounts?.visa || 0).toFixed(2)} EGP</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="font-bold">Total Drops</span>
            <span className="font-mono font-black text-lg">{Number(report?.cashierCounts?.total || 0).toFixed(2)} EGP</span>
          </div>
        </div>
      </div>

      {(report?.cashierRole === 1 || report?.cashierRole === "1") && report?.inventoryCounts && (
        <div className="glass-panel p-5 rounded-2xl space-y-4">
          <h2 className="font-bold text-lg border-b border-border pb-2 flex items-center gap-2">
            <Package className="h-5 w-5 text-orange-500" /> Inventory
          </h2>
          <div className="space-y-4">
            <div>
              <p className="font-bold mb-2">Cigarettes (Packs)</p>
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                <div className="bg-muted p-2 rounded">St: {report.inventoryCounts.cigarettes?.start || 0}</div>
                <div className="bg-emerald-500/10 text-emerald-600 p-2 rounded">In: {report.inventoryCounts.cigarettes?.delivery || 0}</div>
                <div className="bg-red-500/10 text-red-600 p-2 rounded">End: {report.inventoryCounts.cigarettes?.end || 0}</div>
                <div className="bg-slate-900 text-white p-2 rounded font-bold">={report.inventoryCounts.cigarettes?.sold || 0}</div>
              </div>
            </div>
            <div>
              <p className="font-bold mb-2">Lighters (Units)</p>
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                <div className="bg-muted p-2 rounded">St: {report.inventoryCounts.lighters?.start || 0}</div>
                <div className="bg-emerald-500/10 text-emerald-600 p-2 rounded">In: {report.inventoryCounts.lighters?.delivery || 0}</div>
                <div className="bg-red-500/10 text-red-600 p-2 rounded">End: {report.inventoryCounts.lighters?.end || 0}</div>
                <div className="bg-slate-900 text-white p-2 rounded font-bold">={report.inventoryCounts.lighters?.sold || 0}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {report.managerAudit && (
        <div className="glass-panel p-5 rounded-2xl space-y-4 border-l-4 border-l-indigo-500">
          <h2 className="font-bold text-lg border-b border-border pb-2 flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-500" /> Manager Audit
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <p className="text-muted-foreground text-xs uppercase font-bold">Auditor</p>
              <p className="font-semibold">{report.managerAudit.managerName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase font-bold">Time</p>
              <p className="font-semibold font-mono">{formatTimeMinus2Hours(report.managerAudit.auditedAt || report.managerAudit.rejectedAt)}</p>
            </div>
          </div>
          
          {isApproved ? (
            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <div className="flex justify-between font-mono mb-1">
                <span>Total Expected:</span>
                <span>{Number(report.managerAudit?.financials?.systemExpected || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-mono mb-1">
                <span>Total Drops:</span>
                <span>{Number(report.managerAudit?.financials?.actualDrops || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-mono font-bold mt-2 pt-2 border-t border-border">
                <span>Variance:</span>
                <span className={(report.managerAudit?.financials?.variance || 0) < 0 ? "text-red-500" : "text-emerald-500"}>
                  {Number(report.managerAudit?.financials?.variance || 0).toFixed(2)} EGP
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-red-500/10 text-red-700 p-3 rounded-lg text-sm font-medium">
              Reason: {report.managerAudit.rejectReason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PublicShiftReportView() {
  return (
    <Suspense fallback={<div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-600"></div></div>}>
      <PublicShiftReportContent />
    </Suspense>
  );
}
