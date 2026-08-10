"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon, Shield, Database, LayoutDashboard, FileText, Printer, ClipboardList, CheckCircle, Search, LogOut, User, Users, Menu, X, Bell, PackageX, Truck, CalendarDays, DollarSign, Activity, Wallet, Tag, Sparkles, Barcode, Briefcase, Clock, PackageMinus, Package, Bot, ShoppingCart, Box, Monitor } from "lucide-react";
import { auth, messaging, dbService, db } from "@/lib/firebase";
import { getToken } from "firebase/messaging";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, orderBy, limit } from "firebase/firestore";
import PwaInstallPrompt from "./PwaInstallPrompt";
import type { User as FirebaseUser } from "firebase/auth";
import { useBranch, BranchId, BRANCHES } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { useBrand } from "@/context/BrandContext";
import { ThemeToggle } from "./ThemeToggle";
import { Store, Languages } from "lucide-react";
import GlobalReminders from "./GlobalReminders";
import { IdleScreensaver } from "./IdleScreensaver";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { ManagerBottomNav } from "./MobileUX/ManagerBottomNav";
import { MobileHeader } from "./MobileUX/MobileHeader";
import { updateAppBadge, sendManagerInteractiveNotification, triggerHapticFeedback } from "@/lib/pwaBadges";
import { playPopSound } from "@/lib/sounds";
import { audioChimes } from "@/lib/audio-chimes";

