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
      return NextResponse.json({ error: "GEMINI_API_KEY is not set in the environment variables." }, { status: 500 });
    }

    const body = await req.json();
    const imageInput = body.imageBase64 || body.image;
    
    if (!imageInput || typeof imageInput !== "string") {
      return NextResponse.json({ error: "No image provided." }, { status: 400 });
    }

    const { base64Data, mimeType } = await prepareVisionImage(imageInput);

    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `Extract all details from this POS "Detailed Sales Report (Tax Included in Sales)" exactly as written. 
Ensure you extract the top-level store name, the "Generated On" date, and the "Date Sold" from the filter section.
For the "Overall" row, extract the total Qty Sold, Total Sales, Total (Tax Ex), and Sales Tax.
Then, extract every single department row below it (e.g., Bakery, Candy, Cigarettes, Coffee, etc.), getting their exact Qty Sold, Total Sales, Total (Tax Ex), and Sales Tax. 
Ignore the LE prefix for currency values, just return raw numbers.

Return ONLY a valid JSON object matching this schema:
{
  "store_name": string or null,
  "generated_on": string or null,
  "date_sold": string or null,
  "overall_qty_sold": number,
  "overall_total_sales": number,
  "overall_total_tax_ex": number,
  "overall_sales_tax": number,
  "departments": [
    {
      "name": string,
      "qty_sold": number,
      "total_sales": number,
      "total_tax_ex": number,
      "sales_tax": number
    }
  ]
}
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
        console.warn(`[Detailed Sales Scanner] Model ${modelName} failed:`, err?.message || err);
        if (err?.status === 503 || err?.message?.includes("503")) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    throw lastError || new Error("All AI models failed to extract detailed sales report");

  } catch (error: any) {
    console.error("Error extracting detailed sales:", error);
    return NextResponse.json({ error: formatVisionApiError(error) }, { status: 500 });
  }
}
