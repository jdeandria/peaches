import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { ReducedMotion } from '../core/motion';

/** Horizontal travel before a press counts as a swipe rather than a tap or a scroll. */
const SLOP_PX = 10;
/** Share of the row's width a swipe must cover to act on release. */
const COMMIT_SHARE = 0.35;
/** A flick this fast (px/ms) acts sooner, from this far. */
const FLICK_SPEED = 0.6;
const FLICK_PX = 48;

/**
 * `cdkDragStartDelay` for rows that also drag into another order: on a
 * touch screen a row is held still first, so a swipe still swipes and a
 * scroll still scrolls; a mouse drags at once.
 */
export const HOLD_TO_DRAG = { touch: 300, mouse: 0 };

/**
 * Call before moving a row from the keyboard: moving it in the page takes
 * focus off the button in it, so this puts focus back once it's drawn.
 */
export function keepFocus(injector: Injector): void {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  afterNextRender(
    () => {
      if (active.isConnected && document.activeElement !== active) active.focus();
    },
    { injector },
  );
}

/**
 * A list row that swipes: right to edit, left to remove (each only when
 * enabled). The row follows the finger over a tinted layer that names the
 * action; past the line it commits on release (a quick flick does too),
 * otherwise it springs back. Removing slides the row away before `remove`
 * fires, so pair it with an Undo. Vertical drags still scroll the page.
 *
 * Swiping is for touch and pens (a mouse drag still selects text); keep a
 * button for each action in the row for mice, keyboards and screen readers
 * (rows can hide them on touch screens until focused, with
 * `.pch-swipe-actions`).
 *
 * A row can also be `cdkDrag` in a `cdkDropList`, to put the list in
 * another order (with {@link HOLD_TO_DRAG}): once it's picked up it stops
 * swiping, and it lifts off the list while it moves.
 */
@Component({
  selector: 'pch-swipe-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.dragging]': 'dragging()',
    '[class.armed]': 'armed() !== null',
  },
  template: `
    @if (editable()) {
      <div
        class="under edit"
        [class.on]="armed() === 'edit'"
        [hidden]="offset() <= 0"
        aria-hidden="true"
      >
        <span class="material-symbols-rounded">edit</span>
        <span class="pch-label-large">{{ editLabel() }}</span>
      </div>
    }
    @if (removable()) {
      <div
        class="under remove"
        [class.on]="armed() === 'remove'"
        [hidden]="offset() >= 0"
        aria-hidden="true"
      >
        <span class="pch-label-large">{{ removeLabel() }}</span>
        <span class="material-symbols-rounded">delete</span>
      </div>
    }
    <div
      #content
      class="content"
      [style.transform]="'translateX(' + offset() + 'px)'"
      (pointerdown)="onDown($event)"
      (pointermove)="onMove($event)"
      (pointerup)="onUp($event)"
      (pointercancel)="reset()"
    >
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
    }
    /* The list's hairline stays on top of the swiping layers. */
    :host::before {
      z-index: 2;
    }
    .under[hidden] {
      display: none;
    }
    .under {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 24px;
      transition: background-color var(--pch-spring-effects-fast-duration) linear;
    }
    .under .material-symbols-rounded {
      font-size: 24px;
      transition: transform var(--pch-spring-spatial-fast-duration) var(--pch-spring-spatial-fast);
    }
    .under.on .material-symbols-rounded {
      transform: scale(1.25);
    }
    .edit {
      justify-content: flex-start;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .edit.on {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .remove {
      justify-content: flex-end;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .remove.on {
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
    }
    .content {
      position: relative;
      z-index: 1;
      background: var(--pch-swipe-surface, var(--pch-card-elevated));
      touch-action: pan-y;
      transition: transform var(--pch-spring-spatial-default-duration)
        var(--pch-spring-spatial-default);
    }
    :host(.dragging) .content {
      transition: none;
      user-select: none;
    }
    /* Held to drag: no text selection or callout on a long press. */
    :host(.cdk-drag) .content {
      -webkit-touch-callout: none;
      user-select: none;
    }
    /* Picked up: lifted, and squarer, over the list. */
    :host(.cdk-drag-preview) {
      border-radius: var(--pch-radius-medium);
      box-shadow: var(--pch-shadow-3);
    }
    :host(.cdk-drag-preview) .content {
      background: var(--mat-sys-surface-container-highest);
    }
    /* Where it'll land: an empty slot. */
    :host(.cdk-drag-placeholder) {
      background: var(--mat-sys-surface-container-high);
    }
    :host(.cdk-drag-placeholder) .content {
      visibility: hidden;
    }
    :host(.cdk-drag-animating) {
      transition: transform var(--pch-spring-spatial-fast-duration) var(--pch-spring-spatial-fast);
    }
  `,
})
export class SwipeRow {
  /** Swipe right to edit. */
  readonly editable = input(false, { transform: booleanAttribute });
  /** Swipe left to remove. */
  readonly removable = input(false, { transform: booleanAttribute });
  readonly editLabel = input('Edit');
  readonly removeLabel = input('Remove');

  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly reduced = inject(ReducedMotion).reduced;
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  protected readonly offset = signal(0);
  protected readonly dragging = signal(false);
  /** The action a release would take now. */
  protected readonly armed = signal<'edit' | 'remove' | null>(null);

