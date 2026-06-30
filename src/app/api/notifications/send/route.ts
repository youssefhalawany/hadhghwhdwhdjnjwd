import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export async function POST(request: Request) {
  try {
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
        return NextResponse.json({ error: "Firebase Admin Initialization Failed: " + error.message }, { status: 500 });
      }
    }

    const { tokens, title, body } = await request.json();

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0 || !title || !body) {
      return NextResponse.json(
        { error: 'Missing tokens array, title, or body' },
        { status: 400 }
      );
    }

    // Send a message to the devices corresponding to the provided tokens.
    const message = {
      notification: {
        title: title,
        body: body,
      },
      webpush: {
        notification: {
          icon: '/icon.png', // Assuming we have an icon here or standard red branding
          badge: '/icon.png',
          requireInteraction: true,
          data: {
            url: "https://hadhghwhdwhdjnjwd.vercel.app/cashier"
          }
        },
        fcmOptions: {
          link: "https://hadhghwhdwhdjnjwd.vercel.app/cashier"
        }
      },
      tokens: tokens, // Note: tokens array for multicast
    };

    const response = await getMessaging().sendEachForMulticast(message);
    
    return NextResponse.json({ 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount 
    });
  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}
