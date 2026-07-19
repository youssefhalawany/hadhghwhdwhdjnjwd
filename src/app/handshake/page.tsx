"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

function HandshakeContent() {
  const searchParams = useSearchParams();
  const dataParam = searchParams.get('data');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (dataParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(dataParam));
        setData(parsed);
      } catch (e) {
        setError(true);
      }
    } else {
      setError(true);
    }
  }, [dataParam]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Invalid Code</h1>
          <p className="text-slate-500 dark:text-slate-400">The QR code you scanned is invalid, corrupted, or has expired.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 flex flex-col items-center">
      <div className="bg-white dark:bg-slate-800 max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
        <div className="bg-green-500 p-8 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <ShieldCheck className="mx-auto mb-4 relative z-10" size={64} />
          <h1 className="text-3xl font-black relative z-10 tracking-tight">Verified Transaction</h1>
          <p className="font-medium text-green-100 mt-2 relative z-10">This digital receipt is authentic and recorded.</p>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-center pb-6 border-b border-slate-100 dark:border-slate-700">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction ID</p>
              <p className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">{data.id}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date</p>
              <p className="text-md font-bold text-slate-900 dark:text-white mt-1">{data.date}</p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Recipient / Supplier</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{data.company}</p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Total Amount</p>
              <p className="text-3xl font-black text-blue-600 dark:text-blue-400 mt-1">EGP {Number(data.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <CheckCircle className="text-blue-500" size={32} />
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-700 text-center">
            <p className="text-xs font-medium text-slate-400">
              Scanned on {new Date().toLocaleString()}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-full text-xs font-bold text-slate-500 dark:text-slate-300">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              Live Verification Active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HandshakePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <HandshakeContent />
    </Suspense>
  );
}
