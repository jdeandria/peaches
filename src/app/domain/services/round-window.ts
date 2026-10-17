import { addDays } from '../core/local-date';
import { ZoneClock } from '../core/zone-clock';
import { Crate } from '../models/crate';
import { Round } from '../models/season';

const MS_PER_HOUR = 3_600_000;

/**
 * The week a Round covers, and how long it stays open after.
 *
 * A Round opens at the start of its Monday in the Crate's time zone; logs
 * started from then until the next Monday (`endsAt`) count toward it. It
 * closes, and is scored, at `endsAt` plus the Crate's grace period, so a
 * Sunday-night workout submitted after midnight still counts. These are the
 * rules every Peach in a Crate shares regardless of where they live.
 */
export class RoundWindow {
  constructor(
    readonly opensAt: Date,
    readonly endsAt: Date,
    readonly closesAt: Date,
  ) {}

  /** Whether a log started at `instant` counts toward this Round. */
  covers(instant: Date): boolean {
    return instant.getTime() >= this.opensAt.getTime() && instant < this.endsAt;
  }

  isOpenAt(instant: Date): boolean {
    return instant.getTime() >= this.opensAt.getTime() && instant < this.closesAt;
  }

  hasClosedBy(instant: Date): boolean {
    return instant.getTime() >= this.closesAt.getTime();
  }

  /** Milliseconds until close, never negative. */
  remainingMsAt(instant: Date): number {
    return Math.max(0, this.closesAt.getTime() - instant.getTime());
  }
}

export class RoundWindowService {
  constructor(private readonly zone: ZoneClock) {}

  windowFor(round: Round, crate: Crate): RoundWindow {
    const opens = this.zone.startOfDay(round.weekStart, crate.timeZone);
    const ends = this.zone.startOfDay(addDays(round.weekStart, 7), crate.timeZone);
    const closes = new Date(ends.getTime() + crate.settings.loggingGraceHours * MS_PER_HOUR);
    return new RoundWindow(opens, ends, closes);
  }
}
