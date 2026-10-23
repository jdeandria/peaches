import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { exerciseLogEntry, setLog } from '../../../domain/models/workout-log';
import { AppState } from '../../../state/app-state';
import { Pwa } from '../../../state/pwa';
import { APP_VERSION } from '../../../version';
import { FIXED_NOW, seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { PersonalPage } from './personal.page';

@Component({ template: '' })
class Blank {}

describe('PersonalPage', () => {
  let backend: TestBackend;
  const pwa = { canInstall: signal(false), install: vi.fn(async () => true) };

  async function render(
    options: { seed?: boolean; signedIn?: boolean; view?: string } = {},
  ): Promise<ComponentFixture<PersonalPage>> {
    backend = await seededBackend({ ...options, routes: [{ path: '**', component: Blank }] });
    TestBed.configureTestingModule({
      providers: [...backend.providers, { provide: Pwa, useValue: pwa }],
    });
    const f = TestBed.createComponent(PersonalPage);
    if (options.view) f.componentRef.setInput('view', options.view);
    await stable(f);
    return f;
  }

  async function stable(f: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await settle();
      await f.whenStable();
    }
  }

  beforeEach(() => {
    pwa.canInstall.set(false);
    pwa.install.mockClear();
  });

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
  const sections = (el: HTMLElement) => Array.from(el.querySelectorAll('pch-section h2')).map(text);
  const button = (el: HTMLElement, label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      text(b)?.includes(label),
    )!;

  it('shows who you are, then your stats', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('You');
    expect(text(el.querySelector('pch-card.identity h2'))).toBe('You');
    expect(text(el.querySelector('pch-card.identity'))).toContain('2 Crates');
    const views = Array.from(el.querySelectorAll('pch-button-group.views [role=radio]'));
    expect(views.map(text)).toEqual(['Stats', 'History', 'Gear', 'Settings']);
    expect(views[0].getAttribute('aria-checked')).toBe('true');
    expect(sections(el)).toEqual(['This week', 'Plan kept', 'Workouts per week', 'Records']);

    // This Monday morning's workout, done at 7.
    const stats = Array.from(el.querySelectorAll('.stat')).map((s) => [
      text(s.querySelector('.value')),
      text(s.querySelector('.label')),
    ]);
    expect(stats).toEqual([
      ['1', 'Workout'],
      ['9', 'Sets'],
      ['60', 'Active min'],
    ]);
    // The two weeks planned so far, each with a bar.
    expect(text(el.querySelector('.kept-summary'))).toMatch(
      /^\d+ of \d+ planned workouts done in the last 4 weeks$/,
    );
    expect(el.querySelectorAll('.bars .bar')).toHaveLength(2);
    const weeks = Array.from(el.querySelectorAll('.week-row .week-label')).map(text);
    expect(weeks.slice(0, 2)).toEqual(['This week', 'Last week']);
    expect(weeks).toHaveLength(6);
    // Personal bests from the seeded workouts.
    expect(text(el)).toContain('Heaviest lifts');
    expect(text(el)).toContain('Longest run or walk');
  });

  it('switches views through the URL', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const history = Array.from(el.querySelectorAll<HTMLButtonElement>('[role=radio]')).find(
      (b) => text(b) === 'History',
    )!;
    history.click();
    await stable(f);
    expect(TestBed.inject(Router).url).toBe('/?view=history');
  });

  it('lists every workout a week at a time', async () => {
    const f = await render({ view: 'history' });
    const el: HTMLElement = f.nativeElement;
    const weeks = Array.from(el.querySelectorAll('h3.week')).map(text);
    expect(weeks[0]).toBe('This week');
    expect(weeks.length).toBeGreaterThan(1);
    const rows = el.querySelectorAll('a[pch-list-row][href^="/log"]');
    expect(rows).toHaveLength(9);
    expect(rows[0].getAttribute('href')).toMatch(/^\/log\/.+/);
    expect(text(rows[0])).toMatch(/\d+ sets?/);
    // Cardio rows sum up by distance, like lifting rows by weight moved.
    expect(text(rows[0].querySelector('.amount'))).toMatch(/^[\d.,]+ (km|kg)$/);
    expect(el.querySelector('button.show-more')).toBeNull();
  });

  it('marks a workout in progress at the top of the history', async () => {
    const f = await render({ view: 'history' });
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
    const first = f.nativeElement.querySelector('a[pch-list-row][href^="/log"]');
    expect(first?.getAttribute('href')).toBe('/log');
    expect(text(first)).toContain('In progress');
    expect(text(f.nativeElement.querySelector('h3.week'))).toBe('This week');
  });

  it('swipes a workout left to delete it (with Undo), right to edit it', async () => {
    const f = await render({ view: 'history' });
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

  it('adds a location from a preset, edits it and deletes it with Undo', async () => {
    const f = await render({ view: 'equipment' });
    const el: HTMLElement = f.nativeElement;
    const toast = vi.spyOn(TestBed.inject(AppState), 'toast').mockImplementation(() => undefined);
    expect(sections(el)).toEqual(['Where you train']);
    expect(text(el.querySelector('.no-locations'))).toContain('No locations yet.');

    button(el, 'Add a location').click();
    await stable(f);
    const dialog = () => document.querySelector<HTMLElement>('pch-location-dialog')!;
    /** Saves the dialog and waits for it to close. */
    const submit = async () => {
      dialog().querySelector('form')!.requestSubmit();
      await settle(400);
      await stable(f);
    };
    expect(text(dialog().querySelector('h2'))).toBe('New location');
    button(dialog(), 'Home').click();
    await stable(f);
    const pressed = () =>
      Array.from(dialog().querySelectorAll('.chip[aria-pressed="true"]')).map(text);
    expect(pressed()).toContain('check Dumbbells');
    // Bodyweight goes everywhere; nothing else needs choosing.
    await submit();
    const saved = async () => (await backend.container.peaches.getById(DEMO_PEACH_ID))!.locations;
    const [home] = await saved();
    expect(home.name).toBe('Home');
    expect(home.equipment).toEqual([
      'dumbbell',
      'resistanceBand',
      'pullUpBar',
      'bench',
      'wall',
      'chair',
    ]);
    const row = () => el.querySelector('.locations pch-list-row');
    expect(text(row())).toContain('Home');
    expect(text(row())).toContain('Dumbbells, Resistance bands and 4 more');

    // Editing keeps the id; a name can't be blank.
    el.querySelector<HTMLButtonElement>('button[aria-label="Edit Home"]')!.click();
    await stable(f);
    const name = dialog().querySelector<HTMLInputElement>('input')!;
    name.value = ' ';
    name.dispatchEvent(new Event('input'));
    await stable(f);
    expect(button(dialog(), 'Save').disabled).toBe(true);
    expect(text(dialog())).toContain('Give it a name.');
    name.value = 'Garage';
    name.dispatchEvent(new Event('input'));
    await stable(f);
    await submit();
    expect((await saved()).map((l) => [l.id, l.name])).toEqual([[home.id, 'Garage']]);

    el.querySelector<HTMLButtonElement>('button[aria-label="Delete Garage"]')!.click();
    await stable(f);
    expect(await saved()).toEqual([]);
    const [message, undo] = toast.mock.calls.at(-1)!;
    expect(message).toBe('Deleted Garage.');
    undo!();
    await stable(f);
    expect((await saved()).map((l) => l.name)).toEqual(['Garage']);
  });

  it('shows settings: units, version, and no sign out in the demo', async () => {
    const f = await render({ view: 'settings' });
    const el: HTMLElement = f.nativeElement;
    expect(text(el)).toContain(`Version ${APP_VERSION}`);
    // The demo cannot sign out, and the browser offered no install prompt.
    expect(text(el)).not.toContain('Sign out');
    expect(text(el)).not.toContain('Install app');
    // Exercises are added by logging them (decision #21); nothing links to a library.
    expect(el.querySelector('a[href="/exercises"]')).toBeNull();

    const imperial = Array.from(el.querySelectorAll<HTMLButtonElement>('[role=radio]')).find(
      (b) => text(b) === 'Imperial',
    )!;
    imperial.click();
    await stable(f);
    expect(imperial.getAttribute('aria-checked')).toBe('true');
    expect((await backend.container.peaches.getById(DEMO_PEACH_ID))?.units).toBe('imperial');
  });

  it('offers to install the app when the browser allows it', async () => {
    const f = await render({ view: 'settings' });
    pwa.canInstall.set(true);
    await stable(f);
    button(f.nativeElement, 'Install app').click();
    expect(pwa.install).toHaveBeenCalled();
  });

  it('starts empty for a new Peach', async () => {
    const f = await render({ seed: false });
    const el: HTMLElement = f.nativeElement;
    expect(Array.from(el.querySelectorAll('.stat .value')).map(text)).toEqual(['0', '0', '0']);
    expect(text(el)).toContain('Plan your weeks on the Plan tab');
    expect(text(el)).toContain('Your personal bests show up here');
  });

  it('says when nobody is signed in', async () => {
    const f = await render({ signedIn: false });
    expect(text(f.nativeElement)).toContain('Not signed in');
  });
});
