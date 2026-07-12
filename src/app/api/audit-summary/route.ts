import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not set." }, { status: 500 });
    }

    const { reconData } = await req.json();
    
    if (!reconData || !Array.isArray(reconData)) {
      return NextResponse.json({ error: "Invalid reconciliation data." }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // Use flash since it's supported and fast
    });

    // Format the data for the prompt
    const dataString = reconData.map((it: any) => {
      const sysQty = Number(it.systemQuantity) || 0;
      const actQty = Number(it.actualQuantity) || 0;
      const variance = actQty - sysQty;
      return `Barcode: ${it.barcode} | Name: ${it.productName || 'Unknown'} | System Qty: ${sysQty} | Actual Qty: ${actQty} | Variance: ${variance > 0 ? '+'+variance : variance}`;
    }).join('\n');

    const prompt = `You are an expert inventory auditor for a retail store. Analyze the following cycle count reconciliation data.

Data:
${dataString}

Your task is to write an "Executive Audit Summary" based on this data.
Instructions for Analysis:
1. Look for cross-scanning errors: If one item is SHORT (negative variance) and another item of the SAME brand/company and similar size/type is OVER (positive variance) by the same or similar amount, it highly likely means the cashier scanned the wrong flavor/variant. Point these out specifically.
2. Identify genuine discrepancies: If an item is short or over but has NO related matching opposite variance, state that it is a genuine shortage or overage.
3. Calculate the total number of items short and total items over.

Instructions for Output:
- Write the summary entirely in plain text with professional formatting (use bullet points or paragraphs).
- The summary MUST be written TWICE: First in professional English, followed by professional Egyptian Arabic.
- Do not output Markdown code blocks, just the text.

Example structure:
[English Executive Summary]
...
[Egyptian Arabic Executive Summary (ملخص تنفيذي)]
...`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ success: true, summary: text });

  } catch (error: any) {
    console.error("Error generating audit summary:", error);
    return NextResponse.json({ error: error.message || "Failed to generate summary" }, { status: 500 });
  }
}
