"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { dbService } from "@/lib/firebase";
import { Search, ShieldCheck, HelpCircle, FileText, ArrowRight, ShieldAlert } from "lucide-react";

export default function VerifySearchPage() {
  const [tokenInput, setTokenInput] = useState("");
  const [recentVerifications, setRecentVerifications] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchRecentVerifications = async () => {
      const records = await dbService.getDocs("verifications");
      // Sort to show latest
      setRecentVerifications(records.slice(-3).reverse());
    };
    fetchRecentVerifications();
  }, []);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    router.push(`/verify/${tokenInput.trim()}`);
  };

  return (
    <div className="max-w-xl mx-auto my-12 space-y-6">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="h-12 w-12 mx-auto bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-2">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
          Document Verification Registry
        </h1>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Scan the QR code printed on invoices, receipts, or shipping tags, or enter the secure token below to confirm authenticity.
        </p>
      </div>

      {/* Verification Search Bar */}
      <form onSubmit={handleVerify} className="glass-panel p-4 rounded-xl flex gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            id="input-verify-token"
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste verification token or transaction ID..."
            className="w-full bg-muted border border-border rounded-lg pl-10 pr-3 py-2.5 text-xs text-foreground focus:ring-1 focus:ring-red-500 outline-none font-mono"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg font-bold hover:scale-105 active:scale-95 transition-transform text-xs cursor-pointer flex items-center gap-1"
        >
          Validate <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </form>

      {/* Recently Verified Records list */}
      <div className="glass-panel p-5 rounded-xl space-y-4">
        <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border pb-2">
          Recently Signed Logs
        </h3>

        <div className="space-y-2 text-xs">
          {recentVerifications.length === 0 ? (
            <p className="text-muted-foreground text-center py-2 italic">No verification records found. Print/generate a PDF receipt first!</p>
          ) : (
            recentVerifications.map((rec) => (
              <button
                key={rec.id}
                onClick={() => router.push(`/verify/${rec.verificationToken}`)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border hover:bg-red-500/5 hover:border-red-500/20 text-left transition-colors cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">ID: {rec.reportId}</span>
                    <span className="text-[9px] bg-green-500/10 text-green-500 font-bold px-1.5 rounded uppercase">Verified</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono truncate max-w-xs sm:max-w-md">
                    Hash: {rec.sha256Hash.slice(0, 24)}...
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
