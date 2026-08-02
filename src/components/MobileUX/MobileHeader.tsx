"use client";

import React, { useState, useEffect } from "react";
import { useBranch, BranchId } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { Store, Languages, Clock, Bell, LogOut } from "lucide-react";
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedRole = localStorage.getItem("circlek_role") || "manager";
      setUserRole(storedRole);
    }
    const handleRoleChanged = (e: CustomEvent) => {
      if (e.detail) setUserRole(e.detail);
    };
    window.addEventListener("circlek_role_changed", handleRoleChanged as any);
    return () => window.removeEventListener("circlek_role_changed", handleRoleChanged as any);
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
      
      try {
        fetch("/api/notifications/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "🔔 Test Push Notification - Circle K",
            body: "Test notification dispatched successfully to all devices!",
            url: "/admin/product-lookup",
            branchId: currentBranch
          })
        });
      } catch (err) {
        console.warn("FCM dispatch error:", err);
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
        sessionStorage.clear();
      }
      toast.success(isAr ? "تم تسجيل الخروج بنجاح" : "Logged out successfully!");
      window.location.href = "/";
    } catch (err) {
      console.error("Logout error:", err);
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
      {/* Top Bar: Brand, Status, Time, Language, Logout */}
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

        <div className="flex items-center gap-1.5">
          {/* Online/Offline Status Pill */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#0F172A] border border-[#1E293B] text-[10px] font-bold">
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
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-cyan-400 border border-[#1E293B] text-[10px] font-extrabold transition-all active:scale-95"
          >
            <Languages className="w-3 h-3 text-cyan-400" />
            <span>{language === "en" ? "العربية" : "EN"}</span>
          </button>

          {/* 1-Tap Logout Pill */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 p-1.5 rounded-full bg-red-950/40 hover:bg-red-900/60 text-rose-400 border border-red-800/40 transition-all active:scale-95"
            title={isAr ? "تسجيل الخروج" : "Logout"}
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
          </button>
        </div>
      </div>

      {/* Bottom Bar: Horizontal Branch Chip Carousel */}
      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5 px-0.5">
        <Store className="w-3.5 h-3.5 text-cyan-400 shrink-0 mx-0.5" />
        {displayBranches.map((b) => {
          const isActive = currentBranch === b.id;
          return (
            <button
              key={b.id}
              onClick={() => handleBranchSelect(b.id as BranchId)}
              className={`px-3 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap transition-all active:scale-95 shrink-0 ${isActive
                ? "bg-red-600 text-white shadow-md shadow-red-600/30 border border-red-500"
                : "bg-[#0F172A] text-slate-300 hover:text-white border border-[#1E293B]"
                }`}
            >
              {b.labelAr && isAr ? b.labelAr : b.labelEn}
            </button>
          );
        })}
      </div>
    </header>
  );
}
