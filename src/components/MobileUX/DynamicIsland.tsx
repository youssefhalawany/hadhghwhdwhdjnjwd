"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, Info, Loader2, Clock, ChevronRight, X, DollarSign, Calendar, ShieldAlert, Sparkles } from "lucide-react";
import { playSwooshSound, playSuccessChime } from "@/lib/audioCues";
import { vibrateSuccess, vibrateError } from "@/lib/haptics";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";

export type IslandNotification = {
  id: string;
  title: string;
  message?: string;
  type: "success" | "error" | "info" | "loading";
  duration?: number;
};

type NotifyFunction = (
  title: string,
  options?: { message?: string; type?: IslandNotification["type"]; duration?: number }
) => string;

class IslandEventManager {
  private listener: ((n: IslandNotification | null) => void) | null = null;
  private currentNotification: IslandNotification | null = null;
  private timeoutId: NodeJS.Timeout | null = null;

  subscribe(listener: (n: IslandNotification | null) => void) {
    this.listener = listener;
    return () => { this.listener = null; };
  }

  notify(notification: IslandNotification) {
    this.currentNotification = notification;
    if (this.listener) this.listener(this.currentNotification);
    
    if (notification.type === "success") {
      playSuccessChime();
      vibrateSuccess();
    } else if (notification.type === "error") {
      playSwooshSound();
      vibrateError();
    } else {
      playSwooshSound();
    }

    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (notification.duration !== 0) {
      this.timeoutId = setTimeout(() => {
        this.dismiss(notification.id);
      }, notification.duration || 3500);
    }
  }

  dismiss(id: string) {
    if (this.currentNotification?.id === id) {
      this.currentNotification = null;
      if (this.listener) this.listener(null);
    }
  }
}

export const dynamicIslandManager = new IslandEventManager();

export const showIsland: NotifyFunction = (title, options = {}) => {
  const id = Math.random().toString(36).substring(7);
  dynamicIslandManager.notify({
    id,
    title,
    message: options.message,
    type: options.type || "info",
    duration: options.duration
  });
  return id;
};

export const dismissIsland = (id: string) => {
  dynamicIslandManager.dismiss(id);
};

