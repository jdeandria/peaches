import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
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
    const sections = Array.from(el.querySelectorAll('h2')).map(text);
    expect(sections).toEqual(['This week', 'Coming up', 'Your workouts']);

    const log = el.querySelector('pch-card.log')!;
    expect(text(log.querySelector('h3'))).toBe('Log a workout');
    expect(log.querySelector('a')?.getAttribute('href')).toBe('/log');

    const heroes = el.querySelectorAll('pch-matchup-hero-card');
    expect(heroes).toHaveLength(1);
    const hero = heroes[0];
    expect(text(hero.querySelector('h3'))).toBe('vs Cho');
    expect(text(hero)).toContain('Week 3 · Oct 12 – 18');
    expect(text(hero)).toContain('Weekend Warriors');
    expect(text(hero)).toContain('closes in 6 d');
    // Cho has logged this week already; I haven't.
    expect(text(hero)).toContain('Trailing');
    expect(text(hero)).toContain('31.8');
    const cta = hero.querySelector<HTMLAnchorElement>('a')!;
    expect(text(cta)).toContain('View matchup');
    expect(cta.getAttribute('href')).toMatch(/^\/matchups\/.+/);
    // The only interactive element in the card is the link.
    expect(hero.querySelectorAll('a, button')).toHaveLength(1);
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

    const recent = el.querySelectorAll('a[pch-list-row]');
    expect(recent).toHaveLength(6);
    expect(recent[0].getAttribute('href')).toMatch(/^\/log\/.+/);
    expect(text(recent[0])).toContain('Run');
    expect(text(recent[0])).toMatch(/\d+ sets?/);
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
      FIXED_NOW,
    );
    await stable(f);
    const card = f.nativeElement.querySelector('pch-card.log');
    expect(text(card.querySelector('h3'))).toBe('Workout in progress');
    expect(text(card)).toContain('1 exercise logged so far.');
    expect(text(card.querySelector('a'))).toContain('Continue');
    // The draft is listed, linking back to the log page.
    expect(f.nativeElement.querySelector('a[pch-list-row]')?.getAttribute('href')).toBe('/log');
  });

  it('invites a new Peach to log, with empty history', async () => {
    const f = await render({ seed: false });
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('pch-card.log h3'))).toBe('Log a workout');
    expect(text(el)).toContain('Nothing logged yet.');
    expect(Array.from(el.querySelectorAll('h2')).map(text)).toEqual(['Your workouts']);
    expect(Array.from(el.querySelectorAll('.stat .value')).map(text)).toEqual(['0', '0', '0-0']);
  });
});
