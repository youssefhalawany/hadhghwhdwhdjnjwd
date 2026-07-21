import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  if (!apiKey) {
    return NextResponse.json({ error: "Missing Gemini API Key." }, { status: 500 });
  }

  try {
    const data = await req.json();
    const { reportData, historicalContext, comparisonData, type } = data;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
You are an expert retail convenience store operations manager. 
Analyze the provided POS sales data and provide a concise, professional 3-4 sentence operational summary. 
Focus on:
1. Overall performance (did we do well?).
2. Which departments drove the sales or underperformed.
3. Any significant anomalies compared to the historical context or previous date.
4. Actionable advice if relevant (e.g., check stock for fast movers, investigate cash variances).

Do not output markdown headings, just a clean paragraph or two. Use LE for currency.

Current Report Data:
${JSON.stringify(reportData, null, 2)}

${comparisonData ? `Comparison Data:\n${JSON.stringify(comparisonData, null, 2)}` : ""}
${historicalContext ? `Historical Context (Averages):\n${JSON.stringify(historicalContext, null, 2)}` : ""}

Type of report: ${type || 'Daily'}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return NextResponse.json({ success: true, analysis: responseText });
  } catch (error: any) {
    console.error("Error generating sales analysis:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate analysis." },
      { status: 500 }
    );
  }
}
