"use client";

import React, { useState, useEffect } from "react";
import { db, messaging, dbService } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, FileText, Shield, Calendar, RefreshCw, LogOut } from "lucide-react";

export default function MasterCashierDashboard() {
  const router = useRouter();
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const session = localStorage.getItem("active_cashier_session");
    if (!session) {
      router.push("/cashier");
      return;
    }
    const user = JSON.parse(session);
    if (user.role !== "master") {
      router.push("/cashier");
      return;
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        setIsNotificationEnabled(true);
      }
    }

    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      // Fetch shift reports
      const reportsQuery = query(collection(db, "shift_reports"), orderBy("createdAt", "desc"), limit(10));
      const reportsSnap = await getDocs(reportsQuery);
      const reports = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id, _type: "shift_report" }));

      // Fetch voids
      const voidsQuery = query(collection(db, "void_requests"), orderBy("createdAt", "desc"), limit(10));
      const voidsSnap = await getDocs(voidsQuery);
      const voids = voidsSnap.docs.map(d => ({ ...d.data(), id: d.id, _type: "void_request" }));

      // Fetch expiries
      const expiriesQuery = query(collection(db, "expiries"), orderBy("createdAt", "desc"), limit(10));
      const expiriesSnap = await getDocs(expiriesQuery);
      const expiries = expiriesSnap.docs.map(d => ({ ...d.data(), id: d.id, _type: "expiry" }));

      const all = [...reports, ...voids, ...expiries];
      all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setFeed(all.slice(0, 30));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support notifications.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted" && messaging) {
        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const messagingInstance = await messaging;
        if (messagingInstance) {
          const token = await getToken(messagingInstance, { 
            vapidKey: "BHiDvLTbQ2DTED8p7X1BQ8Vu811fuu3dmpVfclmA5P7n-DuRltU7kkai9E2_2VkbLpS7Ns5ekNQClP5CsTeWf7M",
            serviceWorkerRegistration: swReg
          });
          if (token) {
            await dbService.setDoc("user_tokens", "master_youssef", {
              fcmToken: token,
              name: "Mr Youssef",
              role: "master",
              updatedAt: new Date().toISOString()
            });
            setIsNotificationEnabled(true);
            alert("Master Notifications enabled successfully!");
          }
        }
      } else {
        alert("Notification permission denied. Please enable in your device settings.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to enable notifications. Error: " + err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("active_cashier_session");
    router.push("/cashier");
  };

  if (loading) {
    return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-600"></div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      <header className="bg-red-600 text-white p-4 shadow-lg sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="font-black text-xl">Master Feed</h1>
          <p className="text-xs text-red-200">Global Activity Monitor</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleEnableNotifications} 
            className={`relative p-2 rounded-full transition-colors ${
              isNotificationEnabled 
                ? "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30" 
                : "bg-white/20 hover:bg-white/30"
            }`}
            title={isNotificationEnabled ? "Notifications On" : "Enable Notifications"}
          >
            <Bell className={`h-4 w-4 ${!isNotificationEnabled && "animate-pulse"}`} />
            {isNotificationEnabled && <span className="absolute top-0 right-0 w-2 h-2 bg-emerald-400 rounded-full border-2 border-red-600"></span>}
          </button>
          <button onClick={fetchFeed} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={handleLogout} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {feed.map((item, idx) => {
          const isExpanded = expandedId === item.id;
          
          if (item._type === "shift_report") {
            const shortOverage = (item.totalActualSales || 0) - (item.totalSystemSales || 0);
            return (
              <div key={item.id} onClick={() => setExpandedId(isExpanded ? null : item.id)} className="cursor-pointer bg-white dark:bg-slate-800 p-5 rounded-2xl shadow border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3">
                    <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl h-fit"><FileText className="h-6 w-6"/></div>
                    <div>
                      <p className="font-bold text-lg text-slate-900 dark:text-white">Shift Report: {item.cashierDetails?.name}</p>
                      <p className="text-sm font-medium text-slate-500">Store: {item.cashierDetails?.storeId} • Shift: {item.cashierDetails?.shift}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${item.status === 'pending_manager' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {item.status.replace("_", " ")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">System Sales</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{Number(item.totalSystemSales || 0).toLocaleString()} EGP</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Actual Drawer</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{Number(item.totalActualSales || 0).toLocaleString()} EGP</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Difference</p>
                    <p className={`font-bold ${shortOverage < 0 ? "text-red-500" : shortOverage > 0 ? "text-blue-500" : "text-emerald-500"}`}>
                      {shortOverage < 0 ? "-" : "+"}{Math.abs(shortOverage).toLocaleString()} EGP
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Total Drops</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{Number(item.safeDrops?.reduce((sum: number, drop: any) => sum + Number(drop.amount), 0) || 0).toLocaleString()} EGP</p>
                  </div>
                </div>
                {item.expenses && item.expenses.length > 0 && (
                  <div className="mt-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Expenses Logged:</span> {item.expenses.length} item(s) totaling {Number(item.expenses.reduce((sum: number, exp: any) => sum + Number(exp.amount), 0)).toLocaleString()} EGP
                  </div>
                )}
                
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 space-y-4 animate-in fade-in slide-in-from-top-2">
                    {/* Extra Details */}
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-2">Detailed Counts:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
                          <span className="text-slate-500">Cash:</span> {Number(item.cashierCounts?.cash || 0).toLocaleString()} EGP
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
                          <span className="text-slate-500">Visa:</span> {Number(item.cashierCounts?.visa || 0).toLocaleString()} EGP
                        </div>
                      </div>
                    </div>
                    
                    {item.expenses && item.expenses.length > 0 && (
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-2">Expenses Detail:</p>
                        <ul className="text-sm space-y-1">
                          {item.expenses.map((exp: any, i: number) => (
                            <li key={i} className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                              <span>{exp.reason}</span>
                              <span className="font-semibold">{Number(exp.amount).toLocaleString()} EGP</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {item.signature && (
                      <div className="mt-4">
                        <p className="text-xs text-slate-500 mb-1">Cashier Signature:</p>
                        <div className="bg-white border border-slate-200 p-2 rounded-lg inline-block">
                          <img src={item.signature} alt="Signature" className="h-16 object-contain" />
                        </div>
                      </div>
                    )}
                    
                    {item.managerAudit && (
                      <div className="mt-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-2">Manager Audit:</p>
                        <p className="text-sm">Audited By: {item.managerAudit.auditedBy}</p>
                        <p className="text-sm">Status: <span className={item.managerAudit.status === 'approved' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{item.managerAudit.status}</span></p>
                        {item.managerAudit.notes && <p className="text-sm mt-1 text-slate-600 italic">"{item.managerAudit.notes}"</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }
          if (item._type === "void_request") {
            return (
              <div key={item.id} onClick={() => setExpandedId(isExpanded ? null : item.id)} className="cursor-pointer bg-white dark:bg-slate-800 p-5 rounded-2xl shadow border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3">
                    <div className="bg-red-100 text-red-600 p-2.5 rounded-xl h-fit"><Shield className="h-6 w-6"/></div>
                    <div>
                      <p className="font-bold text-lg text-slate-900 dark:text-white">Void / Return: {item.cashierDetails?.name}</p>
                      <p className="text-sm font-medium text-slate-500">Store: {item.cashierDetails?.storeId} • Ref: {item.receiptNumber || 'N/A'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${item.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {item.status || "LOGGED"}
                  </span>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                  <p className="text-sm font-bold text-red-800 dark:text-red-300">Amount: {Number(item.amount || 0).toLocaleString()} EGP</p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1"><span className="font-semibold">Reason:</span> {item.reason || 'No reason provided'}</p>
                  {item.managerApproval && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                      ✓ Approved by Manager ({item.managerApproval})
                    </p>
                  )}
                </div>
                
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 space-y-4 animate-in fade-in slide-in-from-top-2">
                     <p className="text-sm text-slate-600 dark:text-slate-400">
                       <span className="font-semibold">Item Details:</span> {item.itemDetails || 'N/A'}
                     </p>
                     {item.signature && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-500 mb-1">Cashier Signature:</p>
                        <div className="bg-white border border-slate-200 p-2 rounded-lg inline-block">
                          <img src={item.signature} alt="Signature" className="h-12 object-contain" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }
          if (item._type === "expiry") {
            return (
              <div key={item.id} onClick={() => setExpandedId(isExpanded ? null : item.id)} className="cursor-pointer bg-white dark:bg-slate-800 p-5 rounded-2xl shadow border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3">
                    <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl h-fit"><Calendar className="h-6 w-6"/></div>
                    <div>
                      <p className="font-bold text-lg text-slate-900 dark:text-white">Expiry Logged: {item.productName}</p>
                      <p className="text-sm font-medium text-slate-500">Store: {item.storeId || item.branchId || 'Unknown'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider bg-orange-100 text-orange-700">
                    EXPIRED
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Quantity</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{item.quantity} units</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Estimated Value</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{Number(item.estimatedValue || (item.quantity * 2.50)).toLocaleString()} EGP</p>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 space-y-4 animate-in fade-in slide-in-from-top-2">
                     <p className="text-sm text-slate-600 dark:text-slate-400">
                       <span className="font-semibold">Expiry Date:</span> {item.expiryDate || 'N/A'}
                     </p>
                     <p className="text-sm text-slate-600 dark:text-slate-400">
                       <span className="font-semibold">Logged By:</span> {item.loggedBy || 'Unknown'}
                     </p>
                  </div>
                )}
              </div>
            );
          }
        })}
        {feed.length === 0 && <p className="text-center text-slate-500 mt-10">No recent activity.</p>}
      </main>
    </div>
  );
}
