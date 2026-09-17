"use client";

import React, { useState, useEffect } from "react";
import { dbService } from "@/lib/firebase";
import { Send, Bell, Smartphone, Monitor, Shield, AlertCircle, CheckCircle, CheckSquare, Square, RefreshCw } from "lucide-react";

interface DeviceRecord {
  id: string;
  fcmToken?: string;
  name: string;
  email?: string;
  role: string;
  appType: "manager" | "cashier";
  deviceType?: string;
  branchId?: string;
  hasToken: boolean;
}

export default function NotificationsSenderPage() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"managers" | "all">("managers");
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const tokensData = await dbService.getDocs("user_tokens");
      const mapped: DeviceRecord[] = [];

      (tokensData as any[]).forEach(t => {
        const role = (t.role || "").toLowerCase();
        const isCashier = role === "cashier";
        const cleanToken = typeof t.fcmToken === "string" && t.fcmToken.trim().length > 10 ? t.fcmToken.trim() : undefined;

        mapped.push({
          id: t.id,
          name: t.name || t.email?.split("@")[0] || (isCashier ? "Cashier Terminal" : "Manager Device"),
          email: t.email,
          role: t.role || (isCashier ? "cashier" : "manager"),
          appType: isCashier ? "cashier" : "manager",
          deviceType: t.deviceType || "mobile",
          branchId: t.branchId,
          fcmToken: cleanToken,
          hasToken: !!cleanToken
        });
      });

      setDevices(mapped);

      // Default selection: select ALL active Manager PWA devices
      const activeManagerTokens = mapped
        .filter(d => d.appType === "manager" && d.hasToken && d.fcmToken)
        .map(d => d.fcmToken as string);
      setSelectedTokens(activeManagerTokens);
    } catch (err) {
      console.error("Failed to fetch devices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const managerDevices = devices.filter(d => d.appType === "manager");
  const cashierDevices = devices.filter(d => d.appType === "cashier");
  const displayedDevices = activeTab === "managers" ? managerDevices : devices;
  const activeDisplayedWithTokens = displayedDevices.filter(d => d.hasToken && d.fcmToken);

  const toggleToken = (token: string) => {
    setSelectedTokens(prev => 
      prev.includes(token) ? prev.filter(t => t !== token) : [...prev, token]
    );
  };

  const toggleAllInView = () => {
    const viewTokens = activeDisplayedWithTokens.map(d => d.fcmToken!);
    const allSelected = viewTokens.every(t => selectedTokens.includes(t));
    if (allSelected) {
      setSelectedTokens(prev => prev.filter(t => !viewTokens.includes(t)));
    } else {
      setSelectedTokens(prev => Array.from(new Set([...prev, ...viewTokens])));
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTokens.length === 0 || !title || !message) {
      setStatus({ type: "error", text: "Please select at least one recipient and enter both Title and Message." });
      return;
    }

    setSending(true);
    setStatus(null);

    try {
      // Determine if cashiers are among the selected tokens
      const containsCashier = cashierDevices.some(c => c.fcmToken && selectedTokens.includes(c.fcmToken));
      const targetRoles = containsCashier ? ["manager", "admin", "admin_editor", "admin_viewer", "owner", "cashier"] : ["manager", "admin", "admin_editor", "admin_viewer", "owner"];

      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens: selectedTokens,
          title: title.trim(),
          body: message.trim(),
          targetRoles
        })
      });

      const result = await response.json();

      if (response.ok) {
        setStatus({ type: "success", text: `Broadcast delivered successfully to ${result.successCount} Manager PWA device(s)!` });
        setTitle("");
        setMessage("");
      } else {
        setStatus({ type: "error", text: result.error || "Failed to send notification." });
      }
    } catch (err: any) {
      setStatus({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setSending(false);
    }
  };

  const handleSendQuickTest = async () => {
    const managerTokens = managerDevices.filter(d => d.hasToken && d.fcmToken).map(d => d.fcmToken!);
    if (managerTokens.length === 0) {
      setStatus({ type: "error", text: "No active Manager PWA devices available for quick test." });
      return;
    }

    setSending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens: managerTokens,
          title: "Test Alert / إشعار تجريبي",
          body: "Official ANH Manager PWA push notification operational test.",
          targetRoles: ["manager", "admin", "admin_editor", "admin_viewer", "owner"]
        })
      });
      const result = await response.json();
      if (response.ok) {
        setStatus({ type: "success", text: `Quick test sent to ${result.successCount} Manager device(s)! Check your phones.` });
      } else {
        setStatus({ type: "error", text: result.error || "Quick test failed." });
      }
    } catch (err: any) {
      setStatus({ type: "error", text: err.message || "Quick test error." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-lg border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-red-500/10 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Bell className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black mb-1 flex items-center gap-2">
              ANH Manager Portal Notifications
            </h1>
            <p className="text-slate-400 text-sm font-medium">Broadcast alerts and operational updates strictly to Manager PWA devices.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSendQuickTest}
          disabled={sending}
          className="relative z-10 bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-black px-4 py-2.5 rounded-xl border border-white/10 transition-all flex items-center gap-2"
        >
          <Bell className="h-4 w-4 text-red-400" /> Send Quick Manager Test
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Compose Card */}
        <div className="md:col-span-2 glass-panel p-8 rounded-2xl border border-border shadow-sm hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <h2 className="text-xl font-black mb-6 flex items-center gap-2 border-b border-border/50 pb-4">
            <Send className="h-5 w-5 text-red-500" /> Compose Manager Broadcast
          </h2>
          
          <form onSubmit={handleSend} className="space-y-6">
            <div>
              {/* Filter Tabs */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("managers")}
                    className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all ${
                      activeTab === "managers"
                        ? "bg-red-600 text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🏢 Manager PWA ({managerDevices.filter(d => d.hasToken).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("all")}
                    className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all ${
                      activeTab === "all"
                        ? "bg-red-600 text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All Devices ({devices.filter(d => d.hasToken).length})
                  </button>
                </div>

                <button 
                  type="button" 
                  onClick={toggleAllInView}
                  className="text-xs text-red-600 hover:text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full transition-colors"
                >
                  {activeDisplayedWithTokens.every(d => selectedTokens.includes(d.fcmToken!)) ? "Deselect Group" : "Select Group"}
                </button>
              </div>
              
              {/* Recipient List */}
              <div className="max-h-60 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2 space-y-1 custom-scrollbar shadow-inner">
                {loading ? (
                  <div className="p-4 text-sm font-bold text-slate-400 text-center animate-pulse">Scanning registered devices...</div>
                ) : displayedDevices.length === 0 ? (
                  <div className="p-4 text-sm font-bold text-slate-400 text-center">No devices found in this category.</div>
                ) : (
                  displayedDevices.map(device => {
                    const isSelected = device.fcmToken ? selectedTokens.includes(device.fcmToken) : false;
                    return (
                      <div 
                        key={device.id} 
                        onClick={() => device.fcmToken && toggleToken(device.fcmToken)}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                          !device.hasToken
                            ? 'opacity-40 cursor-not-allowed bg-transparent'
                            : isSelected
                            ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 shadow-sm' 
                            : 'hover:bg-white dark:hover:bg-slate-800 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {device.hasToken ? (
                            isSelected ? (
                              <CheckSquare className="h-5 w-5 text-red-600 flex-shrink-0" />
                            ) : (
                              <Square className="h-5 w-5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                            )
                          ) : (
                            <Square className="h-5 w-5 text-slate-200 dark:text-slate-800 flex-shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-black ${isSelected ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>
                                {device.name}
                              </span>
                              {device.appType === "manager" ? (
                                <span className="text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full uppercase">
                                  Manager PWA
                                </span>
                              ) : (
                                <span className="text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full uppercase">
                                  Cashier App
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {device.email || (device.role ? `Role: ${device.role}` : "")}
                              {device.branchId && ` • Branch: ${device.branchId}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {device.hasToken ? (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                              Online
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              No Token
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Selected: <strong className="text-foreground">{selectedTokens.length}</strong> device(s). Manager alerts are delivered directly to the ANH Manager PWA.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 block">Notification Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Urgent: End-of-Day Safe Audit"
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm font-medium outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all shadow-inner"
                />
              </div>

              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 block">Message Body</label>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={4}
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm font-medium outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all resize-none shadow-inner custom-scrollbar"
                ></textarea>
              </div>
            </div>

            {status && (
              <div className={`p-4 rounded-xl text-sm font-bold border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 ${
                status.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50' 
                  : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50'
              }`}>
                {status.type === 'success' ? <CheckCircle className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
                {status.text}
              </div>
            )}

            <button 
              type="submit" 
              disabled={sending || selectedTokens.length === 0}
              className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black py-4 rounded-xl transition-all hover:shadow-xl hover:shadow-red-500/20 disabled:opacity-50 disabled:hover:shadow-none flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {sending ? (
                <div className="flex items-center gap-2 animate-pulse">
                  <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                  Broadcasting...
                </div>
              ) : (
                <>
                  <Send className="h-5 w-5" /> Broadcast to Selected Manager Devices
                </>
              )}
            </button>
          </form>
        </div>

        {/* Sidebar Network Status */}
        <div className="glass-panel p-8 rounded-2xl border border-border h-fit shadow-sm hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <h2 className="text-xl font-black flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" /> Device Network
            </h2>
            <button
              onClick={fetchDevices}
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh device statuses"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-xs font-black uppercase text-muted-foreground tracking-wider block mb-2">
                Manager Devices ({managerDevices.filter(d => d.hasToken).length} online)
              </span>
              <ul className="space-y-2">
                {managerDevices.map(d => (
                  <li key={d.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-bold">
                    <div className="flex items-center gap-2 truncate">
                      <Smartphone className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <span className="truncate">{d.name}</span>
                    </div>
                    {d.hasToken ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black">ACTIVE</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold">NO TOKEN</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <span className="text-xs font-black uppercase text-muted-foreground tracking-wider block mb-2">
                Cashier POS ({cashierDevices.filter(d => d.hasToken).length} online)
              </span>
              <ul className="space-y-2">
                {cashierDevices.map(d => (
                  <li key={d.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-bold">
                    <div className="flex items-center gap-2 truncate">
                      <Monitor className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <span className="truncate">{d.name}</span>
                    </div>
                    {d.hasToken ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black">ACTIVE</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold">NO TOKEN</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
