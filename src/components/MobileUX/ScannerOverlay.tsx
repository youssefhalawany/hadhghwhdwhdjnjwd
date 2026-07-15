"use client";

import React, { useState, useEffect } from "react";
import { ScanLine, X, Search } from "lucide-react";
import { vibrateSuccess, vibrateError } from "@/lib/haptics";

interface ScannerOverlayProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function ScannerOverlay({ onScan, onClose }: ScannerOverlayProps) {
  const [manualInput, setManualInput] = useState("");

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      vibrateSuccess();
      onScan(manualInput.trim());
    } else {
      vibrateError();
    }
  };

  return (
    <div className="relative w-full h-[70vh] flex flex-col bg-[#050810] rounded-xl overflow-hidden shadow-inner border border-slate-800">
      
      {/* Camera Area Mock */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Placeholder for actual camera feed (e.g. react-qr-reader) */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>

        {/* Targeting Box */}
        <div className="relative w-64 h-64 border-2 border-cyan-500/50 rounded-2xl flex items-center justify-center z-10 shadow-[0_0_40px_rgba(34,211,238,0.2)]">
          {/* Corner Markers */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl -ml-[2px] -mt-[2px]" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl -mr-[2px] -mt-[2px]" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl -ml-[2px] -mb-[2px]" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-xl -mr-[2px] -mb-[2px]" />
          
          {/* Scanning Laser Animation */}
          <div className="absolute w-full h-0.5 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] animate-scan-laser" />
        </div>

        {/* Scanning Instructions */}
        <div className="absolute top-8 left-0 right-0 flex justify-center z-20">
          <div className="bg-black/60 backdrop-blur px-6 py-2 rounded-full border border-white/10 text-cyan-50 flex items-center gap-2 shadow-lg">
            <ScanLine size={16} className="text-cyan-400" />
            <span className="text-sm font-medium">Align barcode within the frame</span>
          </div>
        </div>
      </div>

      {/* Manual Entry Fallback */}
      <div className="p-6 bg-[#0B1121] border-t border-cyan-900/30">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3 text-center">Or enter barcode manually</p>
        <form onSubmit={handleManualSubmit} className="relative">
          <input
            type="number"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="e.g. 6221000..."
            className="w-full bg-[#151E32] border border-slate-700/50 rounded-xl py-3 pl-4 pr-12 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
          />
          <button 
            type="submit"
            className="absolute right-2 top-2 p-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
          >
            <Search size={20} />
          </button>
        </form>
      </div>

      {/* Inject animation keyframes for the laser */}
      <style>{`
        @keyframes scan-laser {
          0% { transform: translateY(-120px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(120px); opacity: 0; }
        }
        .animate-scan-laser {
          animation: scan-laser 2.5s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
}
