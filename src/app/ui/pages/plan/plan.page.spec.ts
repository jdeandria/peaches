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
    // A done workout opens what was logged; a planned one, the planner.
    const links = Array.from(el.querySelectorAll('li.day a.text')).map((a) =>
      a.getAttribute('href'),
    );
    expect(links[0]).toMatch(/^\/log\//);
    expect(links[1]).toMatch(/^\/plan\/2026-10-12\//);
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
    const add = el.querySelector('li.day a.add')!;
    expect(add.getAttribute('href')).toBe('/plan/2026-10-12/new?day=2026-10-12');
  });
});
