import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
} from '@angular/core';
import { cssColor } from '../core/colors';
import { initialOf, namedShapePath, shapeForId, ShapeName } from './shapes';

/**
 * An avatar clipped to an M3 Expressive shape (port of `ShapedAvatar`).
 *
 * Shows projected content (an icon, an image) or, when `name` is set, the
 * name's initial. `shape="auto"` picks the identity shape from `shapeId` (or
 * `name`), so a Peach always wears the same shape.
 *
 * Decorative by default (names are usually shown alongside); set `label` to
 * expose it as an image.
 */
@Component({
  selector: 'pch-shaped-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() * 0.42',
    '[style.--pch-avatar-icon-size.px]': 'size() * 0.5',
    '[style.clip-path]': 'clipPath()',
    '[style.background]': 'bg()',
    '[style.color]': 'fg()',
    '[attr.data-shape]': 'resolvedShape()',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
  template: `@if (name() !== undefined) {
      {{ initial() }}
    } @else {
      <ng-content />
    }`,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex: none;
      overflow: hidden;
      font-weight: 600;
      line-height: 1;
      user-select: none;
    }
    :host ::ng-deep .material-symbols-rounded,
    :host ::ng-deep .mat-icon {
      font-size: var(--pch-avatar-icon-size);
      width: auto;
      height: auto;
    }
    :host ::ng-deep img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class ShapedAvatar {
  /** A shape name, or `'auto'` to pick one from `shapeId` (falls back to `name`). */
  readonly shape = input<ShapeName | 'auto'>('auto');
  /** Stable id (e.g. a Peach id) used by `shape="auto"`. */
  readonly shapeId = input<string>();
  /** Shows this name's initial instead of projected content. */
  readonly name = input<string>();
  readonly size = input(40, { transform: numberAttribute });
  /** Container colour: an M3 role (`'secondary-container'`) or CSS colour. */
  readonly color = input<string>();
  /** Content colour: an M3 role or CSS colour. */
  readonly foreground = input<string>();
  /** Accessible name; when unset the avatar is hidden from assistive tech. */
  readonly label = input<string>();

  protected readonly resolvedShape = computed<ShapeName>(() => {
    const s = this.shape();
    if (s !== 'auto') return s;
    const key = this.shapeId() ?? this.name();
    return key ? shapeForId(key) : 'cookie9';
  });
  protected readonly clipPath = computed(
    () => `path('${namedShapePath(this.resolvedShape(), this.size())}')`,
  );
  protected readonly initial = computed(() => initialOf(this.name()));
  protected readonly bg = computed(
    () => cssColor(this.color()) ?? 'var(--mat-sys-secondary-container)',
  );
  protected readonly fg = computed(
    () => cssColor(this.foreground()) ?? 'var(--mat-sys-on-secondary-container)',
  );
}
