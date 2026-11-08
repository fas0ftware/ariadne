import { currentStreak, dayMessage, dayScore, formatPoints, scoresByDay, sumScores } from '../scoring';
import { addDays, toDayKey } from '../dates';

describe('dayScore', () => {
  it('adds positive and negative points', () => {
    expect(dayScore(30, -10, -20)).toBe(20);
  });

  it('never lets negative points go below the penalty cap', () => {
    expect(dayScore(30, -35, -20)).toBe(10);
    expect(dayScore(0, -100, -20)).toBe(-20);
  });

  it('applies the cap exactly at the limit', () => {
    expect(dayScore(10, -20, -20)).toBe(-10);
  });
});

describe('scoresByDay and sumScores', () => {
  const totals = [
    { day: '2026-11-09', positive: 30, negative: -40, count: 5 },
    { day: '2026-11-08', positive: 18, negative: 0, count: 2 },
    { day: '2026-10-31', positive: 50, negative: -5, count: 6 },
  ];

  it('applies the cap per day', () => {
    const scores = scoresByDay(totals, -20);
    expect(scores.get('2026-11-09')).toBe(10);
    expect(scores.get('2026-11-08')).toBe(18);
  });

  it('sums only days inside the range', () => {
    const scores = scoresByDay(totals, -20);
    expect(sumScores(scores, '2026-11-01', '2026-11-09')).toBe(28);
    expect(sumScores(scores, '2026-10-01', '2026-11-09')).toBe(73);
  });
});

describe('currentStreak', () => {
  const today = new Date(2026, 10, 9, 12);
  const key = (offset: number) => toDayKey(addDays(today, offset));

  it('counts back from yesterday while today is still below target', () => {
    const scores = new Map([
      [key(0), 5],
      [key(-1), 25],
      [key(-2), 30],
      [key(-3), 10],
    ]);
    expect(currentStreak(scores, 20, today)).toBe(2);
  });

  it('includes today once the target is reached', () => {
    const scores = new Map([
      [key(0), 20],
      [key(-1), 25],
    ]);
    expect(currentStreak(scores, 20, today)).toBe(2);
  });

  it('breaks on a day without logs', () => {
    const scores = new Map([
      [key(-1), 25],
      [key(-3), 25],
    ]);
    expect(currentStreak(scores, 20, today)).toBe(1);
  });

  it('does not loop forever when the target is 0 and there is no data', () => {
    expect(currentStreak(new Map(), 0, today)).toBe(0);
  });
});

describe('dayMessage', () => {
  it('is calm and supportive on a negative day', () => {
    expect(dayMessage(-5, 20, 3)).toMatch(/fresh start/i);
  });

  it('encourages the first log', () => {
    expect(dayMessage(0, 20, 0)).toMatch(/first log/i);
  });

  it('shows the remaining points', () => {
    expect(dayMessage(12, 20, 2)).toBe('8 points to your daily target.');
  });

  it('celebrates reaching the target', () => {
    expect(dayMessage(20, 20, 2)).toMatch(/target reached/i);
  });
});

describe('formatPoints', () => {
  it('adds a plus sign to positive values', () => {
    expect(formatPoints(10)).toBe('+10');
    expect(formatPoints(-5)).toBe('-5');
    expect(formatPoints(0)).toBe('0');
  });
});
