import { getAdminDb } from "./src/lib/firebase-admin";
import * as fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
});

async function run() {
  const db = getAdminDb();
  const snapshot = await db.collection("shift_reports").where("status", "==", "pending_manager").get();
  console.log("Pending reports count:", snapshot.size);
  snapshot.docs.forEach((doc: any) => {
    console.log("Report ID:", doc.id);
    console.dir(doc.data(), { depth: null });
  });
}

run().catch(console.error);
