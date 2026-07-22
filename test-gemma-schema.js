require("dotenv").config({ path: ".env.local" });
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = "gemma-4-26b-a4b-it";
  try {
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            hello: { type: SchemaType.STRING }
          }
        }
      }
    });
    const result = await model.generateContent("Say hello in JSON");
    console.log(`✅ ${modelName} SUCCESS:`, result.response.text());
  } catch(e) {
    console.log(`❌ ${modelName} FAILED: ${e.message}`);
  }
}
test();
