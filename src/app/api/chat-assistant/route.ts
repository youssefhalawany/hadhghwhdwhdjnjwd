import { NextResponse } from "next/server";
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { productsDb, db } from "@/lib/firebase";
import { adminDb } from "@/lib/firebaseAdmin";
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// In-memory cache to save Firebase reads
const cache = {
  products: null as any[] | null,
  foodCodes: null as any[] | null,
  lastFetch: 0
};
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour

function formatCurr(val: any): string {
  if (val === null || val === undefined || val === "" || val === "غير متوفر حالياً") return "EGP 0.00";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return `EGP ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const getDailySalesDeclaration: FunctionDeclaration = {
  name: "get_daily_sales",
  description: "Retrieves the detailed daily sales report for a specific date from the POS database. Use this when the user asks for sales totals, category breakdowns, or performance for a specific day or yesterday.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      date: {
        type: SchemaType.STRING,
        description: "The date to query in YYYY-MM-DD format (e.g., '2026-07-30')."
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
    properties: {},
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

const getProductInfoDeclaration: FunctionDeclaration = {
  name: "get_product_info",
  description: "Fetches the barcode, current price, and exact description of a product in English and Arabic. Use this when the user asks 'What is the barcode of...', 'How much is...', or 'Find the product...'",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      searchQuery: {
        type: SchemaType.STRING,
        description: "The name of the product to search for, in English or Arabic."
      }
    },
    required: ["searchQuery"]
  }
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history, branchId, cachedBalances } = body;

    if (!message) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    // Determine current local date & yesterday's date
    const now = new Date();
    const today = now.toLocaleDateString('en-CA'); // e.g. "2026-07-31"
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterday = yesterdayDate.toLocaleDateString('en-CA'); // e.g. "2026-07-30"

    let balanceContext = "";
    if (cachedBalances && cachedBalances.safe) {
      balanceContext = `
--- ZERO READS FINANCIAL DATA MEMORY ---
You already know the following real-time data because you memorized it from the user's dashboard. DO NOT use any tools to fetch these, just answer immediately with these exact numbers if asked:
- Safe Balance (Cash available in branch): ${formatCurr(cachedBalances.safe)}
- Bank Balance: ${formatCurr(cachedBalances.bank)}
- Total Cash Payments to Suppliers: ${formatCurr(cachedBalances.cashPayments)}
- Total Bank/Visa Payments to Suppliers: ${formatCurr(cachedBalances.bankPayments)}
- Customer Credits Collected (Debts Paid to us): ${formatCurr(cachedBalances.creditsCollected)}
- Total Payrolls & Loans pulled from safe: ${formatCurr(cachedBalances.payrollsAndLoans)}
- Cash Drops (Deposits out of Safe to owner/bank): ${formatCurr(cachedBalances.depositsOutSafe)}
- Cash Injections (Deposits into Safe from owner): ${formatCurr(cachedBalances.depositsInSafe)}
- Bank Deposits In: ${formatCurr(cachedBalances.depositsInBank)}
- Bank Deposits Out: ${formatCurr(cachedBalances.depositsOutBank)}
----------------------------------------`;

      if (cachedBalances.detailedPayments) {
        balanceContext += `\n\n--- DETAILED SUPPLIER PAYMENTS (ZERO READS) ---\nHere are the most recent supplier payments in detail:\n${cachedBalances.detailedPayments}\n----------------------------------------`;
      }
      if (cachedBalances.detailedDeposits) {
        balanceContext += `\n\n--- DETAILED DEPOSITS (ZERO READS) ---\nHere are the most recent deposits in detail:\n${cachedBalances.detailedDeposits}\n----------------------------------------`;
      }
      if (cachedBalances.detailedCredits) {
        balanceContext += `\n\n--- DETAILED CUSTOMER CREDITS (ZERO READS) ---\nHere are the most recent customer credits in detail:\n${cachedBalances.detailedCredits}\n----------------------------------------`;
      }
    }

    // Construct system prompt
    const systemInstruction = `
You are Ibrahim, the expert Operations Manager Assistant (مساعد مدير) for Circle K. Your job is to help the franchise owner or manager run their branch efficiently.
You communicate clearly, professionally, but in a very COOL and FUN Egyptian Arabic dialect (اللغة العامية المصرية). You can call the user "يا ريس" or "يا باشا". 
ALWAYS mirror the exact language the user speaks to you in. If they speak Egyptian Arabic, reply in pure, fun Egyptian 3ameya. If they speak English, reply in English. If they speak Franco-Arabic (e.g., "ezayak ya ibrahim"), reply in Franco-Arabic. Your default starting persona is a friendly, street-smart Egyptian manager assistant.
The user is currently managing the branch with ID: "${branchId}". 
Today's date is: ${today}.
Yesterday's date is: ${yesterday}.${balanceContext}

You have access to live database tools to query sales, shift audits, and expiries. 
If the user asks for sales numbers ("مبيعات", "خلاصة مبيعات", "مبيعات امبارح"), shortages, or expiring items, YOU MUST CALL YOUR TOOLS ('get_daily_sales' with date "${yesterday}" for yesterday, or 'get_historical_sales') to fetch the data first before answering. 
Do not guess numbers. If a tool returns data, summarize sales total, net sales, category breakdowns, and shift performance clearly.

CRITICAL CURRENCY FORMATTING:
ALWAYS format all monetary amounts cleanly with exact 2 decimal places and thousands commas (e.g., "EGP 25,252.94", "EGP 699,931.84"). NEVER display unformatted raw numbers like "25252.94000000006".

CHARTING INSTRUCTIONS:
If the user explicitly asks you to "draw", "plot", or "chart" data (e.g. "إرسملي مبيعات الأسبوع ده" or "Show me a chart"), you MUST respond EXACTLY and ONLY with a JSON payload in this exact format, with NO backticks or extra text around it:
[CHART]
{"title": "مبيعات الأسبوع", "data": [{"name": "السبت", "value": 5000}, {"name": "الأحد", "value": 5500}]}
- When displaying lists, use clean bullet points (•) and natural spacing. DO NOT overuse markdown bolding (**). Keep your formatting incredibly clean, professional, and visually pleasing.
- Keep your tone 100% natural and conversational. Avoid sounding like an AI reading a script.
`;

    // Sanitize and format chat history to strictly adhere to Gemini's role sequence rules
    const cleanHistory: any[] = [];
    (history || []).forEach((msg: any) => {
      if (!msg || !msg.content || typeof msg.content !== "string" || !msg.content.trim()) return;
      const role = msg.role === "assistant" || msg.role === "model" ? "model" : "user";
      
      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === role) {
        cleanHistory[cleanHistory.length - 1].parts[0].text += `\n${msg.content}`;
      } else {
        cleanHistory.push({
          role: role,
          parts: [{ text: msg.content }]
        });
      }
    });

    // Gemini strictly requires the history array to start with a 'user' role.
    while (cleanHistory.length > 0 && cleanHistory[0].role === "model") {
      cleanHistory.shift();
    }

    // Active verified working Gemini models in order of current availability
    const MODEL_CANDIDATES = [
      "gemini-3.6-flash",
      "gemini-3-flash-preview",
      "gemma-4-31b-it",
      "gemini-3.1-flash-lite",
      "gemma-4-26b-a4b-it",
      "gemini-3.5-flash",
      "gemini-3.7-flash"
    ];
    
    let result: any = null;
    let activeChat: any = null;
    let lastError: any = null;

    // Multi-model fallback loop
    for (const modelName of MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction,
          tools: [{ functionDeclarations: [
            getDailySalesDeclaration,
            getHistoricalSalesDeclaration,
            getShiftAuditsDeclaration,
            getExpiriesWatcherDeclaration,
            getSalesPredictorDeclaration,
            getVendorOrderDeclaration,
            getProductInfoDeclaration
          ] }]
        });

        const chat = model.startChat({ history: cleanHistory });
        result = await chat.sendMessage(message);
        if (result) {
          activeChat = chat;
          break; // Successfully received response
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} failed/rate limited:`, err.message || err);
        lastError = err;
      }
    }

    if (!result) {
      // Fallback: try generating content directly without tools if startChat/tools failed
      for (const fallbackModel of ["gemini-3.6-flash", "gemini-3-flash-preview", "gemma-4-31b-it", "gemini-3.1-flash-lite"]) {
        try {
          const directModel = genAI.getGenerativeModel({ model: fallbackModel });
          const directPrompt = `${systemInstruction}\n\nUser says: "${message}"\n\nPlease answer in your Egyptian assistant persona.`;
          const directRes = await directModel.generateContent(directPrompt);
          if (directRes && directRes.response) {
            return NextResponse.json({ success: true, reply: directRes.response.text() });
          }
        } catch (e) {
          console.warn(`Direct fallback on ${fallbackModel} failed:`, e);
        }
      }

      // Fallback local response if all models rate limited or failed
      const safeBal = cachedBalances?.safe ? formatCurr(cachedBalances.safe) : "غير متوفر حالياً";
      const bankBal = cachedBalances?.bank ? formatCurr(cachedBalances.bank) : "غير متوفر حالياً";
      const fallbackReply = `يا ريس، السيرفر عليه ضغط بسيط دلوقتي من جوجل، بس أنا معاك ومتابع بيانات الفرع:\n\n• رصيد الخزينة: ${safeBal}\n• رصيد البنك: ${bankBal}\n\nجرب تسألني تاني وهكون معاك فوراً يا باشا! 🫡`;
      return NextResponse.json({ success: true, reply: fallbackReply });
    }
    
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
          let targetDate = args.date || yesterday;
          if (targetDate === "yesterday" || targetDate === "امبارح") targetDate = yesterday;
          if (targetDate === "today" || targetDate === "النهارده") targetDate = today;
          
          console.log(`AI executing get_daily_sales for branch: ${branchId}, date: ${targetDate}`);
          
          // 1. Try detailed_sales_daily in productsDb
          try {
            const q = query(
              collection(productsDb, "detailed_sales_daily"),
              where("date_sold", "==", targetDate),
              limit(20)
            );
            const snapshot = await getDocs(q);
            const matchingDoc = snapshot.docs.find(d => {
              const b = d.data().branchId;
              return b === branchId || b === altBranch;
            });
            if (matchingDoc) {
              apiResponse = matchingDoc.data();
            }
          } catch (e) {
            console.warn("productsDb detailed_sales_daily query error:", e);
          }

          // 2. Also query daily sales entries from main `sales` collection in db
          try {
            const salesSnap = await getDocs(query(collection(db, "sales"), limit(150)));
            const daySales: any[] = [];
            salesSnap.forEach(doc => {
              const data = doc.data();
              if ((data.branchId === branchId || data.branchId === altBranch) && data.date === targetDate) {
                daySales.push(data);
              }
            });

            if (daySales.length > 0) {
              let totalCash = 0, totalVisa = 0, totalOverShort = 0;
              const shifts: any[] = [];
              daySales.forEach(s => {
                const c = Number(s.cash) || 0;
                const v = Number(s.visa) || 0;
                const os = Number(s.overShort) || 0;
                totalCash += c;
                totalVisa += v;
                totalOverShort += os;
                shifts.push({
                  shift: s.shift || "Unknown",
                  cash: c,
                  visa: v,
                  overShort: os,
                  notes: s.notes
                });
              });

              if (apiResponse) {
                apiResponse.shiftEntries = shifts;
                apiResponse.recordedCash = totalCash;
                apiResponse.recordedVisa = totalVisa;
                apiResponse.recordedOverShort = totalOverShort;
              } else {
                apiResponse = {
                  date: targetDate,
                  branchId,
                  totalSales: totalCash + totalVisa + totalOverShort,
                  totalCash,
                  totalVisa,
                  totalOverShort,
                  shifts
                };
              }
            }
          } catch (sErr) {
            console.warn("db sales query error:", sErr);
          }

          if (!apiResponse) {
            apiResponse = {
              date: targetDate,
              branchId,
              message: `لا توجد مبيعات مسجلة حتى الآن لتاريخ ${targetDate} في فرع ${branchId}.`
            };
          }
        } 
        else if (call.name === "get_historical_sales") {
          console.log(`AI executing get_historical_sales for branch: ${branchId}`);
          const allSales: any[] = [];
          
          try {
            const snapshot = await getDocs(query(collection(productsDb, "detailed_sales_daily"), limit(50)));
            snapshot.forEach(doc => {
              const data = doc.data();
              if (data.branchId === branchId || data.branchId === altBranch) {
                allSales.push(data);
              }
            });
          } catch (e) {
            console.warn("get_historical_sales productsDb error:", e);
          }

          if (allSales.length === 0) {
            try {
              const sSnap = await getDocs(query(collection(db, "sales"), limit(100)));
              sSnap.forEach(doc => {
                const data = doc.data();
                if (data.branchId === branchId || data.branchId === altBranch) {
                  allSales.push(data);
                }
              });
            } catch (err) {
              console.warn("get_historical_sales db error:", err);
            }
          }
          
          apiResponse = allSales.slice(0, 10).length > 0 ? allSales.slice(0, 10) : { message: "لا توجد بيانات تاريخية مسجلة للفرع بعد." };
        }
        else if (call.name === "get_shift_audits") {
          console.log(`AI executing get_shift_audits for branch: ${branchId}`);
          
          let audits: any[] = [];
          if (adminDb) {
            try {
              const snapshot = await adminDb.collection("shift_reports").limit(50).get();
              snapshot.forEach(doc => {
                const data = doc.data();
                if (data.branchId === branchId || data.branchId === altBranch) {
                  audits.push(data);
                }
              });
            } catch (err) {
              console.warn("adminDb shift_reports query failed, trying client db:", err);
            }
          }

          if (audits.length === 0) {
            try {
              const snap = await getDocs(query(collection(db, "shift_reports"), limit(50)));
              snap.forEach(doc => {
                const data = doc.data();
                if (data.branchId === branchId || data.branchId === altBranch) {
                  audits.push(data);
                }
              });
            } catch (cErr) {
              console.warn("client db shift_reports query failed:", cErr);
            }
          }
          
          const recentAudits = audits.slice(0, 15).map(data => ({
             shift: data.cashierDetails?.shift || "Unknown",
             cashierName: data.cashierDetails?.name || "Unknown",
             date: data.cashierDetails?.date || data.createdAt,
             cashVariance: data.managerAudit?.cashVariance || 0,
             visaVariance: data.managerAudit?.visaVariance || 0,
             status: data.status
          }));
          
          apiResponse = recentAudits.length > 0 ? recentAudits : { message: "كل شيفتات امبارح كانت تمام ومفيش أي عجز مسجل يا ريس." };
        }
        else if (call.name === "get_expiries_watcher") {
          console.log(`AI executing get_expiries_watcher for branch: ${branchId}`);
          
          let activeExpiries: any[] = [];
          const processExpiryDoc = (data: any) => {
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
          };

          if (adminDb) {
            try {
              const snapshot = await adminDb.collection("expiries").limit(200).get();
              snapshot.forEach(doc => processExpiryDoc(doc.data()));
            } catch (err) {
              console.warn("adminDb expiries query failed, trying client db:", err);
            }
          }

          if (activeExpiries.length === 0) {
            try {
              const snap = await getDocs(query(collection(db, "expiries"), limit(200)));
              snap.forEach(doc => processExpiryDoc(doc.data()));
            } catch (cErr) {
              console.warn("client db expiries query failed:", cErr);
            }
          }
          
          activeExpiries.sort((a, b) => (a.expiryDate || "").localeCompare(b.expiryDate || ""));
          apiResponse = activeExpiries.length > 0 ? activeExpiries.slice(0, 20) : { message: "مفيش أي منتجات قريبة من الصلاحية أو منتهية في الفرع حالياً يا ريس، كله تمام!" };
        }
        else if (call.name === "get_sales_predictor") {
           console.log(`AI executing get_sales_predictor for branch: ${branchId}`);
           
           const q = query(
            collection(productsDb, "detailed_sales_daily"),
            orderBy("date_sold", "desc"),
            limit(150)
          );
          const snapshot = await getDocs(q);
          const allSales: any[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.branchId === branchId || data.branchId === altBranch) {
              allSales.push(data);
            }
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
           
           const qSales = query(
            collection(productsDb, "detailed_sales_daily"),
            where("branchId", "in", [branchId, altBranch]),
            limit(14)
          );
          const salesSnap = await getDocs(qSales);
          const allCategoriesSales: any = {};
          salesSnap.forEach(doc => {
            const data = doc.data();
            if (data.categories) {
              Object.entries(data.categories).forEach(([catName, amount]) => {
                allCategoriesSales[catName] = (allCategoriesSales[catName] || 0) + (amount as number);
              });
            }
          });

          if (!cache.products || Date.now() - cache.lastFetch > CACHE_DURATION_MS) {
             const pSnap = await getDocs(collection(productsDb, "products"));
             cache.products = [];
             pSnap.forEach(doc => cache.products!.push(doc.data()));
             cache.lastFetch = Date.now();
          }
          
          const matchingItems: any[] = [];
          cache.products.forEach(data => {
            if (data.priceHistory && Array.isArray(data.priceHistory)) {
              const matchesSupplier = data.priceHistory.some((ph: any) => {
                const supplierStr = (ph.supplier || "").toLowerCase();
                const vName = vendorName.toLowerCase();
                return supplierStr.includes(vName) || vName.includes(supplierStr);
              });
              if (matchesSupplier && matchingItems.length < 50) {
                matchingItems.push({
                  barcode: data.barcode,
                  description: data.description,
                  price: data.currentPrice
                });
              }
            }
          });
          
          apiResponse = {
            vendorRequested: vendorName,
            recentSalesByAllCategories: allCategoriesSales,
            matchingSupplierItems: matchingItems,
            instructions: "Identify which category the vendor belongs to and use the recent sales volume to gauge order sizes. Crucially, ONLY use the actual items provided in 'matchingSupplierItems' for this vendor. Write a realistic, fun purchase order list in Egyptian Arabic featuring these exact items and estimated quantities based on sales."
          };
        }
        else if (call.name === "get_product_info") {
          const args = (call.args as any) || {};
          const searchQuery = (args.searchQuery || "").toLowerCase();
          console.log(`AI executing get_product_info for query: ${searchQuery}`);

          if (!cache.products || !cache.foodCodes || Date.now() - cache.lastFetch > CACHE_DURATION_MS) {
             const [pSnap, fSnap] = await Promise.all([
               getDocs(collection(productsDb, "products")),
               getDocs(collection(productsDb, "food_codes"))
             ]);
             cache.products = [];
             cache.foodCodes = [];
             pSnap.forEach(doc => cache.products!.push(doc.data()));
             fSnap.forEach(doc => cache.foodCodes!.push(doc.data()));
             cache.lastFetch = Date.now();
          }

          const foundProducts: any[] = [];
          
          cache.products.forEach(data => {
            if (data.description && data.description.toLowerCase().includes(searchQuery)) {
              if (foundProducts.length < 10) foundProducts.push(data);
            } else if (data.barcode && data.barcode.includes(searchQuery)) {
              if (foundProducts.length < 10) foundProducts.push(data);
            }
          });

          const foundFoodCodes: any[] = [];
          cache.foodCodes.forEach(data => {
            if ((data.nameAr && data.nameAr.toLowerCase().includes(searchQuery)) || 
                (data.nameEn && data.nameEn.toLowerCase().includes(searchQuery)) ||
                (data.itemCode && data.itemCode.includes(searchQuery))) {
              if (foundFoodCodes.length < 10) foundFoodCodes.push(data);
            }
          });

          apiResponse = {
            searchQuery,
            productsMatches: foundProducts.map(p => ({ barcode: p.barcode, description: p.description, price: p.currentPrice })),
            foodCodesMatches: foundFoodCodes.map(f => ({ code: f.itemCode, nameAr: f.nameAr, nameEn: f.nameEn, category: f.categoryAr })),
            instructions: "Present the findings to the user. Give them the exact barcode and price in a friendly Egyptian Arabic way."
          };
        }

        if (activeChat) {
          try {
            result = await activeChat.sendMessage([{
              functionResponse: {
                name: call.name,
                response: { data: apiResponse }
              }
            }]);
          } catch (fnErr) {
            console.warn("Function response turn failed, generating with direct prompt fallback:", fnErr);
            const fallbackPrompt = `${systemInstruction}\n\nUser Question: "${message}"\nTool Data from database for '${call.name}':\n${JSON.stringify(apiResponse, null, 2)}\n\nPlease provide your helpful answer to the user in your Egyptian assistant persona based on this data.`;
            const fbModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            result = await fbModel.generateContent(fallbackPrompt);
          }
        }

      } catch (dbError: any) {
        console.error("Firebase Tool Error:", dbError);
        const errorMessage = `[SYSTEM: Tool '${call.name}' failed with a technical error. Please apologize to the user and inform them that the database is currently unreachable.]`;
        if (activeChat) {
          try {
            result = await activeChat.sendMessage([{
              functionResponse: {
                name: call.name,
                response: { error: "Database temporarily unreachable" }
              }
            }]);
          } catch {
            const fbModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            result = await fbModel.generateContent(`يا ريس معلش الداتابيز مش مستجيبة للحظة، بس أنا معاك.`);
          }
        }
      }
    }

    let responseText = "";
    try {
      responseText = result?.response?.text ? result.response.text() : "";
    } catch (textErr) {
      console.warn("Failed to get response.text(), extracting candidate text:", textErr);
      const candidate = result?.response?.candidates?.[0];
      if (candidate?.content?.parts?.[0]?.text) {
        responseText = candidate.content.parts[0].text;
      }
    }

    if (!responseText) {
      responseText = "يا ريس أنا معاك! اسألني عن مبيعات امبارح أو الشيفتات أو الصلاحيات وهرد عليك فوراً يا باشا 🫡";
    }

    return NextResponse.json({
      success: true,
      reply: responseText
    });

  } catch (error: any) {
    console.error("AI Chat Error:", error);
    const fallbackReply = "يا ريس، السيرفر عليه ضغط بسيط دلوقتي، بس أنا معاك ومتابع بيانات الفرع! اسألني تاني وهرد عليك فوراً يا باشا 🫡";
    return NextResponse.json(
      { success: true, reply: fallbackReply },
      { status: 200 }
    );
  }
}
