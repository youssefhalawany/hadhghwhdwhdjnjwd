"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useLanguage } from "@/context/LanguageContext";

import { ScanLine, X, Search } from "lucide-react";

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
  onClose?: () => void;
}

export function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const { language: lang } = useLanguage();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Prevent multiple initializations
    if (scannerRef.current) return;

    let isMounted = true;

    // We delay slightly to ensure the DOM element exists before initializing
    setTimeout(async () => {
      if (!isMounted) return;
      
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

        const handleScan = async (decodedText: string) => {
          // Pause immediately so it doesn't scan again while beep plays
          if (scannerRef.current) {
            try { scannerRef.current.pause(true); } catch(e){}
          }

          // Play beep sound
          try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
              const ctx = new AudioContext();
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
          } catch (e) {
            console.error("Audio beep failed", e);
          }

          if (scannerRef.current) {
            try {
              await scannerRef.current.stop();
            } catch (e) {
              console.error("Error stopping scanner", e);
            }
            scannerRef.current = null;
          }
          
          onScan(decodedText);
          if (onClose) onClose();
        };

        const startWithConstraints = async (constraints: any) => {
          return html5QrCode.start(
            constraints,
            config,
            handleScan,
            undefined
          );
        };

        try {
          // Try standard environment camera
          await startWithConstraints({ facingMode: "environment" });
        } catch (err) {
          try {
            // Fallback to any camera
            await startWithConstraints({ video: true });
          } catch (fallbackErr) {
            setError(lang === "en" ? "Camera error. Please ensure permissions are granted or use a supported browser." : "فشل الكاميرا. يرجى منح الصلاحيات.");
          }
        }
      } catch (err) {
        console.error("Scanner init error:", err);
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
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 z-[999] bg-[#050810] flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 flex justify-between items-center p-6 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
            <ScanLine size={20} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg leading-tight">
              {lang === "ar" ? "مسح الباركود" : "Scan Barcode"}
            </h3>
            <p className="text-xs text-cyan-200/60 font-medium">
              {lang === "ar" ? "قم بتوجيه الكاميرا" : "Align barcode in frame"}
            </p>
          </div>
        </div>
        
        {onClose && (
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/10 active:scale-95 transition-transform"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* The scanner renders into this div */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {/* We use a wrapper to force the video to fill the screen but keep the scanner logic intact */}
        <div 
          id="reader" 
          className="absolute inset-0 [&>video]:object-cover [&>video]:w-full [&>video]:h-full" 
          style={{ width: "100%", height: "100%" }}
        />
        
        {/* Overlay with animated box */}
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
          
          {/* Dark backdrop with cutout */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" style={{ clipPath: "polygon(0% 0%, 0% 100%, 20% 100%, 20% 30%, 80% 30%, 80% 70%, 20% 70%, 20% 100%, 100% 100%, 100% 0%)" }} />

          {/* Targeting Box */}
          <div className="relative w-64 h-64 border-2 border-cyan-500/30 rounded-2xl flex items-center justify-center z-20 shadow-[0_0_40px_rgba(34,211,238,0.15)]">
            {/* Corner Markers */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl -ml-[2px] -mt-[2px]" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl -mr-[2px] -mt-[2px]" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl -ml-[2px] -mb-[2px]" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-xl -mr-[2px] -mb-[2px]" />
            
            {/* Scanning Laser Animation */}
            <div className="absolute w-full h-[2px] bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] animate-scan-laser" />
          </div>

          {error && (
            <div className="mt-8 bg-red-500/90 text-white text-sm font-bold px-6 py-3 rounded-full backdrop-blur-md shadow-lg border border-red-400">
              {error}
            </div>
          )}
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
        #reader { border: none !important; }
        #reader__dashboard_section_csr { display: none !important; }
        #reader__dashboard_section_swaplink { display: none !important; }
      `}</style>
    </div>
  );
}
