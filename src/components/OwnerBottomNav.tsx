"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, Wallet, Building, ArrowDownToLine } from "lucide-react";
import { playPopSound } from "@/lib/sounds";
import { useLanguage } from "@/context/LanguageContext";

export function OwnerBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { language: lang } = useLanguage();
  const [activeTab, setActiveTab] = useState("dashboard");

  const TABS = [
    { id: "dashboard", labelEn: "Dashboard", labelAr: "الرئيسية", icon: LayoutDashboard, path: "/owner" },
    { id: "sales", labelEn: "Sales", labelAr: "المبيعات", icon: TrendingUp, path: "/owner/sales" },
    { id: "payments", labelEn: "Payments", labelAr: "المدفوعات", icon: Wallet, path: "/owner/payments" },
    { id: "credits", labelEn: "Credits", labelAr: "الذمم", icon: Building, path: "/owner/credits" },
    { id: "deposits", labelEn: "Deposits", labelAr: "الايداعات", icon: ArrowDownToLine, path: "/owner/deposits" },
  ];

  useEffect(() => {
    if (pathname === "/owner") setActiveTab("dashboard");
    else if (pathname.includes("/owner/sales")) setActiveTab("sales");
    else if (pathname.includes("/owner/payments")) setActiveTab("payments");
    else if (pathname.includes("/owner/credits")) setActiveTab("credits");
    else if (pathname.includes("/owner/deposits")) setActiveTab("deposits");
  }, [pathname]);

  const handleNav = (tab: any) => {
    if (activeTab === tab.id) return;
    if (navigator.vibrate) navigator.vibrate(50);
    playPopSound();
    setActiveTab(tab.id);
    router.push(tab.path);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 84, // Account for iOS home indicator
        backgroundColor: "#151E32", // Match D.surface
        borderTop: "1px solid rgba(34, 211, 238, 0.15)", // Match D.border
        display: "flex",
        justifyContent: "space-around",
        alignItems: "flex-start",
        paddingTop: 12,
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        zIndex: 50,
        direction: lang === "ar" ? "rtl" : "ltr"
      }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleNav(tab)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              flex: 1,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "transform 0.1s",
            }}
            onTouchStart={(e) => {
              if (navigator.vibrate) navigator.vibrate(20);
              e.currentTarget.style.transform = "scale(0.9)";
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <div
              style={{
                width: 44,
                height: 32,
                borderRadius: 16,
                backgroundColor: isActive ? "rgba(34, 211, 238, 0.15)" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 0.2s",
              }}
            >
              <Icon size={20} color={isActive ? "#22d3ee" : "#64748b"} />
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 800 : 600,
                color: isActive ? "#f8fafc" : "#64748b",
              }}
            >
              {lang === "en" ? tab.labelEn : tab.labelAr}
            </span>
          </button>
        );
      })}
    </div>
  );
}
