import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { localDate } from '../../../domain/core/local-date';
import { AppState } from '../../../state/app-state';
import { FIXED_NOW, seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { PlanPage } from './plan.page';

@Component({ template: '' })
class Blank {}

describe('PlanPage', () => {
  let backend: TestBackend;
  const thisMonday = localDate(2026, 10, 12);
  const nextMonday = localDate(2026, 10, 19);

  async function render(
    options: { week?: string; seed?: boolean } = {},
  ): Promise<ComponentFixture<PlanPage>> {
    backend = await seededBackend({
      seed: options.seed,
      routes: [{ path: '**', component: Blank }],
    });
    TestBed.configureTestingModule({
      providers: [
        ...backend.providers,
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    const f = TestBed.createComponent(PlanPage);
    if (options.week) f.componentRef.setInput('week', options.week);
    await stable(f);
    return f;
  }

  async function stable(f: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await settle();
      await f.whenStable();
    }
  }

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
  const button = (el: HTMLElement, label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => text(b)?.includes(label) || b.getAttribute('aria-label')?.includes(label),
    );
  /** The matchup cards: the same card the Crate and the matchup itself show. */
  const cards = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('pch-matchup-card')).map((c) => ({
      crate: text(c.querySelector('.meta')),
      when: text(c.querySelector('.pill')),
      sides: Array.from(c.querySelectorAll('.side')).map((s) =>
        [
          text(s.querySelector('.name')),
          text(s.querySelector('.value .pch-visually-hidden')),
          text(s.querySelector('.caption')),
        ].join(' | '),
      ),
      headline: text(c.querySelector('.headline')),
      href: c.querySelector('a')?.getAttribute('href'),
    }));
  const days = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('li.day')).map((d) => ({
      label: text(d.querySelector('h3')),
      today: d.classList.contains('today'),
      workouts: Array.from(d.querySelectorAll<HTMLElement>('pch-workout-card')).map((w) => ({
        state: w.getAttribute('data-state'),
        name: text(w.querySelector('.toggle .name')),
        open: w.querySelector('.toggle')?.getAttribute('aria-expanded') === 'true',
      })),
    }));
  /** A workout card by name (the last of that name: Saturday's repeats Monday's). */
  const card = (el: HTMLElement, name: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('pch-workout-card'))
      .filter((c) => text(c.querySelector('.toggle .name')) === name)
      .at(-1)!;
  const exercises = (c: HTMLElement) =>
    Array.from(c.querySelectorAll('.exercise .text > :first-child')).map(text);
  const overlay = () => document.querySelector<HTMLElement>('.cdk-overlay-container')!;
  const picker = () => overlay().querySelector<HTMLElement>('pch-exercise-picker-sheet');
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  /** Picks an exercise in the open picker by searching for it. */
  async function pickExercise(f: ComponentFixture<unknown>, search: string, name: string) {
    type(picker()!.querySelector<HTMLInputElement>('input[type=search]')!, search);
    await stable(f);
    Array.from(picker()!.querySelectorAll<HTMLButtonElement>('button.row'))
      .find((b) => text(b.querySelector('.pch-body-large')) === name)!
      .click();
    await settle(400);
    await stable(f);
  }
  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('this week: how it’s going, the matchup against what was committed, and each day', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Plan');
    // How the week is going sits in the subtitle, not a card of its own.
    expect(text(el.querySelector('.subtitle'))).toBe('Oct 12 – 18 · 1 of 4 done');
    expect(el.querySelector('.refresh, [aria-label="Refresh"]')).toBeNull();

    // Plans are locked in: the live score, each side's points against what they committed to.
    const [warriors] = cards(el);
    expect(warriors.crate).toBe('Weekend Warriors');
    expect(warriors.when).toBe('Ends in 6 d');
    expect(warriors.sides).toEqual([
      'You | 19.5 | 47.8 of 104.5 planned',
      'Cho | −39.5 | 0 of 79.0 planned',
    ]);
    expect(warriors.headline).toBe('56.7 to go to hit your plan');
    expect(warriors.href).toMatch(/^\/matchups\//);
    expect(text(el)).toContain('Lunch Break Lifters: no matchup this week.');

    // Monday's workout is done; the rest are planned, each a row that opens to its exercises.
    const week = days(el);
    expect(week.map((d) => d.label)).toEqual([
      'Mon, Oct 12',
      'Tue, Oct 13',
      'Wed, Oct 14',
      'Thu, Oct 15',
      'Fri, Oct 16',
      'Sat, Oct 17',
      'Sun, Oct 18',
    ]);
    expect(week[0].today).toBe(true);
    expect(week[0].workouts).toEqual([{ state: 'done', name: expect.any(String), open: false }]);
    expect(week[2].workouts.map((w) => [w.state, w.open])).toEqual([['planned', false]]);
    expect(week[1].workouts).toEqual([]);
    // A workout to do this week leads with play, open or not; a done one with its tick.
    expect(button(el, 'Start workout: Run')).toBeDefined();
    const monday = el.querySelector('li.day pch-workout-card')!;
    expect(monday.querySelector('button.start')).toBeNull();
    expect(monday.querySelector('pch-shaped-avatar')).not.toBeNull();
    // Everything happens here: no separate planner to go to.
    expect(el.querySelector('a[href^="/plan/"]')).toBeNull();
    expect(el.querySelectorAll('.exercise')).toHaveLength(0);
  });

  it('starts a workout from its row without opening it', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const run = card(el, 'Run');
    expect(run.querySelector('.toggle')?.getAttribute('aria-expanded')).toBe('false');
    button(run, 'Start workout: Run')!.click();
    await stable(f);
    expect(TestBed.inject(Router).url).toBe('/log?mode=log');
    const plan = await backend.container.plans.get(DEMO_PEACH_ID, thisMonday);
    expect(plan!.workouts.find((w) => w.name === 'Run')!.logId).not.toBeNull();
  });

  it('opens a workout to its exercises, and starts it at any of them', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const saturday = card(el, 'Goblet Squat & more');
    saturday.querySelector<HTMLButtonElement>('.toggle')!.click();
    await stable(f);
    expect(saturday.querySelector('.toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(exercises(saturday)).toEqual(['Goblet Squat', 'Dumbbell Bench Press', 'Forearm Plank']);

    // Start at the second: the runner does it now; the plan keeps its order.
    button(saturday, 'Start Dumbbell Bench Press')!.click();
    await stable(f);
    const plan = await backend.container.plans.get(DEMO_PEACH_ID, thisMonday);
    const launched = plan!.workouts.find((w) => w.day === localDate(2026, 10, 17))!;
    const bench = launched.exercises[1].exerciseId;
    expect(TestBed.inject(Router).url).toBe(`/log?mode=log&exercise=${bench}`);
    const log = await backend.container.logs.getById(launched.logId!);
    expect(log?.plan.map((e) => e.exerciseName)).toEqual([
      'Goblet Squat',
      'Dumbbell Bench Press',
      'Forearm Plank',
    ]);

    // Back on the Plan it's open, with how far along each exercise is.
    await backend.container.loggingService.logSet(
      log!.id,
      log!.plan[0].exerciseId,
      log!.plan[0].sets[0],
      FIXED_NOW,
    );
    TestBed.inject(AppState).bump();
    await stable(f);
    const going = card(el, 'Goblet Squat & more');
    expect(going.getAttribute('data-state')).toBe('going');
    expect(going.querySelector('.toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(text(going.querySelector('.count'))).toBe('1/3');
    // Its row carries on with it, open or closed.
    expect(button(going, 'Continue workout: Goblet Squat & more')).toBeDefined();
    expect(button(going, 'Start Goblet Squat')).toBeDefined();
  });

  it('plans a workout on a day from one exercise, without asking for numbers', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    button(el, 'Plan a workout on Tue, Oct 13')!.click();
    await stable(f);
    // An empty day starts from a whole workout, or one exercise.
    const groups = Array.from(picker()!.querySelectorAll('h3.group')).map(text);
    expect(groups.slice(0, 3)).toEqual(['Your routines', 'From your Crates', 'Templates']);
    await pickExercise(f, 'push up', 'Push Up');
    // No dials: the sets are last time's, or a sensible start, turned when they're done.
    expect(overlay().querySelector('[role=slider]')).toBeNull();
    const plan = await backend.container.plans.get(DEMO_PEACH_ID, thisMonday);
    const tuesday = plan!.workouts.filter((w) => w.day === localDate(2026, 10, 13));
    expect(tuesday).toHaveLength(1);
    expect(tuesday[0].name).toBe('Push Up');
    expect(tuesday[0].exercises[0].sets.length).toBeGreaterThan(0);
    // It opens, ready to start.
    const added = card(el, 'Push Up');
    expect(added.querySelector('.toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(button(added, 'Start Push Up')).toBeDefined();
  });

  it('starts a day’s workout from a routine', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    button(el, 'Plan a workout on Thu, Oct 15')!.click();
    await stable(f);
    Array.from(picker()!.querySelectorAll<HTMLButtonElement>('li.starter button.row'))
      .find((b) => text(b)?.startsWith('Swing day'))!
      .click();
    await settle(400);
    await stable(f);
    expect(exercises(card(el, 'Swing day'))).toEqual(['Kettlebell Swing', 'Push Up']);
  });

  it('sets an exercise’s sets, reps and weight with − and +, saved after the last tap', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const saturday = card(el, 'Goblet Squat & more');
    saturday.querySelector<HTMLButtonElement>('.toggle')!.click();
    await stable(f);
    const squat = async () =>
      (await backend.container.plans.get(DEMO_PEACH_ID, thisMonday))!.workouts.find(
        (w) => w.day === localDate(2026, 10, 17),
      )!.exercises[0];
    const before = await squat();
    const load = before.sets[0].loadKg!;

    // Tapping an exercise opens its numbers: steppers, not dials.
    const edit = saturday.querySelector<HTMLButtonElement>('button.edit')!;
    edit.click();
    await stable(f);
    expect(edit.getAttribute('aria-expanded')).toBe('true');
    expect(saturday.querySelectorAll('pch-stepper')).toHaveLength(3);
    expect(saturday.querySelector('[role=slider]')).toBeNull();
    const steppers = Array.from(saturday.querySelectorAll('pch-stepper')).map((x) =>
      text(x.querySelector('.label')),
    );
    expect(steppers).toEqual(['Sets', 'Reps', 'Weight']);

    for (const label of ['More sets', 'More weight', 'More weight']) {
      button(saturday, label)!.click();
      TestBed.tick();
    }
    await stable(f);
    // Shown at once, saved a moment after the last tap (once, not per tap).
    expect(text(saturday.querySelector('.exercise .text .muted'))).toContain('4 sets');
    expect((await squat()).sets).toHaveLength(before.sets.length);
    await settle(700);
    await stable(f);
    const after = await squat();
    expect(after.sets).toHaveLength(before.sets.length + 1);
    expect(after.sets.map((s) => s.loadKg)).toEqual(after.sets.map(() => load + 5));
    expect(after.sets.map((s) => s.reps)).toEqual([
      ...before.sets.map((s) => s.reps),
      before.sets.at(-1)!.reps,
    ]);

    // Tapping it again closes it.
    saturday.querySelector<HTMLButtonElement>('button.edit')!.click();
    await stable(f);
    expect(saturday.querySelectorAll('pch-stepper')).toHaveLength(0);
  });

  it('adds, removes (with Undo) and reorders a workout’s exercises, saved as they go', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const toast = vi.spyOn(TestBed.inject(AppState), 'toast').mockImplementation(() => undefined);
    card(el, 'Goblet Squat & more').querySelector<HTMLButtonElement>('.toggle')!.click();
    await stable(f);
    const saved = async () =>
      (await backend.container.plans.get(DEMO_PEACH_ID, thisMonday))!.workouts
        .find((w) => w.day === localDate(2026, 10, 17))!
        .exercises.map((e) => e.exerciseName);

    // A workout with exercises adds one at a time: no whole workouts offered.
    button(card(el, 'Goblet Squat & more'), 'Add exercise')!.click();
    await stable(f);
    expect(picker()!.querySelectorAll('li.starter')).toHaveLength(0);
    await pickExercise(f, 'push up', 'Push Up');
    expect(await saved()).toEqual([
      'Goblet Squat',
      'Dumbbell Bench Press',
      'Forearm Plank',
      'Push Up',
    ]);
    expect(exercises(card(el, 'Goblet Squat & more'))).toHaveLength(4);

    button(card(el, 'Goblet Squat & more'), 'Remove Forearm Plank')!.click();
    await stable(f);
    expect(await saved()).toEqual(['Goblet Squat', 'Dumbbell Bench Press', 'Push Up']);
    toast.mock.calls.find(([m]) => m === 'Removed Forearm Plank.')![1]!();
    await stable(f);
    // Back where it was.
    expect(await saved()).toEqual([
      'Goblet Squat',
      'Dumbbell Bench Press',
      'Forearm Plank',
      'Push Up',
    ]);

    // Alt and an arrow moves one (held and dragged on a touch screen).
    card(el, 'Goblet Squat & more')
      .querySelector('pch-swipe-row')!
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
      );
    await stable(f);
    expect((await saved()).slice(0, 2)).toEqual(['Dumbbell Bench Press', 'Goblet Squat']);
  });

  it('the menu moves a workout to another day, or takes it off the plan with Undo', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const toast = vi.spyOn(TestBed.inject(AppState), 'toast');
    const menuItem = (label: string) =>
      Array.from(overlay().querySelectorAll<HTMLButtonElement>('[mat-menu-item]')).find(
        (b) => text(b) === label,
      )!;
    card(el, 'Run').querySelector<HTMLButtonElement>('.toggle')!.click();
    await stable(f);
    button(card(el, 'Run'), 'More for Run')!.click();
    await stable(f);
    menuItem('Move to').click();
    await stable(f);
    menuItem('Thu, Oct 15').click();
    await stable(f);
    expect(days(el)[3].workouts.map((w) => w.name)).toEqual(['Run']);
    expect(days(el)[2].workouts).toEqual([]);

    button(card(el, 'Run'), 'More for Run')!.click();
    await stable(f);
    menuItem('Take off the plan').click();
    await stable(f);
    expect(days(el)[3].workouts).toEqual([]);
    expect(toast).toHaveBeenCalledWith('Took “Run” off Thu, Oct 15.', expect.any(Function));
    (toast.mock.calls.at(-1)![1] as () => void)();
    await stable(f);
    expect(days(el)[3].workouts).toHaveLength(1);
  });

  it('next week: plans race the opponent’s until the week locks', async () => {
    const f = await render({ week: 'next' });
    const el: HTMLElement = f.nativeElement;
    // An empty week says nothing more than its dates, with a way to repeat the week before.
    expect(text(el.querySelector('.subtitle'))).toBe('Oct 19 – 25');
    const [warriors, lifters] = cards(el);
    // A bye in one Crate; in the other, Cho has planned and I haven't.
    expect(warriors.crate).toBe('Weekend Warriors');
    expect(warriors.sides).toHaveLength(1);
    expect(warriors.headline).toBe('Bye week: your plan still earns its bonus');
    expect(lifters.crate).toBe('Lunch Break Lifters');
    expect(lifters.sides[0]).toBe('You | 0 | Nothing planned yet');
    expect(lifters.headline).toMatch(/^Plan [\d.]+ more to match Cho$/);
    expect(lifters.when).toBe('Locks in 6 d');
    // Nothing starts before its week.
    expect(el.querySelector('button.play, button.start')).toBeNull();

    // Repeating this week plans the same weekdays, and the plan's points go up.
    button(el, 'Repeat this week')!.click();
    await stable(f);
    const plan = await backend.container.plans.get(DEMO_PEACH_ID, nextMonday);
    expect(plan?.workouts.map((w) => w.day)).toEqual([
      '2026-10-19',
      '2026-10-21',
      '2026-10-23',
      '2026-10-24',
    ]);
    expect(text(el.querySelector('.subtitle'))).toBe('Oct 19 – 25 · 4 workouts planned');
    const after = cards(el)[1];
    expect(after.sides[0]).toMatch(/^You \| [\d.]+ \| Planned so far$/);
    expect(after.sides[0]).not.toMatch(/^You \| 0 /);
  });

  it('without a Crate it’s just for you', async () => {
    const f = await render({ seed: false });
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('pch-matchup-card')).toBeNull();
    expect(text(el)).toContain('Just for you.');
    expect(text(el.querySelector('.subtitle'))).toBe('Oct 12 – 18');
    expect(button(el, 'Repeat last week')).toBeUndefined();
    expect(button(el, 'Plan a workout on Mon, Oct 12')).toBeDefined();
  });
});
