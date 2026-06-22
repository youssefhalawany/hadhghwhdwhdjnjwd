"use client";

import React, { useState, useEffect } from "react";
import { Download, X, Share } from "lucide-react";

export default function PwaInstallPrompt() {
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
      if ((isIOSDevice || isAndroidDevice) && !isInstalled) {
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

    if (isAndroid) {
      const link = document.createElement("a");
      link.href = "/circlek-cashier.apk";
      link.download = "circlek-cashier.apk";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert("Downloading App... Once downloaded, tap the file to install it. You may need to 'Allow installing from unknown sources'.");
      
      setIsInstalled(true);
      setShowPrompt(false);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-background border-2 border-red-500 rounded-xl shadow-2xl p-4 z-50 animate-in slide-in-from-bottom-5">
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
          <h3 className="font-bold text-sm">Install Cashier App</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            {isIOS 
              ? "Install this app on your iPhone for quick access and offline capabilities."
              : "Install this app on your device for a better experience and faster loading."}
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
