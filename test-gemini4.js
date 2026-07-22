require("dotenv").config({ path: ".env.local" });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test(modelName) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("hello");
    console.log(modelName, "SUCCESS");
  } catch(e) {
    console.log(modelName, "FAILED", e.message);
  }
}
async function run() {
  await test("gemini-2.0-flash");
  await test("gemini-flash-latest");
}
run();
