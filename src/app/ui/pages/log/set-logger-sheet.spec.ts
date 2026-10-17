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

/** Recording sets, weights and RPE for one exercise. */
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

  const buttons = (root: HTMLElement, prefix: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter((b) =>
      (b.getAttribute('aria-label') ?? b.querySelector('.mdc-button__label')?.textContent ?? '')
        .trim()
        .startsWith(prefix),
    );
  const weightFields = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLInputElement>('input.weight'));
  const units = (root: HTMLElement, label: string) =>
    Array.from(root.querySelectorAll('.unit')).filter((u) => u.textContent?.trim() === label);

  async function click(button: HTMLElement): Promise<void> {
    button.click();
    TestBed.tick();
    await settle();
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

  it('bodyweight exercises have no weight stepper', async () => {
    const { dialog, result } = await open(pushUp);
    expect(buttons(dialog, 'Heavier')).toHaveLength(0);
    expect(units(dialog, 'kg')).toHaveLength(0);
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.loadKg)).toEqual([null, null, null]);
    expect(entry.sets.map((s) => s.reps)).toEqual([10, 10, 10]);
    expect(entry).toMatchObject({ track: 'reps', takesLoad: false });
  });

  it('weighted exercises get a weight per set', async () => {
    const { dialog, result } = await open(squat);
    expect(buttons(dialog, 'Heavier')).toHaveLength(3);
    expect(units(dialog, 'kg')).toHaveLength(3);

    // Blank until set: one press from zero is a single 2.5 kg step.
    await click(buttons(dialog, 'Heavier')[0]);
    const entry = await save(dialog, result);
    // Carried forward to the later, still-blank sets.
    expect(entry.sets.map((s) => s.loadKg)).toEqual([2.5, 2.5, 2.5]);
    expect(entry.sets.map((s) => s.reps)).toEqual([10, 10, 10]);
    expect(entry.takesLoad).toBe(true);
  });

  it('starts from last time’s sets and says what they were', async () => {
    const previous = last(squat, [
      { reps: 5, loadKg: 60 },
      { reps: 5, loadKg: 62.5 },
    ]);
    const { dialog, result } = await open(squat, { previous });
    expect(dialog.querySelector('.last-time')?.textContent?.trim()).toContain(
      'Last time: 2 sets · 10 reps · 60–62.5 kg',
    );
    // Repeating it is one tap.
    const entry = await save(dialog, result);
    expect(entry.sets).toEqual(previous.sets);
  });

  it('changing a weight carries to later matching sets only', async () => {
    const { dialog, result } = await open(squat, { previous: lifts(50, 60, 60) });
    // Raise set 2 from 60 to 62.5: set 3 (also 60) follows, set 1 stays.
    await click(buttons(dialog, 'Heavier')[1]);
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.loadKg)).toEqual([50, 62.5, 62.5]);
  });

  it('typed weights carry forward too', async () => {
    const { dialog, result } = await open(squat, { previous: lifts(40, 40, 40) });
    const field = weightFields(dialog)[0];
    expect(field.value).toBe('40');
    field.value = '45';
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    TestBed.tick();
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.loadKg)).toEqual([45, 45, 45]);
  });

  it('commits typed weights on blur', async () => {
    const { dialog, result } = await open(squat, { previous: lifts(40, 40, 40) });
    const field = weightFields(dialog)[1];
    field.value = '42.5';
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
    TestBed.tick();
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.loadKg)).toEqual([40, 42.5, 42.5]);
  });

  it('shows and steps pounds but stores kilograms', async () => {
    const { dialog, result } = await open(squat, {
      units: 'imperial',
      previous: lifts(...[1, 2, 3].map(() => WeightUnits.toKg(135, 'imperial'))),
    });
    expect(units(dialog, 'lb')).toHaveLength(3);
    expect(weightFields(dialog).map((f) => f.value)).toEqual(['135', '135', '135']);
    await click(buttons(dialog, 'Heavier')[0]);
    expect(weightFields(dialog).map((f) => f.value)).toEqual(['140', '140', '140']);
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

  it('steps values and records RPE', async () => {
    const { dialog, result } = await open(pushUp);
    await click(buttons(dialog, 'Fewer reps')[0]);
    await click(buttons(dialog, 'More reps')[2]);
    const valueFields = () =>
      Array.from(dialog.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]'));
    expect(valueFields().map((f) => f.value)).toEqual(['9', '10', '11']);
    const rpe8 = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find(
      (b) => b.textContent?.trim() === '8',
    )!;
    await click(rpe8);
    const entry = await save(dialog, result);
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
    await click(buttons(dialog, 'Fewer reps')[0]);
    expect(dialog.querySelector('[role="alert"]')).toBeNull();
  });

  it('adds and removes sets', async () => {
    const { dialog, result } = await open(pushUp, {
      previous: last(pushUp, [{ reps: 12 }, { reps: 12 }]),
    });
    await click(buttons(dialog, 'Add set')[0]);
    await click(buttons(dialog, 'Add set')[0]);
    await click(buttons(dialog, 'Remove set')[0]);
    const labels = Array.from(dialog.querySelectorAll('.set-label')).map((l) => l.textContent);
    expect(labels).toEqual(['Set 1', 'Set 2', 'Set 3']);
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.reps)).toEqual([12, 12, 12]);
  });

  it('timed exercises record seconds', async () => {
    const { dialog, result } = await open(plank, {
      previous: last(plank, [{ seconds: 45 }, { seconds: 45 }]),
    });
    await click(buttons(dialog, 'More sec')[0]);
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.seconds)).toEqual([50, 45]);
    expect(entry.sets.every((s) => s.reps === null)).toBe(true);
  });

  it('cardio records distance and time, in km or miles', async () => {
    const { dialog, result } = await open(run, { units: 'imperial' });
    expect(units(dialog, 'mi')).toHaveLength(1);
    const [distance, minutes] = Array.from(
      dialog.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]'),
    );
    distance.value = '3.1';
    distance.dispatchEvent(new Event('input'));
    minutes.value = '27.5';
    minutes.dispatchEvent(new Event('input'));
    TestBed.tick();
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
    expect(units(dialog, 'm')).toHaveLength(2);
    const fields = Array.from(
      dialog.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]'),
    );
    expect(fields.map((f) => f.value)).toEqual(['500', '', '500', '']);
    fields[2].value = '';
    fields[2].dispatchEvent(new Event('input'));
    TestBed.tick();
    const entry = await save(dialog, result);
    expect(entry.sets).toEqual([{ reps: null, loadKg: null, seconds: null, meters: 500 }]);
    expect(entry.distanceKind).toBe('swimRow');
  });
});
