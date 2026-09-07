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
  Activity, 
  Wallet, 
  Barcode, 
  ShieldCheck, 
  HelpCircle, 
  X, 
  Terminal,
  Cpu
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
      // Error handled upstream
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
        ? "بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم أو البريد الإلكتروني وكلمة المرور."
        : "Invalid credentials. Please verify your email/username and password.";
    }
    if (lower.includes("too-many-requests")) {
      return isAr 
        ? "تم تعليق المحاولات مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار لدقائق."
        : "Access temporarily suspended due to consecutive failed attempts. Please wait a few minutes.";
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
      className="min-h-[100dvh] w-full flex flex-col justify-between relative overflow-x-hidden bg-[#07080B] text-foreground select-none"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* 1. LAYERED AMBIENT LIGHTING SYSTEM */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Top-left Ruby Glow */}
        <div 
          className="absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] rounded-full opacity-35 mix-blend-screen blur-[120px] transition-transform duration-1000 animate-pulse"
          style={{
            background: "radial-gradient(circle, rgba(225,29,72,0.4) 0%, rgba(225,29,72,0.05) 60%, transparent 80%)",
            animationDuration: "8s"
          }}
        />

        {/* Bottom-right Solar Orange Glow */}
        <div 
          className="absolute -bottom-[20%] -right-[10%] w-[50vw] h-[50vw] rounded-full opacity-30 mix-blend-screen blur-[130px] transition-transform duration-1000 animate-pulse"
          style={{
            background: "radial-gradient(circle, rgba(249,115,22,0.35) 0%, rgba(249,115,22,0.05) 65%, transparent 80%)",
            animationDuration: "10s"
          }}
        />

        {/* Center Cyber Violet Deep Ambient Flare */}
        <div 
          className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] rounded-full opacity-15 mix-blend-screen blur-[140px]"
          style={{
            background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)"
          }}
        />

        {/* High-tech Cybernetic Grid Background with Radial Fade */}
        <div 
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at 50% 50%, black 20%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, black 20%, transparent 85%)"
          }}
        />
      </div>

      {/* 2. TOP UTILITY STATUS BAR */}
      <header className="relative z-20 w-full px-5 sm:px-10 py-5 flex items-center justify-between border-b border-white/[0.04] backdrop-blur-md bg-black/10">
        {/* Left: Brand Identity & Active Node Telemetry */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-red-600 via-rose-600 to-orange-500 shadow-md shadow-red-600/30 font-black text-white text-base">
            K
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-[#07080B]"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-widest text-white uppercase">Circle K Egypt</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-zinc-400">ANH Franchise</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium mt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>{isAr ? "الخادم السحابي: نشط ومؤمن" : "Cloud Node: Online & Secured"}</span>
              <span className="text-zinc-600">•</span>
              <span className="font-mono text-zinc-500">TLS 1.3</span>
            </div>
          </div>
        </div>

        {/* Right: Controls (Language switcher, Help button) */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold text-zinc-300 hover:text-white transition-all shadow-sm active:scale-95"
            title={isAr ? "Switch to English" : "التحويل للغة العربية"}
          >
            <Globe className="w-3.5 h-3.5 text-rose-400" />
            <span>{isAr ? "English" : "العربية"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-white transition-all shadow-sm active:scale-95"
            title={isAr ? "المساعدة والدعم الفني" : "Support & Help"}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 3. MAIN STAGE (DUAL-PANEL EXECUTIVE CANVAS) */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-8 py-8 md:py-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center w-full">
          
          {/* ========================================================
              LEFT PANEL: ENTERPRISE SHOWCASE & TELEMETRY (lg:col-span-7)
              ======================================================== */}
          <div className="hidden lg:flex flex-col space-y-7 lg:col-span-7">
            {/* Accreditation Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-red-500/10 via-orange-500/10 to-transparent border border-red-500/20 w-fit backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-rose-400 animate-pulse" />
              <span className="text-xs font-black tracking-wider uppercase bg-gradient-to-r from-rose-400 via-orange-400 to-amber-300 bg-clip-text text-transparent">
                {isAr ? "المنظومة المالية والتشغيلية الموحدة للفروع" : "Unified Enterprise Governance & Verification"}
              </span>
            </div>

            {/* Master Headline */}
            <div className="space-y-3">
              <h1 className="text-3xl xl:text-4xl 2xl:text-5xl font-black text-white tracking-tight leading-[1.15]">
                {isAr ? (
                  <>
                    إدارة ورقابة العمليات المالية <br />
                    <span className="bg-gradient-to-r from-rose-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                      لسلسلة توكيلات سيركل كيه - مصر
                    </span>
                  </>
                ) : (
                  <>
                    Financial Reporting & Auditing Hub <br />
                    <span className="bg-gradient-to-r from-rose-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                      For Circle K Franchise Operations
                    </span>
                  </>
                )}
              </h1>
              <p className="text-zinc-400 text-sm xl:text-base leading-relaxed max-w-xl font-normal">
                {isAr 
                  ? "بوابة إدارية متكاملة للمطابقة اللحظية للورديات، الخزائن النقدية، مرتجعات الموردين، تسويات الفاقد والرواتب، مع أعلى معايير الحوكمة المالية."
                  : "Next-generation financial telemetry and branch governance. Automated cash drops, shift reconciliation, inventory RTV manifests, and strict audit compliance."
                }
              </p>
            </div>

            {/* 3 Telemetry Pillars (Bento Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              {/* Pillar 1: Shift & Safe Reconciliations */}
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/[0.06] backdrop-blur-xl hover:border-rose-500/30 transition-all group">
                <div className="h-8 w-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Wallet className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-white mb-1">
                  {isAr ? "مطابقة الورديات والخزائن" : "Vault & Cash Radar"}
                </h4>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  {isAr ? "تسوية آلية لعهد الكاشيرات وفروق نقاط البيع (POS)." : "Automated register variance matching and vault reconciliation."}
                </p>
              </div>

              {/* Pillar 2: RTV & Loss Prevention */}
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/[0.06] backdrop-blur-xl hover:border-orange-500/30 transition-all group">
                <div className="h-8 w-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Barcode className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-white mb-1">
                  {isAr ? "مرتجعات الموردين والفاقد" : "Vendor RTV Manifests"}
                </h4>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  {isAr ? "إشعارات استرجاع رسمية بـ 14 رقم قومي واعتماد فوري." : "Legal RTV manifests with Egyptian National ID verification."}
                </p>
              </div>

              {/* Pillar 3: Multi-Branch Telemetry */}
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/[0.06] backdrop-blur-xl hover:border-amber-500/30 transition-all group">
                <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Building2 className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-white mb-1">
                  {isAr ? "مزامنة الفروع اللحظية" : "Multi-Branch Sync"}
                </h4>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  {isAr ? "ربط فوري بين فرعي العلمين 4 وأولاد القرنفل." : "Real-time sync between El Alamein 4, Koronfol & HQ."}
                </p>
              </div>
            </div>

            {/* Live Operational Ticker Bar */}
            <div className="flex items-center gap-6 pt-3 text-xs text-zinc-400 border-t border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white">99.98%</span>
                <span>{isAr ? "جاهزية النظام" : "Uptime"}</span>
              </div>
              <div className="h-3 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-white">2</span>
                <span>{isAr ? "فروع مشغلة" : "Branches Active"}</span>
              </div>
              <div className="h-3 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>{isAr ? "تشفير فائق الأمان" : "Military Grade 256-Bit"}</span>
              </div>
            </div>
          </div>

          {/* ========================================================
              RIGHT PANEL: THE AUTHENTICATION VAULT CARD (lg:col-span-5)
              ======================================================== */}
          <div className="lg:col-span-5 w-full flex justify-center">
            <div className="w-full max-w-md relative">
              
              {/* Outer Glow Halo behind the card */}
              <div className="absolute -inset-1 rounded-[32px] bg-gradient-to-r from-red-600/30 via-orange-500/20 to-rose-600/30 blur-xl opacity-60 pointer-events-none" />

              {/* The Glass Vault Card */}
              <div className="relative rounded-[28px] bg-zinc-950/80 border border-white/[0.09] backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] p-7 sm:p-9 overflow-hidden">
                
                {/* Thin Top Accent Glow Rim */}
                <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" />

                {/* Card Header: Brand Emblem & Titles */}
                <div className="flex flex-col items-center text-center mb-7">
                  {/* Rotating Gradient Aura Logo */}
                  <div className="relative mb-4">
                    <div 
                      className="absolute -inset-2 rounded-full opacity-60 blur-md animate-spin"
                      style={{
                        background: "conic-gradient(from 0deg, #E11D48, #F97316, #FBBF24, #E11D48)",
                        animationDuration: "8s"
                      }}
                    />
                    <div className="relative h-16 w-16 rounded-full flex items-center justify-center font-black text-white text-3xl shadow-xl border border-white/15 bg-gradient-to-br from-zinc-900 to-black">
                      <span className="bg-gradient-to-br from-red-500 via-rose-500 to-orange-400 bg-clip-text text-transparent">
                        K
                      </span>
                    </div>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {isAr ? "تسجيل الدخول للنظام" : "Enterprise Sign In"}
                  </h2>
                  <p className="text-xs text-zinc-400 font-medium mt-1">
                    {isAr ? "يرجى إدخال بيانات حساب الإدارة أو الفرع للمتابعة" : "Enter your corporate credentials to access portal"}
                  </p>
                </div>

                {/* Error Banner */}
                <AnimatePresence mode="wait">
                  {displayError && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
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
                          className="text-red-400 hover:text-red-200 p-0.5 rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Field 1: Email or Username */}
                  <div className="space-y-1.5 text-start">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                        {isAr ? "اسم المستخدم أو البريد الإلكتروني" : "Email or Username"}
                      </label>
                      <span className="text-[10px] text-zinc-400">
                        {isAr ? "مثال: ezzat أو admin" : "e.g. ezzat or admin"}
                      </span>
                    </div>
                    <div 
                      className={`relative flex items-center rounded-2xl border transition-all duration-200 bg-zinc-900/60 ${
                        inputFocused === "id" 
                          ? "border-rose-500/60 ring-2 ring-rose-500/15 shadow-lg shadow-rose-500/5" 
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
                        placeholder={isAr ? "أدخل اسم المستخدم أو البريد" : "Enter username or email"}
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
                      <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                        {isAr ? "كلمة المرور" : "Password"}
                      </label>
                      {capsLockOn && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{isAr ? "زر Caps Lock مفعل" : "Caps Lock is ON"}</span>
                        </span>
                      )}
                    </div>
                    <div 
                      className={`relative flex items-center rounded-2xl border transition-all duration-200 bg-zinc-900/60 ${
                        inputFocused === "pass" 
                          ? "border-rose-500/60 ring-2 ring-rose-500/15 shadow-lg shadow-rose-500/5" 
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
                        className="px-3.5 text-zinc-400 hover:text-white transition-colors"
                        title={showPassword ? (isAr ? "إخفاء كلمة المرور" : "Hide password") : (isAr ? "إظهار كلمة المرور" : "Show password")}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Options: Remember Me & Forgot Password */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded-md accent-rose-600 bg-zinc-800 border-zinc-700 cursor-pointer"
                      />
                      <span className="font-medium text-[11px]">
                        {isAr ? "تذكر حسابي على هذا الجهاز" : "Remember on this device"}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowHelpModal(true)}
                      className="text-rose-400 hover:text-rose-300 font-semibold text-[11px] transition-colors"
                    >
                      {isAr ? "نسيت كلمة المرور؟" : "Forgot Password?"}
                    </button>
                  </div>

                  {/* Primary Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || !identifier.trim() || !password}
                    className="w-full relative overflow-hidden rounded-2xl py-3.5 px-6 font-black text-sm text-white tracking-wide shadow-lg shadow-rose-600/25 transition-all duration-200 hover:shadow-rose-600/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2.5 mt-4"
                    style={{
                      background: "linear-gradient(135deg, #E11D48 0%, #F97316 100%)"
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>{isAr ? "جارٍ التحقق وتأمين الجلسة..." : "Authenticating & Securing Session..."}</span>
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
                  <div className="relative flex justify-center text-[10px] uppercase font-bold text-zinc-400">
                    <span className="bg-zinc-950 px-3">{isAr ? "أو الدخول المباشر" : "Or Quick Access"}</span>
                  </div>
                </div>

                {/* Fast Cashier Terminal Button */}
                <Link
                  href="/cashier"
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-emerald-500/30 text-zinc-300 hover:text-white transition-all group text-start shadow-sm"
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
                      <p className="text-[10px] text-zinc-400">
                        {isAr ? "لتسجيل فواتير الوردية وتسليم الكاش بدون حساب إدارة" : "For register counts and cash drops without manager login"}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 text-zinc-400 group-hover:text-white transition-all ${isAr ? "rotate-180" : ""}`} />
                </Link>

                {/* Security Tagline */}
                <div className="mt-6 pt-4 border-t border-white/[0.04] flex items-center justify-center gap-2 text-[11px] text-zinc-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-500/80" />
                  <span>{isAr ? "منظومة مشفرة وآمنة • شركة ايه ان اتش للتجارة" : "Authorized Personnel • ANH Enterprise Systems"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 4. FOOTER */}
      <footer className="relative z-20 w-full px-6 py-4 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-400 backdrop-blur-md bg-black/10">
        <p>
          © {new Date().getFullYear()} Circle K Franchise Egypt • ANH Trading & Distribution. All rights reserved.
        </p>
        <div className="flex items-center gap-4 text-[11px]">
          <span>{isAr ? "العلمين 4 • أولاد القرنفل" : "El Alamein 4 • Ola Koronfol"}</span>
          <span>•</span>
          <span className="font-mono text-zinc-400">Build v2.4 Enterprise</span>
        </div>
      </footer>

      {/* 5. HELP & RECOVERY MODAL */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl relative"
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
                  className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
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
                      ? "يتم تفعيل الحسابات وإعادة تعيين كلمات المرور حصرياً عبر مسؤول النظام بإدارة العمليات المركزية."
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
                  className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors"
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
