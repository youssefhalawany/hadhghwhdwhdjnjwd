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

      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'ckkk-576e7';
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';

      if (clientEmail && privateKey) {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      } else {
        initializeApp({
          projectId: 'ckkk-576e7'
        });
      }
    } catch (error: any) {
      console.error('Firebase admin initialization error', error.stack);
      try {
        if (!getApps().length) {
          initializeApp({ projectId: 'ckkk-576e7' });
        }
      } catch {}
    }
  }
  return getFirestore();
}

export function getAdminAuth() {
  getAdminDb(); // Ensures app is initialized
  return getAuth();
}
