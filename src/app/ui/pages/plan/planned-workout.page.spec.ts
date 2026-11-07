import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { AppState } from '../../../state/app-state';
import { localDate } from '../../../domain/core/local-date';
import { seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { PlannedWorkoutPage } from './planned-workout.page';

@Component({ template: '' })
class Blank {}

describe('PlannedWorkoutPage', () => {
  let backend: TestBackend;
  const thisMonday = localDate(2026, 10, 12);
  const nextMonday = localDate(2026, 10, 19);

  async function render(
    inputs: { week: string; workoutId: string; day?: string },
    setUp?: (b: TestBackend) => Promise<void>,
  ): Promise<ComponentFixture<PlannedWorkoutPage>> {
    backend = await seededBackend({ routes: [{ path: '**', component: Blank }] });
    await setUp?.(backend);
    TestBed.configureTestingModule({
      providers: [
        ...backend.providers,
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    const f = TestBed.createComponent(PlannedWorkoutPage);
    f.componentRef.setInput('week', inputs.week);
    f.componentRef.setInput('workoutId', inputs.workoutId);
    if (inputs.day) f.componentRef.setInput('day', inputs.day);
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
  afterEach(() => TestBed.inject(MatDialog).closeAll());

  const overlay = () => document.querySelector<HTMLElement>('.cdk-overlay-container')!;
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const names = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.item.clickable .pch-title-medium')).map(text);
  const checkedDay = (el: HTMLElement) =>
    text(el.querySelector('pch-button-group.days [role=radio][aria-checked=true]'));
  const nameInput = (el: HTMLElement) => el.querySelector<HTMLInputElement>('h1 input.name-input')!;
  const pressed = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.chips .chip[aria-pressed=true]')).map(text);

  /** Opens the exercise picker, where whole workouts to start from are listed first. */
  async function openPicker(f: ComponentFixture<unknown>, el: HTMLElement): Promise<HTMLElement> {
    button(el, 'Add exercise')!.click();
    await stable(f);
    return overlay().querySelector<HTMLElement>('pch-exercise-picker-sheet')!;
  }
  /** The picker's whole workouts: group, name, tag and summary. */
  const starters = (picker: HTMLElement) =>
    Array.from(picker.querySelectorAll<HTMLElement>('li.starter')).map((li) => ({
      group: text(li.closest('ul')?.previousElementSibling),
      name: li.querySelector('.text .pch-body-large')?.firstChild?.textContent?.trim(),
      tag: text(li.querySelector('.tag')),
      summary: text(li.querySelector('.text .muted')),
      use: li.querySelector<HTMLButtonElement>('button.row')!,
    }));
  /** Plans a whole workout from the picker, by group and name. */
  async function startFrom(
    f: ComponentFixture<unknown>,
    el: HTMLElement,
    group: string,
    name?: string,
  ): Promise<void> {
    const picker = await openPicker(f, el);
    const pick = starters(picker).find((w) => w.group === group && (!name || w.name === name))!;
    pick.use.click();
    await settle(400);
    await stable(f);
  }

  it('plans a new workout from a template, on the day asked for', async () => {
    const f = await render({ week: nextMonday, workoutId: 'new', day: '2026-10-21' });
    const el: HTMLElement = f.nativeElement;
    // The headline is the name, to type in place; the day is the one asked for.
    expect(nameInput(el).placeholder).toBe('New workout');
    expect(text(el.querySelector('.subtitle'))).toBe('Wednesday, October 21');
    expect(el.querySelector('pch-button-group.days')).toBeNull();
    // No places set up: no Where to choose, and no second way into the Gear settings.
    expect(el.querySelector('.chips')).toBeNull();
    expect(el.querySelector('a[href*="equipment"]')).toBeNull();
    expect(button(el, 'Add to plan')!.disabled).toBe(true);
    // One way to add exercises: routines and templates are in the picker, not on the page.
    expect(el.querySelectorAll('button.add')).toHaveLength(1);
    expect(el.querySelector('.templates, .routine-use')).toBeNull();

    await startFrom(f, el, 'Templates', 'Full body');
    expect(el.querySelectorAll('pch-swipe-row .item.clickable').length).toBeGreaterThan(0);
    // What it's worth in each Crate with a Season on.
    expect(text(el.querySelector('.worth'))).toMatch(/^Worth [\d.]+ pts in Lunch Break Lifters/);

    button(el, 'Add to plan')!.click();
    await stable(f);
    const plan = await backend.container.plans.get(DEMO_PEACH_ID, nextMonday);
    expect(plan?.workouts).toHaveLength(1);
    expect(plan!.workouts[0]).toMatchObject({ day: '2026-10-21', name: 'Full body' });
    expect(TestBed.inject(Router).url).toBe('/?week=next');
  });

  it('puts the exercises in another order', async () => {
    const f = await render({ week: nextMonday, workoutId: 'new', day: '2026-10-21' });
    const el: HTMLElement = f.nativeElement;
    await startFrom(f, el, 'Templates', 'Full body');
    const before = names(el).map((n) => n ?? '');
    expect(before.length).toBeGreaterThan(1);
    const remove = (name: string) => button(el, `Remove ${name}`)!;
    const alt = (target: HTMLElement, key: string) =>
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key, altKey: true, bubbles: true, cancelable: true }),
      );

    const last = before.at(-1)!;
    remove(last).focus();
    alt(remove(last), 'ArrowUp');
    await stable(f);
    const moved = [...before.slice(0, -2), last, before.at(-2)!];
    expect(names(el)).toEqual(moved);
    expect(document.activeElement).toBe(remove(last));

    button(el, 'Add to plan')!.click();
    await stable(f);
    const plan = await backend.container.plans.get(DEMO_PEACH_ID, nextMonday);
    expect(plan!.workouts[0].exercises.map((e) => e.exerciseName)).toEqual(moved);
  });

  it('moves a planned workout to another day, keeping what was done', async () => {
    const plan = (b: TestBackend) => b.container.plans.get(DEMO_PEACH_ID, thisMonday);
    let id = '';
    const f = await render({ week: thisMonday, workoutId: 'pending' }, async (b) => {
      id = (await plan(b))!.workouts[0].id;
    });
    f.componentRef.setInput('workoutId', id);
    await stable(f);
    const el: HTMLElement = f.nativeElement;
    // Monday's is done already.
    expect(text(el.querySelector('.done'))).toContain('Done.');
    expect(checkedDay(el)).toBe('Mon');
    const tuesday = Array.from(
      el.querySelectorAll<HTMLButtonElement>('pch-button-group.days [role=radio]'),
    ).find((b) => text(b) === 'Tue')!;
    tuesday.click();
    await stable(f);
    el.querySelector<HTMLButtonElement>('button.submit')!.click();
    await stable(f);
    const moved = (await plan(backend))!.workouts.find((w) => w.id === id)!;
    expect(moved.day).toBe('2026-10-13');
    expect(moved.logId).not.toBeNull();
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('plans for a location: its equipment is picked by default', async () => {
    const f = await render({ week: nextMonday, workoutId: 'new' }, async (b) => {
      const me = (await b.container.peaches.getById(DEMO_PEACH_ID))!;
      await b.container.peaches.save({
        ...me,
        locations: [{ id: 'home', name: 'Home', equipment: ['dumbbell', 'bench'] }],
      });
    });
    const el: HTMLElement = f.nativeElement;
    expect(pressed(el)).toEqual(['Home']);
    // Gym templates make do with what's at home; none comes out empty.
    const templates = starters(await openPicker(f, el)).filter((w) => w.group === 'Templates');
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((t) => !t.summary?.startsWith('0 exercises'))).toBe(true);
  });

  it('a workout that isn’t in the plan says so', async () => {
    const f = await render({ week: thisMonday, workoutId: 'nope' });
    expect(text(f.nativeElement.querySelector('pch-empty-state'))).toContain(
      'That workout isn’t in your plan',
    );
  });

  it('starts from a routine, keeps exercises as a routine, and deletes one with Undo', async () => {
    const f = await render({ week: nextMonday, workoutId: 'new' });
    const toast = vi.spyOn(TestBed.inject(AppState), 'toast').mockImplementation(() => undefined);
    const el: HTMLElement = f.nativeElement;
    const picker = await openPicker(f, el);
    const routines = () =>
      starters(picker)
        .filter((w) => w.group === 'Your routines')
        .map((w) => w.name);
    expect(routines()).toEqual(['Full body', 'Swing day']);
    button(picker, 'Delete routine Swing day')!.click();
    await stable(f);
    expect(routines()).toEqual(['Full body']);
    expect((await backend.container.routines.forPeach(DEMO_PEACH_ID)).map((r) => r.name)).toEqual([
      'Full body',
    ]);
    toast.mock.calls.find(([m]) => m === 'Deleted “Swing day”.')![1]!();
    await stable(f);
    expect((await backend.container.routines.forPeach(DEMO_PEACH_ID)).map((r) => r.name)).toEqual([
      'Full body',
      'Swing day',
    ]);
    starters(picker)
      .find((w) => w.name === 'Full body')!
      .use.click();
    await settle(400);
    await stable(f);
    expect(names(el)).toEqual([
      'Goblet Squat',
      'Dumbbell Bench Press',
      'Dumbbell Bent Over Row',
      'Forearm Plank',
    ]);
    // The routine names the workout.
    expect(nameInput(el).value).toBe('Full body');
    // Typed over in place, it names the page.
    type(nameInput(el), 'Upper & lower');
    await stable(f);
    expect(nameInput(el).value).toBe('Upper & lower');

    button(el, 'Save as routine')!.click();
    await stable(f);
    const name = overlay().querySelector<HTMLInputElement>('mat-dialog-content input')!;
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
    expect(toast).toHaveBeenCalledWith('Saved “Upper & lower”.');
  });

  it('offers routines, then crate-mates’ workouts, then templates, only while it’s empty', async () => {
    const f = await render({ week: nextMonday, workoutId: 'new' });
    const el: HTMLElement = f.nativeElement;
    const all = starters(await openPicker(f, el));
    const groups = [...new Set(all.map((w) => w.group))];
    expect(groups).toEqual(['Your routines', 'From your Crates', 'Templates']);
    // Crate-mates' workouts are tagged with who did them; templates with the kit they need.
    const crate = all.filter((w) => w.group === 'From your Crates');
    expect(crate.length).toBeGreaterThan(0);
    expect(crate.every((w) => /^[A-Z]\w+$/.test(w.tag ?? ''))).toBe(true);
    const template = (name: string) => all.find((w) => w.group === 'Templates' && w.name === name)!;
    expect(template('Full body').tag).toBe('Dumbbells');
    expect(template('Easy run').summary).toMatch(/1 exercise · (Run|Easy Jog)/);

    crate[0].use.click();
    await settle(400);
    await stable(f);
    expect(names(el).length).toBeGreaterThan(0);
    expect(nameInput(el).value).not.toBe('');
    // Once it has exercises, the picker is for exercises only.
    const picker = await openPicker(f, el);
    expect(starters(picker)).toHaveLength(0);
  });

  it('starts from a template', async () => {
    const f = await render({ week: nextMonday, workoutId: 'new' });
    const el: HTMLElement = f.nativeElement;
    await startFrom(f, el, 'Templates', 'Upper body');
    expect(names(el)).toHaveLength(5);
    expect(nameInput(el).value).toBe('Upper body');
  });

  it('a workout for today can be added and started at once', async () => {
    const f = await render({ week: thisMonday, workoutId: 'new', day: '2026-10-12' });
    const el: HTMLElement = f.nativeElement;
    await startFrom(f, el, 'Templates', 'Full body');
    button(el, 'Add and start')!.click();
    await stable(f);
    expect(TestBed.inject(Router).url).toBe('/log?mode=log');
    const plan = await backend.container.plans.get(DEMO_PEACH_ID, thisMonday);
    const added = plan!.workouts.find((w) => w.name === 'Full body')!;
    expect(added.day).toBe('2026-10-12');
    const log = await backend.container.logs.getById(added.logId!);
    expect(log?.plan).toHaveLength(added.exercises.length);
  });

  it('only today’s workouts start from the planner', async () => {
    const f = await render({ week: nextMonday, workoutId: 'new' });
    const el: HTMLElement = f.nativeElement;
    await startFrom(f, el, 'Templates', 'Full body');
    expect(button(el, 'Add and start')).toBeUndefined();
  });
});
