require("dotenv").config({ path: ".env.local" });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testAll() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  
  if (!data.models) {
      console.log("No models returned");
      return;
  }
  
  for (const m of data.models) {
    if (!m.supportedGenerationMethods.includes("generateContent")) continue;
    
    const modelName = m.name.replace("models/", "");
    console.log(`Testing ${modelName}...`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      await model.generateContent("hello");
      console.log(`✅ ${modelName} SUCCESS`);
      // Stop at the first successful model
      process.exit(0);
    } catch(e) {
      console.log(`❌ ${modelName} FAILED: ${e.message.split('\n')[0]}`);
    }
  }
}
testAll();
