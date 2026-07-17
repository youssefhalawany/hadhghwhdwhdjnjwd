"use client";

import React, { useState, useEffect } from "react";
import { Download, X, Share } from "lucide-react";
import { usePathname } from "next/navigation";

export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInstalled, setIsInstalled] = useState(true); // Default true to prevent flash

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
      } else {
        setIsInstalled(false);
      }
    };
    checkInstalled();

    // Check if the device is iOS
    const checkIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };
    
    // Defer setting platform state to avoid cascading render lint warning
    setTimeout(() => {
      const isIOSDevice = checkIOS();
      const isAndroidDevice = /android/.test(window.navigator.userAgent.toLowerCase());
      setIsIOS(isIOSDevice);
      setIsAndroid(isAndroidDevice);
      if (!isInstalled) {
        setShowPrompt(true);
      }
    }, 0);

    // Listen for Chrome/Android install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    
    // Listen for successful installation
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [isInstalled]);

  const handleInstallClick = async () => {
    if (isIOS) {
      alert("To install on iOS: Tap the 'Share' icon at the bottom of Safari, then scroll down and tap 'Add to Home Screen'.");
      return;
    }

    if (!deferredPrompt) {
      alert("To install this app, please use your browser's menu (e.g., 'Install App' or 'Add to Home Screen').");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt || isInstalled) return null;

  const isCashierPortal = pathname?.startsWith('/cashier') || pathname?.startsWith('/shift-reports/cashier') || pathname?.startsWith('/voids/cashier') || pathname?.startsWith('/checklists/cashier');
  const appName = isCashierPortal ? "Cashier App" : "Manager App";

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11/12 max-w-sm bg-background border-2 border-red-500 rounded-xl shadow-2xl p-4 z-[9999] animate-in zoom-in-95 duration-200">
      <button 
        onClick={() => setShowPrompt(false)}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="flex items-start gap-3 mt-2">
        <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
          <Download className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h3 className="font-bold text-sm">Install {appName}</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            {isIOS 
              ? "Install this app on your iPhone for quick access and offline capabilities."
              : isAndroid 
                ? "Install this app on your device for a better experience and faster loading."
                : "Install this app on your computer for a native desktop experience."}
          </p>
          
          <button 
            onClick={handleInstallClick}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all flex items-center justify-center gap-2"
          >
            {isIOS ? (
              <><Share className="h-3 w-3" /> How to Install</>
            ) : (
              <><Download className="h-3 w-3" /> Install Now</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
