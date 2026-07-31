import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export interface SystemNotificationPayload {
  title: string;
  body: string;
  type?: "shift" | "payment" | "credit" | "deposit" | "expiry" | "void" | "cleaning" | "out_of_stock" | "system";
  url?: string;
  metadata?: Record<string, any>;
}

/**
 * Universal System Notification Dispatcher
 * Stores in-app document in Firestore `notifications` collection
 * and triggers EXACTLY ONE high-priority push notification (+ WhatsApp) to the manager portal!
 */
export async function dispatchNotificationSystem(payload: SystemNotificationPayload) {
  const { title, body, type = "system", url = "/", metadata = {} } = payload;

  try {
    // 1. Store in Firestore 'notifications' collection for in-app bell drawer
    await addDoc(collection(db, "notifications"), {
      title,
      body,
      message: body,
      type,
      url,
      read: false,
      createdAt: serverTimestamp(),
      timestamp: new Date().toISOString(),
      ...metadata
    });
  } catch (err) {
    console.error("Error creating Firestore notification document:", err);
  }

  // 2. Dispatch SINGLE High-Priority Push Notification via notify-master
  fetch("/api/notifications/notify-master", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, url }),
  }).catch(err => console.error("Error sending push notification:", err));
}
