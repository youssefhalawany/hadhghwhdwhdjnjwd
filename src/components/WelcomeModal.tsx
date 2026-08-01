"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  X, 
  Building2, 
  Activity, 
  FileCheck2, 
  BellRing,
  Award,
  ChevronRight
} from "lucide-react";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { playPopSound } from "@/lib/sounds";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userRole?: string;
}

export default function WelcomeModal({ isOpen, onClose, userName = "Mr. Youssef Halawany", userRole = "Executive Administrator" }: WelcomeModalProps) {
  useEffect(() => {
    if (isOpen) {
      triggerHapticFeedback([20, 40, 20]);
      try {
        playPopSound();
      } catch (e) {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resolvedName = userName && userName !== "User" ? userName : "Mr. Youssef Halawany";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
        {/* Dark Glassmorphism Backdrop Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-2xl transition-opacity"
        />

        {/* Executive Ambient Radial Background Glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
          <div className="w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/20 via-red-500/20 to-amber-500/20 rounded-full blur-[120px] animate-pulse" />
        </div>

        {/* Main Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-2xl bg-[#090D1B] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-slate-100 my-auto z-10 p-6 md:p-8 space-y-6"
        >
          {/* Top Decorative Banner */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-gradient-to-br from-red-500/30 to-amber-500/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors z-20 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header Section: Dual Executive Logos (Circle K + ANH Portal) */}
          <div className="flex flex-col items-center text-center space-y-4 pt-2">
            <div className="flex items-center justify-center gap-4 md:gap-6">
              {/* Circle K Logo Emblem */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-amber-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500" />
                <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-b from-red-600 to-red-700 border border-red-400/40 flex items-center justify-center shadow-xl">
                  <span className="text-white font-black text-2xl md:text-3xl tracking-tighter drop-shadow-md">K</span>
                </div>
              </div>

              {/* Connecting Emblem Badge */}
              <div className="flex flex-col items-center justify-center">
                <span className="text-xs font-black tracking-widest text-slate-500 uppercase">✦</span>
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 mt-0.5">
                  OFFICIAL
                </span>
              </div>

              {/* ANH Executive Logo Emblem */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500" />
                <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-b from-slate-900 to-[#0F172A] border border-cyan-500/40 flex flex-col items-center justify-center shadow-xl">
                  <span className="text-cyan-400 font-black text-lg md:text-xl tracking-wider">ANH</span>
                  <span className="text-[8px] font-bold text-slate-400 tracking-widest -mt-1">PORTAL</span>
                </div>
              </div>
            </div>

            {/* Welcome Greeting Title */}
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Authorized Operations Suite
              </span>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Welcome, <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-amber-300 bg-clip-text text-transparent">{resolvedName}</span>!
              </h1>
              <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                Welcome to the <strong className="text-white">ANH Executive Portal & Circle K Operations Management System</strong>.
              </p>
            </div>
          </div>

          {/* Operational Badges & User Status Card */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-white">{resolvedName}</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-mono">{userRole}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Active Session
              </span>
            </div>
          </div>

          {/* Core System Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Activity className="w-4 h-4" />
              </div>
              <h5 className="text-xs font-black text-white">Live Telemetry</h5>
              <p className="text-[11px] text-slate-400 leading-snug">
                Real-time shift reports, cashier sales totals, and safe audits across branches.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <h5 className="text-xs font-black text-white">Official Inbox</h5>
              <p className="text-[11px] text-slate-400 leading-snug">
                Dispatched executive payrolls, 2-page print packets, and printable receipts.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <BellRing className="w-4 h-4" />
              </div>
              <h5 className="text-xs font-black text-white">Lock Screen Push</h5>
              <p className="text-[11px] text-slate-400 leading-snug">
                Instant high-priority FCM notifications sent to all registered phones.
              </p>
            </div>
          </div>

          {/* CTA Enter Button */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-amber-500 text-slate-950 text-xs md:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/25 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer group"
            >
              Enter ANH Executive Portal
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
