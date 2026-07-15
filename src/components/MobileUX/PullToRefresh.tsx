"use client";

import React, { useState, useRef, useEffect } from "react";
import { RefreshCw } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHapticRef = useRef(0);

  // Apply damping for elastic spring feel
  const rawDistance = Math.max(0, currentY - startY);
  const pullDistance = rawDistance * 0.45;
  const maxPull = 120;
  const threshold = 80;
  
  const pullPercentage = Math.min(100, (pullDistance / threshold) * 100);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow pull-to-refresh if we are at the top of the container
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    
    const y = e.touches[0].clientY;
    if (y > startY) {
      // Prevent default scrolling when pulling down
      e.cancelable && e.preventDefault();
      setCurrentY(y);
      
      const dist = y - startY;
      if (dist - lastHapticRef.current > 30) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5);
        lastHapticRef.current = dist;
      }
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);
    lastHapticRef.current = 0;
    
    if (pullDistance > threshold && !isRefreshing) {
      setIsRefreshing(true);
      if (typeof navigator.vibrate === "function") navigator.vibrate([20]);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setStartY(0);
        setCurrentY(0);
      }
    } else {
      setStartY(0);
      setCurrentY(0);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-y-auto overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull Indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center items-center overflow-hidden transition-all duration-200 ease-out"
        style={{ 
          height: isRefreshing ? '60px' : `${Math.min(maxPull, pullDistance)}px`,
          opacity: pullDistance > 10 || isRefreshing ? 1 : 0
        }}
      >
        <div 
          className={`flex items-center justify-center rounded-full bg-[#083344] backdrop-blur shadow-[0_0_15px_rgba(34,211,238,0.3)] p-2 border border-cyan-400/30 ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            transform: `rotate(${isRefreshing ? 0 : pullPercentage * 3.6}deg) scale(${pullPercentage / 100})`,
          }}
        >
          <RefreshCw size={24} className="text-cyan-400" />
        </div>
      </div>

      {/* Content wrapper that shifts down slightly when pulled */}
      <div 
        className="transition-transform duration-200 ease-out min-h-full"
        style={{ 
          transform: `translateY(${isRefreshing ? 60 : (isPulling ? Math.min(maxPull, pullDistance) * 0.4 : 0)}px)` 
        }}
      >
        {children}
      </div>
    </div>
  );
}
