import { getAdminApp, getAdminDb, getAdminAuth, getAdminMessaging, getAdminStorage } from './firebase-admin';

// Initialize and export unified Firebase Admin singletons
export { getAdminApp, getAdminDb, getAdminAuth, getAdminMessaging, getAdminStorage };

let adminDbInstance: any = null;
let adminAuthInstance: any = null;
let adminMessagingInstance: any = null;
let adminStorageInstance: any = null;

try {
  adminDbInstance = getAdminDb();
} catch (e) {
  console.warn("firebaseAdmin top-level adminDb init skipped:", e);
}

try {
  adminAuthInstance = getAdminAuth();
} catch (e) {
  console.warn("firebaseAdmin top-level adminAuth init skipped:", e);
}

try {
  adminMessagingInstance = getAdminMessaging();
} catch (e) {
  console.warn("firebaseAdmin top-level adminMessaging init skipped:", e);
}

try {
  adminStorageInstance = getAdminStorage();
} catch (e) {
  console.warn("firebaseAdmin top-level adminStorage init skipped:", e);
}

export const adminDb = adminDbInstance;
export const adminAuth = adminAuthInstance;
export const adminMessaging = adminMessagingInstance;
export const adminStorage = adminStorageInstance;
