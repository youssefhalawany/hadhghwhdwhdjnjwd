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

    // Remove the data URL prefix if it exists
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
            generated_on: { type: SchemaType.STRING },
            date_sold: { type: SchemaType.STRING },
            overall_qty_sold: { type: SchemaType.NUMBER },
            overall_total_sales: { type: SchemaType.NUMBER },
            overall_total_tax_ex: { type: SchemaType.NUMBER },
            overall_sales_tax: { type: SchemaType.NUMBER },
            departments: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING },
                  qty_sold: { type: SchemaType.NUMBER },
                  total_sales: { type: SchemaType.NUMBER },
                  total_tax_ex: { type: SchemaType.NUMBER },
                  sales_tax: { type: SchemaType.NUMBER }
                },
                required: ["name", "qty_sold", "total_sales", "total_tax_ex", "sales_tax"]
              }
            }
          },
          required: ["store_name", "generated_on", "date_sold", "overall_qty_sold", "overall_total_sales", "departments"]
        }
      }
    });

    const prompt = `Extract all details from this POS "Detailed Sales Report (Tax Included in Sales)" exactly as written. 
Ensure you extract the top-level store name, the "Generated On" date, and the "Date Sold" from the filter section.
For the "Overall" row, extract the total Qty Sold, Total Sales, Total (Tax Ex), and Sales Tax.
Then, extract every single department row below it (e.g., Bakery, Candy, Cigarettes, Coffee, etc.), getting their exact Qty Sold, Total Sales, Total (Tax Ex), and Sales Tax. 
Ignore the LE prefix for currency values, just return the raw numbers.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg"
        }
      }
    ]);

    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error("Error extracting detailed sales:", error);
    return NextResponse.json({ error: error.message || "Failed to process image" }, { status: 500 });
  }
}
