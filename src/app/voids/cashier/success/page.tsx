"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ArrowLeft } from "lucide-react";

export default function VoidSuccessPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-inner border border-green-200">
        <CheckCircle className="h-12 w-12 text-green-600" />
      </div>
      <h1 className="text-3xl font-black mb-2 tracking-tight">Request Submitted</h1>
      <p className="text-muted-foreground mb-8">
        Your return/void request has been securely logged and the receipt photo has been saved for manager review.
      </p>
      <button 
        onClick={() => router.push("/shift-reports/cashier")}
        className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-lg"
      >
        <ArrowLeft className="h-5 w-5" /> Back to Shift Report
      </button>
    </div>
  );
}
