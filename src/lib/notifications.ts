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
 * Sends in-app document to Firestore `notifications` collection,
 * broadcasts FCM system push notification to ALL registered phones/devices (cashier + manager),
 * and dispatches Ibrahim AI WhatsApp & FCM notification!
 */
export async function dispatchNotificationSystem(payload: SystemNotificationPayload) {
  const { title, body, type = "system", url = "/", metadata = {} } = payload;

  try {
    // 1. Store in Firestore 'notifications' collection for in-app drawer
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

  // 2. Broadcast System Push Notification to ALL registered phones/devices via FCM Multicast
  fetch("/api/notifications/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, url }),
  }).catch(err => console.error("Error broadcasting push notification:", err));

  // 3. Dispatch Ibrahim AI Notification (WhatsApp + Master FCM)
  fetch("/api/notifications/notify-master", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body }),
  }).catch(err => console.error("Error sending Ibrahim notification:", err));
}
