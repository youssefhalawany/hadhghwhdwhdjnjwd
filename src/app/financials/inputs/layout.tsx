"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, DollarSign, FileText, CreditCard, FileCheck } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";

export default function FinancialInputsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: "Overview", href: "/financials/inputs", icon: Wallet },
    { name: "Sales", href: "/financials/inputs/sales", icon: DollarSign },
    { name: "Payments", href: "/financials/inputs/payments", icon: CreditCard },
    { name: "Credits", href: "/financials/inputs/credits", icon: FileText },
    { name: "Cheques", href: "/financials/inputs/cheques", icon: FileCheck },
    { name: "Deposits", href: "/financials/inputs/deposits", icon: Wallet }
  ];

  return (
    <PageTransition>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 pb-32">
        <div className="bg-card border border-border shadow-sm rounded-2xl p-2 flex flex-wrap md:flex-nowrap gap-2">
          {tabs.map(tab => {
            const isActive = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive 
                    ? "bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900 shadow-md" 
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "opacity-100" : "opacity-70"}`} />
                {tab.name}
              </Link>
            );
          })}
        </div>
        
        <div className="w-full">
          {children}
        </div>
      </div>
    </PageTransition>
  );
}
