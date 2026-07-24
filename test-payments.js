const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const snapshot = await db.collection('cash_payments')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
    
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`Payment ID: ${doc.id}`);
    console.log(`Company: ${data.companyName}`);
    console.log(`CreatedAt: ${data.createdAt ? data.createdAt.toDate() : 'MISSING/NULL'}`);
    console.log(`InvoiceUrl length: ${data.invoiceUrl ? data.invoiceUrl.length : 'none'}`);
    console.log('---');
  });
}

check().catch(console.error);
