import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { Pwa } from '../../../state/pwa';
import { APP_VERSION } from '../../../version';
import { seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { ProfilePage } from './profile.page';

describe('ProfilePage', () => {
  let backend: TestBackend;
  const pwa = { canInstall: signal(false), install: vi.fn(async () => true) };

  async function render(options: { signedIn?: boolean } = {}) {
    backend = await seededBackend(options);
    TestBed.configureTestingModule({
      providers: [...backend.providers, { provide: Pwa, useValue: pwa }],
    });
    const f = TestBed.createComponent(ProfilePage);
    await settle();
    await f.whenStable();
    return { f, el: f.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    pwa.canInstall.set(false);
    pwa.install.mockClear();
  });

  it('shows the seeded Peach', async () => {
    const { el } = await render();
    expect(el.querySelector('h1')?.textContent).toBe('Profile');
    expect(el.querySelector('pch-card h2')?.textContent).toBe('You');
    expect(el.textContent).toContain('2 Crates');
    expect(el.textContent).toContain('Fit');
    const able = (await backend.container.capabilities.forPeach(DEMO_PEACH_ID)).filter(
      (c) => c.status === 'able',
    ).length;
    expect(el.textContent).toContain(`${able} exercises you can do`);
    expect(el.querySelector('a[href="/exercises"]')).not.toBeNull();
    expect(el.textContent).toContain(`Version ${APP_VERSION}`);
    // The demo cannot sign out, and the browser offered no install prompt.
    expect(el.textContent).not.toContain('Sign out');
    expect(el.textContent).not.toContain('Install app');
  });

  it('switches units and saves the fitness level', async () => {
    const { f, el } = await render();
    const imperial = Array.from(el.querySelectorAll<HTMLButtonElement>('[role=radio]')).find(
      (b) => b.textContent?.trim() === 'Imperial',
    )!;
    imperial.click();
    await settle();
    await f.whenStable();
    expect(imperial.getAttribute('aria-checked')).toBe('true');
    expect((await backend.container.peaches.getById(DEMO_PEACH_ID))?.units).toBe('imperial');

    const peach = (await backend.container.peaches.getById(DEMO_PEACH_ID))!;
    await f.componentInstance.saveLevel(peach, 5);
    await settle();
    await f.whenStable();
    expect((await backend.container.peaches.getById(DEMO_PEACH_ID))?.fitnessLevel).toBe(5);
    expect(el.textContent).toContain('Advanced');
  });

  it('offers to install the app when the browser allows it', async () => {
    const { f, el } = await render();
    pwa.canInstall.set(true);
    await f.whenStable();
    const install = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Install app'),
    )!;
    install.click();
    expect(pwa.install).toHaveBeenCalled();
  });

  it('says when nobody is signed in', async () => {
    const { el } = await render({ signedIn: false });
    expect(el.textContent).toContain('Not signed in');
  });
});
