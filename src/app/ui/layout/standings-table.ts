import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card } from './card';

export type FormOutcome = 'win' | 'loss' | 'tie';

export interface StandingsRow {
  readonly peachId: string;
  readonly name: string;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  /** e.g. `'W3'`; empty when there is none. */
  readonly streak: string;
  readonly onWinningStreak: boolean;
  /** Outcomes oldest → newest; the last five are shown. */
  readonly form: readonly FormOutcome[];
  readonly pointsFor: number;
  readonly pointsAgainst: number;
}

/** Points like `Fmt.points`: an integer when whole, else one decimal. */
export function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const OUTCOME_LABEL: Record<FormOutcome, string> = { win: 'Win', loss: 'Loss', tie: 'Tie' };

/**
 * A compact fantasy-style table: W-L-T, streak, recent form, points for and
 * against (port of `StandingsTable`). Rows are in rank order. Form dots
 * appear when the table is at least 600px wide; narrower tables scroll
 * horizontally if needed. The `highlightPeachId` row (usually "you") uses
 * secondary-container.
 */
@Component({
  selector: 'pch-standings-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card],
  templateUrl: './standings-table.html',
  styleUrl: './standings-table.scss',
})
export class StandingsTable {
  readonly rows = input.required<readonly StandingsRow[]>();
  readonly highlightPeachId = input<string | null>();
  /** Accessible name of the table (default "Standings"). */
  readonly label = input('Standings');

  protected readonly points = formatPoints;

  protected recent(form: readonly FormOutcome[]): readonly FormOutcome[] {
    return form.slice(-5);
  }

  protected formLabel(form: readonly FormOutcome[]): string {
    const recent = this.recent(form);
    return recent.length
      ? `Last ${recent.length}: ${recent.map((o) => OUTCOME_LABEL[o]).join(', ')}`
      : 'No results';
  }
}
