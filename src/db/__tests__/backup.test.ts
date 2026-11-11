// restoreBackup against a recording fake database: order, transaction and parameters.
import { restoreBackup } from '../backup';
import { parseBackup } from '../../lib/backup';
const mockCalls: { sql: string; params: unknown[] }[] = [];
let mockInTx = false;
const mockDb = {
  runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
    mockCalls.push({ sql: (mockInTx ? 'TX ' : '') + sql.replace(/\s+/g, ' ').trim(), params });
    return { changes: 1, lastInsertRowId: 1 };
  }),
  withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
    mockInTx = true;
    try {
      await fn();
    } finally {
      mockInTx = false;
    }
  }),
};

// jest.mock is hoisted above the imports, so the fake is in place before ../backup loads.
jest.mock('../database', () => ({ getDb: async () => mockDb, emitDataChanged: jest.fn() }));


const backupText = JSON.stringify({
  app: 'ariadne',
  version: 1,
  categories: [{ id: 2, name: ' Health ', sort_order: 0, archived: 0 }],
  activities: [{ id: 5, category_id: 2, name: 'Workout', points: 10, is_quick: 1, sort_order: 0, archived: 0 }],
  logs: [{ id: 9, activity_id: 5, points: 10, day: '2026-11-10', logged_at: 1, source: 'app' }],
  settings: { targetScore: 25 },
});

it('deletes children first, inserts parents first, all inside one transaction, then saves settings', async () => {
  const parsed = parseBackup(backupText);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  await restoreBackup(parsed.backup);

  const statements = mockCalls.map((c) => c.sql.split(' (')[0]);
  expect(statements.slice(0, 6)).toEqual([
    'TX DELETE FROM logs',
    'TX DELETE FROM activities',
    'TX DELETE FROM categories',
    'TX INSERT INTO categories',
    'TX INSERT INTO activities',
    'TX INSERT INTO logs',
  ]);
  expect(mockCalls[3].params).toEqual([2, 'Health', 0, 0]); // names are trimmed
  expect(mockCalls[5].params).toEqual([9, 5, 10, '2026-11-10', 1, null, 'app', null, null]);
  // settings are written with parameters, never concatenated into SQL
  const settingsWrite = mockCalls.find((c) => c.sql.includes('INSERT INTO settings'));
  expect(settingsWrite?.params).toEqual(['targetScore', '25']);
});
