import { getDb, emitDataChanged } from './database';

export type ThemeSetting = 'system' | 'light' | 'dark';

export type Settings = {
  theme: ThemeSetting;
  wakeStartMin: number; // minutes after midnight, 480 = 08:00
  wakeEndMin: number; // last check-in of the day, 1380 = 23:00
  intervalMin: 30 | 60 | 90 | 120;
  paused: boolean;
  snoozeUntil: number; // unix ms, 0 = not snoozed
  penaltyCap: number; // lowest total of negative points per day, e.g. -20
  targetScore: number; // daily score needed to keep a streak
  scheduledUntil: number; // unix ms of the last scheduled check-in (internal)
  lastBackupAt: number; // unix ms of the last shared backup, 0 = never
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  wakeStartMin: 8 * 60,
  wakeEndMin: 23 * 60,
  intervalMin: 60,
  paused: false,
  snoozeUntil: 0,
  penaltyCap: -20,
  targetScore: 20,
  scheduledUntil: 0,
  lastBackupAt: 0,
};

// Settings are stored as key/value rows; missing keys fall back to defaults.
export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in DEFAULT_SETTINGS) settings[row.key] = JSON.parse(row.value);
  }
  return settings as Settings;
}

export async function saveSettings(changes: Partial<Settings>) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(changes)) {
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        JSON.stringify(value),
      );
    }
  });
  emitDataChanged();
}
