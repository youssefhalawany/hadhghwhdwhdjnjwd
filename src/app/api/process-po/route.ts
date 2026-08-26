import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || Buffer.from("QVEuQWI4Uk42SVU0c1ZROGRHRE9OTWlvRnV3VWw2WkNMeEJLYkt3ZlZ2Rk5fUldNTWhpb1E=", "base64").toString("utf-8");
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// High-speed model list with fast fallback
async function generateFastPOExtraction(prompt: string, inlineData: any) {
  const modelsToTry = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemma-4-26b-a4b-it",
    "gemini-flash-latest"
  ];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
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
        { inlineData }
      ]);
      const text = result.response.text();
      if (text && text.trim().length > 0) {
        return text;
      }
    } catch (error: any) {
      lastError = error;
      console.warn(`[PO Fast Scanner] Model ${modelName} failed, trying next:`, error?.message || error);
    }
  }

  throw lastError || new Error("All AI models failed to extract PO data");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image } = body; 

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    if (!GEMINI_KEY) {
      return NextResponse.json({ error: "Gemini API key is not configured on the server." }, { status: 500 });
    }

    // Extract the base64 data and mime type
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ error: "Invalid image format. Must be base64 data URI." }, { status: 400 });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const prompt = `
You are an expert Purchase Order (PO) data extraction assistant.
Extract the following information from the provided PO image and return ONLY a valid JSON object matching this schema:
{
  "poNumber": "PO Number or Original PO Number string (empty string if not found)",
  "invoiceNumber": "Invoice number or Requisitioner value (empty string if not found)",
  "date": "PO Date in YYYY-MM-DD format (empty string if not found)",
  "companyName": "Supplier / Vendor name from To field (empty string if not found)",
  "amount": 0.0,
  "tax": 0.0,
  "items": [
    {
      "barcode": "Lookup Code string",
      "quantity": 1.0,
      "description": "Item name / description",
      "unitPrice": 0.0
    }
  ]
}

Return ONLY pure valid JSON without markdown wrapping.
`;

    const responseText = await generateFastPOExtraction(prompt, { data: base64Data, mimeType });
    
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.substring(7);
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3);
      }
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.substring(3);
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3);
      }
    }
    
    const parsedData = JSON.parse(jsonStr.trim());

    // Fix date format if it's DD/MM/YYYY to YYYY-MM-DD
    if (parsedData.date && /^\d{2}\/\d{2}\/\d{4}$/.test(parsedData.date)) {
      const parts = parsedData.date.split('/');
      parsedData.date = parts[2] + '-' + parts[1] + '-' + parts[0];
    }

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("Error processing PO:", error);
    if (error?.status === 429) {
      return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });
    }
    return NextResponse.json({ error: error.message || "Failed to process image" }, { status: 500 });
  }
}
