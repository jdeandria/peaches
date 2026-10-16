import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlider, MatSliderThumb } from '@angular/material/slider';

import { deviceTimeZone } from '../../../data/tz/intl-zone-clock';
import { crateSettings } from '../../../domain/models/crate';
import { TRAINING_GOALS, TrainingGoal } from '../../../domain/models/training';
import { AppState } from '../../../state/app-state';
import { Fmt } from '../../format';

/** "New Crate": name, description, goal and workout length. */
@Component({
  selector: 'pch-create-crate-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    MatSlider,
    MatSliderThumb,
  ],
  template: `<h2 mat-dialog-title>New Crate</h2>
    <mat-dialog-content class="fields">
      <mat-form-field appearance="outline">
        <mat-label>Name</mat-label>
        <input
          matInput
          autocomplete="off"
          autocapitalize="words"
          [value]="name()"
          (input)="name.set(inputValue($event))"
        />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Description</mat-label>
        <input
          matInput
          autocomplete="off"
          [value]="description()"
          (input)="description.set(inputValue($event))"
        />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Goal</mat-label>
        <mat-select [value]="goal()" (selectionChange)="goal.set($event.value)">
          @for (g of goals; track g) {
            <mat-option [value]="g">{{ fmt.goal(g) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <p class="pch-body-large slider-label" id="crate-length-label">
        Workout length: {{ minutes() }} min
      </p>
      <mat-slider min="15" max="90" step="5" discrete [displayWith]="minLabel">
        <input
          matSliderThumb
          aria-labelledby="crate-length-label"
          [value]="minutes()"
          (valueChange)="minutes.set($event)"
        />
      </mat-slider>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close [disabled]="busy()">Cancel</button>
      <button matButton="filled" type="button" [disabled]="busy()" (click)="create()">
        Create
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
    .slider-label {
      margin: 0;
    }
    mat-slider {
      margin-inline: 0;
    }
  `,
})
export class CreateCrateDialog {
  private readonly state = inject(AppState);
  private readonly router = inject(Router);
  private readonly ref = inject(MatDialogRef<CreateCrateDialog>);

  protected readonly fmt = Fmt;
  protected readonly goals = TRAINING_GOALS;

  readonly name = signal('');
  readonly description = signal('');
  readonly goal = signal<TrainingGoal>('generalFitness');
  readonly minutes = signal(40);
  readonly busy = signal(false);

  protected readonly minLabel = (v: number) => `${v} min`;

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  async create(): Promise<void> {
    const me = this.state.peachId();
    if (!me || this.busy()) return;
    this.busy.set(true);
    const crate = await this.state.run((app) =>
      app.crateService.createCrate({
        ownerPeachId: me,
        name: this.name(),
        description: this.description(),
        now: this.state.now(),
        timeZone: deviceTimeZone(),
        settings: crateSettings({
          goal: this.goal(),
          workoutDurationMinutes: this.minutes(),
        }),
      }),
    );
    this.busy.set(false);
    if (!crate) return;
    this.ref.close(crate);
    await this.router.navigate(['/crates', crate.id]);
  }
}
