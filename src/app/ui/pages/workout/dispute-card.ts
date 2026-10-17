import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';

import { DisputeView } from '../../../application/dispute-service';
import { DisputeVote } from '../../../domain/models/dispute';

/**
 * One dispute: what was questioned, by whom, and where the vote stands
 * ("2 of 3 votes to strike"). Members who can vote get Strike and Keep.
 */
@Component({
  selector: 'pch-dispute-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton],
  template: `<div class="dispute" [attr.data-state]="state()">
    @switch (state()) {
      @case ('struck') {
        <span class="material-symbols-rounded icon" aria-hidden="true">block</span>
      }
      @case ('open') {
        <span class="material-symbols-rounded icon" aria-hidden="true">flag</span>
      }
      @default {
        <span class="material-symbols-rounded icon" aria-hidden="true">check_circle</span>
      }
    }
    <div class="text">
      <span class="pch-title-small">{{ title() }}</span>
      <span class="pch-body-small muted">{{ status() }}</span>
    </div>
    @if (canVote() && state() === 'open') {
      <div class="votes" role="group" [attr.aria-label]="'Vote on ' + view().dispute.label">
        <button
          [matButton]="myVote() === 'strike' ? 'filled' : 'outlined'"
          type="button"
          [attr.aria-pressed]="myVote() === 'strike'"
          (click)="vote.emit('strike')"
        >
          Strike
        </button>
        <button
          [matButton]="myVote() === 'keep' ? 'filled' : 'outlined'"
          type="button"
          [attr.aria-pressed]="myVote() === 'keep'"
          (click)="vote.emit('keep')"
        >
          Keep
        </button>
      </div>
    }
  </div>`,
  styles: `
    .dispute {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: var(--pch-radius-large);
      background: var(--mat-sys-surface-container);
    }
    .dispute[data-state='struck'] {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .icon {
      color: var(--mat-sys-tertiary);
    }
    [data-state='struck'] .icon,
    [data-state='struck'] .muted {
      color: inherit;
    }
    .text {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 160px;
    }
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
    .votes {
      display: flex;
      gap: 8px;
    }
  `,
})
export class DisputeCard {
  readonly view = input.required<DisputeView>();
  /** Who raised it. */
  readonly openedBy = input.required<string>();
  /** Whose workout it is, for the title; omit on the owner's own screens. */
  readonly owner = input<string | null>(null);
  /** The Crate it is in, when that isn't obvious from the screen. */
  readonly crateName = input<string | null>(null);
  readonly canVote = input(false);
  readonly myVote = input<DisputeVote | null>(null);
  readonly vote = output<DisputeVote>();

  protected readonly state = computed(() => (this.view().applies ? this.view().outcome : 'fixed'));

  protected readonly title = computed(() => {
    const owner = this.owner();
    const label = this.view().dispute.label;
    return owner ? `${owner} · ${label}` : label;
  });

  protected readonly status = computed(() => {
    const { strike, needed } = this.view();
    const where = this.crateName() ? ` in ${this.crateName()}` : '';
    switch (this.state()) {
      case 'fixed':
        return `Corrected after ${this.openedBy()} disputed it`;
      case 'struck':
        return `Struck by the Crate: doesn’t score${where}`;
      case 'kept':
        return `The Crate kept it${where}`;
      default:
        return `${this.openedBy()} disputed it${where} · ${strike} of ${needed} votes to strike`;
    }
  });
}
