/**
 * Shared JSON helpers used by every serialisable domain model.
 *
 * Models serialise by hand (no decorators or code generation) so the domain
 * layer stays plain TypeScript. These helpers keep that code DRY and make
 * enum handling consistent and forward compatible: unknown names can appear
 * when an older client reads data written by a newer one.
 */

export type JsonMap = Record<string, unknown>;

/** Thrown when stored data cannot be decoded. */
export class FormatError extends Error {
  override readonly name = 'FormatError';
}

/**
 * Looks up an enum value by name, returning `fallback` (or throwing a
 * {@link FormatError}) when the stored name is unknown.
 */
export function enumFromJson<T extends string>(
  values: readonly T[],
  raw: unknown,
  fallback?: T,
): T {
  if (typeof raw === 'string' && (values as readonly string[]).includes(raw)) return raw as T;
  if (fallback !== undefined) return fallback;
  throw new FormatError(`Unknown enum value "${String(raw)}"`);
}

/** Decodes a list of enum names, silently dropping unknown names. */
export function enumListFromJson<T extends string>(values: readonly T[], raw: unknown): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is T => typeof item === 'string' && (values as readonly string[]).includes(item),
  );
}

export function stringListFromJson(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : [];
}

export function mapListFromJson(raw: unknown): JsonMap[] {
  return Array.isArray(raw)
    ? raw.filter((m): m is JsonMap => m !== null && typeof m === 'object' && !Array.isArray(m))
    : [];
}

export function mapFromJson(raw: unknown): JsonMap | null {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as JsonMap) : null;
}

export function requireString(raw: unknown, field: string): string {
  if (typeof raw !== 'string') throw new FormatError(`Expected a string for "${field}"`);
  return raw;
}

export function stringOrNull(raw: unknown): string | null {
  return typeof raw === 'string' ? raw : null;
}

/**
 * ISO-8601 date-times as written by `toISOString` (microsecond precision
 * and numeric offsets are accepted too). Checked before `new Date`, which also accepts loose
 * forms such as "1" or "October 10, 2026".
 */
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?$/;

export function dateTimeFromJson(raw: unknown): Date {
  const date = typeof raw === 'string' && ISO_DATE_TIME.test(raw) ? new Date(raw) : null;
  if (date === null || Number.isNaN(date.getTime())) {
    throw new FormatError(`Invalid timestamp "${String(raw)}"`);
  }
  return date;
}

export function dateTimeOrNullFromJson(raw: unknown): Date | null {
  return raw === null || raw === undefined ? null : dateTimeFromJson(raw);
}

export function dateTimeToJson(value: Date): string {
  return value.toISOString();
}

export function numberFromJson(raw: unknown, fallback = 0): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

/** Like {@link numberFromJson} but truncates toward zero. */
export function intFromJson(raw: unknown, fallback = 0): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.trunc(raw) : fallback;
}

export function intOrNullFromJson(raw: unknown): number | null {
  return raw === null || raw === undefined ? null : intFromJson(raw);
}

export function numberOrNullFromJson(raw: unknown): number | null {
  return raw === null || raw === undefined ? null : numberFromJson(raw);
}
