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

export async function POST(req: Request) {
  try {
    const { balance, storeName = "Circle K", threshold = 15000 } = await req.json();

    const safeAmount = Number(balance || 0);
    if (safeAmount < threshold) {
      return NextResponse.json({ success: true, message: `Balance EGP ${safeAmount} is below threshold EGP ${threshold}.` });
    }

    const title = `💸 Safe Cash Overflow Alert — EGP ${safeAmount.toLocaleString()}`;
    const body = `Safe cash balance at ${storeName} is EGP ${safeAmount.toLocaleString()} (Exceeds EGP ${threshold.toLocaleString()} threshold). Please schedule a bank deposit.`;
    const targetUrl = "/financials/inputs/deposits";

    const db = getFirestore();
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
              tag: `safe-overflow-${Date.now()}`,
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
      balance: safeAmount,
      threshold,
      fcmSent: sentFcm
    });

  } catch (error: any) {
    console.error("Safe overflow alert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
