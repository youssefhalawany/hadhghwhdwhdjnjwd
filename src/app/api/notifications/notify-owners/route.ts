import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, message, url, priority = "normal" } = body;

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
    });

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, message: 'No devices registered' });
    }

    const payload = {
      notification: {
        title,
        body: message,
      },
      data: {
        url: url || '/owner',
        priority
      },
      tokens: Array.from(new Set(tokens)), // Remove duplicates
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
