require("dotenv").config({ path: ".env.local" });
const { GoogleGenerativeAI } = require("@google/generative-ai");
async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    await model.generateContent("hello");
    console.log("gemini-flash-latest SUCCESS");
  } catch(e) {
    console.log("gemini-flash-latest FAILED", e.message);
  }
}
test();
