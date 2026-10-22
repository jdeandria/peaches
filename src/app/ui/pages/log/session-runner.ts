import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { NgTemplateOutlet } from '@angular/common';

import {
  doneCount,
  ExerciseLogEntry,
  nextPlannedSet,
  plannedFor,
  planProgress,
  WorkoutLog,
} from '../../../domain/models/workout-log';
import { AppState } from '../../../state/app-state';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';
import { WavyProgress } from '../../expressive/wavy-progress';
import { SetDials } from './set-dials';
import { SetDraft, SetFormat } from './set-format';

const RPE_OPTIONS: ButtonGroupOption<number>[] = [5, 6, 7, 8, 9, 10].map((r) => ({
  value: r,
  label: String(r),
}));

/** Where the rest timer setting is kept, per device. */
const REST_KEY = 'pch-rest-timer';
/** The most a rest can be stretched to, and the step the buttons move it by. */
const MAX_REST_SECONDS = 15 * 60;
const REST_STEP_SECONDS = 15;
/** Circumference of the rest ring (r = 88). */
const RING = 2 * Math.PI * 88;

/** A sensible rest after a set: longer after lifting than after bodyweight or timed work. */
export function restSeconds(e: Pick<ExerciseLogEntry, 'track' | 'takesLoad'>): number {
  if (e.track === 'reps') return e.takesLoad ? 90 : 60;
  return e.track === 'time' ? 45 : 60;
}

