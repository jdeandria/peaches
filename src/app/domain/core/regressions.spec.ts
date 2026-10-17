import { dateTimeFromJson, FormatError } from './json';
import { addDays, localDate, parseLocalDate } from './local-date';
import { crateSettings } from '../models/crate';
import { workoutLogFromJson } from '../models/workout-log';

/** Edge cases in decoding and date arithmetic that once went wrong. */
describe('port regressions', () => {
  it('keeps years 0..99 as given (Date.UTC would map them to 19xx)', () => {
    expect(localDate(50, 1, 1)).toBe('0050-01-01');
    expect(addDays(parseLocalDate('0099-12-31'), 1)).toBe('0100-01-01');
  });

  it('rejects impossible stored dates instead of rolling them over', () => {
    expect(() => parseLocalDate('2026-02-30')).toThrow(SyntaxError);
    expect(() => parseLocalDate('2026-02-29')).toThrow(SyntaxError);
    expect(parseLocalDate('2028-02-29')).toBe('2028-02-29');
  });

  it('accepts only ISO-8601 timestamps', () => {
    for (const bad of ['1', '2026', 'October 10, 2026', '']) {
      expect(() => dateTimeFromJson(bad)).toThrow(FormatError);
    }
    expect(dateTimeFromJson('2026-10-10T09:00:00.000Z').toISOString()).toBe(
      '2026-10-10T09:00:00.000Z',
    );
    expect(dateTimeFromJson('2026-10-10T09:00:00.123456Z').getUTCMilliseconds()).toBe(123);
    expect(dateTimeFromJson('2026-10-10T11:00:00+02:00').toISOString()).toBe(
      '2026-10-10T09:00:00.000Z',
    );
  });

  it('rejects a log entry without an exercise id', () => {
    const json = {
      id: 'l',
      peachId: 'p',
      startedAt: '2026-10-10T09:00:00.000Z',
      entries: [{ exerciseName: 'Push Up', sets: [{ reps: 10 }] }],
    };
    expect(() => workoutLogFromJson(json)).toThrow(FormatError);
  });

  it('crate settings reject a negative grace period', () => {
    expect(() => crateSettings({ loggingGraceHours: -1 })).toThrow(RangeError);
    expect(crateSettings({ loggingGraceHours: 0 }).loggingGraceHours).toBe(0);
  });
});
