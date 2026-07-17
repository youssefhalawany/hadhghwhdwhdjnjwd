"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function IdleScreensaver() {
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      setIsIdle(false);
      clearTimeout(timeoutId);
      // Set to 60 seconds (1 minute) as requested
      timeoutId = setTimeout(() => setIsIdle(true), 60000);
    };

    // Initial set
    resetTimer();

    const events = ["mousemove", "keydown", "touchstart", "scroll", "click"];
    
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, []);

  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (!isIdle) return;
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isIdle]);

  return (
    <AnimatePresence>
      {isIdle && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center text-white"
        >
          <div className="flex flex-col items-center space-y-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center font-bold text-3xl border-4 border-white tracking-tighter">
                K
              </div>
              <span className="text-4xl font-black tracking-widest text-white/90">ANH</span>
            </div>
            
            <div className="text-[120px] leading-none font-black tracking-tighter font-mono bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent drop-shadow-2xl">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            
            <div className="text-2xl font-bold text-cyan-400 mt-2">
              {time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              className="mt-16 text-gray-500 uppercase tracking-widest text-sm"
            >
              Move mouse or tap to unlock
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
