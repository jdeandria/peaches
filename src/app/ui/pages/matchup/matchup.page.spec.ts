import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { Matchup } from '../../../domain/models/season';
import { seededBackend, settle, TestBackend } from '../../../../testing/test-app';
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
  const button = (root: ParentNode, name: string | RegExp) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => {
      const label = b.getAttribute('aria-label') ?? text(b.querySelector('.mdc-button__label'));
      return typeof name === 'string' ? label === name : name.test(label ?? '');
    });
  const score = (el: HTMLElement) =>
    text(el.querySelector('.score pch-animated-number .pch-visually-hidden'));

  it('shows the open workout, logs an item and submits', async () => {
    const matchups = await setUp();
    const open = matchups.find((m) => m.status === 'inProgress')!;
    const f = await render(open.id);
    const el: HTMLElement = f.nativeElement;

    expect(text(el.querySelector('h1'))).toBe('You vs Dev');
    expect(text(el.querySelector('.subtitle'))).toMatch(/^Round 5 · Full body · ~\d+ min$/);
    expect(score(el)).toBe('0 pts');
    expect(text(el.querySelector('.banner .pch-body-medium'))).toMatch(
      /^Logging closes in \d+ h · Tue, Oct 13 \d+:\d\d [AP]M$/,
    );
    const headings = Array.from(el.querySelectorAll('h2')).map(text);
    expect(headings).toEqual(['Warm-up', 'Main work', 'Conditioning', 'Cool-down']);
    const labels = Array.from(el.querySelectorAll('pch-section pch-status-label')).map(text);
    expect(labels).toEqual(['Not scored', 'Scored', 'Scored', 'Not scored']);
    expect(el.querySelector('section[aria-label="Main work"] pch-wavy-progress')).not.toBeNull();
    expect(el.querySelector('section[aria-label="Warm-up"] pch-wavy-progress')).toBeNull();

    // Log the first scored exercise as prescribed.
    const main = el.querySelector('section[aria-label="Main work"]')!;
    const log = button(main, /^Log sets: /)!;
    const name = log.getAttribute('aria-label')!.slice('Log sets: '.length);
    log.click();
    await stable(f);
    const sheet = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(sheet.getAttribute('aria-label')).toBe(name);
    button(sheet, 'As prescribed')!.click();
    button(sheet, 'Save')!.click();
    await stable(f);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(score(el)).toBe('10 pts');
    expect(button(main, `Edit sets: ${name}`)).toBeDefined();
    expect(button(main, `Log sets: ${name}`)).toBeUndefined();

    button(el, 'Submit workout')!.click();
    await stable(f);
    expect(document.body.textContent).toContain('Workout submitted. Nice work.');
    expect(button(el, 'Submit workout')).toBeUndefined();
    expect(text(el.querySelector('.banner .pch-body-medium'))).toBe(
      'Submitted. Results arrive when the round closes.',
    );
    // Read-only once submitted.
    expect(button(el, /^(Log|Edit) sets/)).toBeUndefined();
    const log2 = await backend.container.logs.forMatchup(open.id, DEMO_PEACH_ID);
    expect(log2?.status).toBe('submitted');
  });

  it('shows the final score once the round has closed', async () => {
    const matchups = await setUp();
    const done = matchups.find((m) => m.status === 'complete' && m.awayPeachId !== null)!;
    const f = await render(done.id);
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('.final-score'))).toMatch(/^Final ?\d+(\.\d)? – \d+(\.\d)?$/);
    expect(text(el.querySelector('.final > .pch-title-medium'))).toMatch(/^(You won|\w+ won|Tie)$/);
    expect(button(el, 'Submit workout')).toBeUndefined();
    expect(button(el, /^(Log|Edit) sets/)).toBeUndefined();
  });

  it('says when a matchup is not open yet', async () => {
    const matchups = await setUp();
    const later = matchups.find((m) => m.status === 'scheduled' && m.workoutId === null);
    const f = await render(later?.id ?? 'nope');
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Matchup');
    expect(text(el)).toContain('Not open yet');
    expect(text(el)).toContain('The workout appears once the round opens.');
  });
});
