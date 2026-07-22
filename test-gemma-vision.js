require("dotenv").config({ path: ".env.local" });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = "gemma-4-26b-a4b-it";
  console.log(`Testing ${modelName} with image...`);
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const result = await model.generateContent([
      "hello",
      { inlineData: { data: base64Data, mimeType: "image/png" } }
    ]);
    console.log(`✅ ${modelName} SUCCESS`);
  } catch(e) {
    console.log(`❌ ${modelName} FAILED: ${e.message}`);
  }
}
test();
