"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useLanguage } from "@/context/LanguageContext";

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
    <div className="fixed inset-0 z-[999] bg-black/95 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
          <h3 className="font-bold">
            {lang === "ar" ? "مسح الباركود بالكاميرا" : "Camera Barcode Scanner"}
          </h3>
          {onClose && (
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-red-500 rounded-lg text-sm font-bold hover:bg-red-600 transition-colors shadow-lg"
            >
              {lang === "ar" ? "إغلاق" : "Close"}
            </button>
          )}
        </div>
        
        {/* The scanner renders into this div */}
        <div id="reader" className="w-full bg-black min-h-[300px] flex items-center justify-center">
          {error && <div className="text-red-500 font-bold p-4 text-center">{error}</div>}
        </div>
        
        <div className="p-4 bg-slate-100 text-center text-sm font-bold text-slate-600">
          {lang === "ar" ? "قم بتوجيه الكاميرا نحو الباركود" : "Point camera at barcode"}
        </div>
      </div>
    </div>
  );
}
