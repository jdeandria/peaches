/**
 * A calendar date with no time or zone component, as an ISO-8601 string
 * (`yyyy-MM-dd`).
 *
 * Exercise days, season boundaries and logging windows are all calendar
 * dates in the owning Crate's time zone. Using `Date` for those would
 * silently drag a time zone along and produce off-by-one-day bugs, so the
 * domain uses this type instead and converts at the edges.
 *
 * Being a string, a `LocalDate` compares with `===`, sorts with `<`, and
 * works as a `Map`/`Set` key. The brand stops arbitrary strings standing in
 * for one: build them with {@link localDate}, {@link parseLocalDate} or
 * {@link localDateOfUtc}.
 */
export type LocalDate = string & { readonly __brand: 'LocalDate' };

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** `Date.UTC` without its quirk of mapping years 0..99 to 1900..1999. */
function utcMs(year: number, month: number, day: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  return d.getTime();
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

/** Builds a date from calendar fields. Month and day are 1-based. */
export function localDate(year: number, month: number, day: number): LocalDate {
  if (month < 1 || month > 12) throw new RangeError('month must be 1..12');
  if (day < 1 || day > 31) throw new RangeError('day must be 1..31');
  // Days past the end of the month roll over (Feb 30 -> Mar 2), which keeps
  // date arithmetic simple; parsing stored dates rejects them instead.
  return fromUtcMs(utcMs(year, month, day));
}

/** Parses an ISO-8601 calendar date (`yyyy-MM-dd`). */
export function parseLocalDate(iso: string): LocalDate {
  const match = ISO_PATTERN.exec(iso);
  if (!match) throw new SyntaxError(`Invalid LocalDate: ${iso}`);
  const date = localDate(Number(match[1]), Number(match[2]), Number(match[3]));
  // A stored "2026-02-30" is corrupt; silently shifting it by days would be worse.
  if (date !== iso) throw new SyntaxError(`Invalid LocalDate: ${iso}`);
  return date;
}

/** The calendar date of `instant` in UTC. Convert to a zone with a ZoneClock. */
export function localDateOfUtc(instant: Date): LocalDate {
  return fromUtcMs(instant.getTime());
}

/** The calendar date of `instant` in the device's local time zone. */
export function localDateOfLocal(instant: Date): LocalDate {
  return localDate(instant.getFullYear(), instant.getMonth() + 1, instant.getDate());
}

function fromUtcMs(ms: number): LocalDate {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` as LocalDate;
}

export function yearOf(date: LocalDate): number {
  return Number(date.slice(0, 4));
}

export function monthOf(date: LocalDate): number {
  return Number(date.slice(5, 7));
}

export function dayOf(date: LocalDate): number {
  return Number(date.slice(8, 10));
}

/** Midnight UTC at the start of `date`. */
export function toUtcDate(date: LocalDate): Date {
  return new Date(utcMs(yearOf(date), monthOf(date), dayOf(date)));
}

/** Days since the Unix epoch, convenient for arithmetic. */
export function epochDay(date: LocalDate): number {
  return Math.round(toUtcDate(date).getTime() / MS_PER_DAY);
}

/** ISO weekday: Monday = 1 ... Sunday = 7. */
export function weekday(date: LocalDate): number {
  const js = toUtcDate(date).getUTCDay(); // Sunday = 0
  return js === 0 ? 7 : js;
}

/** The Monday on or before `date`: weeks run Monday to Sunday. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, 1 - weekday(date));
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(toUtcDate(date).getTime() + days * MS_PER_DAY);
}

/** Signed number of days from `from` to `to`. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return epochDay(to) - epochDay(from);
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export const ISO_WEEKDAYS = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
} as const;
