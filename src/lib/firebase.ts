import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, Firestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyC28heBX9KUAK--AvXe1bTy06J9sss_C2Q",
  authDomain: "ckkk-576e7.firebaseapp.com",
  projectId: "ckkk-576e7",
  storageBucket: "ckkk-576e7.firebasestorage.app",
  messagingSenderId: "174398232186",
  appId: "1:174398232186:web:a94c68480f27e25a668dc3"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let db: Firestore;
if (getApps().length === 0 || !getApps()[0]) {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
  });
} else {
  db = getFirestore(app);
}
export const auth = getAuth(app);
export const storage = getStorage(app);

// Initialize Cloud Messaging (only works in browser)
export const messaging = typeof window !== "undefined" ? isSupported().then(supported => supported ? getMessaging(app) : null) : null;

export { app, db };

export const getMockMode = () => false; // Disabled
export const setMockMode = (mode: boolean) => {}; // Disabled

export const dbService = {
  getDocs: async (collectionName: string): Promise<any[]> => {
    const q = query(collection(db, collectionName));
    const querySnapshot = await getDocs(q);
    const docs: any[] = [];
    querySnapshot.forEach((doc) => {
      docs.push({ id: doc.id, ...doc.data() });
    });
    return docs;
  },

  getDoc: async (collectionName: string, id: string): Promise<any | null> => {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  },

  addDoc: async (collectionName: string, data: any): Promise<any> => {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      timestamp: data.timestamp || new Date().toISOString()
    });
    const docSnap = await getDoc(docRef);
    return { id: docRef.id, ...docSnap.data() };
  },

  setDoc: async (collectionName: string, id: string, data: any): Promise<any> => {
    const docRef = doc(db, collectionName, id);
    await setDoc(docRef, data);
    return { id, ...data };
  },

  updateDoc: async (collectionName: string, id: string, data: any): Promise<boolean> => {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, data);
    return true;
  },

  deleteDoc: async (collectionName: string, id: string): Promise<boolean> => {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
    return true;
  },

  onSnapshot: (collectionName: string, callback: (data: any[]) => void): (() => void) => {
    const q = query(collection(db, collectionName));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const docs: any[] = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      console.log(`Fetched ${docs.length} from ${collectionName}`);
      callback(docs);
    }, (error) => {
      console.error(`Firebase error on ${collectionName}:`, error);
    });
    return unsubscribe;
  },

  logAction: async (userEmail: string, userName: string, role: string, action: string, previousValue: string, newValue: string) => {
    const logEntry = {
      userEmail,
      userName,
      role,
      action,
      previousValue: previousValue.slice(0, 300) + (previousValue.length > 300 ? "..." : ""),
      newValue: newValue.slice(0, 300) + (newValue.length > 300 ? "..." : ""),
      timestamp: new Date().toISOString(),
      ip: typeof window !== "undefined" ? "127.0.0.1" : "Server",
      device: typeof window !== "undefined" ? navigator.userAgent.substring(0, 100) : "Server Node"
    };

    try {
      await addDoc(collection(db, "audit_logs"), logEntry);
    } catch (err) {
      console.error("Failed to write live audit log:", err);
    }
  }
};
