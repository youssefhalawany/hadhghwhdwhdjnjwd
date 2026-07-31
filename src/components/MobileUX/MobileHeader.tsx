"use client";

import React, { useState, useEffect } from "react";
import { useBranch, BranchId } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { Store, Languages, Clock, Bell } from "lucide-react";
import { playPopSound } from "@/lib/sounds";
import { toast } from "sonner";

export function MobileHeader() {
  const { currentBranch, setBranch } = useBranch();
  const { language, setLanguage } = useLanguage();
  const isAr = language === "ar";

  const [isOnline, setIsOnline] = useState(true);
  const [timeString, setTimeString] = useState("");

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString(isAr ? "ar-EG" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isAr]);

  const branches: Array<{ id: BranchId; labelEn: string; labelAr: string }> = [
    { id: "all", labelEn: "All Branches", labelAr: "جميع الفروع" },
    { id: "alamein4", labelEn: "El Alamein 4", labelAr: "العلمين 4" },
    { id: "ola", labelEn: "Ola El Koronfol", labelAr: "علا القرنفلي" },
  ];

  const handleBranchSelect = (id: BranchId) => {
    triggerHapticFeedback(10);
    playPopSound();
    setBranch(id);
  };

  const handleLanguageToggle = () => {
    triggerHapticFeedback(12);
    playPopSound();
    setLanguage(language === "en" ? "ar" : "en");
  };

  const handleNotificationToggle = async () => {
    triggerHapticFeedback(12);
    playPopSound();

    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error(isAr ? "الإشعارات غير مدعومة على هذا المتصفح" : "Notifications not supported on this browser");
      return;
    }

    if (Notification.permission === "granted") {
      toast.success(isAr ? "الإشعارات الفورية مفعّلة بنجاح 🔔" : "Push Notifications Active 🔔");
    } else {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        toast.success(isAr ? "تم تفعيل الإشعارات الفورية للموبايل! 🔔" : "Push Notifications Enabled! 🔔");
      } else {
        toast.error(isAr ? "تم رفض الإشعارات. يرجى تفعيلها من إعدادات المتصفح" : "Notification permission denied in browser settings.");
      }
    }
  };

  return (
    <header
      className="sticky top-0 z-40 w-full bg-[#0B1121] border-b border-[#1E293B] px-3 py-2 md:hidden no-print transition-all"
      style={{
        paddingTop: "max(10px, env(safe-area-inset-top))",
      }}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Top Bar: Brand, Status, Time, Language */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {/* Circle K Red Badge */}
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white font-black text-xs shadow-md shadow-red-600/30">
            K
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight text-white flex items-center gap-1">
              ANH Portal
            </h1>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-slate-400" />
              <span>{timeString}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Online/Offline Status Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0F172A] border border-[#1E293B] text-[10px] font-bold">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-amber-500 animate-pulse"
                }`}
            />
            <span className={isOnline ? "text-emerald-400" : "text-amber-400"}>
              {isOnline ? (isAr ? "مباشر" : "Online") : (isAr ? "محلي" : "Offline")}
            </span>
          </div>

          {/* 1-Tap Notification Permission Pill */}
          <button
            onClick={handleNotificationToggle}
            className="flex items-center gap-1 p-1.5 rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-amber-400 border border-[#1E293B] transition-all active:scale-95"
            title="Enable Push Notifications"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
          </button>

          {/* 1-Tap Language Switcher Pill */}
          <button
            onClick={handleLanguageToggle}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-cyan-400 border border-[#1E293B] text-[11px] font-extrabold transition-all active:scale-95"
          >
            <Languages className="w-3.5 h-3.5 text-cyan-400" />
            <span>{language === "en" ? "العربية" : "EN"}</span>
          </button>
        </div>
      </div>

      {/* Bottom Bar: Horizontal Branch Chip Carousel */}
      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5 px-0.5">
        <Store className="w-3.5 h-3.5 text-cyan-400 shrink-0 mx-0.5" />
        {branches.map((b) => {
          const isActive = currentBranch === b.id;
          return (
            <button
              key={b.id}
              onClick={() => handleBranchSelect(b.id)}
              className={`px-3 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap transition-all active:scale-95 shrink-0 ${isActive
                ? "bg-red-600 text-white shadow-md shadow-red-600/30 border border-red-500"
                : "bg-[#0F172A] text-slate-300 hover:text-white border border-[#1E293B]"
                }`}
            >
              {isAr ? b.labelAr : b.labelEn}
            </button>
          );
        })}
      </div>
    </header>
  );
}
