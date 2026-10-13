import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MODELS_TO_TRY = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest"
];

import { prepareVisionImage, formatVisionApiError } from "@/lib/vision-sanitizer";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
    }

    const body = await req.json();
    const imageInput = body.imageBase64 || body.image;
    
    if (!imageInput || typeof imageInput !== "string") {
      return NextResponse.json({ error: "No receipt image provided." }, { status: 400 });
    }

    const { base64Data, mimeType } = await prepareVisionImage(imageInput);

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = `
You are an expert retail POS cash register receipt scanner.
Analyze this receipt image and extract all transaction details.

Return a valid JSON object matching this schema:
{
  "store_name": string or null,
  "receipt_type": string or null,
  "transaction_number": string,
  "date": string,
  "time": string or null,
  "cashier": string or null,
  "register_number": string or null,
  "items": [
    {
      "description": string,
      "price": number,
      "quantity": number,
      "total": number
    }
  ],
  "tax_amount": number or null,
  "total_amount": number,
  "net_amount": number or null
}

Ensure line items list the correct description, price, quantity, and total.
Return ONLY raw JSON without markdown or additional explanation.
`;

    let lastError: any = null;

    for (const modelName of MODELS_TO_TRY) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          }
        });

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType
            }
          }
        ]);

        const responseText = result.response.text();
        if (responseText) {
          const cleanedText = responseText.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
          const data = JSON.parse(cleanedText);
          return NextResponse.json({ success: true, data });
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Receipt Scanner] Model ${modelName} failed:`, err?.message || err);
        // Small delay in case of temporary 503 spike
        if (err?.status === 503 || err?.message?.includes("503")) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    throw lastError || new Error("All AI models failed to scan receipt");

  } catch (error: any) {
    console.error("Error extracting receipt:", error);
    const friendlyError = formatVisionApiError(error);
    return NextResponse.json({ error: friendlyError }, { status: 500 });
  }
}
