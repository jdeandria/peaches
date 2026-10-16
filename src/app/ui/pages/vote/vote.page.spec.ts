import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { Crate } from '../../../domain/models/crate';
import { seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { VotePage } from './vote.page';

@Component({ template: '' })
class Blank {}

describe('VotePage', () => {
  let backend: TestBackend;

  beforeEach(async () => {
    backend = await seededBackend({ routes: [{ path: '**', component: Blank }] });
    TestBed.configureTestingModule({ providers: backend.providers });
  });

  async function crate(name: string): Promise<Crate> {
    for (const m of await backend.container.crates.membershipsFor(DEMO_PEACH_ID)) {
      const c = await backend.container.crates.getById(m.crateId);
      if (c?.name === name) return c;
    }
    throw new Error(`No crate ${name}`);
  }

  async function render(crateId: string) {
    const f = TestBed.createComponent(VotePage);
    f.componentRef.setInput('crateId', crateId);
    await stable(f);
    return { f, el: f.nativeElement as HTMLElement };
  }

  async function stable(f: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await settle();
      await f.whenStable();
    }
  }

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
  const button = (root: ParentNode, name: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => (b.getAttribute('aria-label') ?? text(b)) === name,
    )!;
  const values = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLInputElement>('.category input')).map((i) => i.value);

  it('starts from the Crate’s tally and casts a full-budget vote', async () => {
    const warriors = await crate('Weekend Warriors');
    const { f, el } = await render(warriors.id);
    expect(text(el.querySelector('h1'))).toBe('What counts');
    expect(text(el.querySelector('.subtitle'))).toBe('Weekend Warriors · 3 of 5 voted');
    // I haven't voted: my draft is the Crate's current tally.
    expect(values(el)).toEqual(['23', '4', '3', '18', '27', '25']);
    expect(text(el.querySelector('.budget'))).toContain('All 100 points given');
    expect(text(el)).toContain('per 5 km · Crate 23 · this Season 23');
    expect(text(el)).toContain('keeps the weights it started with');
    // Not the owner: no grace period.
    expect(text(el)).not.toContain('Grace period');

    // Take rides down (a step is 5, but only 4 are there): 4 left, so no vote yet.
    button(el, 'Less for Ride').click();
    await stable(f);
    expect(text(el.querySelector('.budget'))).toContain('4 points left to give');
    expect(button(el, 'Cast my vote').disabled).toBe(true);
    // More can't exceed what's left.
    button(el, 'More for Reps').click();
    button(el, 'More for Reps').click();
    await stable(f);
    expect(values(el)).toEqual(['23', '0', '3', '18', '31', '25']);

    button(el, 'Cast my vote').click();
    await stable(f);
    const ballots = await backend.container.votingService.ballotsOf(warriors.id);
    const mine = ballots.find((b) => b.peachId === DEMO_PEACH_ID)!;
    expect(mine.weights.reps).toBe(31);
    expect(text(el.querySelector('.subtitle'))).toBe('Weekend Warriors · 4 of 5 voted');
    expect(button(el, 'Update my vote')).toBeDefined();
  });

  it('even split, and the owner’s grace period', async () => {
    const lifters = await crate('Lunch Break Lifters');
    const { f, el } = await render(lifters.id);
    // My earlier vote, not the tally.
    expect(values(el)).toEqual(['0', '0', '0', '60', '30', '10']);
    button(el, 'Even split').click();
    await stable(f);
    expect(values(el)).toEqual(['17', '17', '17', '17', '16', '16']);

    expect(text(el)).toContain('6 h after Sunday');
    button(el, 'Longer grace period').click();
    await stable(f);
    button(el, 'Save').click();
    await stable(f);
    expect((await backend.container.crates.getById(lifters.id))?.settings.loggingGraceHours).toBe(
      7,
    );
  });
});
