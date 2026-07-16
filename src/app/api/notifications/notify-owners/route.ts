import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
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

    const db = admin.firestore();
    const usersSnapshot = await db.collection('users').where('role', 'in', ['owner', 'admin_editor', 'admin_viewer']).get();
    
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

    const response = await admin.messaging().sendEachForMulticast(payload);
    
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
