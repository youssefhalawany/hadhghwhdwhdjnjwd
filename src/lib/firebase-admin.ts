import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export function getAdminDb() {
  if (!getApps().length) {
    try {
      let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');

      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || '',
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '',
          privateKey: privateKey,
        }),
      });
    } catch (error: any) {
      console.error('Firebase admin initialization error', error.stack);
    }
  }
  return getFirestore();
}

export function getAdminAuth() {
  getAdminDb(); // Ensures app is initialized
  return getAuth();
}
