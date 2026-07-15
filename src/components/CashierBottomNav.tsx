"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, FileText, User, ShieldAlert, LogOut, ScanBarcode, Plus, X, Globe } from "lucide-react";
import { playClickSound, playSwooshSound } from "@/lib/audioCues";
import { hapticLight } from "@/lib/haptics";
import { useLanguage } from "@/context/LanguageContext";
import { showIsland } from "@/components/MobileUX/DynamicIsland";

const D = {
  bg:      "rgba(11, 17, 33, 0.75)", // Translucent for glassmorphism
  border:  "rgba(34, 211, 238, 0.15)",
  text:    "#64748b",
  active:  "#22d3ee",
  red:     "#ef4444",
};

const MAIN_NAV = [
  { label: "Dash", labelAr: "الرئيسية", icon: LayoutDashboard, href: "/cashier" },
  { label: "Account", labelAr: "حسابي", icon: User, href: "/cashier/account" },
];

const DIAL_ACTIONS = [
  { label: "Shift", icon: FileText, href: "/shift-reports/cashier", color: "#34d399" },
  { label: "Voids", labelAr: "مرتجعات", icon: ShieldAlert, href: "/voids/cashier", color: "#ef4444" },
  { label: "Lang", labelAr: "لغة", icon: Globe, action: "lang", color: "#8b5cf6" },
  { label: "Logout", labelAr: "خروج", icon: LogOut, action: "logout", color: "#64748b" },
];

interface Props { lang?: "en" | "ar"; }

export function CashierBottomNav({ lang: propLang = "en" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  const [isDialOpen, setIsDialOpen] = useState(false);
  const lang = language || propLang;

  const toggleDial = () => {
    playSwooshSound();
    hapticLight();
    setIsDialOpen(!isDialOpen);
  };

  const handleAction = (href?: string, action?: string) => {
    playClickSound();
    hapticLight();
    setIsDialOpen(false);
    
    if (action === "logout") {
      if (typeof window !== "undefined") {
        localStorage.removeItem("active_cashier_session");
        window.location.href = "/cashier";
      }
      return;
    }
    if (action === "lang") {
      const newLang = language === "en" ? "ar" : "en";
      setLanguage(newLang);
      showIsland(newLang === "ar" ? "تم تغيير اللغة" : "Language Changed", { 
        type: "success", 
        message: newLang === "ar" ? "العربية" : "English"
      });
      return;
    }
    if (href) router.push(href);
  };

  const handleNav = (href: string) => {
    playClickSound();
    hapticLight();
    setIsDialOpen(false);
    router.push(href);
  };

  return (
    <>
      <div style={{ height: 80 }} /> {/* Spacer */}
      
      {/* Dim Overlay when dial is open */}
      <AnimatePresence>
        {isDialOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[190] bg-black/40 backdrop-blur-sm"
            onClick={() => setIsDialOpen(false)}
          />
        )}
      </AnimatePresence>

      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
        backgroundColor: D.bg, borderTop: `1px solid ${D.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-around",
        paddingBottom: "env(safe-area-inset-bottom, 12px)",
        paddingTop: 8,
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      }}>
        
        {/* Left Nav Item */}
        <NavItem item={MAIN_NAV[0]} pathname={pathname} onClick={() => handleNav(MAIN_NAV[0].href)} lang={lang} />

        {/* Central Morphing Action Button */}
        <div className="relative flex justify-center w-20 h-14 -mt-6">
          <AnimatePresence>
            {isDialOpen && (
              <motion.div 
                className="absolute bottom-16 flex items-end justify-center gap-4"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={{
                  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
                  hidden: { transition: { staggerChildren: 0.05, staggerDirection: -1 } }
                }}
              >
                {DIAL_ACTIONS.map((action, i) => (
                  <motion.button
                    key={action.label}
                    onClick={() => handleAction(action.href, action.action)}
                    variants={{
                      hidden: { opacity: 0, y: 30, scale: 0.5 },
                      visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", bounce: 0.5 } }
                    }}
                    className="flex flex-col items-center gap-2 cursor-pointer outline-none"
                  >
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg border border-white/10"
                      style={{ backgroundColor: action.color }}
                    >
                      <action.icon size={20} color="#fff" />
                    </div>
                    <span className="text-[10px] font-bold text-white tracking-wider">
                      {lang === "ar" ? (action.labelAr || action.label) : action.label}
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onClick={toggleDial}
            whileTap={{ scale: 0.9 }}
            animate={{ rotate: isDialOpen ? 45 : 0, backgroundColor: isDialOpen ? D.red : D.active }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)] border-2 border-white/20 z-50 cursor-pointer outline-none"
          >
            <Plus size={28} color="#fff" strokeWidth={2.5} />
          </motion.button>
        </div>

        {/* Right Nav Item */}
        <NavItem item={MAIN_NAV[1]} pathname={pathname} onClick={() => handleNav(MAIN_NAV[1].href)} lang={lang} />

      </nav>
    </>
  );
}

function NavItem({ item, pathname, onClick, lang }: { item: any, pathname: string, onClick: () => void, lang: string }) {
  const isActive = item.href === "/cashier" ? pathname === "/cashier" : pathname.startsWith(item.href);
  const Icon = item.icon;
  
  return (
    <button 
      onClick={onClick} 
      className="flex flex-col items-center justify-center gap-1 min-h-[48px] w-16 cursor-pointer outline-none transition-colors"
      style={{ color: isActive ? D.active : D.text }}
    >
      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
      <span className="text-[10px] font-bold uppercase tracking-wider">
        {lang === "ar" ? (item.labelAr || item.label) : item.label}
      </span>
      {isActive && (
        <motion.div 
          layoutId="activeTabIndicator" 
          className="w-8 h-1 rounded-full mt-1" 
          style={{ backgroundColor: D.active }} 
        />
      )}
    </button>
  );
}
