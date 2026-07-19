"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playLockTurnSound } from "@/lib/audioCues";
import { Lock } from "lucide-react";

interface LockKeyOverlayProps {
  isLocking: boolean;
  onComplete?: () => void;
}

export function LockKeyOverlay({ isLocking, onComplete }: LockKeyOverlayProps) {
  
  useEffect(() => {
    if (isLocking) {
      setTimeout(() => {
        playLockTurnSound();
      }, 500); // Wait for the shackle to snap down
      
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    }
  }, [isLocking, onComplete]);

  return (
    <AnimatePresence>
      {isLocking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl"
        >
          <div className="relative flex flex-col items-center">
            {/* The Shackle (U-shape) */}
            <motion.div 
              initial={{ y: -40 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 15 }}
              className="w-24 h-24 border-[16px] border-gray-400 rounded-t-[48px] border-b-0 mb-[-10px] z-10"
              style={{
                boxShadow: "inset 0 10px 10px rgba(255,255,255,0.4)"
              }}
            />
            
            {/* The Lock Body */}
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className="w-40 h-32 bg-gradient-to-b from-gray-700 to-gray-900 rounded-xl shadow-2xl border border-gray-600 flex items-center justify-center z-20"
            >
              <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center border-2 border-gray-800 shadow-inner">
                <div className="w-2 h-6 bg-gray-900 rounded-sm" />
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-8 text-white font-black tracking-widest text-xl uppercase"
            >
              Session Locked
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
