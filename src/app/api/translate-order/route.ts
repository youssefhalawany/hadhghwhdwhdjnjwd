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
    You are the official purchasing manager for a Circle K franchise in Egypt.
    You need to send an official Purchase Order via WhatsApp to a supplier.
    
    Supplier Name: ${supplierName}
    Branch Name: ${branchName}
    Date: ${new Date().toLocaleDateString('en-GB')}
    Items to order:
    ${itemsList}

    Write a HIGHLY PROFESSIONAL and FORMAL business message in Arabic (صيغة رسمية ومهنية جداً).
    The tone must be extremely respectful, precise, and organized, representing a major corporate brand.
    
    CRITICAL: You MUST translate all the English product names into their standard Arabic equivalents as known in the Egyptian market.
    
    Structure the message as follows:
    1. A formal greeting to the supplier company (${supplierName}).
    2. A clear statement that this is an official Purchase Order (طلب شراء رسمي) from Circle K, Branch: ${branchName}, dated ${new Date().toLocaleDateString('en-GB')}.
    3. A cleanly formatted list of the items and their required quantities.
    4. A polite closing requesting them to confirm receipt of this order and to provide the expected delivery date.
    
    Format the text beautifully with professional emojis (like 🏢, 📦, 📋).
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
