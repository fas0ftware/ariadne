// Backup format, validation and CSV export. Pure functions: no database, no React.
// A backup file is untrusted input (it may have been edited or come from somewhere else),
// so every field is checked before anything is written to the database.
import type { Settings } from '../db/settings';

export const BACKUP_APP = 'ariadne';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_CHARS = 10_000_000; // ~10 MB of JSON
const MAX_ROWS = 500_000;
const MAX_NAME = 60;
const MAX_POINTS = 1000;

export type BackupCategory = { id: number; name: string; sort_order: number; archived: number };
export type BackupActivity = {
  id: number;
  category_id: number;
  name: string;
  points: number;
  is_quick: number;
  sort_order: number;
  archived: number;
};
export type BackupLog = {
  id: number;
  activity_id: number;
  points: number;
  day: string;
  logged_at: number;
  slot_start: number | null;
  source: 'app' | 'notification';
  notification_id: string | null;
  note: string | null;
};
export type Backup = {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  categories: BackupCategory[];
  activities: BackupActivity[];
  logs: BackupLog[];
  settings: Partial<Settings>;
};

export type ValidationResult = { ok: true; backup: Backup } | { ok: false; error: string };

// Settings that describe this phone's notification schedule are not restored.
const DEVICE_ONLY: (keyof Settings)[] = ['snoozeUntil', 'scheduledUntil', 'lastBackupAt'];

export function makeBackup(
  data: Pick<Backup, 'categories' | 'activities' | 'logs'>,
  settings: Settings,
  now = new Date(),
): Backup {
  const portable: Partial<Settings> = { ...settings };
  for (const key of DEVICE_ONLY) delete portable[key];
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), ...data, settings: portable };
}

