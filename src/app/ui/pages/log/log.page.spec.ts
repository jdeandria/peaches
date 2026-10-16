import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { isSubmitted } from '../../../domain/models/workout-log';
import { seededBackend, settle, TestBackend } from '../../../../testing/test-app';
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

  async function render(inputs: { logId?: string; routine?: string } = {}) {
    const f = TestBed.createComponent(LogPage);
    if (inputs.logId) f.componentRef.setInput('logId', inputs.logId);
    if (inputs.routine) f.componentRef.setInput('routine', inputs.routine);
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

  it('logs a run solo and shows what it is worth in each Crate', async () => {
    const { f, el } = await render();
    expect(text(el.querySelector('h1'))).toBe('Log a workout');
    expect(text(el.querySelector('.subtitle'))).toBe('Counts in 2 Crates');
    expect(text(el)).toContain('What did you do?');
    expect(button(el, 'Finish workout')).toBeUndefined();

    // Pick "Run" from the catalog.
    button(el, 'Add exercise')!.click();
    await stable(f);
    type(overlay().querySelector<HTMLInputElement>('input[type=search]')!, 'run');
    await stable(f);
    const run = Array.from(overlay().querySelectorAll<HTMLButtonElement>('button.row')).find(
      (b) => text(b.querySelector('.pch-body-large')) === 'Run',
    )!;
    run.click();
    await stable(f);

    // Five kilometres in 25 minutes.
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

    // Finish: confirm the session length and submit.
    button(el, 'Finish workout')!.click();
    await stable(f);
    const session = overlay().querySelector<HTMLInputElement>('input[inputmode=numeric]')!;
    type(session, '30');
    await stable(f);
    button(overlay(), 'Submit')!.click();
    await stable(f);

    const [log] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    expect(isSubmitted(log)).toBe(true);
    expect(log.durationMinutes).toBe(30);
    expect(log.sharedWith).toHaveLength(2);
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('follows a Crate routine', async () => {
    const crates = await backend.container.crates.membershipsFor(DEMO_PEACH_ID);
    const routines = (
      await Promise.all(crates.map((m) => backend.container.library.routines(m.crateId)))
    ).flat();
    const sweat = routines.find((r) => r.name === 'Saturday sweat')!;
    const { f, el } = await render({ routine: sweat.id });
    expect(text(el.querySelector('.subtitle'))).toBe('Following “Saturday sweat”');
    const planned = () =>
      Array.from(el.querySelectorAll('.item .pch-title-medium')).map((n) => text(n));
    expect(planned()).toEqual(['Burpee', 'Push Up', 'Bodyweight Squat']);

    button(el, 'Log sets: Burpee')!.click();
    await stable(f);
    expect(text(overlay())).toContain('Target: 3 × 15 reps');
    button(overlay(), 'Save')!.click();
    await stable(f);

    const headings = Array.from(el.querySelectorAll('h2')).map(text);
    expect(headings).toEqual(['Up next', 'Logged']);
    expect(planned()).toEqual(['Push Up', 'Bodyweight Squat', 'Burpee']);
    const [draft] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    expect(draft.routineId).toBe(sweat.id);
    expect(draft.entries[0].sets.map((s) => s.reps)).toEqual([15, 15, 15]);
  });

  it('shows a submitted workout read-only, with a way to share it as a routine', async () => {
    const [latest] = await backend.container.logs.forPeach(DEMO_PEACH_ID);
    const { el } = await render({ logId: latest.id });
    expect(text(el.querySelector('h1'))).toBe('Sun, Oct 11');
    expect(text(el)).toContain('Run');
    expect(button(el, 'Add exercise')).toBeUndefined();
    expect(button(el, 'Finish workout')).toBeUndefined();
    expect(el.querySelector('button[aria-label="Share as a routine"]')).not.toBeNull();
  });

  it('says when a workout does not exist', async () => {
    const { el } = await render({ logId: 'nope' });
    expect(text(el)).toContain('Workout not found');
  });
});
