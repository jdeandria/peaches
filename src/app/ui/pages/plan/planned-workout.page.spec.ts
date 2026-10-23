import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
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
    TestBed.configureTestingModule({ providers: backend.providers });
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
  const checkedDay = (el: HTMLElement) =>
    text(el.querySelector('pch-button-group.days [role=radio][aria-checked=true]'));
  const pressed = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.chips .chip[aria-pressed=true]')).map(text);

  it('plans a new workout from a template, on the day asked for', async () => {
    const f = await render({ week: nextMonday, workoutId: 'new', day: '2026-10-21' });
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Plan a workout');
    expect(text(el.querySelector('.subtitle'))).toBe('Oct 19 – 25');
    expect(checkedDay(el)).toBe('Wed');
    expect(pressed(el)).toEqual(['Anywhere']);
    expect(button(el, 'Add to plan')!.disabled).toBe(true);

    el.querySelector<HTMLButtonElement>('button.template-use')!.click();
    await stable(f);
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
    const templates = Array.from(el.querySelectorAll('button.template-use')).map(text);
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((t) => !t?.includes('0 exercises'))).toBe(true);
  });

  it('a workout that isn’t in the plan says so', async () => {
    const f = await render({ week: thisMonday, workoutId: 'nope' });
    expect(text(f.nativeElement.querySelector('pch-empty-state'))).toContain(
      'That workout isn’t in your plan',
    );
  });
});
