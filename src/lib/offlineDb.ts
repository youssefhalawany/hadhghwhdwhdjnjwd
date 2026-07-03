import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AnhReportsDB extends DBSchema {
  offline_queue: {
    key: string;
    value: {
      id: string; // uuid
      endpoint: string; // "shift_reports" | "voids" etc
      payload: any;
      timestamp: number;
    };
  };
  cache: {
    key: string;
    value: {
      key: string;
      data: any;
      timestamp: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<AnhReportsDB>> | null = null;

export function getDb() {
  if (typeof window === 'undefined') return null;
  
  if (!dbPromise) {
    dbPromise = openDB<AnhReportsDB>('anhreports-db', 1, {
      upgrade(db) {
        db.createObjectStore('offline_queue', { keyPath: 'id' });
        db.createObjectStore('cache', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

// Helper to push to offline queue
export async function addToOfflineQueue(endpoint: string, payload: any) {
  const db = await getDb();
  if (!db) return;
  
  const id = crypto.randomUUID();
  await db.add('offline_queue', {
    id,
    endpoint,
    payload,
    timestamp: Date.now(),
  });
  return id;
}

// Helper to get all offline queue items
export async function getOfflineQueue() {
  const db = await getDb();
  if (!db) return [];
  return await db.getAll('offline_queue');
}

// Helper to remove an item from offline queue
export async function removeFromOfflineQueue(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete('offline_queue', id);
}

// Helpers for generic cache (useful for caching cashiers, settings so the app can start completely offline)
export async function setCacheData(key: string, data: any) {
  const db = await getDb();
  if (!db) return;
  await db.put('cache', { key, data, timestamp: Date.now() });
}

export async function getCacheData(key: string) {
  const db = await getDb();
  if (!db) return null;
  const entry = await db.get('cache', key);
  return entry ? entry.data : null;
}
