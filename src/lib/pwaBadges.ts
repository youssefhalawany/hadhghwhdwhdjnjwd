"use client";

/**
 * Updates the native OS PWA App Icon Badge count.
 * Supported on iOS 16.4+ (standalone mode) and Chrome/Edge on Android/Desktop.
 */
export function updateAppBadge(count: number) {
  if (typeof window === "undefined") return;
  
  try {
    if ("setAppBadge" in navigator) {
      if (count > 0) {
        (navigator as any).setAppBadge(count).catch((err: any) => {
          console.debug("App badge set failed:", err);
        });
      } else {
        (navigator as any).clearAppBadge().catch((err: any) => {
          console.debug("App badge clear failed:", err);
        });
      }
    }
  } catch (e) {
    console.debug("PWA Badging API not supported", e);
  }
}

/**
 * Triggers a native Web Push Notification with action buttons if permissions are granted.
 */
export async function sendManagerInteractiveNotification(
  title: string,
  body: string,
  dataUrl: string = "/shift-reports/manager"
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        reg.showNotification(title, {
          body,
          icon: "/icon-manager.png",
          badge: "/icons/icon-192x192.png",
          vibrate: [200, 100, 200],
          data: { url: dataUrl },
          actions: [
            { action: "approve", title: "⚡ Review Now" },
            { action: "dismiss", title: "Dismiss" }
          ]
        } as any);
      } else {
        new Notification(title, { body, icon: "/icon-manager.png" });
      }
    } catch (e) {
      console.error("Failed to show notification", e);
    }
  }
}

/**
 * Triggers short haptic vibration on mobile devices
 */
export function triggerHapticFeedback(pattern: number | number[] = 12) {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Haptics not supported or blocked
    }
  }
}
