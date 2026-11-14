import { effect } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { seededBackend, settle, TestBackend } from '../../testing/test-app';
import { AppState, SessionStatus } from './app-state';
import { STARTUP_TIMEOUT_MS } from './tokens';

describe('AppState', () => {
  let backend: TestBackend;

  beforeEach(async () => {
    backend = await seededBackend();
    TestBed.configureTestingModule({
      providers: [...backend.providers, { provide: STARTUP_TIMEOUT_MS, useValue: 50 }],
    });
  });

  /** Every status the session passes through, in order. */
  function statuses(state: AppState): SessionStatus[] {
    const seen: SessionStatus[] = [];
    TestBed.runInInjectionContext(() => effect(() => void seen.push(state.status())));
    return seen;
  }

  it('is ready once the Peach exists, without waiting for Seasons to sync', async () => {
    // A Firestore write that the server never acknowledges (no connection).
    const sync = vi
      .spyOn(backend.container.seasonService, 'syncPeach')
      .mockReturnValue(new Promise(() => undefined));
    const state = TestBed.inject(AppState);
    await settle();
    expect(sync).toHaveBeenCalled();
    expect(state.status()).toBe('ready');
  });

  it('refetches every query once the background sync finishes', async () => {
    let finish!: () => void;
    vi.spyOn(backend.container.seasonService, 'syncPeach').mockReturnValue(
      new Promise<void>((resolve) => (finish = resolve)),
    );
    const state = TestBed.inject(AppState);
    await settle();
    const before = state.revision();
    finish();
    await settle();
    expect(state.revision()).toBeGreaterThan(before);
  });

  it('offers to try again when the profile takes too long, and carries on if it arrives', async () => {
    // A new Peach's profile is a write the server never acknowledges.
    let arrive!: () => void;
    const ensure = backend.container.sessionService.ensurePeach.bind(
      backend.container.sessionService,
    );
    vi.spyOn(backend.container.sessionService, 'ensurePeach').mockImplementation(
      (...args) => new Promise((resolve) => (arrive = () => resolve(ensure(...args)))),
    );
    const state = TestBed.inject(AppState);
    await settle();
    expect(state.status()).toBe('loading');
    await settle(60);
    expect(state.status()).toBe('error');
    arrive();
    await settle();
    expect(state.status()).toBe('ready');
  });

  it('never shows the error when the profile loads in time', async () => {
    const state = TestBed.inject(AppState);
    const seen = statuses(state);
    await settle(60);
    TestBed.tick();
    expect(seen).not.toContain('error');
    expect(state.status()).toBe('ready');
  });
});
