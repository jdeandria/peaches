import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';

import { DistanceUnits, WeightUnits } from '../../../domain/core/units';
import { ExerciseCatalog } from '../../../domain/exercises/exercise-catalog';
import { LoggableExercise, loggableFromCatalog } from '../../../domain/exercises/loggable';
import { UnitSystem } from '../../../domain/models/training';
import {
  ExerciseLogEntry,
  exerciseLogEntry,
  SetLog,
  setLog,
} from '../../../domain/models/workout-log';
import { settle } from '../../../../testing/test-app';
import { openSetLogger } from './set-logger-sheet';

/** Recording sets, one at a time on dials, with weights and RPE, for one exercise. */
describe('SetLoggerSheet', () => {
  const catalog = ExerciseCatalog.standard();
  const loggable = (id: string) => loggableFromCatalog(catalog.require(id));
  const squat = loggable('bb-back-squat');
  const pushUp = loggable('bw-push-up');
  const run = loggable('bw-run');
  const row = loggable('row-steady');
  const plank = loggable('bw-forearm-plank');

  /** Last time's entry: these sets of `exercise`. */
  const last = (exercise: LoggableExercise, sets: Partial<SetLog>[]): ExerciseLogEntry =>
    exerciseLogEntry({ exerciseId: exercise.id, sets: sets.map(setLog) });
  const lifts = (...loads: number[]) =>
    last(
      squat,
      loads.map((loadKg) => ({ reps: 8, loadKg })),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
    });
  });

  afterEach(() => {
    TestBed.inject(MatBottomSheet).dismiss();
  });

  /** Opens the sheet and returns its dialog element and the pending result. */
  async function open(
    exercise: LoggableExercise,
    options: {
      units?: UnitSystem;
      previous?: ExerciseLogEntry;
      existing?: ExerciseLogEntry;
    } = {},
  ) {
    const result = openSetLogger(TestBed.inject(MatBottomSheet), {
      exercise,
      existing: options.existing,
      previous: options.previous,
      units: options.units,
    });
    await settle();
    TestBed.tick();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    return { dialog, result };
  }

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
  const buttons = (root: HTMLElement, prefix: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter((b) =>
      (b.getAttribute('aria-label') ?? b.querySelector('.mdc-button__label')?.textContent ?? '')
        .trim()
        .startsWith(prefix),
    );
  const dials = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLElement>('[role="slider"]'));
  const dial = (root: HTMLElement, label: string) =>
    dials(root).find((d) => d.getAttribute('aria-label') === label)!;
  const valueOf = (root: HTMLElement, label: string) =>
    Number(dial(root, label).getAttribute('aria-valuenow'));
  const chips = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('.chip')).map((c) =>
      Array.from(c.children).map(text).join(' '),
    );
  const units = (root: HTMLElement, label: string) =>
    Array.from(root.querySelectorAll('.unit')).filter((u) => u.textContent?.trim() === label);

  async function click(button: HTMLElement): Promise<void> {
    button.click();
    TestBed.tick();
    await settle();
  }

  async function press(target: HTMLElement, key: string): Promise<void> {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    TestBed.tick();
    await settle();
  }

  /** Types an exact value into a dial: Enter opens its entry field. */
  async function type(
    root: HTMLElement,
    label: string,
    value: string,
    commit: 'Enter' | 'blur' = 'Enter',
  ): Promise<void> {
    await press(dial(root, label), 'Enter');
    const input = root.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    expect(input).not.toBeNull();
    input.value = value;
    input.dispatchEvent(new Event('input'));
    if (commit === 'Enter') await press(input, 'Enter');
    else input.dispatchEvent(new Event('blur'));
    TestBed.tick();
    await settle();
  }

  async function goToSet(root: HTMLElement, n: number): Promise<void> {
    await click(buttons(root, `Set ${n}`)[0]);
    expect(text(root.querySelector('.set-label'))).toMatch(new RegExp(`^Set ${n} of \\d+$`));
  }

  async function save(dialog: HTMLElement, result: Promise<ExerciseLogEntry | undefined>) {
    await click(buttons(dialog, 'Save')[0]);
    const entry = await result;
    expect(entry).toBeDefined();
    return entry!;
  }

  it('is a labelled dialog', async () => {
    const { dialog } = await open(pushUp);
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-label')).toBe(pushUp.name);
    expect(dialog.querySelector('h2')?.textContent).toBe(pushUp.name);
  });

  it('resolves undefined when dismissed', async () => {
    const { result } = await open(pushUp);
    TestBed.inject(MatBottomSheet).dismiss();
    expect(await result).toBeUndefined();
  });

  it('shows one set at a time, with every set in a strip above', async () => {
    const { dialog } = await open(squat, { previous: lifts(50, 60, 60) });
    expect(chips(dialog)).toEqual(['1 8 × 50', '2 8 × 60', '3 8 × 60']);
    expect(buttons(dialog, 'Set 1')[0].getAttribute('aria-current')).toBe('true');
    expect(text(dialog.querySelector('.set-label'))).toBe('Set 1 of 3');
    expect(valueOf(dialog, 'Weight in kg')).toBe(50);

    await click(buttons(dialog, 'Next set')[0]);
    expect(text(dialog.querySelector('.set-label'))).toBe('Set 2 of 3');
    expect(valueOf(dialog, 'Weight in kg')).toBe(60);
    expect(buttons(dialog, 'Set 2')[0].getAttribute('aria-current')).toBe('true');
    expect(buttons(dialog, 'Set 1')[0].getAttribute('aria-current')).toBeNull();

    // On the last set, Next becomes Add.
    await goToSet(dialog, 3);
    expect(buttons(dialog, 'Next set')).toHaveLength(0);
    expect(buttons(dialog, 'Add set')).toHaveLength(1);
  });

  it('bodyweight exercises have just a reps dial', async () => {
    const { dialog, result } = await open(pushUp);
    expect(dials(dialog).map((d) => d.getAttribute('aria-label'))).toEqual(['Reps']);
    expect(units(dialog, 'kg')).toHaveLength(0);
    expect(dial(dialog, 'Reps').getAttribute('aria-valuetext')).toBe('10 reps');
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.loadKg)).toEqual([null, null, null]);
    expect(entry.sets.map((s) => s.reps)).toEqual([10, 10, 10]);
    expect(entry).toMatchObject({ track: 'reps', takesLoad: false });
  });

  it('weighted exercises dial reps and weight', async () => {
    const { dialog, result } = await open(squat);
    expect(dials(dialog).map((d) => d.getAttribute('aria-label'))).toEqual([
      'Reps',
      'Weight in kg',
    ]);
    expect(units(dialog, 'kg')).toHaveLength(1);

    // Empty until set: one step from zero is 2.5 kg.
    await press(dial(dialog, 'Weight in kg'), 'ArrowUp');
    expect(chips(dialog)[0]).toBe('1 10 × 2.5');
    const entry = await save(dialog, result);
    // Carried forward to the later, still-empty sets.
    expect(entry.sets.map((s) => s.loadKg)).toEqual([2.5, 2.5, 2.5]);
    expect(entry.sets.map((s) => s.reps)).toEqual([10, 10, 10]);
    expect(entry.takesLoad).toBe(true);
  });

  it('starts from last time’s sets, says what they were and marks them on the dials', async () => {
    const previous = last(squat, [
      { reps: 5, loadKg: 60 },
      { reps: 5, loadKg: 62.5 },
    ]);
    const { dialog, result } = await open(squat, { previous });
    expect(dialog.querySelector('.last-time')?.textContent?.trim()).toContain(
      'Last time: 2 sets · 10 reps · 60–62.5 kg',
    );
    expect(text(dialog.querySelector('.ghost-note'))).toBe('Last time 5 × 60');
    await goToSet(dialog, 2);
    expect(text(dialog.querySelector('.ghost-note'))).toBe('Last time 5 × 62.5');
    // Repeating it is one tap.
    const entry = await save(dialog, result);
    expect(entry.sets).toEqual(previous.sets);
  });

  it('changing a weight carries to later matching sets only', async () => {
    const { dialog, result } = await open(squat, { previous: lifts(50, 60, 60) });
    // Raise set 2 from 60 to 62.5: set 3 (also 60) follows, set 1 stays.
    await goToSet(dialog, 2);
    await press(dial(dialog, 'Weight in kg'), 'ArrowUp');
    expect(chips(dialog)).toEqual(['1 8 × 50', '2 8 × 62.5', '3 8 × 62.5']);
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.loadKg)).toEqual([50, 62.5, 62.5]);
  });

  it('typed weights carry forward too, and needn’t be on a step', async () => {
    const { dialog, result } = await open(squat, { previous: lifts(40, 40, 40) });
    await type(dialog, 'Weight in kg', '43.75');
    expect(valueOf(dialog, 'Weight in kg')).toBe(43.75);
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.loadKg)).toEqual([43.75, 43.75, 43.75]);
  });

  it('commits typed weights on blur', async () => {
    const { dialog, result } = await open(squat, { previous: lifts(40, 40, 40) });
    await goToSet(dialog, 2);
    await type(dialog, 'Weight in kg', '42.5', 'blur');
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.loadKg)).toEqual([40, 42.5, 42.5]);
  });

  it('shows and steps pounds but stores kilograms', async () => {
    const { dialog, result } = await open(squat, {
      units: 'imperial',
      previous: lifts(...[1, 2, 3].map(() => WeightUnits.toKg(135, 'imperial'))),
    });
    expect(units(dialog, 'lb')).toHaveLength(1);
    expect(valueOf(dialog, 'Weight in lb')).toBe(135);
    await press(dial(dialog, 'Weight in lb'), 'ArrowUp');
    expect(chips(dialog)).toEqual(['1 8 × 140', '2 8 × 140', '3 8 × 140']);
    const entry = await save(dialog, result);
    expect(entry.sets[0].loadKg).toBeCloseTo(WeightUnits.toKg(140, 'imperial'), 9);
  });

  it('an existing entry wins over last time', async () => {
    const set = (reps: number, loadKg: number) => ({ reps, loadKg, seconds: null, meters: null });
    const { dialog, result } = await open(squat, {
      previous: lifts(100),
      existing: exerciseLogEntry({
        exerciseId: 'bb-back-squat',
        sets: [set(6, 80), set(6, 80), set(5, 82.5)],
      }),
    });
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.loadKg)).toEqual([80, 80, 82.5]);
    expect(entry.sets.map((s) => s.reps)).toEqual([6, 6, 5]);
  });

  it('dials reps per set and records RPE', async () => {
    const { dialog, result } = await open(pushUp);
    await press(dial(dialog, 'Reps'), 'ArrowDown');
    await goToSet(dialog, 3);
    await press(dial(dialog, 'Reps'), 'PageUp');
    expect(chips(dialog)).toEqual(['1 9 reps', '2 10 reps', '3 20 reps']);
    const rpe8 = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find(
      (b) => b.textContent?.trim() === '8',
    )!;
    await click(rpe8);
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.reps)).toEqual([9, 10, 20]);
    expect(entry.rpe).toBe(8);
    expect(entry.exerciseName).toBe(pushUp.name);
    expect(entry.distanceKind).toBeNull();
  });

  it('keeps the sheet open, sets intact, when the numbers are implausible', async () => {
    const { dialog, result } = await open(pushUp, { previous: last(pushUp, [{ reps: 5000 }]) });
    let settled = false;
    void result.then(() => (settled = true));
    await click(buttons(dialog, 'Save')[0]);
    expect(settled).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
      'more than 1000 reps in one set',
    );
    // Changing the sets clears the complaint until the next Save.
    await press(dial(dialog, 'Reps'), 'ArrowDown');
    expect(dialog.querySelector('[role="alert"]')).toBeNull();
  });

  it('adds a set like the one shown, and removes the one shown', async () => {
    const { dialog, result } = await open(pushUp, {
      previous: last(pushUp, [{ reps: 12 }, { reps: 8 }]),
    });
    await press(dial(dialog, 'Reps'), 'ArrowUp');
    await goToSet(dialog, 2);
    await click(buttons(dialog, 'Add set')[0]);
    // The new set is a copy of set 2, and it's the one shown.
    expect(chips(dialog)).toEqual(['1 13 reps', '2 8 reps', '3 8 reps']);
    expect(text(dialog.querySelector('.set-label'))).toBe('Set 3 of 3');

    await goToSet(dialog, 1);
    await click(buttons(dialog, 'Remove set 1')[0]);
    expect(chips(dialog)).toEqual(['1 8 reps', '2 8 reps']);
    expect(text(dialog.querySelector('.set-label'))).toBe('Set 1 of 2');

    await click(buttons(dialog, 'Remove set 1')[0]);
    // The last one can't go.
    expect(buttons(dialog, 'Remove set 1')[0].disabled).toBe(true);
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.reps)).toEqual([8]);
  });

  it('puts the sets in another order, and the moved one is shown', async () => {
    const { dialog, result } = await open(pushUp, {
      previous: last(pushUp, [{ reps: 12 }, { reps: 10 }, { reps: 8 }]),
    });
    const chip = (n: number) => dialog.querySelectorAll<HTMLElement>('.chip')[n - 1];
    const alt = async (target: HTMLElement, key: string) => {
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key, altKey: true, bubbles: true, cancelable: true }),
      );
      TestBed.tick();
      await settle();
    };

    await alt(chip(1), 'ArrowRight');
    expect(chips(dialog)).toEqual(['1 10 reps', '2 12 reps', '3 8 reps']);
    expect(text(dialog.querySelector('.set-label'))).toBe('Set 2 of 3');
    expect(valueOf(dialog, 'Reps')).toBe(12);

    await alt(chip(3), 'ArrowLeft');
    expect(chips(dialog)).toEqual(['1 10 reps', '2 8 reps', '3 12 reps']);
    expect(text(dialog.querySelector('.set-label'))).toBe('Set 2 of 3');
    // Nowhere further to go.
    await alt(chip(1), 'ArrowLeft');
    expect(chips(dialog)).toEqual(['1 10 reps', '2 8 reps', '3 12 reps']);

    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.reps)).toEqual([10, 8, 12]);
  });

  it('timed exercises dial minutes and seconds', async () => {
    const { dialog, result } = await open(plank, {
      previous: last(plank, [{ seconds: 45 }, { seconds: 45 }]),
    });
    expect(dials(dialog).map((d) => d.getAttribute('aria-label'))).toEqual(['Minutes', 'Seconds']);
    expect(dial(dialog, 'Seconds').getAttribute('aria-valuetext')).toBe('45 sec');
    await press(dial(dialog, 'Seconds'), 'ArrowUp');
    await press(dial(dialog, 'Minutes'), 'ArrowUp');
    expect(chips(dialog)).toEqual(['1 1:50', '2 0:45']);
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.seconds)).toEqual([110, 45]);
    expect(entry.sets.every((s) => s.reps === null)).toBe(true);
  });

  it('cardio records distance and time, in km or miles', async () => {
    const { dialog, result } = await open(run, { units: 'imperial' });
    expect(units(dialog, 'mi')).toHaveLength(1);
    await type(dialog, 'Distance in mi', '3.1');
    await type(dialog, 'Time in minutes', '27:30');
    expect(chips(dialog)).toEqual(['1 3.1 mi']);
    expect(dial(dialog, 'Time in minutes').getAttribute('aria-valuetext')).toBe('27:30 min');
    const entry = await save(dialog, result);
    expect(entry.distanceKind).toBe('runWalk');
    expect(entry.sets).toEqual([
      { reps: null, loadKg: null, seconds: 1650, meters: DistanceUnits.toMeters(3.1, 'imperial') },
    ]);
  });

  it('rowing counts metres, and empty sets are dropped', async () => {
    const { dialog, result } = await open(row, {
      previous: last(row, [{ meters: 500 }, { meters: 500 }]),
    });
    expect(units(dialog, 'm')).toHaveLength(1);
    expect(valueOf(dialog, 'Distance in m')).toBe(500);
    await press(dial(dialog, 'Distance in m'), 'ArrowUp');
    await goToSet(dialog, 2);
    await press(dial(dialog, 'Distance in m'), 'Home');
    const entry = await save(dialog, result);
    expect(entry.sets).toEqual([{ reps: null, loadKg: null, seconds: null, meters: 550 }]);
    expect(entry.distanceKind).toBe('swimRow');
  });
});
