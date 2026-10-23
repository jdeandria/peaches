import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Router } from '@angular/router';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { AppState } from '../../../state/app-state';
import { exerciseLogEntry, setLog } from '../../../domain/models/workout-log';
import { FIXED_NOW, seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { TodayPage } from './today.page';

@Component({ template: '' })
class Blank {}

describe('TodayPage', () => {
  let backend: TestBackend;

  async function render(options: { seed?: boolean } = {}): Promise<ComponentFixture<TodayPage>> {
    backend = await seededBackend({ ...options, routes: [{ path: '**', component: Blank }] });
    TestBed.configureTestingModule({ providers: backend.providers });
    const f = TestBed.createComponent(TodayPage);
    await stable(f);
    return f;
  }

  async function stable(f: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await settle();
      await f.whenStable();
    }
  }

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();

  it('leads with logging, then this week’s matchup as a hero card', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Today');
    expect(text(el.querySelector('.subtitle'))).toBe('Monday, October 12');
    const sections = Array.from(el.querySelectorAll('pch-section h2')).map(text);
    expect(sections).toEqual(['This week', 'Coming up', 'Your workouts']);

    const log = el.querySelector('pch-card.log')!;
    expect(text(log.querySelector('h2'))).toBe('Log a workout');
    expect(log.querySelector('a')?.getAttribute('href')).toBe('/log');
    expect(text(log.querySelector('a'))).toBe('play_arrow Start');

    const heroes = el.querySelectorAll('pch-matchup-hero-card');
    expect(heroes).toHaveLength(1);
    const hero = heroes[0];
    expect(text(hero.querySelector('h3'))).toBe('vs Cho');
    expect(text(hero)).toContain('Week 3 · Oct 12 – 18');
    expect(text(hero)).toContain('Weekend Warriors');
    expect(text(hero)).toContain('closes in 6 d');
    // Cho has logged this week already; I haven't.
    expect(text(hero)).toContain('Trailing');
    expect(text(hero)).toContain('35.8');
    const cta = hero.querySelector<HTMLAnchorElement>('a')!;
    expect(text(cta)).toContain('View matchup');
    expect(cta.getAttribute('href')).toMatch(/^\/matchups\/.+/);
    // The only interactive element in the card is the link.
    expect(hero.querySelectorAll('a, button')).toHaveLength(1);

    // Lineups for next week are open and I haven't set mine.
    const lineup = el.querySelector('pch-card.lineup')!;
    expect(text(lineup.querySelector('h2'))).toBe('Set your lineup');
    expect(lineup.querySelector('a')?.getAttribute('href')).toMatch(/^\/matchups\/.+\/lineup$/);
  });

  it('shows the week stats, what is coming and my workouts', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const stats = Array.from(el.querySelectorAll('.stat')).map((s) => [
      text(s.querySelector('.value')),
      text(s.querySelector('.label')),
    ]);
    expect(stats).toEqual([
      ['0', 'Workouts this week'],
      ['0', 'Sets this week'],
      ['0-2', 'Season record'],
    ]);

    const rows = Array.from(el.querySelectorAll('pch-matchup-row'));
    expect(rows).toHaveLength(4);
    // Sorted by week: the badges' days are in order.
    const days = rows.map((r) => Number(text(r.querySelector('pch-date-badge .day'))));
    expect(days).toEqual([19, 19, 26, 26]);
    const cho = rows.find((r) => text(r.querySelector('.headline')) === 'vs Cho')!;
    expect(text(cho.querySelector('.subtitle'))).toBe('Lunch Break Lifters · Oct 19 – 25');
    expect(rows.some((r) => text(r.querySelector('.headline')) === 'Bye round')).toBe(true);

    // Upcoming matchups open; so does every workout.
    expect(rows.every((r) => r.querySelector('a[href^="/matchups/"]'))).toBe(true);
    const recent = el.querySelectorAll('a[pch-list-row][href^="/log"]');
    expect(recent).toHaveLength(6);
    expect(recent[0].getAttribute('href')).toMatch(/^\/log\/.+/);
    expect(text(recent[0])).toContain('Run');
    expect(text(recent[0])).toMatch(/\d+ sets?/);
    // Cardio rows sum up by distance, like lifting rows by weight moved.
    expect(text(recent[0].querySelector('.amount'))).toMatch(/^[\d.]+ km$/);
  });

  it('offers to continue a workout in progress', async () => {
    const f = await render();
    const { container } = backend;
    const log = await container.loggingService.startLog(DEMO_PEACH_ID, FIXED_NOW);
    await container.loggingService.recordEntry(
      log.id,
      exerciseLogEntry({
        exerciseId: 'bw-push-up',
        exerciseName: 'Push Up',
        sets: [setLog({ reps: 20 })],
      }),
    );
    await stable(f);
    const card = f.nativeElement.querySelector('pch-card.log');
    expect(text(card.querySelector('h2'))).toBe('Workout in progress');
    expect(text(card)).toContain('1 exercise logged so far.');
    expect(text(card.querySelector('a'))).toContain('Continue');
    // The draft is listed, linking back to the log page.
    expect(
      f.nativeElement.querySelector('a[pch-list-row][href^="/log"]')?.getAttribute('href'),
    ).toBe('/log');
  });

  it('shows a planned workout, then how far through it you are', async () => {
    const f = await render();
    const { container } = backend;
    const draft = await container.loggingService.openDraft(DEMO_PEACH_ID, FIXED_NOW);
    const pushUps = exerciseLogEntry({
      exerciseId: 'bw-push-up',
      exerciseName: 'Push Up',
      sets: [setLog({ reps: 20 }), setLog({ reps: 20 })],
    });
    await container.loggingService.planExercise(draft.id, pushUps);
    await stable(f);
    const card = () => f.nativeElement.querySelector('pch-card.log');
    expect(text(card().querySelector('h2'))).toBe('Workout planned');
    expect(text(card())).toContain('1 exercise lined up.');
    expect(text(card().querySelector('a'))).toContain('Start');

    await container.loggingService.logSet(draft.id, 'bw-push-up', setLog({ reps: 18 }), FIXED_NOW);
    await stable(f);
    expect(text(card().querySelector('h2'))).toBe('Workout in progress');
    expect(text(card())).toContain('1 of 2 sets done.');
  });

  it('swipes a workout left to delete it (with Undo), right to edit it', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const toast = vi.spyOn(TestBed.inject(AppState), 'toast').mockImplementation(() => undefined);
    const rows = () => Array.from(el.querySelectorAll<HTMLElement>('pch-swipe-row'));
    const hrefs = () => rows().map((r) => r.querySelector('a')!.getAttribute('href'));
    const before = hrefs();
    const swipe = (row: HTMLElement, to: number) => {
      const content = row.querySelector<HTMLElement>('.content')!;
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
      fire('pointerdown', 200);
      for (let i = 1; i <= 10; i++) fire('pointermove', 200 + (to * i) / 10);
      fire('pointerup', 200 + to);
    };

    swipe(rows()[0], -200);
    await settle(400);
    await stable(f);
    const id = before[0]!.split('/').pop()!;
    expect(await backend.container.logs.getById(id)).toBeNull();
    expect(hrefs()).not.toContain(before[0]);
    const [message, undo] = toast.mock.calls[0];
    expect(message).toMatch(/^Deleted .+’s workout\.$/);
    undo!();
    await stable(f);
    expect(hrefs()).toEqual(before);

    swipe(rows()[1], 200);
    await stable(f);
    expect(TestBed.inject(Router).url).toBe(before[1]);
  });

  it('invites a new Peach to log, with empty history', async () => {
    const f = await render({ seed: false });
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('pch-card.log h2'))).toBe('Log a workout');
    expect(text(el)).toContain('Nothing logged yet.');
    expect(Array.from(el.querySelectorAll('pch-section h2')).map(text)).toEqual(['Your workouts']);
    expect(Array.from(el.querySelectorAll('.stat .value')).map(text)).toEqual(['0', '0', '0-0']);
  });
});
