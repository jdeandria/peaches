import { Matchup, matchup } from '../models/season';
import {
  onWinningStreak,
  played,
  pointDifferential,
  standing,
  streak,
  winPercentage,
} from '../models/score';
import { StandingsCalculator } from './standings-calculator';

describe('StandingsCalculator', () => {
  const calc = new StandingsCalculator();

  const done = (id: string, home: string, away: string | null, h: number, a: number): Matchup =>
    matchup({
      id,
      seasonId: 's',
      roundId: 'r',
      homePeachId: home,
      awayPeachId: away,
      status: 'complete',
      result: { homePoints: h, awayPoints: a },
    });

  it('tallies wins, losses, ties and points', () => {
    const rows = calc.calculate({
      participantIds: ['a', 'b', 'c'],
      matchups: [
        done('1', 'a', 'b', 50, 40),
        done('2', 'b', 'c', 30, 30),
        done('3', 'c', 'a', 20, 60),
      ],
    });
    const byId = new Map(rows.map((r) => [r.peachId, r]));
    expect(byId.get('a')!.wins).toBe(2);
    expect(byId.get('a')!.pointsFor).toBe(110);
    expect(byId.get('a')!.pointsAgainst).toBe(60);
    expect(byId.get('b')!.ties).toBe(1);
    expect(byId.get('b')!.losses).toBe(1);
    expect(byId.get('c')!.losses).toBe(1);
    expect(byId.get('c')!.ties).toBe(1);
    expect(rows[0].peachId).toBe('a');
  });

  it('ties count as half a win and point differential breaks ties', () => {
    const rows = calc.calculate({
      participantIds: ['a', 'b', 'c', 'd'],
      matchups: [
        done('1', 'a', 'b', 50, 20), // a win, b loss
        done('2', 'c', 'd', 40, 10), // c win, d loss
      ],
    });
    // a and c both 1-0; c has +30 diff, a has +30 diff; a has more points for.
    expect(rows.slice(0, 2).map((r) => r.peachId)).toEqual(['a', 'c']);
    expect(rows.at(-1)!.peachId).toBe('d');
    expect(winPercentage(rows[0])).toBe(1);
  });

  it('a tie is worth half a win in the table', () => {
    const s = standing('x', { wins: 1, ties: 2, losses: 1 });
    expect(played(s)).toBe(4);
    expect(winPercentage(s)).toBe(0.5);
    expect(winPercentage(standing('y'))).toBe(0);
  });

  it('applies every tiebreaker in order', () => {
    const rows = calc.calculate({
      participantIds: ['e', 'd', 'c', 'b', 'a'],
      matchups: [],
    });
    // No results: everything equal, so id order decides.
    expect(rows.map((r) => r.peachId)).toEqual(['a', 'b', 'c', 'd', 'e']);

    // Same win% (1.0) but more wins ranks first.
    const r2 = calc.calculate({
      participantIds: ['x', 'y', 'p', 'q', 'r'],
      matchups: [
        done('1', 'x', 'p', 10, 0),
        done('2', 'x', 'q', 10, 0),
        done('3', 'y', 'r', 100, 0),
      ],
    });
    expect(r2[0].peachId).toBe('x');
    expect(r2[1].peachId).toBe('y');
  });

  it('byes add points-for and a bye count but no result', () => {
    const rows = calc.calculate({
      participantIds: ['a', 'b'],
      matchups: [done('1', 'a', null, 25, 0)],
    });
    const a = rows.find((r) => r.peachId === 'a')!;
    expect(a.byes).toBe(1);
    expect(played(a)).toBe(0);
    expect(a.pointsFor).toBe(25);
    expect(a.form).toEqual([]);
  });

  it('ignores unfinished matchups and includes every participant', () => {
    const rows = calc.calculate({
      participantIds: ['a', 'b', 'c'],
      matchups: [
        matchup({ id: 'x', seasonId: 's', roundId: 'r', homePeachId: 'a', awayPeachId: 'b' }),
      ],
    });
    expect(rows.length).toBe(3);
    expect(rows.every((r) => played(r) === 0)).toBe(true);
    expect(rows.map((r) => r.peachId)).toEqual(['a', 'b', 'c']);
  });

  it('ignores results on matchups that are not complete', () => {
    const inProgress = { ...done('1', 'a', 'b', 50, 0), status: 'inProgress' as const };
    const rows = calc.calculate({ participantIds: ['a', 'b'], matchups: [inProgress] });
    expect(rows.every((r) => played(r) === 0 && r.pointsFor === 0)).toBe(true);
  });

  it('tracks chronological form and streaks', () => {
    const rows = calc.calculate({
      participantIds: ['a', 'b'],
      matchups: [
        done('3', 'a', 'b', 10, 0),
        done('1', 'a', 'b', 0, 5),
        done('2', 'b', 'a', 1, 9),
        done('bye', 'a', null, 3, 0),
      ].map((m) => ({ ...m, roundId: `r${m.id}` })),
      roundIndexOf: new Map([
        ['r1', 0],
        ['r2', 1],
        ['r3', 2],
        ['rbye', 3],
      ]),
    });
    const a = rows.find((r) => r.peachId === 'a')!;
    const b = rows.find((r) => r.peachId === 'b')!;
    expect(a.form).toEqual(['loss', 'win', 'win']);
    expect(streak(a)).toBe('W2');
    expect(onWinningStreak(a)).toBe(true);
    expect(streak(b)).toBe('L2');
    expect(onWinningStreak(b)).toBe(false);
    expect(streak(standing('x'))).toBe('');
    expect(streak(standing('x', { form: ['win', 'tie'] }))).toBe('T1');
  });

  it('keeps input order for matchups in the same round', () => {
    const rows = calc.calculate({
      participantIds: ['a', 'b'],
      matchups: [done('1', 'a', 'b', 1, 0), done('2', 'a', 'b', 0, 1), done('3', 'a', 'b', 0, 1)],
    });
    expect(rows.find((r) => r.peachId === 'a')!.form).toEqual(['win', 'loss', 'loss']);
  });

  it('includes peaches found only in matchups', () => {
    const rows = calc.calculate({ participantIds: [], matchups: [done('1', 'x', 'y', 1, 2)] });
    expect(rows.map((r) => r.peachId)).toEqual(['y', 'x']);
  });

  it('accumulates fractional points and differential', () => {
    const rows = calc.calculate({
      participantIds: ['a', 'b'],
      matchups: [done('1', 'a', 'b', 10.25, 5.5), done('2', 'b', 'a', 7.75, 7.75)],
    });
    const a = rows.find((r) => r.peachId === 'a')!;
    expect(a.pointsFor).toBe(18);
    expect(a.pointsAgainst).toBe(13.25);
    expect(pointDifferential(a)).toBe(4.75);
    expect(a.ties).toBe(1);
  });
});
