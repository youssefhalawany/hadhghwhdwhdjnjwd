import { NextResponse } from "next/server";
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { productsDb } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const getDailySalesDeclaration: FunctionDeclaration = {
  name: "get_daily_sales",
  description: "Retrieves the detailed daily sales report for a specific date from the POS database. Use this when the user asks for sales totals, category breakdowns, or performance for a specific day.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      date: {
        type: SchemaType.STRING,
        description: "The date to query in YYYY-MM-DD format (e.g., '2026-07-21')."
      }
    },
    required: ["date"]
  }
};

const getHistoricalSalesDeclaration: FunctionDeclaration = {
  name: "get_historical_sales",
  description: "Retrieves the last 7 days of sales reports for trend analysis. Use this when the user asks about recent trends, averages, or how sales are doing over the past week.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {}, // No params needed, it just grabs the latest 7 days
    required: []
  }
};

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

    // Determine the current local date to give the AI temporal context
    const today = new Date().toLocaleDateString('en-CA'); // e.g. "2026-07-22"

    // Construct the system prompt
    const systemInstruction = `
You are Ibrahim, the expert Operations Manager Assistant (مساعد مدير) for Circle K. Your job is to help the franchise owner or manager run their branch efficiently.
You communicate clearly, professionally, and concisely. You can converse fluently in English, Arabic, or Franco-Arabic depending on how the user speaks to you.
The user is currently managing the branch with ID: "${branchId}". 
Today's date is: ${today}.

You have access to live database tools to query sales. 
If the user asks for sales numbers, USE YOUR TOOLS to fetch the data first before answering. 
Do not guess numbers. If a tool returns null or empty data, inform the user that the report for that date hasn't been uploaded yet (the manager hasn't posted the Z-Report).
`;

    // Initialize the model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      systemInstruction: systemInstruction,
      tools: [{ functionDeclarations: [getDailySalesDeclaration, getHistoricalSalesDeclaration] }]
    });

    // Convert the history array into the format required by the Gemini ChatSession
    let formattedHistory = (history || []).map((msg: any) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    // Gemini strictly requires the history array to start with a "user" role.
    while (formattedHistory.length > 0 && formattedHistory[0].role === "model") {
      formattedHistory.shift();
    }

    // Start a chat session with the history
    const chat = model.startChat({
      history: formattedHistory
    });

    // Send the new message
    let result = await chat.sendMessage(message);
    
    // Check if the AI decided to call a function
    const functionCalls = result.response.functionCalls();
    
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      let apiResponse: any = null;

      try {
        const altBranchMap: Record<string, string> = {
          "alamein4": "eL-alamein-4",
          "ola": "ola-el-koronfol",
          "eL-alamein-4": "alamein4",
          "ola-el-koronfol": "ola"
        };
        const altBranch = altBranchMap[branchId] || branchId;

        if (call.name === "get_daily_sales") {
          const args = call.args as any;
          const { date } = args;
          console.log(`AI executing get_daily_sales for branch: ${branchId}, date: ${date}`);
          
          const q = query(
            collection(productsDb, "detailed_sales_daily"),
            where("branchId", "in", [branchId, altBranch]),
            where("date_sold", "==", date),
            limit(1)
          );
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            apiResponse = snapshot.docs[0].data();
          } else {
            apiResponse = { error: "No data found for the requested date. This may mean the Z-Report hasn't been posted yet." };
          }
        } 
        else if (call.name === "get_historical_sales") {
          console.log(`AI executing get_historical_sales for branch: ${branchId}`);
          
          const q = query(
            collection(productsDb, "detailed_sales_daily"),
            where("branchId", "in", [branchId, altBranch]),
            orderBy("date_sold", "desc"),
            limit(7)
          );
          const snapshot = await getDocs(q);
          const recentSales: any[] = [];
          snapshot.forEach(doc => recentSales.push(doc.data()));
          
          apiResponse = recentSales.length > 0 ? recentSales : { error: "No historical data found." };
        }

        // Send the database result back to the AI so it can formulate a final answer.
        // We use a regular text message instead of functionResponse to avoid "Role 'function' is not supported" errors on older API versions.
        const followUpMessage = `[SYSTEM: Tool '${call.name}' executed successfully. Here is the data from the database:]\n\n${JSON.stringify(apiResponse, null, 2)}\n\nNow, provide your final answer to the user based on this data.`;
        
        result = await chat.sendMessage(followUpMessage);

      } catch (dbError: any) {
        console.error("Firebase Tool Error:", dbError);
        // If DB fails, tell the AI so it can apologize
        result = await chat.sendMessage([{
          functionResponse: {
            name: call.name,
            response: { error: "Database query failed due to technical error." }
          }
        }]);
      }
    }

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
