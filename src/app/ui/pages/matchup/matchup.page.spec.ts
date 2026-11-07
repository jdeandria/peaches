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
  /** The matchup card: each side's number and plan, and the line that matters. */
  const card = (el: HTMLElement) => {
    const c = el.querySelector('pch-matchup-card')!;
    return {
      when: text(c.querySelector('.pill')),
      sides: Array.from(c.querySelectorAll('.side')).map((s) =>
        [
          text(s.querySelector('.name')),
          text(s.querySelector('.value .pch-visually-hidden')),
          text(s.querySelector('.caption')),
        ].join(' | '),
      ),
      headline: text(c.querySelector('.headline')),
      detail: text(c.querySelector('.foot .pch-body-small')),
    };
  };

  it('shows this week’s live score, the breakdown, both plans and both sides’ workouts', async () => {
    const matchups = await setUp();
    const open = matchups.find((m) => m.status === 'inProgress')!;
    const f = await render(open.id);
    const el: HTMLElement = f.nativeElement;

    expect(text(el.querySelector('h1'))).toBe('You vs Cho');
    expect(text(el.querySelector('.subtitle'))).toBe('Weekend Warriors · Week 3 · Oct 12 – 18');
    // Monday morning: I've done my first workout, Cho nothing yet. Each
    // score counts the penalty for what's still to do, as if the week ended now.
    // The same card as on the Plan and the Crate, not a link here.
    expect(card(el)).toEqual({
      when: 'Ends in 6 d',
      sides: ['You | 19.5 | 47.8 of 104.5 planned', 'Cho | −39.5 | 0 of 79.0 planned'],
      headline: '56.7 to go to hit your plan',
      detail: 'Stop here and it costs 28.3.',
    });
    expect(el.querySelector('pch-matchup-card a')).toBeNull();
    // The tab bar goes to the plan; nothing here duplicates it.
    expect(el.querySelector('a[href="/"]')).toBeNull();

    const headings = Array.from(el.querySelectorAll('h2')).map(text);
    expect(headings).toEqual([
      'How the score adds up',
      'Workout points by category',
      'Your workouts',
      'Cho’s workouts',
    ]);
    expect(breakdown(el)).toEqual(['Workouts 47.8 0', 'Plan penalty −28.3 −39.5']);
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
    expect(card(el).sides[0]).toBe('You | 147.7 | 121.6 of 104.5 planned');
    expect(card(el).headline).toBe('Plan hit: +26.1 bonus');
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
    expect(card(el)).toEqual({
      when: 'Final',
      sides: ['You | 207.2 | 181.1 of 104.5 planned', 'Ada | 79.3 | 108.8 of 168.0 planned'],
      headline: 'You won',
      detail: undefined,
    });
    // Workouts, then the plans: I hit mine (25% of 104.5); Ada fell 59.1
    // short of 168 (50% of it off).
    expect(breakdown(el)).toEqual(['Workouts 181.1 108.8', 'Plan bonus or penalty +26.1 −29.6']);
    // Crate-mates' workouts open as shared with the Crate, to view and dispute.
    const theirs = el.querySelectorAll('.logs > div')[1];
    expect(theirs.querySelector('a')?.getAttribute('href')).toMatch(/^\/crates\/.+\/logs\//);
  });

  it('before the week starts, shows commitments so far', async () => {
    const matchups = await setUp();
    const bye = matchups.find((m) => m.status === 'scheduled' && m.awayPeachId === null)!;
    const f = await render(bye.id);
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Your bye week');
    expect(card(el)).toEqual({
      when: 'Locks in 6 d',
      sides: ['You | 0 | Nothing planned yet'],
      headline: 'Bye week: your plan still earns its bonus',
      detail: undefined,
    });
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
    expect(card(el).sides[0]).toMatch(/^You \| [\d.]+ \| Planned so far$/);
    expect(card(el).detail).toMatch(/^Hit it for \+[\d.]+; miss and lose 50% of the gap\.$/);
  });

  it('says when a matchup does not exist', async () => {
    await setUp();
    const f = await render('nope');
    expect(text(f.nativeElement)).toContain('Matchup not found');
  });
});
