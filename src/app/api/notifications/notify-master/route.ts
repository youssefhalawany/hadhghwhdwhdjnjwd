import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const { title, body } = await req.json();

    if (!title || !body) {
      return NextResponse.json({ error: "Missing title or body" }, { status: 400 });
    }

    // Send WhatsApp via CallMeBot FIRST to guarantee it fires
    try {
      const phone = "201011212003";
      const apikey = "3367979";
      const waText = encodeURIComponent(`*${title}*\n${body}`);
      const callMeBotUrl = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${waText}&apikey=${apikey}`;
      await fetch(callMeBotUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Node.js)"
        }
      });
    } catch (e) {
      console.error("WhatsApp notification failed", e);
    }

    // Initialize Firebase Admin if not already initialized
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
      } catch (error: any) {
        console.error('Firebase admin initialization error', error);
        // We log the error but DO NOT return here, so that we don't crash before attempting FCM
        // If FCM fails, it will be caught by the outer catch block
      }
    }


    // Get Master FCM Token
    const adminDb = getFirestore();
    const masterDoc = await adminDb.collection("user_tokens").doc("master_youssef").get();
    
    if (!masterDoc.exists) {
      return NextResponse.json({ error: "Master token not found" }, { status: 404 });
    }

    const { fcmToken } = masterDoc.data() as any;

    if (!fcmToken) {
      return NextResponse.json({ error: "Master FCM token is empty" }, { status: 404 });
    }

    const response = await getMessaging().send({
      token: fcmToken,
      notification: {
        title,
        body,
      },
    });

    return NextResponse.json({ success: true, response });

  } catch (error: any) {
    console.error('Error sending master notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
