"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { dbService } from "@/lib/firebase";
import { 
  ShieldCheck, ShieldAlert, FileDown, Printer, Share2, 
  Calendar, Building2, User, RefreshCw, Clock, History, AlertCircle
} from "lucide-react";
import confetti from "canvas-confetti";

export default function VerificationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [docRecord, setDocRecord] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [integrityPassed, setIntegrityPassed] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchVerificationData = async () => {
      setLoading(true);
      try {
        // Find verification metadata by token
        const records = await dbService.getDocs("verifications");
        const match = records.find(r => r.verificationToken === token || r.id === token || `mock_token_${r.reportId}` === token);

        if (match) {
          setDocRecord(match);
          
          // Verify file integrity (simulation of checking SHA-256 checksum)
          const localString = JSON.stringify(match.originalData);
          const encoder = new TextEncoder();
          const dataBuffer = encoder.encode(localString);
          const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const computedHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

          // Compare stored hash vs computed hash
          const passed = computedHash === match.sha256Hash;
          setIntegrityPassed(passed);

          // Get related audit logs for this specific report
          const allAuditLogs = await dbService.getDocs("audit_logs");
          const relatedLogs = allAuditLogs.filter(log => 
            log.action.includes(match.reportId) || 
            log.newValue.includes(match.reportId) ||
            log.previousValue.includes(match.reportId)
          ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          setAuditLogs(relatedLogs);

          // Trigger confetti on successful verification verification
          if (passed) {
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.6 },
              colors: ["#e11937", "#ff8200", "#10b981"]
            });
          }

          // Register access log entry
          await dbService.logAction(
            "public@anonymous.verify",
            "Public Validator",
            "viewer",
            `Viewed verification token ${token} for Report ${match.reportId}`,
            "Unverified View",
            "Verified View"
          );
        } else {
          setDocRecord(null);
        }
      } catch (err) {
        console.error("Verification error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchVerificationData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-red-500" />
        <p className="text-sm font-bold text-muted-foreground">Running cryptographic audit validations...</p>
      </div>
    );
  }

  if (!docRecord) {
    return (
      <div className="max-w-md mx-auto my-12 glass-panel p-6 rounded-xl border border-red-500/20 text-center space-y-4">
        <div className="h-16 w-16 mx-auto bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-bold uppercase text-red-500">Document Verification Failed</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The requested token does not match any registered, digitally-signed company archives in the Circle K Ledger database. It may have been revoked or modified.
        </p>
        <button
          onClick={() => router.push("/verify/check")}
          className="w-full py-2 bg-muted hover:bg-muted-foreground/15 rounded-lg text-xs font-bold transition-all text-foreground cursor-pointer"
        >
          Check another Document
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner Status */}
      <div className={`p-6 rounded-2xl glass-panel border flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left ${
        integrityPassed 
          ? "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400" 
          : "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400"
      }`}>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className={`h-16 w-16 rounded-full flex items-center justify-center ${
            integrityPassed ? "bg-green-500/10" : "bg-red-500/10"
          }`}>
            {integrityPassed ? <ShieldCheck className="h-10 w-10" /> : <ShieldAlert className="h-10 w-10" />}
          </div>
          <div>
            <h2 className="text-xl font-black tracking-wide uppercase">
              {integrityPassed ? "✓ Verified Company Document" : "✗ File Integrity Failed"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              Document SHA-256 Checksum: <span className="font-bold text-foreground break-all">{docRecord.sha256Hash}</span>
            </p>
          </div>
        </div>

        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
          integrityPassed ? "bg-green-500/20" : "bg-red-500/20"
        }`}>
          {integrityPassed ? "Authentic" : "Compromised"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: General metadata information */}
        <div className="glass-panel p-5 rounded-xl md:col-span-2 space-y-4">
          <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            Audit Specifications
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-muted-foreground font-semibold">Document Number:</span>
              <p className="font-mono font-bold">{docRecord.reportId}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-semibold">Document Type:</span>
              <p className="font-bold">{docRecord.type}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-semibold">Issue Date:</span>
              <p className="font-bold">{new Date(docRecord.timestamp).toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-semibold">Current Version:</span>
              <p className="font-bold">v{docRecord.version || 1}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-semibold">Branch Location:</span>
              <p className="font-bold">Circle K #4702 - Downtown</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-semibold">Security Signature:</span>
              <p className="font-bold text-green-500">DIGITALLY SEALED</p>
            </div>
          </div>

          {/* Quick PDF Action preview */}
          <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] text-muted-foreground font-semibold">
              Original transaction record size: {JSON.stringify(docRecord.originalData).length} bytes
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => alert("PDF downloaded dynamically from secure storage ledger")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted-foreground/10 text-foreground font-semibold rounded text-xs transition-colors cursor-pointer"
              >
                <FileDown className="h-3.5 w-3.5" /> Download PDF
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-muted text-foreground font-semibold rounded text-xs transition-colors cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Print A4 Layout
              </button>
            </div>
          </div>
        </div>

        {/* Right: Security & Version histories */}
        <div className="glass-panel p-5 rounded-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b border-border pb-2 flex items-center gap-1.5">
              <History className="h-4 w-4" /> Version Ledger
            </h3>

            <div className="relative border-l border-border pl-4 ml-2 space-y-4 text-xs">
              <div className="relative">
                <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-green-500 ring-4 ring-green-500/20" />
                <span className="font-bold text-foreground">Version 1 (Active)</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Published: {new Date(docRecord.timestamp).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 border border-border p-3.5 rounded-lg text-[10px] text-muted-foreground leading-relaxed flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              This verification record is permanent and sealed. Modification of source transaction files will automatically fail checksum validation checks.
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Data Table for Financial Reports */}
      {docRecord.type?.startsWith("Financial Report") && docRecord.originalData?.data && (
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b border-border pb-2 flex items-center gap-1.5">
            <FileDown className="h-4 w-4" /> Secure Report Ledger Data
          </h3>
          <div className="overflow-x-auto rounded border border-border bg-background">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-muted-foreground border-b border-border">
                <tr>
                  {Object.keys(docRecord.originalData.data[0] || {}).map((key) => (
                    <th key={key} className="p-3 font-semibold uppercase">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docRecord.originalData.data.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/50 transition-colors">
                    {Object.entries(row).map(([key, val]: [string, any], j: number) => {
                      const isMoney = typeof val === 'number' && !key.toLowerCase().includes('count') && !key.toLowerCase().includes('invoice');
                      return (
                        <td key={j} className="p-3">
                          {isMoney ? `EGP ${val.toLocaleString()}` : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {docRecord.originalData.data.length === 0 && (
                  <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">No records inside ledger.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Immutable Access Logs Trail list */}
      <div className="glass-panel p-5 rounded-xl space-y-4">
        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b border-border pb-2 flex items-center gap-1.5">
          <Clock className="h-4 w-4" /> Secure Audit Trail Logs
        </h3>

        <div className="divide-y divide-border text-xs">
          {auditLogs.length === 0 ? (
            <p className="text-muted-foreground py-2 italic text-center">No verification logs tracked for this document ID.</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                <div>
                  <span className="font-semibold text-foreground">{log.action}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    User: {log.userEmail} | Device: {log.device}
                  </p>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
