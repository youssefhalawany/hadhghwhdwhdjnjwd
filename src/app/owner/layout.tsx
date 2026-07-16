"use client";

import React, { useState, useEffect } from "react";
import { OwnerBottomNav } from "@/components/OwnerBottomNav";
import { OwnerSidebar } from "@/components/OwnerSidebar";
import { useLanguage } from "@/context/LanguageContext";
import { Globe, Lock, Mail, Key } from "lucide-react";
import { playSuccessSound, playErrorSound, playPopSound, getAudioCtx } from "@/lib/sounds";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const D = {
  bg: "#0B1121",
  surface: "#151E32",
  surfaceHigh: "#1C2841",
  border: "rgba(34, 211, 238, 0.15)",
  cyan: "#22d3ee",
  cyanDim: "rgba(34, 211, 238, 0.1)",
  red: "#ef4444",
  redDim: "rgba(239,68,68,0.15)",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  textDim: "#64748b",
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { language: lang, setLanguage } = useLanguage();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isRTL = lang === "ar";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const docSnap = await getDoc(doc(db, "users", currentUser.uid));
          if (docSnap.exists()) {
            const data = docSnap.data();
            const userRole = data.role;
            if (userRole === "admin_viewer" || userRole === "admin_editor" || userRole === "owner") {
              setAuthenticated(true);
              
              // Request Push Notification Permission and Save Token
              if (typeof window !== "undefined" && "Notification" in window) {
                Notification.requestPermission().then(async (permission) => {
                  if (permission === "granted") {
                    try {
                      const { getToken } = await import("firebase/messaging");
                      const { messaging } = await import("@/lib/firebase");
                      const messagingInstance = messaging ? await messaging : null;
                      if (messagingInstance) {
                        const token = await getToken(messagingInstance, { 
                          vapidKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeZ2Ig14" // Placeholder, Firebase often auto-resolves this from the project if omitted, but VAPID is technically required. We will try to fetch it.
                        }).catch(() => null); // Catch if vapid is strictly needed and fails

                        if (token) {
                          const fcmTokens = data.fcmTokens || [];
                          if (!fcmTokens.includes(token)) {
                            const { updateDoc } = await import("firebase/firestore");
                            await updateDoc(doc(db, "users", currentUser.uid), {
                              fcmTokens: [...fcmTokens, token]
                            });
                          }
                        }
                      }
                    } catch (e) { console.error("FCM Token Error:", e); }
                  }
                });
              }

            } else {
              await signOut(auth);
              setAuthError(lang === "en" ? "Unauthorized access. Admins only." : "غير مصرح. للمديرين فقط.");
            }
          } else {
            await signOut(auth);
            setAuthError(lang === "en" ? "User profile not found." : "الملف الشخصي غير موجود.");
          }
        } catch (err) {
          console.error("Auth check error:", err);
          setAuthError(lang === "en" ? "Error verifying access." : "خطأ في التحقق من الصلاحيات.");
        }
      } else {
        setAuthenticated(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [lang]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      playSuccessSound();
    } catch (err: any) {
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      playErrorSound();
      setAuthError(lang === "en" ? "Invalid email or password" : "البريد الإلكتروني أو كلمة المرور غير صحيحة");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    playPopSound();
    await signOut(auth);
    setAuthenticated(false);
  };

  const rootStyle: React.CSSProperties = {
    minHeight: "100vh",
    width: "100%",
    backgroundColor: D.bg,
    color: D.textPrimary,
    position: "relative",
    display: "flex",
    flexDirection: "column",
    direction: isRTL ? "rtl" : "ltr"
  };

  if (loading) {
    return <div style={{ ...rootStyle, backgroundColor: D.bg }} />;
  }

  if (!authenticated) {
    return (
      <div className="ck-owner" style={rootStyle} onClick={() => getAudioCtx()}>
        <style>{`
          html, body { background-color: #0B1121 !important; overscroll-behavior-y: none; }
          .ck-owner * { color-scheme: dark !important; }
        `}</style>

        {/* Top Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "54px 20px 10px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: D.textSecondary, textTransform: "uppercase", flexShrink: 0 }}>
            CIRCLE K <span style={{ color: D.textDim, fontWeight: 500 }}>Owner Portal</span>
          </div>
          <button onClick={() => { playPopSound(); setLanguage(lang === "en" ? "ar" : "en"); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: D.surface, border: `1px solid ${D.border}`, color: D.textSecondary, fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            <Globe size={14} />
            {lang === "en" ? "EN" : "AR"}
          </button>
        </div>

        {/* Hero */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px 24px", marginTop: 20 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: D.cyan, display: "flex", alignItems: "center", justifyContent: "center", color: D.bg, marginBottom: 20, boxShadow: `0 0 0 4px ${D.cyanDim}, 0 10px 30px rgba(34, 211, 238, 0.3)` }}>
            <Lock size={38} strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: D.textPrimary, margin: 0 }}>
            {lang === "en" ? "Owner Access" : "دخول المالك"}
          </h1>
          <p style={{ fontSize: 14, color: D.textSecondary, marginTop: 8 }}>
            {lang === "en" ? "Enter your enterprise credentials" : "أدخل بيانات الدخول المؤسسية"}
          </p>
        </div>

        {/* Form card */}
        <div style={{ flex: 1, margin: "0 20px 32px", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          <form onSubmit={handleLogin} style={{ width: "100%", maxWidth: 400, background: D.surface, padding: 24, borderRadius: 24, border: `1px solid ${D.border}`, display: "flex", flexDirection: "column", gap: 16 }}>
            {authError && (
              <div style={{ background: D.redDim, color: D.red, padding: 12, borderRadius: 12, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
                {authError}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {lang === "en" ? "Email Address" : "البريد الإلكتروني"}
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={18} color={D.textDim} style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: isRTL ? "auto" : 14, right: isRTL ? 14 : "auto" }} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => { if (navigator.vibrate) navigator.vibrate(20); playPopSound(); }}
                  style={{ width: "100%", background: D.surfaceHigh, border: `1px solid ${D.border}`, borderRadius: 12, padding: `14px ${isRTL ? '14px' : '40px'} 14px ${isRTL ? '40px' : '14px'}`, color: D.textPrimary, fontSize: 15, outline: "none" }}
                  required
                  placeholder="admin@circlek.com"
                />
              </div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: D.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {lang === "en" ? "Password" : "كلمة المرور"}
              </label>
              <div style={{ position: "relative" }}>
                <Key size={18} color={D.textDim} style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: isRTL ? "auto" : 14, right: isRTL ? 14 : "auto" }} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => { if (navigator.vibrate) navigator.vibrate(20); playPopSound(); }}
                  style={{ width: "100%", background: D.surfaceHigh, border: `1px solid ${D.border}`, borderRadius: 12, padding: `14px ${isRTL ? '14px' : '40px'} 14px ${isRTL ? '40px' : '14px'}`, color: D.textPrimary, fontSize: 15, outline: "none" }}
                  required
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoggingIn}
              style={{ width: "100%", background: D.cyan, color: D.bg, border: "none", borderRadius: 12, padding: 16, fontSize: 16, fontWeight: 800, marginTop: 8, cursor: isLoggingIn ? "not-allowed" : "pointer", opacity: isLoggingIn ? 0.7 : 1 }}
            >
              {isLoggingIn 
                ? (lang === "en" ? "Authenticating..." : "جاري التحقق...") 
                : (lang === "en" ? "Sign In" : "تسجيل الدخول")
              }
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="ck-owner" style={rootStyle}>
      <style>{`
        html, body { background-color: #0B1121 !important; overscroll-behavior-y: none; }
        .ck-owner * { color-scheme: dark !important; }
      `}</style>
      
      {/* Sidebar for Desktop */}
      <OwnerSidebar />

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto md:ml-64 md:pb-0" style={{ paddingBottom: "84px" }}>
        {children}
      </div>

      {/* Bottom Nav for Mobile */}
      <div className="md:hidden">
        <OwnerBottomNav />
      </div>
    </div>
  );
}
