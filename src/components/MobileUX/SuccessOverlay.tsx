"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { playSuccessChime } from "@/lib/audioCues";
import { vibrateSuccess } from "@/lib/haptics";

type SuccessEvent = {
  id: string;
  message?: string;
};

class SuccessManager {
  private listener: ((e: SuccessEvent | null) => void) | null = null;
  private currentTimeout: NodeJS.Timeout | null = null;

  subscribe(listener: (e: SuccessEvent | null) => void) {
    this.listener = listener;
    return () => { this.listener = null; };
  }

  trigger(message?: string) {
    if (this.currentTimeout) clearTimeout(this.currentTimeout);
    
    if (this.listener) {
      this.listener({ id: Math.random().toString(), message });
    }
    
    // Play sound and haptics
    setTimeout(() => {
      playSuccessChime();
      vibrateSuccess();
    }, 100); // slight delay for visual sync
    
    this.currentTimeout = setTimeout(() => {
      if (this.listener) this.listener(null);
    }, 2500); // Overlay stays for 2.5s
  }
}

export const successOverlayManager = new SuccessManager();

export const triggerSuccessOverlay = (message?: string) => {
  successOverlayManager.trigger(message);
};

export function SuccessOverlay() {
  const [event, setEvent] = useState<SuccessEvent | null>(null);

  useEffect(() => {
    return successOverlayManager.subscribe(setEvent);
  }, []);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/40 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 12, stiffness: 100 }}
            className="flex flex-col items-center"
          >
            {/* Circle & Checkmark */}
            <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-emerald-500/20 mb-6 shadow-[0_0_50px_rgba(16,185,129,0.3)]">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.6, delay: 0.2 }}
                className="absolute inset-0 rounded-full bg-emerald-500 flex items-center justify-center"
              >
                <motion.div
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
                >
                  <Check strokeWidth={4} className="text-white w-16 h-16" />
                </motion.div>
              </motion.div>
            </div>
            
            {event.message && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-white font-bold text-xl tracking-tight"
              >
                {event.message}
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
