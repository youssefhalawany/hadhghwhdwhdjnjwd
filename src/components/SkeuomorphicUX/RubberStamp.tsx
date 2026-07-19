"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playStampSound } from "@/lib/audioCues";

interface RubberStampProps {
  children: React.ReactNode;
  stampType: "APPROVED" | "REJECTED" | null;
  className?: string;
}

export function RubberStamp({ children, stampType, className = "" }: RubberStampProps) {
  const [internalStamp, setInternalStamp] = useState<"APPROVED" | "REJECTED" | null>(null);

  useEffect(() => {
    if (stampType && stampType !== internalStamp) {
      setInternalStamp(stampType);
      
      // Delay sound slightly to match the animation impact
      setTimeout(() => {
        playStampSound();
      }, 150);
    } else if (!stampType) {
      setInternalStamp(null);
    }
  }, [stampType, internalStamp]);

  const isApproved = internalStamp === "APPROVED";

  return (
    <div className={`relative ${className}`}>
      {children}
      <AnimatePresence>
        {internalStamp && (
          <motion.div
            initial={{ scale: 3, opacity: 0, rotate: -25 }}
            animate={{ scale: 1, opacity: 0.9, rotate: isApproved ? -15 : 15 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className={`absolute inset-0 m-auto flex items-center justify-center pointer-events-none z-50`}
          >
            <div 
              className={`px-6 py-2 border-4 rounded-lg font-black text-4xl uppercase tracking-widest backdrop-blur-sm
                ${isApproved ? 'text-green-500 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'text-red-500 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]'}
              `}
              style={{
                // Distressed texture effect using textShadow
                textShadow: "2px 2px 0px rgba(0,0,0,0.2)",
                boxShadow: `inset 0 0 10px ${isApproved ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}, 0 0 10px ${isApproved ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`
              }}
            >
              {internalStamp}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
