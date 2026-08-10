"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BellRing, ShieldAlert, Check, Clock, User, Sparkles } from "lucide-react";

export interface RemoteMessage {
  id: string;
  title?: string;
  message: string;
  senderName: string;
  sentAt: string;
  severity?: "normal" | "urgent";
}

interface RemoteMessageOverlayProps {
  message: RemoteMessage | null;
  onAcknowledge: () => void;
}

export function RemoteMessageOverlay({ message, onAcknowledge }: RemoteMessageOverlayProps) {
  if (!message) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        {/* Glow Ambient Orbs */}
        <div
          className="absolute w-96 h-96 rounded-full pointer-events-none animate-pulse"
          style={{
            background: "radial-gradient(circle, rgba(239,68,68,0.25) 0%, transparent 70%)",
            filter: "blur(60px)"
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-red-500/40 bg-zinc-950/95 text-white p-6 sm:p-8 flex flex-col gap-5"
          style={{
            boxShadow: "0 25px 60px -15px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3.5 pb-4 border-b border-white/10">
            <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/30 shrink-0">
              <BellRing className="h-6 w-6 text-white animate-bounce" />
              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-400 border-2 border-zinc-950 animate-ping" />
            </div>
            <div className="flex-grow">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30">
                  Priority Broadcast
                </span>
                <span className="text-xs text-zinc-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {message.sentAt ? new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-zinc-100 mt-1 flex items-center gap-1.5">
                {message.title || "Admin Priority Alert"}
              </h2>
            </div>
          </div>

          {/* Sender details */}
          <div className="flex items-center gap-2 text-xs text-zinc-300 bg-white/5 rounded-xl px-3.5 py-2 border border-white/5">
            <User className="h-3.5 w-3.5 text-amber-400" />
            <span>Sent by:</span>
            <strong className="text-white">{message.senderName || "System Administrator"}</strong>
          </div>

          {/* Message Content Body */}
          <div className="bg-zinc-900/80 rounded-2xl p-5 border border-white/5 text-zinc-100 text-base sm:text-lg font-semibold leading-relaxed shadow-inner">
            &ldquo;{message.message}&rdquo;
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={onAcknowledge}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 text-white font-extrabold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Check className="h-5 w-5 stroke-[3]" />
              Acknowledge & Dismiss
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
