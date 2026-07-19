"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playSafeDropSound } from "@/lib/audioCues";
import { Lock, ShieldCheck } from "lucide-react";

interface SafeDropVaultProps {
  isDropping: boolean;
  onComplete?: () => void;
}

export function SafeDropVault({ isDropping, onComplete }: SafeDropVaultProps) {
  
  useEffect(() => {
    if (isDropping) {
      setTimeout(() => {
        playSafeDropSound();
      }, 400); // play sound as door shuts
      
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    }
  }, [isDropping, onComplete]);

  return (
    <AnimatePresence>
      {isDropping && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md"
        >
          <div className="relative w-64 h-80 flex flex-col items-center justify-center">
            
            {/* The Safe Slot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-4 bg-gray-900 rounded-full border border-gray-700 shadow-inner overflow-hidden z-20">
              <div className="w-full h-full bg-gradient-to-b from-black to-gray-800" />
            </div>

            {/* The Envelope sliding down */}
            <motion.div
              initial={{ y: -150, opacity: 0, scale: 0.8 }}
              animate={{ y: 20, opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeIn" }}
              className="absolute z-10 w-40 h-24 bg-amber-100 rounded shadow-lg border border-amber-200 flex flex-col justify-between p-2"
              style={{
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 70%, 0 100%)",
                background: "linear-gradient(135deg, #fef3c7, #fde68a)"
              }}
            >
              <div className="text-[8px] font-bold text-amber-800 tracking-widest uppercase">Safe Drop</div>
              <div className="flex justify-end">
                <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center shadow-sm">
                  <Lock size={12} color="white" />
                </div>
              </div>
            </motion.div>

            {/* Success message appearing after drop */}
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 80, scale: 1 }}
              transition={{ delay: 0.8 }}
              className="absolute z-30 flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.5)]">
                <ShieldCheck size={24} color="white" />
              </div>
              <span className="text-white font-bold tracking-widest uppercase text-sm">Secured</span>
            </motion.div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
