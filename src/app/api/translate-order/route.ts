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
    You are a polite and professional manager of a specific Circle K branch in Egypt (Branch: ${branchName}).
    You are sending a WhatsApp order to a supplier (${supplierName}).
    Date: ${new Date().toLocaleDateString('en-GB')}
    
    Items to order:
    ${itemsList}

    Write a professional but natural Egyptian business WhatsApp message (صيغة مصرية عملية ومحترمة، زي "أهلاً بحضرتك" أو "محتاجين طلبية لفرع").
    DO NOT act like you are the central purchasing department for all of Egypt. You only represent branch: ${branchName}.
    
    CRITICAL: For the items, do NOT just literally translate the English words. You must translate the actual BRAND NAME and PRODUCT NAME into the common Arabic name used in the Egyptian market (e.g., "Schweppes Malt Peach 250Ml" -> "شويبس شعير خوخ 250 مل", "Coca Cola Zero 330 Ml" -> "كوكاكولا زيرو 330 مل").
    
    Structure the message:
    1. A polite Egyptian greeting (e.g., "مساء الخير، أهلاً بحضرتك").
    2. State that you need an order for branch: *${branchName}*.
    3. A cleanly formatted list of the items (using the Egyptian Arabic product names) and their quantities.
    4. A polite closing asking to confirm the order and delivery time.
    
    Do NOT include overly formal Standard Arabic like "تحية طيبة وبعد" or "وتفضلوا بقبول فائق الاحترام". Keep it natural, practical, and very polite.
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
