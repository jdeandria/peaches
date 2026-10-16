import { LocalDate, localDateOfUtc, toUtcDate } from './local-date';

/**
 * Converts between calendar dates in an IANA time zone and UTC instants.
 *
 * The domain keeps exercise days as {@link LocalDate}s in the Crate's zone;
 * this is the single place where those dates meet the clock. The real
 * implementation uses the browser's `Intl` time-zone data; tests use
 * {@link UtcZoneClock}.
 */
export interface ZoneClock {
  /** The instant at which `date` begins in `timeZone`. */
  startOfDay(date: LocalDate, timeZone: string): Date;

  /** The calendar date of `instant` as seen in `timeZone`. */
  dateOf(instant: Date, timeZone: string): LocalDate;
}

/**
 * Treats every zone as UTC. Correct for Crates in UTC and good enough for
 * tests; never use it in production.
 */
export class UtcZoneClock implements ZoneClock {
  startOfDay(date: LocalDate): Date {
    return toUtcDate(date);
  }

  dateOf(instant: Date): LocalDate {
    return localDateOfUtc(instant);
  }
}
