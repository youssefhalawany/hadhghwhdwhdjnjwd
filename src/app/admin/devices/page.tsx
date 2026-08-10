"use client";

import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Monitor, Smartphone, Tablet, Laptop, Globe, LogOut, Search, Shield, RefreshCw, Users, Wifi, WifiOff, Clock, AlertTriangle, X, Loader2 } from "lucide-react";
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
  forceLogout?: boolean;
}

function parseTimeAgo(dateStr: string): string {
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

export default function DeviceSessionsPage() {
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [revokingAllUser, setRevokingAllUser] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: "single" | "all"; sessionId?: string; userId?: string; userName?: string } | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState("owner");

  // Listen to active_sessions collection in real time
  useEffect(() => {
    const q = query(collection(db, "active_sessions"), orderBy("loginAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionsData: SessionData[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      } as SessionData));
      setSessions(sessionsData);
      setLoading(false);
    }, (err) => {
      console.error("Sessions listener error:", err);
      toast.error("Failed to load device sessions");
      setLoading(false);
    });

    // Get current user role
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const { getDoc, doc } = await import("firebase/firestore");
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setCurrentUserRole(userDoc.data().role || "owner");
        }
      }
    });

    return () => {
      unsubscribe();
      unsubAuth();
    };
  }, []);

  const handleForceLogout = async (sessionId: string) => {
    setRevokingSession(sessionId);
    try {
      let token = "";
      if (auth.currentUser) {
        try { token = await auth.currentUser.getIdToken(); } catch (e) {}
      }

      const res = await fetch(`/api/admin/sessions?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-user-role": currentUserRole || "owner"
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Device logged out successfully! 🔒");
      } else {
        toast.error(data.error || "Failed to logout device");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to force logout");
    } finally {
      setRevokingSession(null);
      setConfirmModal(null);
    }
  };

  const handleLogoutAllDevices = async (userId: string) => {
    setRevokingAllUser(userId);
    try {
      let token = "";
      if (auth.currentUser) {
        try { token = await auth.currentUser.getIdToken(); } catch (e) {}
      }

      const res = await fetch(`/api/admin/sessions?userId=${encodeURIComponent(userId)}&all=true`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-user-role": currentUserRole || "owner"
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`All devices logged out! (${data.sessionsRevoked} sessions revoked) 🔒`);
      } else {
        toast.error(data.error || "Failed to logout all devices");
      }
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
    s.os?.toLowerCase().includes(searchTerm.toLowerCase())
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

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen pb-32 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="h-6 w-6 text-red-500" />
            Device Sessions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor and manage all logged-in devices across users</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Users className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-foreground">{sessions.length}</p>
            <p className="text-xs text-muted-foreground font-semibold">Total Sessions</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Wifi className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-500">{onlineCount}</p>
            <p className="text-xs text-muted-foreground font-semibold">Online</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-amber-500">{idleCount}</p>
            <p className="text-xs text-muted-foreground font-semibold">Idle</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <WifiOff className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-red-500">{offlineCount}</p>
            <p className="text-xs text-muted-foreground font-semibold">Offline</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by user, browser, or OS..."
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
              <p className="text-muted-foreground text-sm font-semibold">Loading device sessions...</p>
            </div>
          ) : Object.keys(userGroups).length === 0 ? (
            <div className="p-12 text-center">
              <Monitor className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm font-semibold">
                {searchTerm ? "No sessions match your search" : "No active sessions found"}
              </p>
              <p className="text-muted-foreground/60 text-xs mt-1">Sessions will appear here when users log in</p>
            </div>
          ) : (
            Object.entries(userGroups).map(([userId, userSessions]) => {
              const firstSession = userSessions[0];
              return (
                <div key={userId} className="p-4 md:p-5">
                  {/* User Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                        {(firstSession.userName || firstSession.userEmail || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground">{firstSession.userName || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{firstSession.userEmail}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${firstSession.role === 'admin_editor' || firstSession.role === 'owner' ? 'bg-red-500/10 text-red-600 border border-red-500/20' :
                          firstSession.role === 'admin_viewer' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' :
                          'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'}`}>
                        {firstSession.role === 'admin_editor' || firstSession.role === 'owner' ? 'Admin' :
                         firstSession.role === 'admin_viewer' ? 'Viewer' : 'Manager'}
                      </span>
                    </div>
                    {userSessions.length > 1 && (
                      <button
                        onClick={() => setConfirmModal({ type: "all", userId, userName: firstSession.userName })}
                        disabled={revokingAllUser === userId}
                        className="text-xs font-bold text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
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

                  {/* Device Cards */}
                  <div className="grid gap-2 ml-0 md:ml-12">
                    {userSessions.map((session) => {
                      const status = getSessionStatus(session.lastActiveAt);
                      const DeviceIcon = getDeviceIcon(session.deviceType);
                      const isRevoking = revokingSession === session.id;

                      return (
                        <motion.div
                          key={session.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                            status === "online"
                              ? "bg-emerald-500/5 border-emerald-500/15 dark:bg-emerald-950/20"
                              : status === "idle"
                              ? "bg-amber-500/5 border-amber-500/15 dark:bg-amber-950/20"
                              : "bg-slate-50 border-border dark:bg-slate-800/30"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`relative h-9 w-9 rounded-lg flex items-center justify-center ${
                              status === "online" ? "bg-emerald-500/10" :
                              status === "idle" ? "bg-amber-500/10" :
                              "bg-slate-200 dark:bg-slate-700"
                            }`}>
                              <DeviceIcon className={`h-4.5 w-4.5 ${
                                status === "online" ? "text-emerald-500" :
                                status === "idle" ? "text-amber-500" :
                                "text-slate-400"
                              }`} />
                              {/* Status dot */}
                              <div className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                status === "online" ? "bg-emerald-500" :
                                status === "idle" ? "bg-amber-500" :
                                "bg-slate-400"
                              }`} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                {session.browser || "Unknown Browser"}
                                <span className="text-xs text-muted-foreground font-normal">on</span>
                                {session.os || "Unknown OS"}
                              </p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                                  status === "online" ? "text-emerald-500" :
                                  status === "idle" ? "text-amber-500" :
                                  "text-slate-400"
                                }`}>
                                  {status === "online" ? "● Online" : status === "idle" ? "● Idle" : "● Offline"}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  Last active {parseTimeAgo(session.lastActiveAt)}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  Logged in {parseTimeAgo(session.loginAt)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setConfirmModal({ type: "single", sessionId: session.id, userName: session.userName })}
                            disabled={isRevoking}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                            title="Force Logout"
                          >
                            {isRevoking ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <LogOut className="h-4 w-4" />
                            )}
                          </button>
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

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-red-500/30 overflow-hidden"
            >
              <div className="p-4 border-b border-border bg-red-500/10 flex justify-between items-center">
                <h3 className="font-bold text-base flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  {confirmModal.type === "all" ? "Logout All Devices" : "Force Logout Device"}
                </h3>
                <button onClick={() => setConfirmModal(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-foreground">
                  {confirmModal.type === "all" ? (
                    <>Are you sure you want to log out <strong className="text-red-500">{confirmModal.userName || "this user"}</strong> from all devices? This will revoke all their active sessions and Firebase Auth tokens.</>
                  ) : (
                    <>Are you sure you want to force logout this device for <strong className="text-red-500">{confirmModal.userName || "this user"}</strong>? The user will be immediately signed out on that device.</>
                  )}
                </p>
                <p className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-border">
                  ⚠️ The user&apos;s Firebase Auth refresh tokens will be revoked. They will need to sign in again on the affected device(s).
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
                    className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2"
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
