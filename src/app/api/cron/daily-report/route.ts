import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export async function GET(req: Request) {
  // 1. Verify Vercel Cron Security (Optional but recommended)
  // For local testing, we skip this if CRON_SECRET is not set, or we allow a query param.
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  const url = new URL(req.url);
  const isTest = url.searchParams.get("test") === "true";

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isTest) {
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
    // 3. Setup Time Window (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // --- FETCH SHIFT REPORTS ---
    const shiftsSnapshot = await adminDb.collection("shift_reports")
      .where("createdAt", ">=", twentyFourHoursAgo)
      .get();

    let totalCash = 0;
    let totalVisa = 0;
    let totalVariance = 0;
    
    const approvedShifts: string[] = [];
    const notApprovedShifts: string[] = [];

    shiftsSnapshot.forEach(doc => {
      const data = doc.data();
      const status = data.status || "pending";
      const name = data.cashierDetails?.name || "Unknown";
      const shift = data.cashierDetails?.shift || "Unknown";

      if (status === "approved") {
        const cCash = Number(data.managerAudit?.expectedCash) || 0;
        const cVisa = Number(data.managerAudit?.expectedVisa) || 0;
        const cVar = Number(data.managerAudit?.cashVariance) || 0;
        totalCash += cCash;
        totalVisa += cVisa;
        totalVariance += cVar;
        approvedShifts.push(`- *${name}* (${shift}): ${cCash} EGP Cash, ${cVisa} EGP Visa (Var: ${cVar})`);
      } else {
        const submittedCash = Number(data.cashierCounts?.cash) || 0;
        const submittedVisa = Number(data.cashierCounts?.visa) || 0;
        notApprovedShifts.push(`- *${name}* (${shift}): Submitted ${submittedCash} EGP Cash, ${submittedVisa} EGP Visa (Status: *${status.replace('_', ' ').toUpperCase()}*)`);
      }
    });

    const grandTotal = totalCash + totalVisa;

    // --- FETCH EXPIRIES ---
    const expiriesSnapshot = await adminDb.collection("expiries")
      .where("createdAt", ">=", twentyFourHoursAgo)
      .get();
      
    const expiries: string[] = [];
    expiriesSnapshot.forEach(doc => {
      const data = doc.data();
      expiries.push(`- ${data.quantity}x ${data.itemName} (Logged by: ${data.addedBy})`);
    });

    // --- FETCH VOIDS/RETURNS ---
    const voidsSnapshot = await adminDb.collection("void_requests")
      .where("createdAt", ">=", twentyFourHoursAgo)
      .get();

    const voids: string[] = [];
    voidsSnapshot.forEach(doc => {
      const data = doc.data();
      const isSystemClosed = data.status === "closed_on_system";
      const statusText = isSystemClosed ? "✅ Marked on System" : "❌ NOT Marked on System";
      voids.push(`- *${data.cashierName}* voided ${data.amount} EGP (Ref: ${data.transactionNumber}) [${statusText}]`);
    });

    // 4. Format the final WhatsApp Message
    const reportDate = new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo', dateStyle: 'long' });
    
    let message = `*📊 DAILY EXECUTIVE REPORT - ${reportDate}*\n\n`;

    message += `*🟢 APPROVED SHIFTS TOTALS*\n`;
    message += `----------------------\n`;
    message += `*TOTAL CASH:* ${totalCash.toLocaleString()} EGP\n`;
    message += `*TOTAL VISA:* ${totalVisa.toLocaleString()} EGP\n`;
    message += `*TOTAL REVENUE:* ${grandTotal.toLocaleString()} EGP\n`;
    message += `*NET VARIANCE:* ${totalVariance.toLocaleString()} EGP\n`;
    message += `----------------------\n\n`;

    if (approvedShifts.length > 0) {
      message += `*✅ APPROVED SHIFTS:*\n${approvedShifts.join('\n')}\n\n`;
    } else {
      message += `*✅ APPROVED SHIFTS:*\n_None today._\n\n`;
    }

    if (notApprovedShifts.length > 0) {
      message += `*⚠️ NOT APPROVED SHIFTS:*\n${notApprovedShifts.join('\n')}\n\n`;
    }

    message += `*🗑️ VOIDS & RETURNS TODAY:*\n`;
    if (voids.length > 0) {
      message += voids.join('\n') + '\n\n';
    } else {
      message += `_No voids logged._\n\n`;
    }

    message += `*🥪 EXPIRIES TRACKED TODAY:*\n`;
    if (expiries.length > 0) {
      message += expiries.join('\n') + '\n';
    } else {
      message += `_No expiries logged._\n`;
    }

    // 5. Send via CallMeBot
    await sendWhatsApp(message);

    return NextResponse.json({ success: true, message: "Advanced report generated and sent." });

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
