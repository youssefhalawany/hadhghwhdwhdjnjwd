"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Receipt, Video, MessageSquare } from "lucide-react";
import { hapticMedium } from "@/lib/haptics";
import { playPopSound } from "@/lib/sounds";
import { useLanguage } from "@/context/LanguageContext";
import { showIsland } from "@/components/MobileUX/DynamicIsland";

export function QuickActionsFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const { language } = useLanguage();

  const toggleOpen = () => {
    if ('vibrate' in navigator) vibrate(20);
    playPopSound();
    setIsOpen(!isOpen);
  };

  const vibrate = (ms: number) => {
    if (navigator.vibrate) navigator.vibrate(ms);
  };

  const handleAction = (msg: string) => {
    hapticMedium();
    playPopSound();
    setIsOpen(false);
    showIsland(msg, { type: "success" });
  };

  const actions = [
    { icon: <MessageSquare size={20} />, label: language === "en" ? "Message Shift" : "مراسلة الوردية", onClick: () => handleAction(language === "en" ? "Opening Messages..." : "جاري فتح الرسائل...") },
    { icon: <Video size={20} />, label: language === "en" ? "View CCTV" : "كاميرات المراقبة", onClick: () => handleAction(language === "en" ? "Connecting to Cameras..." : "جاري الاتصال بالكاميرات...") },
    { icon: <Receipt size={20} />, label: language === "en" ? "Add Expense" : "إضافة مصروف", onClick: () => handleAction(language === "en" ? "Opening Expense Form..." : "فتح نموذج المصروفات...") }
  ];

  return (
    <div className="fixed bottom-24 right-5 md:bottom-10 md:right-10 z-[100] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            className="flex flex-col gap-3 mb-4"
          >
            {actions.map((action, idx) => (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={action.onClick}
                className="flex items-center gap-3 self-end"
              >
                <span className="bg-[#151E32]/80 backdrop-blur-xl border border-white/10 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg">
                  {action.label}
                </span>
                <div className="w-12 h-12 bg-[#151E32]/80 backdrop-blur-xl border border-cyan-500/30 rounded-full flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                  {action.icon}
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={toggleOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        animate={{ rotate: isOpen ? 45 : 0 }}
        className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(34,211,238,0.4)] ${isOpen ? 'bg-rose-500' : 'bg-cyan-500'}`}
      >
        <Plus size={28} strokeWidth={3} />
      </motion.button>
    </div>
  );
}
