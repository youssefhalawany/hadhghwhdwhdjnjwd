import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, ".env.local") });

async function run() {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.error("No key");
      return;
    }
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();
    console.log(data.models.map((m: any) => m.name));
  } catch (err) {
    console.error(err);
  }
}
run();
