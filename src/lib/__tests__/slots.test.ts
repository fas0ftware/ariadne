import { slotForTime, slotsForDay } from '../slots';

const day = new Date(2026, 10, 9);
const at = (h: number, m = 0) => new Date(2026, 10, 9, h, m).getTime();
const defaults = { wakeStartMin: 8 * 60, wakeEndMin: 23 * 60, intervalMin: 60 as const };

describe('slotsForDay', () => {
  it('creates one slot per hour from 08:00 to 23:00 inclusive', () => {
    const slots = slotsForDay(day, defaults);
    expect(slots).toHaveLength(16);
    expect(slots[0]).toBe(at(8));
    expect(slots.at(-1)).toBe(at(23));
  });

  it('respects the interval', () => {
    expect(slotsForDay(day, { ...defaults, intervalMin: 30 })).toHaveLength(31);
    expect(slotsForDay(day, { ...defaults, intervalMin: 90 })).toHaveLength(11);
    expect(slotsForDay(day, { ...defaults, intervalMin: 120 })).toHaveLength(8);
  });
});

describe('slotForTime', () => {
  it('finds the slot a time belongs to', () => {
    expect(slotForTime(at(10, 20), defaults)).toBe(at(10));
    expect(slotForTime(at(10, 0), defaults)).toBe(at(10));
  });

  it('returns null outside waking hours', () => {
    expect(slotForTime(at(7, 59), defaults)).toBeNull();
  });

  it('still counts the last hour after the final check-in', () => {
    expect(slotForTime(at(23, 30), defaults)).toBe(at(23));
  });
});
