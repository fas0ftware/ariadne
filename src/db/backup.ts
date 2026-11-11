// Reads everything for a backup and restores a validated backup in one transaction.
import { getDb, emitDataChanged } from './database';
import { getSettings, saveSettings } from './settings';
import { makeBackup, type Backup, type BackupActivity, type BackupCategory, type BackupLog, type CsvLog } from '../lib/backup';

export async function exportBackup(): Promise<Backup> {
  const db = await getDb();
  const [categories, activities, logs, settings] = await Promise.all([
    db.getAllAsync<BackupCategory>('SELECT id, name, sort_order, archived FROM categories ORDER BY id'),
    db.getAllAsync<BackupActivity>(
      'SELECT id, category_id, name, points, is_quick, sort_order, archived FROM activities ORDER BY id',
    ),
    db.getAllAsync<BackupLog>(
      `SELECT id, activity_id, points, day, logged_at, slot_start, source, notification_id, note
       FROM logs ORDER BY id`,
    ),
    getSettings(),
  ]);
  return makeBackup({ categories, activities, logs }, settings);
}

export async function exportCsvRows(): Promise<CsvLog[]> {
  const db = await getDb();
  return db.getAllAsync<CsvLog>(
    `SELECT l.day, l.logged_at, c.name AS category, a.name AS activity, l.points, l.source
     FROM logs l JOIN activities a ON a.id = l.activity_id JOIN categories c ON c.id = a.category_id
     ORDER BY l.logged_at`,
  );
}

// Replaces ALL data with the backup. The backup must come from parseBackup().
export async function restoreBackup(backup: Backup) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM logs');
    await db.runAsync('DELETE FROM activities');
    await db.runAsync('DELETE FROM categories');
    for (const c of backup.categories) {
      await db.runAsync(
        'INSERT INTO categories (id, name, sort_order, archived) VALUES (?, ?, ?, ?)',
        c.id, c.name.trim(), c.sort_order, c.archived,
      );
    }
    for (const a of backup.activities) {
      await db.runAsync(
        'INSERT INTO activities (id, category_id, name, points, is_quick, sort_order, archived) VALUES (?, ?, ?, ?, ?, ?, ?)',
        a.id, a.category_id, a.name.trim(), a.points, a.is_quick, a.sort_order, a.archived,
      );
    }
    for (const l of backup.logs) {
      await db.runAsync(
        `INSERT INTO logs (id, activity_id, points, day, logged_at, slot_start, source, notification_id, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        l.id, l.activity_id, l.points, l.day, l.logged_at, l.slot_start, l.source, l.notification_id, l.note,
      );
    }
  });
  if (Object.keys(backup.settings).length) await saveSettings(backup.settings);
  emitDataChanged();
}

export type CategoryRow = { category: string; points: number; count: number };

export async function categoryTotals(fromDay: string): Promise<CategoryRow[]> {
  const db = await getDb();
  return db.getAllAsync<CategoryRow>(
    `SELECT c.name AS category, SUM(l.points) AS points, COUNT(*) AS count
     FROM logs l JOIN activities a ON a.id = l.activity_id JOIN categories c ON c.id = a.category_id
     WHERE l.day >= ? GROUP BY c.id ORDER BY points DESC`,
    fromDay,
  );
}
