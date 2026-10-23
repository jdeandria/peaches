import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FrameLoop, ReducedMotion } from '../core/motion';
import { M3Spring, M3Springs } from '../core/springs';

/** Labels drawn either side of the selected one. */
const REACH = 4;
/** Arc length from the selected label to its neighbours, and between the rest. */
const NEAR_PX = 50;
const FAR_PX = 30;
/** Finger travel along the rim per step while dragging. */
const DRAG_PX = 46;
/** Gap between the rim and the inner edge of the dial. */
const INSET = 22;
/** Labels sit this far inside the rim. */
const LABEL_GAP = 16;
/** Width of the tonal band inside the rim that the labels ride on. */
const BAND = 84;
/** Taps move less than this and are quicker than TAP_MS: they open the typed entry. */
const TAP_PX = 8;
const TAP_MS = 350;
/** Steps the dial can be dragged past either end before it resists completely. */
const RUBBER = 1.5;
/** Wheel/trackpad travel per step. */
const WHEEL_PX = 40;

const HALF_PI = Math.PI / 2;

/**
 * Where a label `d` steps from the selected one sits along the rim, in px:
 * spread out around the selection (a magnifier) and evenly beyond it.
 */
export function dialOffset(d: number): number {
  const near = Math.sin(Math.max(-1, Math.min(1, d)) * HALF_PI);
  return FAR_PX * d + (NEAR_PX - FAR_PX) * near;
}

/** How a fling plays out: glide to `target` (in steps) over `ms`, slowing evenly. */
export interface FlingPlan {
  readonly target: number;
  readonly ms: number;
}

/**
 * Where a release at `velocity` steps/s carries a dial sitting at `from`.
 * Gentle releases settle on the nearest step (a spring does that: ms 0).
 * Flings glide further the faster they are, more than in proportion, so a
 * hard flick crosses dozens of steps; the glide decelerates evenly
 * (friction) from the release speed and stops on a whole step.
 */
export function flingPlan(from: number, velocity: number, lo: number, hi: number): FlingPlan {
  const speed = Math.abs(velocity);
  if (speed < 4) {
    return { target: clamp(Math.round(from + velocity * 0.05), lo, hi), ms: 0 };
  }
  const boost = 1 + Math.min(3, speed / 30);
  const target = clamp(Math.round(from + velocity * 0.22 * boost), lo, hi);
  const distance = target - from;
  if (distance * velocity <= 0) return { target, ms: 0 };
  // Even deceleration from the release speed covers `distance` in 2·d/v.
  return { target, ms: Math.min(1600, ((2 * Math.abs(distance)) / speed) * 1000) };
}

/**
 * One step of a damped spring pulling `x` towards `to` (unit mass,
 * semi-implicit Euler in small substeps so stiff springs stay stable).
 */
export function springStep(
  spring: M3Spring,
  x: number,
  v: number,
  to: number,
  seconds: number,
): [x: number, v: number] {
  const c = 2 * spring.dampingRatio * Math.sqrt(spring.stiffness);
  const n = Math.max(1, Math.ceil(seconds / (1 / 240)));
  const dt = seconds / n;
  for (let i = 0; i < n; i++) {
    v += (-spring.stiffness * (x - to) - c * v) * dt;
    x += v * dt;
  }
  return [x, v];
}

/** A plain number, with a comma or a point for decimals. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Pulls `x` back towards [lo, hi]: the further past an end, the harder. */
function rubber(x: number, lo: number, hi: number): number {
  const band = (over: number) => (RUBBER * over) / (over + RUBBER);
  if (x < lo) return lo - band(lo - x);
  if (x > hi) return hi + band(x - hi);
  return x;
}

/** Drops float noise from `index × step` (0.30000000000000004 → 0.3). */
function tidy(v: number): number {
  return Math.round(v * 1e6) / 1e6 || 0;
}

type Motion =
  | { kind: 'idle' }
  | { kind: 'drag' }
  | { kind: 'spring'; to: number; v: number; user: boolean }
  | { kind: 'glide'; from: number; to: number; ms: number };

