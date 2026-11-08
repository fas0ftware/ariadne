// All dates use the phone's local time zone.

const pad = (n: number) => String(n).padStart(2, '0');

// "2026-11-09"
export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDayKey(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function todayKey(): string {
  return toDayKey(new Date());
}

// Monday of the week that contains `date`.
export function startOfWeek(date: Date): Date {
  const mondayOffset = (date.getDay() + 6) % 7;
  const d = addDays(date, -mondayOffset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// 480 -> "08:00"
export function formatMinutes(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

// unix ms -> "14:05"
export function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "Monday, 9 November"
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

// "Mon 9 Nov"
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Unix ms for `minutes` after midnight on the given day.
export function atMinutes(day: Date, minutes: number): number {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d.getTime();
}
