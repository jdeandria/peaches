import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { LocalDate } from '../../../domain/core/local-date';
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
      .slice(0, 2)
      .map((row) => Array.from(row.children).map(text).join(' '));
  const points = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.scoreboard pch-animated-number .pch-visually-hidden')).map(
      text,
    );

  /** Each side's plan card: whose, committed, and how it's going. */
  const plans = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.plan')).map((card) =>
      [card.children[0], card.children[1], card.querySelector('.status')].map(text).join(' · '),
    );

  it('shows this week’s live score, the breakdown, both plans and both sides’ workouts', async () => {
    const matchups = await setUp();
    const open = matchups.find((m) => m.status === 'inProgress')!;
    const f = await render(open.id);
    const el: HTMLElement = f.nativeElement;

    expect(text(el.querySelector('h1'))).toBe('You vs Cho');
    expect(text(el.querySelector('.subtitle'))).toBe('Weekend Warriors · Week 3 · Oct 12 – 18');
    // Monday morning: I've done my first workout, Cho nothing yet. Each
    // score counts the penalty for what's still to do, as if the week ended now.
    expect(points(el)).toEqual(['19.5', '-39.5']);
    expect(text(el.querySelector('.verdict'))).toBe('Live · You lead');
    expect(text(el.querySelector('.banner'))).toContain('Everything you both log this week counts');
    const train = el.querySelector('a.log')!;
    expect(train.getAttribute('href')).toBe('/');
    expect(text(train)).toContain('Go to your plan');

    const headings = Array.from(el.querySelectorAll('h2')).map(text);
    expect(headings).toEqual([
      'How the score adds up',
      'Plans',
      'Workout points by category',
      'Your workouts',
      'Cho’s workouts',
    ]);
    expect(breakdown(el)).toEqual(['Workouts 47.8 0', 'Plan penalty −28.3 −39.5']);
    expect(plans(el)).toEqual([
      'Your plan · 104.5 pts committed · 56.7 pts to go · −28.3 if it stays',
      'Cho’s plan · 79.0 pts committed · 79.0 pts to go · −39.5 if it stays',
    ]);
    // Every category the Crate gave points to, with its weight per par.
    const categories = Array.from(el.querySelectorAll('.category .what .pch-title-small')).map(
      text,
    );
    expect(categories.slice(-6)).toEqual([
      'Run & walk',
      'Ride',
      'Swim & row',
      'Weight moved',
      'Reps',
      'Active minutes',
    ]);
    expect(text(el)).toContain('23 pts per 5 km');
    expect(text(el.querySelector('.category.heading'))).toBe('YouCho');
    expect(text(el)).toContain('Nothing logged this week yet.');

    // A run I log now shows up in the score, and hits my plan.
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
    // 10 km = 2 pars at 23; 50 min = 1.11 pars at 25: 73.8 more, past my
    // 104.5, which earns 25% of it.
    expect(breakdown(el)).toEqual(['Workouts 121.6 0', 'Plan bonus or penalty +26.1 −39.5']);
    expect(plans(el)[0]).toBe('Your plan · 104.5 pts committed · Plan hit: +26.1 bonus');
    expect(points(el)[0]).toBe('147.7');
    expect(text(el.querySelector('.verdict'))).toBe('Live · You lead');
    const mine = el.querySelectorAll('.logs > div')[0];
    const links = Array.from(mine.querySelectorAll('a[pch-list-row]')).map((a) =>
      a.getAttribute('href'),
    );
    expect(links).toContain(`/log/${log.id}`);
  });

  it('shows the final score once the week has closed', async () => {
    const matchups = await setUp();
    const done = matchups.find((m) => m.status === 'complete' && m.homePeachId === 'ada')!;
    const f = await render(done.id);
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('You vs Ada');
    expect(points(el)).toEqual(['207.2', '79.3']);
    // Workouts, then the plans: I hit mine (25% of 104.5); Ada fell 59.1
    // short of 168 (50% of it off).
    expect(breakdown(el)).toEqual(['Workouts 181.1 108.8', 'Plan bonus or penalty +26.1 −29.6']);
    expect(plans(el)).toEqual([
      'Your plan · 104.5 pts committed · Hit: +26.1 bonus',
      'Ada’s plan · 168.0 pts committed · Short by 59.1: −29.6',
    ]);
    expect(text(el.querySelector('.verdict'))).toBe('Final · You won');
    expect(el.querySelector('.banner')).toBeNull();
    expect(el.querySelector('a.log')).toBeNull();
    // Crate-mates' workouts open as shared with the Crate, to view and dispute.
    const theirs = el.querySelectorAll('.logs > div')[1];
    expect(theirs.querySelector('a')?.getAttribute('href')).toMatch(/^\/crates\/.+\/logs\//);
  });

  it('before the week starts, shows commitments so far and asks for a plan', async () => {
    const matchups = await setUp();
    const bye = matchups.find((m) => m.status === 'scheduled' && m.awayPeachId === null)!;
    const f = await render(bye.id);
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Your bye week');
    expect(text(el.querySelector('.banner .pch-body-medium'))).toBe('Starts Mon, Oct 19');
    expect(plans(el)).toEqual(['Your plan · No plan · Nothing planned yet · locks in 6 d']);
    const plan = el.querySelector('a.plan-week')!;
    expect(plan.getAttribute('href')).toBe('/?week=next');
    expect(text(plan)).toContain('Plan your week');
    expect(el.querySelectorAll('.logs > div')).toHaveLength(1);

    // What I plan shows up as my commitment.
    await backend.container.planService.saveWorkout({
      peachId: DEMO_PEACH_ID,
      weekStart: '2026-10-19' as LocalDate,
      workout: {
        day: '2026-10-20' as LocalDate,
        name: 'Run',
        locationId: null,
        exercises: [
          exerciseLogEntry({
            exerciseId: 'bw-run',
            exerciseName: 'Run',
            distanceKind: 'runWalk',
            sets: [setLog({ meters: 5000, seconds: 1500 })],
          }),
        ],
      },
      now: FIXED_NOW,
    });
    TestBed.inject(AppState).bump();
    await stable(f);
    expect(plans(el)[0]).toMatch(
      /^Your plan · [\d.]+ pts committed · [\d.]+ committed so far · locks in 6 d$/,
    );
  });

  it('says when a matchup does not exist', async () => {
    await setUp();
    const f = await render('nope');
    expect(text(f.nativeElement)).toContain('Matchup not found');
  });
});
