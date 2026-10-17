import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { LocalDate } from '../../../domain/core/local-date';
import { Crate } from '../../../domain/models/crate';
import { categoryWeights, DEFAULT_LINEUP_RULES } from '../../../domain/models/scoring';
import { matchup, Round } from '../../../domain/models/season';
import { FIXED_NOW, seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { CrateDetailPage, roundViews } from './crate-detail.page';
import { NewSeasonDialog, startWeekOptions } from './new-season-dialog';

@Component({ template: '' })
class Blank {}

async function myCrate(backend: TestBackend, name: string): Promise<Crate> {
  for (const m of await backend.container.crates.membershipsFor(DEMO_PEACH_ID)) {
    const crate = await backend.container.crates.getById(m.crateId);
    if (crate?.name === name) return crate;
  }
  throw new Error(`No crate ${name}`);
}

describe('CrateDetailPage', () => {
  let backend: TestBackend;

  beforeEach(async () => {
    backend = await seededBackend({ routes: [{ path: '**', component: Blank }] });
    TestBed.configureTestingModule({ providers: backend.providers });
  });

  async function render(crateId: string) {
    const f = TestBed.createComponent(CrateDetailPage);
    f.componentRef.setInput('crateId', crateId);
    await settle();
    await f.whenStable();
    await settle();
    await f.whenStable();
    return f.nativeElement as HTMLElement;
  }

  it('shows disputes to vote on, the Season, activity, shared exercises and members', async () => {
    const crate = await myCrate(backend, 'Weekend Warriors');
    const el = await render(crate.id);
    expect(el.querySelector('h1')?.textContent).toBe('Weekend Warriors');
    expect(el.textContent).toContain('Every workout counts. Most points each week wins.');
    expect(el.textContent).toContain('Rules · 3 of 5 voted');
    expect(el.querySelector('a.chip')?.getAttribute('href')).toBe(`/crates/${crate.id}/vote`);
    expect(el.textContent).toContain(`Code ${crate.inviteCode}`);

    const headings = Array.from(el.querySelectorAll('h2')).map((h) => h.textContent?.trim());
    expect(headings).toEqual([
      'Your vote needed',
      'Autumn Kick-off',
      'Weeks',
      'Recent workouts',
      'Exercises',
      'Peaches',
    ]);
    // Ben disputed one of Ada's workouts; it links to the workout.
    const dispute = el.querySelector<HTMLAnchorElement>('a.dispute-link')!;
    expect(dispute.textContent).toContain('Ben disputed it');
    expect(dispute.getAttribute('href')).toMatch(new RegExp(`^/crates/${crate.id}/logs/`));
    expect(el.textContent).toContain('Active');
    expect(el.querySelectorAll('pch-standings-table tbody tr')).toHaveLength(5);
    expect(el.querySelector('pch-standings-table [aria-current]')?.textContent).toContain('You');

    const weeks = el.querySelectorAll('.weeks pch-list-row');
    expect(weeks).toHaveLength(6);
    expect(weeks[2].textContent).toContain('Week 3 · Oct 12 – 18');
    // Not a manager: statuses, no Open/Close buttons, no Season FAB.
    expect(el.querySelector('.weeks button')).toBeNull();
    expect(el.querySelector('button[matFab]')).toBeNull();
    // Played and current weeks link to my matchups; later ones don't yet.
    expect(el.querySelectorAll('.weeks a.stretched')).toHaveLength(3);

    // Every workout opens: mine to edit, crate-mates' to view and dispute.
    const activity = el.querySelectorAll<HTMLAnchorElement>('.activity a[pch-list-row]');
    expect(activity).toHaveLength(8);
    expect(activity[0].textContent).toContain('Ada');
    expect(activity[0].getAttribute('href')).toMatch(new RegExp(`^/crates/${crate.id}/logs/`));

    // Every exercise members logged, tagged with who.
    const exercises = Array.from(el.querySelectorAll('.exercises pch-list-row')).map((r) =>
      r.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(exercises).toContain('Reservoir hill loop From Ada');
    expect(exercises.some((e) => e?.includes('From you'))).toBe(true);

    const members = el.querySelectorAll('.members pch-list-row');
    expect(members).toHaveLength(5);
    expect(members[0].textContent).toContain('Ada');
    expect(members[0].textContent).toContain('Owner');
  });

  it('lets the owner start a Season once the last one is over', async () => {
    const lifters = await myCrate(backend, 'Lunch Break Lifters');
    let el = await render(lifters.id);
    expect(el.textContent).toContain('Strength Block 1');
    // One is already scheduled.
    expect(el.querySelector('button[matFab]')).toBeNull();

    const crate = await backend.container.crateService.createCrate({
      ownerPeachId: DEMO_PEACH_ID,
      name: 'Garage Gym',
      now: FIXED_NOW,
    });
    el = await render(crate.id);
    expect(el.textContent).toContain('No Season yet. Start one');
    expect(el.querySelector('button[matFab]')?.textContent).toContain('Season');
    expect(el.textContent).toContain('Nothing logged yet.');
  });

  it('says when a Crate does not exist', async () => {
    const el = await render('nope');
    expect(el.textContent).toContain('Crate not found');
  });
});

describe('roundViews', () => {
  const round = (index: number, weekStart: string, status: Round['status']): Round => ({
    id: `r${index}`,
    seasonId: 's',
    index,
    weekStart: weekStart as LocalDate,
    status,
  });
  const rounds = [
    round(0, '2026-10-05', 'closed'),
    round(1, '2026-10-12', 'open'),
    round(2, '2026-10-12', 'scheduled'),
    round(3, '2026-10-19', 'scheduled'),
  ];
  const matchups = [
    matchup({ id: 'm0', seasonId: 's', roundId: 'r0', homePeachId: 'me' }),
    matchup({ id: 'm1', seasonId: 's', roundId: 'r1', homePeachId: 'me', awayPeachId: 'ada' }),
    matchup({ id: 'm3', seasonId: 's', roundId: 'r3', homePeachId: 'me', awayPeachId: 'ben' }),
  ];
  const today = '2026-10-14' as LocalDate;

  it('gives managers Open for started weeks and Close for open ones', () => {
    const views = roundViews({ rounds, matchups, me: 'me', canManage: true, today });
    expect(views.map((v) => v.action)).toEqual([null, 'close', 'open', null]);
    expect(views[1].title).toBe('Week 2 · Oct 12 – 18');
  });

  it('labels my matchups and links those that have started', () => {
    const views = roundViews({ rounds, matchups, me: 'me', canManage: false, today });
    expect(views.map((v) => v.action)).toEqual([null, null, null, null]);
    expect(views.map((v) => v.subtitle)).toEqual([
      'Bye',
      'You have a matchup',
      null,
      'You have a matchup',
    ]);
    expect(views.map((v) => v.matchupLink)).toEqual([
      ['/matchups', 'm0'],
      ['/matchups', 'm1'],
      null,
      null,
    ]);
  });
});

describe('NewSeasonDialog', () => {
  it('starts this week or next', () => {
    expect(startWeekOptions('2026-10-14' as LocalDate)).toEqual([
      { value: '2026-10-12', label: 'This week (Mon, Oct 12)' },
      { value: '2026-10-19', label: 'Next week (Mon, Oct 19)' },
    ]);
  });

  it('starts a Season with the chosen name, start and length, freezing the vote', async () => {
    const backend = await seededBackend();
    const crate = await backend.container.crateService.createCrate({
      ownerPeachId: DEMO_PEACH_ID,
      name: 'Garage Gym',
      now: FIXED_NOW,
    });
    await backend.container.votingService.castBallot(
      crate.id,
      DEMO_PEACH_ID,
      { weights: categoryWeights({ ride: 100 }), lineup: DEFAULT_LINEUP_RULES },
      FIXED_NOW,
    );
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        ...backend.providers,
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: crate },
      ],
    });
    const f = TestBed.createComponent(NewSeasonDialog);
    await settle();
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.textContent).toContain('Length: 6 weeks');
    expect(el.textContent).toContain('Ride 100; lineups of 3');
    const options = Array.from(el.querySelectorAll('[role=radio]')).map((b) =>
      b.textContent?.trim(),
    );
    expect(options).toEqual(['This week (Mon, Oct 12)', 'Next week (Mon, Oct 19)']);

    const dialog = f.componentInstance;
    dialog.name.set('Block 2');
    dialog.startWeek.set('2026-10-12' as LocalDate);
    dialog.weeks.set(3);
    await dialog.start();
    const season = close.mock.calls[0][0];
    expect(season.name).toBe('Block 2');
    expect(season.startWeek).toBe('2026-10-12');
    expect(season.weeks).toBe(3);
    expect(season.rules.weights).toEqual(categoryWeights({ ride: 100 }));
    // Starting this week opens its round straight away.
    const [first] = await backend.container.seasons.roundsOf(season.id);
    expect(first.status).toBe('open');
  });
});
