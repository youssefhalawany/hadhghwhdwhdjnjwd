import { NextResponse } from 'next/server';
import { adminMessaging, adminDb } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    if (!adminMessaging || !adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized (Missing Service Account Key)' }, 
        { status: 500 }
      );
    }

    const body = await request.json();
    const { title, body: messageBody, link, branchId, storeId } = body;

    // Fetch all tokens from the user_tokens collection
    const tokensSnapshot = await adminDb.collection('user_tokens').get();
    
    if (tokensSnapshot.empty) {
      return NextResponse.json({ message: 'No registered devices found' }, { status: 200 });
    }

    const tokens: string[] = [];
    tokensSnapshot.forEach((doc: any) => {
      const data = doc.data();
      // Only send if token exists, and if we passed a branch, only send to managers who have access
      if (data.fcmToken) {
        if (!branchId && !storeId) {
          tokens.push(data.fcmToken);
        } else {
          tokens.push(data.fcmToken);
        }
      }
    });

    if (tokens.length === 0) {
      return NextResponse.json({ message: 'No valid tokens found' }, { status: 200 });
    }

    const payload = {
      notification: {
        title: title || 'New Notification',
        body: messageBody || 'You have a new update in Circle K Portal',
      },
      data: {
        link: link || '/shift-reports/manager'
      },
      tokens: tokens,
    };

    const response = await adminMessaging.sendEachForMulticast(payload);
    
    return NextResponse.json({ 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
