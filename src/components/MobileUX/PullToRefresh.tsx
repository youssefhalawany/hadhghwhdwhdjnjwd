"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { triggerHapticFeedback } from "@/lib/pwaBadges";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const PULL_THRESHOLD = 70;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop <= 5) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || disabled || refreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;

    if (diff > 0) {
      // Resistance calculation
      const dist = Math.min(diff * 0.45, PULL_THRESHOLD + 20);
      setPullDistance(dist);

      if (dist > PULL_THRESHOLD && pullDistance <= PULL_THRESHOLD) {
        triggerHapticFeedback(8);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true);
      triggerHapticFeedback([15, 30, 15]);
      setPullDistance(PULL_THRESHOLD);

      try {
        await onRefresh();
      } catch (err) {
        console.error("Pull to refresh error", err);
      } finally {
        setTimeout(() => {
          setRefreshing(false);
          setPullDistance(0);
        }, 500);
      }
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative min-h-screen"
    >
      {/* Pull Indicator Header */}
      <AnimatePresence>
        {(pullDistance > 0 || refreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-14 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center p-2 rounded-full bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md text-white"
          >
            <RefreshCw
              className={`w-5 h-5 text-red-500 ${
                refreshing ? "animate-spin" : ""
              }`}
              style={{
                transform: refreshing ? "none" : `rotate(${pullDistance * 3}deg)`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.5}px)` : "none",
          transition: isPulling.current ? "none" : "transform 0.3s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
