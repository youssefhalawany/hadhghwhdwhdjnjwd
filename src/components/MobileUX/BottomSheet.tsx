"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  height?: string; // e.g. "80vh", "auto"
}

export function BottomSheet({ isOpen, onClose, children, title, height = "auto" }: BottomSheetProps) {
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    
    if (isOpen) {
      setIsRendered(true);
      document.body.style.overflow = "hidden";
    } else {
      setTimeout(() => setIsRendered(false), 300); // Wait for exit animation
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen && !isRendered) return null;

  return (
    <div 
      className={`fixed inset-0 z-[999] flex flex-col justify-end transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div 
        className={`relative w-full bg-[#0B1121] border-t border-cyan-500/20 rounded-t-[32px] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ height, maxHeight: "90vh" }}
      >
        {/* Drag Handle */}
        <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
          <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex justify-between items-center px-6 py-4 border-b border-white/5">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <button 
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {children}
        </div>
      </div>
    </div>
  );
}
