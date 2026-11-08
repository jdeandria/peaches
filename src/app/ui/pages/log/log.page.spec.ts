import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { AppState } from '../../../state/app-state';
import { loggableFromCatalog } from '../../../domain/exercises/loggable';
import { entryOf, ExerciseLogEntry, isSubmitted, setLog } from '../../../domain/models/workout-log';
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

  /**
   * Renders the page. Without a log id, a workout is launched first (as
   * Start on the plan does) with `plan` as its exercises, unless `launched`
   * is false.
   */
  async function render(
    inputs: {
      logId?: string;
      mode?: string;
      plan?: readonly ExerciseLogEntry[];
      launched?: boolean;
    } = {},
  ) {
    if (!inputs.logId && inputs.launched !== false) {
      await backend.container.loggingService.newDraft(
        DEMO_PEACH_ID,
        TestBed.inject(AppState).now(),
        inputs.plan,
      );
    }
    const f = TestBed.createComponent(LogPage);
    if (inputs.logId) f.componentRef.setInput('logId', inputs.logId);
    if (inputs.mode) f.componentRef.setInput('mode', inputs.mode);
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

  it('does a launched run set by set, then finishes back on the Plan', async () => {
    const run = loggableFromCatalog(backend.container.catalog.require('bw-run'));
    const { f, el } = await render({
      plan: [entryOf(run, { sets: [setLog({ meters: 5000, seconds: 1500 })] })],
    });
    const [draft] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    // A workout under way is done in the runner; there's no list of it here (the Plan has that).
    expect(el.querySelector('pch-session-runner')).not.toBeNull();
    expect(button(el, 'Add exercise')).toBeUndefined();
    // Opening it started the clock.
    expect((await backend.container.logs.getById(draft.id))!.timerStartedAt).not.toBeNull();

    // Log mode: one set, its target on the dials, and Done.
    expect(el.querySelector('pch-page')).toBeNull();
    // The exercise and set head the screen, on its chip; nothing else says them.
    expect(text(el.querySelector('h1'))).toBe('Run, set 1 of 1');
    expect(text(el.querySelector('.chip.selected'))).toBe('Run Set 1 of 1');
    expect(el.querySelector('.target')).toBeNull();
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
    // Back to the Plan, where the day shows it done.
    expect(TestBed.inject(Router).url).toBe('/');
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
    const heading = () => text(el.querySelector('.chip.selected .chip-name'));
    const where = () => text(el.querySelector('.chip.selected .chip-set'));
    const done = () => doneButton(el)!.click();
    const squats = async () =>
      (await backend.container.logs.getById(draft.id))!.entries.find(
        (e) => e.exerciseId === squat.id,
      )?.sets ?? [];

    expect(heading()).toBe(squat.name);
    expect(where()).toBe('Set 1 of 2');
    // A rep short of the target: dial it down, and the target shows beside the set, then Done.
    key(el.querySelector<HTMLElement>('[role=slider][aria-label="Reps"]')!, 'ArrowDown');
    await stable(f);
    expect(text(el.querySelector('.target'))).toBe('Target 5 × 100 kg');
    done();
    await stable(f);
    expect((await squats()).map((s) => s.reps)).toEqual([4]);
    // The first set started the clock.
    expect((await backend.container.logs.getById(draft.id))!.timerStartedAt).not.toBeNull();

    // A rest, which can be stretched or skipped: a pause on the set screen,
    // the next set already on the dials and the timer parting them.
    expect(heading()).toBe(squat.name);
    expect(where()).toBe('Set 2 of 2');
    expect(el.querySelector('.target')).toBeNull();
    expect(el.querySelector('pch-set-dials')?.classList).toContain('apart');
    // Greyed out of the way: they can't be turned until the rest is over.
    expect(el.querySelector('pch-set-dials')?.hasAttribute('inert')).toBe(true);
    expect(el.querySelector('[role=timer]')?.getAttribute('aria-label')).toBe('Rest 1:30');
    button(el, 'Rest 15 seconds more')!.click();
    await stable(f);
    expect(el.querySelector('[role=timer]')?.getAttribute('aria-label')).toBe('Rest 1:45');
    // What was just done.
    expect(text(el.querySelector('.status'))).toBe('Logged 4 × 100 kg');
    button(el, 'Skip rest')!.click();
    await stable(f);
    expect(el.querySelector('[role=timer]')).toBeNull();
    expect(el.querySelector('pch-set-dials')?.classList).not.toContain('apart');
    expect(el.querySelector('pch-set-dials')?.hasAttribute('inert')).toBe(false);
    expect(where()).toBe('Set 2 of 2');

    // Changing the plan is for plan mode: here sets are only done or skipped.
    expect(button(el, 'Add a set')).toBeUndefined();

    // Its last set: how hard was it?
    done();
    await stable(f);
    expect(text(el)).toContain(`How hard was ${squat.name}?`);
    expect(heading()).toBe('Forearm Plank');
    button(el, 'Undo last set')!.click();
    await stable(f);
    expect(where()).toBe('Set 2 of 2');
    expect(await squats()).toHaveLength(1);

    // Without the rest timer, finishing an exercise still asks how it went.
    const restToggle = button(el, 'Rest timer')!;
    expect(restToggle.getAttribute('aria-pressed')).toBe('true');
    restToggle.click();
    await stable(f);
    expect(restToggle.getAttribute('aria-pressed')).toBe('false');
    done();
    await stable(f);
    // Straight on to the next set, asking on the way.
    expect(heading()).toBe('Forearm Plank');
    expect(el.querySelector('[role=timer]')).toBeNull();
    radio(el, '9').click();
    await stable(f);
    expect((await backend.container.logs.getById(draft.id))!.entries[0].rpe).toBe(9);

    button(el, 'Skip set 1')!.click();
    await stable(f);
    expect(text(el.querySelector('h1'))).toBe('Workout complete');
    expect(text(el)).toContain('2 sets in');
  });

  it('skips around: a chip per exercise does it now, and holding one moves it', async () => {
    const exercise = (id: string) => loggableFromCatalog(backend.container.catalog.require(id));
    const squat = exercise('bb-back-squat');
    const plank = exercise('bw-forearm-plank');
    const { f, el } = await render({
      plan: [
        entryOf(squat, { sets: [1, 2].map(() => setLog({ reps: 5, loadKg: 100 })) }),
        entryOf(plank, { sets: [setLog({ seconds: 60 })] }),
      ],
    });
    const [draft] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    const chips = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.chips .chip'));
    expect(chips().map((c) => c.getAttribute('aria-label'))).toEqual([
      `${squat.name}, set 1 of 2`,
      'Forearm Plank, 0 of 1 sets',
    ]);
    expect(chips()[0].getAttribute('aria-current')).toBe('step');

    // Tap the plank: it's next, and the plan keeps its order.
    chips()[1].click();
    await stable(f);
    expect(text(el.querySelector('h1'))).toBe('Forearm Plank, set 1 of 1');
    expect(chips()[1].getAttribute('aria-current')).toBe('step');
    expect(chips()[1].getAttribute('aria-label')).toBe('Forearm Plank, set 1 of 1');
    expect((await backend.container.logs.getById(draft.id))!.plan[0].exerciseId).toBe(squat.id);
    // Once it's done, the plan's order takes over again.
    doneButton(el)!.click();
    await stable(f);
    button(el, 'Skip rest')?.click();
    await stable(f);
    expect(text(el.querySelector('h1'))).toBe(`${squat.name}, set 1 of 2`);
    expect(chips()[1].getAttribute('aria-label')).toBe('Forearm Plank, done');

    // Alt and an arrow (or holding and dragging) moves one.
    chips()[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }),
    );
    await stable(f);
    expect((await backend.container.logs.getById(draft.id))!.plan.map((e) => e.exerciseId)).toEqual(
      [plank.id, squat.id],
    );
  });

  it('starts at the exercise picked on the Plan', async () => {
    const exercise = (id: string) => loggableFromCatalog(backend.container.catalog.require(id));
    const squat = exercise('bb-back-squat');
    const plank = exercise('bw-forearm-plank');
    await backend.container.loggingService.newDraft(DEMO_PEACH_ID, TestBed.inject(AppState).now(), [
      entryOf(squat, { sets: [setLog({ reps: 5, loadKg: 100 })] }),
      entryOf(plank, { sets: [setLog({ seconds: 60 })] }),
    ]);
    const f = TestBed.createComponent(LogPage);
    f.componentRef.setInput('exercise', plank.id);
    await stable(f);
    expect(text(f.nativeElement.querySelector('h1'))).toBe('Forearm Plank, set 1 of 1');
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
    expect(
      el.querySelector('[role=slider][aria-label="Weight in kg"]')?.getAttribute('aria-valuenow'),
    ).toBe('102.5');
    expect(el.querySelector('.target')).toBeNull();

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
    const [latest] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    const { f, el } = await render({ logId: latest.id });
    button(el, 'Add exercise')!.click();
    await stable(f);
    const groups = Array.from(overlay().querySelectorAll('h3.group')).map(text);
    expect(groups).toEqual(['Recent', 'From your Crates', 'All exercises']);
    expect(text(overlay())).toContain('Last time:');
    expect(text(overlay())).toContain('From Ada');
  });

  it('the picker: Enter takes the top match, Escape clears, arrows move through results', async () => {
    const [latest] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    const { f, el } = await render({ logId: latest.id });
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
    // Straight on to its sets.
    expect(text(overlay().querySelector('h2'))).toBe('Bodyweight Squat');
  });

  it('makes up an exercise on the spot', async () => {
    const [latest] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    const { f, el } = await render({ logId: latest.id });
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
    const log = (await backend.container.logs.getById(latest.id))!;
    const rucking = log.entries.find((e) => e.exerciseName === 'Rucking')!;
    expect(rucking).toMatchObject({ track: 'reps', takesLoad: true });
    expect(rucking.exerciseId.startsWith('custom-')).toBe(true);
  });

  it('a finished workout stays editable, time included', async () => {
    const [latest] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    const { f, el } = await render({ logId: latest.id });
    expect(text(el.querySelector('h1'))).toBe('Mon, Oct 12');
    expect(text(el)).toContain(latest.entries[0].exerciseName);
    // The same tiles as the week's stats, with how long it took first.
    const tiles = Array.from(el.querySelectorAll('pch-stat-tiles .label')).map(text);
    expect(tiles[0]).toBe('Session time');
    expect(el.querySelector('.clock')).toBeNull();
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
    expect(toast).toHaveBeenCalledWith('Deleted Mon, Oct 12’s workout.', expect.any(Function));
    toast.mock.calls[0][1]!();
    await stable(f);
    expect((await backend.container.logs.getById(latest.id))?.entries).toEqual(latest.entries);
  });

  it('says when a workout does not exist', async () => {
    const { el } = await render({ logId: 'nope' });
    expect(text(el)).toContain('Workout not found');
  });

  it('opening the runner straight from a link starts the clock', async () => {
    const squat = loggableFromCatalog(backend.container.catalog.require('bb-back-squat'));
    const fresh = await backend.container.loggingService.newDraft(
      DEMO_PEACH_ID,
      TestBed.inject(AppState).now(),
    );
    await backend.container.loggingService.planExercise(
      fresh.id,
      entryOf(squat, { sets: [setLog({ reps: 5, loadKg: 100 })] }),
    );
    // Planned, not started.
    expect(fresh.timerStartedAt).toBeNull();
    const { el } = await render({ mode: 'log', launched: false });
    expect(text(el.querySelector('h1'))).toBe(`${squat.name}, set 1 of 1`);
    expect((await backend.container.logs.getById(fresh.id))!.timerStartedAt).not.toBeNull();
  });

  it('with nothing launched, says every workout starts from the plan', async () => {
    const { el } = await render({ launched: false });
    expect(text(el.querySelector('pch-empty-state'))).toContain('Nothing under way');
    expect(text(el.querySelector('pch-empty-state'))).toContain(
      'Every workout starts from your plan',
    );
    // The Plan tab is the way there; no second link to it.
    expect(el.querySelector('a[href="/"]')).toBeNull();
    expect(await backend.container.loggingService.currentLog(DEMO_PEACH_ID)).toBeNull();
  });
});
