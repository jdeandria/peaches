import { IdGenerator } from '../core/ids';
import { addDays } from '../core/local-date';
import { matchup, Matchup, Round, Season } from '../models/season';

/** The rounds and matchups produced for a Season. */
export interface Schedule {
  readonly rounds: readonly Round[];
  readonly matchups: readonly Matchup[];
}

export function matchupsIn(schedule: Schedule, round: Round): Matchup[] {
  return schedule.matchups.filter((m) => m.roundId === round.id);
}

/**
 * Builds a round-robin schedule over a Season's weeks.
 *
 * Uses the circle method: with `n` participants (padded to even with a bye)
 * there are `n - 1` distinct pairings; those repeat, swapping home and away
 * each cycle, until every week has a Round. Output is deterministic for a
 * given participant order.
 */
export class RoundRobinScheduler {
  constructor(private readonly ids: IdGenerator) {}

  schedule(season: Season): Schedule {
    const players: (string | null)[] = [...season.participantIds];
    if (players.length % 2 === 1) players.push(null);
    const n = players.length;
    const cycleLength = n - 1;

    const rounds: Round[] = [];
    const matchups: Matchup[] = [];

    for (let i = 0; i < season.weeks; i++) {
      const round: Round = {
        id: this.ids.newId(),
        seasonId: season.id,
        index: i,
        weekStart: addDays(season.startWeek, i * 7),
        status: 'scheduled',
      };
      rounds.push(round);
      if (n < 2) continue;

      const step = i % cycleLength;
      const cycle = Math.floor(i / cycleLength);
      const rotated = rotate(players, step);
      for (let k = 0; k < n / 2; k++) {
        let a = rotated[k];
        let b = rotated[n - 1 - k];
        if (a === null && b === null) continue;
        // Alternate home/away each cycle so nobody is always "home"; a bye
        // is always recorded on the home side.
        if (a === null || (b !== null && cycle % 2 === 1)) [a, b] = [b, a];
        matchups.push(
          matchup({
            id: this.ids.newId(),
            seasonId: season.id,
            roundId: round.id,
            homePeachId: a!,
            awayPeachId: b,
          }),
        );
      }
    }
    return { rounds, matchups };
  }
}

/** Circle method: fix index 0, rotate the rest by `step`. */
function rotate<T>(players: readonly T[], step: number): readonly T[] {
  if (players.length < 3) return players;
  const [fixed, ...rest] = players;
  const shift = step % rest.length;
  return [fixed, ...rest.slice(rest.length - shift), ...rest.slice(0, rest.length - shift)];
}
