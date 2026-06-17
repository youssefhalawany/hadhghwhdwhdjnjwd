"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon, Shield, Database, LayoutDashboard, FileText, Printer, ClipboardList, CheckCircle, Search, LogOut, User, Users, Menu, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [role, setRole] = useState<string>("owner");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

    // Firebase Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
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
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Shift Input", href: "/shift-reports/cashier", icon: User },
    { name: "Shift Audit", href: "/shift-reports/manager", icon: Shield },
    { name: "Voids & Returns", href: "/voids/manager", icon: Shield },
    { name: "Financial Reports", href: "/financial-reports", icon: FileText },
    { name: "Cashier Accounts", href: "/settings/cashiers", icon: Users }
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
  if (pathname?.startsWith('/shift-reports/cashier') || pathname?.startsWith('/voids/cashier')) {
    return (
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        {children}
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
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
      {/* Dynamic Header */}
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
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Franchise Portal</span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    id={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-red-500/10 text-red-600 dark:text-red-500"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Role Switcher */}
            <div className="hidden sm:flex items-center gap-1.5 bg-muted/60 border border-border px-2.5 py-1.5 rounded-lg">
              <Shield className="h-3.5 w-3.5 text-red-500" />
              <select
                id="select-role-switcher"
                value={role}
                onChange={handleRoleChange}
                className="bg-transparent border-none text-xs font-semibold focus:ring-0 cursor-pointer outline-none text-foreground"
                title="Simulator Role (Tests visual permissions)"
              >
                <option value="owner" className="bg-card">Owner (Full)</option>
                <option value="manager" className="bg-card">Manager</option>
                <option value="accountant" className="bg-card">Accountant</option>
                <option value="cashier" className="bg-card">Cashier</option>
                <option value="warehouse" className="bg-card">Warehouse</option>
                <option value="viewer" className="bg-card">Viewer</option>
              </select>
            </div>

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
              className="md:hidden p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground transition-colors ml-1"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 w-full bg-background border-b border-border shadow-xl z-50 flex flex-col p-4 gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-red-500/10 text-red-600 dark:text-red-500"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
            <div className="border-t border-border mt-2 pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Role Simulator</span>
                <select
                  value={role}
                  onChange={(e) => { handleRoleChange(e); setMobileMenuOpen(false); }}
                  className="bg-muted border border-border rounded-md px-2 py-1 text-xs outline-none"
                >
                  <option value="owner">Owner (Full)</option>
                  <option value="manager">Manager</option>
                  <option value="accountant">Accountant</option>
                  <option value="cashier">Cashier</option>
                  <option value="warehouse">Warehouse</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
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
    </div>
  );
}
