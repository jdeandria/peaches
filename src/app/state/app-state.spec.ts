import { TestBed } from '@angular/core/testing';

import { seededBackend, settle, TestBackend } from '../../testing/test-app';
import { AppState } from './app-state';

describe('AppState', () => {
  let backend: TestBackend;

  beforeEach(async () => {
    backend = await seededBackend();
    TestBed.configureTestingModule({ providers: backend.providers });
  });

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
});
