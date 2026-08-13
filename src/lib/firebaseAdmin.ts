import { getAdminApp, getAdminDb, getAdminAuth, getAdminMessaging, getAdminStorage } from './firebase-admin';

// Initialize and export unified Firebase Admin singletons
export { getAdminApp, getAdminDb, getAdminAuth, getAdminMessaging, getAdminStorage };

export const adminDb = getAdminDb();
export const adminAuth = getAdminAuth();
export const adminMessaging = getAdminMessaging();
export const adminStorage = getAdminStorage();