const isInt = (v: unknown, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isFlag = (v: unknown): v is number => v === 0 || v === 1;
const isName = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_NAME;
const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function checkSettings(raw: unknown): Partial<Settings> | string {
  if (raw === undefined) return {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'settings must be an object';
  const s = raw as Record<string, unknown>;
  const out: Partial<Settings> = {};
  if (s.theme !== undefined) {
    if (!['system', 'light', 'dark'].includes(s.theme as string)) return 'settings.theme is invalid';
    out.theme = s.theme as Settings['theme'];
  }
  for (const key of ['wakeStartMin', 'wakeEndMin'] as const) {
    if (s[key] !== undefined) {
      if (!isInt(s[key], 0, 24 * 60 - 1)) return `settings.${key} is invalid`;
      out[key] = s[key] as number;
    }
  }
  if (s.intervalMin !== undefined) {
    if (![30, 60, 90, 120].includes(s.intervalMin as number)) return 'settings.intervalMin is invalid';
    out.intervalMin = s.intervalMin as Settings['intervalMin'];
  }
  if (s.paused !== undefined) {
    if (typeof s.paused !== 'boolean') return 'settings.paused is invalid';
    out.paused = s.paused;
  }
  if (s.penaltyCap !== undefined) {
    if (!isInt(s.penaltyCap, -10_000, 0)) return 'settings.penaltyCap is invalid';
    out.penaltyCap = s.penaltyCap;
  }
  if (s.targetScore !== undefined) {
    if (!isInt(s.targetScore, 0, 10_000)) return 'settings.targetScore is invalid';
    out.targetScore = s.targetScore;
  }
  return out;
}

export function parseBackup(text: string): ValidationResult {
  const fail = (error: string): ValidationResult => ({ ok: false, error });
  if (text.length > MAX_BACKUP_CHARS) return fail('The backup is too large.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('This is not valid JSON. Paste the whole backup text.');
  }
  if (typeof raw !== 'object' || raw === null) return fail('The backup must be a JSON object.');
  const b = raw as Record<string, unknown>;
  if (b.app !== BACKUP_APP) return fail('This is not an Ariadne backup.');
  if (!isInt(b.version, 1) || (b.version as number) > BACKUP_VERSION)
    return fail('This backup was made by a newer version of Ariadne.');
  for (const key of ['categories', 'activities', 'logs'] as const) {
    if (!Array.isArray(b[key])) return fail(`"${key}" is missing.`);
    if ((b[key] as unknown[]).length > MAX_ROWS) return fail(`Too many ${key}.`);
  }

  const categories = b.categories as BackupCategory[];
  const catIds = new Set<number>();
  for (const [i, c] of categories.entries()) {
    if (!c || !isInt(c.id, 1) || !isName(c.name) || !isInt(c.sort_order) || !isFlag(c.archived))
      return fail(`Category #${i + 1} is invalid.`);
    if (catIds.has(c.id)) return fail(`Category id ${c.id} appears twice.`);
    catIds.add(c.id);
  }

  const activities = b.activities as BackupActivity[];
  const actIds = new Set<number>();
  for (const [i, a] of activities.entries()) {
    if (
      !a || !isInt(a.id, 1) || !isInt(a.category_id, 1) || !isName(a.name) ||
      !isInt(a.points, -MAX_POINTS, MAX_POINTS) || !isFlag(a.is_quick) || !isInt(a.sort_order) || !isFlag(a.archived)
    )
      return fail(`Activity #${i + 1} is invalid.`);
    if (!catIds.has(a.category_id)) return fail(`Activity "${a.name}" points to a missing category.`);
    if (actIds.has(a.id)) return fail(`Activity id ${a.id} appears twice.`);
    actIds.add(a.id);
  }

  const logs = b.logs as BackupLog[];
  const logIds = new Set<number>();
  const notificationIds = new Set<string>();
  for (const [i, l] of logs.entries()) {
    const bad =
      !l || !isInt(l.id, 1) || !isInt(l.activity_id, 1) || !isInt(l.points, -MAX_POINTS, MAX_POINTS) ||
      typeof l.day !== 'string' || !DAY_RE.test(l.day) || !isInt(l.logged_at, 0) ||
      !(l.slot_start === null || l.slot_start === undefined || isInt(l.slot_start, 0)) ||
      !(l.source === 'app' || l.source === 'notification') ||
      !(l.notification_id === null || l.notification_id === undefined ||
        (typeof l.notification_id === 'string' && l.notification_id.length <= 200)) ||
      !(l.note === null || l.note === undefined || (typeof l.note === 'string' && l.note.length <= 500));
    if (bad) return fail(`Log #${i + 1} is invalid.`);
    if (!actIds.has(l.activity_id)) return fail(`Log #${i + 1} points to a missing activity.`);
    if (logIds.has(l.id)) return fail(`Log id ${l.id} appears twice.`);
    logIds.add(l.id);
    if (l.notification_id) {
      if (notificationIds.has(l.notification_id)) return fail(`Log #${i + 1} repeats a notification.`);
      notificationIds.add(l.notification_id);
    }
  }

  const settings = checkSettings(b.settings);
  if (typeof settings === 'string') return fail(`Invalid settings: ${settings}.`);

  return {
    ok: true,
    backup: {
      app: BACKUP_APP,
      version: b.version as number,
      exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
      categories,
      activities,
      logs: logs.map((l) => ({
        ...l,
        slot_start: l.slot_start ?? null,
        notification_id: l.notification_id ?? null,
        note: l.note ?? null,
      })),
      settings,
    },
  };
}

// CSV cell: quote when needed and neutralise spreadsheet formulas (=, +, -, @ at the start).
export function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export type CsvLog = { day: string; logged_at: number; category: string; activity: string; points: number; source: string };

export function logsToCsv(rows: CsvLog[]): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const lines = ['date,time,category,activity,points,source'];
  for (const r of rows) {
    const d = new Date(r.logged_at);
    lines.push(
      [r.day, `${pad(d.getHours())}:${pad(d.getMinutes())}`, r.category, r.activity, r.points, r.source]
        .map((v) => csvCell(v))
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}

export function backupSummary(b: Backup): string {
  const days = new Set(b.logs.map((l) => l.day)).size;
  return `${b.logs.length} logs on ${days} days, ${b.activities.length} activities, ${b.categories.length} categories`;
}

