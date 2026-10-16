import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';

import { WeightUnits } from '../../../domain/core/units';
import { Exercise } from '../../../domain/exercises/exercise';
import { ExerciseCatalog } from '../../../domain/exercises/exercise-catalog';
import { UnitSystem } from '../../../domain/models/training';
import { prescription, WorkoutItem } from '../../../domain/models/workout';
import { ExerciseLogEntry, exerciseLogEntry } from '../../../domain/models/workout-log';
import { settle } from '../../../../testing/test-app';
import { openSetLogger } from './set-logger-sheet';

/** Recording sets, weights and RPE for one workout item. */
describe('SetLoggerSheet', () => {
  const catalog = ExerciseCatalog.standard();
  const squat = catalog.require('bb-back-squat');
  const pushUp = catalog.require('bw-push-up');

  const itemFor = (e: Exercise, sets = 3): WorkoutItem => ({
    id: 'w-1-i0',
    exerciseId: e.id,
    prescription: prescription({ sets, reps: 8, restSeconds: 90 }),
    scoringWeight: 1,
  });

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
    exercise: Exercise,
    options: {
      units?: UnitSystem;
      previous?: number[];
      existing?: ExerciseLogEntry;
    } = {},
  ) {
    const result = openSetLogger(TestBed.inject(MatBottomSheet), {
      exercise,
      item: itemFor(exercise),
      existing: options.existing,
      units: options.units,
      previousLoadsKg: options.previous,
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
    Array.from(root.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]'));
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
    expect(entry.sets.map((s) => s.reps)).toEqual([8, 8, 8]);
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
    expect(entry.sets.map((s) => s.reps)).toEqual([8, 8, 8]);
  });

  it('pre-fills from last time and shows it', async () => {
    const { dialog, result } = await open(squat, { previous: [60, 62.5] });
    expect(dialog.querySelector('.last-time')?.textContent?.trim()).toContain(
      'Last time: 60 · 62.5 kg',
    );
    const entry = await save(dialog, result);
    // The last recorded set's weight fills sets beyond last time's count.
    expect(entry.sets.map((s) => s.loadKg)).toEqual([60, 62.5, 62.5]);
  });

  it('changing a weight carries to later matching sets only', async () => {
    const { dialog, result } = await open(squat, { previous: [50, 60, 60] });
    // Raise set 2 from 60 to 62.5: set 3 (also 60) follows, set 1 stays.
    await click(buttons(dialog, 'Heavier')[1]);
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.loadKg)).toEqual([50, 62.5, 62.5]);
  });

  it('typed weights carry forward too', async () => {
    const { dialog, result } = await open(squat, { previous: [40, 40, 40] });
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
    const { dialog, result } = await open(squat, { previous: [40, 40, 40] });
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
      previous: [WeightUnits.toKg(135, 'imperial')],
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
      previous: [100],
      existing: exerciseLogEntry({
        exerciseId: 'bb-back-squat',
        workoutItemId: 'w-1-i0',
        sets: [set(6, 80), set(6, 80), set(5, 82.5)],
      }),
    });
    const entry = await save(dialog, result);
    expect(entry.sets.map((s) => s.loadKg)).toEqual([80, 80, 82.5]);
    expect(entry.sets.map((s) => s.reps)).toEqual([6, 6, 5]);
  });

  it('steps values, fills the prescription back in and records RPE', async () => {
    const { dialog, result } = await open(pushUp);
    await click(buttons(dialog, 'Fewer reps')[0]);
    await click(buttons(dialog, 'More reps')[2]);
    const valueFields = () =>
      Array.from(dialog.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]'));
    expect(valueFields().map((f) => f.value)).toEqual(['7', '8', '9']);
    await click(buttons(dialog, 'As prescribed')[0]);
    expect(valueFields().map((f) => f.value)).toEqual(['8', '8', '8']);
    const rpe8 = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find(
      (b) => b.textContent?.trim() === '8',
    )!;
    await click(rpe8);
    const entry = await save(dialog, result);
    expect(entry.rpe).toBe(8);
    expect(entry.workoutItemId).toBe('w-1-i0');
  });

  it('labels per-side sets left and right', async () => {
    const exercise = catalog.all.find((e) => e.laterality === 'unilateral')!;
    const sheet = openSetLogger(TestBed.inject(MatBottomSheet), {
      exercise,
      item: {
        id: 'i',
        exerciseId: exercise.id,
        prescription: prescription({ sets: 2, reps: 5, restSeconds: 30, perSide: true }),
        scoringWeight: 1,
      },
    });
    await settle();
    TestBed.tick();
    const labels = Array.from(document.querySelectorAll('.set-label')).map((l) => l.textContent);
    expect(labels).toEqual(['Set 1 · Left', 'Set 1 · Right', 'Set 2 · Left', 'Set 2 · Right']);
    TestBed.inject(MatBottomSheet).dismiss();
    expect(await sheet).toBeUndefined();
  });
});
