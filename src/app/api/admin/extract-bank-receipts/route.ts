import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
  "";

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

const MODELS_TO_TRY = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
];

import { prepareVisionImage, formatVisionApiError } from "@/lib/vision-sanitizer";

export async function extractBankReceiptData(receiptBase64OrUrl: string): Promise<any> {
  const { base64Data, mimeType } = await prepareVisionImage(receiptBase64OrUrl);

  const prompt = `
You are an expert Egyptian & Arab banking system document analyzer.
Analyze this bank transfer receipt, mobile banking screenshot (InstaPay, CIB, NBE الأهلي, Banque Misr مصر, QNB الأهلي قطر, ADIB, AAIB العربي الأفريقي, etc.), ATM receipt, or deposit slip.

Extract the following information:
1. "bankName": Name of the bank or payment platform (e.g., "InstaPay", "البنك الأهلي المصري", "بنك مصر", "البنك التجاري الدولي (CIB)", "QNB Alahli", "مصرف أبوظبي الإسلامي", "العربي الأفريقي الدولي", etc.).
2. "beneficiaryName": Recipient / beneficiary / company name (اسم المستفيد / المحول إليه).
3. "bankAccountNumber": Recipient bank account number, IBAN (e.g. EG...), or InstaPay Payment Address (IPA e.g. name@instapay) or card number. If partially masked, include whatever is visible.
4. "senderName": Sender / payer name if visible (اسم المحول / الراسل).
5. "transferReference": Transaction ID, reference number, or confirmation code (رقم العملية / الرقم المرجعي / Ref No).
6. "transferDate": Date in YYYY-MM-DD format (if visible).
7. "transferTime": Time if visible.
8. "transferAmount": The exact transferred amount as a number.
9. "currency": Currency code (e.g., "EGP").
10. "transferStatus": "SUCCESSFUL", "PENDING", or "UNKNOWN".
11. "confidence": Number between 0 and 1 indicating OCR confidence.

Return ONLY a valid JSON object matching these exact keys without markdown or commentary.
`;

  let lastErr: any = null;
  for (const modelName of MODELS_TO_TRY) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const res = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType,
          },
        },
      ]);

      const text = res.response.text();
      if (text) {
        const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
        return JSON.parse(cleaned);
      }
    } catch (e: any) {
      lastErr = e;
      console.warn(`[Bank Receipt OCR - Model ${modelName} failed]:`, e?.message || e);
      if (e?.status === 503 || e?.message?.includes("503")) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  throw lastErr || new Error("All vision models failed to extract bank receipt");
}

