import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { audioChimes } from "@/lib/audio-chimes";

export interface SystemNotificationPayload {
  title: string;
  body: string;
  type?: "shift" | "payment" | "credit" | "deposit" | "expiry" | "void" | "cleaning" | "out_of_stock" | "system";
  url?: string;
  branchId?: string;
  branchName?: string;
  metadata?: Record<string, any>;
}

export function getBranchDisplayName(branchId?: string): string {
  if (!branchId) return "";
  const b = branchId.toLowerCase();
  if (b.includes("ola") || b.includes("koronfol")) return "Ola El Koronfol";
  if (b.includes("alamein") || b.includes("4")) return "El Alamein 4";
  return branchId;
}

/**
 * Universal System Notification Dispatcher
 * Stores in-app document in Firestore `notifications` collection,
 * plays distinct Web Audio operational chime, and triggers push notification!
 */
export async function dispatchNotificationSystem(payload: SystemNotificationPayload) {
  const { title, body, type = "system", url = "/", branchId: inputBranchId, branchName: inputBranchName, metadata = {} } = payload;

  const resolvedBranchId = inputBranchId || metadata?.branchId || metadata?.storeId || "alamein4";
  const resolvedBranchName = inputBranchName || metadata?.branchName || getBranchDisplayName(resolvedBranchId);

  // Prepend Branch Name to Title/Body if not already included
  let formattedTitle = title;
  let formattedBody = body;
  if (resolvedBranchName && !formattedTitle.includes(resolvedBranchName) && !formattedBody.includes(resolvedBranchName)) {
    formattedTitle = `[${resolvedBranchName}] ${title}`;
  }

  // Play distinct audio chime for notification type
  try {
    audioChimes.playByType(type);
  } catch (e) {}

  try {
    // 1. Store in Firestore 'notifications' collection for in-app bell drawer
    await addDoc(collection(db, "notifications"), {
      title: formattedTitle,
      body: formattedBody,
      message: formattedBody,
      type,
      url,
      branchId: resolvedBranchId,
      branchName: resolvedBranchName,
      storeId: metadata?.storeId || (resolvedBranchId === "ola" ? "ola-el-koronfol" : "eL-alamein-4"),
      read: false,
      createdAt: serverTimestamp(),
      timestamp: new Date().toISOString(),
      ...metadata
    });
  } catch (err) {
    console.error("Error creating Firestore notification document:", err);
  }

  // 2. Dispatch High-Priority Push Notifications filtered by branch
  Promise.allSettled([
    fetch("/api/notifications/notify-master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: formattedTitle, body: formattedBody, url, branchId: resolvedBranchId, branchName: resolvedBranchName }),
    }),
    fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: formattedTitle, body: formattedBody, url, branchId: resolvedBranchId, branchName: resolvedBranchName }),
    })
  ]).catch(err => console.error("Error sending push notification broadcast:", err));
}
