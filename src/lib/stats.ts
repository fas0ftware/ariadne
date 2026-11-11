// Pure statistics for the History screen. No database or React imports, so they are easy to test.
import { addDays, fromDayKey, toDayKey } from './dates';

export type DayBar = { day: string; score: number | null }; // null = nothing logged that day

// The last `count` days ending today (oldest first), with their score or null.
export function lastDays(scores: Map<string, number>, count: number, today = new Date()): DayBar[] {
  const bars: DayBar[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const day = toDayKey(addDays(today, -i));
    bars.push({ day, score: scores.has(day) ? (scores.get(day) as number) : null });
  }
  return bars;
}

// Highest scoring day. Ties go to the most recent day.
export function bestDay(scores: Map<string, number>): { day: string; score: number } | null {
  let best: { day: string; score: number } | null = null;
  scores.forEach((score, day) => {
    if (!best || score > best.score || (score === best.score && day > best.day)) best = { day, score };
  });
  return best;
}

// Longest run of consecutive calendar days at or above the target (any time in the past).
export function longestStreak(scores: Map<string, number>, target: number): number {
  const hits = [...scores.entries()]
    .filter(([, score]) => score >= target)
    .map(([day]) => day)
    .sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of hits) {
    run = previous !== null && toDayKey(addDays(fromDayKey(previous), 1)) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return longest;
}

// Average of the days that have logs (unlogged days are not counted as zero).
export function averageScore(scores: Map<string, number>): number | null {
  if (scores.size === 0) return null;
  let total = 0;
  scores.forEach((s) => (total += s));
  return Math.round((total / scores.size) * 10) / 10;
}

export type CategoryTotal = { category: string; points: number; count: number };

// Category share of the positive points, largest first; useful for "where did my points come from".
export function categoryShares(rows: CategoryTotal[]): (CategoryTotal & { share: number })[] {
  const positive = rows.filter((r) => r.points > 0);
  const sum = positive.reduce((n, r) => n + r.points, 0);
  return positive
    .map((r) => ({ ...r, share: sum ? r.points / sum : 0 }))
    .sort((a, b) => b.points - a.points || a.category.localeCompare(b.category));
}
