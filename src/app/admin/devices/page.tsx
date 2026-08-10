"use client";

import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  Monitor, Smartphone, Tablet, Laptop, Globe, LogOut, Search, Shield,
  RefreshCw, Users, Wifi, WifiOff, Clock, AlertTriangle, X, Loader2,
  BellRing, Compass, Sparkles, Send, Check, Radio, ShieldAlert, Cpu,
  Battery, BatteryCharging, BatteryWarning, Navigation, Wrench, MessageSquare,
  FileText, DollarSign, Package, ClipboardList, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";

interface SessionData {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: string;
  browser: string;
  os: string;
  deviceType: string;
  loginAt: string;
  lastActiveAt: string;
  currentPath?: string;
  pageLabel?: string;
  isPwa?: boolean;
  screenSize?: string;
  batteryLevel?: number;
  isCharging?: boolean;
  hasBattery?: boolean;
  forceLogout?: boolean;
  source?: string;
  remoteMessage?: any;
  lastReply?: {
    text: string;
    repliedAt: string;
    repliedBy?: string;
  };
}

function parseTimeAgo(dateStr?: string): string {
  if (!dateStr) return "Unknown";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getSessionStatus(lastActiveAt: string): "online" | "idle" | "offline" {
  if (!lastActiveAt) return "offline";
  const now = Date.now();
  const last = new Date(lastActiveAt).getTime();
  const diffMins = (now - last) / 60000;

  if (diffMins < 15) return "online";
  if (diffMins < 60) return "idle";
  return "offline";
}

function getDeviceIcon(deviceType: string) {
  switch (deviceType) {
    case "mobile": return Smartphone;
    case "tablet": return Tablet;
    case "laptop": return Laptop;
    default: return Monitor;
  }
}

const QUICK_PING_TEMPLATES = [
  "🚨 Action Required: Please finalize and submit today's shift report immediately.",
  "💰 Action Required: Count safe cash and verify current register balance.",
  "📦 Inventory audit check requested by management.",
  "📞 Please contact management on WhatsApp right away.",
  "⚠️ Immediate attention required at the cashier counter."
];

const TELEPORT_ROUTES = [
  {
    category: "Financial Inputs",
    icon: DollarSign,
    routes: [
      { name: "Deposits Input", path: "/financials/inputs/deposits" },
      { name: "Sales Input", path: "/financials/inputs/sales" },
      { name: "Payments Input", path: "/financials/inputs/payments" },
      { name: "Credits Input", path: "/financials/inputs/credits" },
      { name: "Safe Report", path: "/financials/inputs/safe-report" },
      { name: "TMT Invoices", path: "/financials/inputs/tmt-invoices" }
    ]
  },
  {
    category: "Operations & Shifts",
    icon: ClipboardList,
    routes: [
      { name: "Shift Reports Audit", path: "/shift-reports/manager" },
      { name: "Cashier Shift Entry", path: "/shift-reports/cashier" },
      { name: "Voids & Returns Manager", path: "/voids/manager" },
      { name: "Cashier Voids Request", path: "/voids/cashier" },
      { name: "Official Documents", path: "/manager/documents" },
      { name: "Cleaning Logs", path: "/admin/cleaning" }
    ]
  },
  {
    category: "Inventory & Products",
    icon: Package,
    routes: [
      { name: "Expiries Audit", path: "/products/expiries-audit" },
      { name: "Out of Stock Log", path: "/financials/out-of-stock" },
      { name: "Supplier Orders", path: "/products/supplier-orders" },
      { name: "Food Codes", path: "/admin/food-codes" },
      { name: "Offers Management", path: "/admin/offers" }
    ]
  },
  {
    category: "Financial Reports",
    icon: FileText,
    routes: [
      { name: "Month Summary", path: "/financial-reports/month-summary" },
      { name: "Detailed Sales", path: "/financials/detailed-sales" },
      { name: "P&L Statement", path: "/financial-reports/pnl" },
      { name: "Expenses Report", path: "/financial-reports/expenses" },
      { name: "End Shift Cash", path: "/financial-reports/end-shift-cash" }
    ]
  }
];

export default function DeviceSessionsPage() {
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [revokingAllUser, setRevokingAllUser] = useState<string | null>(null);
  const [reloadingSession, setReloadingSession] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: "single" | "all"; sessionId?: string; userId?: string; userName?: string } | null>(null);
  const [pingModal, setPingModal] = useState<{ sessionId?: string; userId?: string; userName: string; deviceName?: string } | null>(null);
  const [teleportModal, setTeleportModal] = useState<{ sessionId?: string; userName: string; deviceName?: string } | null>(null);
  const [pingMessage, setPingMessage] = useState("");
  const [sendingPing, setSendingPing] = useState(false);
  const [teleporting, setTeleporting] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState("owner");
  const [currentAdminName, setCurrentAdminName] = useState("System Administrator");

  // Real-time live sessions subscription
  useEffect(() => {
    const q = query(collection(db, "active_sessions"), orderBy("loginAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreSessions: SessionData[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      } as SessionData));

      setSessions(prev => {
        const authOnly = prev.filter(s => s.source === "firebase_auth");
        const trackedUserIds = new Set(firestoreSessions.map(s => s.userId));
        const remainingAuth = authOnly.filter(s => !trackedUserIds.has(s.userId));
        return [...firestoreSessions, ...remainingAuth];
      });
      setLoading(false);
    }, (err) => {
      console.error("Sessions listener error:", err);
      setLoading(false);
    });

    const fetchAuthUsers = async () => {
      try {
        let token = "";
        if (auth.currentUser) {
          try { token = await auth.currentUser.getIdToken(); } catch (e) {}
        }
        const res = await fetch("/api/admin/sessions", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "x-user-role": localStorage.getItem("circlek_role") || "owner"
          }
        });
        const data = await res.json();
        if (data.success && data.sessions) {
          const authSessions = data.sessions.filter((s: any) => s.source === "firebase_auth") as SessionData[];
          if (authSessions.length > 0) {
            setSessions(prev => {
              const trackedUserIds = new Set(prev.filter(s => !s.source).map(s => s.userId));
              const newAuth = authSessions.filter(s => !trackedUserIds.has(s.userId));
              return [...prev.filter(s => !s.source), ...newAuth];
            });
          }
        }
      } catch (e) {
        console.warn("Failed to fetch auth users:", e);
      }
    };

    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const { getDoc, doc } = await import("firebase/firestore");
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const d = userDoc.data();
          setCurrentUserRole(d.role || "owner");
          setCurrentAdminName(d.displayName || user.displayName || "Admin");
        }
        fetchAuthUsers();
      }
    });

    return () => {
      unsubscribe();
      unsubAuth();
    };
  }, []);

  // Force Remote Reload of Device
  const handleRemoteReload = async (sessionId: string) => {
    setReloadingSession(sessionId);
    try {
      if (!sessionId.startsWith("auth_")) {
        await updateDoc(doc(db, "active_sessions", sessionId), {
          remoteCommand: {
            action: "reload",
            commandId: Date.now().toString(),
            requestedAt: new Date().toISOString(),
            requestedBy: currentAdminName
          }
        });
        toast.success("Remote update signal sent! Device will reload momentarily. 🔄");
      } else {
        toast.info("Device will reload on its next active interaction.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger remote reload");
    } finally {
      setReloadingSession(null);
    }
  };

  // Remote Cache & Offline Storage Reset
  const handleRemoteClearCache = async (sessionId: string) => {
    try {
      if (!sessionId.startsWith("auth_")) {
        await updateDoc(doc(db, "active_sessions", sessionId), {
          remoteCommand: {
            action: "clear_cache",
            commandId: Date.now().toString(),
            requestedAt: new Date().toISOString(),
            requestedBy: currentAdminName
          }
        });
        toast.success("Remote cache flush signal sent! 🧹");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to flush remote cache");
    }
  };

  // Remote Teleport / Navigation Command
  const handleTeleportDevice = async (targetPath: string, pageName: string) => {
    if (!teleportModal || !teleportModal.sessionId) return;
    setTeleporting(true);
    try {
      if (!teleportModal.sessionId.startsWith("auth_")) {
        await updateDoc(doc(db, "active_sessions", teleportModal.sessionId), {
          remoteCommand: {
            action: "navigate",
            targetPath,
            pageLabel: pageName,
            commandId: Date.now().toString(),
            requestedAt: new Date().toISOString(),
            requestedBy: currentAdminName
          }
        });
        toast.success(`Teleport signal sent! Device navigating to ${pageName} 🔀`);
      }
      setTeleportModal(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to teleport device");
    } finally {
      setTeleporting(false);
    }
  };

  // Send Remote Ping / Instant Alert
  const handleSendPing = async () => {
    if (!pingModal || !pingMessage.trim()) {
      toast.error("Please enter a message to send.");
      return;
    }
    setSendingPing(true);
    try {
      const payload = {
        id: Date.now().toString(),
        title: "Priority Management Alert",
        message: pingMessage.trim(),
        senderName: currentAdminName,
        sentAt: new Date().toISOString(),
        severity: "urgent"
      };

      if (pingModal.sessionId && !pingModal.sessionId.startsWith("auth_")) {
        await updateDoc(doc(db, "active_sessions", pingModal.sessionId), {
          remoteMessage: payload
        });
        toast.success("Priority alert dispatched to device with audio chime! 🔔");
      } else if (pingModal.userId) {
        const targetSessions = sessions.filter(s => s.userId === pingModal.userId && !s.id.startsWith("auth_"));
        for (const s of targetSessions) {
          updateDoc(doc(db, "active_sessions", s.id), { remoteMessage: payload }).catch(() => {});
        }
        toast.success(`Priority alert sent to all active devices of ${pingModal.userName}! 🔔`);
      }

      setPingModal(null);
      setPingMessage("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSendingPing(false);
    }
  };

  // Force Logout
  const handleForceLogout = async (sessionId: string) => {
    setRevokingSession(sessionId);
    try {
      if (!sessionId.startsWith("auth_")) {
        await updateDoc(doc(db, "active_sessions", sessionId), {
          forceLogout: true,
          terminatedAt: new Date().toISOString()
        }).catch(() => {});

        setTimeout(() => {
          deleteDoc(doc(db, "active_sessions", sessionId)).catch(() => {});
        }, 3000);
      }

      setSessions(prev => prev.filter(s => s.id !== sessionId));

      let token = "";
      if (auth.currentUser) {
        try { token = await auth.currentUser.getIdToken(); } catch (e) {}
      }

      await fetch(`/api/admin/sessions?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-user-role": currentUserRole || "owner"
        }
      }).catch(console.warn);

      toast.success("Device logged out successfully! 🔒");
    } catch (err: any) {
      toast.error(err.message || "Failed to force logout");
    } finally {
      setRevokingSession(null);
      setConfirmModal(null);
    }
  };

  // Logout All Devices for User
  const handleLogoutAllDevices = async (userId: string) => {
    setRevokingAllUser(userId);
    try {
      const userSessionDocs = sessions.filter(s => s.userId === userId);
      for (const s of userSessionDocs) {
        if (!s.id.startsWith("auth_")) {
          updateDoc(doc(db, "active_sessions", s.id), {
            forceLogout: true,
            terminatedAt: new Date().toISOString()
          }).catch(() => {});
          setTimeout(() => {
            deleteDoc(doc(db, "active_sessions", s.id)).catch(() => {});
          }, 3000);
        }
      }

      setDoc(doc(db, "users", userId), {
        forceLogoutAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      setSessions(prev => prev.filter(s => s.userId !== userId));

      let token = "";
      if (auth.currentUser) {
        try { token = await auth.currentUser.getIdToken(); } catch (e) {}
      }

      await fetch(`/api/admin/sessions?userId=${encodeURIComponent(userId)}&all=true`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-user-role": currentUserRole || "owner"
        }
      }).catch(console.warn);

      toast.success("All devices for user logged out! 🔒");
    } catch (err: any) {
      toast.error(err.message || "Failed to force logout all");
    } finally {
      setRevokingAllUser(null);
      setConfirmModal(null);
    }
  };

  const filteredSessions = sessions.filter(s =>
    s.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.browser?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.os?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.pageLabel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.currentPath?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group sessions by user
  const userGroups = filteredSessions.reduce<Record<string, SessionData[]>>((acc, session) => {
    const key = session.userId || session.userEmail;
    if (!acc[key]) acc[key] = [];
    acc[key].push(session);
    return acc;
  }, {});

  const onlineCount = sessions.filter(s => getSessionStatus(s.lastActiveAt) === "online").length;
  const idleCount = sessions.filter(s => getSessionStatus(s.lastActiveAt) === "idle").length;
  const offlineCount = sessions.filter(s => getSessionStatus(s.lastActiveAt) === "offline").length;
  const pwaCount = sessions.filter(s => s.isPwa).length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen pb-32 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Monitor className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black flex items-center gap-2">
                Device Sessions & Live Hub
              </h1>
              <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Telemetry • Remote Teleport • Battery Monitoring • Repeating Audio Pings
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Users className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-foreground">{sessions.length}</p>
            <p className="text-xs text-muted-foreground font-semibold">Total Terminals</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Wifi className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-500">{onlineCount}</p>
            <p className="text-xs text-muted-foreground font-semibold">Live Online</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-amber-500">{idleCount}</p>
            <p className="text-xs text-muted-foreground font-semibold">Idle Sessions</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-blue-500">{pwaCount}</p>
            <p className="text-xs text-muted-foreground font-semibold">Installed PWAs</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-4 flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
            <WifiOff className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-rose-500">{offlineCount}</p>
            <p className="text-xs text-muted-foreground font-semibold">Offline</p>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by user, active page, browser, OS, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent outline-none flex-grow text-sm placeholder:text-muted-foreground"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Sessions List */}
        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mx-auto mb-3" />
              <p className="text-muted-foreground text-sm font-semibold">Syncing device telemetry & power stats...</p>
            </div>
          ) : Object.keys(userGroups).length === 0 ? (
            <div className="p-12 text-center">
              <Monitor className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm font-semibold">
                {searchTerm ? "No devices match your search criteria" : "No active terminals found"}
              </p>
              <p className="text-muted-foreground/60 text-xs mt-1">Terminals stream telemetry automatically when users open the portal</p>
            </div>
          ) : (
            Object.entries(userGroups).map(([userId, userSessions]) => {
              const firstSession = userSessions[0];
              const isSimultaneous = userSessions.length > 1;

              return (
                <div key={userId} className="p-4 md:p-5 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                  {/* User Section Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-black text-sm shadow-md">
                        {(firstSession.userName || firstSession.userEmail || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-foreground">{firstSession.userName || "Unknown User"}</p>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full
                            ${firstSession.role === 'admin_editor' || firstSession.role === 'owner' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                              firstSession.role === 'admin_viewer' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                              'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                            {firstSession.role === 'admin_editor' || firstSession.role === 'owner' ? 'Admin' :
                             firstSession.role === 'admin_viewer' ? 'Viewer' : 'Manager'}
                          </span>

                          {/* Simultaneous Login Alert Badge */}
                          {isSimultaneous && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-full animate-pulse">
                              <ShieldAlert className="h-3 w-3" />
                              Simultaneous Sessions ({userSessions.length} active)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{firstSession.userEmail}</p>
                      </div>
                    </div>

                    {/* User level quick actions */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => setPingModal({ userId, userName: firstSession.userName })}
                        className="text-xs font-bold text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Broadcast alert to all devices of this user"
                      >
                        <BellRing className="h-3.5 w-3.5" />
                        Ping All
                      </button>

                      {userSessions.length > 1 && (
                        <button
                          onClick={() => setConfirmModal({ type: "all", userId, userName: firstSession.userName })}
                          disabled={revokingAllUser === userId}
                          className="text-xs font-bold text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          {revokingAllUser === userId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <LogOut className="h-3 w-3" />
                          )}
                          Logout All ({userSessions.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Device Telemetry Cards */}
                  <div className="grid gap-2.5 ml-0 md:ml-12">
                    {userSessions.map((session) => {
                      const status = getSessionStatus(session.lastActiveAt);
                      const DeviceIcon = getDeviceIcon(session.deviceType);
                      const isRevoking = revokingSession === session.id;
                      const isReloading = reloadingSession === session.id;

                      return (
                        <motion.div
                          key={session.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border transition-all gap-3 ${
                            status === "online"
                              ? "bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-950/20"
                              : status === "idle"
                              ? "bg-amber-500/5 border-amber-500/20 dark:bg-amber-950/20"
                              : "bg-slate-50 border-border dark:bg-slate-800/30"
                          }`}
                        >
                          {/* Device Metadata */}
                          <div className="flex items-start sm:items-center gap-3">
                            <div className={`relative h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                              status === "online" ? "bg-emerald-500/15" :
                              status === "idle" ? "bg-amber-500/15" :
                              "bg-slate-200 dark:bg-slate-700"
                            }`}>
                              <DeviceIcon className={`h-5 w-5 ${
                                status === "online" ? "text-emerald-500" :
                                status === "idle" ? "text-amber-500" :
                                "text-slate-400"
                              }`} />
                              <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                                status === "online" ? "bg-emerald-500 animate-pulse" :
                                status === "idle" ? "bg-amber-500" :
                                "bg-slate-400"
                              }`} />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-foreground">
                                  {session.source === "firebase_auth" ? (
                                    <span>Signed In Account</span>
                                  ) : (
                                    <>
                                      {session.browser || "Unknown Browser"}
                                      <span className="text-xs text-muted-foreground font-normal mx-1">on</span>
                                      {session.os || "Unknown OS"}
                                    </>
                                  )}
                                </p>

                                {/* PWA App Badge */}
                                {session.isPwa ? (
                                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-500 border border-blue-500/30 flex items-center gap-1">
                                    <Smartphone className="h-3 w-3" /> PWA App
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 border border-border">
                                    Web Browser
                                  </span>
                                )}

                                {/* Battery Telemetry Badge */}
                                {session.batteryLevel !== undefined && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                    session.isCharging
                                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                      : session.batteryLevel < 20
                                      ? "bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse"
                                      : "bg-slate-100 dark:bg-slate-800 text-zinc-300 border-border"
                                  }`}>
                                    {session.isCharging ? (
                                      <BatteryCharging className="h-3 w-3 text-emerald-400" />
                                    ) : session.batteryLevel < 20 ? (
                                      <BatteryWarning className="h-3 w-3 text-rose-400" />
                                    ) : (
                                      <Battery className="h-3 w-3 text-zinc-400" />
                                    )}
                                    <span>{session.batteryLevel}% {session.isCharging ? "Charging" : ""}</span>
                                  </span>
                                )}

                                {/* Screen resolution */}
                                {session.screenSize && (
                                  <span className="text-[10px] text-muted-foreground bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                    {session.screenSize}
                                  </span>
                                )}
                              </div>

                              {/* Live Current Page Indicator */}
                              {session.pageLabel ? (
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg w-fit border border-emerald-500/20">
                                  <Compass className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '6s' }} />
                                  <span>Active on: <strong className="text-emerald-300">{session.pageLabel}</strong></span>
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span>Viewing: Portal Dashboard</span>
                                </div>
                              )}

                              {/* Two-Way Quick Reply Bubble */}
                              {session.lastReply && session.lastReply.text && (
                                <div className="text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-xl w-fit flex items-center gap-1.5 mt-1">
                                  <MessageSquare className="h-3 w-3 text-blue-400 shrink-0" />
                                  <span>Last Reply: <strong className="text-white">&ldquo;{session.lastReply.text}&rdquo;</strong></span>
                                  <span className="text-[10px] text-blue-400/70 font-normal">({parseTimeAgo(session.lastReply.repliedAt)})</span>
                                </div>
                              )}

                              {/* Timestamps */}
                              <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap pt-0.5">
                                <span className={`font-bold uppercase tracking-wider ${
                                  status === "online" ? "text-emerald-500" :
                                  status === "idle" ? "text-amber-500" :
                                  "text-slate-400"
                                }`}>
                                  {status === "online" ? "● Online" : status === "idle" ? "● Idle" : "● Offline"}
                                </span>
                                <span>Last active: <strong>{parseTimeAgo(session.lastActiveAt)}</strong></span>
                                <span>Logged in: <strong>{parseTimeAgo(session.loginAt)}</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* Device Action Buttons */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            {/* Remote Teleport / Navigation */}
                            <button
                              onClick={() => setTeleportModal({
                                sessionId: session.id,
                                userName: session.userName,
                                deviceName: `${session.browser} on ${session.os}`
                              })}
                              className="p-2 text-emerald-500 hover:bg-emerald-500/15 rounded-xl transition-colors cursor-pointer"
                              title="Teleport / Redirect Device to Any Page"
                            >
                              <Navigation className="h-4 w-4" />
                            </button>

                            {/* Ping Single Device with Audio Loop */}
                            <button
                              onClick={() => setPingModal({
                                sessionId: session.id,
                                userName: session.userName,
                                deviceName: `${session.browser} on ${session.os}`
                              })}
                              className="p-2 text-blue-500 hover:bg-blue-500/15 rounded-xl transition-colors cursor-pointer"
                              title="Send Repeating Priority Ping with Audio Chime"
                            >
                              <BellRing className="h-4 w-4" />
                            </button>

                            {/* Remote Clear Cache & Fix */}
                            <button
                              onClick={() => handleRemoteClearCache(session.id)}
                              className="p-2 text-purple-500 hover:bg-purple-500/15 rounded-xl transition-colors cursor-pointer"
                              title="Remote Flush Offline Cache & Diagnostics"
                            >
                              <Wrench className="h-4 w-4" />
                            </button>

                            {/* Remote Force Reload */}
                            <button
                              onClick={() => handleRemoteReload(session.id)}
                              disabled={isReloading}
                              className="p-2 text-amber-500 hover:bg-amber-500/15 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                              title="Remote Reload Application on Device"
                            >
                              {isReloading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </button>

                            {/* Force Logout Device */}
                            <button
                              onClick={() => setConfirmModal({
                                type: "single",
                                sessionId: session.id,
                                userName: session.userName
                              })}
                              disabled={isRevoking}
                              className="p-2 text-red-500 hover:bg-red-500/15 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                              title="Force Remote Logout"
                            >
                              {isRevoking ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <LogOut className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Teleport / Remote Navigation Modal */}
      <AnimatePresence>
        {teleportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-emerald-500/30 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-border bg-emerald-500/10 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md">
                    <Navigation className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-foreground">
                      Teleport Device to Any Route
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Target: <strong>{teleportModal.userName}</strong> ({teleportModal.deviceName || "Device"})
                    </p>
                  </div>
                </div>
                <button onClick={() => setTeleportModal(null)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                <p className="text-xs text-muted-foreground">
                  Select a destination page below. The target terminal will immediately switch screens in real-time.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {TELEPORT_ROUTES.map((cat, idx) => {
                    const CatIcon = cat.icon;
                    return (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-border space-y-2.5">
                        <h4 className="text-xs font-black uppercase text-foreground flex items-center gap-1.5">
                          <CatIcon className="h-3.5 w-3.5 text-emerald-500" />
                          {cat.category}
                        </h4>
                        <div className="space-y-1">
                          {cat.routes.map((route, rIdx) => (
                            <button
                              key={rIdx}
                              type="button"
                              onClick={() => handleTeleportDevice(route.path, route.name)}
                              disabled={teleporting}
                              className="w-full text-left text-xs p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-emerald-500/10 hover:text-emerald-400 border border-border hover:border-emerald-500/30 transition-all font-semibold flex items-center justify-between group cursor-pointer"
                            >
                              <span>{route.name}</span>
                              <span className="text-[10px] text-muted-foreground group-hover:text-emerald-400">Teleport →</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ping / Instant Message Modal */}
      <AnimatePresence>
        {pingModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-blue-500/30 overflow-hidden flex flex-col"
            >
              <div className="p-5 border-b border-border bg-blue-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-md">
                    <BellRing className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-foreground">
                      Dispatch Priority Ping Alert
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Target: <strong>{pingModal.userName}</strong> {pingModal.deviceName ? `(${pingModal.deviceName})` : "(All Devices)"}
                    </p>
                  </div>
                </div>
                <button onClick={() => setPingModal(null)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">
                    Quick Operational Templates
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                    {QUICK_PING_TEMPLATES.map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPingMessage(tmpl)}
                        className="w-full text-left text-xs p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-blue-500/10 hover:text-blue-400 border border-transparent hover:border-blue-500/30 transition-all font-medium"
                      >
                        {tmpl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">
                    Alert Message Content *
                  </label>
                  <textarea
                    value={pingMessage}
                    onChange={(e) => setPingMessage(e.target.value)}
                    placeholder="Type urgent operational instructions..."
                    rows={3}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-xl p-3 text-sm outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-400 flex items-center gap-2">
                  <Radio className="h-4 w-4 shrink-0 animate-pulse" />
                  <span>The target device will play a repeating audio chime continuously until the user confirms reading on screen.</span>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPingModal(null)}
                    className="px-4 py-2 text-sm font-semibold text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendPing}
                    disabled={sendingPing || !pingMessage.trim()}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-extrabold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {sendingPing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send Repeating Alert
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Logout Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-red-500/30 overflow-hidden"
            >
              <div className="p-5 border-b border-border bg-red-500/10 flex justify-between items-center">
                <h3 className="font-bold text-base flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  {confirmModal.type === "all" ? "Logout All Devices" : "Force Logout Terminal"}
                </h3>
                <button onClick={() => setConfirmModal(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-foreground">
                  {confirmModal.type === "all" ? (
                    <>Are you sure you want to log out <strong className="text-red-500">{confirmModal.userName || "this user"}</strong> from all devices? All active terminals will be kicked out in real time.</>
                  ) : (
                    <>Are you sure you want to force logout this terminal for <strong className="text-red-500">{confirmModal.userName || "this user"}</strong>? The terminal will immediately redirect to the login screen.</>
                  )}
                </p>
                <p className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-border">
                  ⚠️ The user&apos;s Firebase Auth tokens will be revoked immediately on the device.
                </p>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmModal(null)}
                    className="px-4 py-2 text-sm font-semibold text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmModal.type === "all" && confirmModal.userId) {
                        handleLogoutAllDevices(confirmModal.userId);
                      } else if (confirmModal.sessionId) {
                        handleForceLogout(confirmModal.sessionId);
                      }
                    }}
                    disabled={!!revokingSession || !!revokingAllUser}
                    className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-600/30 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {(revokingSession || revokingAllUser) ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Revoking...
                      </>
                    ) : (
                      <>
                        <LogOut className="h-4 w-4" />
                        {confirmModal.type === "all" ? "Logout All Devices" : "Force Logout"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
