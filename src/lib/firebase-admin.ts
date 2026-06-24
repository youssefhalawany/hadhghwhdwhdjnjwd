import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function getAdminDb() {
  if (!getApps().length) {
    try {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || '',
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '',
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
        }),
      });
    } catch (error: any) {
      console.error('Firebase admin initialization error', error.stack);
    }
  }
  return getFirestore();
}
