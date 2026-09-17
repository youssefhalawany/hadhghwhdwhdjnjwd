import { NextResponse } from 'next/server';
import { POST as sendNotification } from '../send/route';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, message, body: altBody, url = "/owner" } = body;

    const finalBody = message || altBody;

    if (!title || !finalBody) {
      return NextResponse.json({ error: 'Missing title or message' }, { status: 400 });
    }

    const mockRequest = new Request("http://localhost/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body: finalBody,
        url,
        type: "owner_alert",
        tag: "circlek-owner-alert"
      })
    });

    return await sendNotification(mockRequest);
  } catch (error: any) {
    console.error('Error in notify-owners forwarder:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
