"use client";

import React, { useState, useEffect, useCallback } from "react";
import { WifiOff, RefreshCw, CloudOff, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getPendingCount, getPendingWrites, removePendingWrite } from "@/lib/offline-sync";
import { collection, addDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB might not be available in SSR
    }
  }, []);

  // Sync all pending writes to Firestore
  const syncNow = useCallback(async () => {
    if (syncing || !navigator.onLine) return;
    setSyncing(true);

    try {
      const writes = await getPendingWrites();
      let synced = 0;

      for (const write of writes) {
        try {
          switch (write.operation) {
            case "addDoc":
              await addDoc(collection(db, write.collectionName), write.data);
              break;
            case "setDoc":
              if (write.docId) {
                await setDoc(doc(db, write.collectionName, write.docId), write.data);
              }
              break;
            case "updateDoc":
              if (write.docId) {
                await updateDoc(doc(db, write.collectionName, write.docId), write.data);
              }
              break;
          }
          if (write.id) {
            await removePendingWrite(write.id);
          }
          synced++;
        } catch (err) {
          console.error("Failed to sync write:", write, err);
          // Leave it in the queue for next attempt
        }
      }

      if (synced > 0) {
        toast.success(`تم مزامنة ${synced} عملية بنجاح!`);
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3000);
      }
    } catch (err) {
      console.error("Sync failed:", err);
      toast.error("فشلت المزامنة. سيتم المحاولة مرة أخرى.");
    } finally {
      setSyncing(false);
      refreshCount();
    }
  }, [syncing, refreshCount]);

  useEffect(() => {
    // Initial state
    setIsOffline(!navigator.onLine);
    refreshCount();

    const goOnline = () => {
      setIsOffline(false);
      // Auto-sync when connection returns
      setTimeout(() => syncNow(), 1500);
    };
    const goOffline = () => setIsOffline(true);
    const queueChanged = () => refreshCount();

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("offline-queue-changed", queueChanged);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("offline-queue-changed", queueChanged);
    };
  }, [refreshCount, syncNow]);

  // Don't render anything if we're online with no pending writes and didn't just sync
  if (!isOffline && pendingCount === 0 && !justSynced) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="fixed top-0 left-0 right-0 z-[100] print:hidden"
      >
        <div
          className={`flex items-center justify-between px-4 py-2.5 text-sm font-bold text-white shadow-lg ${
            justSynced
              ? "bg-emerald-500"
              : isOffline
              ? "bg-gradient-to-r from-orange-500 to-amber-500"
              : pendingCount > 0
              ? "bg-gradient-to-r from-blue-600 to-indigo-600"
              : "bg-emerald-500"
          }`}
        >
          <div className="flex items-center gap-2">
            {justSynced ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : isOffline ? (
              <WifiOff className="h-4 w-4 animate-pulse" />
            ) : syncing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <CloudOff className="h-4 w-4" />
            )}
            <span>
              {justSynced
                ? "تمت المزامنة بنجاح! ✓"
                : isOffline
                ? "⚡ وضع عدم الاتصال — البيانات تُحفظ محلياً"
                : syncing
                ? "جاري المزامنة..."
                : `${pendingCount} عملية في انتظار المزامنة`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {pendingCount > 0 && !isOffline && !syncing && (
              <button
                onClick={syncNow}
                className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs font-black transition-colors"
              >
                مزامنة الآن
              </button>
            )}
            {pendingCount > 0 && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black">
                {pendingCount}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
