import { TestBed } from '@angular/core/testing';

import { ExerciseCatalog } from '../../../domain/exercises/exercise-catalog';
import { seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import {
  exerciseSubtitle,
  groupExercises,
  isExpanded,
  isFiltering,
  toggleGroup,
} from './exercise-groups';
import { ExercisesPage } from './exercises.page';
import { QuickSetupDialog } from './quick-setup-dialog';
import { MatDialogRef } from '@angular/material/dialog';

const NO_FILTER = { query: '', pattern: null, onlyMine: false } as const;

describe('exercise groups', () => {
  const catalog = ExerciseCatalog.standard();

  it('groups the whole catalog per movement pattern, in taxonomy order, sorted by name', () => {
    const groups = groupExercises(catalog, NO_FILTER, new Set());
    expect(groups.reduce((n, g) => n + g.exercises.length, 0)).toBe(catalog.length);
    expect(groups[0].pattern).toBe('squat');
    for (const g of groups) {
      const names = g.exercises.map((e) => e.name);
      expect(names).toEqual([...names].sort());
      expect(g.exercises.every((e) => e.pattern === g.pattern)).toBe(true);
    }
  });

  it('filters by query, pattern and "I can do" and counts enabled exercises', () => {
    const pistol = groupExercises(catalog, { ...NO_FILTER, query: 'pistol' }, new Set());
    expect(pistol.flatMap((g) => g.exercises.map((e) => e.name))).toContain('Pistol Squat');

    const hinge = groupExercises(catalog, { ...NO_FILTER, pattern: 'hinge' }, new Set());
    expect(hinge.map((g) => g.pattern)).toEqual(['hinge']);

    const able = new Set(['bw-pistol-squat']);
    const mine = groupExercises(catalog, { ...NO_FILTER, onlyMine: true }, able);
    expect(mine).toHaveLength(1);
    expect(mine[0].exercises.map((e) => e.id)).toEqual(['bw-pistol-squat']);
    expect(mine[0].enabled).toBe(1);

    expect(groupExercises(catalog, { ...NO_FILTER, query: 'zzzz' }, able)).toEqual([]);
  });

  it('expands by default only while filtering; toggles invert the default', () => {
    expect(isFiltering(NO_FILTER)).toBe(false);
    expect(isFiltering({ ...NO_FILTER, query: '  ' })).toBe(false);
    expect(isFiltering({ ...NO_FILTER, query: 'row' })).toBe(true);
    expect(isFiltering({ ...NO_FILTER, pattern: 'carry' })).toBe(true);
    expect(isFiltering({ ...NO_FILTER, onlyMine: true })).toBe(true);

    let toggled = toggleGroup(new Set(), 'squat');
    expect(isExpanded(false, toggled, 'squat')).toBe(true);
    expect(isExpanded(false, toggled, 'hinge')).toBe(false);
    expect(isExpanded(true, toggled, 'squat')).toBe(false);
    expect(isExpanded(true, toggled, 'hinge')).toBe(true);
    toggled = toggleGroup(toggled, 'squat');
    expect(toggled.size).toBe(0);
  });

  it('describes level and equipment', () => {
    const pistol = catalog.require('bw-pistol-squat');
    expect(exerciseSubtitle(pistol)).toMatch(/^Level \d · Bodyweight$/);
    const dumbbell = catalog.all.find((e) => e.equipment.includes('dumbbell'))!;
    expect(exerciseSubtitle(dumbbell)).toContain('Dumbbell');
  });
});

describe('ExercisesPage', () => {
  let backend: TestBackend;

  beforeEach(async () => {
    backend = await seededBackend();
    TestBed.configureTestingModule({ providers: backend.providers });
  });

  async function render() {
    const f = TestBed.createComponent(ExercisesPage);
    await settle();
    await f.whenStable();
    return { f, el: f.nativeElement as HTMLElement };
  }

  it('shows the search, the subtitle and collapsed groups', async () => {
    const { el } = await render();
    const search = el.querySelector<HTMLInputElement>('input[type=search]')!;
    expect(search.placeholder).toBe('Search 440 exercises');
    const able = (await backend.container.capabilities.forPeach(DEMO_PEACH_ID)).filter(
      (c) => c.status === 'able',
    ).length;
    expect(el.textContent).toContain(`${able} of 440 enabled for you`);
    const headers = Array.from(el.querySelectorAll('button[aria-expanded]'));
    expect(headers.length).toBeGreaterThan(10);
    expect(headers.every((h) => h.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(el.querySelector('[role=switch]')).toBeNull();
  });

  it('searching expands matching groups; a switch toggles the capability', async () => {
    const { f, el } = await render();
    const search = el.querySelector<HTMLInputElement>('input[type=search]')!;
    search.value = 'Pistol';
    search.dispatchEvent(new Event('input'));
    await f.whenStable();

    const switches = Array.from(el.querySelectorAll<HTMLButtonElement>('[role=switch]'));
    const labelOf = (b: HTMLButtonElement) =>
      // The name is the label minus its aria-hidden subtitle.
      el.querySelector(`#${b.getAttribute('aria-labelledby')} .name`)?.textContent?.trim();
    const pistol = switches.find((b) => labelOf(b) === 'Pistol Squat')!;
    expect(pistol).toBeDefined();
    const before = pistol.getAttribute('aria-checked');

    pistol.click();
    await settle();
    await f.whenStable();
    const cap = (await backend.container.capabilities.forPeach(DEMO_PEACH_ID)).find(
      (c) => c.exerciseId === 'bw-pistol-squat',
    );
    expect(cap?.status).toBe(before === 'true' ? 'unable' : 'able');
    expect(pistol.getAttribute('aria-checked')).not.toBe(before);

    // Collapsing a group while filtering hides its rows.
    const header = el.querySelector<HTMLButtonElement>('button[aria-expanded=true]')!;
    header.click();
    await f.whenStable();
    expect(header.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the empty state when nothing matches', async () => {
    const { f, el } = await render();
    f.componentInstance.query.set('zzzzzz');
    await f.whenStable();
    expect(el.textContent).toContain('No exercises match');
  });
});

describe('QuickSetupDialog', () => {
  it('enables exercises for the chosen equipment and level', async () => {
    const backend = await seededBackend({ seed: false });
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [...backend.providers, { provide: MatDialogRef, useValue: { close } }],
    });
    const f = TestBed.createComponent(QuickSetupDialog);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.textContent).toContain('Up to difficulty level 2');

    // Signed in but with no profile: the auth uid is still the Peach id.
    f.componentInstance.toggle('dumbbell', true);
    await f.componentInstance.apply();
    const expected = ExerciseCatalog.standard()
      .performableWith(new Set(['wall', 'chair', 'dumbbell']))
      .filter((e) => e.difficulty <= 2).length;
    expect(close).toHaveBeenCalledWith(expected);
    const caps = await backend.container.capabilities.forPeach(DEMO_PEACH_ID);
    expect(caps).toHaveLength(expected);
  });
});
