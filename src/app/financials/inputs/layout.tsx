"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, DollarSign, FileText, CreditCard, FileCheck, Receipt } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";

import { useLanguage } from "@/context/LanguageContext";

export default function FinancialInputsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const tabs = [
    { name: isAr ? "نظرة عامة" : "Overview", href: "/financials/inputs", icon: Wallet },
    { name: isAr ? "المبيعات" : "Sales", href: "/financials/inputs/sales", icon: DollarSign },
    { name: isAr ? "المدفوعات" : "Payments", href: "/financials/inputs/payments", icon: CreditCard },
    { name: isAr ? "الأجل والديون" : "Credits", href: "/financials/inputs/credits", icon: FileText },
    { name: isAr ? "الشيكات" : "Cheques", href: "/financials/inputs/cheques", icon: FileCheck },
    { name: isAr ? "الإيداعات" : "Deposits", href: "/financials/inputs/deposits", icon: Wallet },
    { name: isAr ? "فواتير TMT" : "TMT Invoices", href: "/financials/inputs/tmt-invoices", icon: Receipt },
    { name: isAr ? "تقرير الخزنة" : "Safe Report", href: "/financials/inputs/safe-report", icon: FileText }
  ];

  return (
    <PageTransition>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 pb-32" dir={isAr ? "rtl" : "ltr"}>
        <div style={{ background: '#18181B', border: '1px solid rgba(255,255,255,0.08)' }} className="shadow-lg rounded-2xl p-1.5 flex flex-wrap md:flex-nowrap gap-1.5">
          {tabs.map(tab => {
            const isActive = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={true}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-extrabold transition-all duration-200 ${
                  isActive 
                    ? "text-white shadow-lg" 
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}
                style={isActive ? {
                  background: 'linear-gradient(135deg, #E11D48, #F97316)',
                  boxShadow: '0 4px 16px rgba(225,29,72,0.3)'
                } : {}}
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
