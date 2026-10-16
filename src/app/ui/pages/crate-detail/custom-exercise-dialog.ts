import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
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
import { MatOption, MatSelect } from '@angular/material/select';

import { LogTrack } from '../../../domain/exercises/loggable';
import { CustomExercise } from '../../../domain/models/library';
import { DistanceKind } from '../../../domain/models/scoring';
import { AppState } from '../../../state/app-state';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';
import { Fmt } from '../../format';

const TRACK_OPTIONS: readonly ButtonGroupOption<LogTrack>[] = [
  { value: 'reps', label: 'Reps' },
  { value: 'time', label: 'Time' },
  { value: 'distance', label: 'Distance' },
];

/** Distance kinds, plus "doesn't score distance" for things like carries. */
const DISTANCE_OPTIONS: readonly { value: DistanceKind | 'none'; label: string }[] = [
  { value: 'runWalk', label: Fmt.category('runWalk') },
  { value: 'ride', label: Fmt.category('ride') },
  { value: 'swimRow', label: Fmt.category('swimRow') },
  { value: 'none', label: 'Something else (scores reps, weight and time)' },
];

/**
 * Makes up an exercise for the Crate's library. How it is logged decides
 * how it scores, so that is all it asks besides a name.
 */
@Component({
  selector: 'pch-custom-exercise-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonGroup,
    MatButton,
    MatCheckbox,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
  ],
  template: `<h2 mat-dialog-title>New exercise</h2>
    <form (submit)="$event.preventDefault(); create()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input
            matInput
            autocomplete="off"
            maxlength="60"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
          />
        </mat-form-field>
        <p class="pch-body-large label" id="track-label">Logged as</p>
        <pch-button-group aria-labelledby="track-label" [options]="tracks" [(selected)]="track" />
        @if (track() === 'reps') {
          <mat-checkbox [checked]="takesLoad()" (change)="takesLoad.set($event.checked)"
            >Record a weight for each set</mat-checkbox
          >
        }
        @if (track() === 'distance') {
          <mat-form-field appearance="outline" class="kind">
            <mat-label>Distance counts as</mat-label>
            <mat-select [value]="distanceKind()" (selectionChange)="distanceKind.set($event.value)">
              @for (k of distanceOptions; track k.value) {
                <mat-option [value]="k.value">{{ k.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
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
      gap: 8px;
    }
    .fields.mat-mdc-dialog-content {
      padding-top: 8px;
    }
    .label {
      margin: 0;
    }
    .kind {
      margin-top: 12px;
    }
  `,
})
export class CustomExerciseDialog {
  private readonly state = inject(AppState);
  private readonly ref = inject<MatDialogRef<CustomExerciseDialog, CustomExercise>>(MatDialogRef);
  private readonly crateId = inject<string>(MAT_DIALOG_DATA);

  protected readonly tracks = TRACK_OPTIONS;
  protected readonly distanceOptions = DISTANCE_OPTIONS;

  readonly name = signal('');
  readonly track = signal<LogTrack | null>('reps');
  readonly takesLoad = signal(false);
  readonly distanceKind = signal<DistanceKind | 'none'>('runWalk');
  readonly busy = signal(false);

  async create(): Promise<void> {
    const me = this.state.peachId();
    if (!me || this.busy()) return;
    this.busy.set(true);
    const kind = this.distanceKind();
    const exercise = await this.state.run(
      (app) =>
        app.libraryService.createCustomExercise({
          crateId: this.crateId,
          peachId: me,
          name: this.name(),
          track: this.track() ?? 'reps',
          takesLoad: this.takesLoad(),
          distanceKind: kind === 'none' ? null : kind,
          now: this.state.now(),
        }),
      'Added to the library.',
    );
    this.busy.set(false);
    if (exercise) this.ref.close(exercise);
  }
}
