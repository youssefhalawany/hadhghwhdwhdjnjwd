"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  BarChart3, FileText, Database, ArrowRight, 
  Wallet, Shield, TrendingUp, Tags, FileCode, CheckCircle, Clock, Download
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
      title: "End Shift Cash",
      description: "Track daily shift start and end cash, deductions, and visa payments.",
      icon: Wallet,
      href: "/financial-reports/end-shift-cash",
      color: "text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/20",
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
      title: "Vendor Statements",
      description: "Generate monthly printable statements for each vendor and supplier.",
      icon: FileText,
      href: "/financial-reports/vendor-statements",
      color: "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20",
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
                className={`relative group flex flex-col h-full p-6 sm:p-8 transition-all duration-300
                  ${isActive 
                    ? "glass-panel cursor-pointer" 
                    : "bg-muted/30 border border-border/50 rounded-3xl opacity-80 cursor-not-allowed"
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

        {/* Download Section */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                <Download className="h-6 w-6 text-primary" />
                Cashier Desktop App
              </h3>
              <p className="text-muted-foreground text-sm sm:text-base max-w-xl">
                Download the latest version of the Circle K Cashier Desktop Application. This setup file will install the offline-first cashier system on Windows machines.
              </p>
            </div>
            <a 
              href="/cashier-setup.exe" 
              download
              className="whitespace-nowrap flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Download className="h-5 w-5" />
              Download Setup (.exe)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
