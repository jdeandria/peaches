import { HeartRateSource } from '../../application/heart-rate';
import { SeededRandom } from '../../domain/core/random';
import { stableHash } from '../../domain/core/stable-hash';
import { HeartRateWindow } from '../../domain/models/heart-rate';

const MINUTE_MS = 60_000;

/**
 * A pretend watch for the demo: a heart that warms up over the first ten
 * minutes of a session and then works around 140 bpm. Readings are a
 * pure function of the minute, so every read agrees with the last one.
 */
export class DemoHeartRateSource implements HeartRateSource {
  readonly name = 'Google Health (demo)';
  connected = false;

  async prepare(): Promise<void> {
    // Nothing to load.
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async windows(from: Date, to: Date): Promise<HeartRateWindow[]> {
    const windows: HeartRateWindow[] = [];
    const first = Math.ceil(from.getTime() / MINUTE_MS) * MINUTE_MS;
    for (let start = first; start + MINUTE_MS <= to.getTime(); start += MINUTE_MS) {
      const minutesIn = (start - from.getTime()) / MINUTE_MS;
      const warmup = Math.min(1, minutesIn / 10);
      const random = new SeededRandom(stableHash(new Date(start).toISOString()));
      const avg = 95 + 45 * warmup + random.nextInt(15) - 7;
      windows.push({
        start: new Date(start),
        end: new Date(start + MINUTE_MS),
        avgBpm: avg,
        minBpm: avg - 3 - random.nextInt(6),
        maxBpm: avg + 3 + random.nextInt(10),
      });
    }
    return windows;
  }
}
