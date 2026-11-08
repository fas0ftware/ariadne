// A "slot" is one check-in time, e.g. 08:00, 09:00 ... 23:00 with a 60 minute interval.
import type { Settings } from '../db/settings';
import { atMinutes } from './dates';

type SlotSettings = Pick<Settings, 'wakeStartMin' | 'wakeEndMin' | 'intervalMin'>;

// All check-in times (unix ms) for the given day.
export function slotsForDay(day: Date, s: SlotSettings): number[] {
  const slots: number[] = [];
  for (let m = s.wakeStartMin; m <= s.wakeEndMin; m += s.intervalMin) {
    slots.push(atMinutes(day, m));
  }
  return slots;
}

// The slot that `time` belongs to, or null if it is outside waking hours.
export function slotForTime(time: number, s: SlotSettings): number | null {
  const slots = slotsForDay(new Date(time), s);
  const intervalMs = s.intervalMin * 60_000;
  return slots.find((slot) => time >= slot && time < slot + intervalMs) ?? null;
}
