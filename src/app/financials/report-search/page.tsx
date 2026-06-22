"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, ScanBarcode, XCircle, AlertCircle, CheckCircle, FileText, Banknote, Shield, Package, X, Receipt } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Html5Qrcode } from "html5-qrcode";

export default function ReportSearchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState("");

  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const performSearch = async (term: string) => {
    const reportId = term.trim();
    if (!reportId) return;

    setLoading(true);
    setError("");
    setReport(null);

    try {
      const docRef = doc(db, "shift_reports", reportId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setReport({ id: docSnap.id, ...docSnap.data() });
      } else {
        setError("Report not found. Please verify the Barcode ID.");
      }
    } catch (err: any) {
      console.error("Search error:", err);
      setError("Error fetching the report.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchTerm);
  };

  const initAudio = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    } catch(e) {}
  };

  const startScanning = () => {
    initAudio();
    setShowScanner(true);
    setScannerError("");
    
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("scanner-reader-report");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        const startWithConstraints = async (constraints: any) => {
          return html5QrCode.start(
            constraints,
            config,
            (decodedText) => {
              try {
                const ctx = audioCtxRef.current;
                if (ctx) {
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.type = "sine";
                  osc.frequency.setValueAtTime(800, ctx.currentTime);
                  gain.gain.setValueAtTime(0.1, ctx.currentTime);
                  osc.start();
                  osc.stop(ctx.currentTime + 0.15);
                }
              } catch (e) {}
              setSearchTerm(decodedText);
              performSearch(decodedText);
              stopScanning();
            },
            undefined
          );
        };

        try {
          await startWithConstraints({ facingMode: "environment" });
          scannerRef.current = html5QrCode;
        } catch (err) {
          try {
            await startWithConstraints({ video: true });
            scannerRef.current = html5QrCode;
          } catch (fallbackErr) {
            setScannerError("Camera error. Please grant permissions.");
          }
        }
      } catch (err: any) {
        setScannerError("Scanner error.");
      }
    }, 250);
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      try { scannerRef.current.stop(); } catch (e) {}
      scannerRef.current = null;
    }
    setShowScanner(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
          <Search className="h-8 w-8 text-blue-600" /> Report Search
        </h1>
        <p className="text-slate-500 font-medium mt-2">Scan a Shift Report Barcode to instantly view its details, financials, and audit status.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Report Barcode ID</label>
            <input 
              type="text" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Scan or type barcode ID..."
              className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors font-medium text-lg"
            />
          </div>
          <button 
            type="button" 
            onClick={showScanner ? stopScanning : startScanning}
            className={`p-4 rounded-xl font-bold flex items-center justify-center transition-colors ${
              showScanner ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {showScanner ? <X className="h-6 w-6" /> : <ScanBarcode className="h-6 w-6" />}
          </button>
          <button 
            type="submit" 
            disabled={!searchTerm.trim() || loading}
            className="p-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="h-6 w-6" />}
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>
      </div>

      {showScanner && (
        <div className="bg-black p-4 rounded-2xl overflow-hidden relative shadow-2xl max-w-lg mx-auto border-4 border-slate-800">
          <button onClick={stopScanning} className="absolute top-4 right-4 z-10 bg-red-500 text-white p-2 rounded-full shadow-lg">
            <XCircle className="h-6 w-6" />
          </button>
          <div id="scanner-reader-report" className="w-full rounded-xl overflow-hidden bg-slate-900 min-h-[300px]"></div>
          {scannerError && <p className="text-red-400 font-bold mt-4 text-center">{scannerError}</p>}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 font-medium flex items-center gap-3">
          <AlertCircle className="h-5 w-5" /> {error}
        </div>
      )}

      {report && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 text-white p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black">{report.cashierDetails?.name || 'Unknown Cashier'}</h2>
                <p className="text-slate-400 text-sm mt-1">{report.cashierDetails?.date} • {report.cashierDetails?.shift} Shift • {report.cashierDetails?.storeId}</p>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10">
                  <Receipt className="h-4 w-4" /> ID: {report.id}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Declared Total</p>
                <p className="text-3xl font-black text-green-400">EGP {(report.cashierCounts?.total || 0).toLocaleString()}</p>
                
                {report.status === 'approved' && (
                  <span className="inline-flex mt-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded border border-green-500/30">
                    <CheckCircle className="inline h-3 w-3 mr-1" /> Approved
                  </span>
                )}
                {report.status === 'rejected' && (
                  <span className="inline-flex mt-2 px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded border border-red-500/30">
                    <XCircle className="inline h-3 w-3 mr-1" /> Rejected
                  </span>
                )}
                {report.status === 'pending' && (
                  <span className="inline-flex mt-2 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded border border-yellow-500/30">
                    <AlertCircle className="inline h-3 w-3 mr-1" /> Pending Audit
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Grid Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {/* Financial Breakdown */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-500 uppercase text-xs flex items-center gap-2">
                <Banknote className="h-4 w-4" /> Financial Breakdown
              </h3>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Declared Cash</span>
                  <span className="font-bold">EGP {(report.cashierCounts?.cash || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Declared Visa</span>
                  <span className="font-bold">EGP {(report.cashierCounts?.visa || 0).toLocaleString()}</span>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">System Expected Cash</span>
                    <span className="font-bold">{report.managerAudit?.expectedCash ? `EGP ${Number(report.managerAudit.expectedCash).toLocaleString()}` : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-2">
                    <span className="text-slate-500 font-medium">System Expected Visa</span>
                    <span className="font-bold">{report.managerAudit?.expectedVisa ? `EGP ${Number(report.managerAudit.expectedVisa).toLocaleString()}` : '-'}</span>
                  </div>
                </div>
                
                {report.managerAudit?.overShort !== undefined && (
                  <div className={`mt-4 p-3 rounded-lg flex justify-between items-center font-bold ${
                    report.managerAudit.overShort < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    report.managerAudit.overShort > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    <span>Variance</span>
                    <span>
                      {report.managerAudit.overShort > 0 ? '+' : ''}
                      {report.managerAudit.overShort} EGP
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Sold Items Stats */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-500 uppercase text-xs flex items-center gap-2">
                <Package className="h-4 w-4" /> Item Statistics
              </h3>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Total Items Sold</span>
                  <span className="font-bold">{report.soldItems?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Cigarettes (L&M/Marlboro)</span>
                  <span className="font-bold">
                    {report.soldItems?.filter((i: any) => i.name.toLowerCase().includes('l&m') || i.name.toLowerCase().includes('marlboro')).reduce((acc: number, cur: any) => acc + (cur.sold || 0), 0) || 0}
                  </span>
                </div>
                {report.managerAudit?.cigarettesPercent !== undefined && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Cigarettes Variance</span>
                    <span className={`font-bold ${Number(report.managerAudit.cigarettesPercent) < 0 ? 'text-red-500' : ''}`}>
                      {report.managerAudit.cigarettesPercent}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Manager Sign-Off */}
            {report.managerAudit && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-500 uppercase text-xs flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Manager Audit
                </h3>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-slate-700 pb-3">
                    <span className="text-slate-500 font-medium">Audited By</span>
                    <span className="font-bold">{report.managerAudit.managerName || '-'}</span>
                  </div>
                  {report.managerAudit.comments && (
                    <div className="text-sm">
                      <span className="block text-slate-500 font-medium mb-1">Manager Comments</span>
                      <p className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 italic text-slate-700 dark:text-slate-300">
                        "{report.managerAudit.comments}"
                      </p>
                    </div>
                  )}
                  {report.status === 'rejected' && report.managerAudit.rejectReason && (
                    <div className="text-sm">
                      <span className="block text-red-500 font-bold mb-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Rejection Reason</span>
                      <p className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400">
                        {report.managerAudit.rejectReason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
