"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useColor } from "color-thief-react";

interface BrandContextType {
  logoUrl: string;
  setLogoUrl: (url: string) => void;
  brandColor: string | null;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export const BrandProvider = ({ children }: { children: ReactNode }) => {
  const [logoUrl, setLogoUrl] = useState("");
  // Only attempt color extraction if it's a valid URL string
  const { data: color } = useColor(logoUrl || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "hex", { crossOrigin: "anonymous" });

  useEffect(() => {
    // Attempt to load logo from localStorage
    const savedLogo = localStorage.getItem("storeLogoUrl");
    if (savedLogo) setLogoUrl(savedLogo);
  }, []);

  useEffect(() => {
    if (color && color !== "#000000" && color !== "#ffffff") {
      document.documentElement.style.setProperty("--brand-primary", color);
      // Fallback for elements using red-600
      const style = document.createElement("style");
      style.innerHTML = `
        .text-red-600 { color: ${color} !important; }
        .bg-red-600 { background-color: ${color} !important; }
        .border-red-600 { border-color: ${color} !important; }
        
        .dark .text-red-500 { color: ${color} !important; }
        .dark .bg-red-500 { background-color: ${color} !important; }
        .dark .border-red-500 { border-color: ${color} !important; }
      `;
      document.head.appendChild(style);
      return () => {
        document.head.removeChild(style);
      };
    }
  }, [color]);

  return (
    <BrandContext.Provider value={{ logoUrl, setLogoUrl: (url) => { setLogoUrl(url); localStorage.setItem("storeLogoUrl", url); }, brandColor: color || null }}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => {
  const context = useContext(BrandContext);
  if (!context) throw new Error("useBrand must be used within BrandProvider");
  return context;
};
