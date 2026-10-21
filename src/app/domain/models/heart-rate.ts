import { intFromJson, JsonMap, mapFromJson } from '../core/json';

/** Heart rate over one window of a session, as a wearable recorded it. */
export interface HeartRateWindow {
  readonly start: Date;
  readonly end: Date;
  readonly avgBpm: number;
  readonly minBpm: number;
  readonly maxBpm: number;
}

/**
 * What a Peach's heart did during a workout. Kept on their own log only:
 * it never scores and is never shared with a Crate.
 */
export interface HeartRateSummary {
  /** Time-weighted over the minutes that have readings. */
  readonly avgBpm: number;
  readonly minBpm: number;
  readonly maxBpm: number;
  /** How many of the session's minutes have readings. */
  readonly minutes: number;
}

/** The newest reading in a session, for showing while it is on. */
export interface HeartRateReading {
  readonly bpm: number;
  readonly at: Date;
}

/** Wearables report 1–300 bpm; anything else is noise. */
const PLAUSIBLE_BPM = { min: 1, max: 300 } as const;

/** The longest window a summary covers; the longest a session can record. */
export const MAX_HEART_RATE_WINDOW_MS = 10 * 3600 * 1000;

function plausible(w: HeartRateWindow): boolean {
  const ok = (bpm: number) =>
    Number.isFinite(bpm) && bpm >= PLAUSIBLE_BPM.min && bpm <= PLAUSIBLE_BPM.max;
  return ok(w.avgBpm) && ok(w.minBpm) && ok(w.maxBpm) && w.end > w.start;
}

/** Sums up a session's windows; null when none has a reading. */
export function summarizeHeartRate(windows: readonly HeartRateWindow[]): HeartRateSummary | null {
  const valid = windows.filter(plausible);
  if (valid.length === 0) return null;
  let weighted = 0;
  let ms = 0;
  for (const w of valid) {
    const span = w.end.getTime() - w.start.getTime();
    weighted += w.avgBpm * span;
    ms += span;
  }
  return {
    avgBpm: Math.round(weighted / ms),
    minBpm: Math.round(Math.min(...valid.map((w) => w.minBpm))),
    maxBpm: Math.round(Math.max(...valid.map((w) => w.maxBpm))),
    minutes: Math.max(1, Math.round(ms / 60_000)),
  };
}

/** The newest window's average, as the heart rate "now". */
export function latestHeartRate(windows: readonly HeartRateWindow[]): HeartRateReading | null {
  const valid = windows.filter(plausible);
  if (valid.length === 0) return null;
  const newest = valid.reduce((a, b) => (b.end > a.end ? b : a));
  return { bpm: Math.round(newest.avgBpm), at: newest.end };
}

export function heartRateSummaryFromJson(raw: unknown): HeartRateSummary | null {
  const json = mapFromJson(raw);
  if (!json) return null;
  const summary = {
    avgBpm: intFromJson(json['avgBpm']),
    minBpm: intFromJson(json['minBpm']),
    maxBpm: intFromJson(json['maxBpm']),
    minutes: intFromJson(json['minutes']),
  };
  return summary.avgBpm > 0 ? summary : null;
}

export function heartRateSummaryToJson(s: HeartRateSummary): JsonMap {
  return { avgBpm: s.avgBpm, minBpm: s.minBpm, maxBpm: s.maxBpm, minutes: s.minutes };
}
