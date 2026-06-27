"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import en from "@/dictionaries/en.json";
import ar from "@/dictionaries/ar.json";

type Language = "en" | "ar";
type Dictionary = typeof en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const dictionaries: Record<Language, any> = {
  en,
  ar,
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang === "en" || savedLang === "ar") {
      setLanguageState(savedLang);
    } else {
      // Default to English
      setLanguageState("en");
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.lang = language;
      document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
      localStorage.setItem("app_lang", language);
    }
  }, [language, mounted]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (path: string): string => {
    const keys = path.split(".");
    let current: any = dictionaries[language];
    
    for (const key of keys) {
      if (current[key] === undefined) {
        // Fallback to English if key is missing in Arabic
        let fallback: any = dictionaries["en"];
        for (const fbKey of keys) {
          if (fallback[fbKey] === undefined) return path; // Return key path if not found in fallback either
          fallback = fallback[fbKey];
        }
        return fallback;
      }
      current = current[key];
    }
    
    return current;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <div dir={language === "ar" ? "rtl" : "ltr"} className={language === "ar" ? "font-arabic" : ""}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
