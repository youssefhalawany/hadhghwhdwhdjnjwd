import { NextResponse } from 'next/server';
import { POST as sendNotification } from '../send/route';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, body: messageBody, url, branchId, branchName } = body;

    if (!title || !messageBody) {
      return NextResponse.json({ error: "Missing title or body" }, { status: 400 });
    }

    // Forward to the unified high-reliability send endpoint
    const mockRequest = new Request("http://localhost/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body: messageBody,
        url,
        branchId,
        branchName,
        type: "master_alert",
        tag: `circlek-master-${branchId || "alert"}`,
        enableAi: true
      })
    });

    const sendResponse = await sendNotification(mockRequest);
    const sendData = await sendResponse.json();

    // Optional WhatsApp bridge to Ibrahim
    (async () => {
      try {
        const phone = encodeURIComponent("+201011212003");
        const apikey = "3367979";
        const waText = encodeURIComponent(`*${title}*\n${messageBody}`);
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
        // WhatsApp optional failure ignored
      }
    })().catch(() => {});

    return NextResponse.json({
      success: true,
      forwarded: true,
      sendResult: sendData
    });
  } catch (error: any) {
    console.error("Error in notify-master forwarder:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
