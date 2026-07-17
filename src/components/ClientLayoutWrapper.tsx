"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon, Shield, Database, LayoutDashboard, FileText, Printer, ClipboardList, CheckCircle, Search, LogOut, User, Users, Menu, X, Bell, PackageX, Truck, CalendarDays, DollarSign, Activity, Wallet, Tag, Sparkles, Barcode, Briefcase, Clock } from "lucide-react";
import { auth, messaging, dbService, db } from "@/lib/firebase";
import { getToken } from "firebase/messaging";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, orderBy, limit } from "firebase/firestore";
import PwaInstallPrompt from "./PwaInstallPrompt";
import type { User as FirebaseUser } from "firebase/auth";
import { useBranch, BranchId } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { useBrand } from "@/context/BrandContext";
import { ThemeToggle } from "./ThemeToggle";
import { Store, Languages } from "lucide-react";
import GlobalReminders from "./GlobalReminders";
import { IdleScreensaver } from "./IdleScreensaver";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { currentBranch, setBranch, availableBranches, setAvailableBranches } = useBranch();
  const { language, setLanguage, t } = useLanguage();
  const { logoUrl, brandColor } = useBrand();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [role, setRole] = useState<string>("owner");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userDoc, setUserDoc] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pendingShiftCount, setPendingShiftCount] = useState(0);
  const [pendingVoidCount, setPendingVoidCount] = useState(0);
  const [pendingExpiriesCount, setPendingExpiriesCount] = useState(0);
  const [pendingReturnsCount, setPendingReturnsCount] = useState(0);
  const [hasAgedShifts, setHasAgedShifts] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);
  const [systemNotifications, setSystemNotifications] = useState<any[]>([]);
  const pathname = usePathname();

  // Initialize theme, role, and mock status from localStorage
  useEffect(() => {
    // Theme
    const storedTheme = localStorage.getItem("circlek_theme") as "light" | "dark";
    if (storedTheme) {
      setTheme(storedTheme);
      document.documentElement.classList.toggle("dark", storedTheme === "dark");
    } else {
      document.documentElement.classList.add("dark");
    }

    // Role
    const storedRole = localStorage.getItem("circlek_role") || "owner";
    setRole(storedRole);

    // Splash screen timer
    const splashTimer = setTimeout(() => setMinSplashDone(true), 1500);

    // Live Clock timer
    const clockTimer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    setCurrentDateTime(new Date());

    // Firebase Auth Listener
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Fetch user document
        try {
          const docSnap = await getDoc(doc(db, "users", currentUser.uid));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserDoc(data);

            // Map storeIds to local BranchIds
            const allowedIds = data.storeIds || [];
            const mappedBranches: { id: BranchId; name: string }[] = [];

            if (allowedIds.includes("eL-alamein-4")) {
              mappedBranches.push({ id: "alamein4", name: "El Alamein 4" });
            }
            if (allowedIds.includes("ola-el-koronfol")) {
              mappedBranches.push({ id: "ola", name: "Ola El Koronfol" });
            }

            if (mappedBranches.length > 0) {
              setAvailableBranches(mappedBranches);
              // Auto select if only 1 branch
              if (mappedBranches.length === 1) {
                setBranch(mappedBranches[0].id);
              } else {
                // If they have multiple branches, ensure their current selection is valid
                const isValid = mappedBranches.some(b => b.id === currentBranch);
                if (!isValid) setBranch(mappedBranches[0].id);
              }
            }
          }
        } catch (err) {
          console.error("Failed to fetch user doc:", err);
        }
      }

      setAuthLoading(false);

      if (currentUser && typeof window !== "undefined" && "Notification" in window) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === "granted" && messaging) {
            const messagingInstance = await messaging;
            if (messagingInstance) {
              const token = await getToken(messagingInstance, {
                vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY || "BHiDvLTbQ2DTED8p7X1BQ8Vu811fuu3dmpVfclmA5P7n-DuRltU7kkai9E2_2VkbLpS7Ns5ekNQClP5CsTeWf7M"
              });
              if (token) {
                console.log("FCM Token:", token);
                await dbService.setDoc("user_tokens", currentUser.uid, {
                  fcmToken: token,
                  email: currentUser.email,
                  updatedAt: new Date().toISOString()
                });
              }
            }
          }
        } catch (err) {
          console.error("FCM Token generation failed:", err);
        }
      }

      // Show welcome toast if just logged in (using sessionStorage to prevent repeats on refresh)
      if (currentUser && typeof window !== "undefined") {
        const hasSeenWelcome = sessionStorage.getItem("circlek_welcomed");
        if (!hasSeenWelcome) {
          toast.success(`Welcome back, ${currentUser.displayName || currentUser.email?.split('@')[0]}! 👋`, { duration: 4000 });
          sessionStorage.setItem("circlek_welcomed", "true");
        }
      }
    });

    // Fetch Badges
    let unsubscribeShifts: any = null;
    let unsubscribeVoids: any = null;
    let unsubscribeExpiries: any = null;
    let unsubscribeSystemNotifs: any = null;

    if (user && currentBranch) {
      // Assuming managers query specific branch or all
      // We will just do a basic query for 'pending' status for the current branch
      // If "all", we query without branch filter if they are an admin.
      const shiftQ = currentBranch === "all"
        ? query(collection(db, "shift_reports"), where("status", "in", ["pending", "pending_manager"]), limit(50))
        : query(collection(db, "shift_reports"), where("status", "in", ["pending", "pending_manager"]), where("branchId", "==", currentBranch), limit(50));

      unsubscribeShifts = onSnapshot(shiftQ, (snap) => {
        setPendingShiftCount(snap.docs.length);
        let aged = false;
        const now = Date.now();
        snap.docs.forEach(doc => {
          const d = doc.data();
          const submittedAt = d.createdAt || d.submittedAt;
          if (submittedAt) {
            let subTime = 0;
            if (typeof submittedAt === 'object' && submittedAt.seconds) {
              subTime = submittedAt.seconds * 1000;
            } else {
              subTime = new Date(submittedAt).getTime();
            }
            if (now - subTime > 4 * 60 * 60 * 1000) {
              aged = true; // older than 4 hours
            }
          }
        });
        setHasAgedShifts(aged);
      }, (err) => console.log("Shift badge err", err));

      const voidQ = currentBranch === "all"
        ? query(collection(db, "void_requests"), where("status", "==", "pending"), limit(50))
        : query(collection(db, "void_requests"), where("status", "==", "pending"), where("branchId", "==", currentBranch), limit(50));

      unsubscribeVoids = onSnapshot(voidQ, (snap) => {
        setPendingVoidCount(snap.docs.length);
      }, (err) => console.log("Void badge err", err));

      const expiriesQ = query(collection(db, "expiries"), where("status", "==", "pulled"), limit(50));
      unsubscribeExpiries = onSnapshot(expiriesQ, (snap) => {
        let count = 0;
        snap.docs.forEach(doc => {
          const d = doc.data();
          if (currentBranch === "all") {
            count++;
          } else {
            const inferred = (d.storeId || "").toLowerCase().includes("ola") || (d.storeId || "").toLowerCase().includes("koronfol") ? "ola" : "alamein4";
            if ((d.branchId && d.branchId === currentBranch) || (!d.branchId && inferred === currentBranch)) {
              count++;
            }
          }
        });
        setPendingExpiriesCount(count);
      }, (err) => console.log("Expiries badge err", err));

      // We filter on the server side to only fetch pending or unsettled returns
      // This prevents massive document reads (fetching all historical returns)
      const returnsQ = query(
        collection(db, "supplier_returns"),
        where("status", "in", ["pending", "returned"]), // server-side filter
        limit(50)
      );

      const unsubscribeReturns = onSnapshot(returnsQ, (snap) => {
        let count = 0;
        snap.docs.forEach(doc => {
          const d = doc.data();
          const isPending = d.status === "pending" || (d.status === "returned" && d.isSettled === false);
          if (isPending) {
            if (currentBranch === "all") {
              count++;
            } else {
              const inferred = (d.storeId || "").toLowerCase().includes("ola") || (d.storeId || "").toLowerCase().includes("koronfol") ? "ola" : "alamein4";
              if ((d.branchId && d.branchId === currentBranch) || (!d.branchId && inferred === currentBranch)) {
                count++;
              }
            }
          }
        });
        setPendingReturnsCount(count);
      }, (err) => console.log("Returns badge err", err));

      const notifQ = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(50));

      unsubscribeSystemNotifs = onSnapshot(notifQ, (snap) => {
        let notifs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        // Filter locally to avoid requiring Firestore composite indexes
        if (currentBranch !== "all") {
          notifs = notifs.filter((n: any) => {
            const sId = (n.storeId || n.branchId || "").toLowerCase();
            const inferred = sId.includes("ola") || sId.includes("koronfol") ? "ola" : "alamein4";
            return inferred === currentBranch;
          });
        }
        notifs = notifs.filter((n: any) => n.read === false);
        
        setSystemNotifications(notifs);
      }, (err) => console.log("System Notifs err", err));
    }

    // Global Sound Effects
    const playClick = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } catch (e) { }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('.cursor-pointer')) {
        playClick();
      }
    };
    window.addEventListener('click', handleClick);

    return () => {
      unsubscribe();
      window.removeEventListener('click', handleClick);
      clearInterval(clockTimer);
      if (unsubscribeShifts) unsubscribeShifts();
      if (unsubscribeVoids) unsubscribeVoids();
      if (unsubscribeExpiries) unsubscribeExpiries();
      if (unsubscribeSystemNotifs) unsubscribeSystemNotifs();
    };
  }, []);

  useEffect(() => {
    // Dynamically inject the correct PWA manifest based on the portal
    let link = document.querySelector("link[rel~='manifest']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    const isCashierPortal = pathname?.startsWith('/cashier') || pathname?.startsWith('/shift-reports/cashier') || pathname?.startsWith('/voids/cashier') || pathname?.startsWith('/checklists/cashier') || pathname?.startsWith('/owner');
    link.href = isCashierPortal ? '/manifest-cashier.json' : '/manifest-manager.json';
  }, [pathname]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("circlek_theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = e.target.value;
    setRole(nextRole);
    localStorage.setItem("circlek_role", nextRole);
    // Dispatch custom event to notify components of role switch
    window.dispatchEvent(new CustomEvent("circlek_role_changed", { detail: nextRole }));
  };

  const navItems = [
    {
      name: t("nav.financials"), icon: FileText, children: [
        { name: t("nav.financial_inputs"), href: "/financials/inputs", icon: Wallet },
        { name: t("nav.reports"), href: "/financial-reports", icon: FileText },
        { name: "Month Summary", href: "/financial-reports/month-summary", icon: CalendarDays },
        { name: t("nav.voids_returns"), href: "/voids/manager", icon: Shield },
        { name: t("nav.shift_audit"), href: "/shift-reports/manager", icon: Shield },
        { name: t("nav.margin_strategy"), href: "/dashboard/margin-calculator", icon: Activity }
      ]
    },
    { name: t("nav.returns"), href: "/dashboard/supplier-returns", icon: Truck },
    {
      name: t("nav.Products"), icon: PackageX, children: [
        { name: t("nav.expiries"), href: "/products/expiries-audit", icon: ClipboardList },
        { name: t("nav.product_lookup"), href: "/admin/product-lookup", icon: Search },
        { name: t("nav.blind_audit"), href: "/inventory-audit/manager", icon: Shield }
      ]
    },
    {
      name: language === "ar" ? "العمليات" : "Operation", icon: Briefcase, children: [
        { name: t("nav.checklists"), href: "/checklists/manager", icon: ClipboardList },
        { name: language === "ar" ? "سجلات النظافة" : "Cleaning Logs", href: "/admin/cleaning", icon: Sparkles },
        { name: language === "ar" ? "إدارة العروض" : "Manage Offers", href: "/admin/offers", icon: Tag },
        { name: language === "ar" ? "أكواد الفود" : "Food Codes", href: "/admin/food-codes", icon: Barcode }
      ]
    },
    {
      name: t("nav.hr"), icon: Users, children: [
        { name: t("nav.employees"), href: "/hr/employees", icon: Users },
        { name: t("nav.cashier_accounts"), href: "/settings/cashiers", icon: Users },
        { name: t("nav.payroll_system"), href: "/admin/payroll", icon: DollarSign },
        { name: t("nav.adjustments_loans"), href: "/admin/adjustments", icon: FileText },
        { name: t("nav.smart_scheduler"), href: "/admin/schedule", icon: CalendarDays }
      ]
    },
    {
      name: t("nav.admin"), icon: Shield, children: [
        { name: t("nav.user_management"), href: "/admin/users", icon: Shield },
        { name: t("nav.inventory_predict"), href: "/admin/inventory-predict", icon: Database },
        { name: t("nav.send_notifications"), href: "/settings/notifications", icon: Bell },
        { name: t("nav.security_audit_log"), href: "/settings/audit-log", icon: Shield },
        { name: t("nav.data_import"), href: "/admin/import-csv", icon: Database }
      ]
    },


    { name: "", href: "/cashier", icon: User, isIconOnly: true }
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setAuthError(err.message || "Failed to log in");
    }
  };

  const totalNotifications = systemNotifications.length + pendingShiftCount + pendingVoidCount + pendingExpiriesCount + pendingReturnsCount;

  // Completely isolate Cashier pages (No Enterprise Auth, No Sidebar)
  if (pathname?.startsWith('/shift-reports/cashier') || pathname?.startsWith('/voids/cashier') || pathname?.startsWith('/cashier') || pathname?.startsWith('/expiries') || pathname?.startsWith('/checklists/cashier') || pathname?.startsWith('/inventory-audit/cashier') || pathname?.startsWith('/owner')) {
    return (
      <div className="h-[100dvh] w-full overflow-y-auto custom-scrollbar bg-background text-foreground transition-colors duration-300">
        <GlobalReminders />
        {children}
        <PwaInstallPrompt />
      </div>
    );
  }

  if (authLoading || !minSplashDone) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-background relative overflow-hidden">
        {/* Decorative background blur */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-500/20 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="z-10 flex flex-col items-center animate-in fade-in zoom-in duration-1000">
          <div className="relative">
            <div className="absolute inset-0 bg-red-600 rounded-full animate-ping opacity-20"></div>
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-red-600 flex items-center justify-center font-black text-white text-4xl sm:text-5xl border-[3px] border-orange-500 shadow-2xl relative z-10">
              K
            </div>
          </div>
          <h1 className="mt-8 text-3xl sm:text-4xl font-extrabold tracking-widest text-red-600 dark:text-red-500">CIRCLE K</h1>
          <p className="mt-3 text-sm text-muted-foreground uppercase tracking-[0.2em] font-semibold">Franchise Portal</p>

          <div className="mt-12 flex gap-2">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-red-600 animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-red-600 animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-[100dvh] w-full overflow-y-auto flex items-center justify-center bg-background text-foreground py-8">
        <div className="glass-panel p-8 rounded-2xl w-full max-w-md border border-border shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-full bg-red-600 flex items-center justify-center font-black text-white text-3xl border-2 border-orange-500 shadow-md mb-4">
              K
            </div>
            <h1 className="text-2xl font-bold tracking-wider text-red-600 dark:text-red-500">CIRCLE K</h1>
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold text-center mt-2">Franchise Enterprise<br />Authorized Access Only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {authError && (
              <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm text-center border border-red-500/20 font-medium">
                {authError}
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 bg-muted/50 border border-border rounded-lg p-3 text-sm outline-none focus:border-red-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 bg-muted/50 border border-border rounded-lg p-3 text-sm outline-none focus:border-red-500 transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold py-3 rounded-lg mt-4 transition-all hover:scale-[1.02] shadow-lg shadow-red-500/20"
            >
              Sign In to Enterprise System
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex bg-background text-foreground transition-colors duration-300 overflow-hidden print:overflow-visible print:h-auto">
      <GlobalReminders />

      {/* Desktop Sidebar */}
      {!pathname.startsWith('/cashier') && !pathname.startsWith('/owner') && (
        <aside className="hidden lg:flex flex-col w-64 h-full border-r border-border bg-card z-50 flex-shrink-0 overflow-hidden print:hidden">
          <div className="p-4 border-b border-border flex flex-col gap-4 flex-shrink-0">
            <Link href="/" className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Store Logo" className="h-10 w-10 rounded-full object-cover border-2 shadow-md" style={{ borderColor: brandColor || '#f97316' }} />
              ) : (
                <div className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center font-black text-white text-xl border-2 border-orange-500 shadow-md transition-colors" style={brandColor ? { backgroundColor: brandColor, borderColor: brandColor } : {}}>
                  K
                </div>
              )}
              <div className="flex flex-col text-start">
                <span className="font-bold tracking-wider text-base text-red-600 dark:text-red-500">CIRCLE K</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                  {currentBranch === 'alamein4' ? (language === 'ar' ? 'بوابة العلمين 4' : 'El Alamein 4 Portal') : currentBranch === 'ola' ? (language === 'ar' ? 'بوابة علا القرنفل' : 'Ola El Koronfol Portal') : (language === 'ar' ? 'بوابة الفروع' : 'All Branches')}
                </span>
              </div>
            </Link>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-3 flex flex-col gap-2">
            {navItems.map((item) => {
              const isActive = item.href ? pathname === item.href : item.children?.some(child => pathname === child.href);
              const Icon = item.icon;

              if (item.children) {
                return (
                  <div key={item.name} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">
                      <span>{item.name}</span>
                    </div>
                    {item.children.map(child => {
                      const isChildActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${isChildActive ? "bg-red-500/10 text-red-600 dark:text-red-500" : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"}`}
                        >
                          <child.icon className={`h-4 w-4 ${isChildActive ? 'scale-110 drop-shadow-sm' : 'opacity-70 group-hover:opacity-100'}`} />
                          <span>{child.name}</span>
                          {child.name === t("nav.shift_audit") && pendingShiftCount > 0 && (
                            <span className={`ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${hasAgedShifts ? 'animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]' : ''}`}>
                              {pendingShiftCount}
                            </span>
                          )}
                          {child.name === t("nav.voids_returns") && pendingVoidCount > 0 && (
                            <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                              {pendingVoidCount}
                            </span>
                          )}
                          {child.name === t("nav.expiries") && pendingExpiriesCount > 0 && (
                            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                              {pendingExpiriesCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href || item.name}
                  href={item.href!}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive ? "bg-red-500/10 text-red-600 dark:text-red-500" : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"}`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'scale-110 drop-shadow-sm' : 'opacity-70 group-hover:opacity-100'}`} />
                  {!item.isIconOnly && <span>{item.name}</span>}
                  {item.name === t("nav.returns") && pendingReturnsCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm shadow-red-500/30">
                      {pendingReturnsCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="p-4 border-t border-border mt-auto">
            <button
              onClick={() => signOut(auth)}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors text-sm font-bold"
            >
              <LogOut className="h-4 w-4" /> {t("nav.sign_out")}
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 max-h-screen overflow-hidden print:max-h-none print:overflow-visible">
        {/* Top Header */}
        {!pathname.startsWith('/cashier') && !pathname.startsWith('/owner') && (
          <header
            className="flex-shrink-0 glass-header border-b border-border flex items-center justify-between px-4 sm:px-6 z-40 print:hidden"
            style={{
              paddingTop: 'max(1rem, env(safe-area-inset-top))',
              paddingBottom: '1rem',
              minHeight: 'calc(4rem + env(safe-area-inset-top))'
            }}
          >

            {/* Mobile Left: Logo & Hamburger */}
            <div className="flex lg:hidden items-center gap-3">
              <button
                className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
              <span className="font-bold tracking-wider text-sm text-red-600 dark:text-red-500">CIRCLE K</span>
            </div>

            {/* Desktop Left: Breadcrumb or Greeting */}
            <div className="hidden lg:flex items-center gap-6">
              {userDoc && (
                <div className="text-sm font-semibold text-muted-foreground">
                  <span>{language === 'ar' ? 'مرحباً، ' : 'Welcome, '}<span className="text-foreground text-lg">{userDoc.displayName || user?.email?.split('@')[0]}</span></span>
                </div>
              )}
              {currentDateTime && (
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-border">
                  <CalendarDays className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {currentDateTime.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="w-px h-3 bg-border mx-1"></div>
                  <Clock className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-wider">
                    {currentDateTime.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              {/* Branch Switcher */}
              {availableBranches.length > 1 && (
                <div className="flex items-center gap-1.5 bg-muted/60 border border-border px-2.5 py-1.5 rounded-lg">
                  <Store className="h-3.5 w-3.5 text-blue-500" />
                  <select
                    value={currentBranch}
                    onChange={(e) => setBranch(e.target.value as BranchId)}
                    className="bg-transparent border-none text-xs font-semibold focus:ring-0 cursor-pointer outline-none text-foreground"
                  >
                    {availableBranches.map((b) => (
                      <option key={b.id} value={b.id} className="bg-card">{language === "ar" && b.id === "alamein4" ? "العلمين 4" : language === "ar" && b.id === "ola" ? "علا القرنفل" : b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Bell className={`h-4 w-4 ${totalNotifications > 0 ? "animate-pulse text-red-500" : ""}`} />
                  {totalNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                      {totalNotifications}
                    </span>
                  )}
                </button>

                {/* Dropdown omitted for brevity but keeps original logic */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                    <div className="bg-slate-50 dark:bg-slate-950 border-b border-border p-3 font-bold text-sm text-foreground flex justify-between items-center">
                      <span>Notifications</span>
                      <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{totalNotifications}</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {totalNotifications === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">All caught up!</div>
                      ) : (
                        <>
                          {systemNotifications.length > 0 && (
                            <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                              Recent Actions
                            </div>
                          )}
                          {systemNotifications.map(notif => (
                            <Link 
                              key={notif.id}
                              href={notif.link || "/"} 
                              onClick={async () => {
                                setNotificationsOpen(false);
                                try {
                                  await updateDoc(doc(db, "notifications", notif.id), { read: true });
                                } catch(e) { console.error("Error marking read", e); }
                              }} 
                              className="block p-3 border-b border-border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-blue-50/50 dark:bg-blue-900/10"
                            >
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-sm font-semibold text-foreground capitalize flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse"></span>
                                  {notif.type} Update
                                </p>
                                <span className="text-[10px] text-muted-foreground">{new Date(notif.createdAt?.toDate ? notif.createdAt.toDate() : Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                              <p className="text-xs text-muted-foreground font-medium">{notif.message}</p>
                            </Link>
                          ))}

                          {(pendingShiftCount > 0 || pendingVoidCount > 0 || pendingReturnsCount > 0 || pendingExpiriesCount > 0) && (
                            <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                              Pending Approvals
                            </div>
                          )}
                          {pendingShiftCount > 0 && (
                            <Link href="/shift-reports/manager" onClick={() => setNotificationsOpen(false)} className="block p-3 border-b border-border hover:bg-muted/50 transition-colors">
                              <p className="text-sm font-semibold text-foreground">Shift Audits</p>
                              <p className="text-xs text-muted-foreground">{pendingShiftCount} pending shifts require approval.</p>
                            </Link>
                          )}
                          {pendingVoidCount > 0 && (
                            <Link href="/voids/manager" onClick={() => setNotificationsOpen(false)} className="block p-3 border-b border-border hover:bg-muted/50 transition-colors">
                              <p className="text-sm font-semibold text-foreground">Voids & Returns</p>
                              <p className="text-xs text-muted-foreground">{pendingVoidCount} requests require review.</p>
                            </Link>
                          )}
                          {pendingReturnsCount > 0 && (
                            <Link href="/dashboard/supplier-returns" onClick={() => setNotificationsOpen(false)} className="block p-3 border-b border-border hover:bg-muted/50 transition-colors">
                              <p className="text-sm font-semibold text-foreground">Supplier Returns</p>
                              <p className="text-xs text-muted-foreground">{pendingReturnsCount} returns pending settlement.</p>
                            </Link>
                          )}
                          {pendingExpiriesCount > 0 && (
                            <Link href="/products/expiries-audit" onClick={() => setNotificationsOpen(false)} className="block p-3 hover:bg-muted/50 transition-colors">
                              <p className="text-sm font-semibold text-foreground">Expiry Audits</p>
                              <p className="text-xs text-muted-foreground">{pendingExpiriesCount} audits require review.</p>
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Language Toggle */}
              <button
                onClick={() => setLanguage(language === "en" ? "ar" : "en")}
                className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Languages className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase">{language === "en" ? "عربي" : "EN"}</span>
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </header>
        )}

        {/* Mobile Dropdown Menu (Only shown on small screens) */}
        {mobileMenuOpen && !pathname.startsWith('/cashier') && !pathname.startsWith('/owner') && (
          <div className="lg:hidden absolute top-16 left-0 w-full bg-white dark:bg-slate-950 border-b border-border shadow-xl z-50 flex flex-col p-4 gap-2 h-[calc(100vh-4rem)] overflow-y-auto">
            {navItems.map((item) => {
              if (item.children) {
                return (
                  <div key={item.name} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center px-4 py-2 text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-border mt-2">
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        {item.name}
                      </div>
                    </div>
                    {item.children.map(child => {
                      const isActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex justify-between items-center px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive
                            ? "bg-red-500/10 text-red-600 dark:text-red-500"
                            : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-foreground"
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <child.icon className="h-4 w-4" />
                            {child.name}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                );
              }

              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href || item.name}
                  href={item.href!}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${isActive
                    ? "bg-red-500/10 text-red-600 dark:text-red-500"
                    : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-foreground"
                    }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.name || "Cashier Portal"}
                </Link>
              );
            })}
            <div className="border-t border-border mt-2 pt-4">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut(auth);
                }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 font-bold"
              >
                <LogOut className="h-4 w-4" /> {t("nav.sign_out")}
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Main Content */}
        <main className={`flex-grow overflow-y-auto custom-scrollbar flex flex-col ${(pathname.startsWith('/cashier') || pathname.startsWith('/owner')) ? '' : 'p-4 sm:p-6 lg:p-8 bg-slate-50/50 dark:bg-slate-950/20'}`}>
          <div 
            className={`flex-grow w-full max-w-7xl mx-auto ${(pathname.startsWith('/cashier') || pathname.startsWith('/owner')) ? 'h-full p-0 m-0 max-w-full' : ''}`}
          >
            {children}
          </div>

          {/* Footer inside scrollable area */}
          {!pathname.startsWith('/cashier') && !pathname.startsWith('/owner') && (
            <footer className="mt-8 border-t border-border/50 py-4 text-center text-xs text-muted-foreground no-print">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <p>© 2026 Circle K Franchise Group. All rights reserved.</p>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" /> SHA-256 Hash Validation Enabled
                  </span>
                </div>
              </div>
            </footer>
          )}
        </main>
      </div>

      <PwaInstallPrompt />
      <IdleScreensaver />
    </div>
  );
}
