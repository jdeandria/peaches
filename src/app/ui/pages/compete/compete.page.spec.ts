import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { seededBackend, settle } from '../../../../testing/test-app';
import { CompetePage } from './compete.page';

@Component({ template: '' })
class Blank {}

describe('CompetePage', () => {
  async function render(options: { seed?: boolean } = {}): Promise<ComponentFixture<CompetePage>> {
    const backend = await seededBackend({ ...options, routes: [{ path: '**', component: Blank }] });
    TestBed.configureTestingModule({ providers: backend.providers });
    const f = TestBed.createComponent(CompetePage);
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

  it('leads with what needs me, then this week’s matchup as a hero card', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Compete');
    expect(text(el.querySelector('.subtitle'))).toBe('A matchup this week');
    const sections = Array.from(el.querySelectorAll('pch-section h2')).map(text);
    expect(sections).toEqual(['This week', 'Coming up', 'Results']);

    // Lineups for next week are open and I haven't set mine: one card each,
    // told apart by Crate, week and opponent.
    const lineups = Array.from(el.querySelectorAll('pch-card.lineup'));
    expect(lineups.length).toBeGreaterThan(0);
    for (const lineup of lineups) {
      expect(text(lineup.querySelector('h2'))).toBe('Set your lineup for Oct 19 – 25');
      expect(lineup.querySelector('a')?.getAttribute('href')).toMatch(/^\/matchups\/.+\/lineup$/);
    }
    expect(lineups.map((l) => text(l.querySelector('p'))).join(' ')).toContain(
      'Lunch Break Lifters · vs Cho',
    );
    // They come before the matchups.
    const hero = el.querySelector('pch-matchup-hero-card')!;
    expect(
      lineups[0].compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(el.querySelectorAll('pch-matchup-hero-card')).toHaveLength(1);
    expect(text(hero.querySelector('h3'))).toBe('vs Cho');
    expect(text(hero)).toContain('Week 3 · Oct 12 – 18');
    expect(text(hero)).toContain('Weekend Warriors');
    expect(text(hero)).toContain('closes in 6 d');
    // Cho has logged this week already; I haven't.
    expect(text(hero)).toContain('Trailing');
    expect(text(hero)).toContain('35.8');
    const cta = hero.querySelector<HTMLAnchorElement>('a')!;
    expect(text(cta)).toContain('View matchup');
    expect(cta.getAttribute('href')).toMatch(/^\/matchups\/.+/);
    // The only interactive element in the card is the link.
    expect(hero.querySelectorAll('a, button')).toHaveLength(1);
  });

  it('lists what is coming in date order, then results with the record', async () => {
    const f = await render();
    const el: HTMLElement = f.nativeElement;
    const [coming, results] = Array.from(el.querySelectorAll('pch-list-card'));

    const rows = Array.from(coming.querySelectorAll('pch-matchup-row'));
    expect(rows).toHaveLength(4);
    const days = rows.map((r) => Number(text(r.querySelector('pch-date-badge .day'))));
    expect(days).toEqual([19, 19, 26, 26]);
    const cho = rows.find((r) => text(r.querySelector('.headline')) === 'vs Cho')!;
    expect(text(cho.querySelector('.subtitle'))).toBe('Lunch Break Lifters · Oct 19 – 25');
    expect(rows.some((r) => text(r.querySelector('.headline')) === 'Bye round')).toBe(true);
    expect(rows.every((r) => r.querySelector('a[href^="/matchups/"]'))).toBe(true);

    const played = Array.from(results.querySelectorAll('pch-matchup-row'));
    expect(played).toHaveLength(2);
    expect(played.every((r) => /Lost|Won|Tie/.test(text(r) ?? ''))).toBe(true);
    // The latest week first.
    expect(text(played[0].querySelector('.subtitle'))).toContain('Oct 5 – 11');
    expect(text(el.querySelector('.record'))).toBe('0-2');
  });

  it('points a Peach with no matchups to Crates', async () => {
    const f = await render({ seed: false });
    const el: HTMLElement = f.nativeElement;
    expect(text(el)).toContain('No matchups yet');
    expect(el.querySelector('a[href="/crates"]')).not.toBeNull();
    expect(el.querySelector('pch-matchup-hero-card')).toBeNull();
  });
});
