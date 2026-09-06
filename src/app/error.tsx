"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global route error caught:", error);
  }, [error]);

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="p-4 bg-rose-500/10 text-rose-500 rounded-3xl mb-4 border border-rose-500/20 shadow-lg">
        <AlertTriangle className="w-12 h-12" />
      </div>
      <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
        Something went wrong
      </h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mb-6 bg-slate-100 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 font-mono break-words">
        {error?.message || "An unexpected error occurred."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Command Center
        </Link>
      </div>
    </div>
  );
}
