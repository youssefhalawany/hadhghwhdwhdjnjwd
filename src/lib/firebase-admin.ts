import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { getStorage, Storage } from 'firebase-admin/storage';

export function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  try {
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n').trim();

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'ckkk-576e7';
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (projectId && clientEmail && privateKey) {
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      return initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      return initializeApp({
        projectId: 'ckkk-576e7',
      });
    }
  } catch (error: any) {
    console.error('Firebase Admin App initialization error:', error);
    if (getApps().length > 0) {
      return getApp();
    }
    return initializeApp({ projectId: 'ckkk-576e7' });
  }
}

export function getAdminDb(): Firestore {
  const app = getAdminApp();
  return getFirestore(app);
}

export function getAdminAuth(): Auth {
  const app = getAdminApp();
  return getAuth(app);
}

export function getAdminMessaging(): Messaging {
  const app = getAdminApp();
  return getMessaging(app);
}

export function getAdminStorage(): Storage {
  const app = getAdminApp();
  return getStorage(app);
}
