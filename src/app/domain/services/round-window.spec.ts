import { LocalDate, localDate } from '../core/local-date';
import { UtcZoneClock, ZoneClock } from '../core/zone-clock';
import { Crate, crateSettings } from '../models/crate';
import { Round } from '../models/season';
import { RoundWindow, RoundWindowService } from './round-window';

const utc = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(Date.UTC(y, m - 1, d, h, min));

describe('RoundWindowService', () => {
  const service = new RoundWindowService(new UtcZoneClock());
  const crate: Crate = {
    id: 'c',
    name: 'c',
    description: '',
    ownerPeachId: 'p',
    inviteCode: 'X',
    timeZone: 'UTC',
    createdAt: utc(2026, 1, 1),
    settings: crateSettings({ loggingGraceHours: 3 }),
  };
  const round: Round = {
    id: 'r',
    seasonId: 's',
    index: 0,
    date: localDate(2026, 10, 10),
    focus: 'fullBody',
    status: 'scheduled',
  };

  it('window spans the day plus the grace period', () => {
    const w = service.windowFor(round, crate);
    expect(w.opensAt).toEqual(utc(2026, 10, 10));
    expect(w.closesAt).toEqual(utc(2026, 10, 11, 3));
    expect(w.isOpenAt(utc(2026, 10, 9, 23, 59))).toBe(false);
    expect(w.isOpenAt(utc(2026, 10, 10))).toBe(true);
    expect(w.isOpenAt(utc(2026, 10, 11, 2, 59))).toBe(true);
    expect(w.isOpenAt(utc(2026, 10, 11, 3))).toBe(false);
    expect(w.hasClosedBy(utc(2026, 10, 11, 3))).toBe(true);
    expect(w.hasClosedBy(utc(2026, 10, 11, 2, 59))).toBe(false);
    expect(w.remainingMsAt(utc(2026, 10, 11, 2))).toBe(60 * 60 * 1000);
    expect(w.remainingMsAt(utc(2026, 10, 12))).toBe(0);
  });

  it('a zero grace period closes at the next midnight', () => {
    const w = service.windowFor(round, {
      ...crate,
      settings: crateSettings({ loggingGraceHours: 0 }),
    });
    expect(w.closesAt).toEqual(utc(2026, 10, 11));
    expect(w.isOpenAt(new Date(utc(2026, 10, 11).getTime() - 1))).toBe(true);
  });

  it('uses the zone clock for both ends, so DST-length days stay exact', () => {
    // A stub New York clock around the 2026 spring-forward (8 March):
    // midnight is 05:00Z before the change and 04:00Z after it.
    const ny: ZoneClock = {
      startOfDay(date: LocalDate) {
        const offset = date >= '2026-03-09' ? 4 : 5;
        const [y, m, d] = date.split('-').map(Number);
        return utc(y, m, d, offset);
      },
      dateOf() {
        throw new Error('unused');
      },
    };
    const w = new RoundWindowService(ny).windowFor(
      { ...round, date: localDate(2026, 3, 8) },
      { ...crate, timeZone: 'America/New_York' },
    );
    expect(w.opensAt).toEqual(utc(2026, 3, 8, 5));
    // A 23-hour day plus 3 hours' grace.
    expect(w.closesAt).toEqual(utc(2026, 3, 9, 7));
    expect(w.closesAt.getTime() - w.opensAt.getTime()).toBe(26 * 3600_000);
  });
});

describe('RoundWindow', () => {
  it('is half-open: [opensAt, closesAt)', () => {
    const w = new RoundWindow(utc(2026, 1, 1), utc(2026, 1, 2));
    expect(w.isOpenAt(utc(2026, 1, 1))).toBe(true);
    expect(w.isOpenAt(utc(2026, 1, 2))).toBe(false);
    expect(w.remainingMsAt(utc(2025, 12, 31))).toBe(2 * 86_400_000);
  });
});
