import {
  addDays,
  compareLocalDates,
  dayOf,
  daysBetween,
  epochDay,
  ISO_WEEKDAYS,
  LocalDate,
  localDate,
  localDateOfLocal,
  localDateOfUtc,
  monthOf,
  parseLocalDate,
  toUtcDate,
  weekday,
  yearOf,
} from './local-date';
import { UtcZoneClock } from './zone-clock';

describe('LocalDate', () => {
  it('parses and formats ISO dates', () => {
    const d = parseLocalDate('2026-03-07');
    expect(yearOf(d)).toBe(2026);
    expect(monthOf(d)).toBe(3);
    expect(dayOf(d)).toBe(7);
    expect(d).toBe('2026-03-07');
    expect(String(d)).toBe('2026-03-07');
  });

  it('rejects malformed input', () => {
    expect(() => parseLocalDate('2026-3-7')).toThrow();
    expect(() => parseLocalDate('yesterday')).toThrow();
    expect(() => parseLocalDate('2026-03-07T00:00:00Z')).toThrow();
    expect(() => parseLocalDate(' 2026-03-07')).toThrow();
    expect(() => parseLocalDate('')).toThrow();
  });

  it('rejects out-of-range month and day fields', () => {
    expect(() => localDate(2026, 0, 1)).toThrow(RangeError);
    expect(() => localDate(2026, 13, 1)).toThrow(RangeError);
    expect(() => localDate(2026, 1, 0)).toThrow(RangeError);
    expect(() => localDate(2026, 1, 32)).toThrow(RangeError);
    expect(() => parseLocalDate('2026-13-01')).toThrow();
  });

  it('ignores time and zone when built from a Date', () => {
    const late = new Date(Date.UTC(2026, 0, 31, 23, 59));
    expect(localDateOfUtc(late)).toBe(localDate(2026, 1, 31));
    expect(localDateOfUtc(new Date(Date.UTC(2026, 0, 31, 23, 59, 59, 999)))).toBe('2026-01-31');
    expect(localDateOfUtc(new Date(Date.UTC(2026, 1, 1, 0, 0)))).toBe('2026-02-01');
  });

  it('localDateOfLocal uses the device calendar fields', () => {
    const d = new Date(2026, 4, 17, 23, 30); // local time
    expect(localDateOfLocal(d)).toBe('2026-05-17');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays(localDate(2025, 12, 31), 1)).toBe(localDate(2026, 1, 1));
    expect(addDays(localDate(2026, 3, 1), -1)).toBe(localDate(2026, 2, 28));
  });

  it('handles leap years', () => {
    expect(addDays(localDate(2024, 2, 28), 1)).toBe('2024-02-29');
    expect(addDays(localDate(2024, 2, 29), 1)).toBe('2024-03-01');
    expect(addDays(localDate(2100, 2, 28), 1)).toBe('2100-03-01'); // not a leap year
    expect(addDays(localDate(2000, 2, 28), 1)).toBe('2000-02-29'); // is a leap year
    expect(daysBetween(localDate(2024, 1, 1), localDate(2025, 1, 1))).toBe(366);
    expect(daysBetween(localDate(2026, 1, 1), localDate(2027, 1, 1))).toBe(365);
  });

  it('is unaffected by daylight-saving transitions', () => {
    // US and EU DST changes in 2026; date arithmetic is pure calendar maths.
    expect(addDays(localDate(2026, 3, 7), 1)).toBe('2026-03-08');
    expect(addDays(localDate(2026, 3, 8), 1)).toBe('2026-03-09');
    expect(addDays(localDate(2026, 3, 28), 2)).toBe('2026-03-30');
    expect(addDays(localDate(2026, 10, 24), 2)).toBe('2026-10-26');
    expect(addDays(localDate(2026, 11, 1), 1)).toBe('2026-11-02');
    expect(daysBetween(localDate(2026, 3, 1), localDate(2026, 4, 1))).toBe(31);
    expect(daysBetween(localDate(2026, 10, 1), localDate(2026, 11, 30))).toBe(60);
    // Walking a whole year one day at a time visits 365 distinct dates.
    const seen = new Set<LocalDate>();
    for (let d = localDate(2026, 1, 1); d < '2027-01-01'; d = addDays(d, 1)) seen.add(d);
    expect(seen.size).toBe(365);
  });

  it('compares and measures distance', () => {
    const a = localDate(2026, 5, 1);
    const b = localDate(2026, 5, 4);
    expect(compareLocalDates(a, b)).toBeLessThan(0);
    expect(compareLocalDates(b, a)).toBeGreaterThan(0);
    expect(a < b).toBe(true);
    expect(daysBetween(a, b)).toBe(3);
    expect(daysBetween(b, a)).toBe(-3);
    expect(compareLocalDates(a, a)).toBe(0);
  });

  it('string order agrees with chronological order', () => {
    const dates = [
      localDate(2026, 10, 2),
      localDate(2025, 12, 31),
      localDate(2026, 1, 10),
      localDate(2026, 1, 9),
    ];
    const sorted = [...dates].sort();
    expect(sorted).toEqual(['2025-12-31', '2026-01-09', '2026-01-10', '2026-10-02']);
    expect([...dates].sort(compareLocalDates)).toEqual(sorted);
    for (let i = 1; i < sorted.length; i++) {
      expect(epochDay(sorted[i])).toBeGreaterThan(epochDay(sorted[i - 1]));
    }
  });

  it('reports ISO weekday', () => {
    // 2026-10-10 is a Saturday.
    expect(weekday(localDate(2026, 10, 10))).toBe(ISO_WEEKDAYS.saturday);
    expect(weekday(localDate(2026, 10, 11))).toBe(ISO_WEEKDAYS.sunday);
    expect(weekday(localDate(2026, 10, 12))).toBe(ISO_WEEKDAYS.monday);
  });

  it('counts days from the Unix epoch', () => {
    expect(epochDay(localDate(1970, 1, 1))).toBe(0);
    expect(epochDay(localDate(1970, 1, 2))).toBe(1);
    expect(epochDay(localDate(1969, 12, 31))).toBe(-1);
    expect(toUtcDate(localDate(2026, 10, 10)).toISOString()).toBe('2026-10-10T00:00:00.000Z');
  });

  it('is a value type', () => {
    expect(localDate(2026, 1, 1)).toBe(localDate(2026, 1, 1));
    const set = new Set<LocalDate>();
    set.add(localDate(2026, 1, 1));
    set.add(parseLocalDate('2026-01-01'));
    expect(set.size).toBe(1);
  });

  it('pads years and fields to the ISO width', () => {
    expect(localDate(2026, 1, 5)).toBe('2026-01-05');
    expect(localDate(999, 1, 5)).toBe('0999-01-05');
  });
});

describe('UtcZoneClock', () => {
  const clock = new UtcZoneClock();

  it('starts a day at midnight UTC', () => {
    expect(clock.startOfDay(localDate(2026, 10, 10)).toISOString()).toBe(
      '2026-10-10T00:00:00.000Z',
    );
  });

  it('reads the UTC calendar date of an instant', () => {
    expect(clock.dateOf(new Date('2026-10-10T23:59:59.999Z'))).toBe('2026-10-10');
    expect(clock.dateOf(new Date('2026-10-11T00:00:00.000Z'))).toBe('2026-10-11');
  });
});
