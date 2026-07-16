"use client";

import React, { useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import { vibrateSuccess } from "@/lib/haptics";
import { playSuccessSound } from "@/lib/sounds";
import { useLanguage } from "@/context/LanguageContext";

export function SwipeToApprove({ onComplete, label }: { onComplete: () => void, label?: string }) {
  const { language } = useLanguage();
  const [completed, setCompleted] = useState(false);
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [0, 200],
    ["rgba(15, 23, 42, 0.6)", "rgba(16, 185, 129, 0.8)"]
  );

  const handleDragEnd = (event: any, info: any) => {
    if (info.offset.x > 180) {
      setCompleted(true);
      if ('vibrate' in navigator) vibrateSuccess();
      playSuccessSound();
      onComplete();
    } else {
      x.set(0); // Reset
    }
  };

  if (completed) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="w-full h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white font-bold shadow-[0_0_20px_rgba(16,185,129,0.4)]"
      >
        <Check className="mr-2" /> {language === "en" ? "Approved" : "تمت الموافقة"}
      </motion.div>
    );
  }

  return (
    <motion.div 
      style={{ background }} 
      className="w-full h-14 relative rounded-2xl overflow-hidden border border-white/10 backdrop-blur-md flex items-center justify-center"
    >
      <div className="text-slate-400 font-bold text-sm tracking-widest uppercase z-0 opacity-50">
        {label || (language === "en" ? "Swipe to Approve" : "اسحب للموافقة")}
      </div>
      
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 220 }}
        dragElastic={0}
        onDragEnd={handleDragEnd}
        style={{ x }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="absolute left-1 top-1 bottom-1 w-16 bg-gradient-to-tr from-cyan-500 to-emerald-400 rounded-xl shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
      >
        <ChevronRight className="text-white" size={24} strokeWidth={3} />
      </motion.div>
    </motion.div>
  );
}
