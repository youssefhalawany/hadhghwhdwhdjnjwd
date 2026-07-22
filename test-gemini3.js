require("dotenv").config({ path: ".env.local" });
async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.models) {
    console.log("AVAILABLE MODELS:");
    for (const m of data.models) {
      if (m.supportedGenerationMethods.includes("generateContent")) {
        console.log(m.name);
      }
    }
  } else {
    console.log(data);
  }
}
test();
