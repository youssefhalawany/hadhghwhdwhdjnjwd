import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyFakeKey",
  projectId: "circle-k-reports",
  appId: "1:1234:web:5678"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'sales'));
  snap.docs.slice(0, 5).forEach(d => console.log(d.id, d.data().date));
  process.exit(0);
}
run();
