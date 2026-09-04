"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, DollarSign, FileText, CreditCard, FileCheck, Receipt } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { useLanguage } from "@/context/LanguageContext";
import { triggerHapticFeedback } from "@/lib/pwaBadges";

export default function FinancialInputsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const tabsContainerRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll active tab into view on mobile
  useEffect(() => {
    if (tabsContainerRef.current) {
      const activeEl = tabsContainerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [pathname]);

  return (
    <PageTransition>
      <div className="px-3 sm:px-8 pt-2 sm:pt-6 pb-28 sm:pb-32 max-w-7xl mx-auto space-y-4 sm:space-y-6" dir={isAr ? "rtl" : "ltr"}>
        {/* Horizontal Navigation Tab Bar */}
        <div 
          ref={tabsContainerRef}
          style={{ 
            background: '#18181B', 
            border: '1px solid rgba(255,255,255,0.08)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }} 
          className="shadow-lg rounded-2xl p-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth w-full md:flex-nowrap print:hidden no-print"
        >
          {tabs.map(tab => {
            const isActive = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={true}
                data-active={isActive ? "true" : "false"}
                onClick={() => triggerHapticFeedback(10)}
                className={`flex-shrink-0 md:flex-1 flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 whitespace-nowrap ${
                  isActive 
                    ? "text-white shadow-lg scale-[1.02]" 
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}
                style={isActive ? {
                  background: 'linear-gradient(135deg, #E11D48, #F97316)',
                  boxShadow: '0 4px 16px rgba(225,29,72,0.35)'
                } : {}}
              >
                <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isActive ? "opacity-100" : "opacity-70"}`} />
                <span>{tab.name}</span>
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
