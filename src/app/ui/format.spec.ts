import { LocalDate } from '../domain/core/local-date';
import { exerciseLogEntry, ExerciseLogEntry } from '../domain/models/workout-log';
import { Fmt } from './format';

/** Human-readable labels and formats. */
describe('Fmt', () => {
  const entry = (loads: (number | null)[]): ExerciseLogEntry =>
    exerciseLogEntry({
      exerciseId: 'bb-back-squat',
      sets: loads.map((kg) => ({ reps: 5, loadKg: kg, seconds: null, meters: null })),
    });

  describe('load', () => {
    it('is null without weights', () => {
      expect(Fmt.load(entry([null, null]), 'metric')).toBeNull();
    });

    it('collapses equal weights and shows a range otherwise', () => {
      expect(Fmt.load(entry([60, 60, 60]), 'metric')).toBe('60 kg');
      expect(Fmt.load(entry([60, 62.5, null]), 'metric')).toBe('60–62.5 kg');
    });

    it('converts to pounds', () => {
      expect(Fmt.load(entry([61.234986]), 'imperial')).toBe('135 lb');
    });
  });

  it('volume groups thousands in the chosen units', () => {
    expect(Fmt.volume(2450, 'metric')).toBe('2,450 kg');
    expect(Fmt.volume(1000, 'imperial')).toBe('2,205 lb');
  });

  it('formats weeks within and across months', () => {
    expect(Fmt.week('2026-10-12' as LocalDate)).toBe('Oct 12 – 18');
    expect(Fmt.week('2026-10-26' as LocalDate)).toBe('Oct 26 – Nov 1');
  });

  it('formats distances and durations', () => {
    expect(Fmt.distance(5000, 'metric')).toBe('5 km');
    expect(Fmt.distance(5000, 'imperial')).toBe('3.11 mi');
    expect(Fmt.duration(45)).toBe('45 s');
    expect(Fmt.duration(1500)).toBe('25:00');
    expect(Fmt.duration(3905)).toBe('1:05:05');
  });

  it('sums an entry up', () => {
    const run = exerciseLogEntry({
      exerciseId: 'bw-run',
      distanceKind: 'runWalk',
      sets: [{ reps: null, loadKg: null, seconds: 1560, meters: 5200 }],
    });
    expect(Fmt.entrySummary(run, 'metric')).toBe('1 set · 5.2 km · 26:00');
    expect(Fmt.entryHeadline(run, 'imperial')).toBe('3.23 mi');
    expect(Fmt.entrySummary(entry([60, 60]), 'metric')).toBe('2 sets · 10 reps · 60 kg');
    expect(Fmt.entryHeadline(entry([60]), 'metric')).toBe('5 reps');
  });

  it('labels categories and amounts in the Peach’s units', () => {
    expect(Fmt.category('weightMoved')).toBe('Weight moved');
    expect(Fmt.amount('runWalk', 10, 'metric')).toBe('10 km');
    expect(Fmt.amount('ride', 16.09344, 'imperial')).toBe('10 mi');
    expect(Fmt.amount('swimRow', 1500, 'imperial')).toBe('1,500 m');
    expect(Fmt.amount('weightMoved', 5000, 'metric')).toBe('5,000 kg');
    expect(Fmt.amount('activeMinutes', 44.6, 'metric')).toBe('45 min');
    expect(Fmt.per('runWalk', 5, 'metric')).toBe('per 5 km');
  });
});
