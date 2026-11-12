import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { LocalDate } from '../../../domain/core/local-date';
import { Crate } from '../../../domain/models/crate';
import { categoryWeights, DEFAULT_PLAN_RULES } from '../../../domain/models/scoring';
import { matchup, Round } from '../../../domain/models/season';
import { FIXED_NOW, seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { CrateSheetData } from '../crates/crate-actions-sheet';
import { CrateDetailPage, roundViews } from './crate-detail.page';
import { AddBotDialog } from './add-bot-dialog';
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

  let fixture: ComponentFixture<CrateDetailPage>;

  async function render(crateId: string, view?: string) {
    const f = (fixture = TestBed.createComponent(CrateDetailPage));
    f.componentRef.setInput('crateId', crateId);
    if (view) f.componentRef.setInput('view', view);
    await settle();
    await f.whenStable();
    await settle();
    await f.whenStable();
    return f.nativeElement as HTMLElement;
  }

  /** Switches to a view the way the router does when its query param changes. */
  async function show(view: string) {
    fixture.componentRef.setInput('view', view);
    await settle();
    await fixture.whenStable();
  }

  afterEach(() => localStorage.clear());

  it('leads with this week’s matchup, and switches Crates from the headline', async () => {
    const crate = await myCrate(backend, 'Weekend Warriors');
    const lifters = await myCrate(backend, 'Lunch Break Lifters');
    const el = await render(crate.id);
    // The tab's own page: no way back. The name is the way to another Crate.
    expect(el.querySelector('button[aria-label=Back]')).toBeNull();
    const title = el.querySelector<HTMLButtonElement>('h1 button')!;
    expect(title.textContent).toContain('Weekend Warriors');
    expect(el.querySelector('pch-crate-switcher, .chips')).toBeNull();
    const sheet = TestBed.inject(MatBottomSheet);
    const open = vi.spyOn(sheet, 'open');
    title.click();
    expect(open).toHaveBeenCalledTimes(1);
    const data = open.mock.calls[0][1]?.data as CrateSheetData;
    expect(data.current).toBe(crate.id);
    expect(data.crates.map((c) => c.id).sort()).toEqual([crate.id, lifters.id].sort());
    sheet.dismiss();
    // The Crates tab reopens it next time.
    expect(localStorage.getItem('pch.lastCrate')).toBe(crate.id);

    // The Season and week under the name; the views right under that.
    expect(el.querySelector('.subtitle')?.textContent?.trim()).toBe(
      'Autumn Kick-off · Week 3 of 6',
    );
    const header = el.querySelector('.header')!;
    const views = el.querySelector('pch-button-group')!;
    expect(header.nextElementSibling?.contains(views)).toBe(true);
    expect(el.querySelector('.content')?.firstElementChild?.tagName).toBe('PCH-BUTTON-GROUP');

    // Week 3 against Cho: the same card as on the Plan, without the week again.
    const card = el.querySelector('pch-matchup-card')!;
    const sides = Array.from(card.querySelectorAll('.side')).map((s) =>
      [s.querySelector('.name'), s.querySelector('.caption')].map((e) => e?.textContent?.trim()),
    );
    expect(sides).toHaveLength(2);
    expect(sides[0].join(' ')).toMatch(/^You [\d.]+ of [\d.]+ planned$/);
    expect(sides[1].join(' ')).toMatch(/^Cho [\d.]+ of [\d.]+ planned$/);
    expect(card.querySelector('.meta')).toBeNull();
    expect(card.querySelector('a')?.getAttribute('href')).toMatch(/^\/matchups\//);
  });

  it('a Season that hasn’t started says when', async () => {
    const lifters = await myCrate(backend, 'Lunch Break Lifters');
    const el = await render(lifters.id);
    expect(el.textContent).toContain('Strength Block 1 starts Mon, Oct 19.');
    expect(el.querySelector('pch-matchup-card')).toBeNull();
    // The Plan tab is where planning happens; no shortcut to it here.
    expect(el.querySelector('a[href="/?week=next"]')).toBeNull();
  });

  it('shows disputes to vote on, then the Season, activity or members', async () => {
    const crate = await myCrate(backend, 'Weekend Warriors');
    const el = await render(crate.id);
    expect(el.querySelector('h1')?.textContent).toContain('Weekend Warriors');

    const headings = () => Array.from(el.querySelectorAll('h2')).map((h) => h.textContent?.trim());
    // What needs me first, then what's live, then the rest.
    expect(headings()).toEqual(['Your vote needed', 'This week', 'Standings', 'Weeks', 'Rules']);
    const rules = el.querySelector<HTMLAnchorElement>('a.rules')!;
    expect(rules.getAttribute('href')).toBe(`/crates/${crate.id}/vote`);
    expect(rules.textContent).toContain('3 of 5 voted');
    const views = Array.from(el.querySelectorAll('pch-button-group [role=radio]'));
    expect(views.map((v) => v.textContent?.trim())).toEqual(['Season', 'Activity', 'Peaches']);
    expect(views[0].getAttribute('aria-checked')).toBe('true');
    // Ben disputed one of Ada's workouts; it links to the workout.
    const dispute = el.querySelector<HTMLAnchorElement>('a.dispute-link')!;
    expect(dispute.textContent).toContain('Ben disputed it');
    expect(dispute.getAttribute('href')).toMatch(new RegExp(`^/crates/${crate.id}/logs/`));
    expect(el.querySelectorAll('pch-standings-table tbody tr')).toHaveLength(5);
    expect(el.querySelector('pch-standings-table [aria-current]')?.textContent).toContain('You');

    // Each week once, with my result in it: no separate results or coming-up lists.
    const weeks = Array.from(el.querySelectorAll('.weeks pch-list-row')).map((w) =>
      Array.from(w.querySelectorAll('.stretched, [rowSubtitle]'))
        .map((e) => e.textContent?.trim())
        .join(' '),
    );
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toMatch(/Week 1 · Sep 28 – Oct 4 vs Ben · (Won|Lost|Tie) [\d.]+–[\d.]+/);
    expect(weeks[2]).toBe('Week 3 · Oct 12 – 18 vs Cho');
    expect(weeks[3]).toBe('Bye');
    expect(el.querySelectorAll('pch-matchup-row')).toHaveLength(0);
    // Not a manager: statuses, no Open/Close buttons, no Season FAB.
    expect(el.querySelector('.weeks button')).toBeNull();
    expect(el.querySelector('button[matFab]')).toBeNull();
    // Played and current weeks link to my matchups; later ones don't yet.
    expect(el.querySelectorAll('.weeks a.stretched')).toHaveLength(3);

    await show('activity');
    expect(headings()).toEqual(['Recent workouts', 'Exercises']);
    // Every workout opens: mine to edit, crate-mates' to view and dispute.
    const activity = el.querySelectorAll<HTMLAnchorElement>('.activity a[pch-list-row]');
    expect(activity).toHaveLength(8);
    const hrefs = Array.from(activity).map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.startsWith('/log/'))).toBe(true);
    expect(hrefs.some((h) => h.startsWith(`/crates/${crate.id}/logs/`))).toBe(true);

    // Every exercise members logged, tagged with who: the latest six, then the rest on request.
    const exerciseRows = () =>
      Array.from(el.querySelectorAll('.exercises pch-list-row')).map((r) =>
        r.textContent?.replace(/\s+/g, ' ').trim(),
      );
    expect(exerciseRows()).toHaveLength(6);
    const showAll = el.querySelector<HTMLButtonElement>('button.show-all')!;
    expect(showAll.textContent?.trim()).toMatch(/^Show all \d+$/);
    showAll.click();
    TestBed.tick();
    const exercises = exerciseRows();
    expect(exercises.length).toBeGreaterThan(6);
    expect(showAll.getAttribute('aria-expanded')).toBe('true');
    expect(exercises).toContain('Reservoir hill loop From Ada');
    expect(exercises.some((e) => e?.includes('From you'))).toBe(true);

    await show('peaches');
    expect(headings()).toEqual(['Invite', 'Peaches']);
    // The Crate's description and its invite code live with its members.
    expect(el.textContent).toContain('Every workout counts. Most points each week wins.');
    expect(el.querySelector('button.invite')?.textContent).toContain(`Code ${crate.inviteCode}`);
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
    expect(el.textContent).toContain(
      'No Season yet, so no matchup this week. Start one with the Season button.',
    );
    expect(el.querySelector('button[matFab]')?.textContent).toContain('Season');
    await show('activity');
    expect(el.textContent).toContain('Nothing logged yet.');
  });

  it('a Crate of one adds bots to play against, and can take them out again', async () => {
    const crate = await backend.container.crateService.createCrate({
      ownerPeachId: DEMO_PEACH_ID,
      name: 'Garage Gym',
      now: FIXED_NOW,
    });
    let el = await render(crate.id, 'peaches');
    const headings = () =>
      Array.from(el.querySelectorAll('pch-section')).map((h) => h.textContent?.trim());
    expect(headings()).toEqual(['Invite', 'Peaches', 'Bots']);
    expect(el.querySelector('button.add-bot')?.textContent).toContain('Add a bot');

    // The dialog offers the next free name, then how it trains and what it likes.
    el.querySelector<HTMLButtonElement>('button.add-bot')!.click();
    await settle();
    const ref = TestBed.inject(MatDialog).openDialogs[0];
    const dialog = document.querySelector<HTMLElement>('pch-add-bot-dialog')!;
    expect(dialog.querySelector('input')?.value).toBe('Sprocket');
    const options = Array.from(dialog.querySelectorAll('[role=radio]')).map((b) =>
      b.textContent?.trim(),
    );
    expect(options).toEqual(['Easy', 'Steady', 'Strong', 'All-rounder', 'Lifter', 'Runner']);
    expect(dialog.textContent).toContain('It plays in the next Season you start.');
    const add = ref.componentInstance as AddBotDialog;
    add.level.set('strong');
    add.style.set('runner');
    const closed = firstValueFrom(ref.afterClosed());
    await add.add();
    expect(await closed).toEqual(
      expect.objectContaining({ name: 'Sprocket', level: 'strong', style: 'runner' }),
    );

    el = await render(crate.id, 'peaches');
    const bots = () => Array.from(el.querySelectorAll('.bots pch-list-row'));
    expect(bots().map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'smart_toy Sprocket Bot · Strong runner',
    ]);

    // It plays: in the standings by name, with a matchup against me.
    await backend.container.seasonService.createSeason({
      crate,
      name: 'Me v Sprocket',
      startWeek: '2026-10-19' as LocalDate,
      weeks: 2,
      now: FIXED_NOW,
    });
    el = await render(crate.id);
    expect(el.querySelector('pch-standings-table')?.textContent).toContain('Sprocket');
    expect(el.textContent).toContain('vs Sprocket');

    // Removing takes it out of the Crate (Undo puts it back).
    await show('peaches');
    el.querySelector<HTMLButtonElement>('button[aria-label="Remove Sprocket"]')!.click();
    await settle();
    await fixture.whenStable();
    expect(bots()).toHaveLength(0);
    const stored = (await backend.container.crates.getById(crate.id))!;
    expect(stored.bots[0].removedAt).not.toBeNull();
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
      'vs your opponent',
      null,
      'vs your opponent',
    ]);
    const named = roundViews({
      rounds,
      matchups,
      me: 'me',
      canManage: false,
      today,
      names: new Map([['ada', 'Ada']]),
    });
    expect(named[1].subtitle).toBe('vs Ada');
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
      { value: '2026-10-12', label: 'This week' },
      { value: '2026-10-19', label: 'Next week' },
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
      { weights: categoryWeights({ ride: 100 }), plan: DEFAULT_PLAN_RULES },
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
    expect(el.textContent).toContain('Mon, Oct 19 – Sun, Nov 29');
    // Only its owner so far: every week would be a bye, so say so (with the code).
    expect(el.textContent).toContain('You’re the only Peach here');
    expect(el.textContent).toContain(crate.inviteCode);
    expect(el.textContent).toContain(
      'Ride 100; plans earn +25% when hit and cost 50% of any shortfall',
    );
    const options = Array.from(el.querySelectorAll('[role=radio]')).map((b) =>
      b.textContent?.trim(),
    );
    expect(options).toEqual(['This week', 'Next week']);

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
