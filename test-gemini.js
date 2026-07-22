require("dotenv").config({ path: ".env.local" });
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

async function test() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log("No API key");
        return;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
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
                }
              }
            }
          }
        }
      }
    });

    const prompt = `Extract all details from this POS "Detailed Sales Report (Tax Included in Sales)" exactly as written.`;
    console.log("Sending to Gemini...");
    
    // We'll use a tiny 1x1 base64 image just to see if the schema is accepted
    const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/png"
        }
      }
    ]);

    console.log("Response:", result.response.text());
  } catch(e) {
    console.error("FAILED:", e);
  }
}
test();
