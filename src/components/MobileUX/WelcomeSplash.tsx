"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";

export function WelcomeSplash({ name, onComplete }: { name: string; onComplete: () => void }) {
  const [isVisible, setIsVisible] = useState(true);
  const { language } = useLanguage();
  
  useEffect(() => {
    const t = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 800); // Wait for fade out
    }, 1200); // reduced from 2000 so total time is 2s (1.2s + 0.8s)
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: "radial-gradient(circle at center, #083344 0%, #000000 100%)",
          }}
        >
          {/* Removed heavy blur animation for performance */}
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
            className="z-10 flex flex-col items-center text-center px-6"
          >
            <div className="w-20 h-20 mb-6 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.3)]" style={{ background: "linear-gradient(135deg, #083344, #164e63)", border: "1px solid rgba(34,211,238,0.3)" }}>
              <span className="text-4xl font-black text-white">{name.charAt(0).toUpperCase()}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
              {language === "ar" ? "أهلاً بك،" : "Welcome,"}
            </h1>
            <h2 className="text-3xl sm:text-4xl font-black bg-clip-text text-transparent mb-4" style={{ backgroundImage: "linear-gradient(to right, #22d3ee, #818cf8)" }}>
              {name.split(" ")[0]}
            </h2>
            <p className="text-sm sm:text-base font-bold text-slate-300">
              {language === "ar" ? "في بوابة الكاشير ANH" : "to the ANH cashier portal"}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
