import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DateBadge, parseLocalDate } from './date-badge';
import { formatPoints, StandingsRow, StandingsTable } from './standings-table';
import { Card } from './card';
import { Page } from './page';

describe('parseLocalDate', () => {
  it('parses ISO dates without time zones', () => {
    expect(parseLocalDate('2026-10-16')).toEqual({ year: 2026, month: 10, day: 16, weekday: 5 });
    expect(parseLocalDate('2024-02-29')?.weekday).toBe(4); // Thursday
    expect(parseLocalDate('2000-01-01')?.weekday).toBe(6); // Saturday
    expect(parseLocalDate('2023-01-01')?.weekday).toBe(7); // Sunday
    expect(parseLocalDate('2025-03-03')?.weekday).toBe(1); // Monday
  });

  it('rejects malformed and impossible dates', () => {
    for (const s of ['2023-02-29', '2026-13-01', '2026-00-10', '2026-1-5', 'nope', '', null]) {
      expect(parseLocalDate(s)).toBeNull();
    }
  });
});

describe('DateBadge', () => {
  it('shows weekday and day, with a full accessible label', async () => {
    const f = TestBed.createComponent(DateBadge);
    f.componentRef.setInput('date', '2025-03-03');
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('.weekday')?.textContent).toBe('Mon');
    expect(el.querySelector('.day')?.textContent).toBe('3');
    expect(el.querySelector('.pch-visually-hidden')?.textContent).toBe('Monday, March 3');
  });
});

describe('StandingsTable', () => {
  const row = (peachId: string, name: string, extra: Partial<StandingsRow> = {}): StandingsRow => ({
    peachId,
    name,
    wins: 3,
    losses: 1,
    ties: 0,
    streak: 'W2',
    onWinningStreak: true,
    form: ['loss', 'win', 'win', 'tie', 'win', 'win'],
    pointsFor: 120,
    pointsAgainst: 98.25,
    ...extra,
  });

  it('formats points like Fmt.points', () => {
    expect(formatPoints(12)).toBe('12');
    expect(formatPoints(12.25)).toBe('12.3');
    expect(formatPoints(0)).toBe('0');
  });

  it('renders ranked rows and highlights one', async () => {
    const f = TestBed.createComponent(StandingsTable);
    f.componentRef.setInput('rows', [
      row('p1', 'Ada'),
      row('p2', 'Bo', { streak: '', onWinningStreak: false, form: [] }),
    ]);
    f.componentRef.setInput('highlightPeachId', 'p2');
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    const rows = Array.from(el.querySelectorAll('tbody tr'));
    expect(rows.length).toBe(2);
    const cells = (r: Element) => Array.from(r.children).map((c) => c.textContent?.trim());
    expect(cells(rows[0])).toEqual(['1', 'Ada', '3-1-0', 'W2', '', '120', '98.3']);
    expect(rows[0].querySelector('.hot')).not.toBeNull();
    expect(rows[0].querySelectorAll('.dot').length).toBe(5);
    expect(rows[0].querySelector('.dots')?.getAttribute('aria-label')).toBe(
      'Last 5: Win, Win, Tie, Win, Win',
    );
    expect(cells(rows[1])[3]).toBe('–');
    expect(rows[1].classList).toContain('highlight');
    expect(rows[1].getAttribute('aria-current')).toBe('true');
    expect(rows[0].classList).not.toContain('highlight');
  });

  it('shows an empty state', async () => {
    const f = TestBed.createComponent(StandingsTable);
    f.componentRef.setInput('rows', []);
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).textContent).toContain('No standings yet.');
  });
});

@Component({
  imports: [Card],
  template: `<a pch-card href="/x">Link</a>
    <div pch-card variant="filled">Static</div>`,
})
class CardHost {}

describe('Card', () => {
  it('is interactive on link hosts only', async () => {
    const f = TestBed.createComponent(CardHost);
    await f.whenStable();
    const [a, div] = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.pch-card'));
    expect(a.classList).toContain('pch-card--interactive');
    expect(div.classList).not.toContain('pch-card--interactive');
    expect(div.classList).toContain('pch-card--filled');
  });
});

describe('Page', () => {
  it('renders the headline once and no native title tooltip', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(Page);
    f.componentRef.setInput('title', 'Crates');
    f.componentRef.setInput('subtitle', 'Your groups');
    f.componentRef.setInput('showBack', true);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('h1')?.textContent).toBe('Crates');
    expect(el.textContent).toContain('Your groups');
    expect(el.getAttribute('title')).toBeNull();
    expect(el.querySelector('button[aria-label="Back"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="Refresh"]')).toBeNull();
  });
});
