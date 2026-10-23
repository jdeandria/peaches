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

import { EQUIPMENT, Equipment } from '../../../domain/exercises/taxonomy';
import { EquipmentLocation, LOCATION_NAME_MAX } from '../../../domain/models/peach';

/** What each piece of equipment is called on screen. */
export const EQUIPMENT_LABELS: Readonly<Record<Equipment, string>> = {
  dumbbell: 'Dumbbells',
  barbell: 'Barbell',
  kettlebell: 'Kettlebells',
  resistanceBand: 'Resistance bands',
  pullUpBar: 'Pull-up bar',
  dipStation: 'Dip station',
  bench: 'Bench',
  box: 'Plyo box',
  medicineBall: 'Medicine ball',
  slamBall: 'Slam ball',
  jumpRope: 'Jump rope',
  cableMachine: 'Cable machine',
  weightMachine: 'Weight machines',
  treadmill: 'Treadmill',
  stationaryBike: 'Exercise bike',
  rowingMachine: 'Rowing machine',
  elliptical: 'Elliptical',
  stairClimber: 'Stair climber',
  suspensionTrainer: 'Suspension trainer',
  abWheel: 'Ab wheel',
  foamRoller: 'Foam roller',
  wall: 'Wall',
  chair: 'Chair',
  stairs: 'Stairs',
  pool: 'Pool',
  bicycle: 'Bicycle',
  sled: 'Sled',
  battleRope: 'Battle rope',
  sandbag: 'Sandbag',
  plate: 'Weight plates',
};

/** "Dumbbells, Bench and 2 more", or "Bodyweight only". */
export function equipmentSummary(equipment: readonly Equipment[]): string {
  if (equipment.length === 0) return 'Bodyweight only';
  const names = EQUIPMENT.filter((e) => equipment.includes(e)).map((e) => EQUIPMENT_LABELS[e]);
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/** Starting points when adding a location. */
export const LOCATION_PRESETS: readonly {
  readonly name: string;
  readonly equipment: readonly Equipment[];
}[] = [
  {
    name: 'Home',
    equipment: ['dumbbell', 'bench', 'resistanceBand', 'pullUpBar', 'wall', 'chair'],
  },
  {
    name: 'Gym',
    equipment: [
      'dumbbell',
      'barbell',
      'kettlebell',
      'plate',
      'bench',
      'pullUpBar',
      'dipStation',
      'box',
      'medicineBall',
      'cableMachine',
      'weightMachine',
      'treadmill',
      'stationaryBike',
      'rowingMachine',
      'elliptical',
      'stairClimber',
      'abWheel',
      'foamRoller',
      'wall',
    ],
  },
  { name: 'Travel', equipment: ['resistanceBand', 'jumpRope', 'wall', 'chair'] },
];

export interface LocationDialogData {
  /** The location to edit; null to add one. */
  readonly location: EquipmentLocation | null;
  /** Names already used by other locations. */
  readonly taken: readonly string[];
}

/** The location as named and equipped, without an id for a new one. */
export type LocationDialogResult = Omit<EquipmentLocation, 'id'>;

/**
 * Add or edit a place to train: a name and the equipment there. Adding
 * starts from a preset if you like.
 */
@Component({
  selector: 'pch-location-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  template: `<h2 mat-dialog-title>{{ data.location ? 'Edit location' : 'New location' }}</h2>
    <form (submit)="$event.preventDefault(); save()">
      <mat-dialog-content class="fields">
        @if (!data.location) {
          <div class="presets" role="group" aria-label="Start from">
            @for (p of presets; track p.name) {
              <button matButton="tonal" type="button" (click)="usePreset(p)">{{ p.name }}</button>
            }
          </div>
        }
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input
            matInput
            autocomplete="off"
            autocapitalize="words"
            [attr.maxlength]="maxName"
            [value]="name()"
            (input)="name.set(inputValue($event))"
          />
          @if (problem(); as p) {
            <mat-hint class="problem">{{ p }}</mat-hint>
          }
        </mat-form-field>
        <h3 id="kit-caption" class="pch-label-large caption">
          Equipment here · {{ selected().size }}
        </h3>
        <ul class="kit" aria-labelledby="kit-caption">
          @for (e of all; track e.value) {
            <li>
              <button
                type="button"
                class="chip pch-label-large"
                [class.on]="selected().has(e.value)"
                [attr.aria-pressed]="selected().has(e.value)"
                (click)="toggle(e.value)"
              >
                @if (selected().has(e.value)) {
                  <span class="material-symbols-rounded" aria-hidden="true">check</span>
                }
                {{ e.label }}
              </button>
            </li>
          }
        </ul>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="submit" [disabled]="problem() !== null">Save</button>
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
    .presets {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .problem {
      color: var(--mat-sys-error);
    }
    .caption {
      margin: 8px 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .kit {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 32px;
      padding: 0 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--pch-radius-small, 8px);
      background: transparent;
      color: var(--mat-sys-on-surface-variant);
      cursor: pointer;

      &.on {
        padding-inline-start: 8px;
        border-color: transparent;
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }

      .material-symbols-rounded {
        font-size: 18px;
      }
    }
  `,
})
export class LocationDialog {
  protected readonly data = inject<LocationDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<LocationDialog, LocationDialogResult>);

  protected readonly presets = LOCATION_PRESETS;
  protected readonly maxName = LOCATION_NAME_MAX;
  protected readonly all = EQUIPMENT.map((value) => ({ value, label: EQUIPMENT_LABELS[value] }));

  readonly name = signal(this.data.location?.name ?? '');
  readonly selected = signal<ReadonlySet<Equipment>>(new Set(this.data.location?.equipment ?? []));

  protected readonly problem = computed(() => {
    const name = this.name().trim();
    if (!name) return 'Give it a name.';
    if (name.length > LOCATION_NAME_MAX) return `Keep it to ${LOCATION_NAME_MAX} characters.`;
    const lower = name.toLowerCase();
    if (this.data.taken.some((t) => t.toLowerCase() === lower)) return 'You have one by that name.';
    return null;
  });

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected usePreset(p: (typeof LOCATION_PRESETS)[number]): void {
    if (!this.name().trim()) this.name.set(p.name);
    this.selected.set(new Set(p.equipment));
  }

  protected toggle(e: Equipment): void {
    const next = new Set(this.selected());
    if (next.has(e)) next.delete(e);
    else next.add(e);
    this.selected.set(next);
  }

  save(): void {
    if (this.problem() !== null) return;
    this.ref.close({
      name: this.name().trim().replace(/\s+/g, ' '),
      equipment: EQUIPMENT.filter((e) => this.selected().has(e)),
    });
  }
}
