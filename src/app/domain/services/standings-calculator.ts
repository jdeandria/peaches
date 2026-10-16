import { isBye, Matchup } from '../models/season';
import {
  MatchOutcome,
  pointDifferential,
  standing,
  Standing,
  winPercentage,
} from '../models/score';

/**
 * Computes a Season's table from its completed Matchups.
 *
 * Standings are derived, never stored, so they can never drift from the
 * matchup results. Sort order: win percentage, then wins, then point
 * differential, then points for, then id for stability.
 */
export class StandingsCalculator {
  /**
   * `roundIndexOf` orders matchups chronologically so that form and streaks
   * are meaningful; without it, iteration order is used.
   */
  calculate(args: {
    participantIds: Iterable<string>;
    matchups: Iterable<Matchup>;
    roundIndexOf?: ReadonlyMap<string, number>;
  }): Standing[] {
    const indexOf = args.roundIndexOf ?? new Map<string, number>();
    // Array.prototype.sort is stable, so same-round matchups keep their order.
    const ordered = [...args.matchups].sort(
      (a, b) => (indexOf.get(a.roundId) ?? 0) - (indexOf.get(b.roundId) ?? 0),
    );
    const table = new Map<string, Standing>();
    for (const id of args.participantIds) table.set(id, standing(id));
    const row = (id: string): Standing => {
      let s = table.get(id);
      if (!s) table.set(id, (s = standing(id)));
      return s;
    };

    for (const m of ordered) {
      const result = m.result;
      if (result === null || m.status !== 'complete') continue;
      const home = row(m.homePeachId);
      if (isBye(m)) {
        table.set(m.homePeachId, {
          ...home,
          byes: home.byes + 1,
          pointsFor: home.pointsFor + result.homePoints,
        });
        continue;
      }
      const away = row(m.awayPeachId!);
      table.set(m.homePeachId, apply(home, result.homePoints, result.awayPoints));
      table.set(m.awayPeachId!, apply(away, result.awayPoints, result.homePoints));
    }

    return [...table.values()].sort(
      (a, b) =>
        winPercentage(b) - winPercentage(a) ||
        b.wins - a.wins ||
        pointDifferential(b) - pointDifferential(a) ||
        b.pointsFor - a.pointsFor ||
        (a.peachId < b.peachId ? -1 : a.peachId > b.peachId ? 1 : 0),
    );
  }
}

function apply(s: Standing, scored: number, conceded: number): Standing {
  const outcome: MatchOutcome = scored > conceded ? 'win' : scored < conceded ? 'loss' : 'tie';
  return {
    ...s,
    wins: s.wins + (outcome === 'win' ? 1 : 0),
    losses: s.losses + (outcome === 'loss' ? 1 : 0),
    ties: s.ties + (outcome === 'tie' ? 1 : 0),
    pointsFor: s.pointsFor + scored,
    pointsAgainst: s.pointsAgainst + conceded,
    form: [...s.form, outcome],
  };
}
