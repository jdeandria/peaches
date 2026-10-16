/** Points earned on one scored workout item. */
export interface ItemScore {
  readonly workoutItemId: string;
  /** Achieved volume divided by prescribed volume, after capping. */
  readonly achievementRatio: number;
  readonly points: number;
}

/** The full breakdown of a Peach's score for one workout. */
export interface WorkoutScore {
  readonly items: readonly ItemScore[];
  readonly completionBonus: number;
}

export const ZERO_SCORE: WorkoutScore = Object.freeze({ items: [], completionBonus: 0 });

export function itemPoints(s: WorkoutScore): number {
  return s.items.reduce((sum, i) => sum + i.points, 0);
}

export function scoreTotal(s: WorkoutScore): number {
  return itemPoints(s) + s.completionBonus;
}

/** The outcome of one played matchup from one Peach's point of view. */
export type MatchOutcome = 'win' | 'loss' | 'tie';

/** A row in a Season's standings table. */
export interface Standing {
  readonly peachId: string;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly byes: number;
  /** Played outcomes in chronological order (byes excluded). */
  readonly form: readonly MatchOutcome[];
}

export function standing(peachId: string, init: Partial<Standing> = {}): Standing {
  return {
    peachId,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    byes: 0,
    form: [],
    ...init,
  };
}

export function played(s: Standing): number {
  return s.wins + s.losses + s.ties;
}

/** Win percentage with ties counted as half a win (NFL convention). */
export function winPercentage(s: Standing): number {
  const n = played(s);
  return n === 0 ? 0 : (s.wins + s.ties / 2) / n;
}

export function pointDifferential(s: Standing): number {
  return s.pointsFor - s.pointsAgainst;
}

/**
 * The current run of identical outcomes, e.g. "W3" or "L1"; empty before
 * the first played matchup.
 */
export function streak(s: Standing): string {
  const last = s.form.at(-1);
  if (last === undefined) return '';
  let n = 0;
  for (let i = s.form.length - 1; i >= 0 && s.form[i] === last; i--) n++;
  const letter = last === 'win' ? 'W' : last === 'loss' ? 'L' : 'T';
  return `${letter}${n}`;
}

/** Whether the streak is a winning one (for emphasis in the table). */
export function onWinningStreak(s: Standing): boolean {
  return s.form.at(-1) === 'win';
}
