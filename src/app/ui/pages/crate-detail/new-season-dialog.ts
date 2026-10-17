import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSlider, MatSliderThumb } from '@angular/material/slider';

import { addDays, LocalDate, startOfWeek } from '../../../domain/core/local-date';
import { Crate } from '../../../domain/models/crate';
import { SCORING_CATEGORIES } from '../../../domain/models/scoring';
import { MAX_SEASON_WEEKS } from '../../../domain/models/season';
import { AppState } from '../../../state/app-state';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';
import { Fmt } from '../../format';

/**
 * The Mondays a Season can start on: this week's and next week's. Labels
 * stay short to fit side by side on a phone; the dialog spells out the dates.
 */
export function startWeekOptions(today: LocalDate): ButtonGroupOption<LocalDate>[] {
  const thisWeek = startOfWeek(today);
  return [
    { value: thisWeek, label: 'This week' },
    { value: addDays(thisWeek, 7), label: 'Next week' },
  ];
}

/**
 * Starts a Season: a name, which Monday it starts and how many weeks it
 * runs. Scoring uses the Crate's rules as voted now, frozen for the Season.
 */
@Component({
  selector: 'pch-new-season-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonGroup,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatInput,
    MatLabel,
    MatSlider,
    MatSliderThumb,
  ],
  template: `<h2 mat-dialog-title>New Season</h2>
    <mat-dialog-content class="fields">
      <mat-form-field appearance="outline">
        <mat-label>Name</mat-label>
        <input matInput autocomplete="off" [value]="name()" (input)="onName($event)" />
      </mat-form-field>
      <p class="pch-body-large label" id="season-start-label">Starts</p>
      <pch-button-group
        aria-labelledby="season-start-label"
        [options]="startOptions"
        [(selected)]="startWeek"
      />
      <p class="pch-body-large label length" id="season-length-label">
        Length: {{ weeks() }} {{ weeks() === 1 ? 'week' : 'weeks' }}
      </p>
      <p class="pch-body-medium muted dates">{{ dates() }}</p>
      <mat-slider min="1" [max]="maxWeeks" step="1" discrete>
        <input
          matSliderThumb
          aria-labelledby="season-length-label"
          [value]="weeks()"
          (valueChange)="weeks.set($event)"
        />
      </mat-slider>
      @if (alone()) {
        <p class="pch-body-medium alone" role="note">
          You’re the only Peach here, so every week would be a bye. Share invite code
          {{ crate.inviteCode }} first: who plays is fixed when the Season is scheduled.
        </p>
      }
      <p class="pch-body-medium muted">
        One matchup a week; everything you log counts. From the Crate’s vote, frozen for the Season:
        {{ rulesLine() }}.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close [disabled]="busy()">Cancel</button>
      <button
        matButton="filled"
        type="button"
        [disabled]="busy() || !startWeek()"
        (click)="start()"
      >
        Start
      </button>
    </mat-dialog-actions>`,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
    }
    /* Room for the first outlined field's floating label. */
    .fields.mat-mdc-dialog-content {
      padding-top: 8px;
    }
    .label {
      margin: 0 0 8px;
    }
    .length {
      margin-top: 16px;
    }
    mat-slider {
      margin-inline: 0;
    }
    .muted {
      margin: 8px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .dates {
      margin: 0;
    }
    .alone {
      margin: 8px 0 0;
      padding: 12px 16px;
      border-radius: var(--pch-radius-medium);
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
  `,
})
export class NewSeasonDialog {
  private readonly state = inject(AppState);
  private readonly ref = inject(MatDialogRef<NewSeasonDialog>);
  protected readonly crate = inject<Crate>(MAT_DIALOG_DATA);

  protected readonly startOptions = startWeekOptions(this.state.today());
  protected readonly maxWeeks = MAX_SEASON_WEEKS;

  readonly name = signal('New Season');
  readonly startWeek = signal<LocalDate | null>(this.startOptions[1].value);
  readonly weeks = signal(6);
  readonly busy = signal(false);

  private readonly rules = this.state.query(
    () => this.crate.id,
    (id, app) => app.votingService.currentRules(id),
  ).value;

  /** Whether nobody else would play: a Season of byes (participants freeze when scheduled). */
  protected readonly alone = computed(() => this.memberCount() === 1);
  private readonly memberCount = this.state.query(
    () => this.crate.id,
    async (id, app) => (await app.crateService.activeMembers(id)).length,
  ).value;

  /** "Mon, Oct 19 – Sun, Nov 29": the days the Season will run. */
  protected readonly dates = computed(() => {
    const start = this.startWeek();
    if (!start) return '';
    return `${Fmt.day(start)} – ${Fmt.day(addDays(start, this.weeks() * 7 - 1))}`;
  });

  protected readonly rulesLine = computed(() => {
    const r = this.rules();
    if (!r) return '…';
    const w = r.weights;
    const weights = SCORING_CATEGORIES.filter((c) => w[c] > 0)
      .sort((a, b) => w[b] - w[a])
      .map((c) => `${Fmt.category(c)} ${w[c]}`)
      .join(', ');
    const { slots, pledgeBonus, battlePars } = r.lineup;
    const lineups =
      slots === 0
        ? 'no lineups'
        : `lineups of ${slots} with +${pledgeBonus}% pledges and ${Fmt.count(battlePars, 'par')} per battle`;
    return `${weights}; ${lineups}`;
  });

  protected onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  async start(): Promise<void> {
    const startWeek = this.startWeek();
    if (this.busy() || !startWeek) return;
    this.busy.set(true);
    const season = await this.state.run((app) =>
      app.seasonService.createSeason({
        crate: this.crate,
        name: this.name(),
        startWeek,
        weeks: this.weeks(),
        now: this.state.now(),
      }),
    );
    // Open this week's round straight away when starting mid-week.
    if (season) await this.state.syncSeasons();
    this.busy.set(false);
    if (season) this.ref.close(season);
  }
}
