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
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';

import { BOT_NAME_MAX, BotLevel, BotStyle, nextBotName } from '../../../domain/models/bot';
import { Crate } from '../../../domain/models/crate';
import { AppState } from '../../../state/app-state';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';
import { Fmt } from '../../format';

const LEVELS: readonly ButtonGroupOption<BotLevel>[] = (['easy', 'steady', 'strong'] as const).map(
  (value) => ({ value, label: Fmt.botLevel(value) }),
);

const STYLES: readonly ButtonGroupOption<BotStyle>[] = (
  ['allRounder', 'lifter', 'runner'] as const
).map((value) => ({ value, label: Fmt.botStyle(value) }));

/** What each level means, under the choice. */
const LEVEL_NOTES: Record<BotLevel, string> = {
  easy: 'Two or three light workouts a week, and skips some.',
  steady: 'Three or four workouts a week; usually does them.',
  strong: 'Four to six big workouts a week, and rarely misses one.',
};

const STYLE_NOTES: Record<BotStyle, string> = {
  allRounder: 'A bit of everything: weights, bodyweight, core and runs.',
  lifter: 'Mostly weights, so it scores on weight moved and reps.',
  runner: 'Mostly runs, longer than most, with some bodyweight and core.',
};

/** What the dialog is opened with. */
export interface AddBotData {
  readonly crate: Crate;
  /** Whether a Season is under way (the bot waits for the next one). */
  readonly seasonOpen: boolean;
}

/**
 * "Add a bot": a computer-played crate-mate for a Crate short of Peaches.
 * A name (the next free one to start with), how hard it trains and what it
 * likes doing.
 */
@Component({
  selector: 'pch-add-bot-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonGroup,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatHint,
    MatInput,
    MatLabel,
  ],
  template: `<h2 mat-dialog-title>Add a bot</h2>
    <form (submit)="$event.preventDefault(); add()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input
            matInput
            autocomplete="off"
            autocapitalize="words"
            enterkeyhint="done"
            [attr.maxlength]="nameMax"
            [value]="name()"
            (input)="name.set(inputValue($event))"
          />
          @if (error()) {
            <mat-hint class="error" role="alert">{{ error() }}</mat-hint>
          }
        </mat-form-field>
        <p class="pch-body-large label" id="bot-level-label">Trains</p>
        <pch-button-group
          aria-labelledby="bot-level-label"
          [options]="levels"
          [(selected)]="level"
        />
        <p class="pch-body-medium muted">{{ levelNote() }}</p>
        <p class="pch-body-large label likes" id="bot-style-label">Likes</p>
        <pch-button-group
          aria-labelledby="bot-style-label"
          [options]="styles"
          [(selected)]="style"
        />
        <p class="pch-body-medium muted">{{ styleNote() }}</p>
        <p class="pch-body-medium hint">
          A bot plans its week and works through it like a crate-mate: its plan is what it commits
          to, and its workouts show in Activity as it does them.
          {{
            data.seasonOpen
              ? 'It plays from the next Season.'
              : 'It plays in the next Season you start.'
          }}
        </p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="busy()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="busy()">Add</button>
      </mat-dialog-actions>
    </form>`,
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
      margin: 8px 0;
    }
    .likes {
      margin-top: 16px;
    }
    .muted,
    .hint {
      margin: 8px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .hint {
      margin-top: 16px;
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
})
export class AddBotDialog {
  private readonly state = inject(AppState);
  private readonly ref = inject(MatDialogRef<AddBotDialog>);
  protected readonly data = inject<AddBotData>(MAT_DIALOG_DATA);

  protected readonly levels = LEVELS;
  protected readonly styles = STYLES;
  protected readonly nameMax = BOT_NAME_MAX;

  readonly name = signal(nextBotName(this.data.crate));
  readonly level = signal<BotLevel | null>('steady');
  readonly style = signal<BotStyle | null>('allRounder');
  readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly levelNote = computed(() => LEVEL_NOTES[this.level() ?? 'steady']);
  protected readonly styleNote = computed(() => STYLE_NOTES[this.style() ?? 'allRounder']);

  protected inputValue(event: Event): string {
    this.error.set(null);
    return (event.target as HTMLInputElement).value;
  }

  async add(): Promise<void> {
    const me = this.state.peachId();
    if (!me || this.busy()) return;
    this.busy.set(true);
    const bot = await this.state.run(
      (app) =>
        app.crateService.addBot({
          crateId: this.data.crate.id,
          peachId: me,
          name: this.name(),
          level: this.level() ?? 'steady',
          style: this.style() ?? 'allRounder',
          now: this.state.now(),
        }),
      undefined,
      (message) => this.error.set(message),
    );
    this.busy.set(false);
    if (!bot) return;
    this.state.toast(`${bot.name} joined the Crate.`);
    this.ref.close(bot);
  }
}