/**
 * A number picker drawn as the rim of a large wheel whose hub sits off the
 * side of the screen, the way a thumb sweeps: `side="start"` curves like
 * `)` with its labels on the outer side, `side="end"` like `(`. Values run
 * along the rim, growing towards the selected one at the apex and fading
 * away from it, with a tick per step.
 *
 * Swipe along the rim to turn it (up for more); let go mid-swipe and it
 * glides on, further the harder the fling, then lands on a whole step.
 * Past either end it resists and springs back. Tap the value (or press
 * Enter, or start typing) to type an exact one, which needn't be on a step.
 * Arrow keys step, Page Up/Down jump ten, Home/End go to the ends, and the
 * mouse wheel turns it. Changes from outside (another set's values) spin
 * the wheel there on the M3 spatial spring; under reduced motion it jumps.
 *
 * Accessible as a `slider`; `valueChange` fires as each step is crossed.
 */
@Component({
  selector: 'pch-dial',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pch-dial',
    '[class.end]': 'side() === "end"',
    '[class.active]': 'active()',
    '[class.editing]': 'editing()',
  },
  template: `
    <div
      #face
      class="face"
      role="slider"
      tabindex="0"
      [attr.aria-label]="label()"
      [attr.aria-valuemin]="min()"
      [attr.aria-valuemax]="max()"
      [attr.aria-valuenow]="current()"
      [attr.aria-valuetext]="valueText()"
      (keydown)="onKeydown($event)"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerCancel()"
      (lostpointercapture)="onPointerCancel()"
    >
      <svg class="rim" aria-hidden="true">
        <path class="band" />
        <path class="edge" />
      </svg>
      @for (i of ticks; track i) {
        <span class="tick" [class.minor]="i % 2 === 1" aria-hidden="true"></span>
      }
      @for (i of labels; track i) {
        <span class="label" [class.current]="i === reach" aria-hidden="true"></span>
      }
      <span class="ghost" aria-hidden="true"></span>
      <span class="pointer" aria-hidden="true"></span>
    </div>
    @if (editing()) {
      <input
        #entry
        class="entry"
        autocomplete="off"
        enterkeyhint="done"
        [attr.inputmode]="decimal() ? 'decimal' : 'numeric'"
        [attr.aria-label]="label()"
        [value]="draft()"
        (keydown.enter)="commit($event)"
        (keydown.escape)="cancel($event)"
        (blur)="commit()"
      />
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      min-width: 0;
      height: var(--pch-dial-height, 200px);
      color: var(--mat-sys-on-surface);
    }
    .face {
      position: absolute;
      inset: 0;
      overflow: hidden;
      border-radius: var(--pch-radius-large);
      outline: none;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      cursor: ns-resize;
      mask-image: linear-gradient(transparent, #000 26%, #000 74%, transparent);
    }
    :host:has(.face:focus-visible) {
      border-radius: var(--pch-radius-large);
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: -2px;
    }
    .rim {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .band {
      fill: none;
      stroke: var(--mat-sys-surface-container-high);
      stroke-width: ${BAND}px;
      transition: stroke var(--pch-spring-effects-default-duration) linear;
    }
    .edge {
      fill: none;
      stroke: var(--mat-sys-outline-variant);
      stroke-width: 2;
      transition: stroke var(--pch-spring-effects-default-duration) linear;
    }
    .tick,
    .label,
    .ghost,
    .pointer {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      will-change: transform, opacity;
    }
    .tick {
      width: 10px;
      height: 2px;
      border-radius: 1px;
      background: var(--mat-sys-outline);
    }
    .tick.minor {
      width: 5px;
      background: var(--mat-sys-outline-variant);
    }
    .label {
      font-family: var(--mat-sys-display-small-font);
      font-size: 40px;
      line-height: 44px;
      font-weight: 500;
      letter-spacing: -0.5px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      transition: color var(--pch-spring-effects-default-duration) linear;
    }
    .ghost {
      width: 8px;
      height: 8px;
      margin: -4px 0 0 -4px;
      border-radius: 50%;
      background: var(--mat-sys-tertiary);
      transform-origin: 50% 50%;
    }
    .pointer {
      width: 18px;
      height: 6px;
      border-radius: 3px;
      background: var(--mat-sys-primary);
      transition:
        width var(--pch-spring-spatial-fast-duration) var(--pch-spring-spatial-fast),
        height var(--pch-spring-spatial-fast-duration) var(--pch-spring-spatial-fast),
        margin var(--pch-spring-spatial-fast-duration) var(--pch-spring-spatial-fast);
    }
    :host(.active) .band {
      stroke: color-mix(in srgb, var(--mat-sys-primary) 14%, var(--mat-sys-surface-container-high));
    }
    :host(.active) .edge {
      stroke: var(--mat-sys-primary);
    }
    :host(.active) .label.current {
      color: var(--mat-sys-primary);
    }
    :host(.end) .pointer {
      margin-left: -18px;
    }
    :host(.active) .pointer {
      width: 24px;
      height: 8px;
      margin-top: -1px;
    }
    :host(.active.end) .pointer {
      margin-left: -24px;
    }
    :host(.editing) .label {
      opacity: 0 !important;
    }
    .entry {
      position: absolute;
      top: 50%;
      left: 8px;
      width: calc(100% - ${INSET + 20}px);
      height: 56px;
      margin-top: -28px;
      padding: 0 12px;
      box-sizing: border-box;
      border: 0;
      border-radius: var(--pch-radius-medium);
      outline: 2px solid var(--mat-sys-primary);
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-headline-medium);
      font-variant-numeric: tabular-nums;
      text-align: end;
    }
    :host(.end) .entry {
      left: auto;
      right: 8px;
      text-align: start;
    }
  `,
})
export class Dial {
  /** The value, in whatever unit the dial counts. */
  readonly value = input.required<number>();
  /** Accessible name, e.g. "Weight in kg". */
  readonly label = input.required<string>();
  /** What one step is worth (1 rep, 2.5 kg, 0.1 km…). */
  readonly step = input(1);
  readonly min = input(0);
  readonly max = input(9999);
  /** Which edge of the screen the wheel's hub is off. */
  readonly side = input<'start' | 'end'>('start');
  /** How a value reads on the rim. */
  readonly format = input<(v: number) => string>((v) => String(v));
  /** Reads typed text back (the inverse of `format`); null if it isn't a value. */
  readonly parse = input<(text: string) => number | null>(parseNumber);
  /** Read after the value by screen readers ("8 reps"). */
  readonly unit = input('');
  /** Last time's value: a dot on the rim marks it. */
  readonly ghost = input<number | null>(null);

