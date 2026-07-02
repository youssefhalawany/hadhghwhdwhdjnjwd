"use client";

import React, { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { X, CheckCircle, Volume2, VolumeX } from "lucide-react";
import { playSuccessSound } from "@/lib/sounds";

interface ContinuousScannerModalProps {
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

export function ContinuousScannerModal({ onClose, onScan }: ContinuousScannerModalProps) {
  const [scannedItems, setScannedItems] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "continuous-reader",
      { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.777778 },
      false
    );

    let lastScannedText = "";
    let lastScannedTime = 0;

    scannerRef.current.render(
      (decodedText) => {
        const now = Date.now();
        // Prevent rapid duplicate scans of the exact same barcode within 2 seconds
        if (decodedText === lastScannedText && now - lastScannedTime < 2000) {
          return; 
        }

        lastScannedText = decodedText;
        lastScannedTime = now;

        setScannedItems((prev) => [decodedText, ...prev]);
        if (soundEnabled) {
          playSuccessSound();
        }
        
        onScan(decodedText);
      },
      (error) => {
        // Ignore rapid scan errors during scanning
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [onScan, soundEnabled]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col h-[80vh] md:h-auto md:max-h-[85vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              Continuous Scan Mode
            </h3>
            <p className="text-xs text-slate-500">Rapidly scan multiple barcodes</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full hover:bg-slate-300 transition-colors"
            >
              {soundEnabled ? <Volume2 className="h-5 w-5 text-slate-700 dark:text-slate-300" /> : <VolumeX className="h-5 w-5 text-slate-500" />}
            </button>
            <button onClick={onClose} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full hover:bg-slate-300 transition-colors">
              <X className="h-5 w-5 text-slate-700 dark:text-slate-300" />
            </button>
          </div>
        </div>

        {/* Scanner Viewport */}
        <div className="w-full bg-black relative">
          <div id="continuous-reader" className="w-full h-full border-none" style={{ minHeight: '300px' }}></div>
        </div>

        {/* Scanned Items List */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-sm text-slate-600 dark:text-slate-400">Scanned Items ({scannedItems.length})</h4>
          </div>
          
          <div className="space-y-2">
            {scannedItems.length === 0 ? (
              <div className="text-center p-6 text-slate-400 text-sm italic">
                Awaiting first scan...
              </div>
            ) : (
              scannedItems.map((barcode, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl animate-in slide-in-from-top-2 fade-in">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                  <div className="flex-1">
                    <p className="font-mono text-sm font-semibold">{barcode}</p>
                    <p className="text-xs text-slate-500">Scanned successfully</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Footer Action */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
          >
            Finish Batch ({scannedItems.length})
          </button>
        </div>

      </div>
    </div>
  );
}
