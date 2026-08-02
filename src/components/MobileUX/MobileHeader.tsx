"use client";

import React, { useState, useEffect } from "react";
import { useBranch, BranchId } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { Store, Languages, Clock, Bell, LogOut, UserCheck, ShieldCheck, Sparkles } from "lucide-react";
import { playPopSound } from "@/lib/sounds";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export function MobileHeader() {
  const { currentBranch, setBranch, availableBranches } = useBranch();
  const { language, setLanguage } = useLanguage();
  const isAr = language === "ar";

  const [isOnline, setIsOnline] = useState(true);
  const [timeString, setTimeString] = useState("");
  const [userRole, setUserRole] = useState("manager");
  const [managerName, setManagerName] = useState("Manager");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedRole = localStorage.getItem("circlek_role") || "manager";
      setUserRole(storedRole);

      const storedName = localStorage.getItem("circlek_user_name") || "Manager";
      setManagerName(storedName);
    }

    const handleRoleChanged = (e: CustomEvent) => {
      if (e.detail) setUserRole(e.detail);
    };

    const handleUserChanged = (e: CustomEvent) => {
      if (e.detail) setManagerName(e.detail);
    };

    window.addEventListener("circlek_role_changed", handleRoleChanged as any);
    window.addEventListener("circlek_user_changed", handleUserChanged as any);

    return () => {
      window.removeEventListener("circlek_role_changed", handleRoleChanged as any);
      window.removeEventListener("circlek_user_changed", handleUserChanged as any);
    };
  }, []);

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
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [isAr]);

  // Format branches dynamically according to user authorization
  const displayBranches = React.useMemo(() => {
    const activeRole = userRole || (typeof window !== "undefined" ? localStorage.getItem("circlek_role") : "manager") || "manager";
    const isManager = activeRole === "manager";

    if (isManager) {
      if (availableBranches && availableBranches.length > 0) {
        return availableBranches.map(b => ({
          id: b.id,
          labelEn: b.name,
          labelAr: b.id === "alamein4" ? "العلمين 4" : b.id === "ola" ? "علا القرنفلي" : b.name
        }));
      }
      return [
        { id: "alamein4" as BranchId, labelEn: "El Alamein 4", labelAr: "العلمين 4" }
      ];
    }

    if (availableBranches && availableBranches.length > 0) {
      return [
        { id: "all" as BranchId, labelEn: "All Branches", labelAr: "جميع الفروع" },
        ...availableBranches.map(b => ({
          id: b.id,
          labelEn: b.name,
          labelAr: b.id === "alamein4" ? "العلمين 4" : b.id === "ola" ? "علا القرنفلي" : b.name
        }))
      ];
    }
    return [
      { id: "all" as BranchId, labelEn: "All Branches", labelAr: "جميع الفروع" },
      { id: "alamein4" as BranchId, labelEn: "El Alamein 4", labelAr: "العلمين 4" },
      { id: "ola" as BranchId, labelEn: "Ola El Koronfol", labelAr: "علا القرنفلي" },
    ];
  }, [availableBranches, userRole]);

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
      try {
        new Notification("🔔 Test Push Notification", {
          body: "Test notification dispatched successfully from Circle K Portal!",
          icon: "/icon-manager.png"
        });
      } catch (err) {
        console.warn("Local notification display error:", err);
      }

      toast.success(isAr ? "تم إرسال إشعار تجريبي بنجاح! 🔔" : "Test Notification Sent! 🔔");
    } else {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        try {
          new Notification("🔔 Test Push Notification", {
            body: "Push Notifications Enabled & Verified!",
            icon: "/icon-manager.png"
          });
        } catch (err) {
          console.warn("Local notification display error:", err);
        }
        toast.success(isAr ? "تم تفعيل وتجربة الإشعارات بنجاح! 🔔" : "Push Notifications Enabled & Tested! 🔔");
      } else {
        toast.error(isAr ? "تم رفض الإشعارات. يرجى تفعيلها من إعدادات المتصفح" : "Notification permission denied in browser settings.");
      }
    }
  };

  const handleLogout = async () => {
    triggerHapticFeedback(12);
    playPopSound();
    try {
      await signOut(auth);
      if (typeof window !== "undefined") {
        localStorage.removeItem("circlek_role");
        localStorage.removeItem("circlek_user_name");
        sessionStorage.clear();
      }
      toast.success(isAr ? "تم تسجيل الخروج بنجاح" : "Logged out successfully!");
      window.location.href = "/";
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Get Initials for Manager Avatar
  const getInitials = (name: string) => {
    if (!name || name === "Manager") return "K";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const isManager = userRole === "manager";

  return (
    <header
      className="sticky top-0 z-40 w-full bg-[#080D1A]/95 backdrop-blur-2xl border-b border-slate-800/80 shadow-2xl px-3 py-2.5 md:hidden no-print transition-all"
      style={{
        paddingTop: "max(10px, env(safe-area-inset-top))",
      }}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Top Header Row: User Info Profile, Status, Controls */}
      <div className="flex items-center justify-between gap-2 mb-2">
        
        {/* User Manager Profile Badge */}
        <div className="flex items-center gap-2 overflow-hidden">
          {/* Avatar with Gradient Frame */}
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 p-[1.5px] shadow-lg shadow-red-600/20">
              <div className="w-full h-full rounded-[14px] bg-[#0F172A] flex items-center justify-center text-white font-black text-xs">
                {getInitials(managerName)}
              </div>
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#080D1A] ${
                isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-amber-500"
              }`}
            />
          </div>

          {/* User Name and Role Pill */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-black tracking-tight text-white truncate max-w-[130px]">
                {managerName}
              </h2>
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 uppercase shrink-0 flex items-center gap-0.5">
                <ShieldCheck className="w-2.5 h-2.5 text-red-400" />
                {isManager ? (isAr ? "مدير" : "Manager") : (isAr ? "مالك" : "Owner")}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
              <Clock className="w-2.5 h-2.5 text-cyan-400" />
              <span className="text-slate-300 font-semibold">{timeString}</span>
            </p>
          </div>
        </div>

        {/* Action Controls (Notifications, Language, Logout) */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* Notification Alert Test Pill */}
          <button
            onClick={handleNotificationToggle}
            className="p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-slate-800 transition-all active:scale-95 shadow-sm"
            title="Notification Options"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
          </button>

          {/* Language Switcher Button */}
          <button
            onClick={handleLanguageToggle}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-slate-800 text-[10px] font-extrabold transition-all active:scale-95 shadow-sm"
          >
            <Languages className="w-3 h-3 text-cyan-400" />
            <span>{language === "en" ? "العربية" : "EN"}</span>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-rose-400 border border-red-900/40 transition-all active:scale-95 shadow-sm"
            title={isAr ? "تسجيل الخروج" : "Logout"}
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
          </button>
        </div>
      </div>

      {/* Bottom Header Row: Branch Chip Carousel */}
      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5 px-0.5">
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 shrink-0 mr-1">
          <Store className="w-3.5 h-3.5 text-rose-500" />
          <span>{isAr ? "الفرع:" : "Branch:"}</span>
        </div>

        {displayBranches.map((b) => {
          const isActive = currentBranch === b.id;
          return (
            <button
              key={b.id}
              onClick={() => handleBranchSelect(b.id as BranchId)}
              className={`px-3 py-1 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all active:scale-95 shrink-0 flex items-center gap-1.5 ${
                isActive
                  ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30 border border-red-500"
                  : "bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white animate-pulse" : "bg-slate-500"}`} />
              {b.labelAr && isAr ? b.labelAr : b.labelEn}
            </button>
          );
        })}
      </div>
    </header>
  );
}
