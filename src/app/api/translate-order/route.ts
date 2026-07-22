import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { supplierName, branchName, items } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "No Gemini API key found" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

    // Construct the prompt
    let itemsList = items.map((i: any) => `- ${i.description} (Qty: ${i.quantity})`).join('\n');
    
    const prompt = `
    You are an assistant for a Circle K franchise in Egypt.
    A manager wants to send a WhatsApp order to a supplier.
    
    Supplier Name: ${supplierName}
    Branch Name: ${branchName}
    Items to order:
    ${itemsList}

    Please write a polite, professional WhatsApp message in Egyptian Arabic (اللغة العربية).
    CRITICAL: You MUST translate all the English product names into their standard Arabic equivalents as known in the Egyptian market (e.g. "Coca Cola" -> "كوكاكولا", "Lays" -> "شيبسي ليز", "Dettol Sanitizer" -> "معقم ديتول").
    
    Format the message beautifully with emojis.
    Include the Branch Name in the message.
    List the translated items and their quantities clearly using bullet points.
    Do NOT include any markdown code blocks like \`\`\` text \`\`\`. Just return the raw text ready for WhatsApp.
    `;

    const result = await model.generateContent(prompt);
    const translatedText = result.response.text();

    return NextResponse.json({ success: true, text: translatedText.trim() });
  } catch (error: any) {
    console.error("Translation API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
