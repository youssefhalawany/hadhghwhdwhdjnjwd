"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { playMarkerScratchSound } from "@/lib/audioCues";

interface ClipboardChecklistProps {
  items: { id: string; label: string; checked: boolean }[];
  onToggle: (id: string) => void;
  className?: string;
}

export function ClipboardChecklist({ items, onToggle, className = "" }: ClipboardChecklistProps) {
  
  const handleToggle = (id: string, checked: boolean) => {
    if (!checked) {
      // Only play sound when checking (not unchecking) to mimic writing
      playMarkerScratchSound();
    }
    onToggle(id);
  };

  return (
    <div className={`relative bg-[#fefce8] text-gray-900 rounded-lg shadow-md border border-[#eab308]/40 p-4 font-sans ${className}`}
         style={{
           backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #93c5fd 31px, #93c5fd 32px)',
           backgroundAttachment: 'local'
         }}>
      
      {/* Clipboard Clip Graphic */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-300 rounded-t-lg shadow-md border border-gray-400 flex items-center justify-center">
        <div className="w-16 h-2 bg-gray-400 rounded-full shadow-inner" />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {items.map((item) => (
          <div 
            key={item.id} 
            className="flex items-center gap-4 cursor-pointer"
            onClick={() => handleToggle(item.id, item.checked)}
          >
            <div className="relative w-6 h-6 border-2 border-gray-700 rounded-sm flex items-center justify-center bg-white flex-shrink-0">
              {item.checked && (
                <motion.svg 
                  className="absolute inset-0 w-8 h-8 text-blue-800 -top-2 -left-1" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <motion.path 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    d="M3,12 C7,15 10,18 10,18 C10,18 16,7 21,3" 
                  />
                </motion.svg>
              )}
            </div>
            <span className={`text-base font-semibold transition-all ${item.checked ? 'text-gray-500 line-through decoration-gray-400 decoration-2' : 'text-gray-900'}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