  readonly valueChange = output<number>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly reduced = inject(ReducedMotion).reduced;
  private readonly loop = new FrameLoop(this.destroyRef);
  private readonly faceRef = viewChild.required<ElementRef<HTMLElement>>('face');
  private readonly entryRef = viewChild<ElementRef<HTMLInputElement>>('entry');

  protected readonly ticks = Array.from({ length: 4 * REACH + 4 }, (_, i) => i);
  protected readonly labels = Array.from({ length: 2 * REACH + 1 }, (_, i) => i);
  /** The middle label is always the selected one; the rest shift round it. */
  protected readonly reach = REACH;

  /** The value as last emitted or received. */
  protected readonly current = signal(0);
  protected readonly valueText = computed(() =>
    [this.format()(this.current()), this.unit()].filter(Boolean).join(' '),
  );
  protected readonly decimal = computed(() => !Number.isInteger(this.step()));
  protected readonly active = signal(false);
  protected readonly editing = signal(false);
  protected readonly draft = signal('');

  /** Where the wheel is, in steps (fractional while it moves). */
  private position = 0;
  /** A value off the step grid (typed, or converted units) shown at its nearest step. */
  private exact: number | null = null;
  private motion: Motion = { kind: 'idle' };
  private synced = false;

  private size = { width: 0, height: 0 };
  private tickEls: HTMLElement[] = [];
  private labelEls: HTMLElement[] = [];
  private labelText: (string | null)[] = [];

