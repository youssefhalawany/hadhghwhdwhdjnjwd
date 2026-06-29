"use client";

import React, { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShieldAlert, Search, Filter, Clock, User, HardDrive, Smartphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranch } from "@/context/BranchContext";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { currentBranch } = useBranch(); // Kept for layout context if needed

  useEffect(() => {
    // Fetch latest 100 audit logs
    const q = query(
      collection(db, "audit_logs"),
      orderBy("timestamp", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(logsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(log => {
    const search = searchQuery.toLowerCase();
    return (
      (log.userEmail || "").toLowerCase().includes(search) ||
      (log.userName || "").toLowerCase().includes(search) ||
      (log.action || "").toLowerCase().includes(search)
    );
  });

  const getActionColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("delete") || act.includes("reject") || act.includes("failed")) return "text-red-600 bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-900";
    if (act.includes("create") || act.includes("add") || act.includes("approve") || act.includes("success")) return "text-green-600 bg-green-100 border-green-200 dark:bg-green-900/30 dark:border-green-900";
    if (act.includes("update") || act.includes("edit")) return "text-blue-600 bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:border-blue-900";
    return "text-slate-600 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300";
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-border pb-4 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-indigo-600" />
            <h1 className="text-3xl font-black text-foreground tracking-tight">Security Audit Log</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 ml-10">Monitor all critical system actions, logins, and settings changes.</p>
        </div>
        <div className="relative min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by user, email, or action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 p-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-black tracking-wider border-b border-border">
                <tr>
                  <th className="p-4 rounded-tl-2xl w-48">Timestamp</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Action</th>
                  <th className="p-4 hidden md:table-cell">Context / Changes</th>
                  <th className="p-4 rounded-tr-2xl text-right">Device/IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <ShieldAlert className="h-10 w-10 text-muted-foreground/30" />
                        <p className="font-medium text-base">No audit logs found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const date = new Date(log.timestamp);
                    const formattedDate = !isNaN(date.getTime()) ? date.toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                    }) : "Unknown Date";

                    return (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="font-mono text-xs">{formattedDate}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{log.userName || "System"}</span>
                            <span className="text-[10px] text-muted-foreground">{log.userEmail || "N/A"}</span>
                            {log.role && (
                              <span className="inline-block px-1.5 py-0.5 mt-1 bg-muted text-muted-foreground text-[9px] font-bold uppercase rounded border border-border w-fit">
                                {log.role}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          <div className="max-w-xs space-y-1">
                            {log.previousValue && log.previousValue !== "undefined" && log.previousValue !== "null" && (
                              <div className="text-[10px] bg-red-500/10 text-red-700 dark:text-red-400 p-1.5 rounded truncate font-mono border border-red-500/20">
                                <span className="font-bold uppercase mr-1 opacity-70">From:</span>
                                {log.previousValue}
                              </div>
                            )}
                            {log.newValue && log.newValue !== "undefined" && log.newValue !== "null" && (
                              <div className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400 p-1.5 rounded truncate font-mono border border-green-500/20">
                                <span className="font-bold uppercase mr-1 opacity-70">To:</span>
                                {log.newValue}
                              </div>
                            )}
                            {(!log.previousValue || log.previousValue === "undefined") && (!log.newValue || log.newValue === "undefined") && (
                              <span className="text-xs text-muted-foreground italic">No details</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex flex-col items-end gap-1 text-muted-foreground">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono bg-muted px-2 py-1 rounded">
                              <HardDrive className="h-3 w-3" />
                              {log.ip}
                            </div>
                            {log.device && (
                              <div className="flex items-center gap-1 text-[9px] max-w-[120px] truncate" title={log.device}>
                                <Smartphone className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{log.device}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
