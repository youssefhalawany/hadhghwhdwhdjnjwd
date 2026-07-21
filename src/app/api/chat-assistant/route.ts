import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history, branchId } = body;

    if (!message) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    // Initialize the model
    // We use gemini-1.5-flash as it's the recommended model for general text/chat tasks
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Construct the system prompt
    const systemInstruction = `
You are an expert Operations Manager Assistant for Circle K. Your job is to help the franchise owner or manager run their branch efficiently.
You communicate clearly, professionally, and concisely. You can converse fluently in English, Arabic, or Franco-Arabic depending on how the user speaks to you.
The user is currently managing the branch with ID: "${branchId}". 

Note: You currently only have conversational capabilities. If the user asks for specific data from today (e.g. "How much did we sell?"), politely inform them that your direct database access is currently being built in Phase 2, but you are happy to answer operational questions, help draft reports, provide management advice, or assist with anything else.
`;

    // Convert the history array into the format required by the Gemini ChatSession
    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    // Start a chat session with the history and system instructions
    const chat = model.startChat({
      history: formattedHistory,
      systemInstruction: {
        role: "system",
        parts: [{ text: systemInstruction }]
      }
    });

    // Send the new message
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return NextResponse.json({
      success: true,
      reply: responseText
    });

  } catch (error: any) {
    console.error("AI Chat Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to communicate with AI" },
      { status: 500 }
    );
  }
}
