import { averageScore, bestDay, categoryShares, lastDays, longestStreak } from '../stats';

const scores = new Map<string, number>([
  ['2026-11-01', 25],
  ['2026-11-02', 30],
  ['2026-11-03', 22],
  ['2026-11-05', 40],
  ['2026-11-06', 20],
  ['2026-11-09', -5],
  ['2026-11-10', 40],
]);

describe('lastDays', () => {
  it('returns oldest first and marks unlogged days as null', () => {
    const bars = lastDays(scores, 7, new Date(2026, 10, 10));
    expect(bars.map((b) => b.day)).toEqual([
      '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10',
    ]);
    expect(bars.map((b) => b.score)).toEqual([null, 40, 20, null, null, -5, 40]);
  });

  it('works across month boundaries', () => {
    const bars = lastDays(new Map(), 3, new Date(2026, 2, 1));
    expect(bars.map((b) => b.day)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });
});

describe('bestDay', () => {
  it('picks the highest score, newest on ties', () => {
    expect(bestDay(scores)).toEqual({ day: '2026-11-10', score: 40 });
    expect(bestDay(new Map())).toBeNull();
  });
});

describe('longestStreak', () => {
  it('counts consecutive calendar days at or above the target', () => {
    expect(longestStreak(scores, 20)).toBe(3); // 1st-3rd; 5th-6th is 2; gap on the 4th
    expect(longestStreak(scores, 30)).toBe(1);
    expect(longestStreak(scores, 100)).toBe(0);
  });

  it('handles month and year boundaries', () => {
    const s = new Map([['2025-12-30', 20], ['2025-12-31', 20], ['2026-01-01', 20], ['2026-01-02', 5]]);
    expect(longestStreak(s, 20)).toBe(3);
  });
});

describe('averageScore', () => {
  it('averages logged days only', () => {
    expect(averageScore(new Map([['a', 10], ['b', 15]]))).toBe(12.5);
    expect(averageScore(new Map())).toBeNull();
  });
});

describe('categoryShares', () => {
  it('ignores net-negative categories and sorts by points', () => {
    const shares = categoryShares([
      { category: 'Health', points: 30, count: 4 },
      { category: 'Lifestyle', points: -10, count: 2 },
      { category: 'Software', points: 90, count: 9 },
    ]);
    expect(shares.map((s) => s.category)).toEqual(['Software', 'Health']);
    expect(shares[0].share).toBeCloseTo(0.75);
  });
});
