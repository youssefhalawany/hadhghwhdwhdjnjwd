const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyC28heBX9KUAK--AvXe1bTy06J9sss_C2Q",
  projectId: "ckkk-576e7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

(async () => {
  const snap = await getDocs(collection(db, "cashiers"));
  snap.docs.forEach(d => {
    const data = d.data();
    for (const key in data) {
      if (typeof data[key] === 'object' && data[key] !== null) {
         console.log('CASHIER HAS OBJECT:', d.id, key, data[key]);
      }
    }
  });
  console.log('Checked cashiers.');
  
  const snap2 = await getDocs(collection(db, "shift_reports"));
  snap2.docs.forEach(d => {
    const data = d.data();
    if (typeof data.managerAudit === 'object' && data.managerAudit !== null) {
      for (const k in data.managerAudit) {
        if (typeof data.managerAudit[k] === 'object' && data.managerAudit[k] !== null) {
          console.log('REPORT HAS OBJECT IN managerAudit:', d.id, k, data.managerAudit[k]);
        }
      }
    }
  });
  console.log('Checked shift_reports.');
})();
