import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Router } from '@angular/router';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { AppState } from '../../../state/app-state';
import { exerciseLogEntry, setLog } from '../../../domain/models/workout-log';
import { FIXED_NOW, seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { TrainPage } from './train.page';

@Component({ template: '' })
class Blank {}

describe('TrainPage', () => {
  let backend: TestBackend;

  async function render(options: { seed?: boolean } = {}): Promise<ComponentFixture<TrainPage>> {
    backend = await seededBackend({ ...options, routes: [{ path: '**', component: Blank }] });
    TestBed.configureTestingModule({ providers: backend.providers });
    const f = TestBed.createComponent(TrainPage);
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

  it('leads with the workout card, then the week, then history by week', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Train');
    expect(text(el.querySelector('.subtitle'))).toBe('Monday, October 12');
    const sections = Array.from(el.querySelectorAll('pch-section h2')).map(text);
    expect(sections).toEqual(['This week', 'History']);

    const card = el.querySelector('pch-card.workout')!;
    expect(text(card.querySelector('h2'))).toBe('Start a workout');
    const cta = card.querySelector('a.workout-cta')!;
    expect(cta.getAttribute('href')).toBe('/log');
    expect(text(cta)).toBe('add Plan a workout');
    // Nothing planned yet: no Edit plan, and matchups live on Compete.
    expect(card.querySelector('a.edit-plan')).toBeNull();
    expect(el.querySelector('pch-matchup-hero-card')).toBeNull();
  });

  it('shows the week’s stats and pledges, and every workout a week at a time', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const stats = Array.from(el.querySelectorAll('.stat')).map((s) => [
      text(s.querySelector('.value')),
      text(s.querySelector('.label')),
    ]);
    expect(stats).toEqual([
      ['0', 'Workouts'],
      ['0', 'Sets'],
      ['0', 'Active min'],
    ]);

    const weeks = Array.from(el.querySelectorAll('h3.week')).map(text);
    expect(weeks[0]).toBe('Last week');
    expect(weeks.length).toBeGreaterThan(1);
    const recent = () => el.querySelectorAll('a[pch-list-row][href^="/log"]');
    expect(recent()).toHaveLength(8);
    expect(recent()[0].getAttribute('href')).toMatch(/^\/log\/.+/);
    expect(text(recent()[0])).toContain('Run');
    expect(text(recent()[0])).toMatch(/\d+ sets?/);
    // Cardio rows sum up by distance, like lifting rows by weight moved.
    expect(text(recent()[0].querySelector('.amount'))).toMatch(/^[\d.]+ km$/);
    // All of them fit before "Show more" is needed.
    expect(el.querySelector('button.show-more')).toBeNull();
  });

  it('starts a saved routine in one tap', async () => {
    const f = await render();
    const routine = await backend.container.routineService.create(
      DEMO_PEACH_ID,
      'Push day',
      [
        exerciseLogEntry({
          exerciseId: 'bw-push-up',
          exerciseName: 'Push Up',
          sets: [setLog({ reps: 20 })],
        }),
      ],
      FIXED_NOW,
    );
    await stable(f);
    const el: HTMLElement = f.nativeElement;
    const chip = Array.from(el.querySelectorAll('.quick a.chip')).find((a) =>
      text(a)?.includes('Push day'),
    )!;
    expect(chip.getAttribute('href')).toBe(`/log?routine=${routine.id}`);
  });

  it('offers to pick a workout in progress back up', async () => {
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
    );
    await stable(f);
    const card = f.nativeElement.querySelector('pch-card.workout');
    expect(text(card.querySelector('h2'))).toBe('Workout in progress');
    expect(text(card)).toContain('1 exercise logged so far.');
    // No sets planned are left: the runner wraps it up.
    const cta = card.querySelector('a.workout-cta');
    expect(text(cta)).toContain('Finish up');
    // Straight back into the runner; Edit plan goes to the planner.
    expect(cta.getAttribute('href')).toBe('/log?mode=log');
    expect(card.querySelector('a.edit-plan').getAttribute('href')).toBe('/log');
    // The draft heads the history, linking back to the log page.
    const first = f.nativeElement.querySelector('a[pch-list-row][href^="/log"]');
    expect(first?.getAttribute('href')).toBe('/log');
    expect(text(first)).toContain('In progress');
    expect(text(f.nativeElement.querySelector('h3.week'))).toBe('This week');
  });

  it('shows a planned workout, then how far through it you are', async () => {
    const f = await render();
    const { container } = backend;
    const draft = await container.loggingService.openDraft(DEMO_PEACH_ID, FIXED_NOW);
    const pushUps = exerciseLogEntry({
      exerciseId: 'bw-push-up',
      exerciseName: 'Push Up',
      sets: [setLog({ reps: 20 }), setLog({ reps: 20 })],
    });
    await container.loggingService.planExercise(draft.id, pushUps);
    await stable(f);
    const card = () => f.nativeElement.querySelector('pch-card.workout');
    expect(text(card().querySelector('h2'))).toBe('Workout planned');
    expect(text(card())).toContain('1 exercise, 2 sets.');
    const start = card().querySelector('a.workout-cta');
    expect(text(start)).toContain('Start');
    expect(start.getAttribute('href')).toBe('/log?mode=log');

    await container.loggingService.logSet(draft.id, 'bw-push-up', setLog({ reps: 18 }), FIXED_NOW);
    await stable(f);
    expect(text(card().querySelector('h2'))).toBe('Workout in progress');
    expect(text(card())).toContain('1 of 2 sets done.');
    expect(text(card().querySelector('a.workout-cta'))).toContain('Continue');
    expect(card().querySelector('pch-wavy-progress')).not.toBeNull();
  });

  it('swipes a workout left to delete it (with Undo), right to edit it', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const toast = vi.spyOn(TestBed.inject(AppState), 'toast').mockImplementation(() => undefined);
    const rows = () => Array.from(el.querySelectorAll<HTMLElement>('pch-swipe-row'));
    const hrefs = () => rows().map((r) => r.querySelector('a')!.getAttribute('href'));
    const before = hrefs();
    const swipe = (row: HTMLElement, to: number) => {
      const content = row.querySelector<HTMLElement>('.content')!;
      let t = 0;
      const fire = (type: string, x: number) => {
        const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 10 });
        Object.defineProperties(e, {
          pointerId: { value: 1 },
          pointerType: { value: 'touch' },
          timeStamp: { value: (t += 16) },
        });
        content.dispatchEvent(e);
      };
      fire('pointerdown', 200);
      for (let i = 1; i <= 10; i++) fire('pointermove', 200 + (to * i) / 10);
      fire('pointerup', 200 + to);
    };

    swipe(rows()[0], -200);
    await settle(400);
    await stable(f);
    const id = before[0]!.split('/').pop()!;
    expect(await backend.container.logs.getById(id)).toBeNull();
    expect(hrefs()).not.toContain(before[0]);
    const [message, undo] = toast.mock.calls[0];
    expect(message).toMatch(/^Deleted .+’s workout\.$/);
    undo!();
    await stable(f);
    expect(hrefs()).toEqual(before);

    swipe(rows()[1], 200);
    await stable(f);
    expect(TestBed.inject(Router).url).toBe(before[1]);
  });

  it('invites a new Peach to log, with empty history', async () => {
    const f = await render({ seed: false });
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('pch-card.workout h2'))).toBe('Start a workout');
    expect(el.querySelector('.quick')).toBeNull();
    expect(text(el)).toContain('Nothing logged yet.');
    expect(el.querySelector('.pledges')).toBeNull();
    expect(Array.from(el.querySelectorAll('.stat .value')).map(text)).toEqual(['0', '0', '0']);
  });
});
