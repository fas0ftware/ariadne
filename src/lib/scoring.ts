import type { DayTotals } from '../db/queries';
import { addDays, toDayKey } from './dates';

// Day score = all positive points + negative points, but negatives never go below the cap.
// Example with cap -20: +30 and -35 gives 30 + (-20) = 10.
export function dayScore(positive: number, negative: number, penaltyCap: number): number {
  return positive + Math.max(negative, penaltyCap);
}

export function scoresByDay(totals: DayTotals[], penaltyCap: number): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of totals) map.set(t.day, dayScore(t.positive, t.negative, penaltyCap));
  return map;
}

// Sum of day scores between two day keys (inclusive).
export function sumScores(scores: Map<string, number>, fromDay: string, toDay: string): number {
  let total = 0;
  scores.forEach((score, day) => {
    if (day >= fromDay && day <= toDay) total += score;
  });
  return total;
}

// Streak = consecutive days with a score at or above the target, counting back from today.
// Today only counts once it reaches the target, so an unfinished day never breaks the streak.
// Days without any log never count, even if the target is 0.
export function currentStreak(scores: Map<string, number>, target: number, today = new Date()): number {
  const hitTarget = (date: Date) => {
    const score = scores.get(toDayKey(date));
    return score !== undefined && score >= target;
  };
  let streak = hitTarget(today) ? 1 : 0;
  let date = addDays(today, -1);
  while (hitTarget(date)) {
    streak++;
    date = addDays(date, -1);
  }
  return streak;
}

export function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : String(points);
}

// Supportive one-liner for the Today screen. Never shaming.
export function dayMessage(score: number, target: number, logCount: number): string {
  if (logCount === 0) return 'Your thread starts with the first log.';
  if (score >= target) return 'Target reached. Well done.';
  if (score < 0) return 'Not every day goes to plan. Tomorrow is a fresh start.';
  return `${target - score} points to your daily target.`;
}
