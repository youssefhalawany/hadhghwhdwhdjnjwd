"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playCoinDropSound } from "@/lib/audioCues";
import { Wallet } from "lucide-react";

interface CoinDropWalletProps {
  isDropping: boolean;
  onComplete?: () => void;
  className?: string;
}

export function CoinDropWallet({ isDropping, onComplete, className = "" }: CoinDropWalletProps) {
  
  useEffect(() => {
    if (isDropping) {
      setTimeout(() => {
        playCoinDropSound();
      }, 500); // Wait for coin to hit wallet
      
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 1200);
      }
    }
  }, [isDropping, onComplete]);

  return (
    <div className={`relative ${className} w-24 h-24 flex items-center justify-center`}>
      <Wallet size={48} className="text-gray-400" />
      
      <AnimatePresence>
        {isDropping && (
          <motion.div
            initial={{ y: -100, opacity: 0, scale: 0.5, rotateY: 0 }}
            animate={{ 
              y: [null, 0, -20, 0], 
              opacity: 1, 
              scale: 1,
              rotateY: [0, 360, 720]
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ 
              duration: 0.8,
              times: [0, 0.6, 0.8, 1],
              ease: "easeOut"
            }}
            className="absolute top-0 flex items-center justify-center"
          >
            {/* The Gold Coin */}
            <div className="w-12 h-12 bg-yellow-400 rounded-full border-4 border-yellow-500 shadow-xl flex items-center justify-center z-10"
                 style={{ backgroundImage: 'linear-gradient(45deg, #eab308, #fef08a)' }}>
              <div className="w-8 h-8 rounded-full border-2 border-yellow-600/50 flex items-center justify-center">
                <span className="text-yellow-700 font-bold text-xs">$</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
