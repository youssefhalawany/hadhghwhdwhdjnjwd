const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyC28heBX9KUAK--AvXe1bTy06J9sss_C2Q",
  projectId: "ckkk-576e7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "products"), limit(1));
  snap.forEach(doc => console.log(doc.data()));
  process.exit(0);
}
run();
