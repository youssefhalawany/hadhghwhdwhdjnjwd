"use client";

import React, { useState, useEffect } from "react";
import { dbService } from "@/lib/firebase";
import { Send, Bell, Users, AlertCircle, CheckCircle, CheckSquare, Square } from "lucide-react";

interface UserToken {
  id: string;
  fcmToken: string;
  email?: string;
  updatedAt?: string;
}

interface Cashier {
  id: string;
  employeeId: string;
  name: string;
  storeId?: string;
}

interface CashierWithToken extends Cashier {
  fcmToken?: string;
  hasToken: boolean;
}

export default function NotificationsSenderPage() {
  const [cashiers, setCashiers] = useState<CashierWithToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error", text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch both collections
        const [tokensData, cashiersData] = await Promise.all([
          dbService.getDocs("user_tokens"),
          dbService.getDocs("cashiers")
        ]);

        const tokens = tokensData as UserToken[];
        const rawCashiers = cashiersData as Cashier[];

        // Map cashiers to their tokens. We assume the user_tokens.id (Firebase Auth UID)
        // matches the cashier.employeeId. If it matches the cashier.id instead, we check both.
        const mappedCashiers: CashierWithToken[] = rawCashiers.map(cashier => {
          const tokenRecord = tokens.find(t => t.id === cashier.employeeId || t.id === cashier.id);
          return {
            ...cashier,
            fcmToken: tokenRecord?.fcmToken,
            hasToken: !!tokenRecord?.fcmToken
          };
        });

        // Also add any tokens that don't match a cashier (e.g. Managers/Owners)
        // so they can still be notified.
        tokens.forEach(t => {
          const exists = mappedCashiers.some(c => c.employeeId === t.id || c.id === t.id);
          if (!exists) {
            mappedCashiers.push({
              id: t.id,
              employeeId: t.id,
              name: t.email || "Unknown User",
              hasToken: true,
              fcmToken: t.fcmToken
            });
          }
        });

        setCashiers(mappedCashiers);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const availableCashiers = cashiers.filter(c => c.hasToken && c.fcmToken);

  const toggleToken = (token: string) => {
    setSelectedTokens(prev => 
      prev.includes(token) ? prev.filter(t => t !== token) : [...prev, token]
    );
  };

  const toggleAll = () => {
    if (selectedTokens.length === availableCashiers.length) {
      setSelectedTokens([]);
    } else {
      setSelectedTokens(availableCashiers.map(c => c.fcmToken as string));
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTokens.length === 0 || !title || !message) {
      setStatus({ type: "error", text: "Please select at least one recipient and fill out all fields." });
      return;
    }

    setSending(true);
    setStatus(null);

    try {
      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens: selectedTokens,
          title: title,
          body: message
        })
      });

      const result = await response.json();

      if (response.ok) {
        setStatus({ type: "success", text: `Notification sent successfully to ${result.successCount} devices!` });
        setTitle("");
        setMessage("");
        setSelectedTokens([]);
      } else {
        setStatus({ type: "error", text: result.error || "Failed to send notification." });
      }
    } catch (err: any) {
      setStatus({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-lg border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-red-500/10 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Bell className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black mb-1">Push Notifications</h1>
            <p className="text-slate-400 font-medium">Broadcast real-time alerts instantly to cashier devices.</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass-panel p-8 rounded-2xl border border-border shadow-sm hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <h2 className="text-xl font-black mb-6 flex items-center gap-2 border-b border-border/50 pb-4">
            <Send className="h-5 w-5 text-red-500" /> Compose Broadcast
          </h2>
          
          <form onSubmit={handleSend} className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest block">Select Recipients ({selectedTokens.length})</label>
                <button 
                  type="button" 
                  onClick={toggleAll}
                  className="text-xs text-red-600 hover:text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full transition-colors"
                >
                  {selectedTokens.length === availableCashiers.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              
              <div className="max-h-56 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2 space-y-1 custom-scrollbar shadow-inner">
                {loading ? (
                  <div className="p-4 text-sm font-bold text-slate-400 text-center animate-pulse">Scanning registered devices...</div>
                ) : availableCashiers.length === 0 ? (
                  <div className="p-4 text-sm font-bold text-slate-400 text-center">No active devices found.</div>
                ) : (
                  availableCashiers.map(cashier => (
                    <div 
                      key={cashier.id} 
                      onClick={() => cashier.fcmToken && toggleToken(cashier.fcmToken)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        selectedTokens.includes(cashier.fcmToken!) 
                          ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 shadow-sm' 
                          : 'hover:bg-white dark:hover:bg-slate-800 border border-transparent'
                      }`}
                    >
                      {selectedTokens.includes(cashier.fcmToken!) ? (
                        <CheckSquare className="h-5 w-5 text-red-600" />
                      ) : (
                        <Square className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                      )}
                      <div className="flex flex-col">
                        <span className={`text-sm font-black ${selectedTokens.includes(cashier.fcmToken!) ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>
                          {cashier.name}
                        </span>
                        {cashier.storeId && <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Store: {cashier.storeId}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 block">Notification Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Urgent: Price Update"
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
                {status.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
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
                  <Send className="h-5 w-5" /> Broadcast to Devices
                </>
              )}
            </button>
          </form>
        </div>

        <div className="glass-panel p-8 rounded-2xl border border-border h-fit shadow-sm hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <h2 className="text-xl font-black mb-6 flex items-center gap-2 border-b border-border/50 pb-4">
            <Users className="h-5 w-5 text-blue-500" /> Device Network
          </h2>
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="h-6 w-6 rounded-full border-2 border-slate-300 border-t-slate-800 animate-spin"></div>
            </div>
          ) : (
            <ul className="space-y-3">
              {cashiers.map((c) => (
                <li key={c.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 transition-colors hover:border-slate-300 dark:hover:border-slate-700">
                  <span className="text-sm font-bold truncate mr-2">{c.name}</span>
                  {c.hasToken ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2.5 py-1 rounded-md uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[10px] font-black bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 rounded-md uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> Offline
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