  private press: {
    id: number;
    x: number;
    y: number;
    swiping: boolean;
    samples: { t: number; x: number }[];
  } | null = null;
  /** A swipe just ended: the click its release makes isn't a tap on the row. */
  private swallowNextClick = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => clearTimeout(this.timer));
    // Picked up to move: it's not a swipe any more.
    inject(CdkDrag, { optional: true, self: true })
      ?.started.pipe(takeUntilDestroyed())
      .subscribe(() => this.reset());
    // Capturing, so the row's own click handlers never see a swipe's release.
    afterNextRender(() => {
      const content = this.content().nativeElement;
      const swallow = (e: MouseEvent) => this.swallowClick(e);
      content.addEventListener('click', swallow, true);
      destroyRef.onDestroy(() => content.removeEventListener('click', swallow, true));
    });
  }

  protected onDown(e: PointerEvent): void {
    this.swallowNextClick = false;
    // Fingers and pens swipe; a mouse selects text, and has the buttons.
    if (e.pointerType === 'mouse' || (!this.editable() && !this.removable())) return;
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, swiping: false, samples: [] };
  }

  protected onMove(e: PointerEvent): void {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.swiping) {
      // A vertical drag is a scroll: let it go.
      if (Math.abs(dy) > SLOP_PX && Math.abs(dy) > Math.abs(dx)) {
        this.press = null;
        return;
      }
      if (Math.abs(dx) < SLOP_PX) return;
      p.swiping = true;
      this.dragging.set(true);
      this.content().nativeElement.setPointerCapture?.(e.pointerId);
    }
    p.samples.push({ t: e.timeStamp, x: e.clientX });
    while (p.samples.length > 2 && e.timeStamp - p.samples[0].t > 100) p.samples.shift();
    // Towards a disabled action the row only gives a little.
    const allowed = (dx > 0 && this.editable()) || (dx < 0 && this.removable());
    const offset = allowed ? dx : dx / 6;
    this.offset.set(offset);
    const armed = allowed && Math.abs(offset) >= this.width() * COMMIT_SHARE;
    const action = armed ? (dx > 0 ? 'edit' : 'remove') : null;
    if (action !== this.armed()) {
      this.armed.set(action);
      if (action) vibrate();
    }
  }

  protected onUp(e: PointerEvent): void {
    const p = this.press;
    this.press = null;
    if (!p || e.pointerId !== p.id || !p.swiping) return;
    this.swallowNextClick = true;
    this.dragging.set(false);
    const offset = this.offset();
    const first = p.samples[0];
    const last = p.samples[p.samples.length - 1];
    const speed = first && last && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
    const flick = Math.abs(speed) >= FLICK_SPEED && Math.abs(offset) >= FLICK_PX;
    const committed = this.armed() !== null || (flick && Math.sign(speed) === Math.sign(offset));
    const action = offset > 0 ? 'edit' : 'remove';
    this.armed.set(null);
    if (
      !committed ||
      (action === 'edit' && !this.editable()) ||
      (action === 'remove' && !this.removable())
    ) {
      this.offset.set(0);
      return;
    }
    if (action === 'edit') {
      this.offset.set(0);
      this.edit.emit();
      return;
    }
    // Slide away, then remove; if the row is still here after (the removal
    // failed, or was undone into the same row), bring it back.
    this.offset.set(-this.width() - 8);
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => {
        this.remove.emit();
        this.timer = setTimeout(() => this.offset.set(0), 400);
      },
      this.reduced() ? 0 : 180,
    );
  }

  protected reset(): void {
    this.press = null;
    this.dragging.set(false);
    this.armed.set(null);
    this.offset.set(0);
  }

  private swallowClick(e: MouseEvent): void {
    if (!this.swallowNextClick) return;
    this.swallowNextClick = false;
    e.stopPropagation();
    e.preventDefault();
  }

  private width(): number {
    return this.content().nativeElement.clientWidth || 320;
  }
}

function vibrate(): void {
  try {
    navigator.vibrate?.(8);
  } catch {
    // Not supported, or not allowed yet.
  }
}
