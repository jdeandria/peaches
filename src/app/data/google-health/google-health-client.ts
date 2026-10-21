import { DomainError } from '../../application/errors';
import { HeartRateAccessLost } from '../../application/heart-rate';
import { HeartRateWindow } from '../../domain/models/heart-rate';

/** The Google Health API (v4), which serves what Fitbit and Pixel Watch devices sync. */
export const GOOGLE_HEALTH_API = 'https://health.googleapis.com/v4';

/** Read access to heart rate (and the other health metrics); nothing else. */
export const HEART_RATE_SCOPE =
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly';

/** Heart rate is rolled up a minute at a time. */
const WINDOW_SECONDS = 60;

/** Over the 1,440 default, so a ten-hour session is one page. */
const PAGE_SIZE = 1000;

/** Pages to follow before giving up; a session is at most one. */
const MAX_PAGES = 5;

/** Finish waits for a read, so a slow one gives up rather than holding it. */
const TIMEOUT_MS = 10_000;

/** The part of `rollupDataPoints[]` we read. */
interface RollupDataPoint {
  readonly startTime?: string;
  readonly endTime?: string;
  readonly heartRate?: {
    readonly beatsPerMinuteAvg?: number;
    readonly beatsPerMinuteMin?: number;
    readonly beatsPerMinuteMax?: number;
  };
}

interface RollUpResponse {
  readonly rollupDataPoints?: readonly RollupDataPoint[];
  readonly nextPageToken?: string;
}

/**
 * Reads heart rate from the Google Health API with an OAuth access token
 * (see `GoogleHealthHeartRateSource` for getting one).
 *
 * It asks for a roll-up (`dataPoints:rollUp`) rather than the raw samples:
 * Google reconciles readings from every device and leaves out time the
 * watch wasn't worn, and a minute's average, minimum and maximum are all
 * a workout summary needs.
 */
export class GoogleHealthClient {
  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args)) {}

  /** Heart rate per minute over `[from, to)`, oldest first; minutes without readings are left out. */
  async heartRateWindows(token: string, from: Date, to: Date): Promise<HeartRateWindow[]> {
    if (to <= from) return [];
    const windows: HeartRateWindow[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await this.rollUp(token, {
        range: { startTime: from.toISOString(), endTime: to.toISOString() },
        windowSize: `${WINDOW_SECONDS}s`,
        pageSize: PAGE_SIZE,
        ...(pageToken ? { pageToken } : {}),
      });
      windows.push(...(response.rollupDataPoints ?? []).flatMap(toWindow));
      pageToken = response.nextPageToken || undefined;
      if (!pageToken) break;
    }
    return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private async rollUp(token: string, body: object): Promise<RollUpResponse> {
    let response: Response;
    try {
      response = await this.fetchFn(
        `${GOOGLE_HEALTH_API}/users/me/dataTypes/heart-rate/dataPoints:rollUp`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
    } catch {
      throw new DomainError('Couldn’t reach Google Health. Check your connection.');
    }
    if (response.ok) return (await response.json()) as RollUpResponse;
    switch (response.status) {
      case 401:
        throw new HeartRateAccessLost('Connect Google Health again to keep tracking heart rate.');
      case 403:
        throw new HeartRateAccessLost('Google Health didn’t allow Peaches to read heart rate.');
      case 429:
        throw new DomainError('Google Health is busy. Heart rate will catch up in a minute.');
      default:
        throw new DomainError(`Google Health couldn’t send heart rate (error ${response.status}).`);
    }
  }
}

function toWindow(point: RollupDataPoint): HeartRateWindow[] {
  const hr = point.heartRate;
  const avg = hr?.beatsPerMinuteAvg;
  if (!point.startTime || !point.endTime || typeof avg !== 'number') return [];
  const start = new Date(point.startTime);
  const end = new Date(point.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  return [
    {
      start,
      end,
      avgBpm: avg,
      minBpm: hr?.beatsPerMinuteMin ?? avg,
      maxBpm: hr?.beatsPerMinuteMax ?? avg,
    },
  ];
}
