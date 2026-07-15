import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image } = body; 

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API key is not configured on the server." }, { status: 500 });
    }

    // Extract the base64 data and mime type
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ error: "Invalid image format. Must be base64 data URI." }, { status: 400 });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
You are a Purchase Order data extraction assistant.
Please extract the following information from the provided PO image and return ONLY a valid JSON object. Do NOT wrap it in markdown block quotes.

Extract these fields:
1. "poNumber": Look for "PO Number" or "Original PO Number" usually at the bottom or top right.
2. "invoiceNumber": Look for the value under "Requisitioner".
3. "date": Look for the value under "PO Date". Convert to YYYY-MM-DD if possible, otherwise leave as extracted.
4. "companyName": The first line under "To".
5. "amount": The value for "Sub Total". Return as a number.
6. "tax": The value for "Sales Tax". Return as a number.
7. "items": An array of objects for the items in the table. Each object should have:
   - "barcode": The value under "Lookup Code" (e.g., 5449000...).
   - "quantity": The value under "Qty". Return as a number.
   - "description": The value under "Description".
   - "unitPrice": The value under "Unit Price" (extract the number, ignore 'LE'). Return as a number.

If any field is missing or unreadable, return an empty string for text fields or 0 for number fields.

Return ONLY the JSON. No extra text.
`;

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
    return NextResponse.json({ error: error.message || "Failed to process image" }, { status: 500 });
  }
}
