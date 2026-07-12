"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useLanguage } from "@/context/LanguageContext";

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
  onClose?: () => void;
}

export function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const { language: lang } = useLanguage();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Prevent multiple initializations in React 18 strict mode
    if (scannerRef.current) return;

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true,
      showZoomSliderIfSupported: true,
      defaultZoomValueIfSupported: 2
    };

    scannerRef.current = new Html5QrcodeScanner("reader", config, false);

    scannerRef.current.render(
      (decodedText) => {
        // Pause scanning to prevent multiple rapid scans
        if (scannerRef.current) {
           scannerRef.current.pause(true);
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

        onScan(decodedText);
        
        // Auto close after successful scan
        if (onClose) onClose();
      },
      (err) => {
        // ignore verbose scan errors (usually just "not found")
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
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
        <div id="reader" className="w-full bg-black min-h-[300px]"></div>
        
        <div className="p-4 bg-slate-100 text-center text-sm font-bold text-slate-600">
          {lang === "ar" ? "قم بتوجيه الكاميرا نحو الباركود" : "Point camera at barcode"}
        </div>
      </div>
    </div>
  );
}
