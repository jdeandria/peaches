import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { LocalDate, weekday } from '../../../domain/core/local-date';
import { Crate } from '../../../domain/models/crate';
import { matchup, Round } from '../../../domain/models/season';
import { seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { CrateDetailPage, roundViews } from './crate-detail.page';
import { NewSeasonDialog, seasonDays } from './new-season-dialog';

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

  it('shows the Season standings, rounds and members of a Crate I belong to', async () => {
    const crate = await myCrate(backend, 'Weekend Warriors');
    const el = await render(crate.id);
    expect(el.querySelector('h1')?.textContent).toBe('Weekend Warriors');
    expect(el.textContent).toContain('Three days a week, forty minutes, no excuses.');
    expect(el.textContent).toContain('General fitness');
    expect(el.textContent).toContain(`Code ${crate.inviteCode}`);

    const headings = Array.from(el.querySelectorAll('h2')).map((h) => h.textContent?.trim());
    expect(headings).toEqual(['Autumn Kick-off', 'Rounds', 'Peaches']);
    expect(el.textContent).toContain('Active');
    expect(el.querySelectorAll('pch-standings-table tbody tr')).toHaveLength(5);
    expect(el.querySelector('pch-standings-table [aria-current]')?.textContent).toContain('You');

    const rounds = el.querySelectorAll('pch-list-card')[0].querySelectorAll('pch-list-row');
    expect(rounds).toHaveLength(12);
    // Not the owner: statuses, no Open/Close buttons, no Season FAB.
    expect(el.querySelector('pch-list-row button')).toBeNull();
    expect(el.querySelector('button[matFab]')).toBeNull();
    // Today's round links to my matchup.
    const link = el.querySelector<HTMLAnchorElement>('pch-list-row a.stretched');
    expect(link?.getAttribute('href')).toMatch(/^\/matchups\//);

    const members = el.querySelectorAll('pch-list-card')[1].querySelectorAll('pch-list-row');
    expect(members).toHaveLength(5);
    expect(members[0].textContent).toContain('Owner');
    expect(el.textContent).toMatch(/Level \d/);
  });

  it('offers the owner a new Season', async () => {
    const crate = await myCrate(backend, 'Lunch Break Lifters');
    const el = await render(crate.id);
    expect(el.textContent).toContain('Strength Block 1');
    expect(el.querySelector('button[matFab]')?.textContent).toContain('Season');
  });

  it('says when a Crate has no Season', async () => {
    const crate = await backend.container.crateService.createCrate({
      ownerPeachId: DEMO_PEACH_ID,
      name: 'Garage Gym',
      now: new Date(),
    });
    const el = await render(crate.id);
    expect(el.textContent).toContain('No Season yet. The owner can start one.');
  });

  it('says when a Crate does not exist', async () => {
    const el = await render('nope');
    expect(el.textContent).toContain('Crate not found');
  });
});

describe('roundViews', () => {
  const round = (index: number, date: string, status: Round['status']): Round => ({
    id: `r${index}`,
    seasonId: 's',
    index,
    date: date as LocalDate,
    focus: 'fullBody',
    status,
  });
  const rounds = [
    round(0, '2026-10-09', 'closed'),
    round(1, '2026-10-12', 'open'),
    round(2, '2026-10-12', 'scheduled'),
    round(3, '2026-10-14', 'scheduled'),
  ];
  const matchups = [
    matchup({ id: 'm0', seasonId: 's', roundId: 'r0', homePeachId: 'me' }),
    matchup({
      id: 'm1',
      seasonId: 's',
      roundId: 'r1',
      homePeachId: 'me',
      awayPeachId: 'ada',
      workoutId: 'w1',
    }),
    matchup({ id: 'm3', seasonId: 's', roundId: 'r3', homePeachId: 'ada', awayPeachId: 'ben' }),
  ];

  it('gives the owner Open for due rounds and Close for open ones', () => {
    const views = roundViews({ rounds, matchups, me: 'me', canManage: true, today: '2026-10-12' });
    expect(views.map((v) => v.action)).toEqual([null, 'close', 'open', null]);
    expect(views[1].title).toBe('Mon, Oct 12 · Full body');
  });

  it('labels my matchups and links the opened one', () => {
    const views = roundViews({ rounds, matchups, me: 'me', canManage: false, today: '2026-10-12' });
    expect(views.map((v) => v.action)).toEqual([null, null, null, null]);
    expect(views.map((v) => v.subtitle)).toEqual(['Bye', 'You have a matchup', null, null]);
    expect(views.map((v) => v.matchupLink)).toEqual([null, ['/matchups', 'm1'], null, null]);
  });
});

describe('NewSeasonDialog', () => {
  it('derives exercise days from tomorrow for the chosen weeks', () => {
    const days = seasonDays('2026-10-12' as LocalDate, new Set([1, 3, 5]), 2);
    expect(days).toEqual([
      '2026-10-14',
      '2026-10-16',
      '2026-10-19',
      '2026-10-21',
      '2026-10-23',
      '2026-10-26',
    ]);
    expect(days.every((d) => [1, 3, 5].includes(weekday(d)))).toBe(true);
  });

  it('starts a Season with the chosen name and days; needs a weekday', async () => {
    const backend = await seededBackend();
    const crate = await myCrate(backend, 'Lunch Break Lifters');
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        ...backend.providers,
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: crate },
      ],
    });
    const f = TestBed.createComponent(NewSeasonDialog);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.textContent).toContain('Length: 4 weeks');
    const chips = Array.from(el.querySelectorAll('[role=option]'));
    expect(chips.map((c) => c.getAttribute('aria-label'))).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(chips.map((c) => c.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'true',
      'false',
      'true',
      'false',
      'false',
    ]);

    const dialog = f.componentInstance;
    for (const d of [1, 3, 5]) dialog.toggleDay(d, false);
    await f.whenStable();
    const start = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Start',
    )!;
    expect(start.disabled).toBe(true);

    dialog.toggleDay(2, true);
    dialog.name.set('Block 2');
    dialog.weeks.set(3);
    await dialog.start();
    const season = close.mock.calls[0][0];
    expect(season.name).toBe('Block 2');
    expect(season.exerciseDays).toHaveLength(3);
    expect(season.exerciseDays.every((d: LocalDate) => weekday(d) === 2)).toBe(true);
    const seasons = await backend.container.seasons.forCrate(crate.id);
    expect(seasons.map((s) => s.name)).toContain('Block 2');
  });
});
