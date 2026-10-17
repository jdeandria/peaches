import { SequentialIdGenerator } from '../core/ids';
import { localDate, weekday } from '../core/local-date';
import { DEFAULT_RULES } from '../models/scoring';
import { isBye, matchupPeachIds, Season } from '../models/season';
import { matchupsIn, RoundRobinScheduler } from './round-robin-scheduler';

function season(peaches: string[], weeks: number): Season {
  return {
    id: 's1',
    crateId: 'c1',
    name: 'test',
    startWeek: localDate(2026, 11, 2), // a Monday
    weeks,
    participantIds: peaches,
    rules: DEFAULT_RULES,
    status: 'draft',
    createdAt: new Date(Date.UTC(2026, 0, 1)),
  };
}

const scheduler = () => new RoundRobinScheduler(new SequentialIdGenerator('s'));
const pairKey = (a: string, b: string) => [a, b].sort().join('-');

describe('RoundRobinScheduler', () => {
  it('creates one round per week, each starting on a Monday', () => {
    const s = scheduler().schedule(season(['a', 'b', 'c', 'd'], 5));
    expect(s.rounds.length).toBe(5);
    s.rounds.forEach((r, i) => {
      expect(r.index).toBe(i);
      expect(r.status).toBe('scheduled');
      expect(r.seasonId).toBe('s1');
      expect(weekday(r.weekStart)).toBe(1);
    });
    expect(s.rounds.map((r) => r.weekStart)).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ]);
  });

  it('every participant appears exactly once per round (even count)', () => {
    const peaches = ['a', 'b', 'c', 'd', 'e', 'f'];
    const s = scheduler().schedule(season(peaches, 5));
    for (const round of s.rounds) {
      const ids = matchupsIn(s, round).flatMap(matchupPeachIds);
      expect(new Set(ids), `round ${round.index}`).toEqual(new Set(peaches));
      expect(ids.length).toBe(peaches.length);
      expect(matchupsIn(s, round).some(isBye)).toBe(false);
    }
  });

  it('odd participant counts give exactly one bye per round', () => {
    const peaches = ['a', 'b', 'c', 'd', 'e'];
    const s = scheduler().schedule(season(peaches, 5));
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
    const s = scheduler().schedule(season(peaches, cycle));
    const pairs = s.matchups.map((m) => pairKey(m.homePeachId, m.awayPeachId!));
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs.length).toBe((peaches.length * cycle) / 2);
  });

  it('each pair meets exactly once per cycle with an odd count', () => {
    const peaches = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const s = scheduler().schedule(season(peaches, 7));
    const pairs = s.matchups
      .filter((m) => !isBye(m))
      .map((m) => pairKey(m.homePeachId, m.awayPeachId!));
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs.length).toBe((7 * 6) / 2);
  });

  it('schedule repeats with home and away swapped on the second cycle', () => {
    const s = scheduler().schedule(season(['a', 'b', 'c', 'd'], 6));
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
    const s = scheduler().schedule(season(['a', 'b', 'c'], 9));
    for (const m of s.matchups) {
      expect(m.homePeachId).toBeTruthy();
      if (isBye(m)) expect(m.awayPeachId).toBeNull();
    }
    expect(s.matchups.filter(isBye).length).toBe(9);
  });

  it('is deterministic', () => {
    const a = scheduler().schedule(season(['a', 'b', 'c'], 4));
    const b = scheduler().schedule(season(['a', 'b', 'c'], 4));
    expect(a.matchups).toEqual(b.matchups);
    expect(a.rounds).toEqual(b.rounds);
  });

  it('every id is unique and matchups reference their round', () => {
    const s = scheduler().schedule(season(['a', 'b', 'c', 'd', 'e'], 6));
    const ids = [...s.rounds.map((r) => r.id), ...s.matchups.map((m) => m.id)];
    expect(new Set(ids).size).toBe(ids.length);
    const roundIds = new Set(s.rounds.map((r) => r.id));
    for (const m of s.matchups) {
      expect(roundIds.has(m.roundId)).toBe(true);
      expect(m.seasonId).toBe('s1');
      expect(m.status).toBe('scheduled');
      expect(m.result).toBeNull();
    }
  });

  it('a single participant gets a bye every round', () => {
    const s = scheduler().schedule(season(['solo'], 3));
    expect(s.rounds.length).toBe(3);
    expect(s.matchups.length).toBe(3);
    expect(s.matchups.every((m) => isBye(m) && m.homePeachId === 'solo')).toBe(true);
  });

  it('no participants gives rounds with no matchups', () => {
    const s = scheduler().schedule(season([], 3));
    expect(s.rounds.length).toBe(3);
    expect(s.matchups).toEqual([]);
  });

  it('two participants play each other every round', () => {
    const s = scheduler().schedule(season(['a', 'b'], 4));
    expect(s.matchups.length).toBe(4);
    for (const m of s.matchups)
      expect(new Set([m.homePeachId, m.awayPeachId])).toEqual(new Set(['a', 'b']));
    expect(new Set(s.matchups.map((m) => m.homePeachId))).toEqual(new Set(['a', 'b']));
  });
});