import WelcomeModal from "./WelcomeModal";
import { RemoteMessageOverlay, RemoteMessage } from "./RemoteMessageOverlay";

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { currentBranch, setBranch, availableBranches, setAvailableBranches } = useBranch();
  const currentBranchRef = React.useRef(currentBranch);
  useEffect(() => {
    currentBranchRef.current = currentBranch;
  }, [currentBranch]);
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
  const [pendingOosCount, setPendingOosCount] = useState(0);
  const [hasAgedShifts, setHasAgedShifts] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);
  const [systemNotifications, setSystemNotifications] = useState<any[]>([]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [incomingRemoteMessage, setIncomingRemoteMessage] = useState<RemoteMessage | null>(null);
  const pathname = usePathname();
  const isAr = language === "ar";

  const [pushPermissionNeeded, setPushPermissionNeeded] = useState(false);

  const registerFcmPushToken = async (currentUserObj?: any) => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error(language === "ar" ? "الإشعارات غير مدعومة على هذا الجهاز" : "Push notifications are not supported on this browser/device.");
      return;
    }

    try {
      let perm = Notification.permission;

      if (perm === "denied") {
        toast.error(
          language === "ar"
            ? "الإشعارات محظورة من إعدادات المتصفح. يرجى تفعيلها من إعدادات الموقع."
            : "Notifications are blocked in your browser settings. Please enable notification permissions in site settings.",
          { duration: 6000 }
        );
        setPushPermissionNeeded(false);
        return;
      }

      if (perm !== "granted") {
        perm = await Notification.requestPermission();
      }

      if (perm === "granted") {
        setPushPermissionNeeded(false);
        toast.success(language === "ar" ? "تم تفعيل الإشعارات بنجاح! 🔔" : "Push notifications enabled successfully! 🔔");

        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js").catch((swErr) => {
            console.warn("SW register catch:", swErr);
            return null;
          });
          if (reg) await navigator.serviceWorker.ready;

          if (messaging) {
            const messagingInstance = await messaging;
            if (messagingInstance) {
              const tokenOptions: any = {
                vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY || "BHiDvLTbQ2DTED8p7X1BQ8Vu811fuu3dmpVfclmA5P7n-DuRltU7kkai9E2_2VkbLpS7Ns5ekNQClP5CsTeWf7M"
              };
              if (reg) tokenOptions.serviceWorkerRegistration = reg;

              const token = await getToken(messagingInstance, tokenOptions).catch((tokenErr) => {
                console.warn("FCM getToken catch:", tokenErr);
                return null;
              });

              if (token) {
                const activeRole = localStorage.getItem("circlek_role") || "manager";
                const emailStr = currentUserObj?.email || user?.email || "user@ckk.com";
                const activeBranch = localStorage.getItem("circlek_current_branch") || "alamein4";
                const storeIds = [activeBranch === "ola" ? "ola-el-koronfol" : "eL-alamein-4"];

                const uid = currentUserObj?.uid || user?.uid;
                if (uid) {
                  await dbService.setDoc("user_tokens", uid, {
                    fcmToken: token,
                    tokens: [token],
                    email: emailStr,
                    role: activeRole,
                    branchId: activeBranch,
                    storeIds,
                    updatedAt: new Date().toISOString()
                  });

                  await dbService.updateDoc("users", uid, {
                    fcmToken: token,
                    fcmTokens: [token],
                    branchId: activeBranch
                  }).catch(() => {});
                }
              }
            }
          }
        }
      } else {
        toast.error(language === "ar" ? "لم يتم منح إذن الإشعارات" : "Notification permission was not granted.");
      }
    } catch (err: any) {
      console.error("FCM Token generation error:", err);
      toast.error(language === "ar" ? "حدث خطأ أثناء طلب تفعيل الإشعارات" : "Failed to request notification permission.");
    }
  };

  useEffect(() => {
    const handleOpenWelcome = () => setShowWelcomeModal(true);
    window.addEventListener("open_welcome_modal", handleOpenWelcome);
    return () => window.removeEventListener("open_welcome_modal", handleOpenWelcome);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission !== "granted") {
        setPushPermissionNeeded(true);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("circlek_theme", "dark");
    setTheme("dark");
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
    document.documentElement.style.colorScheme = "dark";

    const storedRole = localStorage.getItem("circlek_role") || "owner";
    setRole(storedRole);

    const splashTimer = setTimeout(() => setMinSplashDone(true), 300);
    const clockTimer = setInterval(() => setCurrentDateTime(new Date()), 30000);
    setCurrentDateTime(new Date());

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        if (!localStorage.getItem("has_seen_welcome_anh_v2")) {
          setShowWelcomeModal(true);
        }
        try {
          let userDocData: any = null;

          const docSnapByUid = await getDoc(doc(db, "users", currentUser.uid));
          if (docSnapByUid.exists()) {
            userDocData = docSnapByUid.data();
          } else if (currentUser.email) {
            const emailKey = currentUser.email.toLowerCase().replace(/[@.]/g, "_");
            const docSnapByEmailKey = await getDoc(doc(db, "users", emailKey));
            if (docSnapByEmailKey.exists()) {
              userDocData = docSnapByEmailKey.data();
            } else {
              const qEmail = query(collection(db, "users"), where("email", "==", currentUser.email.toLowerCase()));
              const emailSnap = await getDocs(qEmail);
              if (!emailSnap.empty) {
                userDocData = emailSnap.docs[0].data();
              }
            }
          }

          if (userDocData) {
            const mName = userDocData.displayName || userDocData.name || userDocData.features?.displayName || currentUser.displayName || currentUser.email?.split("@")[0] || "Manager";
            const userRoleResolved = userDocData.role || userDocData.features?.role || storedRole || "manager";

            const normalizedUserDoc = {
              ...userDocData,
              displayName: mName,
              role: userRoleResolved
            };

            setUserDoc(normalizedUserDoc);

            if (currentUser && mName && (!currentUser.displayName || currentUser.displayName !== mName)) {
              updateProfile(currentUser, { displayName: mName }).catch(console.warn);
            }

            if (currentUser.uid) {
              setDoc(doc(db, "users", currentUser.uid), {
                ...normalizedUserDoc,
                updatedAt: new Date().toISOString()
              }, { merge: true }).catch(console.warn);
            }

            localStorage.setItem("circlek_user_name", mName);
            window.dispatchEvent(new CustomEvent("circlek_user_changed", { detail: mName }));

            setRole(userRoleResolved);
            localStorage.setItem("circlek_role", userRoleResolved);
            window.dispatchEvent(new CustomEvent("circlek_role_changed", { detail: userRoleResolved }));

            if (typeof window !== "undefined" && !sessionStorage.getItem(`signin_logged_${currentUser.uid}`)) {
              sessionStorage.setItem(`signin_logged_${currentUser.uid}`, "true");
              dbService.logAction(
                currentUser.email || "Unknown",
                mName,
                userRoleResolved,
                "User Sign-In",
                "N/A",
                `Signed in to platform (${userRoleResolved})`
              ).catch(() => {});
            }

            // Register device session for admin device tracking
            if (typeof window !== "undefined") {
              try {
                const ua = navigator.userAgent;
                let browser = "Unknown";
                let os = "Unknown";
                let deviceType = "desktop";

                // Parse browser
                if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
                else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
                else if (ua.includes("Firefox")) browser = "Firefox";
                else if (ua.includes("Edg")) browser = "Edge";
                else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";

                // Parse OS
                if (ua.includes("Windows")) os = "Windows";
                else if (ua.includes("Mac OS")) os = "macOS";
                else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
                else if (ua.includes("Android")) os = "Android";
                else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

                // Parse device type
                if (/Mobi|Android.*Mobile|iPhone/.test(ua)) deviceType = "mobile";
                else if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) deviceType = "tablet";

                // Generate unique session ID per tab (stored in sessionStorage)
                let sessionId = sessionStorage.getItem("device_session_id");
                if (!sessionId) {
                  sessionId = `${currentUser.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                  sessionStorage.setItem("device_session_id", sessionId);
                  sessionStorage.setItem("device_login_time", new Date().toISOString());
                }

                setDoc(doc(db, "active_sessions", sessionId), {
                  userId: currentUser.uid,
                  userEmail: currentUser.email || "",
                  userName: mName,
                  role: userRoleResolved,
                  browser,
                  os,
                  deviceType,
                  loginAt: new Date().toISOString(),
                  lastActiveAt: new Date().toISOString(),
                  forceLogout: false
                }, { merge: true }).catch(console.warn);
              } catch (sessionErr) {
                console.warn("Session registration failed:", sessionErr);
              }
            }

            const rawStoreIds: any[] = [];
            if (Array.isArray(userDocData.storeIds)) rawStoreIds.push(...userDocData.storeIds);
            if (Array.isArray(userDocData.features?.storeIds)) rawStoreIds.push(...userDocData.features.storeIds);
            if (userDocData.storeId) rawStoreIds.push(userDocData.storeId);
            if (userDocData.branchId) rawStoreIds.push(userDocData.branchId);
            if (userDocData.features?.storeId) rawStoreIds.push(userDocData.features.storeId);
            if (userDocData.features?.branchId) rawStoreIds.push(userDocData.features.branchId);

            const mappedBranches: { id: BranchId; name: string }[] = [];
            const storeStrings = rawStoreIds.map((s) => String(s).toLowerCase());

            const hasAlamein = storeStrings.some((s) => s.includes("alamein") || s.includes("4"));
            const hasOla = storeStrings.some((s) => s.includes("ola") || s.includes("koronfol"));

            if (hasAlamein) {
              mappedBranches.push({ id: "alamein4", name: "El Alamein 4" });
            }
            if (hasOla) {
              mappedBranches.push({ id: "ola", name: "Ola El Koronfol" });
            }

            if (userRoleResolved === "manager") {
              if (mappedBranches.length > 0) {
                setAvailableBranches(mappedBranches);
                setBranch(mappedBranches[0].id, mappedBranches);
              }
            } else {
              setAvailableBranches(BRANCHES);
              if (mappedBranches.length > 0) {
                setBranch(mappedBranches[0].id, BRANCHES);
              }
            }
          }
        } catch (err) {
          console.error("Failed to fetch user doc:", err);
        }

        registerFcmPushToken(currentUser);

        if (typeof window !== "undefined") {
          const hasSeenWelcome = sessionStorage.getItem("circlek_welcomed");
          if (!hasSeenWelcome) {
            toast.success(`Welcome back, ${currentUser.displayName || currentUser.email?.split('@')[0]}! 👋`, { duration: 4000 });
            sessionStorage.setItem("circlek_welcomed", "true");
          }
        }
      }
      setAuthLoading(false);
    });

    // Real-Time Live Notification Listener for Mobile Manager
    let isFirstLoad = true;
    const notifQuery = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(5));
    const unsubNotifs = onSnapshot(notifQuery, (snapshot) => {
      if (isFirstLoad) {
        isFirstLoad = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const activeRole = localStorage.getItem("circlek_role") || "manager";

          // If manager role, strictly check if notification belongs to their active branch
          if (activeRole === "manager") {
            const notifBranchId = (data.branchId || data.storeId || "").toLowerCase();
            const notifNorm = (notifBranchId.includes("ola") || notifBranchId.includes("koronfol")) ? "ola" : "alamein4";
            if (notifNorm !== currentBranchRef.current) {
              return; // Suppress notification from another branch for manager
            }
          }

          const notifTitle = data.title || "Circle K Alert";
          const notifBody = data.body || data.message || "New activity logged in store.";

          // Play Category-Specific Audio Chime
          try {
            audioChimes.playByType(data.type);
          } catch (e) {}

          triggerHapticFeedback([100, 50, 100]);

          // Toast Alert inside Manager Portal
          toast.success(`${notifTitle}: ${notifBody}`, { duration: 5000 });

          // Update PWA App Badge
          updateAppBadge(1);
        }
      });
    }, (err) => {
      console.debug("Firestore notification listener error:", err);
    });

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
      if (typeof unsubNotifs === "function") unsubNotifs();
      clearTimeout(splashTimer);
      window.removeEventListener('click', handleClick);
      clearInterval(clockTimer);
    };
  }, []);

  // Helper for friendly page name
  const getFriendlyPageTitle = (path: string): string => {
    if (path === "/" || path === "/dashboard") return "Dashboard Overview";
    if (path.includes("/financials/inputs/deposits")) return "Deposits Input";
    if (path.includes("/financials/inputs/sales")) return "Sales Input";
    if (path.includes("/financials/inputs/payments")) return "Payments Input";
    if (path.includes("/financials/inputs/credits")) return "Credits Input";
    if (path.includes("/financials/inputs/cheques")) return "Cheques Input";
    if (path.includes("/financials/inputs/tmt-invoices")) return "TMT Invoices";
    if (path.includes("/financials/inputs/safe-report")) return "Safe Report";
    if (path.includes("/financials/inputs")) return "Financial Inputs";
    if (path.includes("/financial-reports/month-summary")) return "Month Summary Report";
    if (path.includes("/financial-reports/pnl")) return "P&L Statement";
    if (path.includes("/financial-reports/expenses")) return "Expenses Report";
    if (path.includes("/financial-reports/sales-and-credits")) return "Sales & Credits";
    if (path.includes("/financial-reports/vendor-statements")) return "Vendor Statements";
    if (path.includes("/financial-reports/end-shift-cash")) return "End Shift Cash";
    if (path.includes("/financial-reports")) return "Financial Reports";
    if (path.includes("/financials/detailed-sales")) return "Detailed Sales Analysis";
    if (path.includes("/financials/out-of-stock")) return "Out of Stock Log";
    if (path.includes("/shift-reports/manager")) return "Shift Reports Audit";
    if (path.includes("/shift-reports/cashier")) return "Cashier Shift Entry";
    if (path.includes("/voids/manager")) return "Voids & Returns Manager";
    if (path.includes("/voids/cashier")) return "Cashier Voids Request";
    if (path.includes("/admin/devices")) return "Device Sessions & Control";
    if (path.includes("/admin/users")) return "User Management";
    if (path.includes("/admin/schedule")) return "Smart Scheduler";
    if (path.includes("/admin/payroll")) return "Payroll System";
    if (path.includes("/admin/adjustments")) return "Adjustments & Loans";
    if (path.includes("/admin/cleaning")) return "Cleaning Logs";
    if (path.includes("/admin/lost-and-found")) return "Lost & Found";
    if (path.includes("/admin/offers")) return "Offers Management";
    if (path.includes("/admin/food-codes")) return "Food Codes";
    if (path.includes("/admin/inventory-predict")) return "Inventory Predict";
    if (path.includes("/admin/send-document")) return "Dispatch Document";
    if (path.includes("/admin/import-csv")) return "Data Import";
    if (path.includes("/products/expiries-audit")) return "Expiries Audit";
    if (path.includes("/products/supplier-orders")) return "Supplier Orders";
    if (path.includes("/products/product-lookup") || path.includes("/admin/product-lookup")) return "Product Lookup";
    if (path.includes("/checklists/manager")) return "Manager Checklists";
    if (path.includes("/checklists/cashier")) return "Cashier Checklists";
    if (path.includes("/hr/employees")) return "HR Employees";
    if (path.includes("/ai-assistant")) return "Ibrahim AI Assistant";
    if (path.includes("/settings/audit-log")) return "Security Audit Log";
    if (path.includes("/settings/notifications")) return "Notification Settings";
    if (path.includes("/settings/cashiers")) return "Cashier Accounts";
    if (path.includes("/cashier")) return "Cashier Terminal";
    return path;
  };

  // Real-time live page & PWA status sync
  useEffect(() => {
    if (!user) return;
    const sessionId = typeof window !== "undefined" ? sessionStorage.getItem("device_session_id") : null;
    if (!sessionId) return;

    const isStandalone = typeof window !== "undefined" && (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );

    setDoc(doc(db, "active_sessions", sessionId), {
      currentPath: pathname,
      pageLabel: getFriendlyPageTitle(pathname),
      isPwa: isStandalone,
      screenSize: typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : "Unknown",
      lastActiveAt: new Date().toISOString()
    }, { merge: true }).catch(() => {});
  }, [pathname, user]);

  // Device session heartbeat, remote message & force-logout listener
  useEffect(() => {
    if (!user) return;

    const sessionId = typeof window !== "undefined" ? sessionStorage.getItem("device_session_id") : null;
    const loginTime = typeof window !== "undefined" ? (sessionStorage.getItem("device_login_time") || new Date().toISOString()) : new Date().toISOString();

    let hasLoadedSessionDoc = false;
    let isTerminating = false;
    let lastSeenMsgId = "";
    let lastSeenCommandId = "";

    const triggerClientLogout = async (reason?: string) => {
      if (isTerminating) return;
      isTerminating = true;
      console.log("Remote force logout triggered:", reason);

      try {
        toast.error(language === "ar" ? "تم تسجيل خروجك عن بُعد بواسطة المسؤول" : "You have been logged out remotely by an administrator.", { duration: 8000 });
      } catch (e) {}

      if (sessionId) {
        deleteDoc(doc(db, "active_sessions", sessionId)).catch(() => {});
        sessionStorage.removeItem("device_session_id");
      }
      sessionStorage.removeItem("device_login_time");
      sessionStorage.removeItem("circlek_welcomed");
      localStorage.removeItem("circlek_user_name");

      try {
        await signOut(auth);
      } catch (e) {}

      setTimeout(() => {
        window.location.href = "/";
      }, 800);
    };

    // 1. Listen to active_sessions/{sessionId}
    let unsubSession: (() => void) | null = null;
    if (sessionId) {
      unsubSession = onSnapshot(doc(db, "active_sessions", sessionId), (snap) => {
        if (snap.exists()) {
          hasLoadedSessionDoc = true;
          const data = snap.data();

          // Check Force Logout
          if (data.forceLogout === true) {
            triggerClientLogout("forceLogout flag is true");
            return;
          }

          // Check Remote Instant Broadcast Message
          if (data.remoteMessage && data.remoteMessage.id && data.remoteMessage.id !== lastSeenMsgId) {
            lastSeenMsgId = data.remoteMessage.id;
            setIncomingRemoteMessage(data.remoteMessage);
            try {
              audioChimes.playPingSound();
            } catch (e) {}
            triggerHapticFeedback([200, 100, 200, 100, 300]);
          } else if (!data.remoteMessage) {
            setIncomingRemoteMessage(null);
          }

          // Check Remote Command (e.g. reload app)
          if (data.remoteCommand && data.remoteCommand.action === "reload" && data.remoteCommand.commandId !== lastSeenCommandId) {
            lastSeenCommandId = data.remoteCommand.commandId;
            toast.loading(language === "ar" ? "جاري تحديث التطبيق عن بُعد..." : "Reloading application (remote command)...", { duration: 2000 });
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        } else if (hasLoadedSessionDoc) {
          // Document was removed/deleted by admin
          triggerClientLogout("session document deleted");
        }
      }, (err) => {
        console.debug("Force-logout listener error:", err);
      });
    }

    // 2. Listen to users/{userId} for account deactivation or global forceLogoutAt
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.isActive === false) {
          triggerClientLogout("Account deactivated");
        } else if (data.forceLogoutAt) {
          const forceTime = new Date(data.forceLogoutAt).getTime();
          const currentLoginTime = new Date(loginTime).getTime();
          // If forceLogoutAt occurred after or right around this session's login
          if (forceTime >= currentLoginTime - 10000) {
            triggerClientLogout("Global force logout for user");
          }
        }
      }
    }, (err) => {
      console.debug("User doc listener error:", err);
    });

    // Heartbeat: update lastActiveAt every 2 minutes
    const heartbeat = setInterval(() => {
      if (sessionId) {
        setDoc(doc(db, "active_sessions", sessionId), {
          lastActiveAt: new Date().toISOString()
        }, { merge: true }).catch(console.warn);
      }
    }, 2 * 60 * 1000);

    // Also update lastActiveAt on user interactions (throttled)
    let lastActivityUpdate = Date.now();
    const handleActivity = () => {
      if (!sessionId) return;
      const now = Date.now();
      if (now - lastActivityUpdate > 60000) { // Max once per minute
        lastActivityUpdate = now;
        setDoc(doc(db, "active_sessions", sessionId), {
          lastActiveAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }
    };
    window.addEventListener("click", handleActivity);
    window.addEventListener("keydown", handleActivity);

    return () => {
      if (unsubSession) unsubSession();
      unsubUser();
      clearInterval(heartbeat);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, [user]);

  // Set up Firebase real-time listeners for notifications
  useEffect(() => {
    let unsubscribeShifts: any = null;
    let unsubscribeVoids: any = null;
    let unsubscribeExpiries: any = null;
    let unsubscribeOos: any = null;
    let unsubscribeSystemNotifs: any = null;

    if (user && currentBranch) {
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

      const returnsQ = query(
        collection(db, "supplier_returns"),
        where("status", "in", ["pending", "returned"]), 
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

      const oosQ = query(collection(db, "out_of_stock_logs"), where("resolved", "==", false), limit(50));
      unsubscribeOos = onSnapshot(oosQ, (snap) => {
        let count = 0;
        snap.docs.forEach(doc => {
          const d = doc.data();
          if (currentBranch === "all") {
            count++;
          } else {
            const inferred = (d.branchId || "alamein4").toLowerCase();
            if (inferred === currentBranch) count++;
          }
        });
        setPendingOosCount(count);
      }, (err) => console.log("OOS badge err", err));

      const notifQ = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(50));

      unsubscribeSystemNotifs = onSnapshot(notifQ, (snap) => {
        let notifs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
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

    return () => {
      if (unsubscribeShifts) unsubscribeShifts();
      if (unsubscribeVoids) unsubscribeVoids();
      if (unsubscribeExpiries) unsubscribeExpiries();
      if (unsubscribeOos) unsubscribeOos();
      if (unsubscribeSystemNotifs) unsubscribeSystemNotifs();
    };
  }, [user, currentBranch]);

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

  // Synchronize OS PWA App Icon Badge count
  useEffect(() => {
    const totalPending = pendingShiftCount + pendingVoidCount + pendingExpiriesCount;
    updateAppBadge(totalPending);
  }, [pendingShiftCount, pendingVoidCount, pendingExpiriesCount]);

  useEffect(() => {
    setTheme("dark");
    localStorage.setItem("circlek_theme", "dark");
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
    document.documentElement.style.colorScheme = "dark";
  }, []);

  const toggleTheme = () => {
    setTheme("dark");
    localStorage.setItem("circlek_theme", "dark");
    document.documentElement.classList.add("dark");
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
      name: language === "ar" ? "إبراهيم (مساعد)" : "Ibrahim (AI)", href: "/ai-assistant", icon: Bot
    },
    {
      name: t("nav.financials"), icon: FileText, children: [
        { name: t("nav.financial_inputs"), href: "/financials/inputs", icon: Wallet },
        { name: t("nav.reports"), href: "/financial-reports", icon: FileText },
        { name: language === "ar" ? "تفاصيل المبيعات" : "Detailed Sales", href: "/financials/detailed-sales", icon: Activity },
        { name: language === "ar" ? "ملخص الشهر" : "Month Summary", href: "/financial-reports/month-summary", icon: CalendarDays },
        { name: language === "ar" ? "سجل النواقص" : "Out of Stock", href: "/financials/out-of-stock", icon: PackageMinus },
        { name: t("nav.voids_returns"), href: "/voids/manager", icon: Shield },
        { name: t("nav.shift_audit"), href: "/shift-reports/manager", icon: Shield },
        { name: t("nav.margin_strategy"), href: "/dashboard/margin-calculator", icon: Activity }
      ]
    },
    { name: t("nav.returns"), href: "/dashboard/supplier-returns", icon: Truck },
    {
      name: language === "ar" ? "المنتجات" : "Products", icon: PackageX, children: [
        { name: t("nav.expiries"), href: "/products/expiries-audit", icon: ClipboardList },
        { name: t("nav.product_lookup"), href: "/admin/product-lookup", icon: Search },
        { name: t("nav.blind_audit"), href: "/inventory-audit/manager", icon: Shield },
        { name: language === "ar" ? "طلب من المورد" : "Order with Supplier", href: "/products/supplier-orders", icon: ShoppingCart }
      ]
    },
    {
      name: language === "ar" ? "العمليات" : "Operation", icon: Briefcase, children: [
        { name: language === "ar" ? "المستندات والإيصالات الرسمية" : "Official Documents", href: "/manager/documents", icon: FileText },
        { name: t("nav.checklists"), href: "/checklists/manager", icon: ClipboardList },
        { name: language === "ar" ? "سجلات النظافة" : "Cleaning Logs", href: "/admin/cleaning", icon: Sparkles },
        { name: language === "ar" ? "المفقودات" : "Lost & Found", href: "/admin/lost-and-found", icon: Package },
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
        { name: language === "ar" ? "إرسال مستند رسمي للمدير" : "Dispatch Document to Manager", href: "/admin/send-document", icon: FileText },
        { name: t("nav.user_management"), href: "/admin/users", icon: Shield },
        { name: t("nav.inventory_predict"), href: "/admin/inventory-predict", icon: Database },
        { name: t("nav.send_notifications"), href: "/settings/notifications", icon: Bell },
        { name: t("nav.security_audit_log"), href: "/settings/audit-log", icon: Shield },
        { name: language === "ar" ? "الأجهزة المتصلة" : "Device Sessions", href: "/admin/devices", icon: Monitor },
        { name: t("nav.data_import"), href: "/admin/import-csv", icon: Database }
      ]
    },


    { name: "", href: "/cashier", icon: User, isIconOnly: true }
  ].filter(item => {
    const isManager = userDoc?.role === "manager" || role === "manager";
    if (isManager && (item.name === t("nav.hr") || item.name === t("nav.admin"))) {
      return false;
    }
    return true;
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setAuthError(err.message || "Failed to log in");
    }
  };

  const totalNotifications = systemNotifications.length + pendingShiftCount + pendingVoidCount + pendingExpiriesCount + pendingReturnsCount + pendingOosCount;

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
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center relative overflow-hidden" style={{ background: '#09090B' }}>
        {/* Ambient glow orbs */}
        <div className="absolute top-[20%] left-[15%] w-72 h-72 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(225,29,72,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-[25%] right-[10%] w-60 h-60 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.10) 0%, transparent 70%)', filter: 'blur(60px)' }} />

        <div className="z-10 flex flex-col items-center">
          {/* Animated gradient ring logo */}
          <div className="relative">
            <div className="absolute -inset-2 rounded-full" style={{
              background: 'conic-gradient(from 0deg, #E11D48, #F97316, #FBBF24, #E11D48)',
              animation: 'spin 3s linear infinite',
              filter: 'blur(8px)',
              opacity: 0.5,
            }} />
            <div className="absolute -inset-2 rounded-full" style={{
              background: 'conic-gradient(from 0deg, #E11D48, #F97316, #FBBF24, #E11D48)',
              animation: 'spin 3s linear infinite',
            }} />
            <div className="relative h-24 w-24 rounded-full flex items-center justify-center font-black text-white text-5xl shadow-2xl" style={{
              background: '#09090B',
              border: '3px solid rgba(255,255,255,0.06)',
            }}>
              K
            </div>
          </div>

          {/* Brand text with stagger */}
          <div className="mt-10 flex items-center gap-[3px]">
            {'CIRCLE K'.split('').map((char, i) => (
              <span key={i} className="text-3xl sm:text-4xl font-extrabold tracking-widest" style={{
                color: '#FAFAFA',
                opacity: 0,
                animation: `fadeInUp 0.4s ease forwards`,
                animationDelay: `${0.8 + i * 0.06}s`,
              }}>
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm uppercase tracking-[0.25em] font-semibold" style={{ color: '#71717A', opacity: 0, animation: 'fadeInUp 0.5s ease forwards', animationDelay: '1.4s' }}>
            ANH Portal
          </p>
          <p className="mt-3 text-xs font-bold tracking-wider" style={{ color: '#FB7185', opacity: 0, animation: 'fadeInUp 0.5s ease forwards', animationDelay: '1.6s' }}>
            Please wait {(userDoc?.displayName || user?.displayName || user?.email?.split('@')[0]) ? `${userDoc?.displayName || user?.displayName || user?.email?.split('@')[0]}` : ''}...
          </p>

          {/* Progress ring spinner */}
          <div className="mt-14">
            <svg width="28" height="28" viewBox="0 0 28 28" className="animate-spin" style={{ animationDuration: '1.2s' }}>
              <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
              <circle cx="14" cy="14" r="12" fill="none" stroke="url(#splashGrad)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="60 100" />
              <defs>
                <linearGradient id="splashGrad" x1="0" y1="0" x2="28" y2="28">
                  <stop offset="0%" stopColor="#E11D48" />
                  <stop offset="100%" stopColor="#F97316" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Keyframe styles */}
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-[100dvh] w-full overflow-y-auto flex items-center justify-center py-8 relative" style={{ background: '#09090B' }}>
        {/* Gradient mesh background */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 20% 0%, rgba(225,29,72,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(249,115,22,0.10) 0%, transparent 50%)',
        }} />

        {/* Login card */}
        <div className="relative z-10 p-8 sm:p-10 rounded-3xl w-full max-w-md mx-4" style={{
          background: 'rgba(24,24,27,0.7)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <div className="relative">
              <div className="absolute -inset-1.5 rounded-full" style={{
                background: 'conic-gradient(from 0deg, #E11D48, #F97316, #FBBF24, #E11D48)',
                filter: 'blur(6px)',
                opacity: 0.4,
              }} />
              <div className="relative h-16 w-16 rounded-full flex items-center justify-center font-black text-white text-3xl" style={{
                background: '#18181B',
                border: '2px solid rgba(255,255,255,0.08)',
              }}>
                K
              </div>
            </div>
            <h1 className="mt-5 text-2xl font-extrabold tracking-[0.15em]" style={{ color: '#FAFAFA' }}>CIRCLE K</h1>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-center mt-2" style={{ color: '#71717A' }}>
              Franchise Enterprise<br />Authorized Access Only
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {authError && (
              <div className="p-3.5 rounded-xl text-sm text-center font-semibold" style={{
                background: 'rgba(225,29,72,0.08)',
                color: '#FB7185',
                border: '1px solid rgba(225,29,72,0.15)',
              }}>
                {authError}
              </div>
            )}

            {/* Email Field */}
            <div className="relative">
              <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: '#71717A' }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@circlek.com"
                className="w-full rounded-xl p-3.5 text-sm outline-none transition-all duration-200"
                style={{
                  background: 'rgba(39,39,42,0.5)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#FAFAFA',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(225,29,72,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(225,29,72,0.08)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
                required
              />
            </div>

            {/* Password Field */}
            <div className="relative">
              <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: '#71717A' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl p-3.5 text-sm outline-none transition-all duration-200"
                style={{
                  background: 'rgba(39,39,42,0.5)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#FAFAFA',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(225,29,72,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(225,29,72,0.08)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
                required
              />
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              className="w-full text-white font-extrabold py-3.5 rounded-xl mt-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-sm tracking-wide"
              style={{
                background: 'linear-gradient(135deg, #E11D48, #F97316)',
                boxShadow: '0 8px 25px rgba(225,29,72,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
            >
              Sign In to Enterprise System
            </button>
          </form>
        </div>
      </div>
    );
  }

  const handleClearAllNotifications = async () => {
    try {
      const batchPromises = systemNotifications.map(notif => 
        updateDoc(doc(db, "notifications", notif.id), { read: true })
      );
      await Promise.all(batchPromises);
      setNotificationsOpen(false);
    } catch (e) {
      console.error("Failed to clear notifications", e);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex bg-background text-foreground transition-colors duration-300 overflow-hidden print:overflow-visible print:h-auto">
      <GlobalReminders />

      {/* Desktop Sidebar */}
      {!pathname.startsWith('/cashier') && !pathname.startsWith('/owner') && (
        <aside className="hidden lg:flex flex-col w-64 h-full z-50 flex-shrink-0 overflow-hidden print:hidden bg-card border-r border-border backdrop-blur-xl transition-colors duration-300">
          <div className="p-4 flex flex-col gap-4 flex-shrink-0 border-b border-border">
            <Link href="/" className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Store Logo" className="h-10 w-10 rounded-full object-cover border-2 shadow-md" style={{ borderColor: brandColor || '#F97316' }} />
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: 'conic-gradient(from 0deg, #E11D48, #F97316, #FBBF24, #E11D48)', filter: 'blur(4px)', opacity: 0.35 }} />
                  <div className="h-10 w-10 rounded-full flex items-center justify-center font-black text-white text-xl relative bg-zinc-900 border border-white/10">
                    K
                  </div>
                </div>
              )}
              <div className="flex flex-col text-start">
                <span className="font-extrabold tracking-[0.12em] text-base text-foreground">CIRCLE K</span>
                <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                  {currentBranch === 'alamein4' ? (language === 'ar' ? 'بوابة العلمين 4' : 'El Alamein 4 Portal') : currentBranch === 'ola' ? (language === 'ar' ? 'بوابة علا القرنفل' : 'Ola El Koronfol Portal') : (language === 'ar' ? 'بوابة الفروع' : 'All Branches')}
                </span>
              </div>
            </Link>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-3 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = item.href ? pathname === item.href : item.children?.some(child => pathname === child.href);
              const Icon = item.icon;

              if (item.children) {
                return (
                  <div key={item.name} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest mt-3 text-muted-foreground/70">
                      <span>{item.name}</span>
                    </div>
                    {item.children.map(child => {
                      const isChildActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          prefetch={true}
                          className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                            isChildActive 
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-l-4 border-rose-500 font-bold'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          }`}
                        >
                          <child.icon className={`h-4 w-4 ${isChildActive ? 'scale-110 text-rose-500 drop-shadow-sm' : 'opacity-70 group-hover:opacity-100'}`} />
                          <span>{child.name}</span>
                          {child.name === t("nav.shift_audit") && pendingShiftCount > 0 && (
                            <span className={`ml-auto bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse ${hasAgedShifts ? 'shadow-rose-500/80' : ''}`}>
                              {pendingShiftCount}
                            </span>
                          )}
                          {child.name === t("nav.voids_returns") && pendingVoidCount > 0 && (
                            <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                              {pendingVoidCount}
                            </span>
                          )}
                          {child.name === t("nav.expiries") && pendingExpiriesCount > 0 && (
                            <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                              {pendingExpiriesCount}
                            </span>
                          )}
                          {(child.name === "Out of Stock" || child.name === "سجل النواقص") && pendingOosCount > 0 && (
                            <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                              {pendingOosCount}
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
                  prefetch={true}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive 
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-l-4 border-rose-500 font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'scale-110 text-rose-500 drop-shadow-sm' : 'opacity-70 group-hover:opacity-100'}`} />
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

          <div className="p-4 mt-auto border-t border-border">
            <button
              onClick={() => {
                // Clean up device session before signing out
                const sessionId = sessionStorage.getItem("device_session_id");
                if (sessionId) {
                  deleteDoc(doc(db, "active_sessions", sessionId)).catch(() => {});
                  sessionStorage.removeItem("device_session_id");
                }
                signOut(auth);
              }}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-sm font-bold transition-all duration-200 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 cursor-pointer"
            >
              <LogOut className="h-4 w-4" /> {t("nav.sign_out")}
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 max-h-screen overflow-hidden print:max-h-none print:overflow-visible">
        {!pathname.startsWith('/cashier') && role !== 'cashier' && <MobileHeader />}

        {/* Top Header */}
        {!pathname.startsWith('/cashier') && !pathname.startsWith('/owner') && (
          <header
            className="flex-shrink-0 hidden md:flex items-center justify-between px-4 sm:px-6 z-40 print:hidden bg-card/90 backdrop-blur-xl border-b border-border transition-colors duration-300"
            style={{
              paddingTop: 'max(1rem, env(safe-area-inset-top))',
              paddingBottom: '1rem',
              minHeight: 'calc(4rem + env(safe-area-inset-top))',
            }}
          >

            {/* Mobile Left: Logo & Hamburger */}
            <div className="flex lg:hidden items-center gap-3">
              <button
                className="p-2 rounded-xl transition-all bg-muted border border-border text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
              <span className="font-extrabold tracking-[0.12em] text-sm text-foreground">CIRCLE K</span>
            </div>

            {/* Desktop Left: Breadcrumb or Greeting */}
            <div className="hidden lg:flex items-center gap-6">
              {userDoc && (
                <div className="text-sm font-semibold text-muted-foreground">
                  <span>{language === 'ar' ? 'مرحباً، ' : 'Welcome, '}<span className="text-lg font-extrabold text-foreground">{userDoc.displayName || user?.email?.split('@')[0]}</span></span>
                </div>
              )}
              {currentDateTime && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 border border-border">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-bold text-muted-foreground">
                    {currentDateTime.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="w-px h-3 mx-1 bg-border"></div>
                  <Clock className="h-4 w-4 text-rose-500" />
                  <span className="text-xs font-black font-mono tracking-wider text-rose-600 dark:text-rose-400">
                    {currentDateTime.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              {/* Branch Switcher */}
              {availableBranches.length > 1 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted/60 border border-border text-foreground">
                  <Store className="h-3.5 w-3.5 text-rose-500" />
                  <select
                    value={currentBranch}
                    onChange={(e) => setBranch(e.target.value as BranchId)}
                    className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer outline-none text-foreground"
                  >
                    {availableBranches.map((b) => (
                      <option key={b.id} value={b.id} className="bg-card text-foreground">{language === "ar" && b.id === "alamein4" ? "العلمين 4" : language === "ar" && b.id === "ola" ? "علا القرنفل" : b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 rounded-xl transition-all bg-muted/60 border border-border text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Bell className={`h-4 w-4 ${totalNotifications > 0 ? "animate-pulse text-rose-500" : ""}`} />
                  {totalNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg bg-rose-500">
                      {totalNotifications}
                    </span>
                  )}
                </button>

                {/* Dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col bg-card border border-border">
                    <div className="p-3.5 font-black text-sm flex justify-between items-center bg-muted/40 border-b border-border text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{isAr ? "التنبيهات" : "Notifications"}</span>
                        <span className="text-white text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500">{totalNotifications}</span>
                      </div>
                      {systemNotifications.length > 0 && (
                        <button 
                          onClick={handleClearAllNotifications}
                          className="text-[10px] font-bold transition-colors px-2 py-1 rounded-lg cursor-pointer text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20"
                        >
                          {isAr ? "مسح الكل" : "Clear All"}
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto custom-scrollbar">
                      {totalNotifications === 0 ? (
                        <div className="p-6 text-center text-xs font-semibold text-muted-foreground">{isAr ? "لا توجد تنبيهات جديدة" : "All caught up! No pending alerts."}</div>
                      ) : (
                        <>
                          {systemNotifications.length > 0 && (
                            <div className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider bg-muted text-secondary">
                              {isAr ? "إجراءات حديثة" : "Recent Actions"}
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
                                } catch (e) { console.error("Error marking read", e); }
                              }}
                              className="block p-3.5 transition-colors border-b border-border bg-rose-500/5 hover:bg-rose-500/10"
                            >
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-xs font-extrabold capitalize flex items-center gap-2 text-foreground">
                                  <span className="w-2 h-2 rounded-full inline-block animate-pulse bg-rose-500"></span>
                                  {notif.type} Update
                                </p>
                                <span className="text-[10px] font-medium text-muted-foreground">{new Date(notif.createdAt?.toDate ? notif.createdAt.toDate() : Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-xs font-medium text-muted-foreground">{notif.message}</p>
                            </Link>
                          ))}

                          {(pendingShiftCount > 0 || pendingVoidCount > 0 || pendingReturnsCount > 0 || pendingExpiriesCount > 0) && (
                            <div className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider bg-muted text-secondary">
                              {isAr ? "في انتظار الاعتماد" : "Pending Approvals"}
                            </div>
                          )}
                          {pendingShiftCount > 0 && (
                            <Link href="/shift-reports/manager" onClick={() => setNotificationsOpen(false)} className="block p-3.5 transition-colors border-b border-border hover:bg-muted/50">
                              <p className="text-xs font-extrabold text-foreground">{isAr ? "مراجعة الورديات" : "Shift Audits"}</p>
                              <p className="text-xs font-semibold mt-0.5 text-muted-foreground">{pendingShiftCount} {isAr ? "ورديات تنتظر اعتماد المدير" : "pending shifts require approval."}</p>
                            </Link>
                          )}
                          {pendingVoidCount > 0 && (
                            <Link href="/voids/manager" onClick={() => setNotificationsOpen(false)} className="block p-3.5 transition-colors border-b border-border hover:bg-muted/50">
                              <p className="text-xs font-extrabold text-foreground">{isAr ? "إلغاءات ومرتجعات المبيعات" : "Voids & Returns"}</p>
                              <p className="text-xs font-semibold mt-0.5 text-muted-foreground">{pendingVoidCount} {isAr ? "طلبات تراجع تحتاج مراجعة" : "requests require review."}</p>
                            </Link>
                          )}
                          {pendingReturnsCount > 0 && (
                            <Link href="/dashboard/supplier-returns" onClick={() => setNotificationsOpen(false)} className="block p-3.5 transition-colors border-b border-border hover:bg-muted/50">
                              <p className="text-xs font-extrabold text-foreground">{isAr ? "مرتجعات الموردين" : "Supplier Returns"}</p>
                              <p className="text-xs font-semibold mt-0.5 text-muted-foreground">{pendingReturnsCount} {isAr ? "إيصالات مرتجع قيد التسوية" : "returns pending settlement."}</p>
                            </Link>
                          )}
                          {pendingExpiriesCount > 0 && (
                            <Link href="/products/expiries-audit" onClick={() => setNotificationsOpen(false)} className="block p-3.5 transition-colors hover:bg-muted/50">
                              <p className="text-xs font-extrabold text-foreground">{isAr ? "جرد الصلاحيات" : "Expiry Audits"}</p>
                              <p className="text-xs font-semibold mt-0.5 text-muted-foreground">{pendingExpiriesCount} {isAr ? "سجلات تحتاج مراجعة" : "audits require review."}</p>
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
                className="p-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer bg-muted/60 border border-border text-muted-foreground hover:text-foreground"
              >
                <Languages className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase">{language === "en" ? "عربي" : "EN"}</span>
              </button>

              </div>
          </header>
        )}

        {/* Mobile Dropdown Menu (Only shown on small screens) */}
        {mobileMenuOpen && !pathname.startsWith('/cashier') && !pathname.startsWith('/owner') && (
          <div className="lg:hidden absolute top-16 left-0 w-full bg-card border-b border-border shadow-xl z-50 flex flex-col p-4 gap-2 h-[calc(100vh-4rem)] overflow-y-auto">
            {navItems.map((item) => {
              if (item.children) {
                return (
                  <div key={item.name} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center px-4 py-2 text-sm font-bold text-muted-foreground uppercase tracking-widest border-b border-border mt-2">
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
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
                  // Clean up device session before signing out
                  const sessionId = sessionStorage.getItem("device_session_id");
                  if (sessionId) {
                    deleteDoc(doc(db, "active_sessions", sessionId)).catch(() => {});
                    sessionStorage.removeItem("device_session_id");
                  }
                  signOut(auth);
                }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
              >
                <LogOut className="h-4 w-4" /> {t("nav.sign_out")}
              </button>
            </div>
          </div>
        )}

        {/* Push Notification Authorization Banner for Manager Phone / Device */}
        {pushPermissionNeeded && (
          <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white text-xs font-bold px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm no-print z-50 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>{isAr ? "قم بتفعيل إشعارات الشاشة الرئيسية والقفل لمتابعة التنبيهات!" : "Enable Lock Screen Push Notifications on this Manager Phone / PWA Device!"}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => registerFcmPushToken(user)}
                className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 text-white border border-white/30 text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm transition-all cursor-pointer"
              >
                {isAr ? "تفعيل الإشعارات 🔔" : "Enable Push Notifications 🔔"}
              </button>
              <button
                onClick={() => setPushPermissionNeeded(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                title={isAr ? "إغلاق" : "Dismiss"}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Main Content */}
        <main className={`flex-grow overflow-y-auto custom-scrollbar flex flex-col bg-[#09090b] text-foreground ${(pathname.startsWith('/cashier') || pathname.startsWith('/owner')) ? '' : 'p-4 sm:p-6 lg:p-8'}`}>
          <div
            className={`flex-grow w-full max-w-7xl mx-auto ${(pathname.startsWith('/cashier') || pathname.startsWith('/owner')) ? 'h-full p-0 m-0 max-w-full' : ''}`}
          >
            {children}
          </div>

          {/* Footer inside scrollable area */}
          {!pathname.startsWith('/cashier') && !pathname.startsWith('/owner') && (
            <footer className="mt-8 border-t border-border/50 py-4 text-center text-xs text-muted-foreground no-print">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <p>© 2026 Circle K Franchise ANH Group. All rights reserved.</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowWelcomeModal(true)}
                    className="hover:text-cyan-400 font-bold transition-colors cursor-pointer"
                  >
                    ✨ Welcome Screen
                  </button>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" /> Created by Youssef Elhalawany
                  </span>
                </div>
              </div>
            </footer>
          )}
        </main>
      </div>

      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => {
          localStorage.setItem("has_seen_welcome_anh_v2", "true");
          setShowWelcomeModal(false);
        }}
        userName={userDoc?.displayName || userDoc?.name || user?.displayName || (user?.email ? user.email.split("@")[0] : "Mr. Youssef Halawany")}
        userRole={userDoc?.role || role || "Executive Administrator"}
      />

      <RemoteMessageOverlay
        message={incomingRemoteMessage}
        onAcknowledge={async () => {
          const sessionId = sessionStorage.getItem("device_session_id");
          if (sessionId) {
            updateDoc(doc(db, "active_sessions", sessionId), {
              remoteMessage: null,
              acknowledgedAt: new Date().toISOString()
            }).catch(() => {});
          }
          setIncomingRemoteMessage(null);
        }}
      />

      <PwaInstallPrompt />
      <IdleScreensaver pendingTasksCount={pendingShiftCount + pendingVoidCount + pendingExpiriesCount + pendingReturnsCount} />

      {!pathname.startsWith('/cashier') && role !== "cashier" && (
        <ManagerBottomNav
          pendingShiftsCount={pendingShiftCount}
          pendingVoidsCount={pendingVoidCount}
          pendingExpiriesCount={pendingExpiriesCount}
        />
      )}
    </div>
  );
}
