import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One number in a row of stat tiles. */
export interface StatTile {
  readonly value: string;
  readonly label: string;
}

/**
 * Numbers at a glance, one tile each: "870 kg Weight moved", "9 Sets". The
 * same tiles wherever a workout or a week is summed up, so the numbers
 * always look the same. Tiles flow three to a row on a phone.
 */
@Component({
  selector: 'pch-stat-tiles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'list' },
  template: `@for (t of tiles(); track t.label) {
    <div class="tile" role="listitem">
      <span class="value pch-title-large">{{ t.value }}</span>
      <span class="label pch-label-medium">{{ t.label }}</span>
    </div>
  }`,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
      gap: 8px;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      padding: 12px 16px;
      border-radius: var(--pch-radius-large);
      background: var(--pch-card-elevated);
      box-shadow: var(--pch-shadow-1);
    }
    .value {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-variant-numeric: tabular-nums;
    }
    .label {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class StatTiles {
  readonly tiles = input.required<readonly StatTile[]>();
}
