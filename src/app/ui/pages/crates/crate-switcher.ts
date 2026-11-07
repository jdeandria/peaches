import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { Crate } from '../../../domain/models/crate';

import { AppState } from '../../../state/app-state';
import { CrateAction, CrateActionsSheet, CrateSheetData } from './crate-actions-sheet';
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

/**
 * The Crates sheet: every Crate I'm in (the one on screen ticked), then
 * create or join another. Opening a Crate or a dialog waits for the sheet
 * to go.
 */
export function pickCrate(
  sheet: MatBottomSheet,
  dialog: MatDialog,
  router: Router,
  crates: readonly Crate[],
  current: string | null,
): void {
  sheet
    .open<CrateActionsSheet, CrateSheetData, CrateAction>(CrateActionsSheet, {
      ariaLabel: 'Your Crates',
      data: { crates, current },
    })
    .afterDismissed()
    .subscribe((action) => {
      if (action === 'create') createCrate(dialog);
      else if (action === 'join') joinCrate(dialog);
      else if (action && action !== current) void router.navigate(['/crates', action]);
    });
}

/**
 * The Crate's name as the page headline, and the way to another Crate:
 * tap it for the Crates sheet. One control in the place every tab keeps
 * its title, rather than a row of chips under it.
 */
@Component({
  selector: 'pch-crate-title',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1 class="pch-headline-medium">
    <button type="button" class="title" aria-haspopup="dialog" (click)="open()">
      <span class="name">{{ name() }}</span>
      <span class="material-symbols-rounded" aria-hidden="true">expand_more</span>
      <span class="pch-visually-hidden">, switch Crate</span>
    </button>
  </h1>`,
  styles: `
    h1 {
      margin: 0;
    }
    .title {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      margin: -4px -8px;
      padding: 4px 8px;
      border: 0;
      border-radius: var(--pch-radius-medium);
      background: none;
      color: inherit;
      font: inherit;
      letter-spacing: inherit;
      text-align: start;
      cursor: pointer;
    }
    .title:hover {
      background: color-mix(in srgb, var(--mat-sys-on-surface) 8%, transparent);
    }
    .title:focus-visible {
      outline: var(--pch-focus-ring);
    }
    .name {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .material-symbols-rounded {
      flex: none;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class CrateTitle {
  private readonly state = inject(AppState);
  private readonly sheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  /** The Crate on screen. */
  readonly current = input.required<string>();
  readonly name = input.required<string>();

  protected open(): void {
    pickCrate(
      this.sheet,
      this.dialog,
      this.router,
      this.state.myCrates.value() ?? [],
      this.current(),
    );
  }
}
