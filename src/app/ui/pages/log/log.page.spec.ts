import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { AppState } from '../../../state/app-state';
import { exerciseLogEntry, isSubmitted, setLog } from '../../../domain/models/workout-log';
import { FIXED_NOW, seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { LogPage } from './log.page';

@Component({ template: '' })
class Blank {}

describe('LogPage', () => {
  let backend: TestBackend;

  beforeEach(async () => {
    backend = await seededBackend({ routes: [{ path: '**', component: Blank }] });
    TestBed.configureTestingModule({
      providers: [
        ...backend.providers,
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(MatBottomSheet).dismiss();
    TestBed.inject(MatDialog).closeAll();
  });

  async function render(inputs: { logId?: string } = {}) {
    const f = TestBed.createComponent(LogPage);
    if (inputs.logId) f.componentRef.setInput('logId', inputs.logId);
    await stable(f);
    return { f, el: f.nativeElement as HTMLElement };
  }

  async function stable(f: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await settle();
      TestBed.tick();
      await f.whenStable();
    }
  }

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
  const button = (root: ParentNode, name: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => (b.getAttribute('aria-label') ?? text(b)) === name || text(b)?.endsWith(name),
    );
  const overlay = () => document.querySelector<HTMLElement>('.cdk-overlay-container')!;
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  const pick = async (f: ComponentFixture<unknown>, el: HTMLElement, search: string) => {
    button(el, 'Add exercise')!.click();
    await stable(f);
    type(overlay().querySelector<HTMLInputElement>('input[type=search]')!, search);
    await stable(f);
  };
  const rows = () => Array.from(overlay().querySelectorAll<HTMLButtonElement>('button.row'));

  it('times the session, logs a run and finishes in one tap', async () => {
    const { f, el } = await render();
    expect(text(el.querySelector('h1'))).toBe('Log a workout');
    expect(text(el.querySelector('.subtitle'))).toBe('Counts in 2 Crates');
    expect(text(el.querySelector('.clock'))).toContain('0:00');
    expect(text(el.querySelector('.clock'))).toContain('Runs while this screen is open');
    expect(text(el)).toContain('What are you doing?');
    expect(button(el, 'Finish · 0:00')).toBeUndefined();
    // The clock started when the screen opened.
    const [draft] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    expect(draft.timerStartedAt).not.toBeNull();

    // Pick "Run" from the catalog.
    await pick(f, el, 'run');
    rows()
      .find((b) => text(b.querySelector('.pch-body-large')) === 'Run')!
      .click();
    await stable(f);

    // Last time's run is already filled in; make it five kilometres in 25 minutes.
    const [distance, minutes] = Array.from(
      overlay().querySelectorAll<HTMLInputElement>('input[inputmode=decimal]'),
    );
    type(distance, '5');
    type(minutes, '25');
    await stable(f);
    button(overlay(), 'Save')!.click();
    await stable(f);

    expect(text(el.querySelector('.item'))).toContain('Run');
    expect(text(el.querySelector('.item'))).toContain('1 set · 5 km · 25:00');
    const totals = Array.from(el.querySelectorAll('.total')).map((t) =>
      Array.from(t.querySelectorAll('.pch-title-medium, .pch-label-small')).map(text),
    );
    expect(totals).toEqual([
      ['5 km', 'Run & walk'],
      ['25 min', 'Active minutes'],
    ]);
    // Weekend Warriors' Season is under way: 5 km at 23 + 25 min at 25 per 45.
    expect(text(el.querySelector('.points'))).toBe('36.9 pts in Weekend Warriors');
    // This week's pledges, counting the run.
    expect(text(el.querySelector('.pledges'))).toContain('Run & walk');

    button(el, 'Finish · 0:00')!.click();
    await stable(f);
    const log = (await backend.container.logs.getById(draft.id))!;
    expect(isSubmitted(log)).toBe(true);
    expect(log.timerStartedAt).toBeNull();
    expect(log.sharedWith).toHaveLength(2);
    expect(TestBed.inject(Router).url).toBe(`/log/${draft.id}`);
  });

  it('leads with recent exercises and crate-mates’ ones, tagged with who', async () => {
    const { f, el } = await render();
    button(el, 'Add exercise')!.click();
    await stable(f);
    const groups = Array.from(overlay().querySelectorAll('h3.group')).map(text);
    expect(groups).toEqual(['Recent', 'From your Crates', 'All exercises']);
    expect(text(overlay())).toContain('Last time:');
    expect(text(overlay())).toContain('From Ada');
  });

  it('makes up an exercise on the spot', async () => {
    const { f, el } = await render();
    await pick(f, el, 'Rucking');
    rows()
      .find((b) => text(b)?.includes('Create “Rucking”'))!
      .click();
    await stable(f);
    rows()
      .find((b) => text(b)?.endsWith('Reps with weight'))!
      .click();
    await stable(f);
    button(overlay(), 'Save')!.click();
    await stable(f);
    const [draft] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    expect(draft.entries[0]).toMatchObject({
      exerciseName: 'Rucking',
      track: 'reps',
      takesLoad: true,
    });
    expect(draft.entries[0].exerciseId.startsWith('custom-')).toBe(true);
  });

  it('a finished workout stays editable, time included', async () => {
    const [latest] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    const { f, el } = await render({ logId: latest.id });
    expect(text(el.querySelector('h1'))).toBe('Sun, Oct 11');
    expect(text(el)).toContain('Run');
    expect(text(el.querySelector('.clock'))).toContain('Session time');
    expect(button(el, 'Add exercise')).toBeDefined();
    expect(
      Array.from(el.querySelectorAll('button')).some((b) => text(b)?.startsWith('Finish')),
    ).toBe(false);

    button(el, 'Edit details')!.click();
    await stable(f);
    type(overlay().querySelector<HTMLInputElement>('input[inputmode=numeric]')!, '50');
    await stable(f);
    button(overlay(), 'Save')!.click();
    await stable(f);
    expect((await backend.container.logs.getById(latest.id))!.durationSeconds).toBe(3000);
  });

  it('resumes a finished workout, clock and all', async () => {
    const [latest] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    const { f, el } = await render({ logId: latest.id });
    button(el, 'Resume')!.click();
    await stable(f);
    expect(TestBed.inject(Router).url).toBe('/log');
    expect((await backend.container.logs.getById(latest.id))!.status).toBe('inProgress');
    f.destroy();

    // The log screen picks it up where it stopped, as the workout under way.
    const { el: resumed } = await render();
    expect(text(resumed.querySelector('h1'))).toBe('Sun, Oct 11');
    expect(text(resumed.querySelector('.subtitle'))).toContain('Resumed');
    expect(text(resumed.querySelector('.clock'))).toContain('Runs while this screen is open');
    expect(text(resumed)).toContain('Run');
    expect(
      Array.from(resumed.querySelectorAll('button')).some((b) => text(b)?.includes('Finish · ')),
    ).toBe(true);
    const log = (await backend.container.logs.getById(latest.id))!;
    expect(log.timerStartedAt).not.toBeNull();
    expect(log.durationSeconds).toBe(latest.durationSeconds);
  });

  it('counts a resumed workout toward this week’s pledges once', async () => {
    const logging = backend.container.loggingService;
    const log = await logging.startLog(DEMO_PEACH_ID, new Date(FIXED_NOW.getTime() - 3_600_000));
    await logging.recordEntry(
      log.id,
      exerciseLogEntry({
        exerciseId: 'bw-run',
        distanceKind: 'runWalk',
        sets: [setLog({ meters: 3000, seconds: 900 })],
      }),
    );
    await logging.submit(log.id, FIXED_NOW);
    await logging.resume(log.id);
    const { el } = await render();
    const run = Array.from(el.querySelectorAll('.pledge')).find((p) =>
      text(p)?.includes('Run & walk'),
    );
    expect(text(run)).toContain('3 km of');
  });

  it('removes an exercise at once, with Undo to put it back', async () => {
    const log = (await backend.container.logs.forPeach(DEMO_PEACH_ID)).find(
      (l) => isSubmitted(l) && l.entries.length > 1,
    )!;
    const [first] = log.entries;
    const toast = vi.spyOn(TestBed.inject(AppState), 'toast').mockImplementation(() => undefined);
    const { f, el } = await render({ logId: log.id });

    button(el, `Remove ${first.exerciseName}`)!.click();
    await stable(f);
    let saved = (await backend.container.logs.getById(log.id))!;
    expect(saved.entries.map((e) => e.exerciseId)).not.toContain(first.exerciseId);
    expect(toast).toHaveBeenCalledWith(`Removed ${first.exerciseName}.`, expect.any(Function));

    toast.mock.calls[0][1]!();
    await stable(f);
    saved = (await backend.container.logs.getById(log.id))!;
    expect(saved.entries.find((e) => e.exerciseId === first.exerciseId)).toEqual(first);
  });

  it('says when a workout does not exist', async () => {
    const { el } = await render({ logId: 'nope' });
    expect(text(el)).toContain('Workout not found');
  });
});
