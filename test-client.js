const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, orderBy, limit, getDocs } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyC28heBX9KUAK--AvXe1bTy06J9sss_C2Q",
  authDomain: "ckkk-576e7.firebaseapp.com",
  projectId: "ckkk-576e7",
  storageBucket: "ckkk-576e7.firebasestorage.app",
  messagingSenderId: "174398232186",
  appId: "1:174398232186:web:a94c68480f27e25a668dc3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  try {
    const q = query(collection(db, "cash_payments"), orderBy("createdAt", "desc"), limit(5));
    const snap = await getDocs(q);
    snap.docs.forEach(doc => {
      const data = doc.data();
      console.log("ID:", doc.id);
      console.log("Company:", data.companyName);
      console.log("Date:", data.date);
      console.log("URL Length:", data.invoiceUrl ? data.invoiceUrl.length : 0);
      console.log("Amount:", data.amount);
      console.log("---");
    });
  } catch (err) {
    console.error(err);
  }
}

check();
