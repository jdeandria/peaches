import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { AppState } from '../../../state/app-state';
import { loggableFromCatalog } from '../../../domain/exercises/loggable';
import { entryOf, isSubmitted, setLog } from '../../../domain/models/workout-log';
import { seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { LogPage } from './log.page';

@Component({ template: '' })
class Blank {}

describe('LogPage', () => {
  let backend: TestBackend;

  beforeEach(async () => {
    localStorage.clear();
    backend = await seededBackend({ routes: [{ path: '**', component: Blank }] });
    TestBed.configureTestingModule({
      providers: [
        ...backend.providers,
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(MatBottomSheet).dismiss();
    TestBed.inject(MatDialog).closeAll();
  });

  async function render(inputs: { logId?: string; mode?: string; routine?: string } = {}) {
    const f = TestBed.createComponent(LogPage);
    if (inputs.logId) f.componentRef.setInput('logId', inputs.logId);
    if (inputs.mode) f.componentRef.setInput('mode', inputs.mode);
    if (inputs.routine) f.componentRef.setInput('routine', inputs.routine);
    await stable(f);
    return { f, el: f.nativeElement as HTMLElement };
  }

  async function stable(f: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await settle();
      TestBed.tick();
      await f.whenStable();
    }
  }

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
  const button = (root: ParentNode, name: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => (b.getAttribute('aria-label') ?? text(b)) === name || text(b)?.endsWith(name),
    );
  const overlay = () => document.querySelector<HTMLElement>('.cdk-overlay-container')!;
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const key = (target: HTMLElement, name: string) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  /** Types a value into one of the set logger's dials (Enter opens its entry). */
  async function dial(f: ComponentFixture<unknown>, label: string, value: string) {
    key(overlay().querySelector<HTMLElement>(`[role=slider][aria-label="${label}"]`)!, 'Enter');
    await stable(f);
    const input = overlay().querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    type(input, value);
    key(input, 'Enter');
    await stable(f);
  }

  const pick = async (f: ComponentFixture<unknown>, el: HTMLElement, search: string) => {
    button(el, 'Add exercise')!.click();
    await stable(f);
    type(overlay().querySelector<HTMLInputElement>('input[type=search]')!, search);
    await stable(f);
  };
  const rows = () => Array.from(overlay().querySelectorAll<HTMLButtonElement>('button.row'));
  const radio = (root: ParentNode, label: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('[role=radio]')).find(
      (b) => text(b) === label,
    )!;
  const doneButton = (root: ParentNode) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.getAttribute('aria-label')?.startsWith('Done: set'),
    );

  it('plans a run, starts the clock with the workout, logs it set by set and finishes', async () => {
    const { f, el } = await render();
    expect(text(el.querySelector('h1'))).toBe('Plan your workout');
    expect(text(el.querySelector('.subtitle'))).toBe('Counts in 2 Crates');
    // No clock until there's a workout going; building your own comes first.
    expect(el.querySelector('.clock')).toBeNull();
    const sections = Array.from(el.querySelectorAll('pch-section h2')).map(text);
    expect(sections).toEqual(['Build your own', 'Your routines', 'Templates']);
    expect(el.querySelector('button.add-first')).not.toBeNull();
    expect(button(el, 'Start workout')).toBeUndefined();
    // Planning doesn't count: the clock waits.
    const [draft] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    expect(draft.timerStartedAt).toBeNull();

    // Plan "Run" from the catalog: five kilometres in 25 minutes.
    await pick(f, el, 'run');
    rows()
      .find((b) => text(b.querySelector('.pch-body-large')) === 'Run')!
      .click();
    await stable(f);
    // Planning sets has no RPE: that's for after.
    expect(overlay().querySelector('[role=radio]')).toBeNull();
    await dial(f, 'Distance in km', '5');
    await dial(f, 'Time in minutes', '25');
    button(overlay(), 'Save')!.click();
    await stable(f);

    expect(text(el.querySelector('.item'))).toContain('Run');
    expect(text(el.querySelector('.item'))).toContain('1 set · 5 km · 25:00');
    expect(text(el.querySelector('.done-count'))).toBe('0/1');
    // Nothing is done yet, so nothing adds up yet.
    expect(el.querySelector('.total')).toBeNull();

    button(el, 'Start workout')!.click();
    await stable(f);
    expect((await backend.container.logs.getById(draft.id))!.timerStartedAt).not.toBeNull();
    expect(TestBed.inject(Router).url).toContain('mode=log');
    f.componentRef.setInput('mode', 'log');
    await stable(f);

    // Log mode: one set, its target on the dials, and Done.
    expect(el.querySelector('pch-page')).toBeNull();
    expect(text(el.querySelector('h1'))).toBe('Run');
    expect(text(el)).toContain('Exercise 1 of 1 · Set 1 of 1');
    expect(text(el.querySelector('.target'))).toBe('Target 5.0 km');
    button(el, 'Done: set 1 of Run')!.click();
    await stable(f);
    expect(text(el.querySelector('h1'))).toBe('Workout complete');
    radio(el, '7').click();
    await stable(f);

    button(el, 'Finish · 0:00')!.click();
    await stable(f);
    const log = (await backend.container.logs.getById(draft.id))!;
    expect(isSubmitted(log)).toBe(true);
    expect(log.timerStartedAt).toBeNull();
    expect(log.sharedWith).toHaveLength(2);
    expect(log.plan).toEqual([]);
    expect(log.entries).toEqual([
      expect.objectContaining({
        exerciseName: 'Run',
        rpe: 7,
        sets: [{ reps: null, loadKg: null, meters: 5000, seconds: 1500 }],
      }),
    ]);
    expect(TestBed.inject(Router).url).toBe(`/log/${draft.id}`);
  });

  it('plans from a routine, saves a plan as one, and deletes one with Undo', async () => {
    const toast = vi.spyOn(TestBed.inject(AppState), 'toast').mockImplementation(() => undefined);
    const { f, el } = await render();
    const routines = () =>
      Array.from(el.querySelectorAll('.routine-use:not(.template-use) .pch-title-medium')).map(
        text,
      );
    expect(routines()).toEqual(['Full body', 'Swing day']);

    el.querySelectorAll<HTMLButtonElement>('.routine-use:not(.template-use)')[0].click();
    await stable(f);
    expect(Array.from(el.querySelectorAll('.item .pch-title-medium')).map(text)).toEqual([
      'Goblet Squat',
      'Dumbbell Bench Press',
      'Dumbbell Bent Over Row',
      'Forearm Plank',
    ]);
    expect(text(el)).toContain('0 of 12 sets done');

    button(el, 'Save as routine')!.click();
    await stable(f);
    const name = overlay().querySelector<HTMLInputElement>('mat-dialog-content input')!;
    expect(name.value).toBe('Goblet Squat, Dumbbell Bench Press & mor');
    type(name, 'full BODY');
    await stable(f);
    // Same name: it replaces that one.
    expect(text(overlay().querySelector('mat-hint'))).toBe('Replaces your “Full body” routine');
    type(name, 'Upper & lower');
    await stable(f);
    button(overlay(), 'Save')!.click();
    await stable(f);
    const saved = await backend.container.routines.forPeach(DEMO_PEACH_ID);
    expect(saved.map((r) => r.name)).toEqual(['Full body', 'Swing day', 'Upper & lower']);
    expect(saved[2].exercises).toHaveLength(4);
    expect(toast).toHaveBeenCalledWith('Saved “Upper & lower”.');

    // Back to an empty plan to see the routines again, and delete one.
    for (const id of saved[2].exercises.map((e) => e.exerciseId)) {
      const [draft] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
      await backend.container.loggingService.removeEntry(draft.id, id);
    }
    await stable(f);
    expect(routines()).toEqual(['Full body', 'Swing day', 'Upper & lower']);
    button(el, 'Delete routine Swing day')!.click();
    await stable(f);
    expect(routines()).toEqual(['Full body', 'Upper & lower']);
    const undo = toast.mock.calls.find(([m]) => m === 'Deleted “Swing day”.')![1]!;
    undo();
    await stable(f);
    expect(routines()).toEqual(['Full body', 'Swing day', 'Upper & lower']);
  });

  it('offers template workouts, reshuffled on demand, to plan in a tap', async () => {
    const { f, el } = await render();
    const template = (name: string) =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('.template-use')).find((b) =>
        text(b.querySelector('.pch-title-medium'))?.startsWith(name),
      )!;
    expect(text(el)).toContain('Templates');
    expect(text(template('Full body').querySelector('.kit'))).toBe('Dumbbells');
    expect(text(template('Easy run'))).toMatch(/1 exercise · (Run|Easy Jog)/);

    // Shuffling draws another mix; some shuffle soon differs.
    const before = text(template('Upper body'));
    let after = before;
    for (let i = 0; i < 5 && after === before; i++) {
      button(el, 'Shuffle Upper body')!.click();
      await stable(f);
      after = text(template('Upper body'));
    }
    expect(after).not.toBe(before);

    template('Upper body').click();
    await stable(f);
    const [draft] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    expect(draft.plan).toHaveLength(5);
    expect(text(el)).toContain('0 of 15 sets done');
  });

  it('log mode rests between sets, and skips and takes back sets', async () => {
    const { f, el } = await render();
    const [draft] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    const exercise = (id: string) => loggableFromCatalog(backend.container.catalog.require(id));
    const squat = exercise('bb-back-squat');
    await backend.container.loggingService.planExercise(
      draft.id,
      entryOf(squat, { sets: [1, 2].map(() => setLog({ reps: 5, loadKg: 100 })) }),
    );
    await backend.container.loggingService.planExercise(
      draft.id,
      entryOf(exercise('bw-forearm-plank'), { sets: [setLog({ seconds: 60 })] }),
    );
    f.componentRef.setInput('mode', 'log');
    await stable(f);
    const heading = () => text(el.querySelector('h1'));
    const where = () => text(el.querySelector('.title p'));
    const done = () => doneButton(el)!.click();
    const squats = async () =>
      (await backend.container.logs.getById(draft.id))!.entries.find(
        (e) => e.exerciseId === squat.id,
      )?.sets ?? [];

    expect(heading()).toBe(squat.name);
    expect(text(el.querySelector('.target'))).toBe('Target 5 × 100 kg');
    // A rep short of the target: dial it down, then Done.
    key(el.querySelector<HTMLElement>('[role=slider][aria-label="Reps"]')!, 'ArrowDown');
    await stable(f);
    done();
    await stable(f);
    expect((await squats()).map((s) => s.reps)).toEqual([4]);
    // The first set started the clock.
    expect((await backend.container.logs.getById(draft.id))!.timerStartedAt).not.toBeNull();

    // A rest, which can be stretched or skipped.
    expect(heading()).toBe('Rest');
    expect(el.querySelector('[role=timer]')?.getAttribute('aria-label')).toBe('Rest 1:30');
    button(el, 'Rest 15 seconds more')!.click();
    await stable(f);
    expect(el.querySelector('[role=timer]')?.getAttribute('aria-label')).toBe('Rest 1:45');
    expect(text(el.querySelector('.up-next'))).toContain('Set 2 · 5 × 100 kg');
    button(el, 'Skip rest')!.click();
    await stable(f);
    expect(where()).toBe('Exercise 1 of 2 · Set 2 of 2');

    // Changing the plan is for plan mode: here sets are only done or skipped.
    expect(button(el, 'Add a set')).toBeUndefined();

    // Its last set: how hard was it?
    done();
    await stable(f);
    expect(text(el)).toContain(`How hard was ${squat.name}?`);
    expect(text(el.querySelector('.up-next'))).toContain('Forearm Plank');
    button(el, 'Undo last set')!.click();
    await stable(f);
    expect(where()).toBe('Exercise 1 of 2 · Set 2 of 2');
    expect(await squats()).toHaveLength(1);

    // Without the rest timer, finishing an exercise still asks how it went.
    const restToggle = button(el, 'Rest timer')!;
    expect(restToggle.getAttribute('aria-pressed')).toBe('true');
    restToggle.click();
    await stable(f);
    expect(restToggle.getAttribute('aria-pressed')).toBe('false');
    done();
    await stable(f);
    expect(heading()).toBe('Nice set');
    expect(el.querySelector('[role=timer]')).toBeNull();
    radio(el, '9').click();
    await stable(f);
    expect((await backend.container.logs.getById(draft.id))!.entries[0].rpe).toBe(9);
    button(el, 'Next set')!.click();
    await stable(f);
    expect(heading()).toBe('Forearm Plank');

    button(el, 'Skip set 1')!.click();
    await stable(f);
    expect(heading()).toBe('Workout complete');
    expect(text(el)).toContain('2 sets in');
  });

  it('finishing early from log mode asks first, and logs what was done', async () => {
    const { f, el } = await render();
    const [draft] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    const squat = loggableFromCatalog(backend.container.catalog.require('bb-back-squat'));
    await backend.container.loggingService.planExercise(
      draft.id,
      entryOf(squat, { sets: [1, 2, 3].map(() => setLog({ reps: 5, loadKg: 100 })) }),
    );
    f.componentRef.setInput('mode', 'log');
    await stable(f);
    // Nothing done yet: nothing to finish.
    expect(button(el, 'Finish')).toBeUndefined();
    // Up 2.5 kg on the first set: the rest of the sets follow.
    key(el.querySelector<HTMLElement>('[role=slider][aria-label="Weight in kg"]')!, 'ArrowUp');
    await stable(f);
    doneButton(el)!.click();
    await stable(f);
    button(el, 'Skip rest')!.click();
    await stable(f);
    expect(text(el.querySelector('.target'))).toBe('Target 5 × 102.5 kg');

    button(el, 'Finish')!.click();
    await stable(f);
    expect(text(overlay().querySelector('h2'))).toBe('Finish now?');
    expect(text(overlay())).toContain('2 planned sets aren’t done and won’t be logged.');
    button(overlay(), 'Finish')!.click();
    await stable(f);
    const log = (await backend.container.logs.getById(draft.id))!;
    expect(isSubmitted(log)).toBe(true);
    expect(log.entries[0].sets).toEqual([setLog({ reps: 5, loadKg: 102.5 })]);
  });

  it('leads with recent exercises and crate-mates’ ones, tagged with who', async () => {
    const { f, el } = await render();
    button(el, 'Add exercise')!.click();
    await stable(f);
    const groups = Array.from(overlay().querySelectorAll('h3.group')).map(text);
    expect(groups).toEqual(['Recent', 'From your Crates', 'All exercises']);
    expect(text(overlay())).toContain('Last time:');
    expect(text(overlay())).toContain('From Ada');
  });

  it('the picker: Enter takes the top match, Escape clears, arrows move through results', async () => {
    const { f, el } = await render();
    await pick(f, el, 'pushups');
    const search = overlay().querySelector<HTMLInputElement>('input[type=search]')!;
    expect(text(rows()[0].querySelector('.pch-body-large'))).toBe('Push Up');

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(rows()[0]);
    rows()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(search);

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    search.dispatchEvent(escape);
    await stable(f);
    expect(escape.defaultPrevented).toBe(true);
    expect(search.value).toBe('');
    // The sheet stays open for another search.
    expect(overlay().querySelector('input[type=search]')).not.toBeNull();

    type(search, 'bodyweight squat');
    await stable(f);
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await stable(f);
    // Straight on to planning its sets.
    expect(text(overlay().querySelector('h2'))).toBe('Bodyweight Squat');
  });

  it('swiping a planned exercise left removes it, and Undo puts it back in place', async () => {
    const toast = vi.spyOn(TestBed.inject(AppState), 'toast').mockImplementation(() => undefined);
    const { f, el } = await render();
    el.querySelectorAll<HTMLButtonElement>('.routine-use:not(.template-use)')[0].click();
    await stable(f);
    const names = () => Array.from(el.querySelectorAll('.item .pch-title-medium')).map(text);
    const before = names();
    const content = el.querySelectorAll<HTMLElement>('pch-swipe-row .content')[1];
    let t = 0;
    const fire = (type: string, x: number) => {
      const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 10 });
      Object.defineProperties(e, {
        pointerId: { value: 1 },
        pointerType: { value: 'touch' },
        timeStamp: { value: (t += 16) },
      });
      content.dispatchEvent(e);
    };
    fire('pointerdown', 300);
    for (let x = 280; x >= 100; x -= 20) fire('pointermove', x);
    fire('pointerup', 100);
    await settle(400);
    await stable(f);
    expect(names()).toEqual(before.filter((_, i) => i !== 1));
    toast.mock.calls.find(([m]) => m === `Removed ${before[1]}.`)![1]!();
    await stable(f);
    expect(names()).toEqual(before);
  });

  it('makes up an exercise on the spot', async () => {
    const { f, el } = await render();
    await pick(f, el, 'Rucking');
    rows()
      .find((b) => text(b)?.includes('Create “Rucking”'))!
      .click();
    await stable(f);
    rows()
      .find((b) => text(b)?.endsWith('Reps with weight'))!
      .click();
    await stable(f);
    button(overlay(), 'Save')!.click();
    await stable(f);
    const [draft] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    expect(draft.plan[0]).toMatchObject({
      exerciseName: 'Rucking',
      track: 'reps',
      takesLoad: true,
    });
    expect(draft.plan[0].exerciseId.startsWith('custom-')).toBe(true);
  });

  it('a finished workout stays editable, time included', async () => {
    const [latest] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    const { f, el } = await render({ logId: latest.id });
    expect(text(el.querySelector('h1'))).toBe('Sun, Oct 11');
    expect(text(el)).toContain('Run');
    expect(text(el.querySelector('.clock'))).toContain('Session time');
    expect(button(el, 'Add exercise')).toBeDefined();
    expect(
      Array.from(el.querySelectorAll('button')).some((b) => text(b)?.startsWith('Finish')),
    ).toBe(false);

    button(el, 'Edit details')!.click();
    await stable(f);
    type(overlay().querySelector<HTMLInputElement>('input[inputmode=numeric]')!, '50');
    await stable(f);
    button(overlay(), 'Save')!.click();
    await stable(f);
    expect((await backend.container.logs.getById(latest.id))!.durationSeconds).toBe(3000);
  });

  it('removes an exercise at once, with Undo to put it back', async () => {
    const log = (await backend.container.logs.forPeach(DEMO_PEACH_ID)).find(
      (l) => isSubmitted(l) && l.entries.length > 1,
    )!;
    const [first] = log.entries;
    const toast = vi.spyOn(TestBed.inject(AppState), 'toast').mockImplementation(() => undefined);
    const { f, el } = await render({ logId: log.id });

    button(el, `Remove ${first.exerciseName}`)!.click();
    await stable(f);
    let saved = (await backend.container.logs.getById(log.id))!;
    expect(saved.entries.map((e) => e.exerciseId)).not.toContain(first.exerciseId);
    expect(toast).toHaveBeenCalledWith(`Removed ${first.exerciseName}.`, expect.any(Function));

    toast.mock.calls[0][1]!();
    await stable(f);
    saved = (await backend.container.logs.getById(log.id))!;
    expect(saved.entries.find((e) => e.exerciseId === first.exerciseId)).toEqual(first);
  });

  it('deletes a finished workout, with Undo', async () => {
    const toast = vi.spyOn(TestBed.inject(AppState), 'toast').mockImplementation(() => undefined);
    const [latest] = (await backend.container.logs.forPeach(DEMO_PEACH_ID)).filter(isSubmitted);
    const { f, el } = await render({ logId: latest.id });
    button(el, 'Delete workout')!.click();
    await stable(f);
    expect(await backend.container.logs.getById(latest.id)).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/');
    expect(toast).toHaveBeenCalledWith('Deleted Sun, Oct 11’s workout.', expect.any(Function));
    toast.mock.calls[0][1]!();
    await stable(f);
    expect((await backend.container.logs.getById(latest.id))?.entries).toEqual(latest.entries);
  });

  it('says when a workout does not exist', async () => {
    const { el } = await render({ logId: 'nope' });
    expect(text(el)).toContain('Workout not found');
  });

  it('plans the routine a link names into an empty draft, once', async () => {
    const pushUp = loggableFromCatalog(backend.container.catalog.require('bw-push-up'));
    const routine = await backend.container.routineService.create(
      DEMO_PEACH_ID,
      'Push day',
      [entryOf(pushUp, { sets: [setLog({ reps: 20 }), setLog({ reps: 20 })] })],
      TestBed.inject(AppState).now(),
    );
    const { f, el } = await render({ routine: routine.id });
    expect(text(el.querySelector('.item'))).toContain('Push Up');
    expect(el.querySelectorAll('.item.clickable')).toHaveLength(1);
    const [draft] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    expect(draft.plan.map((e) => e.exerciseId)).toEqual(['bw-push-up']);
    // Not planned again on a later pass.
    await stable(f);
    expect((await backend.container.logs.getById(draft.id))!.plan).toHaveLength(1);
  });

  it('opening the runner straight from a link starts the clock', async () => {
    const squat = loggableFromCatalog(backend.container.catalog.require('bb-back-squat'));
    const fresh = await backend.container.loggingService.openDraft(
      DEMO_PEACH_ID,
      TestBed.inject(AppState).now(),
    );
    await backend.container.loggingService.planExercise(
      fresh.id,
      entryOf(squat, { sets: [setLog({ reps: 5, loadKg: 100 })] }),
    );
    // Planned, not started.
    expect(fresh.timerStartedAt).toBeNull();
    const { el } = await render({ mode: 'log' });
    expect(text(el.querySelector('h1'))).toBe(squat.name);
    expect((await backend.container.logs.getById(fresh.id))!.timerStartedAt).not.toBeNull();
  });
});
