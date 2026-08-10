"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock, ShieldAlert, KeyRound, AlertCircle, Delete, RotateCcw } from "lucide-react";
import { audioChimes } from "@/lib/audio-chimes";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import toast from "react-hot-toast";

interface RemoteLockOverlayProps {
  isLocked: boolean;
  lockPin?: string;
  lockReason?: string;
  lockedAt?: string;
  onUnlock: () => Promise<void> | void;
}

export function RemoteLockOverlay({
  isLocked,
  lockPin = "1234",
  lockReason = "Terminal secured by Administration",
  lockedAt,
  onUnlock
}: RemoteLockOverlayProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isLocked) {
      setPin("");
      setError(false);
      try {
        audioChimes.playWarningSound();
      } catch (e) {}
      triggerHapticFeedback([150, 80, 150]);
    }
  }, [isLocked]);

  // Physical keyboard listener for PIN entry
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape" || e.key === "Delete") {
        handleClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLocked, pin, lockPin]);

  if (!isLocked) return null;

  const effectivePin = String(lockPin || "1234").trim();

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setError(false);

    try {
      audioChimes.playPaymentSound();
    } catch (e) {}

    if (nextPin.length === 4) {
      verifyPin(nextPin);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPin("");
    setError(false);
  };

  const verifyPin = async (enteredPin: string) => {
    setIsVerifying(true);
    // Master emergency bypass codes: '2026' or '0000' or matching custom lockPin
    if (enteredPin === effectivePin || enteredPin === "2026" || enteredPin === "1234") {
      try {
        audioChimes.playShiftAuditSound();
      } catch (e) {}
      triggerHapticFeedback([100, 50, 100, 50, 200]);
      toast.success("Terminal unlocked successfully! 🔓");
      await onUnlock();
    } else {
      setError(true);
      try {
        audioChimes.playWarningSound();
      } catch (e) {}
      triggerHapticFeedback([300, 100, 300]);
      setTimeout(() => {
        setPin("");
        setError(false);
        setIsVerifying(false);
      }, 700);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl select-none">
        {/* Pulsating Security Ambient Light */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full pointer-events-none animate-pulse opacity-40"
          style={{
            background: "radial-gradient(circle, rgba(220,38,38,0.35) 0%, transparent 70%)",
            filter: "blur(90px)"
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85 }}
          className={`relative w-full max-w-sm rounded-3xl overflow-hidden bg-zinc-950 border ${
            error ? "border-red-500 shadow-2xl shadow-red-500/50" : "border-zinc-800 shadow-2xl"
          } p-6 sm:p-8 flex flex-col items-center text-center text-white`}
          style={{
            boxShadow: "0 25px 70px -10px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
          }}
        >
          {/* Lock Icon Emblem */}
          <div className="relative mb-4">
            <motion.div
              animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.4 }}
              className={`w-18 h-18 rounded-3xl flex items-center justify-center shadow-xl transition-all ${
                error
                  ? "bg-gradient-to-br from-red-600 to-rose-700 shadow-red-600/50"
                  : "bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 shadow-red-500/30"
              }`}
            >
              <Lock className="h-9 w-9 text-white stroke-[2.5]" />
            </motion.div>
            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-400 border-2 border-zinc-950 animate-ping" />
          </div>

          {/* Heading */}
          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 mb-2">
            Kiosk Lockdown Active
          </span>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-100">
            Terminal Locked
          </h1>
          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed font-medium">
            {lockReason || "This device was locked remotely by Administration."}
          </p>

          {/* PIN Indicators */}
          <div className="my-6">
            <motion.div
              animate={error ? { x: [-12, 12, -10, 10, -5, 5, 0] } : {}}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3.5"
            >
              {[0, 1, 2, 3].map((idx) => {
                const filled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${
                      error
                        ? "bg-red-500 border-red-400 scale-110 shadow-lg shadow-red-500/50"
                        : filled
                        ? "bg-amber-400 border-amber-300 scale-125 shadow-md shadow-amber-400/50"
                        : "bg-zinc-900 border-zinc-700"
                    }`}
                  />
                );
              })}
            </motion.div>
            <p className="text-[11px] text-zinc-500 mt-3 font-semibold">
              {error ? (
                <span className="text-red-400 font-bold flex items-center justify-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Incorrect PIN. Try again.
                </span>
              ) : (
                "Enter 4-Digit Manager PIN to Resume"
              )}
            </p>
          </div>

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px]">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                className="h-13 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 hover:bg-zinc-800 hover:border-zinc-700 active:scale-95 text-lg font-black text-zinc-200 hover:text-white transition-all shadow-sm flex items-center justify-center cursor-pointer"
              >
                {num}
              </button>
            ))}

            {/* Clear Button */}
            <button
              type="button"
              onClick={handleClear}
              className="h-13 rounded-2xl bg-zinc-900/50 border border-zinc-800/60 hover:bg-zinc-800/80 text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-all flex items-center justify-center cursor-pointer"
              title="Clear"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Zero */}
            <button
              type="button"
              onClick={() => handleDigit("0")}
              className="h-13 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 hover:bg-zinc-800 hover:border-zinc-700 active:scale-95 text-lg font-black text-zinc-200 hover:text-white transition-all shadow-sm flex items-center justify-center cursor-pointer"
            >
              0
            </button>

            {/* Backspace */}
            <button
              type="button"
              onClick={handleBackspace}
              className="h-13 rounded-2xl bg-zinc-900/50 border border-zinc-800/60 hover:bg-zinc-800/80 text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-all flex items-center justify-center cursor-pointer"
              title="Backspace"
            >
              <Delete className="h-4 w-4" />
            </button>
          </div>

          {/* Footer Subtext */}
          <div className="mt-5 pt-3 border-t border-zinc-900 w-full flex items-center justify-center gap-1.5 text-[10px] text-zinc-600 font-medium">
            <KeyRound className="h-3 w-3" />
            <span>Default PIN: 1234 (or Master 2026)</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
