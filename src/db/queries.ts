import { getDb, emitDataChanged } from './database';
import { toDayKey } from '../lib/dates';

export type Category = { id: number; name: string; sort_order: number };

export type Activity = {
  id: number;
  category_id: number;
  name: string;
  points: number;
  is_quick: number; // 0 | 1
  sort_order: number;
};

export type LogEntry = {
  id: number;
  activity_id: number;
  activity_name: string;
  category_name: string;
  points: number;
  day: string;
  logged_at: number;
  slot_start: number | null;
  source: 'app' | 'notification';
};

export type DayTotals = { day: string; positive: number; negative: number; count: number };

export const MAX_QUICK_ACTIVITIES = 3; // Android shows at most 3 notification buttons

// ---------- Categories ----------

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.getAllAsync<Category>(
    'SELECT id, name, sort_order FROM categories WHERE archived = 0 ORDER BY sort_order, id',
  );
}

export async function addCategory(name: string) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO categories (name, sort_order) VALUES (?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories))',
    name.trim(),
  );
  emitDataChanged();
}

export async function renameCategory(id: number, name: string) {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET name = ? WHERE id = ?', name.trim(), id);
  emitDataChanged();
}

// Archiving hides a category and its activities but keeps history intact.
export async function archiveCategory(id: number) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE categories SET archived = 1 WHERE id = ?', id);
    await db.runAsync('UPDATE activities SET archived = 1, is_quick = 0 WHERE category_id = ?', id);
  });
  emitDataChanged();
}

// ---------- Activities ----------

export async function listActivities(): Promise<Activity[]> {
  const db = await getDb();
  return db.getAllAsync<Activity>(
    `SELECT a.id, a.category_id, a.name, a.points, a.is_quick, a.sort_order
     FROM activities a JOIN categories c ON c.id = a.category_id
     WHERE a.archived = 0 AND c.archived = 0
     ORDER BY c.sort_order, a.sort_order, a.id`,
  );
}

export async function listQuickActivities(): Promise<Activity[]> {
  const all = await listActivities();
  return all.filter((a) => a.is_quick === 1).slice(0, MAX_QUICK_ACTIVITIES);
}

export async function getActivity(id: number): Promise<Activity | null> {
  const db = await getDb();
  return db.getFirstAsync<Activity>(
    'SELECT id, category_id, name, points, is_quick, sort_order FROM activities WHERE id = ?',
    id,
  );
}

export async function addActivity(categoryId: number, name: string, points: number, isQuick = false) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO activities (category_id, name, points, is_quick, sort_order)
     VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM activities WHERE category_id = ?))`,
    categoryId,
    name.trim(),
    points,
    isQuick ? 1 : 0,
    categoryId,
  );
  emitDataChanged();
}

export async function updateActivity(id: number, changes: { name?: string; points?: number; isQuick?: boolean }) {
  const db = await getDb();
  const current = await getActivity(id);
  if (!current) return;
  await db.runAsync(
    'UPDATE activities SET name = ?, points = ?, is_quick = ? WHERE id = ?',
    changes.name?.trim() ?? current.name,
    changes.points ?? current.points,
    changes.isQuick === undefined ? current.is_quick : changes.isQuick ? 1 : 0,
    id,
  );
  emitDataChanged();
}

export async function archiveActivity(id: number) {
  const db = await getDb();
  await db.runAsync('UPDATE activities SET archived = 1, is_quick = 0 WHERE id = ?', id);
  emitDataChanged();
}

// ---------- Logs ----------

type NewLog = {
  activityId: number;
  source: 'app' | 'notification';
  slotStart?: number | null;
  notificationId?: string | null;
  loggedAt?: number;
};

// Returns false if nothing was inserted (for example the notification was already answered).
export async function addLog(log: NewLog): Promise<boolean> {
  const db = await getDb();
  const activity = await getActivity(log.activityId);
  if (!activity) return false;

  const loggedAt = log.loggedAt ?? Date.now();
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO logs (activity_id, points, day, logged_at, slot_start, source, notification_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    activity.id,
    activity.points,
    toDayKey(new Date(loggedAt)),
    loggedAt,
    log.slotStart ?? null,
    log.source,
    log.notificationId ?? null,
  );
  emitDataChanged();
  return result.changes > 0;
}

export async function deleteLog(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM logs WHERE id = ?', id);
  emitDataChanged();
}

export async function listLogsForDay(day: string): Promise<LogEntry[]> {
  const db = await getDb();
  return db.getAllAsync<LogEntry>(
    `SELECT l.id, l.activity_id, a.name AS activity_name, c.name AS category_name,
            l.points, l.day, l.logged_at, l.slot_start, l.source
     FROM logs l
     JOIN activities a ON a.id = l.activity_id
     JOIN categories c ON c.id = a.category_id
     WHERE l.day = ?
     ORDER BY l.logged_at DESC`,
    day,
  );
}

// Raw positive and negative sums per day. The penalty cap is applied in lib/scoring.
export async function listDayTotals(fromDay = '0000-00-00'): Promise<DayTotals[]> {
  const db = await getDb();
  return db.getAllAsync<DayTotals>(
    `SELECT day,
            SUM(CASE WHEN points > 0 THEN points ELSE 0 END) AS positive,
            SUM(CASE WHEN points < 0 THEN points ELSE 0 END) AS negative,
            COUNT(*) AS count
     FROM logs
     WHERE day >= ?
     GROUP BY day
     ORDER BY day DESC`,
    fromDay,
  );
}
