import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface ParsedLocalDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  readonly weekday: number;
}

/**
 * Parses a LocalDate ISO string (`yyyy-MM-dd`) without going through local
 * time zones. Returns null for malformed or impossible dates.
 */
export function parseLocalDate(iso: string | null | undefined): ParsedLocalDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) return null;
  return { year, month, day, weekday: isoWeekday(year, month, day) };
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Sakamoto's algorithm, mapped to ISO weekday (Mon = 1). */
function isoWeekday(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const yy = m < 3 ? y - 1 : y;
  const dow =
    (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1] + d) % 7;
  return dow === 0 ? 7 : dow; // 0 = Sunday
}

/**
 * A small calendar tile: weekday above the day of month (port of
 * `DateBadge`). Announced as e.g. "Monday, March 3".
 */
@Component({
  selector: 'pch-date-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@let d = parsed();
    @if (d) {
      <span class="weekday pch-label-small" aria-hidden="true">{{ weekday() }}</span>
      <span class="day pch-title-medium" aria-hidden="true">{{ d.day }}</span>
      <span class="pch-visually-hidden">{{ label() }}</span>
    } @else {
      <span class="day pch-title-medium">–</span>
    }`,
  styles: `
    :host {
      box-sizing: border-box;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      flex: none;
      width: 44px;
      padding: 4px 0;
      border-radius: var(--pch-radius-medium);
      background: var(--mat-sys-surface-container);
      color: var(--mat-sys-on-surface);
    }
    .weekday {
      color: var(--mat-sys-primary);
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }
  `,
})
export class DateBadge {
  /** A LocalDate as `yyyy-MM-dd`. */
  readonly date = input.required<string>();

  protected readonly parsed = computed(() => parseLocalDate(this.date()));
  protected readonly weekday = computed(() => {
    const d = this.parsed();
    return d ? DAYS[d.weekday - 1] : '';
  });
  protected readonly label = computed(() => {
    const d = this.parsed();
    return d ? `${LONG_DAYS[d.weekday - 1]}, ${MONTHS[d.month - 1]} ${d.day}` : '';
  });
}