  private pointer: {
    id: number;
    hubX: number;
    hubY: number;
    angle: number;
    raw: number;
    startX: number;
    startY: number;
    at: number;
    moved: boolean;
    /** Touched while turning: a tap stops it rather than opening the entry. */
    caught: boolean;
    samples: { t: number; p: number }[];
  } | null = null;
  private wheelPx = 0;
  private lastBuzz = 0;

  private get lo(): number {
    return Math.ceil(this.min() / this.step() - 1e-9) || 0;
  }

  private get hi(): number {
    return Math.floor(this.max() / this.step() + 1e-9);
  }

  constructor() {
    // Outside changes spin the wheel there; our own echoes are ignored.
    effect(() => {
      const value = this.value();
      const step = this.step();
      untracked(() => {
        if (this.synced && Math.abs(value - this.current()) < 1e-9) return;
        this.current.set(value);
        const index = value / step;
        const onGrid = Math.abs(index - Math.round(index)) < 1e-6;
        this.exact = onGrid ? null : value;
        const target = clamp(Math.round(index), this.lo, this.hi);
        if (!this.synced || this.reduced() || this.motion.kind === 'drag') {
          this.synced = true;
          if (this.motion.kind !== 'drag') this.jump(target);
          return;
        }
        this.springTo(target, false);
      });
    });

    effect(() => {
      this.ghost();
      this.format();
      untracked(() => this.render());
    });

    afterNextRender(() => {
      const face = this.faceRef().nativeElement;
      this.tickEls = Array.from(face.querySelectorAll<HTMLElement>('.tick'));
      this.labelEls = Array.from(face.querySelectorAll<HTMLElement>('.label'));
      this.labelText = this.labelEls.map(() => null);
      this.measure();
      const wheel = (e: WheelEvent) => this.onWheel(e);
      face.addEventListener('wheel', wheel, { passive: false });
      this.destroyRef.onDestroy(() => face.removeEventListener('wheel', wheel));
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(() => this.measure());
      ro.observe(face);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  // ── Input ────────────────────────────────────────────────────────────

  protected onKeydown(e: KeyboardEvent): void {
    const by: Record<string, number> = {
      ArrowUp: 1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowLeft: -1,
      PageUp: 10,
      PageDown: -10,
    };
    let target: number | null = null;
    const from = this.settledIndex();
    if (e.key in by) target = from + by[e.key];
    else if (e.key === 'Home') target = this.lo;
    else if (e.key === 'End') target = this.hi;
    else if (e.key === 'Enter') {
      e.preventDefault();
      this.beginEdit(null);
      return;
    } else if (/^[0-9.,]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      this.beginEdit(e.key === ',' ? '.' : e.key);
      return;
    }
    if (target === null) return;
    e.preventDefault();
    target = clamp(target, this.lo, this.hi);
    // Arrowing off a typed in-between value steps to the grid on that side.
    if (this.exact !== null && Math.abs(by[e.key] ?? 0) === 1) {
      const index = this.exact / this.step();
      target = clamp(by[e.key] > 0 ? Math.ceil(index) : Math.floor(index), this.lo, this.hi);
    }
    this.exact = null;
    this.emitIndex(target);
    this.springTo(target, true);
  }

  protected onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 || this.editing()) return;
    const face = this.faceRef().nativeElement;
    face.setPointerCapture?.(e.pointerId);
    const rect = face.getBoundingClientRect();
    const hub = { x: rect.left + this.geometry().hubX, y: rect.top + this.size.height / 2 };
    const caught = this.motion.kind === 'glide' || this.motion.kind === 'spring';
    this.loop.stop();
    this.motion = { kind: 'drag' };
    this.pointer = {
      id: e.pointerId,
      hubX: hub.x,
      hubY: hub.y,
      angle: this.angleOf(e.clientX, e.clientY, hub.x, hub.y),
      raw: this.position,
      startX: e.clientX,
      startY: e.clientY,
      at: e.timeStamp,
      moved: false,
      caught,
      samples: [{ t: e.timeStamp, p: this.position }],
    };
  }

  protected onPointerMove(e: PointerEvent): void {
    const p = this.pointer;
    if (!p || e.pointerId !== p.id) return;
    if (!p.moved && Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < TAP_PX) return;
    if (!p.moved) {
      p.moved = true;
      this.active.set(true);
    }
    const angle = this.angleOf(e.clientX, e.clientY, p.hubX, p.hubY);
    const { radius } = this.geometry();
    // Content follows the finger: dragging up brings bigger values in.
    p.raw -= ((angle - p.angle) * radius) / DRAG_PX;
    p.angle = angle;
    p.samples.push({ t: e.timeStamp, p: p.raw });
    while (p.samples.length > 2 && e.timeStamp - p.samples[0].t > 100) p.samples.shift();
    this.position = rubber(p.raw, this.lo, this.hi);
    this.emitIndex(clamp(Math.round(this.position), this.lo, this.hi), true);
    this.render();
  }

  protected onPointerUp(e: PointerEvent): void {
    const p = this.pointer;
    if (!p || e.pointerId !== p.id) return;
    this.pointer = null;
    if (!p.moved) {
      this.motion = { kind: 'idle' };
      if (p.caught) this.springTo(clamp(Math.round(this.position), this.lo, this.hi), true);
      else if (e.timeStamp - p.at < TAP_MS) this.beginEdit(null);
      return;
    }
    const first = p.samples[0];
    const last = p.samples[p.samples.length - 1];
    const dt = (last.t - first.t) / 1000;
    // A pause before letting go is not a fling.
    const velocity = dt > 0 && e.timeStamp - last.t < 80 ? (last.p - first.p) / dt : 0;
    this.release(velocity);
  }

  /** The pointer went away without a release (cancelled, or capture lost): settle where it is. */
  protected onPointerCancel(): void {
    if (!this.pointer) return;
    this.pointer = null;
    this.release(0);
  }

  private onWheel(e: WheelEvent): void {
    if (this.editing()) return;
    e.preventDefault();
    this.wheelPx += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    const steps = Math.trunc(this.wheelPx / WHEEL_PX);
    if (steps === 0) return;
    this.wheelPx -= steps * WHEEL_PX;
    const base = this.motion.kind === 'spring' ? this.motion.to : this.settledIndex();
    const target = clamp(base + steps, this.lo, this.hi);
    this.emitIndex(target, true);
    this.springTo(target, true);
  }

  // ── Typed entry ──────────────────────────────────────────────────────

  private beginEdit(initial: string | null): void {
    this.loop.stop();
    this.jump(this.settledIndex());
    this.draft.set(initial ?? this.format()(this.current()));
    this.editing.set(true);
    afterNextRender(
      () => {
        const input = this.entryRef()?.nativeElement;
        if (!input) return;
        input.focus();
        if (initial === null) input.select();
        else input.setSelectionRange(initial.length, initial.length);
      },
      { injector: this.injector },
    );
  }

  protected commit(e?: Event): void {
    if (!this.editing()) return;
    const text = this.entryRef()?.nativeElement.value ?? '';
    this.editing.set(false);
    if (e) {
      e.preventDefault();
      this.faceRef().nativeElement.focus();
    }
    const n = this.parse()(text.trim());
    if (n === null || !Number.isFinite(n)) return;
    const value = tidy(clamp(n, this.min(), this.max()));
    this.current.set(value);
    const index = value / this.step();
    const onGrid = Math.abs(index - Math.round(index)) < 1e-6;
    this.exact = onGrid ? null : value;
    this.valueChange.emit(value);
    this.springTo(clamp(Math.round(index), this.lo, this.hi), true);
  }

  protected cancel(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    this.editing.set(false);
    this.faceRef().nativeElement.focus();
  }

  // ── Motion ───────────────────────────────────────────────────────────

  private release(velocity: number): void {
    const from = this.position;
    if (from < this.lo || from > this.hi) {
      this.springTo(clamp(Math.round(from), this.lo, this.hi), true, velocity);
      return;
    }
    const plan = flingPlan(from, velocity, this.lo, this.hi);
    if (plan.ms === 0 || this.reduced()) {
      this.springTo(plan.target, true, velocity);
      return;
    }
    this.motion = { kind: 'glide', from, to: plan.target, ms: plan.ms };
    this.active.set(true);
    this.loop.start((elapsed) => {
      if (this.motion.kind !== 'glide') return false;
      const t = Math.min(1, elapsed / this.motion.ms);
      const eased = 1 - (1 - t) * (1 - t);
      this.position = this.motion.from + (this.motion.to - this.motion.from) * eased;
      this.emitIndex(Math.round(this.position), true);
      this.render();
      if (t < 1) return true;
      this.settle(this.motion.to);
      return false;
    });
  }

  /** Spring the wheel to `index`: snaps, keyboard steps and outside changes. */
  private springTo(index: number, user: boolean, velocity?: number): void {
    if (this.reduced() || typeof requestAnimationFrame !== 'function') {
      this.settle(index);
      return;
    }
    const v = velocity ?? (this.motion.kind === 'spring' ? this.motion.v : 0);
    this.motion = { kind: 'spring', to: index, v, user };
    this.active.set(user);
    let last = 0;
    this.loop.start((elapsed) => {
      if (this.motion.kind !== 'spring') return false;
      const dt = Math.min(0.05, (elapsed - last) / 1000);
      last = elapsed;
      const spring = this.motion.user ? M3Springs.spatialFast : M3Springs.spatialDefault;
      const [x, nv] = springStep(spring, this.position, this.motion.v, this.motion.to, dt);
      this.position = x;
      this.motion.v = nv;
      this.render();
      if (Math.abs(x - this.motion.to) > 0.002 || Math.abs(nv) > 0.02) return true;
      this.settle(this.motion.to);
      return false;
    });
  }

  private settle(index: number): void {
    this.loop.stop();
    this.motion = { kind: 'idle' };
    this.active.set(false);
    this.position = index;
    this.emitIndex(index);
    this.render();
  }

  private jump(index: number): void {
    this.loop.stop();
    this.motion = { kind: 'idle' };
    this.active.set(false);
    this.position = index;
    this.render();
  }

  /** The step the wheel rests on (or is heading to). */
  private settledIndex(): number {
    const m = this.motion;
    if (m.kind === 'spring' || m.kind === 'glide') return m.to;
    return clamp(Math.round(this.position), this.lo, this.hi);
  }

  private exactAt(index: number): boolean {
    return this.exact !== null && Math.round(this.exact / this.step()) === index;
  }

  /** Emits the value at `index` if it differs from the current one. */
  private emitIndex(index: number, buzz = false): void {
    if (this.exactAt(index)) return;
    const value = tidy(index * this.step());
    if (Math.abs(value - this.current()) < 1e-9) return;
    this.exact = null;
    this.current.set(value);
    this.valueChange.emit(value);
    if (buzz) this.buzz();
  }

  /** A faint detent on phones that can, at most every 35 ms. */
  private buzz(): void {
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (now - this.lastBuzz < 35) return;
    this.lastBuzz = now;
    try {
      navigator.vibrate?.(3);
    } catch {
      // Not allowed yet (no user activation) or not supported.
    }
  }

  // ── Drawing ──────────────────────────────────────────────────────────

  private measure(): void {
    const face = this.faceRef().nativeElement;
    this.size = { width: face.clientWidth, height: face.clientHeight };
    const { width, height } = this.size;
    if (width === 0 || height === 0) return;
    const { hubX, radius, apexX } = this.geometry();
    const half = height / 2;
    const end = this.side() === 'end';
    const arc = (r: number) => {
      const reach = Math.sqrt(Math.max(0, r * r - half * half));
      const x = end ? hubX - reach : hubX + reach;
      return `M${x} 0 A${r} ${r} 0 0 ${end ? 0 : 1} ${x} ${height}`;
    };
    face.querySelector('.edge')?.setAttribute('d', arc(radius));
    face.querySelector('.band')?.setAttribute('d', arc(radius - BAND / 2));
    const pointer = face.querySelector<HTMLElement>('.pointer');
    if (pointer) {
      const px = end ? apexX + 6 : apexX - 6;
      pointer.style.transform = `translate(${px}px, ${half - 3}px)`;
    }
    this.render();
  }

  /** The hub's x (off the face), the wheel's radius and the rim's apex x. */
  private geometry(): { hubX: number; radius: number; apexX: number } {
    const { width, height } = this.size;
    const radius = Math.max(260, height * 1.6);
    const end = this.side() === 'end';
    const apexX = end ? INSET : width - INSET;
    return { hubX: end ? apexX + radius : apexX - radius, radius, apexX };
  }

  /** Angle of a point around the hub, growing downwards on either side. */
  private angleOf(x: number, y: number, hubX: number, hubY: number): number {
    return this.side() === 'end' ? Math.atan2(y - hubY, hubX - x) : Math.atan2(y - hubY, x - hubX);
  }

  /** Writes every tick and label's transform for the current position. */
  private render(): void {
    const { width, height } = this.size;
    if (width === 0 || height === 0 || this.labelEls.length === 0) return;
    const { hubX, radius } = this.geometry();
    const end = this.side() === 'end';
    const cy = height / 2;
    const p = this.position;
    const base = Math.round(p);
    const sign = end ? -1 : 1;
    const point = (d: number, r: number) => {
      const theta = dialOffset(d) / radius;
      return {
        x: hubX + sign * r * Math.cos(theta),
        y: cy + r * Math.sin(theta),
        theta,
      };
    };

    // Ticks: one per step, a shorter one between; pointing at the hub.
    for (let i = 0; i < this.tickEls.length; i++) {
      const el = this.tickEls[i];
      const k = base - REACH - 1 + i / 2;
      const d = k - p;
      const inRange = k >= this.lo && k <= this.hi && Math.abs(d) <= REACH + 1;
      if (!inRange) {
        el.style.opacity = '0';
        continue;
      }
      const { x, y, theta } = point(d, radius);
      const angle = end ? -theta : theta + Math.PI;
      el.style.opacity = '1';
      el.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad) translateY(-1px)`;
    }

    // Labels: biggest at the apex, shrinking and dimming away from it.
    for (let i = 0; i < this.labelEls.length; i++) {
      const el = this.labelEls[i];
      const k = base - REACH + i;
      const d = k - p;
      if (k < this.lo || k > this.hi) {
        el.style.opacity = '0';
        continue;
      }
      const text = this.exactAt(k)
        ? this.format()(this.exact!)
        : this.format()(tidy(k * this.step()));
      if (this.labelText[i] !== text) {
        el.textContent = text;
        this.labelText[i] = text;
      }
      const near = Math.abs(d) < 1 ? (1 + Math.cos(Math.PI * d)) / 2 : 0;
      const scale = 0.42 + 0.58 * near;
      const { x, y, theta } = point(d, radius - LABEL_GAP);
      const rotate = end ? -theta : theta;
      const anchor = end ? 'translate(0, -50%)' : 'translate(-100%, -50%)';
      el.style.opacity = String(0.55 + 0.45 * near);
      el.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}rad) scale(${scale}) ${anchor}`;
    }

    // Last time's value, just outside the rim.
    const ghostEl = this.faceRef().nativeElement.querySelector<HTMLElement>('.ghost');
    const ghost = this.ghost();
    if (ghostEl) {
      // On the typed value when it matches, else where it falls between steps.
      const d =
        ghost === null
          ? Infinity
          : this.exact !== null && Math.abs(ghost - this.exact) < 1e-9
            ? Math.round(this.exact / this.step()) - p
            : ghost / this.step() - p;
      if (Math.abs(d) > REACH) {
        ghostEl.style.opacity = '0';
      } else {
        const { x, y } = point(d, radius + 8);
        ghostEl.style.opacity = '1';
        ghostEl.style.transform = `translate(${x}px, ${y}px)`;
      }
    }
  }
}
