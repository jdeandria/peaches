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
    weekStart: localDate(2026, 10, 12), // Monday
    status: 'scheduled',
  };

  it('covers Monday to Sunday and stays open for the grace period', () => {
    const w = service.windowFor(round, crate);
    expect(w.opensAt).toEqual(utc(2026, 10, 12));
    expect(w.endsAt).toEqual(utc(2026, 10, 19));
    expect(w.closesAt).toEqual(utc(2026, 10, 19, 3));
    expect(w.covers(utc(2026, 10, 11, 23, 59))).toBe(false);
    expect(w.covers(utc(2026, 10, 12))).toBe(true);
    expect(w.covers(utc(2026, 10, 18, 23, 59))).toBe(true);
    // A log started after Sunday midnight belongs to the next week...
    expect(w.covers(utc(2026, 10, 19, 1))).toBe(false);
    // ...but the round is still open to finish submitting.
    expect(w.isOpenAt(utc(2026, 10, 19, 2, 59))).toBe(true);
    expect(w.isOpenAt(utc(2026, 10, 19, 3))).toBe(false);
    expect(w.hasClosedBy(utc(2026, 10, 19, 3))).toBe(true);
    expect(w.hasClosedBy(utc(2026, 10, 19, 2, 59))).toBe(false);
    expect(w.remainingMsAt(utc(2026, 10, 19, 2))).toBe(60 * 60 * 1000);
    expect(w.remainingMsAt(utc(2026, 10, 20))).toBe(0);
  });

  it('a zero grace period closes at the end of Sunday', () => {
    const w = service.windowFor(round, {
      ...crate,
      settings: crateSettings({ loggingGraceHours: 0 }),
    });
    expect(w.closesAt).toEqual(utc(2026, 10, 19));
    expect(w.isOpenAt(new Date(utc(2026, 10, 19).getTime() - 1))).toBe(true);
  });

  it('uses the zone clock for both ends, so DST-length weeks stay exact', () => {
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
      { ...round, weekStart: localDate(2026, 3, 2) },
      { ...crate, timeZone: 'America/New_York' },
    );
    expect(w.opensAt).toEqual(utc(2026, 3, 2, 5));
    expect(w.endsAt).toEqual(utc(2026, 3, 9, 4));
    // A 167-hour week plus 3 hours' grace.
    expect(w.closesAt.getTime() - w.opensAt.getTime()).toBe(170 * 3600_000);
  });
});

describe('RoundWindow', () => {
  it('is half-open: [opensAt, closesAt)', () => {
    const w = new RoundWindow(utc(2026, 1, 1), utc(2026, 1, 2), utc(2026, 1, 2));
    expect(w.isOpenAt(utc(2026, 1, 1))).toBe(true);
    expect(w.isOpenAt(utc(2026, 1, 2))).toBe(false);
    expect(w.remainingMsAt(utc(2025, 12, 31))).toBe(2 * 86_400_000);
  });
});
