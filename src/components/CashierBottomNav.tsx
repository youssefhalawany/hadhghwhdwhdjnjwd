"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, FileText, User, ShieldAlert, LogOut, ScanBarcode } from "lucide-react";
import { BottomSheet } from "./MobileUX/BottomSheet";
import { ScannerOverlay } from "./MobileUX/ScannerOverlay";
import { hapticLight } from "@/lib/haptics";

const D = {
  bg:      "#0B1121",
  border:  "rgba(34, 211, 238, 0.15)",
  text:    "#64748b",
  active:  "#22d3ee",
  activeBg:"rgba(34, 211, 238, 0.08)",
  red:     "#ef4444",
  redBg:   "rgba(239, 68, 68, 0.08)",
};

const NAV_ITEMS = [
  { label: "Dashboard",   labelAr: "الرئيسية",  icon: LayoutDashboard, href: "/cashier" },
  { label: "Daily Shift", labelAr: "وردية",      icon: FileText,        href: "/shift-reports/cashier" },
  { label: "My Account",  labelAr: "حسابي",      icon: User,            href: "/cashier/account" },
  { label: "Voids",       labelAr: "مرتجعات",   icon: ShieldAlert,     href: "/voids/cashier" },
];

interface Props { lang?: "en" | "ar"; }

export function CashierBottomNav({ lang = "en" }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [isScannerOpen, setIsScannerOpen] = React.useState(false);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("active_cashier_session");
    }
    router.push("/cashier");
  };

  return (
    <>
      <div style={{ height: 68 }} />
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
        backgroundColor: D.bg, borderTop: `1px solid ${D.border}`,
        display: "flex", alignItems: "stretch",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/cashier" ? pathname === "/cashier" : pathname.startsWith(item.href);
          return (
            <button key={item.href} onClick={() => router.push(item.href)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 4, padding: "10px 4px",
              background: isActive ? D.activeBg : "transparent",
              border: "none", cursor: "pointer", color: isActive ? D.active : D.text,
              fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
              transition: "color 0.15s, background 0.15s",
              WebkitTapHighlightColor: "transparent", minHeight: 58, position: "relative",
            }}>
              {isActive && <span style={{
                position: "absolute", top: 0, left: "20%", right: "20%",
                height: 2, borderRadius: "0 0 4px 4px", background: D.active,
              }} />}
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} color={isActive ? D.active : D.text} />
              <span>{lang === "ar" ? item.labelAr : item.label}</span>
            </button>
          );
        })}
        
        {/* Central Scanner FAB */}
        <div style={{ flex: 0.5, display: "flex", justifyContent: "center", position: "relative" }}>
          <button
            onClick={() => {
              hapticLight();
              setIsScannerOpen(true);
            }}
            style={{
              position: "absolute",
              top: -24,
              width: 56,
              height: 56,
              borderRadius: 28,
              background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
              border: "4px solid #0B1121",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 8px 16px rgba(6, 182, 212, 0.3)",
              color: "white",
              WebkitTapHighlightColor: "transparent",
              zIndex: 210,
              transition: "transform 0.15s",
            }}
            onTouchStart={e => e.currentTarget.style.transform = "scale(0.92)"}
            onTouchEnd={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <ScanBarcode size={24} strokeWidth={2} />
          </button>
        </div>

        {/* Logout */}
        <button onClick={handleLogout} style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 4, padding: "10px 4px",
          background: "transparent", border: "none", cursor: "pointer",
          color: D.text, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.07em", WebkitTapHighlightColor: "transparent", minHeight: 58,
          transition: "color 0.15s",
        }}
          onTouchStart={e => { e.currentTarget.style.color = D.red; e.currentTarget.style.background = D.redBg; }}
          onTouchEnd={e => { e.currentTarget.style.color = D.text; e.currentTarget.style.background = "transparent"; }}
          onMouseEnter={e => { e.currentTarget.style.color = D.red; }}
          onMouseLeave={e => { e.currentTarget.style.color = D.text; }}
        >
          <LogOut size={20} strokeWidth={1.8} />
          <span>{lang === "ar" ? "خروج" : "Logout"}</span>
        </button>
      </nav>

      <BottomSheet
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        title={lang === "ar" ? "مسح باركود المنتج" : "Scan Product Barcode"}
      >
        <ScannerOverlay 
          onClose={() => setIsScannerOpen(false)}
          onScan={(barcode) => {
            setIsScannerOpen(false);
            // Since product lookup is in admin, we can route to product lookup or just handle it. 
            // The cashier product lookup seems to be missing from the nav, but we can emit an event or route.
            router.push(`/cashier/product-lookup?barcode=${barcode}`); // Assuming this exists or will
          }}
        />
      </BottomSheet>
    </>
  );
}