// GET: Returns status statistics
export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collection("cash_payments").where("bankTransferReceiptUrl", "!=", null).get();

    let totalWithReceipt = snap.size;
    let extractedCount = 0;
    let pendingCount = 0;

    snap.forEach((doc) => {
      const d = doc.data();
      if (d.bankName || d.bankAccountNumber || d.transferReference || d.bankExtractedAt) {
        extractedCount++;
      } else {
        pendingCount++;
      }
    });

    return NextResponse.json({
      success: true,
      totalWithReceipt,
      extractedCount,
      pendingCount,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Extract for an image or specific document or batch
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Mode A: Direct image extraction (e.g. pasted in payments form or specific company card)
    if (body.imageBase64) {
      const extracted = await extractBankReceiptData(body.imageBase64);
      
      // If companyName or companyId is provided, propagate the extracted bank details
      if (body.companyName && extracted && (extracted.bankName || extracted.bankAccountNumber)) {
        try {
          const db = getAdminDb();
          const snap = await db.collection("cash_payments")
            .where("companyName", "==", body.companyName)
            .get();
            
          const batch = db.batch();
          snap.forEach(d => {
            const updatePayload: Record<string, any> = {
              bankExtractedAt: new Date().toISOString(),
            };
            if (extracted.bankName) updatePayload.bankName = extracted.bankName;
            if (extracted.bankAccountNumber) updatePayload.bankAccountNumber = extracted.bankAccountNumber;
            if (extracted.beneficiaryName) updatePayload.beneficiaryName = extracted.beneficiaryName;
            if (extracted.transferReference) updatePayload.transferReference = extracted.transferReference;
            if (extracted.senderName) updatePayload.bankSenderName = extracted.senderName;
            batch.update(d.ref, updatePayload);
          });
          await batch.commit();
        } catch (dbErr) {
          console.warn("Failed to propagate company bank details:", dbErr);
        }
      }

      return NextResponse.json({ success: true, data: extracted });
    }

    const db = getAdminDb();

    // Mode B: Extract specific document by docId
    if (body.docId) {
      const docRef = db.collection("cash_payments").doc(body.docId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      const data = docSnap.data();
      if (!data?.bankTransferReceiptUrl) {
        return NextResponse.json({ error: "Document has no bank receipt image" }, { status: 400 });
      }

      const extracted = await extractBankReceiptData(data.bankTransferReceiptUrl);

      const updatePayload: Record<string, any> = {
        bankExtractedAt: new Date().toISOString(),
      };
      if (extracted.bankName) updatePayload.bankName = extracted.bankName;
      if (extracted.bankAccountNumber) updatePayload.bankAccountNumber = extracted.bankAccountNumber;
      if (extracted.beneficiaryName) updatePayload.beneficiaryName = extracted.beneficiaryName;
      if (extracted.transferReference) updatePayload.transferReference = extracted.transferReference;
      if (extracted.senderName) updatePayload.bankSenderName = extracted.senderName;
      if (extracted.transferDate) updatePayload.bankTransferDate = extracted.transferDate;
      if (extracted.transferTime) updatePayload.bankTransferTime = extracted.transferTime;
      if (typeof extracted.transferAmount === "number") updatePayload.bankTransferAmount = extracted.transferAmount;
      if (typeof extracted.confidence === "number") updatePayload.bankOcrConfidence = extracted.confidence;
      if (extracted.transferStatus) updatePayload.bankTransferStatus = extracted.transferStatus;

      await docRef.update(updatePayload);

      return NextResponse.json({ success: true, data: extracted, docId: body.docId });
    }

    // Mode C: Incremental batch extraction (cap at 2 to stay strictly within serverless timeout limits)
    const limitNum = Math.min(2, Math.max(1, Number(body.limit || 2)));
    const snap = await db.collection("cash_payments").where("bankTransferReceiptUrl", "!=", null).get();

    const pendingDocs = snap.docs.filter((d) => {
      const dat = d.data();
      return !dat.bankName && !dat.bankAccountNumber && !dat.transferReference;
    }).slice(0, limitNum);

    const results = [];
    for (const d of pendingDocs) {
      const dat = d.data();
      try {
        const extracted = await extractBankReceiptData(dat.bankTransferReceiptUrl);
        const updatePayload: Record<string, any> = {
          bankExtractedAt: new Date().toISOString(),
        };
        if (extracted.bankName) updatePayload.bankName = extracted.bankName;
        if (extracted.bankAccountNumber) updatePayload.bankAccountNumber = extracted.bankAccountNumber;
        if (extracted.beneficiaryName) updatePayload.beneficiaryName = extracted.beneficiaryName;
        if (extracted.transferReference) updatePayload.transferReference = extracted.transferReference;
        if (extracted.senderName) updatePayload.bankSenderName = extracted.senderName;
        if (extracted.transferDate) updatePayload.bankTransferDate = extracted.transferDate;
        if (extracted.transferTime) updatePayload.bankTransferTime = extracted.transferTime;
        if (typeof extracted.transferAmount === "number") updatePayload.bankTransferAmount = extracted.transferAmount;
        if (typeof extracted.confidence === "number") updatePayload.bankOcrConfidence = extracted.confidence;
        if (extracted.transferStatus) updatePayload.bankTransferStatus = extracted.transferStatus;

        await d.ref.update(updatePayload);
        results.push({ id: d.id, success: true, company: dat.companyName, bank: extracted.bankName });
      } catch (subErr: any) {
        results.push({ id: d.id, success: false, error: subErr.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (err: any) {
    console.error("Error in extract-bank-receipts route:", err);
    return NextResponse.json({ error: formatVisionApiError(err) }, { status: 500 });
  }
}
