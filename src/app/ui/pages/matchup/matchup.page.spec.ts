import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { Matchup } from '../../../domain/models/season';
import { exerciseLogEntry, setLog } from '../../../domain/models/workout-log';
import { AppState } from '../../../state/app-state';
import { FIXED_NOW, seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { MatchupPage } from './matchup.page';

@Component({ template: '' })
class Blank {}

describe('MatchupPage', () => {
  let backend: TestBackend;

  async function setUp(): Promise<Matchup[]> {
    backend = await seededBackend({ routes: [{ path: '**', component: Blank }] });
    TestBed.configureTestingModule({
      providers: [
        ...backend.providers,
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
    return backend.container.seasons.matchupsFor(DEMO_PEACH_ID);
  }

  async function render(matchupId: string): Promise<ComponentFixture<MatchupPage>> {
    const f = TestBed.createComponent(MatchupPage);
    f.componentRef.setInput('matchupId', matchupId);
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
  /** The "How the score adds up" lines: label, then each side's points. */
  const breakdown = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.category:not(.heading)'))
      .slice(0, 3)
      .map((row) => Array.from(row.children).map(text).join(' '));
  const points = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.scoreboard pch-animated-number .pch-visually-hidden')).map(
      text,
    );

  it('shows this week’s live score, the breakdown and both sides’ workouts', async () => {
    const matchups = await setUp();
    const open = matchups.find((m) => m.status === 'inProgress')!;
    const f = await render(open.id);
    const el: HTMLElement = f.nativeElement;

    expect(text(el.querySelector('h1'))).toBe('You vs Cho');
    expect(text(el.querySelector('.subtitle'))).toBe('Weekend Warriors · Week 3 · Oct 12 – 18');
    expect(points(el)).toEqual(['0', '35.8']);
    expect(text(el.querySelector('.verdict'))).toBe('Live · Cho leads');
    expect(text(el.querySelector('.banner'))).toContain('Everything you both log this week counts');
    expect(el.querySelector('a.log')?.getAttribute('href')).toBe('/log');

    const headings = Array.from(el.querySelectorAll('h2')).map(text);
    expect(headings).toEqual([
      'How the score adds up',
      'Your lineup',
      'Cho’s lineup',
      'Workout points by category',
      'Your workouts',
      'Cho’s workouts',
    ]);
    // The whole score, line by line: Cho out-rode me (nobody else rode).
    expect(breakdown(el)).toEqual(['Workouts 0 31.8', 'Pledge bonus 0 0', 'Battle prizes 0 4']);
    const choRide = Array.from(el.querySelectorAll('.sides > div')[1].querySelectorAll('.pledge'))
      .map(text)
      .find((t) => t?.includes('Ride'));
    expect(choRide).toContain('20.07 km of 40 km');
    expect(choRide).toContain('Won vs your 0 km');
    // Every category the Crate gave points to, with its weight per par.
    const categories = Array.from(el.querySelectorAll('.category .what .pch-title-small')).map(
      text,
    );
    expect(categories).toEqual([
      'Run & walk',
      'Ride',
      'Swim & row',
      'Weight moved',
      'Reps',
      'Active minutes',
    ]);
    expect(text(el.querySelectorAll('.category:not(.heading)')[3])).toContain('23 pts per 5 km');
    expect(text(el.querySelector('.category.heading'))).toBe('YouCho');
    expect(text(el)).toContain('Nothing logged this week yet.');

    // A run I log now shows up in the score.
    const log = await backend.container.loggingService.startLog(DEMO_PEACH_ID, FIXED_NOW);
    await backend.container.loggingService.recordEntry(
      log.id,
      exerciseLogEntry({
        exerciseId: 'bw-run',
        exerciseName: 'Run',
        distanceKind: 'runWalk',
        sets: [setLog({ meters: 10_000, seconds: 3000 })],
      }),
    );
    await backend.container.loggingService.submit(log.id, FIXED_NOW);
    TestBed.inject(AppState).bump();
    await stable(f);
    // 10 km = 2 pars at 23; 50 min = 1.11 pars at 25. My 5 km pledge is hit
    // (+11.5), I out-ran Cho (+23) and tied Cho's 50 minutes (half of 25).
    expect(breakdown(el)).toEqual([
      'Workouts 73.8 31.8',
      'Pledge bonus 11.5 0',
      'Battle prizes 35.5 4',
    ]);
    expect(points(el)[0]).toBe('120.8');
    expect(text(el.querySelector('.verdict'))).toBe('Live · You lead');
    const mine = el.querySelectorAll('.logs > div')[0];
    expect(mine.querySelector('a[pch-list-row]')?.getAttribute('href')).toBe(`/log/${log.id}`);
  });

  it('shows the final score once the week has closed', async () => {
    const matchups = await setUp();
    const done = matchups.find((m) => m.status === 'complete' && m.homePeachId === 'ada')!;
    const f = await render(done.id);
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('You vs Ada');
    expect(points(el)).toEqual(['253.6', '288.4']);
    // Workouts, then pledges hit (5 km and 90 min for me; 15 km and 120 min
    // for Ada) and battles won (weight and minutes for me, running for Ada).
    expect(breakdown(el)).toEqual([
      'Workouts 174.1 197.6',
      'Pledge bonus 36.5 67.8',
      'Battle prizes 43 23',
    ]);
    expect(text(el.querySelector('.verdict'))).toBe('Final · Ada won');
    expect(el.querySelector('.banner')).toBeNull();
    expect(el.querySelector('a.log')).toBeNull();
    // Crate-mates' workouts open as shared with the Crate, to view and dispute.
    const theirs = el.querySelectorAll('.logs > div')[1];
    expect(theirs.querySelector('a')?.getAttribute('href')).toMatch(/^\/crates\/.+\/logs\//);
  });

  it('shows a bye week that has not started yet', async () => {
    const matchups = await setUp();
    const bye = matchups.find((m) => m.status === 'scheduled' && m.awayPeachId === null)!;
    const f = await render(bye.id);
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Your bye week');
    expect(text(el.querySelector('.banner .pch-body-medium'))).toBe('Starts Mon, Oct 19');
    expect(el.querySelectorAll('.logs > div')).toHaveLength(1);
  });

  it('says when a matchup does not exist', async () => {
    await setUp();
    const f = await render('nope');
    expect(text(f.nativeElement)).toContain('Matchup not found');
  });
});
