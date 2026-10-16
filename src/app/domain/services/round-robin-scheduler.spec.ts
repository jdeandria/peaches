import { SequentialIdGenerator } from '../core/ids';
import { addDays, ISO_WEEKDAYS, localDate, LocalDate } from '../core/local-date';
import { isBye, matchupPeachIds, Season } from '../models/season';
import { ExerciseDayPlanner, matchupsIn, RoundRobinScheduler } from './round-robin-scheduler';

function season(peaches: string[], dayCount: number, days?: LocalDate[]): Season {
  return {
    id: 's1',
    crateId: 'c1',
    name: 'test',
    exerciseDays:
      days ?? Array.from({ length: dayCount }, (_, i) => addDays(localDate(2026, 11, 1), i * 2)),
    participantIds: peaches,
    status: 'draft',
    createdAt: new Date(Date.UTC(2026, 0, 1)),
  };
}

const scheduler = () => new RoundRobinScheduler(new SequentialIdGenerator('s'));
const pairKey = (a: string, b: string) => [a, b].sort().join('-');

describe('RoundRobinScheduler', () => {
  it('creates one round per exercise day in date order', () => {
    const s = scheduler().schedule(season(['a', 'b', 'c', 'd'], 5), 'generalFitness');
    expect(s.rounds.length).toBe(5);
    s.rounds.forEach((r, i) => {
      expect(r.index).toBe(i);
      expect(r.status).toBe('scheduled');
      expect(r.seasonId).toBe('s1');
      if (i > 0) expect(r.date > s.rounds[i - 1].date).toBe(true);
    });
  });

  it('sorts unsorted exercise days chronologically', () => {
    const days = [localDate(2026, 12, 1), localDate(2026, 11, 3), localDate(2027, 1, 5)];
    const s = scheduler().schedule(season(['a', 'b'], 0, days), 'generalFitness');
    expect(s.rounds.map((r) => r.date)).toEqual(['2026-11-03', '2026-12-01', '2027-01-05']);
    // The season itself is left untouched.
    expect(days[0]).toBe('2026-12-01');
  });

  it('every participant appears exactly once per round (even count)', () => {
    const peaches = ['a', 'b', 'c', 'd', 'e', 'f'];
    const s = scheduler().schedule(season(peaches, 5), 'generalFitness');
    for (const round of s.rounds) {
      const ids = matchupsIn(s, round).flatMap(matchupPeachIds);
      expect(new Set(ids), `round ${round.index}`).toEqual(new Set(peaches));
      expect(ids.length).toBe(peaches.length);
      expect(matchupsIn(s, round).some(isBye)).toBe(false);
    }
  });

  it('odd participant counts give exactly one bye per round', () => {
    const peaches = ['a', 'b', 'c', 'd', 'e'];
    const s = scheduler().schedule(season(peaches, 5), 'generalFitness');
    const byeHolders: string[] = [];
    for (const round of s.rounds) {
      const ms = matchupsIn(s, round);
      expect(ms.filter(isBye).length, `round ${round.index}`).toBe(1);
      byeHolders.push(ms.find(isBye)!.homePeachId);
      expect(new Set(ms.flatMap(matchupPeachIds))).toEqual(new Set(peaches));
    }
    // Over one full cycle (n rounds) everyone gets exactly one bye.
    expect(new Set(byeHolders)).toEqual(new Set(peaches));
  });

  it('each pair meets exactly once per cycle', () => {
    const peaches = ['a', 'b', 'c', 'd', 'e', 'f'];
    const cycle = peaches.length - 1;
    const s = scheduler().schedule(season(peaches, cycle), 'generalFitness');
    const pairs = s.matchups.map((m) => pairKey(m.homePeachId, m.awayPeachId!));
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs.length).toBe((peaches.length * cycle) / 2);
  });

  it('each pair meets exactly once per cycle with an odd count', () => {
    const peaches = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const s = scheduler().schedule(season(peaches, 7), 'generalFitness');
    const pairs = s.matchups
      .filter((m) => !isBye(m))
      .map((m) => pairKey(m.homePeachId, m.awayPeachId!));
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs.length).toBe((7 * 6) / 2);
  });

  it('schedule repeats with home and away swapped on the second cycle', () => {
    const s = scheduler().schedule(season(['a', 'b', 'c', 'd'], 6), 'generalFitness');
    const first = matchupsIn(s, s.rounds[0]);
    const second = matchupsIn(s, s.rounds[3]);
    for (const m of first) {
      const mirror = second.find(
        (x) => x.homePeachId === m.awayPeachId && x.awayPeachId === m.homePeachId,
      );
      expect(mirror).toBeDefined();
    }
  });

  it('a bye is always recorded on the home side', () => {
    const s = scheduler().schedule(season(['a', 'b', 'c'], 9), 'generalFitness');
    for (const m of s.matchups) {
      expect(m.homePeachId).toBeTruthy();
      if (isBye(m)) expect(m.awayPeachId).toBeNull();
    }
    expect(s.matchups.filter(isBye).length).toBe(9);
  });

  it('is deterministic', () => {
    const a = scheduler().schedule(season(['a', 'b', 'c'], 4), 'strength');
    const b = scheduler().schedule(season(['a', 'b', 'c'], 4), 'strength');
    expect(a.matchups).toEqual(b.matchups);
    expect(a.rounds).toEqual(b.rounds);
  });

  it('every id is unique and matchups reference their round', () => {
    const s = scheduler().schedule(season(['a', 'b', 'c', 'd', 'e'], 6), 'strength');
    const ids = [...s.rounds.map((r) => r.id), ...s.matchups.map((m) => m.id)];
    expect(new Set(ids).size).toBe(ids.length);
    const roundIds = new Set(s.rounds.map((r) => r.id));
    for (const m of s.matchups) {
      expect(roundIds.has(m.roundId)).toBe(true);
      expect(m.seasonId).toBe('s1');
      expect(m.status).toBe('scheduled');
      expect(m.workoutId).toBeNull();
      expect(m.result).toBeNull();
    }
  });

  it('a single participant gets a bye every round', () => {
    const s = scheduler().schedule(season(['solo'], 3), 'strength');
    expect(s.rounds.length).toBe(3);
    expect(s.matchups.length).toBe(3);
    expect(s.matchups.every((m) => isBye(m) && m.homePeachId === 'solo')).toBe(true);
  });

  it('no participants gives rounds with no matchups', () => {
    const s = scheduler().schedule(season([], 3), 'strength');
    expect(s.rounds.length).toBe(3);
    expect(s.matchups).toEqual([]);
  });

  it('two participants play each other every round', () => {
    const s = scheduler().schedule(season(['a', 'b'], 4), 'strength');
    expect(s.matchups.length).toBe(4);
    for (const m of s.matchups)
      expect(new Set([m.homePeachId, m.awayPeachId])).toEqual(new Set(['a', 'b']));
    expect(new Set(s.matchups.map((m) => m.homePeachId))).toEqual(new Set(['a', 'b']));
  });

  it('rounds carry a focus from the rotation', () => {
    const s = scheduler().schedule(season(['a', 'b'], 4), 'generalFitness');
    expect(new Set(s.rounds.map((r) => r.focus)).size).toBeGreaterThan(1);
  });
});

