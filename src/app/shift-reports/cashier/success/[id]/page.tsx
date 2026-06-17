"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Lock } from "lucide-react";

export default function ShiftSuccessPrintPage() {
  const router = useRouter();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-inner border border-green-200">
        <CheckCircle className="h-12 w-12 text-green-600" />
      </div>
      <h1 className="text-3xl font-black text-foreground mb-2 tracking-tight">Shift Saved Successfully</h1>
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        Your counts and shift data have been securely locked and sent to your manager for review.
      </p>
      <button 
        onClick={() => router.push("/shift-reports/cashier")}
        className="px-8 py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg"
      >
        <Lock className="h-5 w-5" /> Lock Device & Start New Shift
      </button>
    </div>
  );
}
