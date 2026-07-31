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
    const body = await req.json();
    const { title, message, url, priority = "high" } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Missing title or message' }, { status: 400 });
    }

    const db = getFirestore();
    const usersSnapshot = await db.collection('users').get();
    
    const tokens: string[] = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
        tokens.push(...data.fcmTokens);
      }
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    // Also fetch from user_tokens collection
    const userTokensSnap = await db.collection('user_tokens').get();
    userTokensSnap.forEach(doc => {
      const data = doc.data();
      if (data.fcmToken) tokens.push(data.fcmToken);
    });

    const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));

    if (uniqueTokens.length === 0) {
      return NextResponse.json({ success: true, message: 'No devices registered' });
    }

    const targetUrl = url || '/owner';

    const payload = {
      notification: {
        title,
        body: message,
      },
      data: {
        title,
        body: message,
        url: targetUrl,
        priority
      },
      webpush: {
        headers: {
          Urgency: "high",
          TTL: "86400"
        },
        notification: {
          title,
          body: message,
          icon: "/icon-manager.png",
          badge: "/icons8-circled-k-50.png",
          requireInteraction: true,
          renotify: false,
          tag: "circlek-owner-alert",
          data: { url: targetUrl }
        },
        fcmOptions: {
          link: targetUrl
        }
      },
      apns: {
        headers: {
          "apns-priority": "10"
        },
        payload: {
          aps: {
            alert: {
              title,
              body: message
            },
            sound: "default",
            badge: 1
          }
        }
      },
      tokens: uniqueTokens,
    };

    const response = await getMessaging().sendEachForMulticast(payload);
    
    return NextResponse.json({ 
      success: true, 
      sentCount: response.successCount,
      failedCount: response.failureCount 
    });

  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
