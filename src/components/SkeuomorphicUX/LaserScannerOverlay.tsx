"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playLaserScanSound } from "@/lib/audioCues";

interface LaserScannerOverlayProps {
  isScanning: boolean;
  scanResult: "SUCCESS" | "ERROR" | null;
  onResetResult?: () => void;
}

export function LaserScannerOverlay({ isScanning, scanResult, onResetResult }: LaserScannerOverlayProps) {
  
  useEffect(() => {
    if (scanResult) {
      playLaserScanSound(scanResult === "SUCCESS");
      
      if (onResetResult) {
        setTimeout(() => {
          onResetResult();
        }, 1000);
      }
    }
  }, [scanResult, onResetResult]);

  if (!isScanning) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center">
      {/* Scan Frame */}
      <div className="relative w-64 h-64">
        {/* Frame Corners */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400 opacity-80" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400 opacity-80" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400 opacity-80" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400 opacity-80" />

        {/* Laser Line */}
        {!scanResult && (
          <motion.div
            initial={{ y: 0 }}
            animate={{ y: [0, 250, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 w-full h-[2px] bg-red-500 shadow-[0_0_15px_3px_rgba(239,68,68,0.8)] z-50"
          />
        )}

        {/* Success / Error Flash */}
        <AnimatePresence>
          {scanResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: [0, 1, 0], scale: 1.1 }}
              transition={{ duration: 0.5 }}
              className={`absolute inset-0 m-auto w-full h-full flex items-center justify-center
                ${scanResult === 'SUCCESS' ? 'bg-white/90' : 'bg-red-500/80'}
              `}
              style={{ filter: "blur(4px)" }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
