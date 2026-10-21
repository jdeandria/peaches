import {
  HeartRateReading,
  HeartRateSummary,
  HeartRateWindow,
  latestHeartRate,
  summarizeHeartRate,
} from '../domain/models/heart-rate';
import { heartRateSpan } from '../domain/models/workout-log';
import { WorkoutLogRepository } from '../domain/repositories';
import { DomainError } from './errors';
import { LoggingService } from './logging-service';

/**
 * Where heart rate comes from: the cloud a Peach's wearable syncs to
 * (Google Health on Firebase builds; a simulated watch in the demo). The
 * implementations live in the data layer.
 *
 * Failures reject with a `DomainError` whose message can be shown as-is;
 * {@link HeartRateAccessLost} when the Peach has to connect again.
 */
export interface HeartRateSource {
  /** What the Peach connects to, e.g. "Google Health". */
  readonly name: string;
  /** Whether this device can read heart rate right now. */
  readonly connected: boolean;
  /** Gets ready to connect (loads scripts), so {@link connect} opens its window promptly. */
  prepare(): Promise<void>;
  /**
   * Asks the Peach for access. Call it from a tap: it opens a window, and
   * browsers block windows that no tap opened. `hint` is the email of the
   * account to suggest.
   */
  connect(hint?: string | null): Promise<void>;
  disconnect(): Promise<void>;
  /** Heart rate per minute over `[from, to)`, oldest first; minutes without readings are left out. */
  windows(from: Date, to: Date): Promise<HeartRateWindow[]>;
}

/** Access has lapsed or been withdrawn; connecting again restores it. */
export class HeartRateAccessLost extends DomainError {}

/** A log's heart rate as last read: its summary so far and the newest reading. */
export interface HeartRateUpdate {
  readonly summary: HeartRateSummary | null;
  readonly latest: HeartRateReading | null;
}

/**
 * Reads a Peach's heart rate over a workout and keeps the summary on their
 * log, while the workout is on and afterwards. Wearables sync in batches,
 * so the newest reading can be minutes old, and reading again after the
 * watch syncs fills the summary in.
 */
export class HeartRateService {
  constructor(
    private readonly deps: {
      source: HeartRateSource;
      logs: WorkoutLogRepository;
      logging: LoggingService;
    },
  ) {}

  get source(): HeartRateSource {
    return this.deps.source;
  }

  /**
   * Reads the heart rate over the log's span so far and saves its summary
   * on the log. A read that finds nothing keeps what the log already has.
   */
  async refresh(logId: string, now: Date): Promise<HeartRateUpdate> {
    const log = await this.deps.logs.getById(logId);
    if (!log) throw new DomainError('Workout log not found.');
    const { from, to } = heartRateSpan(log, now);
    const windows = to > from ? await this.deps.source.windows(from, to) : [];
    const summary = summarizeHeartRate(windows);
    if (summary) await this.deps.logging.recordHeartRate(logId, summary);
    return { summary: summary ?? log.heartRate, latest: latestHeartRate(windows) };
  }
}
