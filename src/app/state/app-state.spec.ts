import { TestBed } from '@angular/core/testing';

import { seededBackend, settle } from '../../testing/test-app';
import { AppState, PROFILE_TIMEOUT_MS } from './app-state';

describe('AppState startup', () => {
  afterEach(() => vi.useRealTimers());

  async function start(setUp: (backend: Awaited<ReturnType<typeof seededBackend>>) => void) {
    const backend = await seededBackend();
    setUp(backend);
    TestBed.configureTestingModule({ providers: backend.providers });
    return TestBed.inject(AppState);
  }

  it('is ready once the profile loads, without waiting for Seasons to sync', async () => {
    let finishSync: () => void = () => undefined;
    const state = await start((b) => {
      // A housekeeping write stuck waiting on the server (the offline cache
      // never fails a write, it waits).
      vi.spyOn(b.container.seasonService, 'syncPeach').mockReturnValue(
        new Promise<void>((resolve) => (finishSync = resolve)),
      );
    });
    await settle();
    TestBed.tick();
    expect(state.status()).toBe('ready');

    // When it does finish, screens refetch.
    const revision = state.revision();
    finishSync();
    await settle();
    expect(state.revision()).toBeGreaterThan(revision);
  });

  it('says why, rather than waiting forever, when the profile never loads', async () => {
    vi.useFakeTimers();
    const state = await start((b) => {
      vi.spyOn(b.container.sessionService, 'ensurePeach').mockReturnValue(
        // Never settles.
        new Promise(() => undefined),
      );
    });
    await vi.advanceTimersByTimeAsync(1000);
    TestBed.tick();
    expect(state.status()).toBe('loading');
    await vi.advanceTimersByTimeAsync(PROFILE_TIMEOUT_MS);
    TestBed.tick();
    expect(state.status()).toBe('error');
    expect(state.startupError()).toContain('couldn’t reach its servers');
  });

  it('shows what went wrong when loading the profile fails', async () => {
    const state = await start((b) => {
      vi.spyOn(b.container.sessionService, 'ensurePeach').mockRejectedValue(
        new Error('Missing or insufficient permissions.'),
      );
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await settle();
    TestBed.tick();
    expect(state.status()).toBe('error');
    expect(state.startupError()).toBe('Something went wrong: Missing or insufficient permissions.');
  });
});
