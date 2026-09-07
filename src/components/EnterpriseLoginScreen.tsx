"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Lock, 
  Mail, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Store, 
  Globe, 
  Building2, 
  ShieldCheck, 
  HelpCircle, 
  X,
  KeyRound
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface EnterpriseLoginScreenProps {
  onLogin: (identifier: string, pass: string, remember: boolean) => Promise<void>;
  authError?: string;
  clearAuthError?: () => void;
  language: "ar" | "en";
  onToggleLanguage: () => void;
  defaultIdentifier?: string;
}

export default function EnterpriseLoginScreen({
  onLogin,
  authError,
  clearAuthError,
  language,
  onToggleLanguage,
  defaultIdentifier = ""
}: EnterpriseLoginScreenProps) {
  const isAr = language === "ar";
  
  const [identifier, setIdentifier] = useState(defaultIdentifier);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [inputFocused, setInputFocused] = useState<"id" | "pass" | null>(null);

  // Auto-fill remembered identity from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("circlek_remembered_identity");
      if (saved && !identifier) {
        setIdentifier(saved);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password || isSubmitting) return;

    if (clearAuthError) clearAuthError();
    setIsSubmitting(true);

    try {
      if (rememberMe && typeof window !== "undefined") {
        localStorage.setItem("circlek_remembered_identity", identifier.trim());
      } else if (typeof window !== "undefined") {
        localStorage.removeItem("circlek_remembered_identity");
      }
      await onLogin(identifier.trim(), password, rememberMe);
    } catch (err) {
      // Upstream error handler sets authError
    } finally {
      setIsSubmitting(false);
    }
  };

  // Human-friendly error translation
  const getDisplayError = () => {
    if (!authError) return null;
    const lower = authError.toLowerCase();
    if (lower.includes("invalid-credential") || lower.includes("wrong-password") || lower.includes("user-not-found") || lower.includes("invalid-email")) {
      return isAr 
        ? "بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم أو البريد وكلمة المرور."
        : "Invalid credentials. Please verify your email/username and password.";
    }
    if (lower.includes("too-many-requests")) {
      return isAr 
        ? "تم تعليق المحاولات مؤقتاً لأسباب أمنية. يرجى الانتظار لدقائق."
        : "Access temporarily suspended due to multiple failed attempts. Please wait.";
    }
    if (lower.includes("network-request-failed")) {
      return isAr
        ? "تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة."
        : "Network connection failure. Please check your internet connection.";
    }
    return authError;
  };

  const displayError = getDisplayError();

  return (
    <div 
      className="min-h-[100dvh] w-full flex flex-col justify-between relative overflow-hidden bg-[#060709] text-foreground select-none"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* 1. CINEMATIC AMBIENT LIGHTING (ORGANIC AURORA GLOWS, NO HARSH GRID) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Dominant Ruby Flare */}
        <div 
          className="absolute top-[-10%] left-[50%] -translate-x-1/2 w-[700px] sm:w-[900px] h-[550px] rounded-full opacity-30 mix-blend-screen blur-[140px] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(225,29,72,0.45) 0%, rgba(249,115,22,0.2) 45%, transparent 75%)",
          }}
        />

        {/* Ambient Warm Solar Accent */}
        <div 
          className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-20 mix-blend-screen blur-[130px] pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(249,115,22,0.4) 0%, transparent 70%)"
          }}
        />

        {/* Deep Cyber Violet Atmosphere */}
        <div 
          className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-20 mix-blend-screen blur-[130px] pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)"
          }}
        />

        {/* Subtle Radial Vignette */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(circle at center, transparent 40%, rgba(6,7,9,0.7) 100%)"
          }}
        />
      </div>

      {/* 2. TOP ELEGANT UTILITY BAR */}
      <header className="relative z-20 w-full px-5 sm:px-10 py-5 flex items-center justify-between">
        {/* Left: Security & Franchise Node Status */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <span className="text-zinc-200 font-bold">Circle K Egypt</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">{isAr ? "نظام مشفر وآمن" : "Secure Node"}</span>
          </div>
        </div>

        {/* Right: Language Switcher & Help */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold text-zinc-300 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
            title={isAr ? "Switch to English" : "التحويل للغة العربية"}
          >
            <Globe className="w-3.5 h-3.5 text-rose-400" />
            <span>{isAr ? "English" : "العربية"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="p-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
            title={isAr ? "المساعدة والدعم الفني" : "Help & Support"}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 3. CENTERED LUXURY AUTHENTICATION VAULT */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[440px] relative">
          
          {/* Subtle Outer Card Glow */}
          <div className="absolute -inset-1.5 rounded-[36px] bg-gradient-to-b from-rose-500/20 via-orange-500/10 to-transparent blur-2xl opacity-70 pointer-events-none" />

          {/* The Master Glassmorphic Card */}
          <div className="relative rounded-[32px] bg-[#0c0d12]/85 border border-white/[0.08] backdrop-blur-3xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9),0_0_50px_-10px_rgba(225,29,72,0.12)] p-7 sm:p-10 overflow-hidden">
            
            {/* Top Accent Rim Highlight */}
            <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-rose-500/70 to-transparent" />

            {/* Brand Logo & Title */}
            <div className="flex flex-col items-center text-center mb-8">
              {/* Rotating Gradient Aura Logo */}
              <div className="relative mb-4">
                <div 
                  className="absolute -inset-2.5 rounded-full opacity-60 blur-md animate-spin pointer-events-none"
                  style={{
                    background: "conic-gradient(from 0deg, #E11D48, #F97316, #FBBF24, #E11D48)",
                    animationDuration: "9s"
                  }}
                />
                <div className="relative h-18 w-18 rounded-full flex items-center justify-center font-black text-white text-4xl shadow-2xl border border-white/20 bg-gradient-to-br from-[#181920] to-[#0a0a0d]">
                  <span className="bg-gradient-to-br from-red-500 via-rose-500 to-orange-400 bg-clip-text text-transparent drop-shadow-sm">
                    K
                  </span>
                </div>
              </div>

              <h1 className="text-2xl font-black text-white tracking-[0.16em] uppercase">
                CIRCLE K
              </h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-rose-400">
                  Franchise Enterprise
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 font-medium">
                {isAr ? "المنظومة المالية والتشغيلية الموحدة" : "Financial Operations & Auditing Portal"}
              </p>
            </div>

            {/* Error Banner */}
            <AnimatePresence mode="wait">
              {displayError && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-start gap-3 text-start"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-red-200 leading-relaxed">
                      {displayError}
                    </p>
                  </div>
                  {clearAuthError && (
                    <button
                      type="button"
                      onClick={clearAuthError}
                      className="text-red-400 hover:text-red-200 p-0.5 rounded transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Field 1: Email or Username (Clean, NO e.g. ezzat or admin) */}
              <div className="space-y-1.5 text-start">
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                  {isAr ? "اسم المستخدم أو البريد الإلكتروني" : "Email or Username"}
                </label>
                
                <div 
                  className={`relative flex items-center rounded-2xl border transition-all duration-200 bg-white/[0.03] ${
                    inputFocused === "id" 
                      ? "border-rose-500/80 ring-2 ring-rose-500/20 bg-white/[0.05] shadow-lg shadow-rose-500/10" 
                      : "border-white/[0.08] hover:border-white/20"
                  }`}
                >
                  <div className="ps-3.5 pe-2 text-zinc-400">
                    {identifier.includes("@") ? <Mail className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    onFocus={() => setInputFocused("id")}
                    onBlur={() => setInputFocused(null)}
                    placeholder={isAr ? "أدخل اسم المستخدم أو البريد" : "Enter email or username"}
                    required
                    autoComplete="username"
                    disabled={isSubmitting}
                    className="w-full bg-transparent py-3.5 pe-3.5 text-sm font-semibold text-white placeholder:text-zinc-500 outline-none"
                  />
                </div>
              </div>

              {/* Field 2: Password */}
              <div className="space-y-1.5 text-start">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                    {isAr ? "كلمة المرور" : "Password"}
                  </label>
                  {capsLockOn && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 animate-pulse">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{isAr ? "Caps Lock مفعل" : "Caps Lock is ON"}</span>
                    </span>
                  )}
                </div>

                <div 
                  className={`relative flex items-center rounded-2xl border transition-all duration-200 bg-white/[0.03] ${
                    inputFocused === "pass" 
                      ? "border-rose-500/80 ring-2 ring-rose-500/20 bg-white/[0.05] shadow-lg shadow-rose-500/10" 
                      : "border-white/[0.08] hover:border-white/20"
                  }`}
                >
                  <div className="ps-3.5 pe-2 text-zinc-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setInputFocused("pass")}
                    onBlur={() => setInputFocused(null)}
                    onKeyDown={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
                    onKeyUp={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    className="w-full bg-transparent py-3.5 text-sm font-semibold text-white placeholder:text-zinc-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="px-3.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title={showPassword ? (isAr ? "إخفاء كلمة المرور" : "Hide password") : (isAr ? "إظهار كلمة المرور" : "Show password")}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Controls: Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-rose-600 bg-zinc-800 border-zinc-700 cursor-pointer"
                  />
                  <span className="font-medium text-[11px]">
                    {isAr ? "تذكر حسابي على هذا الجهاز" : "Remember on this device"}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowHelpModal(true)}
                  className="text-rose-400 hover:text-rose-300 font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  {isAr ? "نسيت كلمة المرور؟" : "Forgot Password?"}
                </button>
              </div>

              {/* Radiant Primary Action Button */}
              <button
                type="submit"
                disabled={isSubmitting || !identifier.trim() || !password}
                className="w-full relative overflow-hidden rounded-2xl py-3.5 px-6 font-black text-sm text-white tracking-wide shadow-xl transition-all duration-200 hover:scale-[1.015] active:scale-[0.985] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2.5 mt-4 cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #E11D48 0%, #EA580C 100%)",
                  boxShadow: "0 8px 30px rgba(225, 29, 72, 0.45)"
                }}
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>{isAr ? "جارٍ التحقق وتأمين الجلسة..." : "Authenticating..."}</span>
                  </>
                ) : (
                  <>
                    <span>{isAr ? "تسجيل الدخول إلى المنظومة" : "Sign In to Enterprise Portal"}</span>
                    <ArrowRight className={`w-4 h-4 ${isAr ? "rotate-180" : ""}`} />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.08]" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-zinc-500">
                <span className="bg-[#0c0d12] px-3">{isAr ? "أو الدخول السريع" : "Or Quick Access"}</span>
              </div>
            </div>

            {/* Secondary Option: Fast Cashier Shift Terminal */}
            <Link
              href="/cashier"
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-emerald-500/30 text-zinc-300 hover:text-white transition-all group text-start shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{isAr ? "بوابة الكاشير والورديات" : "Cashier & Shift Terminal"}</span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {isAr ? "دخول سريع" : "Fast PIN"}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {isAr ? "لتسجيل فواتير الوردية وتسليم الكاش بـ PIN فقط" : "For register counts and cash drops without manager login"}
                  </p>
                </div>
              </div>
              <ArrowRight className={`w-4 h-4 text-zinc-500 group-hover:text-white transition-all ${isAr ? "rotate-180" : ""}`} />
            </Link>

            {/* Security Guarantee Badge */}
            <div className="mt-6 pt-4 border-t border-white/[0.05] flex items-center justify-center gap-2 text-[11px] text-zinc-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
              <span>{isAr ? "منظومة مشفرة وآمنة • توكيل سيركل كيه مصر" : "256-Bit TLS Encrypted • ANH Franchise Operations"}</span>
            </div>
          </div>
        </div>
      </main>

      {/* 4. FOOTER */}
      <footer className="relative z-20 w-full px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-400">
        <p>
          © {new Date().getFullYear()} Circle K Franchise Egypt • ANH Trading & Distribution.
        </p>
        <div className="flex items-center gap-3 text-[11px]">
          <span>{isAr ? "العلمين 4 • أولاد القرنفل" : "El Alamein 4 • Ola Koronfol"}</span>
          <span>•</span>
          <span className="font-mono text-zinc-400">v2.8 Enterprise</span>
        </div>
      </footer>

      {/* 5. SUPPORT & RECOVERY MODAL */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#101117] border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-white text-base">
                    {isAr ? "المساعدة والدعم الفني" : "Operations & Technical Support"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-zinc-300 leading-relaxed">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="font-bold text-white mb-1">
                    {isAr ? "نسيان كلمة المرور أو تعطل الحساب؟" : "Forgot password or locked account?"}
                  </p>
                  <p className="text-zinc-400">
                    {isAr 
                      ? "يتم تفعيل الحسابات وتعيين كلمات المرور حصرياً عبر مسؤول النظام بإدارة العمليات المركزية."
                      : "User credentials and account resets are managed directly by central Operations Administration."}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">{isAr ? "البريد الإلكتروني للإدارة:" : "Operations Email:"}</span>
                    <span className="font-mono font-bold text-rose-400">admin@anhreports.com</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">{isAr ? "الخط الساخن الداخلي:" : "Internal Hotline:"}</span>
                    <span className="font-mono font-bold text-emerald-400">Ext: 104 / 108</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {isAr 
                      ? "لكاشيرات الفروع: استخدم زر 'بوابة الكاشير والورديات' بالأسفل للدخول بـ PIN الوردية مباشرة."
                      : "For branch cashiers: Use the 'Cashier & Shift Terminal' button below to log in directly with your shift PIN."}
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  {isAr ? "إغلاق" : "Close"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
