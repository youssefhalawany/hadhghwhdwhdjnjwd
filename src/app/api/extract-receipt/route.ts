import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not set in the environment variables." }, { status: 500 });
    }

    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided." }, { status: 400 });
    }

    // Remove the data URL prefix if it exists (e.g., "data:image/jpeg;base64,")
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            store_name: { type: SchemaType.STRING },
            receipt_type: { type: SchemaType.STRING },
            transaction_number: { type: SchemaType.STRING },
            date: { type: SchemaType.STRING },
            time: { type: SchemaType.STRING },
            cashier: { type: SchemaType.STRING },
            register_number: { type: SchemaType.STRING },
            items: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  description: { type: SchemaType.STRING },
                  price: { type: SchemaType.NUMBER },
                  quantity: { type: SchemaType.NUMBER },
                  total: { type: SchemaType.NUMBER },
                },
                required: ["description", "price", "quantity", "total"]
              }
            },
            tax_amount: { type: SchemaType.NUMBER },
            total_amount: { type: SchemaType.NUMBER },
            net_amount: { type: SchemaType.NUMBER }
          },
          required: ["transaction_number", "date", "items", "total_amount"]
        }
      }
    });

    const prompt = "Extract all details from this receipt exactly as written. Ensure line items list the correct description, price, quantity, and total.";

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg" // Using generic jpeg, Gemini handles it well regardless of png/jpeg if base64 is raw
        }
      }
    ]);

    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error("Error extracting receipt:", error);
    return NextResponse.json({ error: error.message || "Failed to process receipt" }, { status: 500 });
  }
}
