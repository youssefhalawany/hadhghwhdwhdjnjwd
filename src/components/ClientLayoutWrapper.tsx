"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon, Shield, Database, LayoutDashboard, FileText, Printer, ClipboardList, CheckCircle, Search, LogOut, User, Users, Menu, X, Bell, PackageX, CalendarDays } from "lucide-react";
import { auth, messaging, dbService, db } from "@/lib/firebase";
import { getToken } from "firebase/messaging";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import PwaInstallPrompt from "./PwaInstallPrompt";
import type { User as FirebaseUser } from "firebase/auth";
import { useBranch, BranchId } from "@/context/BranchContext";
import { Store } from "lucide-react";
import GlobalReminders from "./GlobalReminders";
import toast from "react-hot-toast";

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { currentBranch, setBranch, availableBranches, setAvailableBranches } = useBranch();
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
  const [pendingShiftCount, setPendingShiftCount] = useState(0);
  const [pendingVoidCount, setPendingVoidCount] = useState(0);
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
                vapidKey: "BHiDvLTbQ2DTED8p7X1BQ8Vu811fuu3dmpVfclmA5P7n-DuRltU7kkai9E2_2VkbLpS7Ns5ekNQClP5CsTeWf7M" 
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

    if (user && currentBranch) {
      // Assuming managers query specific branch or all
      // We will just do a basic query for 'pending' status for the current branch
      // If "all", we query without branch filter if they are an admin.
      const shiftQ = currentBranch === "all" 
        ? query(collection(db, "shift_reports"), where("status", "==", "pending"))
        : query(collection(db, "shift_reports"), where("status", "==", "pending"), where("branchId", "==", currentBranch));
      
      unsubscribeShifts = onSnapshot(shiftQ, (snap) => {
        setPendingShiftCount(snap.docs.length);
      }, (err) => console.log("Shift badge err", err));

      const voidQ = currentBranch === "all"
        ? query(collection(db, "void_requests"), where("status", "==", "pending"))
        : query(collection(db, "void_requests"), where("status", "==", "pending"), where("branchId", "==", currentBranch));
      
      unsubscribeVoids = onSnapshot(voidQ, (snap) => {
        setPendingVoidCount(snap.docs.length);
      }, (err) => console.log("Void badge err", err));
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
      } catch (e) {}
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
      if (unsubscribeShifts) unsubscribeShifts();
      if (unsubscribeVoids) unsubscribeVoids();
    };
  }, []);

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
    { name: "Financials", icon: FileText, children: [
      { name: "Financial Reports", href: "/financial-reports", icon: FileText },
      { name: "Voids & Returns", href: "/voids/manager", icon: Shield },
      { name: "Shift Audit", href: "/shift-reports/manager", icon: Shield },
      { name: "Report Search", href: "/financials/report-search", icon: Search }
    ]},
    { name: "Expired", icon: PackageX, children: [
      { name: "Expiry Audits", href: "/dashboard/expiries-audit", icon: ClipboardList },
      { name: "Product Lookup", href: "/admin/product-lookup", icon: Search }
    ]},
    { name: "Admin", icon: Shield, children: [
      { name: "Smart Scheduler", href: "/admin/schedule", icon: CalendarDays },
      { name: "Cashier Accounts", href: "/settings/cashiers", icon: Users },
      { name: "Send Notifications", href: "/settings/notifications", icon: Bell },
      { name: "Import Products", href: "/admin/import-csv", icon: Database }
    ]},
    { name: "Checklists", href: "/checklists/manager", icon: ClipboardList },
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

  // Completely isolate Cashier pages (No Enterprise Auth, No Sidebar)
  if (pathname?.startsWith('/shift-reports/cashier') || pathname?.startsWith('/voids/cashier') || pathname?.startsWith('/cashier') || pathname?.startsWith('/expiries') || pathname?.startsWith('/checklists/cashier')) {
    return (
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <GlobalReminders />
        {children}
        <PwaInstallPrompt />
      </div>
    );
  }

  if (authLoading || !minSplashDone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
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
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="glass-panel p-8 rounded-2xl w-full max-w-md border border-border shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-full bg-red-600 flex items-center justify-center font-black text-white text-3xl border-2 border-orange-500 shadow-md mb-4">
              K
            </div>
            <h1 className="text-2xl font-bold tracking-wider text-red-600 dark:text-red-500">CIRCLE K</h1>
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold text-center mt-2">Franchise Enterprise<br/>Authorized Access Only</p>
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
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <GlobalReminders />
      {/* Dynamic Header */}
      {!pathname.startsWith('/cashier') && (
        <header className="glass-header z-40 border-b border-border" id="app-main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3">
              {/* Circle K Premium Logo Emblem */}
              <div className="h-9 w-9 rounded-full bg-red-600 flex items-center justify-center font-black text-white text-lg border-2 border-orange-500 shadow-md">
                K
              </div>
              <div className="flex flex-col">
                <span className="font-bold tracking-wider text-sm sm:text-base text-red-600 dark:text-red-500">CIRCLE K</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                  {currentBranch === 'alamein4' ? 'El Alamein 4 Portal' : currentBranch === 'ola' ? 'Ola El Koronfol Portal' : 'All Branches Portal'}
                </span>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-2 ml-4">
              {navItems.map((item) => {
                const isActive = item.href ? pathname === item.href : item.children?.some(child => pathname === child.href);
                const Icon = item.icon;
                
                if (item.children) {
                  return (
                    <div key={item.name} className="relative group">
                      <button className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${isActive ? "text-red-600 dark:text-red-500" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"}`}>
                        <Icon className={`h-4 w-4 ${isActive ? 'scale-110 drop-shadow-sm' : 'opacity-70 group-hover:opacity-100 transition-opacity'}`} />
                        <span>{item.name}</span>
                        {item.name === "Financials" && pendingShiftCount > 0 && (
                           <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 animate-pulse shadow-sm shadow-red-500/30">
                             {pendingShiftCount}
                           </span>
                        )}
                        {item.name === "Financials" && pendingVoidCount > 0 && pendingShiftCount === 0 && (
                           <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 shadow-sm shadow-orange-500/30">
                             {pendingVoidCount}
                           </span>
                        )}
                      </button>
                      <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 flex flex-col py-1">
                        {item.children.map(child => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`flex items-center justify-between px-4 py-2 text-sm font-medium transition-colors ${pathname === child.href ? "text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-950/30" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                          >
                            <div className="flex items-center gap-2">
                              <child.icon className="h-4 w-4" />
                              <span>{child.name}</span>
                            </div>
                            {child.name === "Shift Audit" && pendingShiftCount > 0 && (
                              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                                {pendingShiftCount}
                              </span>
                            )}
                            {child.name === "Voids & Returns" && pendingVoidCount > 0 && (
                              <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                                {pendingVoidCount}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href || item.name}
                    id={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                    href={item.href!}
                    className={`group relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                      isActive
                        ? "text-red-600 dark:text-red-500"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute inset-0 bg-red-50 dark:bg-red-950/30 rounded-xl -z-10 border border-red-100 dark:border-red-900/50 shadow-sm"></span>
                    )}
                    {!isActive && (
                      <span className="absolute inset-0 bg-slate-100 dark:bg-slate-800 rounded-xl opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-200 -z-10"></span>
                    )}
                    <Icon className={`h-4 w-4 ${isActive ? 'scale-110 drop-shadow-sm' : 'opacity-70 group-hover:opacity-100 transition-opacity'}`} />
                    {!item.isIconOnly && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* User Greeting */}
            {userDoc && (
              <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-muted-foreground mr-2">
                <span>Welcome, <span className="text-foreground">{userDoc.displayName || user?.email?.split('@')[0]}</span></span>
              </div>
            )}

            {/* Branch Switcher (Only show if multiple branches available) */}
            {availableBranches.length > 1 && (
              <div className="flex items-center gap-1.5 bg-muted/60 border border-border px-2.5 py-1.5 rounded-lg">
                <Store className="h-3.5 w-3.5 text-blue-500" />
              <select
                value={currentBranch}
                onChange={(e) => setBranch(e.target.value as BranchId)}
                className="bg-transparent border-none text-xs font-semibold focus:ring-0 cursor-pointer outline-none text-foreground"
                title="Select Branch"
              >
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-card">{b.name}</option>
                ))}
              </select>
            </div>
            )}



            {/* Theme Toggle */}
            <button
              id="btn-toggle-theme"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Toggle Dark/Light Mode"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            
            {/* Logout */}
            <button
              onClick={() => signOut(auth)}
              className="p-2 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors hidden sm:flex"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>

            {/* Mobile Hamburger Toggle */}
            <button 
              className="lg:hidden p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground transition-colors ml-1"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-16 left-0 w-full bg-white dark:bg-slate-950 border-b border-border shadow-xl z-50 flex flex-col p-4 gap-2 h-[calc(100vh-4rem)] overflow-y-auto">
            {navItems.map((item) => {
              if (item.children) {
                return (
                  <div key={item.name} className="flex flex-col gap-1">
                    <div className="flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-border mt-2">
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </div>
                    {item.children.map(child => {
                      const isActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            isActive
                              ? "bg-red-500/10 text-red-600 dark:text-red-500"
                              : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-foreground"
                          }`}
                        >
                          <child.icon className="h-4 w-4" />
                          {child.name}
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-red-500/10 text-red-600 dark:text-red-500"
                      : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.name || "Cashier Portal"}
                </Link>
              );
            })}
            <div className="border-t border-border mt-2 pt-4 flex flex-col gap-3">

              <button
                onClick={() => signOut(auth)}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 font-bold"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </div>
        )}
      </header>
      )}

      {/* Main Content Area */}
      <main className={`flex-grow flex flex-col ${pathname.startsWith('/cashier') ? '' : 'pt-6 pb-20 lg:pb-6'}`}>
        <div className={`flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${pathname.startsWith('/cashier') ? 'h-screen p-0 m-0 max-w-full' : ''}`}>
        {children}
        </div>
      </main>

      {/* Footer */}
      {!pathname.startsWith('/cashier') && (
        <footer className="border-t border-border bg-card py-4 text-center text-xs text-muted-foreground mt-auto no-print">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>© 2026 Circle K Franchise Group. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" /> SHA-256 Hash Validation Enabled
              </span>
              <Link href="/verify/check" className="hover:text-foreground transition-colors flex items-center gap-1">
                <Search className="h-3 w-3" /> Verify Document
              </Link>
            </div>
          </div>
        </footer>
      )}
      <PwaInstallPrompt />
    </div>
  );
}
