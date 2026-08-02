import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';

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

    const { tokens: inputTokens, title, body, url = "/financials/inputs", branchId } = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: 'Missing title or body' },
        { status: 400 }
      );
    }

    let targetTokens: string[] = Array.isArray(inputTokens) && inputTokens.length > 0 ? inputTokens : [];

    const isTokenBranchMatched = (data: any, notifBranchId?: string) => {
      if (!notifBranchId || notifBranchId === "all") return true;
      const role = (data.role || "").toLowerCase();
      if (role === "owner" || role === "admin" || role === "master") return true;
      
      const notifNorm = (notifBranchId.toLowerCase().includes("ola") || notifBranchId.toLowerCase().includes("koronfol")) ? "ola" : "alamein4";
      const userBranchId = (data.branchId || data.storeId || "").toLowerCase();
      const userStoreIds: string[] = Array.isArray(data.storeIds) ? data.storeIds.map((s: any) => String(s).toLowerCase()) : [];

      if (!userBranchId && userStoreIds.length === 0) {
        return false; // Do not send by default if manager token has no branch info
      }

      const matchesOla = userBranchId.includes("ola") || userBranchId.includes("koronfol") || userStoreIds.some(s => s.includes("ola") || s.includes("koronfol"));
      const matchesAlamein = userBranchId.includes("alamein") || userBranchId.includes("4") || userStoreIds.some(s => s.includes("alamein") || s.includes("4"));

      if (notifNorm === "ola") return matchesOla;
      if (notifNorm === "alamein4") return matchesAlamein;

      return false;
    };

    // If no tokens were explicitly provided, query all registered FCM tokens from user_tokens and users collections
    if (targetTokens.length === 0) {
      try {
        const adminDb = getFirestore();
        const [tokensSnap, usersSnap] = await Promise.all([
          adminDb.collection('user_tokens').get(),
          adminDb.collection('users').get()
        ]);

        tokensSnap.forEach((doc) => {
          if (doc.id === "master_youssef" || doc.id === "manager") return;
          const data = doc.data();
          if (data.fcmToken && typeof data.fcmToken === 'string' && isTokenBranchMatched(data, branchId)) {
            targetTokens.push(data.fcmToken);
          }
        });

        usersSnap.forEach((doc) => {
          const data = doc.data();
          if (isTokenBranchMatched(data, branchId)) {
            if (data.fcmToken && typeof data.fcmToken === 'string') {
              targetTokens.push(data.fcmToken);
            }
            if (Array.isArray(data.fcmTokens)) {
              data.fcmTokens.forEach((t: any) => {
                if (t && typeof t === 'string') targetTokens.push(t);
              });
            }
          }
        });
      } catch (err) {
        console.error("Error fetching FCM tokens from Firestore:", err);
      }
    }

    // De-duplicate tokens
    targetTokens = Array.from(new Set(targetTokens));

    if (targetTokens.length === 0) {
      return NextResponse.json({ success: true, message: 'No device tokens available for broadcast', successCount: 0 });
    }

    // Send a message to the devices corresponding to targetTokens.
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        title: title,
        body: body,
        url: url
      },
      webpush: {
        notification: {
          title: title,
          body: body,
          icon: '/icon-manager.png',
          badge: '/icons8-circled-k-50.png',
          requireInteraction: true,
          data: {
            url: url
          }
        },
        fcmOptions: {
          link: url
        }
      },
      tokens: targetTokens,
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
