"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playPrintSwooshSound } from "@/lib/audioCues";
import { CreditCard, CheckCircle2 } from "lucide-react";

interface PosReceiptPrinterProps {
  isPrinting: boolean;
  onComplete?: () => void;
  className?: string;
}

export function PosReceiptPrinter({ isPrinting, onComplete, className = "" }: PosReceiptPrinterProps) {
  
  useEffect(() => {
    if (isPrinting) {
      setTimeout(() => {
        playPrintSwooshSound();
      }, 600); // Wait for card to dip and approved state
      
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 3000);
      }
    }
  }, [isPrinting, onComplete]);

  return (
    <div className={`relative ${className} w-32 h-48 flex flex-col items-center justify-end`}>
      <AnimatePresence>
        {isPrinting && (
          <>
            {/* The Receipt */}
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 100, opacity: 1 }}
              transition={{ delay: 0.6, duration: 1.5, ease: "linear" }}
              className="absolute top-0 w-24 bg-white border border-gray-300 shadow-md flex flex-col items-center p-2 z-10"
              style={{
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 95% 95%, 90% 100%, 85% 95%, 80% 100%, 75% 95%, 70% 100%, 65% 95%, 60% 100%, 55% 95%, 50% 100%, 45% 95%, 40% 100%, 35% 95%, 30% 100%, 25% 95%, 20% 100%, 15% 95%, 10% 100%, 5% 95%, 0 100%)"
              }}
            >
              <div className="w-full flex justify-center border-b border-dashed border-gray-400 pb-1 mb-1">
                <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest">Receipt</span>
              </div>
              <div className="w-full space-y-1">
                <div className="w-full h-1 bg-gray-300 rounded" />
                <div className="w-3/4 h-1 bg-gray-300 rounded" />
                <div className="w-full h-1 bg-gray-300 rounded mt-2" />
              </div>
              <CheckCircle2 size={16} className="text-green-600 mt-2" />
            </motion.div>

            {/* The POS Terminal Body */}
            <div className="absolute bottom-0 w-32 h-16 bg-gray-800 rounded-t-xl border-t-2 border-gray-700 shadow-2xl z-20 flex justify-center">
              <div className="w-24 h-1 bg-black mt-2 rounded-full shadow-inner" />
            </div>

            {/* The Credit Card */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: [50, 10, 50], opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, times: [0, 0.2, 1] }}
              className="absolute bottom-4 z-30 flex items-center justify-center"
            >
              <div className="w-20 h-12 bg-blue-600 rounded-md border border-blue-500 shadow-lg flex items-center justify-center">
                <CreditCard size={20} className="text-white/50" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
