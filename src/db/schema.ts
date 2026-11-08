import type { SQLiteDatabase } from 'expo-sqlite';

// Bump this and add a new `if (version < N)` block to change the schema later.
const DATABASE_VERSION = 1;

// Default categories and activities, inserted only on first launch.
const DEFAULT_DATA: { category: string; activities: [name: string, points: number, isQuick?: boolean][] }[] = [
  { category: 'Software', activities: [['Coding', 10, true]] },
  { category: 'Health', activities: [['Workout', 10, true], ['Ate well', 5], ['Ate badly', -5]] },
  { category: 'Economy', activities: [['Tracked spending', 5]] },
  { category: 'Learning', activities: [['Reading', 8, true], ['Studying', 8]] },
  { category: 'Lifestyle', activities: [['Wasted time', -5], ['Skipped planned task', -5]] },
];

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE categories (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        archived   INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE activities (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        name        TEXT    NOT NULL,
        points      INTEGER NOT NULL,
        is_quick    INTEGER NOT NULL DEFAULT 0, -- shown as a notification button
        sort_order  INTEGER NOT NULL DEFAULT 0,
        archived    INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE logs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id     INTEGER NOT NULL REFERENCES activities(id),
        points          INTEGER NOT NULL,  -- copied from the activity when logged
        day             TEXT    NOT NULL,  -- local date, YYYY-MM-DD
        logged_at       INTEGER NOT NULL,  -- unix ms
        slot_start      INTEGER,           -- unix ms of the check-in slot this log answers
        source          TEXT    NOT NULL DEFAULT 'app', -- 'app' | 'notification'
        notification_id TEXT    UNIQUE,    -- prevents logging the same notification twice
        note            TEXT
      );
      CREATE INDEX logs_day ON logs(day);

      CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL  -- JSON encoded
      );
    `);

    await db.withTransactionAsync(async () => {
      for (const [catIndex, group] of DEFAULT_DATA.entries()) {
        const cat = await db.runAsync(
          'INSERT INTO categories (name, sort_order) VALUES (?, ?)',
          group.category,
          catIndex,
        );
        for (const [actIndex, [name, points, isQuick]] of group.activities.entries()) {
          await db.runAsync(
            'INSERT INTO activities (category_id, name, points, is_quick, sort_order) VALUES (?, ?, ?, ?, ?)',
            cat.lastInsertRowId,
            name,
            points,
            isQuick ? 1 : 0,
            actIndex,
          );
        }
      }
    });
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
