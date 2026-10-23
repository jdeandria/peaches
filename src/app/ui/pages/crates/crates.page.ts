import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';

import { Crate } from '../../../domain/models/crate';
import { isSeasonOpen } from '../../../domain/models/season';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { EmptyState } from '../../layout/empty-state';
import { Page } from '../../layout/page';
import { createCrate, joinCrate, lastCrate } from './crate-switcher';

/**
 * The Crates tab. Without Crates, a way to create or join one; with them,
 * it opens one Crate's stats: the one last opened, else the first with a
 * Season under way, then one about to start, else the first.
 */
@Component({
  selector: 'pch-crates-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Page, EmptyState, LoadingIndicator, MatButton],
  template: `<pch-page title="Crates" [subtitle]="subtitle()" [maxWidth]="640">
    @let list = crates();
    @if (list === undefined || list.length > 0) {
      <pch-loading-indicator class="loading" [size]="40" />
    } @else {
      <pch-empty-state
        icon="inventory_2"
        title="No Crates yet"
        message="A Crate is a group that competes every week. Create one or join one with an invite code."
      />
      <div class="actions">
        <button matButton="filled" type="button" (click)="create()">
          <span class="material-symbols-rounded" aria-hidden="true">add</span>
          Create a Crate
        </button>
        <button matButton="tonal" type="button" (click)="join()">
          <span class="material-symbols-rounded" aria-hidden="true">key</span>
          Join with a code
        </button>
      </div>
    }
  </pch-page>`,
  styles: `
    .loading {
      display: flex;
      margin: 48px auto;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
    }
    .actions .material-symbols-rounded {
      margin-inline-end: 8px;
      font-size: 20px;
    }
  `,
})
export class CratesPage {
  private readonly state = inject(AppState);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly crates = computed(() => this.state.myCrates.value());

  protected readonly subtitle = computed(() =>
    this.crates()?.length === 0 ? 'Train together, compete together.' : undefined,
  );

  /** Which Crate to open, once my Crates are known. */
  private readonly target = this.state.query(
    () => {
      const list = this.crates();
      return list && list.length > 0 ? list : undefined;
    },
    async (list: Crate[], app) => {
      const last = lastCrate();
      if (last && list.some((c) => c.id === last)) return last;
      const seasons = await Promise.all(list.map((c) => app.seasons.forCrate(c.id)));
      const active = list.find((_, i) => seasons[i].some((s) => s.status === 'active'));
      const open = list.find((_, i) => seasons[i].some(isSeasonOpen));
      return (active ?? open ?? list[0]).id;
    },
  );

  constructor() {
    effect(() => {
      const id = this.target.value();
      if (id) void this.router.navigate(['/crates', id], { replaceUrl: true });
    });
  }

  protected create(): void {
    createCrate(this.dialog);
  }

  protected join(): void {
    joinCrate(this.dialog);
  }
}
