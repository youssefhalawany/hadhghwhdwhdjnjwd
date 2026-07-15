"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, Info, Loader2 } from "lucide-react";
import { playSwooshSound, playSuccessChime } from "@/lib/audioCues";
import { vibrateSuccess, vibrateError } from "@/lib/haptics";

export type IslandNotification = {
  id: string;
  title: string;
  message?: string;
  type: "success" | "error" | "info" | "loading";
  duration?: number; // 0 for infinite
};

type NotifyFunction = (
  title: string,
  options?: { message?: string; type?: IslandNotification["type"]; duration?: number }
) => string;

class IslandEventManager {
  private listener: ((n: IslandNotification | null) => void) | null = null;
  private currentNotification: IslandNotification | null = null;
  private timeoutId: NodeJS.Timeout | null = null;

  subscribe(listener: (n: IslandNotification | null) => void) {
    this.listener = listener;
    return () => { this.listener = null; };
  }

  notify(notification: IslandNotification) {
    this.currentNotification = notification;
    if (this.listener) this.listener(this.currentNotification);
    
    // Sounds and Haptics
    if (notification.type === "success") {
      playSuccessChime();
      vibrateSuccess();
    } else if (notification.type === "error") {
      playSwooshSound();
      vibrateError();
    } else {
      playSwooshSound();
    }

    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (notification.duration !== 0) {
      this.timeoutId = setTimeout(() => {
        this.dismiss(notification.id);
      }, notification.duration || 3000);
    }
  }

  dismiss(id: string) {
    if (this.currentNotification?.id === id) {
      this.currentNotification = null;
      if (this.listener) this.listener(null);
    }
  }
}

export const dynamicIslandManager = new IslandEventManager();

export const showIsland: NotifyFunction = (title, options = {}) => {
  const id = Math.random().toString(36).substring(7);
  dynamicIslandManager.notify({
    id,
    title,
    message: options.message,
    type: options.type || "info",
    duration: options.duration
  });
  return id;
};

export const dismissIsland = (id: string) => {
  dynamicIslandManager.dismiss(id);
};

export function DynamicIsland() {
  const [notification, setNotification] = useState<IslandNotification | null>(null);

  useEffect(() => {
    return dynamicIslandManager.subscribe(setNotification);
  }, []);

  const getIcon = () => {
    switch (notification?.type) {
      case "success": return <CheckCircle className="h-5 w-5 text-emerald-400" />;
      case "error": return <AlertTriangle className="h-5 w-5 text-red-400" />;
      case "loading": return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />;
      default: return <Info className="h-5 w-5 text-white" />;
    }
  };

  return (
    <div className="fixed top-4 left-0 right-0 z-[999] flex justify-center pointer-events-none px-4">
      <AnimatePresence mode="wait">
        {notification && (
          <motion.div
            key={notification.id}
            initial={{ y: -50, scale: 0.5, opacity: 0, borderRadius: "50px" }}
            animate={{ y: 0, scale: 1, opacity: 1, borderRadius: "30px" }}
            exit={{ y: -20, scale: 0.8, opacity: 0, borderRadius: "50px" }}
            transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
            className="bg-black/90 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden pointer-events-auto cursor-pointer flex items-center gap-3"
            style={{ 
              minWidth: "150px", 
              maxWidth: "350px",
              padding: notification.message ? "12px 16px" : "8px 16px"
            }}
            onClick={() => dismissIsland(notification.id)}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
              className="shrink-0"
            >
              {getIcon()}
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col"
            >
              <span className="text-white font-bold text-sm tracking-tight leading-tight">
                {notification.title}
              </span>
              {notification.message && (
                <span className="text-white/60 text-xs font-medium mt-0.5 leading-tight">
                  {notification.message}
                </span>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
