import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatChipListbox, MatChipOption } from '@angular/material/chips';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatSlider, MatSliderThumb } from '@angular/material/slider';

import { Equipment } from '../../../domain/exercises/taxonomy';
import { AppState } from '../../../state/app-state';
import { Fmt } from '../../format';

/** The equipment offered as chips (wall and chair are always included). */
export const QUICK_SETUP_EQUIPMENT: readonly Equipment[] = [
  'dumbbell',
  'kettlebell',
  'barbell',
  'bench',
  'resistanceBand',
  'pullUpBar',
  'box',
  'jumpRope',
  'suspensionTrainer',
  'medicineBall',
  'treadmill',
  'stationaryBike',
  'rowingMachine',
  'cableMachine',
  'weightMachine',
];

/** Marks every exercise you can do with the equipment you own. */
@Component({
  selector: 'pch-quick-setup-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    MatChipListbox,
    MatChipOption,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatSlider,
    MatSliderThumb,
  ],
  template: `<h2 mat-dialog-title>Quick setup</h2>
    <mat-dialog-content>
      <p class="pch-body-medium intro" id="quick-setup-intro">
        Bodyweight exercises are always included. Pick the equipment you have access to.
      </p>
      <mat-chip-listbox multiple aria-labelledby="quick-setup-intro">
        @for (e of choices; track e) {
          <mat-chip-option
            [selected]="equipment().has(e)"
            (selectionChange)="$event.isUserInput && toggle(e, $event.selected)"
            >{{ fmt.equipment(e) }}</mat-chip-option
          >
        }
      </mat-chip-listbox>
      <p class="pch-body-large level" id="quick-setup-level">
        Up to difficulty level {{ maxDifficulty() }}
      </p>
      <mat-slider min="1" max="5" step="1" discrete>
        <input
          matSliderThumb
          aria-labelledby="quick-setup-level"
          [value]="maxDifficulty()"
          (valueChange)="maxDifficulty.set($event)"
        />
      </mat-slider>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close [disabled]="busy()">Cancel</button>
      <button matButton="filled" type="button" [disabled]="busy()" (click)="apply()">Enable</button>
    </mat-dialog-actions>`,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
    }
    .intro {
      margin: 0 0 12px;
    }
    .level {
      margin: 16px 0 0;
    }
    mat-slider {
      margin-inline: 0;
    }
  `,
})
export class QuickSetupDialog {
  private readonly state = inject(AppState);
  private readonly ref = inject(MatDialogRef<QuickSetupDialog>);

  protected readonly fmt = Fmt;
  protected readonly choices = QUICK_SETUP_EQUIPMENT;

  readonly equipment = signal<ReadonlySet<Equipment>>(new Set<Equipment>(['wall', 'chair']));
  readonly maxDifficulty = signal(2);
  readonly busy = signal(false);

  toggle(e: Equipment, on: boolean): void {
    this.equipment.update((current) => {
      const next = new Set(current);
      if (on) next.add(e);
      else next.delete(e);
      return next;
    });
  }

  async apply(): Promise<void> {
    const me = this.state.peachId();
    if (!me || this.busy()) return;
    this.busy.set(true);
    const count = await this.state.run((app) =>
      app.capabilityService.enableForEquipment({
        peachId: me,
        equipment: this.equipment(),
        maxDifficulty: this.maxDifficulty(),
        now: this.state.now(),
      }),
    );
    this.busy.set(false);
    if (count === undefined) return;
    this.ref.close(count);
    this.state.toast(`Enabled ${count} exercises`);
  }
}
