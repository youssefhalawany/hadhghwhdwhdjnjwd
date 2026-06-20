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
          {!isNotificationEnabled && (
            <button onClick={handleEnableNotifications} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors">
              <Bell className="h-4 w-4" />
            </button>
          )}
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
          if (item._type === "shift_report") {
            return (
              <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg h-fit"><FileText className="h-5 w-5"/></div>
                    <div>
                      <p className="font-bold">Shift Report: {item.cashierDetails?.name}</p>
                      <p className="text-sm text-slate-500">Store: {item.cashierDetails?.storeId} • Shift: {item.cashierDetails?.shift}</p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${item.status === 'pending_manager' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            );
          }
          if (item._type === "void_request") {
            return (
              <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="bg-red-100 text-red-600 p-2 rounded-lg h-fit"><Shield className="h-5 w-5"/></div>
                    <div>
                      <p className="font-bold">Void/Return: {item.cashierDetails?.name}</p>
                      <p className="text-sm text-slate-500">Store: {item.cashierDetails?.storeId} • Ref: {item.receiptNumber}</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">Amt: {item.amount} • {item.reason}</p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          if (item._type === "expiry") {
            return (
              <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="bg-orange-100 text-orange-600 p-2 rounded-lg h-fit"><Calendar className="h-5 w-5"/></div>
                    <div>
                      <p className="font-bold">Expiry Logged: {item.productName}</p>
                      <p className="text-sm text-slate-500">Store: {item.storeId} • Qty: {item.quantity}</p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
        })}
        {feed.length === 0 && <p className="text-center text-slate-500 mt-10">No recent activity.</p>}
      </main>
    </div>
  );
}
