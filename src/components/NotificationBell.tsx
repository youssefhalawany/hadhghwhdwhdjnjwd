"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, Clock, X, ChevronRight, AlertCircle, Trash2 } from "lucide-react";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { AnimatePresence, motion } from "framer-motion";

interface NotificationBellProps {
  buttonClassName?: string;
}

export default function NotificationBell({ buttonClassName }: NotificationBellProps) {
  const { currentBranch } = useBranch();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [isOpen, setIsOpen] = useState(false);
  const [pendingShiftCount, setPendingShiftCount] = useState(0);
  const [pendingVoidCount, setPendingVoidCount] = useState(0);
  const [pendingExpiriesCount, setPendingExpiriesCount] = useState(0);
  const [pendingReturnsCount, setPendingReturnsCount] = useState(0);
  const [pendingOosCount, setPendingOosCount] = useState(0);
  const [systemNotifications, setSystemNotifications] = useState<any[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Firestore listeners
  useEffect(() => {
    let unsubscribeShifts: (() => void) | null = null;
    let unsubscribeVoids: (() => void) | null = null;
    let unsubscribeExpiries: (() => void) | null = null;
    let unsubscribeReturns: (() => void) | null = null;
    let unsubscribeOos: (() => void) | null = null;
    let unsubscribeSystemNotifs: (() => void) | null = null;

    if (currentBranch) {
      // 1. Shifts
      const shiftQ = currentBranch === "all"
        ? query(collection(db, "shift_reports"), where("status", "in", ["pending", "pending_manager"]), limit(50))
        : query(collection(db, "shift_reports"), where("status", "in", ["pending", "pending_manager"]), where("branchId", "==", currentBranch), limit(50));

      unsubscribeShifts = onSnapshot(shiftQ, (snap) => {
        setPendingShiftCount(snap.docs.length);
      }, (err) => console.log("Shift notif err", err));

      // 2. Voids
      const voidQ = currentBranch === "all"
        ? query(collection(db, "void_requests"), where("status", "==", "pending"), limit(50))
        : query(collection(db, "void_requests"), where("status", "==", "pending"), where("branchId", "==", currentBranch), limit(50));

      unsubscribeVoids = onSnapshot(voidQ, (snap) => {
        setPendingVoidCount(snap.docs.length);
      }, (err) => console.log("Void notif err", err));

      // 3. Expiries
      const expiriesQ = query(collection(db, "expiries"), where("status", "==", "pulled"), limit(50));
      unsubscribeExpiries = onSnapshot(expiriesQ, (snap) => {
        let count = 0;
        snap.docs.forEach(dDoc => {
          const d = dDoc.data();
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
      }, (err) => console.log("Expiries notif err", err));

      // 4. Returns
      const returnsQ = query(collection(db, "supplier_returns"), where("status", "in", ["pending", "returned"]), limit(50));
      unsubscribeReturns = onSnapshot(returnsQ, (snap) => {
        let count = 0;
        snap.docs.forEach(dDoc => {
          const d = dDoc.data();
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
      }, (err) => console.log("Returns notif err", err));

      // 5. Out of Stock
      const oosQ = query(collection(db, "out_of_stock_logs"), where("resolved", "==", false), limit(50));
      unsubscribeOos = onSnapshot(oosQ, (snap) => {
        let count = 0;
        snap.docs.forEach(dDoc => {
          const d = dDoc.data();
          if (currentBranch === "all") {
            count++;
          } else {
            const inferred = (d.branchId || "alamein4").toLowerCase();
            if (inferred === currentBranch) count++;
          }
        });
        setPendingOosCount(count);
      }, (err) => console.log("OOS notif err", err));

      // 6. System Notifications
      const notifQ = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(50));
      unsubscribeSystemNotifs = onSnapshot(notifQ, (snap) => {
        let notifs = snap.docs.map(dDoc => ({ id: dDoc.id, ...dDoc.data() as any }));
        if (currentBranch !== "all") {
          notifs = notifs.filter((n: any) => {
            const sId = (n.storeId || n.branchId || "").toLowerCase();
            const inferred = sId.includes("ola") || sId.includes("koronfol") ? "ola" : "alamein4";
            return inferred === currentBranch;
          });
        }
        setSystemNotifications(notifs.filter((n: any) => n.read === false));
      }, (err) => console.log("System notif err", err));
    }

    return () => {
      if (unsubscribeShifts) unsubscribeShifts();
      if (unsubscribeVoids) unsubscribeVoids();
      if (unsubscribeExpiries) unsubscribeExpiries();
      if (unsubscribeReturns) unsubscribeReturns();
      if (unsubscribeOos) unsubscribeOos();
      if (unsubscribeSystemNotifs) unsubscribeSystemNotifs();
    };
  }, [currentBranch]);

  const totalNotifications = 
    systemNotifications.length + 
    pendingShiftCount + 
    pendingVoidCount + 
    pendingExpiriesCount + 
    pendingReturnsCount + 
    pendingOosCount;

  const handleClearAll = async () => {
    try {
      const batchPromises = systemNotifications.map(notif => 
        updateDoc(doc(db, "notifications", notif.id), { read: true })
      );
      await Promise.all(batchPromises);
      setIsOpen(false);
    } catch (e) {
      console.error("Failed to clear notifications", e);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef} dir={isAr ? "rtl" : "ltr"}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={
          buttonClassName ||
          "relative p-2 rounded-xl transition-all bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white cursor-pointer flex items-center justify-center shadow-sm"
        }
        title={isAr ? "التنبيهات" : "Notifications"}
        aria-label="Notifications"
      >
        <Bell className={`h-4 w-4 ${totalNotifications > 0 ? "animate-pulse text-rose-500" : "text-slate-300"}`} />
        {totalNotifications > 0 && (
          <span className="absolute -top-1 -right-1 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-lg bg-rose-600 border border-[#09090b] min-w-[18px] text-center leading-tight">
            {totalNotifications}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute mt-2 w-80 sm:w-88 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col bg-zinc-950/95 backdrop-blur-2xl border border-white/10 ${
              isAr ? "left-0 sm:left-auto right-0 sm:right-auto" : "right-0"
            }`}
            style={{
              maxHeight: "calc(100vh - 120px)"
            }}
          >
            {/* Header */}
            <div className="p-3.5 font-black text-sm flex justify-between items-center bg-white/[0.03] border-b border-white/[0.08] text-white">
              <div className="flex items-center gap-2">
                <span>{isAr ? "التنبيهات" : "Notifications"}</span>
                <span className="text-white text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600">
                  {totalNotifications}
                </span>
              </div>
              {systemNotifications.length > 0 && (
                <button 
                  onClick={handleClearAll}
                  className="text-[10px] font-bold transition-colors px-2 py-1 rounded-lg cursor-pointer text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/20 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{isAr ? "مسح الكل" : "Clear All"}</span>
                </button>
              )}
            </div>

            {/* Notification Items List */}
            <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-white/[0.05]">
              {totalNotifications === 0 ? (
                <div className="p-8 text-center text-xs font-semibold text-zinc-400 flex flex-col items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span>{isAr ? "لا توجد تنبيهات جديدة! كافة العمليات مكتملة" : "All caught up! No pending alerts."}</span>
                </div>
              ) : (
                <>
                  {/* System Notifications */}
                  {systemNotifications.length > 0 && (
                    <div className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider bg-white/[0.02] text-zinc-400">
                      {isAr ? "إجراءات حديثة" : "Recent Actions"}
                    </div>
                  )}
                  {systemNotifications.map((notif) => (
                    <Link
                      key={notif.id}
                      href={notif.link || "/"}
                      onClick={async () => {
                        setIsOpen(false);
                        try {
                          await updateDoc(doc(db, "notifications", notif.id), { read: true });
                        } catch (e) {
                          console.error("Error marking read", e);
                        }
                      }}
                      className="block p-3.5 transition-colors bg-rose-500/5 hover:bg-rose-500/10 text-start"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-xs font-extrabold capitalize flex items-center gap-2 text-white">
                          <span className="w-2 h-2 rounded-full inline-block animate-pulse bg-rose-500"></span>
                          {notif.type || "System"} Update
                        </p>
                        <span className="text-[10px] font-medium text-zinc-400">
                          {new Date(notif.createdAt?.toDate ? notif.createdAt.toDate() : Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-zinc-300">{notif.message}</p>
                    </Link>
                  ))}

                  {/* Pending Approvals Section */}
                  {(pendingShiftCount > 0 || pendingVoidCount > 0 || pendingReturnsCount > 0 || pendingExpiriesCount > 0 || pendingOosCount > 0) && (
                    <div className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider bg-white/[0.02] text-zinc-400">
                      {isAr ? "في انتظار الاعتماد والمتابعة" : "Pending Approvals"}
                    </div>
                  )}

                  {/* 1. Supplier Returns */}
                  {pendingReturnsCount > 0 && (
                    <Link 
                      href="/dashboard/supplier-returns" 
                      onClick={() => setIsOpen(false)} 
                      className="block p-3.5 transition-colors hover:bg-white/[0.04] text-start group"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-extrabold text-white group-hover:text-rose-400 transition-colors">
                          {isAr ? "مرتجعات الموردين" : "Supplier Returns"}
                        </p>
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          {pendingReturnsCount}
                        </span>
                      </div>
                      <p className="text-xs font-semibold mt-0.5 text-zinc-400">
                        {isAr ? `${pendingReturnsCount} إيصالات مرتجع قيد التسوية.` : `${pendingReturnsCount} returns pending settlement.`}
                      </p>
                    </Link>
                  )}

                  {/* 2. Expiry Audits */}
                  {pendingExpiriesCount > 0 && (
                    <Link 
                      href="/products/expiries-audit" 
                      onClick={() => setIsOpen(false)} 
                      className="block p-3.5 transition-colors hover:bg-white/[0.04] text-start group"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-extrabold text-white group-hover:text-amber-400 transition-colors">
                          {isAr ? "جرد الصلاحيات" : "Expiry Audits"}
                        </p>
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {pendingExpiriesCount}
                        </span>
                      </div>
                      <p className="text-xs font-semibold mt-0.5 text-zinc-400">
                        {isAr ? `${pendingExpiriesCount} سجلات صلاحية تحتاج مراجعة.` : `${pendingExpiriesCount} audits require review.`}
                      </p>
                    </Link>
                  )}

                  {/* 3. Shift Reports */}
                  {pendingShiftCount > 0 && (
                    <Link 
                      href="/shift-reports/manager" 
                      onClick={() => setIsOpen(false)} 
                      className="block p-3.5 transition-colors hover:bg-white/[0.04] text-start group"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-extrabold text-white group-hover:text-blue-400 transition-colors">
                          {isAr ? "مراجعة الورديات" : "Shift Audits"}
                        </p>
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {pendingShiftCount}
                        </span>
                      </div>
                      <p className="text-xs font-semibold mt-0.5 text-zinc-400">
                        {isAr ? `${pendingShiftCount} ورديات تنتظر اعتماد المدير.` : `${pendingShiftCount} pending shifts require approval.`}
                      </p>
                    </Link>
                  )}

                  {/* 4. Voids & Returns */}
                  {pendingVoidCount > 0 && (
                    <Link 
                      href="/voids/manager" 
                      onClick={() => setIsOpen(false)} 
                      className="block p-3.5 transition-colors hover:bg-white/[0.04] text-start group"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-extrabold text-white group-hover:text-orange-400 transition-colors">
                          {isAr ? "إلغاءات ومرتجعات المبيعات" : "Voids & Returns"}
                        </p>
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          {pendingVoidCount}
                        </span>
                      </div>
                      <p className="text-xs font-semibold mt-0.5 text-zinc-400">
                        {isAr ? `${pendingVoidCount} طلبات تراجع تحتاج مراجعة.` : `${pendingVoidCount} requests require review.`}
                      </p>
                    </Link>
                  )}

                  {/* 5. Out of Stock Logs */}
                  {pendingOosCount > 0 && (
                    <Link 
                      href="/products/oos-tracker" 
                      onClick={() => setIsOpen(false)} 
                      className="block p-3.5 transition-colors hover:bg-white/[0.04] text-start group"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-extrabold text-white group-hover:text-red-400 transition-colors">
                          {isAr ? "النواقص والنفاد" : "Out of Stock Logs"}
                        </p>
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                          {pendingOosCount}
                        </span>
                      </div>
                      <p className="text-xs font-semibold mt-0.5 text-zinc-400">
                        {isAr ? `${pendingOosCount} أصناف منتهية قيد المتابعة.` : `${pendingOosCount} items logged as out of stock.`}
                      </p>
                    </Link>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
