import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export async function GET(req: Request) {
  // 1. Verify Vercel Cron Security (Optional but recommended)
  // Vercel sends a CRON_SECRET header to ensure only Vercel can trigger this.
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Initialize Firebase Admin
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
      console.error('Firebase admin init error', error);
      return NextResponse.json({ error: 'Firebase Init Failed: ' + error.message }, { status: 500 });
    }
  }

  const adminDb = getFirestore();

  try {
    // 3. Query Sales from the last 24 hours
    // We get the current date/time minus 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const salesSnapshot = await adminDb.collection("sales")
      .where("createdAt", ">=", twentyFourHoursAgo)
      .get();

    if (salesSnapshot.empty) {
      // Send a message saying no sales were recorded.
      await sendWhatsApp("*Daily Sales Report*\nNo sales shifts were approved in the last 24 hours.");
      return NextResponse.json({ message: "No sales found. WhatsApp sent." });
    }

    // 4. Calculate Totals
    let totalCash = 0;
    let totalVisa = 0;
    let totalVariance = 0;
    let shiftsCount = 0;
    let breakdown = "";

    salesSnapshot.forEach(doc => {
      const data = doc.data();
      totalCash += Number(data.cash) || 0;
      totalVisa += Number(data.visa) || 0;
      totalVariance += Number(data.overShort) || 0;
      shiftsCount++;
      
      // Build a mini-breakdown per shift
      breakdown += `\n- ${data.cashierName} (${data.shift}): ${data.cash} EGP Cash, ${data.visa} EGP Visa (Var: ${data.overShort})`;
    });

    const grandTotal = totalCash + totalVisa;

    // 5. Format WhatsApp Message
    const reportDate = new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo', dateStyle: 'long' });
    const message = `*Daily Sales Report - ${reportDate}*
    
Total Approved Shifts: ${shiftsCount}
----------------------
*TOTAL CASH:* ${totalCash.toLocaleString()} EGP
*TOTAL VISA:* ${totalVisa.toLocaleString()} EGP
*TOTAL REVENUE:* ${grandTotal.toLocaleString()} EGP
*NET VARIANCE:* ${totalVariance.toLocaleString()} EGP
----------------------
*Shift Breakdown:*${breakdown}`;

    // 6. Send via CallMeBot
    await sendWhatsApp(message);

    return NextResponse.json({ success: true, message: "Report generated and sent." });

  } catch (error: any) {
    console.error("Daily cron error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper function to send WhatsApp
async function sendWhatsApp(text: string) {
  try {
    const phone = "201011212003";
    const apikey = "3367979";
    const waText = encodeURIComponent(text);
    const callMeBotUrl = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${waText}&apikey=${apikey}`;
    await fetch(callMeBotUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Node.js)"
      }
    });
  } catch (e) {
    console.error("WhatsApp notification failed", e);
  }
}