export function DynamicIsland() {
  const router = useRouter();
  const [notification, setNotification] = useState<IslandNotification | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Live operational indicators state
  const [pendingVoidCount, setPendingVoidCount] = useState(0);
  const [expiriesTodayCount, setExpiriesTodayCount] = useState(0);
  const [activeShiftName, setActiveShiftName] = useState<string | null>("Shift Active");
  const [activeIndicatorIndex, setActiveIndicatorIndex] = useState(0);

  useEffect(() => {
    return dynamicIslandManager.subscribe(setNotification);
  }, []);

  // Listen to live operational indicators in real-time
  useEffect(() => {
    // 1. Pending Voids count
    const qVoids = query(collection(db, "void_requests"), where("status", "==", "pending"));
    const unsubVoids = onSnapshot(qVoids, (snap) => setPendingVoidCount(snap.docs.length), () => {});

    // 2. Expiries Today count
    const todayStr = new Date().toISOString().substring(0, 10);
    const qExpiries = query(collection(db, "expiries"), where("expiryDate", "==", todayStr));
    const unsubExpiries = onSnapshot(qExpiries, (snap) => {
      const active = snap.docs.filter(d => d.data().status !== "removed" && d.data().status !== "resolved");
      setExpiriesTodayCount(active.length);
    }, () => {});

    // 3. Active Shift Reports listener
    const qShifts = query(collection(db, "shift_reports"), limit(1));
    const unsubShifts = onSnapshot(qShifts, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setActiveShiftName(data.cashierName ? `${data.cashierName}` : "Shift Active");
      }
    }, () => {});

    return () => {
      unsubVoids();
      unsubExpiries();
      unsubShifts();
    };
  }, []);

  // Rotate between operational indicators every 4 seconds when collapsed
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndicatorIndex((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Build live indicators array
  const liveIndicators = [
    {
      id: "shift",
      icon: (
        <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
      ),
      text: `🟢 Shift Active (${activeShiftName})`,
      color: "text-emerald-400 font-extrabold",
      action: () => router.push("/shift-reports/manager")
    },
    {
      id: "voids",
      icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
      text: pendingVoidCount > 0 ? `🚨 ${pendingVoidCount} Pending Void${pendingVoidCount > 1 ? 's' : ''}` : "🚨 0 Pending Voids",
      color: pendingVoidCount > 0 ? "text-rose-400 font-extrabold" : "text-slate-300",
      action: () => router.push("/voids/manager")
    },
    {
      id: "expiries",
      icon: <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
      text: expiriesTodayCount > 0 ? `⚠️ ${expiriesTodayCount} Expiries Today` : "⚠️ 0 Expiries Today",
      color: expiriesTodayCount > 0 ? "text-amber-400 font-extrabold" : "text-slate-300",
      action: () => router.push("/admin/product-lookup")
    }
  ];

  const currentIndicator = liveIndicators[activeIndicatorIndex];

  return (
    <div className="fixed top-[max(6px,calc(env(safe-area-inset-top,0px)-2px))] left-0 right-0 z-[50] flex justify-center pointer-events-none px-3 print:hidden">
      <AnimatePresence mode="wait">
        {/* Priority 1: Transient Flash Notification */}
        {notification ? (
          <motion.div
            key={notification.id}
            initial={{ y: -35, scale: 0.75, opacity: 0, borderRadius: "40px" }}
            animate={{ y: 0, scale: 1, opacity: 1, borderRadius: "24px" }}
            exit={{ y: -20, scale: 0.8, opacity: 0, borderRadius: "40px" }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="bg-black/95 backdrop-blur-3xl border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.9)] overflow-hidden pointer-events-auto cursor-pointer flex items-center gap-3 px-4 py-2.5"
            style={{ maxWidth: "340px", width: "100%" }}
            onClick={() => dismissIsland(notification.id)}
          >
            {notification.type === "success" && <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0" />}
            {notification.type === "error" && <AlertTriangle className="h-4.5 w-4.5 text-rose-400 shrink-0" />}
            {notification.type === "loading" && <Loader2 className="h-4.5 w-4.5 text-cyan-400 animate-spin shrink-0" />}
            {notification.type === "info" && <Info className="h-4.5 w-4.5 text-cyan-400 shrink-0" />}

            <div className="flex flex-col">
              <span className="text-white font-extrabold text-xs tracking-tight leading-tight">
                {notification.title}
              </span>
              {notification.message && (
                <span className="text-slate-300 text-[11px] font-medium mt-0.5 leading-tight line-clamp-1">
                  {notification.message}
                </span>
              )}
            </div>
          </motion.div>
        ) : (
          /* Priority 2: Native iPhone Hardware Dynamic Island Embedded Pill */
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={() => setIsExpanded(!isExpanded)}
            className="bg-black/95 backdrop-blur-3xl border border-white/15 shadow-[0_12px_35px_rgba(0,0,0,0.95)] pointer-events-auto cursor-pointer overflow-hidden flex flex-col"
            style={{
              borderRadius: isExpanded ? "26px" : "28px",
              width: isExpanded ? "100%" : "auto",
              maxWidth: isExpanded ? "370px" : "300px",
              padding: isExpanded ? "14px" : "5px 14px"
            }}
          >
            {/* COLLAPSED PILL VIEW — Embedded in Top Hardware Notch Zone */}
            {!isExpanded && (
              <div className="flex items-center justify-between gap-2.5 text-xs font-bold text-white whitespace-nowrap">
                <div className="flex items-center gap-2">
                  {currentIndicator.icon}
                  <span className={`${currentIndicator.color} text-[11px] font-extrabold tracking-tight`}>
                    {currentIndicator.text}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pl-2 border-l border-white/15">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] shrink-0" />
                  <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider">LIVE</span>
                </div>
              </div>
            )}

            {/* EXPANDED EXECUTIVE CONTROL DRAWER VIEW */}
            {isExpanded && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className="space-y-3"
              >
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2 items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <span className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-1.5">
                      Circle K Hub <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                    className="p-1 hover:bg-white/15 rounded-full text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(false); router.push("/voids/manager"); }}
                    className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 flex flex-col items-start gap-1 transition-all active:scale-95"
                  >
                    <div className="flex justify-between w-full items-center">
                      <ShieldAlert className="w-4 h-4" />
                      <span className="font-black text-rose-300 text-xs">{pendingVoidCount}</span>
                    </div>
                    <span className="text-[10px] font-black text-white">Pending Voids</span>
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(false); router.push("/shift-reports/manager"); }}
                    className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 flex flex-col items-start gap-1 transition-all active:scale-95"
                  >
                    <div className="flex justify-between w-full items-center">
                      <Clock className="w-4 h-4" />
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <span className="text-[10px] font-black text-white">Shift Audits</span>
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(false); router.push("/admin/product-lookup"); }}
                    className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 flex flex-col items-start gap-1 transition-all active:scale-95"
                  >
                    <div className="flex justify-between w-full items-center">
                      <Calendar className="w-4 h-4" />
                      <span className="font-black text-amber-300 text-xs">{expiriesTodayCount}</span>
                    </div>
                    <span className="text-[10px] font-black text-white">Expiry Radar</span>
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(false); router.push("/financials/inputs/overview"); }}
                    className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 flex flex-col items-start gap-1 transition-all active:scale-95"
                  >
                    <div className="flex justify-between w-full items-center">
                      <DollarSign className="w-4 h-4" />
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <span className="text-[10px] font-black text-white">Safe & Overview</span>
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
