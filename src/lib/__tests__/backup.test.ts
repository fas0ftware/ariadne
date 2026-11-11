import { DEFAULT_SETTINGS } from '../../db/settings';
import { backupSummary, csvCell, logsToCsv, makeBackup, parseBackup, type Backup } from '../backup';

jest.mock('../../db/database', () => ({ getDb: jest.fn(), emitDataChanged: jest.fn() }));

function sample(): Backup {
  return makeBackup(
    {
      categories: [{ id: 1, name: 'Health', sort_order: 0, archived: 0 }],
      activities: [{ id: 3, category_id: 1, name: 'Workout', points: 10, is_quick: 1, sort_order: 0, archived: 0 }],
      logs: [
        { id: 7, activity_id: 3, points: 10, day: '2026-11-10', logged_at: 1_762_800_000_000, slot_start: null,
          source: 'app', notification_id: null, note: null },
        { id: 8, activity_id: 3, points: 10, day: '2026-11-11', logged_at: 1_762_890_000_000, slot_start: 1_762_889_400_000,
          source: 'notification', notification_id: 'n-1', note: null },
      ],
    },
    { ...DEFAULT_SETTINGS, snoozeUntil: 123, scheduledUntil: 456, targetScore: 30 },
    new Date('2026-11-11T10:00:00Z'),
  );
}

const roundTrip = (b: unknown) => parseBackup(JSON.stringify(b));

describe('makeBackup', () => {
  it('leaves out device-only settings', () => {
    const b = sample();
    expect(b.settings.snoozeUntil).toBeUndefined();
    expect(b.settings.scheduledUntil).toBeUndefined();
    expect(b.settings.targetScore).toBe(30);
    expect(b.exportedAt).toBe('2026-11-11T10:00:00.000Z');
  });
});

describe('parseBackup', () => {
  it('accepts its own output', () => {
    const result = roundTrip(sample());
    expect(result.ok).toBe(true);
    if (result.ok) expect(backupSummary(result.backup)).toBe('2 logs on 2 days, 1 activities, 1 categories');
  });

  it('rejects non-JSON, other apps and newer versions', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false });
    expect(roundTrip({ ...sample(), app: 'other' })).toMatchObject({ ok: false, error: 'This is not an Ariadne backup.' });
    expect(roundTrip({ ...sample(), version: 99 })).toMatchObject({ ok: false });
  });

  it('rejects broken references and duplicates', () => {
    const b = sample();
    expect(roundTrip({ ...b, activities: [{ ...b.activities[0], category_id: 99 }] })).toMatchObject({ ok: false });
    expect(roundTrip({ ...b, logs: [{ ...b.logs[0], activity_id: 42 }] })).toMatchObject({ ok: false });
    expect(roundTrip({ ...b, logs: [b.logs[0], b.logs[0]] })).toMatchObject({ ok: false });
    expect(roundTrip({ ...b, logs: [b.logs[1], { ...b.logs[1], id: 9 }] })).toMatchObject({ ok: false });
  });

  it('rejects bad field values', () => {
    const b = sample();
    const badLogs = [
      { ...b.logs[0], day: '2026-13-01' },
      { ...b.logs[0], day: "2026-11-10'; DROP TABLE logs;--" },
      { ...b.logs[0], points: 1e9 },
      { ...b.logs[0], points: 1.5 },
      { ...b.logs[0], source: 'hacker' },
      { ...b.logs[0], note: 'x'.repeat(501) },
    ];
    for (const log of badLogs) expect(roundTrip({ ...b, logs: [log] })).toMatchObject({ ok: false });
    expect(roundTrip({ ...b, categories: [{ ...b.categories[0], name: '' }] })).toMatchObject({ ok: false });
    expect(roundTrip({ ...b, categories: [{ ...b.categories[0], name: 'x'.repeat(61) }] })).toMatchObject({ ok: false });
    expect(roundTrip({ ...b, settings: { theme: 'neon' } })).toMatchObject({ ok: false });
    expect(roundTrip({ ...b, settings: { intervalMin: 45 } })).toMatchObject({ ok: false });
    expect(roundTrip({ ...b, settings: { penaltyCap: 5 } })).toMatchObject({ ok: false });
  });

  it('ignores unknown settings keys and fills optional log fields', () => {
    const b = sample() as unknown as Record<string, unknown>;
    const logs = (b.logs as Record<string, unknown>[]).map(({ note, notification_id, ...rest }) => rest);
    const result = roundTrip({ ...b, logs, settings: { evil: '<script>', paused: true } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.settings).toEqual({ paused: true });
      expect(result.backup.logs[0].note).toBeNull();
    }
  });

  it('refuses huge input before parsing', () => {
    expect(parseBackup(' '.repeat(10_000_001))).toMatchObject({ ok: false, error: 'The backup is too large.' });
  });
});

describe('CSV export', () => {
  it('quotes and neutralises formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell(-5)).toBe('-5'); // numbers stay numbers
    expect(csvCell(null)).toBe('');
  });

  it('writes a header and one line per log', () => {
    const at = new Date(2026, 10, 10, 9, 5).getTime();
    const csv = logsToCsv([{ day: '2026-11-10', logged_at: at, category: 'Health', activity: 'Ate badly', points: -5, source: 'app' }]);
    expect(csv).toBe('date,time,category,activity,points,source\n2026-11-10,09:05,Health,Ate badly,-5,app\n');
  });
});
