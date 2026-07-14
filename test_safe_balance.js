const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  try {
    const snapshot = await db.collection('safe_balance').limit(2).get();
    if (snapshot.empty) {
      console.log('No safe_balance documents found.');
    } else {
      snapshot.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
      });
    }
  } catch (err) {
    console.error(err);
  }
}
run();
