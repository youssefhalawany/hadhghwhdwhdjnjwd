import { NextResponse } from "next/server";
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { productsDb, db } from "@/lib/firebase";
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

const getShiftAuditsDeclaration: FunctionDeclaration = {
  name: "get_shift_audits",
  description: "Scans the shift_reports database for recent shifts to catch cash or visa shortages and overages. Use this when the user asks about shift performance, cash drawer status, or shortages.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
    required: []
  }
};

const getExpiriesWatcherDeclaration: FunctionDeclaration = {
  name: "get_expiries_watcher",
  description: "Scans the expiries database for items that are expiring soon or have already expired but haven't been pulled. Use this when the user asks about expiring items, inventory, or waste.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
    required: []
  }
};

const getSalesPredictorDeclaration: FunctionDeclaration = {
  name: "get_sales_predictor",
  description: "Fetches the last 30 days of sales data so you can run a predictive algorithm. Use this when the user asks for sales predictions for tomorrow or future dates.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
    required: []
  }
};

const getVendorOrderDeclaration: FunctionDeclaration = {
  name: "get_vendor_order",
  description: "Generates an automated purchase order for a specific vendor based on recent sales. Use this when the user asks to write an order for a vendor like 'Edita', 'Pepsi', 'Red Bull', etc.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      vendorName: {
        type: SchemaType.STRING,
        description: "The name of the vendor or company to order from."
      }
    },
    required: ["vendorName"]
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
You communicate clearly, professionally, but in a very COOL and FUN Egyptian Arabic dialect (اللغة العامية المصرية). You can call the user "يا ريس" or "يا باشا". 
ALWAYS mirror the exact language the user speaks to you in. If they speak Egyptian Arabic, reply in pure, fun Egyptian 3ameya. If they speak English, reply in English. If they speak Franco-Arabic (e.g., "ezayak ya ibrahim"), reply in Franco-Arabic. Your default starting persona is a friendly, street-smart Egyptian manager assistant.
The user is currently managing the branch with ID: "${branchId}". 
Today's date is: ${today}.

You have access to live database tools to query sales, shift audits, and expiries. 
If the user asks for sales numbers, shortages, or expiring items, USE YOUR TOOLS to fetch the data first before answering. 
Do not guess numbers. If a tool returns null or empty data, inform the user that the report hasn't been uploaded yet.

When predicting sales using get_sales_predictor, analyze the 30-day data trend, consider if tomorrow is a weekend, factor in Egyptian weather/holiday seasons, and provide a realistic, intelligent estimate.

