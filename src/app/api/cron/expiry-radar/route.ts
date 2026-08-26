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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(today.getDate() + 15);
    fifteenDaysFromNow.setHours(23, 59, 59, 999);

    const expiriesSnap = await db.collection("expiries").get();
    
    const upcomingExpiries: any[] = [];
    const expiredItems: any[] = [];
    
    expiriesSnap.forEach(doc => {
      const data = doc.data();
      if (["pulled", "audited", "pending_return", "returned", "damaged", "sold", "removed", "resolved"].includes(data.status || "")) return;
      if (!data.expiryDate) return;

      const expDate = new Date(data.expiryDate);
      expDate.setHours(0, 0, 0, 0);

      if (expDate <= today) {
        expiredItems.push({
          id: doc.id,
          itemName: data.itemName || "Product",
          qty: data.quantity || 1,
          expiryDate: data.expiryDate,
          supplier: data.supplier || data.vendorName || "Supplier",
          batchId: data.batchId || "N/A"
        });
      } else if (expDate <= fifteenDaysFromNow) {
        upcomingExpiries.push({
          id: doc.id,
          itemName: data.itemName || "Product",
          qty: data.quantity || 1,
          expiryDate: data.expiryDate,
          supplier: data.supplier || data.vendorName || "Supplier",
          batchId: data.batchId || "N/A"
        });
      }
    });

    if (upcomingExpiries.length === 0 && expiredItems.length === 0) {
      return NextResponse.json({ success: true, message: "No items expiring within 15 days or expired." });
    }

    // Format clean professional notification summary
    let title = "";
    let body = "";

    if (expiredItems.length > 0) {
      const sampleExpired = expiredItems.slice(0, 2).map(i => `${i.itemName} (x${i.qty})`).join(', ');
      title = `🚨 تنبيه سحب فوري: ${expiredItems.length} صنف منتهي الصلاحية!`;
      body = `يوجد ${expiredItems.length} صنف منتهي (${sampleExpired}${expiredItems.length > 2 ? '...' : ''}). يلزم السحب الفوري من الرف.`;
    } else {
      const sampleSoon = upcomingExpiries.slice(0, 2).map(i => `${i.itemName} (x${i.qty})`).join(', ');
      title = `⚠️ رادار الصلاحيات: ${upcomingExpiries.length} صنف ينتهي خلال 15 يوماً`;
      body = `${upcomingExpiries.length} صنف يقترب من الانتهاء (${sampleSoon}${upcomingExpiries.length > 2 ? '...' : ''}). يرجى تنشيط المبيعات أو تجهيز المرتجع للمورد.`;
    }

    const targetUrl = "/products/expiries-audit";

    // Fetch Master & Manager FCM Tokens
    const tokensSnap = await db.collection("user_tokens").get();
    let sentFcmCount = 0;

    for (const doc of tokensSnap.docs) {
      const fcmToken = doc.data()?.fcmToken;
      if (fcmToken) {
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
          sentFcmCount++;
        } catch (err) {
          console.error("FCM dispatch error for token:", err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      expiringCount: upcomingExpiries.length,
      expiredCount: expiredItems.length,
      fcmSentCount: sentFcmCount,
      upcoming: upcomingExpiries,
      expired: expiredItems
    });

  } catch (error: any) {
    console.error("Expiry Radar failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
