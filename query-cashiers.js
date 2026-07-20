const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

const firebaseConfig = {
  projectId: "ckkk-576e7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "cashiers"));
  snap.docs.forEach(d => console.log(d.id, d.data()));
  process.exit(0);
}
run();
