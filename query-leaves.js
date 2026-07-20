const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const app = initializeApp({ projectId: "ckkk-576e7" });
const db = getFirestore(app);
async function run() {
  const snap = await getDocs(collection(db, "leave_requests"));
  snap.docs.forEach(d => console.log(d.id, d.data()));
  process.exit(0);
}
run();
