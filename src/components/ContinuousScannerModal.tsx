"use client";

import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ScanLine, X, CheckCircle, Volume2, VolumeX, ListCollapse } from "lucide-react";
import { playSuccessSound } from "@/lib/sounds";

interface ContinuousScannerModalProps {
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

export function ContinuousScannerModal({ onClose, onScan }: ContinuousScannerModalProps) {
  const [scannedItems, setScannedItems] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [error, setError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (scannerRef.current) return;
    let isMounted = true;

    setTimeout(async () => {
      if (!isMounted) return;
      
      try {
        const html5QrCode = new Html5Qrcode("continuous-reader");
        scannerRef.current = html5QrCode;
        
        let lastScannedText = "";
        let lastScannedTime = 0;

        const handleScan = (decodedText: string) => {
          const now = Date.now();
          if (decodedText === lastScannedText && now - lastScannedTime < 2000) return; 

          lastScannedText = decodedText;
          lastScannedTime = now;

          setScannedItems((prev) => [decodedText, ...prev]);
          if (soundEnabled) {
            playSuccessSound();
          }
          
          onScan(decodedText);
        };

        const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
        
        const startWithConstraints = async (constraints: any) => {
          return html5QrCode.start(constraints, config, handleScan, undefined);
        };

        try {
          await startWithConstraints({ facingMode: "environment" });
        } catch (err) {
          try {
            await startWithConstraints({ video: true });
          } catch (fallbackErr) {
            setError("Camera error. Please ensure permissions are granted.");
          }
        }
      } catch (err) {
        setError("Scanner initialization failed.");
      }
    }, 250);

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(e => console.error("Cleanup error", e));
        scannerRef.current = null;
      }
    };
  }, [onScan, soundEnabled]);

  return (
    <div className="fixed inset-0 z-[999] bg-[#050810] flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 flex justify-between items-center p-6 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <ScanLine size={20} className="text-indigo-400" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse border border-black" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg leading-tight">
              Continuous Mode
            </h3>
            <p className="text-xs text-indigo-200/60 font-medium">
              Rapidly scan multiple items
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/10 active:scale-95 transition-transform"
          >
            {soundEnabled ? <Volume2 size={20} className="text-white" /> : <VolumeX size={20} className="text-white/50" />}
          </button>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/10 active:scale-95 transition-transform"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* The scanner renders into this div */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        <div 
          id="continuous-reader" 
          className="absolute inset-0 [&>video]:object-cover [&>video]:w-full [&>video]:h-full" 
          style={{ width: "100%", height: "100%" }}
        />
        
        {/* Overlay with animated box */}
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
          
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" style={{ clipPath: "polygon(0% 0%, 0% 100%, 20% 100%, 20% 30%, 80% 30%, 80% 70%, 20% 70%, 20% 100%, 100% 100%, 100% 0%)" }} />

          {/* Targeting Box */}
          <div className="relative w-64 h-64 border-2 border-indigo-500/30 rounded-2xl flex items-center justify-center z-20 shadow-[0_0_40px_rgba(99,102,241,0.15)]">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-xl -ml-[2px] -mt-[2px]" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-xl -mr-[2px] -mt-[2px]" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-xl -ml-[2px] -mb-[2px]" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-xl -mr-[2px] -mb-[2px]" />
            
            <div className="absolute w-full h-[2px] bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] animate-scan-laser" />
          </div>

          {error && (
            <div className="mt-8 bg-red-500/90 text-white text-sm font-bold px-6 py-3 rounded-full backdrop-blur-md shadow-lg border border-red-400">
              {error}
            </div>
          )}
        </div>
      </div>
      
      {/* Footer list */}
      <div className="absolute bottom-0 left-0 right-0 z-50 p-4 pb-8 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
        <div className="w-full max-w-sm mx-auto pointer-events-auto flex flex-col gap-3">
          
          <div className="h-40 overflow-y-auto flex flex-col-reverse gap-2 pr-2 scrollbar-hide" style={{ maskImage: "linear-gradient(to top, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to top, black 50%, transparent 100%)" }}>
            {scannedItems.length === 0 ? (
              <div className="text-center py-4 text-white/40 text-sm font-medium animate-pulse">
                Awaiting first scan...
              </div>
            ) : (
              scannedItems.map((barcode, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl shadow-lg">
                  <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
                  <div className="flex-1">
                    <p className="font-mono text-sm font-semibold text-white">{barcode}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <button 
            onClick={onClose}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.3)] border border-indigo-400/50 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Finish Batch ({scannedItems.length})
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scan-laser {
          0% { transform: translateY(-120px); opacity: 0; }
          10% { opacity: 1; }
          50% { transform: translateY(120px); }
          90% { opacity: 1; }
          100% { transform: translateY(-120px); opacity: 0; }
        }
        .animate-scan-laser {
          animation: scan-laser 2.5s ease-in-out infinite;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        #continuous-reader { border: none !important; }
        #continuous-reader__dashboard_section_csr { display: none !important; }
        #continuous-reader__dashboard_section_swaplink { display: none !important; }
      `}</style>
    </div>
  );
}
