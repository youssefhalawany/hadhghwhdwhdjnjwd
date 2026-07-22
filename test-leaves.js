const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
if (!getApps().length) {
  initializeApp({
    projectId: "ckkk-576e7"
  });
}
async function run() {
  try {
    const adminDb = getFirestore();
    const leavesSnapshot = await adminDb.collection('leave_requests').get();
    leavesSnapshot.docs.forEach(doc => console.log(doc.id, doc.data()));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
