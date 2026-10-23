import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';

import { AppState } from '../../../state/app-state';
import { CrateAction, CrateActionsSheet } from './crate-actions-sheet';
import { CreateCrateDialog } from './create-crate-dialog';
import { JoinCrateDialog } from './join-crate-dialog';

const LAST_CRATE_KEY = 'pch.lastCrate';

/** Remembers the Crate last opened, so the Crates tab reopens it. */
export function rememberCrate(id: string): void {
  try {
    localStorage.setItem(LAST_CRATE_KEY, id);
  } catch {
    // Storage can be blocked; the tab then opens the first Crate.
  }
}

/** The Crate last opened on this device, if storage allows. */
export function lastCrate(): string | null {
  try {
    return localStorage.getItem(LAST_CRATE_KEY);
  } catch {
    return null;
  }
}

/** Opens the create dialog. */
export function createCrate(dialog: MatDialog): void {
  dialog.open(CreateCrateDialog, { width: '560px', maxWidth: 'calc(100vw - 32px)' });
}

/** Opens the join-by-code dialog. */
export function joinCrate(dialog: MatDialog): void {
  dialog.open(JoinCrateDialog, { width: '400px', maxWidth: 'calc(100vw - 32px)' });
}

/** The "Add a Crate" sheet; the chosen option opens its dialog once the sheet is gone. */
export function addCrate(sheet: MatBottomSheet, dialog: MatDialog): void {
  sheet
    .open<CrateActionsSheet, void, CrateAction>(CrateActionsSheet, { ariaLabel: 'Add a Crate' })
    .afterDismissed()
    .subscribe((action) => {
      if (action === 'create') createCrate(dialog);
      else if (action === 'join') joinCrate(dialog);
    });
}

/**
 * A chip per Crate I'm in, the current one selected, then one to create or
 * join another. One line that scrolls sideways, so it never grows taller.
 */
@Component({
  selector: 'pch-crate-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `<nav class="row" aria-label="Your Crates">
    @for (c of crates(); track c.id) {
      @let on = c.id === current();
      <a
        class="chip"
        [class.selected]="on"
        [routerLink]="['/crates', c.id]"
        [attr.aria-current]="on ? 'page' : null"
      >
        @if (on) {
          <span class="material-symbols-rounded" aria-hidden="true">check</span>
        }
        {{ c.name }}
      </a>
    }
    <button class="chip add" type="button" (click)="add()">
      <span class="material-symbols-rounded" aria-hidden="true">add</span>
      Add Crate
    </button>
  </nav>`,
  styles: `
    :host {
      display: block;
      // Bleed to the page edges so chips scroll under the gutter.
      margin: 0 -16px;
    }
    .row {
      display: flex;
      gap: 8px;
      padding: 8px 16px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .row::-webkit-scrollbar {
      display: none;
    }
    .chip {
      position: relative;
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 32px;
      padding: 0 16px;
      box-sizing: border-box;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--pch-radius-small);
      background: none;
      color: var(--mat-sys-on-surface-variant);
      text-decoration: none;
      white-space: nowrap;
      font: var(--mat-sys-label-large);
      letter-spacing: var(--mat-sys-label-large-tracking);
      cursor: pointer;
    }
    .chip .material-symbols-rounded {
      margin-inline-start: -8px;
      font-size: 18px;
    }
    .chip.selected {
      border-color: transparent;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .chip.add .material-symbols-rounded {
      color: var(--mat-sys-primary);
    }
    // 48px touch target around the 32px chip.
    .chip::before {
      content: '';
      position: absolute;
      inset: -8px 0;
    }
    .chip::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: var(--mat-sys-on-surface);
      opacity: 0;
      transition: opacity 150ms linear;
    }
    .chip:hover::after {
      opacity: var(--mat-sys-hover-state-layer-opacity);
    }
    .chip:active::after {
      opacity: var(--mat-sys-pressed-state-layer-opacity);
    }
  `,
})
export class CrateSwitcher {
  private readonly state = inject(AppState);
  private readonly sheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);

  /** The Crate on screen. */
  readonly current = input.required<string>();

  protected readonly crates = computed(() => this.state.myCrates.value() ?? []);

  protected add(): void {
    addCrate(this.sheet, this.dialog);
  }
}
