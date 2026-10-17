import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { activeDestination, Shell } from './shell';

@Component({ template: '' })
class Blank {}

describe('Shell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: Blank }])],
    });
  });

  it('maps URLs to destinations', () => {
    const router = TestBed.inject(Router);
    expect(activeDestination(router, '/')).toBe(0);
    expect(activeDestination(router, '/matchups/m1')).toBe(0);
    expect(activeDestination(router, '/crates')).toBe(1);
    expect(activeDestination(router, '/crates/c1?tab=2')).toBe(1);
    expect(activeDestination(router, '/profile')).toBe(2);
    expect(activeDestination(router, '/sign-in')).toBe(-1);
  });

  it('marks the current destination with aria-current', async () => {
    const f = TestBed.createComponent(Shell);
    await TestBed.inject(Router).navigateByUrl('/crates/abc');
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    const nav = el.querySelector('nav[aria-label="Main"]')!;
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((a) => a.querySelector('.label')?.textContent)).toEqual([
      'Today',
      'Crates',
      'Profile',
    ]);
    expect(links.every((a) => a.querySelector('.icon')?.getAttribute('aria-hidden'))).toBe(true);
    expect(links.map((a) => a.getAttribute('aria-current'))).toEqual([null, 'page', null]);
    expect(links[1].querySelector('.icon')?.classList).toContain('pch-icon-filled');
    expect(links[0].getAttribute('href')).toBe('/');
    expect(el.querySelector('main')).not.toBeNull();
  });
});
