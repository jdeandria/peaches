import { LocalDate, localDate, toUtcDate } from '../../domain/core/local-date';
import { ZoneClock } from '../../domain/core/zone-clock';

const MS_PER_MINUTE = 60_000;

/**
 * {@link ZoneClock} backed by the browser's IANA time-zone data through
 * `Intl.DateTimeFormat`, so no tz database ships with the app.
 *
 * Unknown zone names fall back to UTC rather than throwing, since a bad zone
 * string on one Crate must never take the app down.
 */
export class IntlZoneClock implements ZoneClock {
  private readonly formatters = new Map<string, Intl.DateTimeFormat>();

  startOfDay(date: LocalDate, timeZone: string): Date {
    const midnightUtc = toUtcDate(date).getTime();
    // Local midnight is UTC midnight minus the zone's offset at that moment.
    // Re-evaluate once, since the offset at the guess can differ across a
    // DST change.
    let guess = midnightUtc - this.offsetMinutes(new Date(midnightUtc), timeZone) * MS_PER_MINUTE;
    guess = midnightUtc - this.offsetMinutes(new Date(guess), timeZone) * MS_PER_MINUTE;
    // Where midnight does not exist (a DST gap at 00:00), the day starts at
    // the first instant whose local date is `date`; step forward to it.
    for (let i = 0; i < 4 && this.dateOf(new Date(guess), timeZone) < date; i++) {
      guess += 30 * MS_PER_MINUTE;
    }
    return new Date(guess);
  }

  dateOf(instant: Date, timeZone: string): LocalDate {
    const parts = this.parts(instant, timeZone);
    return localDate(parts.year, parts.month, parts.day);
  }

  /** Minutes the zone is ahead of UTC at `instant`. */
  private offsetMinutes(instant: Date, timeZone: string): number {
    const p = this.parts(instant, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const truncated = instant.getTime() - instant.getUTCMilliseconds();
    return Math.round((asUtc - truncated) / MS_PER_MINUTE);
  }

  private parts(instant: Date, timeZone: string) {
    const values: Record<string, number> = {};
    for (const part of this.formatter(timeZone).formatToParts(instant)) {
      if (part.type !== 'literal') values[part.type] = Number(part.value);
    }
    return {
      year: values['year'],
      month: values['month'],
      day: values['day'],
      // Some engines render midnight as hour 24 with hourCycle h23 unset.
      hour: values['hour'] % 24,
      minute: values['minute'],
      second: values['second'],
    };
  }

  private formatter(timeZone: string): Intl.DateTimeFormat {
    let f = this.formatters.get(timeZone);
    if (!f) {
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hourCycle: 'h23',
      };
      try {
        f = new Intl.DateTimeFormat('en-US', { ...options, timeZone });
      } catch {
        f = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' });
      }
      this.formatters.set(timeZone, f);
    }
    return f;
  }
}

/** The device's IANA time zone, or UTC when the browser does not say. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
