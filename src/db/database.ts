import * as SQLite from 'expo-sqlite';
import { migrate } from './schema';

// One shared connection for the whole app (screens and the background task).
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('ariadne.db');
      await migrate(db);
      return db;
    })();
    // If opening fails, allow a retry on the next call.
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

// Tiny change notifier so screens can reload after any write.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDataChanged() {
  listeners.forEach((listener) => listener());
}
