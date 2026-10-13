import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import { getGeminiApiKey } from "@/lib/vision-sanitizer";

const genAI = new GoogleGenerativeAI(getGeminiApiKey());

// High-speed vision model list with graceful fallback
async function generateFastPOExtraction(prompt: string, inlineData: { data: string; mimeType: string }) {
  const modelsToTry = [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.6-flash",
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
        {
          inlineData: {
            data: inlineData.data,
            mimeType: inlineData.mimeType
          }
        }
      ]);
      
      const text = result.response.text();
      if (text && text.trim().length > 0) {
        return text;
      }
    } catch (error: any) {
      lastError = error;
      console.warn(`[PO Vision Scanner] Model ${modelName} failed, trying next:`, error?.message || error);
      if (error?.status === 503 || error?.message?.includes("503")) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  throw lastError || new Error("All AI models failed to extract PO data");
}

import { prepareVisionImage, formatVisionApiError } from "@/lib/vision-sanitizer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image } = body; 

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured on the server." }, { status: 500 });
    }

    const { base64Data, mimeType } = await prepareVisionImage(image);

    const prompt = `
You are an expert Purchase Order (PO), Delivery Note (إذن تسليم / إذن صرف), and Supplier Invoice data extraction system for convenience retail stores (Circle K, FMCG suppliers).
Analyze the provided document image thoroughly. Read both Arabic and English text accurately, including handwritten or printed receipts, thermal invoices, and delivery notes.

Extract the following key fields:
1. "companyName": Supplier or Vendor name (e.g. Edita, Pepsi, Chipsy, Juhayna, Americana, Domty, Kraft, Cadbury, Al-Rashidi, Halwani, etc.).
2. "poNumber": PO Number, Delivery Note Number (رقم الإذن), or Document Reference (empty string if not found).
3. "invoiceNumber": Invoice number (رقم الفاتورة) or Requisitioner value (empty string if not found).
4. "date": Date of invoice / delivery in YYYY-MM-DD format (empty string if not found).
5. "amount": Total invoice amount as number.
6. "items": A list of all products / line items listed on the invoice. For each item extract:
   - "description": Exact product / item name in Arabic or English (e.g., "كرواسون زعتر", "براونيز شوكولاتة", "مولتو ميني فراولة", "بيبسي كانز 330 مل", "شيبسي عائلي جبنة").
   - "barcode": Product Barcode, SKU, or Lookup Code if visible on the table/line (e.g., "77714", "6223001234567"). If not printed on invoice, set to "N/A" or empty string.
   - "quantity": Number of units / packages received (number, minimum 1). If given in cartons and pack size, calculate the total piece count.
   - "unitPrice": Purchase price per unit if listed (number).
   - "expiryDate": If an expiry date or production date is explicitly stated on the row, provide it in YYYY-MM-DD format, otherwise leave empty string.

Return ONLY a valid JSON object matching this exact schema:
{
  "companyName": "string",
  "poNumber": "string",
  "invoiceNumber": "string",
  "date": "YYYY-MM-DD",
  "amount": 0.0,
  "tax": 0.0,
  "items": [
    {
      "description": "string",
      "barcode": "string",
      "quantity": 1,
      "unitPrice": 0.0,
      "expiryDate": "YYYY-MM-DD"
    }
  ]
}
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

    // Normalize date format if it's DD/MM/YYYY to YYYY-MM-DD
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
    return NextResponse.json({ error: formatVisionApiError(error) }, { status: 200 });
  }
}
