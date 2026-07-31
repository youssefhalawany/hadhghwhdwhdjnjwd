import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

if (!getApps().length) {
  try {
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
    if (privateKey) {
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export async function GET() {
  return handleExpiryRadar();
}

export async function POST() {
  return handleExpiryRadar();
}

async function handleExpiryRadar() {
  try {
    const db = getFirestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);
    sevenDaysFromNow.setHours(23, 59, 59, 999);

    const expiriesSnap = await db.collection("expiries").get();
    
    const upcomingExpiries: any[] = [];
    
    expiriesSnap.forEach(doc => {
      const data = doc.data();
      if (data.status === "removed" || data.status === "resolved") return;
      if (!data.expiryDate) return;

      const expDate = new Date(data.expiryDate);
      if (expDate >= today && expDate <= sevenDaysFromNow) {
        upcomingExpiries.push({
          id: doc.id,
          itemName: data.itemName || "Product",
          qty: data.quantity || 1,
          expiryDate: data.expiryDate,
          supplier: data.supplier || "Supplier"
        });
      }
    });

    if (upcomingExpiries.length === 0) {
      return NextResponse.json({ success: true, message: "No items expiring within 7 days." });
    }

    // Format clean professional notification summary
    const itemCount = upcomingExpiries.length;
    const sampleItems = upcomingExpiries.slice(0, 3).map(i => `${i.itemName} (x${i.qty})`).join(', ');
    const title = `⚠️ 7-Day Expiry Radar — ${itemCount} Item${itemCount > 1 ? 's' : ''} Expiring Soon`;
    const body = `${itemCount} product${itemCount > 1 ? 's' : ''} expiring within 7 days at Circle K (${sampleItems}${itemCount > 3 ? '...' : ''}). Put on discount or schedule supplier return.`;
    const targetUrl = "/admin/product-lookup";

    // Fetch Master FCM Token
    const masterDoc = await db.collection("user_tokens").doc("master_youssef").get();
    let sentFcm = false;

    if (masterDoc.exists && masterDoc.data()?.fcmToken) {
      const fcmToken = masterDoc.data()?.fcmToken;
      try {
        await getMessaging().send({
          token: fcmToken,
          notification: { title, body },
          data: { title, body, url: targetUrl },
          webpush: {
            headers: { Urgency: "high" },
            notification: {
              title,
              body,
              icon: "/icon-manager.png",
              badge: "/icons8-circled-k-50.png",
              requireInteraction: true,
              renotify: true,
              tag: `expiry-radar-${Date.now()}`,
              data: { url: targetUrl }
            }
          }
        });
        sentFcm = true;
      } catch (err) {
        console.error("FCM dispatch error:", err);
      }
    }

    return NextResponse.json({
      success: true,
      expiringCount: itemCount,
      fcmSent: sentFcm,
      items: upcomingExpiries
    });

  } catch (error: any) {
    console.error("Expiry Radar failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