CHARTING INSTRUCTIONS:
If the user explicitly asks you to "draw", "plot", or "chart" data (e.g. "إرسملي مبيعات الأسبوع ده" or "Show me a chart"), you MUST respond EXACTLY and ONLY with a JSON payload in this exact format, with NO backticks or extra text around it:
[CHART]
{"title": "مبيعات الأسبوع", "data": [{"name": "السبت", "value": 5000}, {"name": "الأحد", "value": 5500}]}
Do not add any other conversational text when outputting a chart.
`;

    // Initialize the model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.5-flash-lite",
      systemInstruction: systemInstruction,
      tools: [{ functionDeclarations: [
        getDailySalesDeclaration, 
        getHistoricalSalesDeclaration,
        getShiftAuditsDeclaration,
        getExpiriesWatcherDeclaration,
        getSalesPredictorDeclaration,
        getVendorOrderDeclaration
      ] }]
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
          const args = (call.args as any) || {};
          const date = args.date || today; // fallback to today if undefined
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
          
          // Fetch all for the branch and sort in memory to avoid Firebase Composite Index requirement
          const q = query(
            collection(productsDb, "detailed_sales_daily"),
            where("branchId", "in", [branchId, altBranch])
          );
          const snapshot = await getDocs(q);
          const allSales: any[] = [];
          snapshot.forEach(doc => allSales.push(doc.data()));
          
          // Sort descending by date
          allSales.sort((a, b) => {
            const dateA = a.date_sold ? new Date(a.date_sold).getTime() : 0;
            const dateB = b.date_sold ? new Date(b.date_sold).getTime() : 0;
            return dateB - dateA;
          });
          
          const recentSales = allSales.slice(0, 7);
          
          apiResponse = recentSales.length > 0 ? recentSales : { error: "No historical data found." };
        }
        else if (call.name === "get_shift_audits") {
          console.log(`AI executing get_shift_audits for branch: ${branchId}`);
          
          const q = query(
            collection(db, "shift_reports"),
            where("branchId", "in", [branchId, altBranch])
          );
          const snapshot = await getDocs(q);
          const audits: any[] = [];
          snapshot.forEach(doc => audits.push(doc.data()));
          
          // Sort descending by date
          audits.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          
          const recentAudits = audits.slice(0, 15).map(data => ({
             shift: data.cashierDetails?.shift || "Unknown",
             cashierName: data.cashierDetails?.name || "Unknown",
             date: data.cashierDetails?.date || data.createdAt,
             cashVariance: data.managerAudit?.cashVariance || 0,
             visaVariance: data.managerAudit?.visaVariance || 0,
             status: data.status
          }));
          
          apiResponse = recentAudits.length > 0 ? recentAudits : { error: "No recent shift audits found." };
        }
        else if (call.name === "get_expiries_watcher") {
          console.log(`AI executing get_expiries_watcher for branch: ${branchId}`);
          
          const q = query(collection(db, "expiries"));
          const snapshot = await getDocs(q);
          const activeExpiries: any[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            // Fallback check for branch/store in memory to avoid index issues
            const bId = data.branchId || "";
            const sId = (data.storeId || "").toLowerCase();
            const matchesBranch = (bId === branchId || bId === altBranch) || (branchId === "ola" && sId.includes("ola")) || (branchId === "alamein4" && sId.includes("alamein"));
            
            if (matchesBranch && data.status !== "pulled" && data.status !== "audited" && data.status !== "damaged") {
               activeExpiries.push({
                 itemName: data.itemName,
                 quantity: data.quantity,
                 expiryDate: data.expiryDate,
                 status: data.status
               });
            }
          });
          
          activeExpiries.sort((a, b) => (a.expiryDate || "").localeCompare(b.expiryDate || ""));
          apiResponse = activeExpiries.slice(0, 20);
        }
        else if (call.name === "get_sales_predictor") {
           console.log(`AI executing get_sales_predictor for branch: ${branchId}`);
           
           const q = query(
            collection(productsDb, "detailed_sales_daily"),
            where("branchId", "in", [branchId, altBranch])
          );
          const snapshot = await getDocs(q);
          const allSales: any[] = [];
          snapshot.forEach(doc => allSales.push(doc.data()));
          
          allSales.sort((a, b) => {
            const dateA = a.date_sold ? new Date(a.date_sold).getTime() : 0;
            const dateB = b.date_sold ? new Date(b.date_sold).getTime() : 0;
            return dateB - dateA;
          });
          
          const recentSales = allSales.slice(0, 30);
          apiResponse = {
            historical30Days: recentSales,
            instructions: "Use this 30 days of data to compute an average trend. Then, predict tomorrow's sales. Consider tomorrow's day of the week, weekends usually have +15% sales, and any general knowledge of holidays/weather."
          };
        }
        else if (call.name === "get_vendor_order") {
           const args = (call.args as any) || {};
           const vendorName = args.vendorName || "";
           console.log(`AI executing get_vendor_order for branch: ${branchId}, vendor: ${vendorName}`);
           
           const q = query(
            collection(productsDb, "detailed_sales_daily"),
            where("branchId", "in", [branchId, altBranch]),
            limit(14)
          );
          const snapshot = await getDocs(q);
          
          const allCategoriesSales: any = {};
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.categories) {
              Object.entries(data.categories).forEach(([catName, amount]) => {
                allCategoriesSales[catName] = (allCategoriesSales[catName] || 0) + (amount as number);
              });
            }
          });
          
          apiResponse = {
            vendorRequested: vendorName,
            recentSalesByAllCategories: allCategoriesSales,
            instructions: "The database only tracks sales by high-level category (e.g., 'Packaged Beverages' instead of 'Red Bull' or 'Pepsi'). Based on the user's requested vendor/supplier, identify which category they likely belong to. Then, estimate a realistic, fun purchase order list in Egyptian Arabic (e.g., 'بناءاً على مبيعات المشروبات المعبأة، احنا محتاجين...'). Make up specific item quantities that fit the overall category sales volume."
          };
        }

        // Send the database result back to the AI so it can formulate a final answer.
        const followUpMessage = `[SYSTEM: Tool '${call.name}' executed successfully. Here is the data from the database:]\n\n${JSON.stringify(apiResponse, null, 2)}\n\nNow, provide your final answer to the user based on this data.`;
        
        result = await chat.sendMessage(followUpMessage);

      } catch (dbError: any) {
        console.error("Firebase Tool Error:", dbError);
        // If DB fails, tell the AI so it can apologize via text instead of functionResponse
        const errorMessage = `[SYSTEM: Tool '${call.name}' failed with a technical error. Please apologize to the user and inform them that the database is currently unreachable.]`;
        result = await chat.sendMessage(errorMessage);
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
