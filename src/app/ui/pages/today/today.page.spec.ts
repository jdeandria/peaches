import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { exerciseLogEntry } from '../../../domain/models/workout-log';
import { workoutItems } from '../../../domain/models/workout';
import { seededBackend, settle, TestBackend } from '../../../../testing/test-app';
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

  it('leads with the open matchup as a hero card', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Today');
    expect(text(el.querySelector('.subtitle'))).toBe('Monday, October 12');
    const sections = Array.from(el.querySelectorAll('h2')).map(text);
    expect(sections).toEqual(['Up next', 'Coming up', 'Recent workouts']);

    const heroes = el.querySelectorAll('pch-matchup-hero-card');
    expect(heroes).toHaveLength(1);
    const hero = heroes[0];
    expect(text(hero.querySelector('h3'))).toBe('vs Dev');
    expect(text(hero)).toContain('Round 5 · Full body');
    expect(text(hero)).toContain('Weekend Warriors');
    expect(text(hero)).toMatch(/closes in \d+ h/);
    expect(text(hero)).toContain('0 of 6 exercises logged');
    expect(text(hero)).toMatch(/~\d+ min/);
    const cta = hero.querySelector<HTMLAnchorElement>('a')!;
    expect(text(cta)).toContain('Start workout');
    expect(cta.getAttribute('href')).toMatch(/^\/matchups\/.+/);
    // The only interactive element in the card is the link.
    expect(hero.querySelectorAll('a, button')).toHaveLength(1);
  });

  it('shows the week stats, what is coming and recent workouts', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const stats = Array.from(el.querySelectorAll('.stat')).map((s) => [
      text(s.querySelector('.value')),
      text(s.querySelector('.label')),
    ]);
    expect(stats.map(([, label]) => label)).toEqual([
      'Workouts this week',
      'Sets this week',
      'Season record',
    ]);
    expect(stats[0][0]).toMatch(/^\d+$/);
    expect(stats[2][0]).toMatch(/^\d+-\d+(-\d+)?$/);

    const rows = Array.from(el.querySelectorAll('pch-matchup-row'));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(4);
    // Sorted by date: the badges' accessible dates are in order.
    const days = rows.map((r) => Number(text(r.querySelector('pch-date-badge .day'))));
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(text(rows[0].querySelector('.headline'))).toBe('vs Cho');
    expect(text(rows[0].querySelector('.subtitle'))).toBe('Lunch Break Lifters · Lower body');

    const recent = el.querySelectorAll('a[pch-list-row]');
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.length).toBeLessThanOrEqual(6);
    expect(recent[0].getAttribute('href')).toMatch(/^\/matchups\//);
    expect(text(recent[0])).toMatch(/\d+ sets/);
  });

  it('updates the hero as sets are logged', async () => {
    const f = await render();
    const { container } = backend;
    const open = (await container.seasons.matchupsFor(DEMO_PEACH_ID)).find(
      (m) => m.status === 'inProgress',
    )!;
    const log = await container.loggingService.logForMatchup(open, DEMO_PEACH_ID, new Date());
    const workout = (await container.workouts.getById(open.workoutId!))!;
    const item = workoutItems(workout).find((i) => i.scoringWeight > 0)!;
    await container.loggingService.recordEntry(
      log.id,
      exerciseLogEntry({
        exerciseId: item.exerciseId,
        workoutItemId: item.id,
        sets: [{ reps: 1, seconds: null, meters: null, loadKg: null }],
      }),
    );
    await stable(f);
    const hero = f.nativeElement.querySelector('pch-matchup-hero-card');
    expect(text(hero)).toContain('1 of 6 exercises logged');
    expect(text(hero.querySelector('a'))).toContain('Continue workout');
  });

  it('shows a rest day and empty history for a new Peach', async () => {
    const f = await render({ seed: false });
    const el: HTMLElement = f.nativeElement;
    expect(text(el)).toContain('Rest day');
    expect(text(el)).toContain('No workout due. Recovery is training too.');
    expect(text(el)).toContain('Nothing logged yet.');
    expect(Array.from(el.querySelectorAll('h2')).map(text)).toEqual(['Up next', 'Recent workouts']);
    expect(Array.from(el.querySelectorAll('.stat .value')).map(text)).toEqual(['0', '0', '0-0']);
  });
});
