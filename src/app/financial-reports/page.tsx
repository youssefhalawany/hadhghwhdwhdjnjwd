"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  BarChart3, FileText, Database, ArrowRight, 
  Wallet, Shield, TrendingUp, Tags, FileCode, CheckCircle, Clock
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
      color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
      status: "Active"
    },
    {
      title: "Custom Report Builder",
      description: "Dynamically design custom printable A4/PDF layouts and report templates.",
      icon: FileCode,
      href: "/report-builder",
      color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
      status: "Active"
    },
    {
      title: "Expense & Payouts",
      description: "Track store expenses, vendor payouts, COGS, rent, and petty cash logs.",
      icon: Wallet,
      href: "/financial-reports/expenses",
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      status: "Active"
    },
    {
      title: "Profit & Loss (P&L)",
      description: "Generate corporate P&L and Cash Flow statements with PDF export.",
      icon: TrendingUp,
      href: "/financial-reports/pnl",
      color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
      status: "Active"
    },
    {
      title: "Inventory Valuation",
      description: "Current stock value, adjustments, shrinkage, and reorder alerts.",
      icon: Database,
      href: "#",
      color: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      status: "Coming Soon"
    },
    {
      title: "Vendor Statements",
      description: "Generate monthly printable statements for each vendor and supplier.",
      icon: FileText,
      href: "/financial-reports/vendor-statements",
      color: "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20",
      status: "Active"
    },
    {
      title: "End Shift Cash",
      description: "Track daily shift start and end cash, deductions, and visa payments.",
      icon: Wallet,
      href: "/financial-reports/end-shift-cash",
      color: "text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/20",
      status: "Active"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header Section */}
        <div className="border-b border-border pb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Financial Reports Hub
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-3xl leading-relaxed">
            Centralized dashboard for all store financial analytics, audits, and custom printable document generation.
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {reportModules.map((mod, idx) => {
            const isActive = mod.status === "Active";
            
            return (
              <Link 
                key={idx} 
                href={isActive ? mod.href : "#"}
                className={`relative group flex flex-col h-full p-6 sm:p-8 rounded-3xl border transition-all duration-300
                  ${isActive 
                    ? "bg-card hover:bg-accent/5 border-border hover:border-primary/30 hover:shadow-xl hover:-translate-y-1 cursor-pointer" 
                    : "bg-muted/30 border-border/50 opacity-80 cursor-not-allowed"
                  }`}
              >
                {/* Header: Icon & Status Label */}
                <div className="flex items-start justify-between mb-6">
                  <div className={`p-4 rounded-2xl border ${mod.color} transition-transform duration-300 ${isActive ? 'group-hover:scale-110' : ''}`}>
                    <mod.icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                  </div>
                  
                  {isActive ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full uppercase">
                      <CheckCircle className="h-3.5 w-3.5" /> {mod.status}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground bg-muted border border-border px-3 py-1.5 rounded-full uppercase">
                      <Clock className="h-3.5 w-3.5" /> {mod.status}
                    </span>
                  )}
                </div>

                {/* Content */}
                <h3 className={`text-xl font-bold mb-3 transition-colors ${isActive ? "text-foreground group-hover:text-primary" : "text-muted-foreground"}`}>
                  {mod.title}
                </h3>
                
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed flex-grow">
                  {mod.description}
                </p>

                {/* Footer / CTA */}
                {isActive && (
                  <div className="mt-8 pt-5 border-t border-border flex items-center justify-between text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    <span className="flex items-center gap-2">
                      Access Module
                    </span>
                    <ArrowRight className="h-5 w-5 transform transition-transform group-hover:translate-x-1" />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
