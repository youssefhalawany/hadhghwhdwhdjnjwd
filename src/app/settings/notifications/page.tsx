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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
          <Bell className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Push Notifications</h1>
          <p className="text-muted-foreground text-sm">Send real-time alerts to specific cashiers or all devices.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass-panel p-6 rounded-xl border border-border">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Send className="h-4 w-4 text-red-500" /> Compose Message
          </h2>
          
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-muted-foreground uppercase block">Select Recipients ({selectedTokens.length})</label>
                <button 
                  type="button" 
                  onClick={toggleAll}
                  className="text-xs text-red-500 hover:text-red-400 font-bold"
                >
                  {selectedTokens.length === availableCashiers.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              
              <div className="max-h-48 overflow-y-auto bg-muted/50 border border-border rounded-lg p-2 space-y-1">
                {loading ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">Loading cashiers...</div>
                ) : availableCashiers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">No devices registered for notifications yet.</div>
                ) : (
                  availableCashiers.map(cashier => (
                    <div 
                      key={cashier.id} 
                      onClick={() => cashier.fcmToken && toggleToken(cashier.fcmToken)}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${selectedTokens.includes(cashier.fcmToken!) ? 'bg-red-500/10' : 'hover:bg-muted'}`}
                    >
                      {selectedTokens.includes(cashier.fcmToken!) ? (
                        <CheckSquare className="h-4 w-4 text-red-500" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{cashier.name}</span>
                        {cashier.storeId && <span className="text-[10px] text-muted-foreground">Store: {cashier.storeId}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Notification Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Urgent: Shift Update"
                className="w-full bg-muted/50 border border-border rounded-lg p-3 text-sm outline-none focus:border-red-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Message Body</label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter the notification message..."
                rows={4}
                className="w-full bg-muted/50 border border-border rounded-lg p-3 text-sm outline-none focus:border-red-500 transition-colors resize-none"
              ></textarea>
            </div>

            {status && (
              <div className={`p-3 rounded-lg text-sm border flex items-center gap-2 ${status.type === 'success' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {status.text}
              </div>
            )}

            <button 
              type="submit" 
              disabled={sending || selectedTokens.length === 0}
              className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold py-3 rounded-lg transition-all hover:scale-[1.01] shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {sending ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Send Notification
                </>
              )}
            </button>
          </form>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border h-fit">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-red-500" /> Staff Status
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading status...</p>
          ) : (
            <ul className="space-y-3">
              {cashiers.map((c) => (
                <li key={c.id} className="text-sm flex items-center justify-between bg-muted/50 p-2 rounded-lg border border-border">
                  <span className="font-medium truncate mr-2">{c.name}</span>
                  {c.hasToken ? (
                    <span className="text-[10px] font-bold bg-green-500/20 text-green-500 px-2 py-1 rounded-full whitespace-nowrap">Active</span>
                  ) : (
                    <span className="text-[10px] font-bold bg-red-500/20 text-red-500 px-2 py-1 rounded-full whitespace-nowrap">Offline</span>
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
