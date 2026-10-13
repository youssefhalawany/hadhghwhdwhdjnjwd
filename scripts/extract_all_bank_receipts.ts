import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getAdminDb } from "../src/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

function normalizeName(name: string): string {
  if (!name) return "";
  let n = name.trim().toLowerCase();
  n = n.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
  if (n.includes("edita") || n.includes("اديتا")) return "edita";
  if (n.includes("juhayna") || n.includes("juhyana") || n.includes("جهينه")) return "juhayna";
  if (n.includes("trans") || n.includes("ترانس")) return "trans business";
  if (n.includes("tmt")) return "tmt";
  if (n.includes("general commerce") || n.includes("التجارة العامة")) return "general commerce";
  if (n.includes("auf") || n.includes("a.u.f") || n.includes("عوف")) return "auf egypt";
  if (n.includes("kellogg") || n.includes("كيلوج")) return "kellogg";
  if (n.includes("mars") || n.includes("مارس")) return "mars egypt";
  return n;
}

async function extractOne(docRef: FirebaseFirestore.DocumentReference, receiptUrl: string): Promise<any> {
  let base64Data = receiptUrl;
  let mimeType = "image/jpeg";
  if (receiptUrl.includes(";base64,")) {
    const parts = receiptUrl.split(";base64,");
    base64Data = parts[1];
    const match = parts[0].match(/data:(.*)/);
    if (match && match[1]) mimeType = match[1];
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash-lite",
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  });

  const prompt = `
Extract Egyptian bank transfer details as JSON:
1. "bankName": Bank name (e.g. Banque Misr, CIB, NBE, QNB, InstaPay)
2. "beneficiaryName": Recipient / company name
3. "bankAccountNumber": Account number, IBAN, or InstaPay IPA
4. "transferReference": Transaction ID / Ref No
5. "senderName": Payer name
6. "transferDate": Date (YYYY-MM-DD)
`;

  const res = await model.generateContent([
    prompt,
    { inlineData: { data: base64Data, mimeType } },
  ]);

  const parsed = JSON.parse(res.response.text());
  return parsed;
}

async function run() {
  const db = getAdminDb();
  console.log("Loading all cash_payments with bank receipts...");
  const snap = await db.collection("cash_payments").where("bankTransferReceiptUrl", "!=", null).get();
  console.log(`Found ${snap.size} total docs.`);

  // Step 1: Map existing verified company banking profiles
  const companyBankKnowledge = new Map<string, { bankName: string; bankAccountNumber: string; beneficiaryName: string }>();

  snap.forEach((d) => {
    const data = d.data();
    if (data.bankName && data.bankAccountNumber) {
      const norm = normalizeName(data.companyName);
      if (norm && !companyBankKnowledge.has(norm)) {
        companyBankKnowledge.set(norm, {
          bankName: data.bankName,
          bankAccountNumber: data.bankAccountNumber,
          beneficiaryName: data.beneficiaryName || data.companyName,
        });
      }
    }
  });

  console.log("Known company bank details:", Array.from(companyBankKnowledge.keys()));

  // Step 2: Iterate through all docs. For those missing details:
  // If company is in knowledge base, update with company bank.
  // Otherwise, call Gemini-3.5-flash-lite with a 4-second gap.
  let newlyExtracted = 0;
  let propagated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const hasDetails = data.bankName && data.bankAccountNumber;
    if (hasDetails) continue;

    const norm = normalizeName(data.companyName);

    // Try AI extraction first for individual receipt ref and details
    console.log(`Processing ${doc.id} (${data.companyName})...`);
    try {
      const extracted = await extractOne(doc.ref, data.bankTransferReceiptUrl);
      console.log(`  ✓ AI Extracted: Bank: ${extracted.bankName} | Acct: ${extracted.bankAccountNumber} | Ref: ${extracted.transferReference}`);

      await doc.ref.update({
        bankName: extracted.bankName || (companyBankKnowledge.get(norm)?.bankName || ""),
        bankAccountNumber: extracted.bankAccountNumber || (companyBankKnowledge.get(norm)?.bankAccountNumber || ""),
        beneficiaryName: extracted.beneficiaryName || (companyBankKnowledge.get(norm)?.beneficiaryName || data.companyName),
        transferReference: extracted.transferReference || "",
        bankSenderName: extracted.senderName || "",
        bankExtractedAt: new Date().toISOString(),
      });

      if (extracted.bankName && extracted.bankAccountNumber && !companyBankKnowledge.has(norm)) {
        companyBankKnowledge.set(norm, {
          bankName: extracted.bankName,
          bankAccountNumber: extracted.bankAccountNumber,
          beneficiaryName: extracted.beneficiaryName || data.companyName,
        });
      }

      newlyExtracted++;
      // Wait 3.5s before next AI call
      await new Promise((r) => setTimeout(r, 3500));
    } catch (e: any) {
      console.warn(`  ✗ AI failed on ${doc.id}: ${e.message?.substring(0, 100)}`);
      // Fallback to company knowledge if known
      if (companyBankKnowledge.has(norm)) {
        const kb = companyBankKnowledge.get(norm)!;
        await doc.ref.update({
          bankName: kb.bankName,
          bankAccountNumber: kb.bankAccountNumber,
          beneficiaryName: kb.beneficiaryName,
          bankExtractedAt: new Date().toISOString(),
        });
        console.log(`  ✓ Propagated known company bank details for ${norm}: ${kb.bankName} - ${kb.bankAccountNumber}`);
        propagated++;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log("\n================ FINISHED ================");
  console.log(`Newly AI extracted: ${newlyExtracted}`);
  console.log(`Propagated from company knowledge: ${propagated}`);
}

run().catch(console.error);
