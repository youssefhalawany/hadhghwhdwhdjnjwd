"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playShredderSound } from "@/lib/audioCues";

interface DocumentShredderProps {
  children: React.ReactNode;
  isShredding: boolean;
  onComplete?: () => void;
  className?: string;
}

export function DocumentShredder({ children, isShredding, onComplete, className = "" }: DocumentShredderProps) {
  const [shredStarted, setShredStarted] = useState(false);

  useEffect(() => {
    if (isShredding && !shredStarted) {
      setShredStarted(true);
      playShredderSound();
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    }
  }, [isShredding, shredStarted, onComplete]);

  return (
    <div className={`relative ${className} ${shredStarted ? 'overflow-visible' : ''}`}>
      {!shredStarted ? (
        children
      ) : (
        <div className="relative w-full h-full">
          {/* Top part pulling down into shredder */}
          <motion.div
            initial={{ y: 0 }}
            animate={{ y: '100%', opacity: 0 }}
            transition={{ duration: 1.2, ease: "linear" }}
            className="w-full h-full overflow-hidden"
            style={{ 
              maskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)'
            }}
          >
            {children}
          </motion.div>

          {/* Falling strips */}
          <div className="absolute top-full left-0 w-full h-32 flex justify-between px-2 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 150, opacity: [0, 1, 0], rotateZ: (Math.random() - 0.5) * 20 }}
                transition={{ 
                  duration: 0.8, 
                  delay: 0.3 + (Math.random() * 0.4), 
                  ease: "easeIn" 
                }}
                className="w-[12%] h-full bg-[#1C2841] border border-[#22d3ee]/20 shadow-sm"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)'
                }}
              />
            ))}
          </div>

          {/* The shredder slot overlay */}
          <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-b from-transparent to-black/80 z-10 pointer-events-none" />
        </div>
      )}
    </div>
  );
}
