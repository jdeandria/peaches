import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { localDate } from '../../../domain/core/local-date';
import { AppState } from '../../../state/app-state';
import { seededBackend, settle, TestBackend } from '../../../../testing/test-app';
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
    TestBed.configureTestingModule({ providers: backend.providers });
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
  const strips = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('a.strip')).map((s) => ({
      head: [
        text(s.querySelector('.strip-head .pch-title-small')),
        text(s.querySelector('.strip-head .muted')),
      ].join(' · '),
      bars: Array.from(s.querySelectorAll('.bar-row')).map(text),
      headline: text(s.querySelector('.headline')),
      href: s.getAttribute('href'),
    }));
  const days = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('li.day')).map((d) => ({
      label: text(d.querySelector('h3')),
      today: d.classList.contains('today'),
      workouts: Array.from(d.querySelectorAll('.workout')).map((w) => ({
        state: w.getAttribute('data-state'),
        name: text(w.querySelector('.text .pch-title-medium')),
        launch: !!w.querySelector('button.launch'),
      })),
    }));

  it('this week: how it’s going, the matchup against what was committed, and each day', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Plan');
    expect(text(el.querySelector('.subtitle'))).toBe('Oct 12 – 18');
    expect(text(el.querySelector('.summary h2'))).toBe('1 of 4 workouts done');

    // Plans are locked in: each side's points against what they committed to.
    const [warriors] = strips(el);
    expect(warriors.head).toBe('Weekend Warriors · vs Cho');
    expect(warriors.bars).toEqual(['You 51.2 / 104.5', 'Cho 0 / 79.0']);
    expect(warriors.headline).toBe('53.3 to go to hit your plan');
    expect(warriors.href).toMatch(/^\/matchups\//);
    expect(text(el)).toContain('Lunch Break Lifters: no matchup this week.');

    // Monday's workout is done; the rest launch from the plan.
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
    expect(week[0].workouts).toEqual([{ state: 'done', name: expect.any(String), launch: false }]);
    expect(week[2].workouts.map((w) => [w.state, w.launch])).toEqual([['planned', true]]);
    expect(week[1].workouts).toEqual([]);
  });

  it('launches a planned workout straight into the log', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const wednesday = el.querySelectorAll('li.day')[2];
    wednesday.querySelector<HTMLButtonElement>('button.launch')!.click();
    await stable(f);
    expect(TestBed.inject(Router).url).toBe('/log?mode=log');
    const plan = await backend.container.plans.get(DEMO_PEACH_ID, thisMonday);
    const launched = plan!.workouts.find((w) => w.day === localDate(2026, 10, 14))!;
    const log = await backend.container.logs.getById(launched.logId!);
    expect(log?.plan.map((e) => e.exerciseId)).toEqual(launched.exercises.map((e) => e.exerciseId));
  });

  it('takes a workout off the plan, with Undo', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const toast = vi.spyOn(TestBed.inject(AppState), 'toast');
    const wednesday = el.querySelectorAll('li.day')[2];
    const name = text(wednesday.querySelector('.text .pch-title-medium'))!;
    button(wednesday as HTMLElement, 'off the plan')!.click();
    await stable(f);
    expect(days(el)[2].workouts).toEqual([]);
    expect(toast).toHaveBeenCalledWith(`Took “${name}” off Wed, Oct 14.`, expect.any(Function));
    (toast.mock.calls.at(-1)![1] as () => void)();
    await stable(f);
    expect(days(el)[2].workouts).toHaveLength(1);
  });

  it('next week: plans race the opponent’s until the week locks', async () => {
    const f = await render({ week: 'next' });
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('.subtitle'))).toBe('Oct 19 – 25');
    expect(text(el.querySelector('.summary h2'))).toBe('Plan next week');
    const [warriors, lifters] = strips(el);
    // A bye in one Crate; in the other, Cho has planned and I haven't.
    expect(warriors.head).toBe('Weekend Warriors · Bye');
    expect(lifters.head).toBe('Lunch Break Lifters · vs Cho');
    expect(lifters.bars[0]).toBe('You 0');
    expect(lifters.headline).toMatch(/^Plan [\d.]+ more to match Cho$/);
    expect(text(el.querySelector('a.strip .strip-foot'))).toContain('Locks in 6 d');
    // Nothing launches before its week.
    expect(el.querySelector('button.launch')).toBeNull();

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
    expect(text(el.querySelector('.summary h2'))).toBe('4 workouts planned');
    const after = strips(el)[1];
    expect(after.bars[0]).not.toBe('You 0');
  });

  it('without a Crate it’s just for you', async () => {
    const f = await render({ seed: false });
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('a.strip')).toBeNull();
    expect(text(el)).toContain('Just for you.');
    expect(text(el.querySelector('.summary h2'))).toBe('Nothing planned this week');
    const add = el.querySelector('li.day a.add')!;
    expect(add.getAttribute('href')).toBe('/plan/2026-10-12/new?day=2026-10-12');
  });
});
