"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, ArrowRight } from "lucide-react";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { playPopSound } from "@/lib/sounds";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userRole?: string;
}

export default function WelcomeModal({
  isOpen,
  onClose,
  userName = "Mr. Youssef Halawany",
  userRole = "Executive Administrator"
}: WelcomeModalProps) {

  useEffect(() => {
    if (isOpen) {
      triggerHapticFeedback([15, 35, 15]);
      try {
        playPopSound();
      } catch (e) {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resolvedName = userName && userName !== "User" ? userName : "Mr. Youssef Halawany";

  return (
    <AnimatePresence>
      {/* Click ANYWHERE on screen to dismiss */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-2xl cursor-pointer select-none overflow-hidden"
      >
        {/* Animated Background Particle Orbs */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute w-[550px] h-[550px] rounded-full bg-gradient-to-r from-red-600/20 via-cyan-500/20 to-amber-500/20 blur-[130px] pointer-events-none"
        />

        {/* Floating Ring Orbs */}
        <motion.div
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full border border-red-500/20 blur-sm pointer-events-none"
        />
        <motion.div
          animate={{ y: [10, -10, 10] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 right-1/4 w-40 h-40 rounded-full border border-cyan-500/20 blur-sm pointer-events-none"
        />

        {/* Executive Glass Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 30 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="relative w-full max-w-md bg-gradient-to-b from-[#0D1427]/95 to-[#060913]/98 border border-slate-700/60 rounded-3xl p-8 md:p-10 shadow-[0_0_80px_rgba(6,182,212,0.15)] text-center text-white space-y-6 overflow-hidden pointer-events-auto"
        >
          {/* Subtle Top Glow Accent Bar */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full shadow-[0_0_12px_#22d3ee]" />

          {/* DUAL LOGO DISPLAY (Circle K + ANH) */}
          <div className="flex items-center justify-center gap-5 pt-2">
            {/* Circle K Badge */}
            <motion.div
              whileHover={{ scale: 1.08 }}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="relative group"
            >
              <div className="absolute -inset-2 bg-red-600/40 rounded-2xl blur-lg group-hover:bg-red-600/60 transition" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 via-red-700 to-red-900 border border-red-400/50 flex items-center justify-center shadow-2xl">
                <span className="text-white font-black text-3xl tracking-tighter drop-shadow-md">K</span>
              </div>
            </motion.div>

            {/* Glowing Connector */}
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex flex-col items-center justify-center text-cyan-400 font-mono text-xs font-bold"
            >
              <span className="text-sm">✦</span>
              <span className="text-[9px] tracking-widest text-slate-400 uppercase">ANH</span>
            </motion.div>

            {/* ANH Logo Badge */}
            <motion.div
              whileHover={{ scale: 1.08 }}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
              className="relative group"
            >
              <div className="absolute -inset-2 bg-cyan-500/30 rounded-2xl blur-lg group-hover:bg-cyan-500/50 transition" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 via-[#0B132B] to-[#040817] border border-cyan-400/50 flex flex-col items-center justify-center shadow-2xl">
                <span className="text-cyan-400 font-black text-xl tracking-wider">ANH</span>
                <span className="text-[8px] font-bold text-slate-400 tracking-widest -mt-1">PORTAL</span>
              </div>
            </motion.div>
          </div>

          {/* WELCOME TEXT & NAME */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-2"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> Official Operations Portal
            </div>

            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white leading-tight">
              Welcome, <br />
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-amber-300 bg-clip-text text-transparent drop-shadow">
                {resolvedName}
              </span>
            </h1>

            <p className="text-xs text-slate-400 font-medium">
              Circle K Franchise & ANH Executive Operations Management
            </p>
          </motion.div>

          {/* User Status Tag */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="pt-1 flex items-center justify-center gap-2"
          >
            <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {userRole} • Active Session
            </span>
          </motion.div>

          {/* Dismiss Hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 font-bold flex items-center justify-center gap-1.5 group cursor-pointer"
          >
            <span>Tap anywhere to enter portal</span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
