import {
  HeartRateWindow,
  heartRateSummaryFromJson,
  latestHeartRate,
  summarizeHeartRate,
} from './heart-rate';
import { heartRateSpan, sharedCopyOf, workoutLog } from './workout-log';

const t = (minutes: number) => new Date(Date.UTC(2026, 9, 12, 9) + minutes * 60_000);
const minute = (at: number, avgBpm: number, minBpm = avgBpm, maxBpm = avgBpm): HeartRateWindow => ({
  start: t(at),
  end: t(at + 1),
  avgBpm,
  minBpm,
  maxBpm,
});

describe('heart rate summaries', () => {
  it('averages over time, with the lowest and highest readings', () => {
    const windows = [minute(0, 100, 90, 110), minute(1, 150, 140, 165), minute(2, 160, 150, 172)];
    expect(summarizeHeartRate(windows)).toEqual({
      avgBpm: 137,
      minBpm: 90,
      maxBpm: 172,
      minutes: 3,
    });
  });

  it('weights each window by how long it covers', () => {
    const long = { start: t(0), end: t(3), avgBpm: 120, minBpm: 120, maxBpm: 120 };
    expect(summarizeHeartRate([long, minute(3, 160)])?.avgBpm).toBe(130);
  });

  it('ignores implausible readings and has nothing to say without readings', () => {
    expect(summarizeHeartRate([])).toBeNull();
    expect(summarizeHeartRate([minute(0, 0), minute(1, 400), minute(2, Number.NaN)])).toBeNull();
    expect(summarizeHeartRate([minute(0, 0), minute(1, 120)])?.avgBpm).toBe(120);
  });

  it('the newest window is the reading "now"', () => {
    expect(latestHeartRate([minute(5, 140), minute(2, 110), minute(4, 400)])).toEqual({
      bpm: 140,
      at: t(6),
    });
    expect(latestHeartRate([])).toBeNull();
  });

  it('decodes stored summaries, and nothing from junk', () => {
    const json = { avgBpm: 130, minBpm: 80, maxBpm: 170, minutes: 20 };
    expect(heartRateSummaryFromJson(json)).toEqual(json);
    expect(heartRateSummaryFromJson(null)).toBeNull();
    expect(heartRateSummaryFromJson('140')).toBeNull();
    expect(heartRateSummaryFromJson({})).toBeNull();
  });
});

describe('the span a log’s heart rate covers', () => {
  const draft = workoutLog({ id: 'l', peachId: 'p', startedAt: t(0), timerStartedAt: t(0) });

  it('runs to now while the workout is on, and to its finish after', () => {
    expect(heartRateSpan(draft, t(30))).toEqual({ from: t(0), to: t(30) });
    const done = {
      ...draft,
      status: 'submitted' as const,
      completedAt: t(45),
      durationSeconds: 2400,
    };
    expect(heartRateSpan(done, t(600))).toEqual({ from: t(0), to: t(45) });
  });

  it('uses the session time when the start was moved past the finish', () => {
    const moved = {
      ...draft,
      status: 'submitted' as const,
      startedAt: t(120),
      completedAt: t(45),
      durationSeconds: 1800,
    };
    expect(heartRateSpan(moved, t(600))).toEqual({ from: t(120), to: t(150) });
  });

  it('never covers more than ten hours', () => {
    expect(heartRateSpan(draft, t(24 * 60)).to).toEqual(t(600));
  });
});

describe('shared copies', () => {
  it('leave the heart rate out', () => {
    const log = workoutLog({
      id: 'l',
      peachId: 'p',
      startedAt: t(0),
      heartRate: { avgBpm: 130, minBpm: 80, maxBpm: 170, minutes: 20 },
    });
    expect(sharedCopyOf(log)).toEqual({ ...log, heartRate: null });
    const without = { ...log, heartRate: null };
    expect(sharedCopyOf(without)).toBe(without);
  });
});
