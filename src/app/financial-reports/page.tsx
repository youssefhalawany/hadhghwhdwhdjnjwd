"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  BarChart3, FileText, Database, ArrowLeftRight, 
  Wallet, Shield, TrendingUp, Tags, FileCode, CheckCircle 
} from "lucide-react";

export default function FinancialReportsHub() {
  const [role, setRole] = useState("owner");

  useEffect(() => {
    const storedRole = localStorage.getItem("circlek_role") || "owner";
    setRole(storedRole);

    const handleRoleChange = (e: any) => {
      setRole(e.detail);
    };
    window.addEventListener("circlek_role_changed", handleRoleChange);
    return () => window.removeEventListener("circlek_role_changed", handleRoleChange);
  }, []);

  const reportModules = [
    {
      title: "Sales, Cash & Credits",
      description: "Shift-level summaries including itemized sales, cash drops, and credit payments.",
      icon: BarChart3,
      href: "/financial-reports/sales-and-credits",
      color: "bg-red-500",
      status: "Active"
    },
    {
      title: "Custom Report Builder",
      description: "Dynamically design custom printable A4/PDF layouts and report templates.",
      icon: FileCode,
      href: "/report-builder",
      color: "bg-orange-500",
      status: "Active"
    },
    {
      title: "Expense & Payouts",
      description: "Track store expenses, vendor payouts, and petty cash logs.",
      icon: Wallet,
      href: "#",
      color: "bg-emerald-500",
      status: "Coming Soon"
    },
    {
      title: "Daily Revenue Analysis",
      description: "Aggregated daily totals, margin analysis, and month-to-date tracking.",
      icon: TrendingUp,
      href: "#",
      color: "bg-blue-500",
      status: "Coming Soon"
    },
    {
      title: "Inventory Valuation",
      description: "Current stock value, adjustments, shrinkage, and reorder alerts.",
      icon: Database,
      href: "#",
      color: "bg-indigo-500",
      status: "Coming Soon"
    },
    {
      title: "VAT & Tax Report",
      description: "Automated tax calculation reporting for compliance and auditing.",
      icon: FileText,
      href: "#",
      color: "bg-violet-500",
      status: "Coming Soon"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="border-b border-border pb-6 pt-4">
        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">Financial Reports Hub</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-2xl">
          Centralized dashboard for all store financial analytics, audits, and custom printable document generation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportModules.map((mod, idx) => (
          <Link 
            key={idx} 
            href={mod.status === "Active" ? mod.href : "#"}
            className={`glass-panel rounded-2xl p-6 transition-all duration-300 flex flex-col h-full border border-border group ${
              mod.status === "Active" 
                ? "hover:border-red-500/30 hover:shadow-lg hover:-translate-y-1 cursor-pointer" 
                : "opacity-75 grayscale-[0.5] cursor-not-allowed"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`${mod.color} p-3 rounded-xl shadow-lg text-white`}>
                <mod.icon className="h-6 w-6" />
              </div>
              {mod.status === "Active" ? (
                <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase">
                  <CheckCircle className="h-3 w-3" /> {mod.status}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground bg-muted px-2.5 py-1 rounded-full uppercase">
                  {mod.status}
                </span>
              )}
            </div>

            <h3 className={`text-lg font-bold mb-2 transition-colors ${mod.status === "Active" ? "group-hover:text-red-500" : "text-foreground"}`}>
              {mod.title}
            </h3>
            
            <p className="text-sm text-muted-foreground leading-relaxed flex-grow">
              {mod.description}
            </p>

            {mod.status === "Active" && (
              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-sm font-semibold text-foreground group-hover:text-red-500 transition-colors">
                <span>Access Module</span>
                <ArrowLeftRight className="h-4 w-4" />
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
