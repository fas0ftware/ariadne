import { addDays, atMinutes, formatMinutes, formatTime, fromDayKey, startOfMonth, startOfWeek, toDayKey } from '../dates';

describe('dates', () => {
  it('formats and parses local day keys', () => {
    const date = new Date(2026, 0, 5, 23, 59);
    expect(toDayKey(date)).toBe('2026-01-05');
    expect(toDayKey(fromDayKey('2026-01-05'))).toBe('2026-01-05');
  });

  it('adds days across month and year boundaries', () => {
    expect(toDayKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
    expect(toDayKey(addDays(new Date(2026, 2, 1), -1))).toBe('2026-02-28');
  });

  it('starts the week on Monday', () => {
    expect(toDayKey(startOfWeek(new Date(2026, 10, 9)))).toBe('2026-11-09'); // Monday
    expect(toDayKey(startOfWeek(new Date(2026, 10, 15)))).toBe('2026-11-09'); // Sunday
  });

  it('finds the first day of the month', () => {
    expect(toDayKey(startOfMonth(new Date(2026, 10, 20)))).toBe('2026-11-01');
  });

  it('formats times with leading zeros', () => {
    expect(formatMinutes(480)).toBe('08:00');
    expect(formatMinutes(1410)).toBe('23:30');
    expect(formatTime(new Date(2026, 0, 1, 9, 5).getTime())).toBe('09:05');
  });

  it('builds a timestamp for minutes after midnight', () => {
    expect(atMinutes(new Date(2026, 10, 9, 15), 90)).toBe(new Date(2026, 10, 9, 1, 30).getTime());
  });
});
