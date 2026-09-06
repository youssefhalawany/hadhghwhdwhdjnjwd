"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function AdjustmentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Adjustments page error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-3xl mb-6 shadow-sm border border-rose-200 dark:border-rose-900/40">
        <AlertTriangle className="w-12 h-12" />
      </div>
      <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
        حدث خطأ أثناء تحميل لوحة السلف والتسويات
      </h2>
      <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
        Could not load the Adjustments and Loans portal. An unexpected error occurred.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span>إعادة المحاولة / Retry</span>
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-all"
        >
          العودة للرئيسية / Home
        </Link>
      </div>
    </div>
  );
}
