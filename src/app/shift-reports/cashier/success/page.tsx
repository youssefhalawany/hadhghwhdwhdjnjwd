"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Lock } from "lucide-react";
import confetti from "canvas-confetti";

export default function ShiftSuccessPrintPage() {
  const router = useRouter();

  useEffect(() => {
    // Confetti explosion
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#ef4444', '#f59e0b', '#10b981']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#ef4444', '#f59e0b', '#10b981']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // Success sound
    try {
      const audio = new Audio('/sounds/success.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {}

    // Haptics
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-50 dark:from-emerald-950/20 dark:to-slate-900 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="w-24 h-24 sm:w-32 sm:h-32 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20 border-4 border-emerald-200 dark:border-emerald-800 animate-bounce">
        <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
        Awesome Job!
      </h1>
      <p className="text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-10 text-lg font-medium">
        Your shift data has been securely saved and sent to your manager. Have a great rest of your day!
      </p>
      <button 
        onClick={() => router.push("/cashier")}
        className="px-8 py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black flex items-center gap-3 hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95"
      >
        <Lock className="h-5 w-5" /> Lock & Return to Hub
      </button>
    </div>
  );
}
