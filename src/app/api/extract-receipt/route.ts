import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MODELS_TO_TRY = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest"
];

function sanitizeImageBase64(input: string): { base64Data: string; mimeType: string } {
  let base64Data = "";
  let mimeType = "image/jpeg";

  if (input.includes(",")) {
    const commaIndex = input.indexOf(",");
    const metadata = input.substring(0, commaIndex);
    base64Data = input.substring(commaIndex + 1).replace(/\s+/g, "");
    const match = metadata.match(/data:([^;]+)/);
    if (match && match[1]) {
      mimeType = match[1].trim();
    }
  } else {
    base64Data = input.replace(/\s+/g, "");
  }

  return { base64Data, mimeType };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
    }

    const body = await req.json();
    const imageBase64 = body.imageBase64 || body.image;
    
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "No image provided." }, { status: 400 });
    }

    let { base64Data, mimeType } = sanitizeImageBase64(imageBase64);

    // If an HTTP/HTTPS URL was supplied, fetch it to base64
    if (imageBase64.startsWith("http://") || imageBase64.startsWith("https://")) {
      try {
        const urlRes = await fetch(imageBase64);
        if (urlRes.ok) {
          const buf = await urlRes.arrayBuffer();
          base64Data = Buffer.from(buf).toString("base64");
          const cType = urlRes.headers.get("content-type");
          if (cType) mimeType = cType.split(";")[0].trim();
        }
      } catch (fetchErr) {
        console.warn("Failed to download image from URL:", fetchErr);
      }
    }

    if (!base64Data) {
      return NextResponse.json({ error: "Failed to parse base64 image data." }, { status: 400 });
    }

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
    return NextResponse.json({ error: error.message || "Failed to process receipt" }, { status: 500 });
  }
}
