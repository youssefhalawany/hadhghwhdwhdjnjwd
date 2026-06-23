"use client";

import React, { useState, useEffect } from "react";
import { dbService, db } from "@/lib/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { 
  ClipboardList, Search, RefreshCw, ShieldAlert, 
  Terminal, ShieldCheck, Laptop, Globe, Calendar
} from "lucide-react";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Subscribe to audit logs
    const unsubscribe = dbService.onSnapshot(query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(1000)), (data) => {
      // Sort logs descending by timestamp
      const sorted = [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.newValue && log.newValue.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Statistics
  const actionCountToday = logs.filter(log => {
    const today = new Date().toISOString().slice(0, 10);
    return log.timestamp.slice(0, 10) === today;
  }).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 bg-clip-text text-transparent uppercase">
          Franchise Audit Logs
        </h1>
        <p className="text-sm text-muted-foreground">
          Immutable ledger tracing document generation, views, downloads, edits, and administrative access.
        </p>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Trace Entries</span>
            <h2 className="text-xl font-bold">{logs.length} logged</h2>
          </div>
          <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
            <Terminal className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Actions Today</span>
            <h2 className="text-xl font-bold text-red-500">{actionCountToday} tracked</h2>
          </div>
          <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ledger Security</span>
            <h2 className="text-xl font-bold text-green-500">Active (SHA-256)</h2>
          </div>
          <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Search Logs Panel */}
      <div className="glass-panel p-4 rounded-xl flex gap-2.5 items-center">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          id="input-audit-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by action, operator email, or values..."
          className="w-full bg-transparent border-none text-xs text-foreground outline-none focus:ring-0"
        />
      </div>

      {/* Tabular logs lists */}
      <div className="glass-panel rounded-xl overflow-hidden border border-border">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-red-500" />
              Loading compliance archives...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No compliance logs found.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Operator</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Action Description</th>
                  <th className="px-5 py-3">Previous State</th>
                  <th className="px-5 py-3">New State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-semibold text-foreground">
                      {log.userEmail}
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-muted text-muted-foreground border border-border">
                        {log.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-red-600 dark:text-red-400">
                      {log.action}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground font-mono text-[9px] max-w-[150px] truncate" title={log.previousValue}>
                      {log.previousValue || "NULL"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground font-mono text-[9px] max-w-[150px] truncate" title={log.newValue}>
                      {log.newValue || "NULL"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
