import { addDays } from '../core/local-date';
import { ZoneClock } from '../core/zone-clock';
import { Crate } from '../models/crate';
import { Round } from '../models/season';

const MS_PER_HOUR = 3_600_000;

/**
 * When a Round can be logged against.
 *
 * A Round opens at the start of its exercise day in the Crate's time zone
 * and closes at the end of that day plus the Crate's grace period. Logs
 * submitted after close do not count, so the window is the one rule every
 * Peach in a Crate shares regardless of where they live.
 */
export class RoundWindow {
  constructor(
    readonly opensAt: Date,
    readonly closesAt: Date,
  ) {}

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
    const opens = this.zone.startOfDay(round.date, crate.timeZone);
    const nextDay = this.zone.startOfDay(addDays(round.date, 1), crate.timeZone);
    const closes = new Date(nextDay.getTime() + crate.settings.loggingGraceHours * MS_PER_HOUR);
    return new RoundWindow(opens, closes);
  }
}
