import { NextResponse } from 'next/server';
import { getAdminApp, getAdminDb, getAdminMessaging } from '@/lib/firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
  try {
    getAdminApp();
    const adminMessaging = getAdminMessaging();
    const adminDb = getAdminDb();

    const bodyData = await request.json();
    const { 
      tokens: inputTokens, 
      title, 
      body: rawBody, 
      message: altBody,
      url = "/financials/inputs", 
      branchId,
      branchName,
      type = "system",
      tag: inputTag,
      enableAi = false
    } = bodyData;

    const messageBody = rawBody || altBody;

    if (!title || !messageBody) {
      return NextResponse.json(
        { error: 'Missing title or body/message' },
        { status: 400 }
      );
    }

    // Deterministic tag to collapse duplicate alerts into ONE notification card on device
    const notificationTag = inputTag || `circlek-${type || 'alert'}`;
    const targetUrl = url || "/financials/inputs";

    // Track token sources: token -> array of { col: string, docId: string, isArray: boolean }
    const tokenSourceMap = new Map<string, Array<{ col: string; docId: string; isArray: boolean }>>();

    const isTokenBranchMatched = (data: any, docId: string, notifBranchId?: string) => {
      if (!notifBranchId || notifBranchId === "all") return true;
      const role = (data.role || "").toLowerCase();
      const docIdLower = docId.toLowerCase();
      const email = (data.email || "").toLowerCase();

      // Owners, admins, and master accounts ALWAYS receive alerts regardless of branch
      if (
        role === "owner" || 
        role === "admin" || 
        role === "admin_editor" || 
        role === "admin_viewer" || 
        role === "master" || 
        docIdLower === "master_youssef" || 
        docIdLower.includes("master") || 
        email.includes("youssef")
      ) {
        return true;
      }

      const userBranchId = (data.branchId || data.storeId || "").toLowerCase();
      const userStoreIds: string[] = Array.isArray(data.storeIds) ? data.storeIds.map((s: any) => String(s).toLowerCase()) : [];

      // If no branch assigned, do not discard manager phones
      if (!userBranchId && userStoreIds.length === 0) {
        return true;
      }

      const notifNorm = (notifBranchId.toLowerCase().includes("ola") || notifBranchId.toLowerCase().includes("koronfol")) ? "ola" : "alamein4";
      const matchesOla = userBranchId.includes("ola") || userBranchId.includes("koronfol") || userStoreIds.some(s => s.includes("ola") || s.includes("koronfol"));
      const matchesAlamein = userBranchId.includes("alamein") || userBranchId.includes("4") || userStoreIds.some(s => s.includes("alamein") || s.includes("4"));

      if (notifNorm === "ola") return matchesOla;
      if (notifNorm === "alamein4") return matchesAlamein;

      return true;
    };

    let targetTokens: string[] = [];

    if (Array.isArray(inputTokens) && inputTokens.length > 0) {
      targetTokens = inputTokens.filter(t => typeof t === 'string' && t.trim().length > 10);
    } else {
      try {
        const [tokensSnap, usersSnap] = await Promise.all([
          adminDb.collection('user_tokens').get(),
          adminDb.collection('users').get()
        ]);

        tokensSnap.forEach((doc) => {
          const data = doc.data();
          if (isTokenBranchMatched(data, doc.id, branchId)) {
            if (data.fcmToken && typeof data.fcmToken === 'string' && data.fcmToken.trim().length > 10) {
              const tok = data.fcmToken.trim();
              targetTokens.push(tok);
              if (!tokenSourceMap.has(tok)) tokenSourceMap.set(tok, []);
              tokenSourceMap.get(tok)!.push({ col: 'user_tokens', docId: doc.id, isArray: false });
            }
            if (Array.isArray(data.tokens)) {
              data.tokens.forEach((tok: any) => {
                if (tok && typeof tok === 'string' && tok.trim().length > 10) {
                  const cleanTok = tok.trim();
                  targetTokens.push(cleanTok);
                  if (!tokenSourceMap.has(cleanTok)) tokenSourceMap.set(cleanTok, []);
                  tokenSourceMap.get(cleanTok)!.push({ col: 'user_tokens', docId: doc.id, isArray: true });
                }
              });
            }
          }
        });

        usersSnap.forEach((doc) => {
          const data = doc.data();
          if (isTokenBranchMatched(data, doc.id, branchId)) {
            if (data.fcmToken && typeof data.fcmToken === 'string' && data.fcmToken.trim().length > 10) {
              const tok = data.fcmToken.trim();
              targetTokens.push(tok);
              if (!tokenSourceMap.has(tok)) tokenSourceMap.set(tok, []);
              tokenSourceMap.get(tok)!.push({ col: 'users', docId: doc.id, isArray: false });
            }
            if (Array.isArray(data.fcmTokens)) {
              data.fcmTokens.forEach((t: any) => {
                if (t && typeof t === 'string' && t.trim().length > 10) {
                  const tok = t.trim();
                  targetTokens.push(tok);
                  if (!tokenSourceMap.has(tok)) tokenSourceMap.set(tok, []);
                  tokenSourceMap.get(tok)!.push({ col: 'users', docId: doc.id, isArray: true });
                }
              });
            }
          }
        });
      } catch (err) {
        console.error("Error fetching FCM tokens from Firestore:", err);
      }
    }

    // STRICT DEDUPLICATION: Ensure each unique device token is sent to EXACTLY ONCE
    const uniqueTokens = Array.from(new Set(targetTokens));

    if (uniqueTokens.length === 0) {
      return NextResponse.json({ success: true, message: 'No device tokens available for broadcast', successCount: 0 });
    }

    // Optional Gemini AI refinement for clarity
    let finalTitle = title;
    let finalBody = messageBody;

    if (enableAi && process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
        const prompt = `Rewrite this Circle K operational alert into a concise 1-2 sentence message for a manager's phone lock screen:
Title: ${title}
Details: ${messageBody}`;

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500));
        const result: any = await Promise.race([model.generateContent(prompt), timeoutPromise]);
        const text = result?.response?.text()?.trim();
        if (text) finalBody = text;
      } catch (aiErr) {
        // Fallback silently to original text
      }
    }

    // Multicast Message with collapse keys & priority for Android, iOS APNs, and WebPush
    const message = {
      notification: {
        title: finalTitle,
        body: finalBody,
      },
      data: {
        title: finalTitle,
        body: finalBody,
        url: targetUrl,
        tag: notificationTag,
        type: String(type || 'system')
      },
      android: {
        priority: "high" as const,
        collapseKey: notificationTag,
        notification: {
          title: finalTitle,
          body: finalBody,
          icon: "icon_manager",
          channelId: "circlek_high_importance",
          tag: notificationTag
        }
      },
      webpush: {
        headers: {
          Urgency: "high",
          TTL: "86400",
          Topic: notificationTag.replace(/[^a-zA-Z0-9_-]/g, '_')
        },
        notification: {
          title: finalTitle,
          body: finalBody,
          icon: '/icon-manager.png',
          badge: '/icons8-circled-k-50.png',
          requireInteraction: false,
          tag: notificationTag,
          renotify: true,
          data: { url: targetUrl }
        },
        fcmOptions: {
          link: targetUrl
        }
      },
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-collapse-id": notificationTag
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
      },
      tokens: uniqueTokens,
    };

    const response = await adminMessaging.sendEachForMulticast(message);

    // AUTO-PRUNING: Identify dead tokens and asynchronously remove them from Firestore
    const deadTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const code = resp.error.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          deadTokens.push(uniqueTokens[idx]);
        }
      }
    });

    if (deadTokens.length > 0) {
      (async () => {
        try {
          for (const deadTok of deadTokens) {
            const sources = tokenSourceMap.get(deadTok) || [];
            for (const src of sources) {
              if (src.col === 'user_tokens') {
                await adminDb.collection('user_tokens').doc(src.docId).delete().catch(() => {});
              } else if (src.col === 'users') {
                const userRef = adminDb.collection('users').doc(src.docId);
                const userDoc = await userRef.get();
                if (userDoc.exists) {
                  const uData = userDoc.data() || {};
                  const updates: any = {};
                  if (uData.fcmToken === deadTok) updates.fcmToken = null;
                  if (Array.isArray(uData.fcmTokens)) {
                    updates.fcmTokens = uData.fcmTokens.filter((t: string) => t !== deadTok);
                  }
                  if (Object.keys(updates).length > 0) {
                    await userRef.update(updates).catch(() => {});
                  }
                }
              }
            }
          }
        } catch (pruneErr) {
          console.warn("Background dead-token pruning error:", pruneErr);
        }
      })().catch(() => {});
    }

    return NextResponse.json({ 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount,
      prunedDeadTokens: deadTokens.length
    });
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}