/** "1:30", "0:05". */
function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function readRestSetting(): boolean {
  try {
    return localStorage.getItem(REST_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** A screen wake lock (not in every browser's typings yet). */
interface Lock {
  release(): Promise<void>;
}

interface Rest {
  /** When the countdown ends (epoch ms), or null with the rest timer off. */
  readonly endsAt: number | null;
  readonly total: number;
  /** The exercise whose last set this was, to rate it. */
  readonly finished: ExerciseLogEntry | null;
}

/**
 * Log mode: the planned workout one set at a time, full screen and
 * one-handed. The dials start on the target; Done records what's on them
 * (adjust them first if the set went differently), then a rest countdown
 * runs (optional, remembered per device) before the next set. Finishing an
 * exercise asks how hard it was. Sets can be skipped, added and taken back.
 * Keeps the screen awake while open.
 */
@Component({
  selector: 'pch-session-runner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonGroup,
    MatButton,
    MatIconButton,
    MatTooltip,
    NgTemplateOutlet,
    SetDials,
    WavyProgress,
  ],
  templateUrl: './session-runner.html',
  styleUrl: './session-runner.scss',
})
export class SessionRunner {
  readonly log = input.required<WorkoutLog>();
  /** The session clock, as shown. */
  readonly clock = input.required<string>();
  /** Back to planning. */
  readonly backToPlan = output<void>();
  /** Finish and share the workout. */
  readonly finish = output<void>();

  private readonly state = inject(AppState);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly rpeOptions = RPE_OPTIONS;
  protected readonly busy = signal(false);
  protected readonly restTimer = signal(readRestSetting());
  protected readonly rest = signal<Rest | null>(null);
  /** The last set logged here, to take back. */
  private readonly lastLogged = signal<string | null>(null);
  protected readonly canUndo = computed(() => this.lastLogged() !== null);

  protected readonly next = computed(() => nextPlannedSet(this.log()));
  protected readonly progress = computed(() => planProgress(this.log()));
  protected readonly fraction = computed(() => {
    const { done, total } = this.progress();
    return total === 0 ? 0 : done / total;
  });

  /** Which exercise of the plan, and which set of it. */
  protected readonly position = computed(() => {
    const next = this.next();
    if (!next) return null;
    const plan = this.log().plan;
    const index = plan.findIndex((e) => e.exerciseId === next.exercise.exerciseId);
    return {
      exercise: index + 1,
      exercises: plan.length,
      set: next.index + 1,
      sets: next.exercise.sets.length,
    };
  });

  protected readonly format = computed(() => {
    const next = this.next();
    return next ? new SetFormat(next.exercise, this.state.units()) : null;
  });

  /** The planned set, as dial values. */
  private readonly target = computed<SetDraft | null>(() => {
    const next = this.next();
    const format = this.format();
    return next && format ? format.draft(next.exercise.sets[next.index]) : null;
  });
  protected readonly targetText = computed(() => {
    const target = this.target();
    return target ? this.format()!.describe(target) : '';
  });

  /** What's on the dials: the target, until the Peach turns them (or moves on). */
  protected readonly draft = linkedSignal<string, SetDraft | null>({
    source: () => {
      const next = this.next();
      return next
        ? `${next.exercise.exerciseId}:${next.index}:${JSON.stringify(next.exercise.sets[next.index])}`
        : '';
    },
    computation: () => untracked(this.target),
  });

  protected readonly dials = computed(() => {
    const format = this.format();
    const draft = this.draft();
    if (!format || !draft) return [];
    return format.dials(draft, this.target(), (patch) =>
      this.draft.update((d) => (d ? { ...d, ...patch } : d)),
    );
  });

  /** What comes after the set on the card. */
  protected readonly upNext = computed(() => {
    const next = this.next();
    if (!next) return null;
    const plan = this.log().plan;
    if (next.index + 1 < next.exercise.sets.length) {
      const format = this.format()!;
      return `Set ${next.index + 2} · ${format.describe(format.draft(next.exercise.sets[next.index + 1]))}`;
    }
    const i = plan.findIndex((e) => e.exerciseId === next.exercise.exerciseId);
    const following = plan
      .slice(i + 1)
      .find((e) => doneCount(this.log(), e.exerciseId) < e.sets.length);
    return following ? following.exerciseName : 'The finish';
  });

  /** During a rest: the set coming up. */
  protected readonly upNextAfterRest = computed(() => {
    const next = this.next();
    const format = this.format();
    const target = this.target();
    if (!next || !format || !target) return '';
    return `Set ${next.index + 1} · ${format.describe(target)}`;
  });

  /** Ticks while a rest counts down. */
  private readonly now = signal(Date.now());
  protected readonly remaining = computed(() => {
    const endsAt = this.rest()?.endsAt;
    return endsAt == null ? 0 : Math.max(0, (endsAt - this.now()) / 1000);
  });
  protected readonly remainingText = computed(() => clock(this.remaining()));
  protected readonly ringOffset = computed(() => {
    const rest = this.rest();
    if (!rest?.endsAt) return 0;
    return RING * (1 - this.remaining() / rest.total);
  });
  protected readonly ring = RING;

  /** How hard the just-finished exercise was, as logged. */
  protected readonly finishedRpe = computed(() => {
    const finished = this.rest()?.finished;
    if (!finished) return null;
    return this.log().entries.find((e) => e.exerciseId === finished.exerciseId)?.rpe ?? null;
  });

  protected readonly setsDone = computed(() =>
    this.log().entries.reduce((n, e) => n + e.sets.length, 0),
  );

  constructor() {
    // Count the rest down; when it's up, buzz and bring on the next set.
    let timer: ReturnType<typeof setInterval> | undefined;
    effect(() => {
      const endsAt = this.rest()?.endsAt;
      clearInterval(timer);
      if (endsAt == null) return;
      timer = setInterval(() => {
        this.now.set(Date.now());
        if (Date.now() < endsAt) return;
        clearInterval(timer);
        vibrate([120, 80, 120]);
        untracked(() => {
          // Keep the screen up if there's an exercise to rate.
          const rest = this.rest();
          this.rest.set(rest?.finished ? { ...rest, endsAt: null } : null);
        });
      }, 250);
    });
    this.destroyRef.onDestroy(() => clearInterval(timer));

    afterNextRender(() => this.heading()?.nativeElement.focus());
    this.keepAwake();
  }

  /** Records the set as dialled, then rests. */
  protected async done(): Promise<void> {
    const next = this.next();
    const format = this.format();
    const draft = this.draft();
    if (!next || !format || !draft || this.busy()) return;
    const set = format.toSet(draft);
    if (!set) {
      this.state.toast('Dial in what you did first.');
      return;
    }
    const id = next.exercise.exerciseId;
    this.busy.set(true);
    const log = await this.state.run((app) =>
      app.loggingService.logSet(this.log().id, id, set, this.state.now()),
    );
    this.busy.set(false);
    if (!log) return;
    vibrate(20);
    this.lastLogged.set(id);
    const planned = plannedFor(log, id);
    const finished = planned && doneCount(log, id) >= planned.sets.length ? planned : null;
    const more = nextPlannedSet(log) !== null;
    const seconds = restSeconds(next.exercise);
    const timed = this.restTimer() && more;
    if (timed || finished) {
      this.now.set(Date.now());
      this.rest.set({
        endsAt: timed ? Date.now() + seconds * 1000 : null,
        total: seconds,
        finished,
      });
    }
  }

  /** Takes back the last set logged here. */
  protected async undo(): Promise<void> {
    const id = this.lastLogged();
    if (!id || this.busy()) return;
    this.busy.set(true);
    const log = await this.state.run((app) => app.loggingService.undoSet(this.log().id, id));
    this.busy.set(false);
    if (!log) return;
    this.lastLogged.set(null);
    this.rest.set(null);
  }

  protected async skip(): Promise<void> {
    const next = this.next();
    if (!next || this.busy()) return;
    await this.state.run((app) =>
      app.loggingService.skipSet(this.log().id, next.exercise.exerciseId),
    );
  }

  /** One more set of this exercise, like its last. */
  protected async addSet(): Promise<void> {
    const next = this.next();
    if (!next || this.busy()) return;
    await this.state.run((app) =>
      app.loggingService.addSet(this.log().id, next.exercise.exerciseId),
    );
  }

  protected async rate(rpe: number | null): Promise<void> {
    const finished = this.rest()?.finished;
    if (!finished) return;
    await this.state.run((app) =>
      app.loggingService.rateExercise(this.log().id, finished.exerciseId, rpe),
    );
  }

  protected endRest(): void {
    this.rest.set(null);
  }

  /** Stretches or shortens the rest by `seconds`. */
  protected nudgeRest(seconds: number): void {
    const rest = this.rest();
    if (!rest?.endsAt) return;
    const now = Date.now();
    const left = Math.min(MAX_REST_SECONDS, Math.max(0, (rest.endsAt - now) / 1000 + seconds));
    this.now.set(now);
    this.rest.set({
      ...rest,
      endsAt: now + left * 1000,
      total: Math.min(MAX_REST_SECONDS, Math.max(rest.total + seconds, left, 1)),
    });
  }

  protected toggleRestTimer(): void {
    const on = !this.restTimer();
    this.restTimer.set(on);
    try {
      localStorage.setItem(REST_KEY, on ? 'on' : 'off');
    } catch {
      // Private mode or blocked storage: the setting lasts this session only.
    }
    if (!on && this.rest()?.endsAt) this.endRest();
  }

  protected readonly restStep = REST_STEP_SECONDS;

  /** Asks the browser to keep the screen on while the workout is on screen. */
  private keepAwake(): void {
    const wakeLock = (
      navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Lock> } }
    ).wakeLock;
    if (!wakeLock || typeof document === 'undefined') return;
    let lock: Lock | null = null;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      wakeLock.request('screen').then(
        (l) => (lock = l),
        () => undefined,
      );
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release().catch(() => undefined);
    });
  }
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported, or not allowed yet.
  }
}
