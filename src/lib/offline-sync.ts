/**
 * Offline Sync Engine
 * 
 * Uses IndexedDB to queue Firestore write operations when the device is offline.
 * When the connection is restored, queued operations replay automatically.
 */

const DB_NAME = "anh_offline_sync";
const DB_VERSION = 1;
const STORE_NAME = "pending_writes";

export interface PendingWrite {
  id?: number;
  operation: "addDoc" | "setDoc" | "updateDoc";
  collectionName: string;
  docId?: string;
  data: any;
  createdAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

/** Queue a write operation for later sync */
export async function queueOfflineWrite(write: Omit<PendingWrite, "id">): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(write);
    tx.oncomplete = () => {
      resolve();
      // Dispatch event so UI can update the pending count
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("offline-queue-changed"));
      }
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Get all pending writes */
export async function getPendingWrites(): Promise<PendingWrite[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Get count of pending writes */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Remove a single pending write by ID */
export async function removePendingWrite(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      resolve();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("offline-queue-changed"));
      }
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Clear all pending writes */
export async function clearAllPendingWrites(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      resolve();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("offline-queue-changed"));
      }
    };
    tx.onerror = () => reject(tx.error);
  });
}
