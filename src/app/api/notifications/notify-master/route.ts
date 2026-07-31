import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { title, body, url } = await req.json();

    if (!title || !body) {
      return NextResponse.json({ error: "Missing title or body" }, { status: 400 });
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

    const targetUrl = url || "https://hadhghwhdwhdjnjwd.vercel.app/shift-reports/manager";

    // --- Ibrahim AI Refinement for Operations ---
    let finalTitle = title;
    let finalBody = body;

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
      const prompt = `You are Ibrahim, the executive operations manager assistant for Circle K Egypt (مساعد مدير المبيعات والعمليات).
      A system alert occurred:
      Title: ${title}
      Details: ${body}

      Rewrite this notification into a crisp, highly detailed, professional alert message.
      Include essential numbers/names (amounts in EGP, receipt numbers, cashier names, or branch names if mentioned).
      Make it sound urgent, clear, and professional for the Manager's phone lock screen.
      Output ONLY the rewritten message body in 1-2 clear sentences. Do not add quotes, titles, or greetings.`;
      
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini timeout")), 4000));
      const result = await Promise.race([model.generateContent(prompt), timeoutPromise]) as any;
      
      const text = result.response?.text()?.trim();
      if (text) {
        finalBody = text;
      }
    } catch (aiError) {
      console.log("AI notification format fallback used:", aiError);
    }
    // --------------------------------------------

    // High Priority Push Message Payload (Lock Screen Display Enabled)
    const fcmPromise = fcmToken ? getMessaging().send({
      token: fcmToken,
      notification: { 
        title: finalTitle, 
        body: finalBody 
      },
      data: {
        title: finalTitle,
        body: finalBody,
        url: targetUrl
      },
      webpush: {
        headers: {
          Urgency: "high",
          TTL: "86400"
        },
        notification: {
          title: finalTitle,
          body: finalBody,
          icon: "/icon-manager.png",
          badge: "/icons8-circled-k-50.png",
          requireInteraction: true,
          renotify: true,
          tag: `circlek-alert-${Date.now()}`,
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
              title: finalTitle,
              body: finalBody
            },
            sound: "default",
            badge: 1
          }
        }
      }
    }) : Promise.resolve(null);

    const sendWhatsApp = async () => {
      try {
        const phone = encodeURIComponent("+201011212003");
        const apikey = "3367979";
        const waText = encodeURIComponent(`*${finalTitle}*\n${finalBody}`);
        const callMeBotUrl = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${waText}&apikey=${apikey}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const res = await fetch(callMeBotUrl, {
          method: "GET",
          cache: "no-store",
          headers: { "User-Agent": "Mozilla/5.0 (Node.js)" },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          console.error("WhatsApp Error:", await res.text());
        }
      } catch (e) {
        console.error("WhatsApp notification failed or timed out", e);
      }
    };

    const [fcmResult] = await Promise.allSettled([fcmPromise, sendWhatsApp()]);

    return NextResponse.json({ 
      success: true, 
      fcmStatus: fcmResult.status === 'fulfilled' ? 'sent' : 'failed'
    });

  } catch (error: any) {
    console.error('Error sending master notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
