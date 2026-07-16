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

  const [scannerError, setScannerError] = useState("");
  const scannerRef = React.useRef<any>(null);
  const audioCtxRef = React.useRef<any>(null);

  useEffect(() => {
    // Only initialize scanner on mount
    const initAudio = () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtxRef.current.state === "suspended") {
          audioCtxRef.current.resume();
        }
      } catch(e) {}
    };

    const startScanner = async () => {
      initAudio();
      
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode } = await import("html5-qrcode");
      
      setTimeout(async () => {
        try {
          const html5QrCode = new Html5Qrcode("master-scanner-reader");
          const config = { fps: 10, qrbox: { width: 250, height: 250 } };

          const startWithConstraints = async (constraints: any) => {
            return html5QrCode.start(
              constraints,
              config,
              (decodedText) => {
                try {
                  const ctx = audioCtxRef.current;
                  if (ctx) {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(800, ctx.currentTime);
                    gain.gain.setValueAtTime(0.1, ctx.currentTime);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.15);
                  }
                } catch (e) {}
                vibrateSuccess();
                onScan(decodedText);
              },
              undefined
            );
          };

          try {
            await startWithConstraints({ facingMode: "environment" });
            scannerRef.current = html5QrCode;
          } catch (err) {
            try {
              await startWithConstraints({ video: true });
              scannerRef.current = html5QrCode;
            } catch (fallbackErr) {
              setScannerError("Camera error. Please grant permissions.");
            }
          }
        } catch (err: any) {
          setScannerError("Scanner error.");
        }
      }, 300);
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop(); } catch (e) {}
      }
    };
  }, [onScan]);

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
    <div className="relative w-full flex flex-col bg-[#050810] rounded-xl overflow-hidden shadow-inner border border-slate-800">
      
      {/* Camera Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-[350px] bg-white">
        {scannerError ? (
          <div className="absolute inset-0 bg-[#050810] flex items-center justify-center z-30 flex-col px-6 text-center">
             <div className="w-16 h-16 rounded-full border-2 border-dashed border-red-500/50 flex items-center justify-center mb-4">
                <ScanLine className="text-red-500 opacity-50" />
             </div>
             <p className="text-red-400 font-bold mb-2">{scannerError}</p>
             <p className="text-sm text-slate-500">You must allow camera access in your browser or phone settings to scan barcodes.</p>
          </div>
        ) : (
          <div id="master-scanner-reader" className="w-full h-full object-cover"></div>
        )}
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
    </div>
  );
}
