const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Using the local emulator or default credentials won't work easily if we don't have the service account.
// Since the user is testing on localhost, maybe it's connected to production. 