describe('ExerciseDayPlanner', () => {
  const planner = new ExerciseDayPlanner();

  it('selects matching weekdays inclusive of both ends', () => {
    const days = planner.weekdaysBetween(
      localDate(2026, 10, 5), // Monday
      localDate(2026, 10, 18), // Sunday
      new Set([ISO_WEEKDAYS.monday, ISO_WEEKDAYS.wednesday, ISO_WEEKDAYS.friday]),
    );
    expect(days.map((d) => Number(d.slice(8)))).toEqual([5, 7, 9, 12, 14, 16]);
  });

  it('returns empty when the range is reversed', () => {
    expect(
      planner.weekdaysBetween(localDate(2026, 10, 18), localDate(2026, 10, 5), new Set([1])),
    ).toEqual([]);
  });

  it('walks across month, year and DST boundaries', () => {
    const days = planner.weekdaysBetween(
      localDate(2026, 10, 20),
      localDate(2027, 1, 10),
      new Set([7]),
    );
    // Every Sunday from 25 Oct 2026 to 10 Jan 2027: 12 of them.
    expect(days.length).toBe(12);
    expect(days[0]).toBe('2026-10-25');
    expect(days.at(-1)).toBe('2027-01-10');
    for (let i = 1; i < days.length; i++) expect(addDays(days[i - 1], 7)).toBe(days[i]);
  });
});
