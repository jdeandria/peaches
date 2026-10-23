import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DEMO_PEACH_ID } from '../../../data/demo/demo-seeder';
import { AppState } from '../../../state/app-state';
import { seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { rememberCrate } from './crate-switcher';
import { CratesPage } from './crates.page';
import { CreateCrateDialog } from './create-crate-dialog';
import { JoinCrateDialog } from './join-crate-dialog';

@Component({ template: '' })
class Blank {}

describe('Crates', () => {
  let backend: TestBackend;
  let close: ReturnType<typeof vi.fn>;

  async function setUp(options: { seed?: boolean } = {}) {
    backend = await seededBackend({ ...options, routes: [{ path: '**', component: Blank }] });
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [...backend.providers, { provide: MatDialogRef, useValue: { close } }],
    });
  }

  describe('CratesPage', () => {
    afterEach(() => localStorage.clear());

    async function open() {
      const f = TestBed.createComponent(CratesPage);
      for (let i = 0; i < 4; i++) {
        await settle();
        await f.whenStable();
      }
      return f.nativeElement as HTMLElement;
    }

    async function crateNamed(name: string) {
      const crates = await firstValueFrom(backend.container.crates.watchCratesFor(DEMO_PEACH_ID));
      return crates.find((c) => c.name === name)!;
    }

    it('opens the Crate with a Season under way', async () => {
      await setUp();
      await open();
      const warriors = await crateNamed('Weekend Warriors');
      expect(TestBed.inject(Router).url).toBe(`/crates/${warriors.id}`);
    });

    it('reopens the Crate last looked at', async () => {
      await setUp();
      const lifters = await crateNamed('Lunch Break Lifters');
      rememberCrate(lifters.id);
      await open();
      expect(TestBed.inject(Router).url).toBe(`/crates/${lifters.id}`);
    });

    it('offers to create or join a Crate without any', async () => {
      await setUp({ seed: false });
      const el = await open();
      expect(el.textContent).toContain('Train together, compete together.');
      expect(el.textContent).toContain('No Crates yet');
      const buttons = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
      expect(buttons).toEqual(['add Create a Crate', 'key Join with a code']);
      expect(TestBed.inject(Router).url).toBe('/');
    });
  });

  describe('CreateCrateDialog', () => {
    it('creates a Crate and opens it', async () => {
      await setUp();
      const f = TestBed.createComponent(CreateCrateDialog);
      await f.whenStable();
      const el: HTMLElement = f.nativeElement;
      expect(el.querySelector('h2')?.textContent).toBe('New Crate');
      expect(el.textContent).toContain('members vote on');

      const name = el.querySelector<HTMLInputElement>('input[matInput]')!;
      name.value = 'Garage Gym';
      name.dispatchEvent(new Event('input'));
      await f.componentInstance.create();

      const crate = close.mock.calls[0][0];
      expect(crate.name).toBe('Garage Gym');
      expect(crate.ownerPeachId).toBe(DEMO_PEACH_ID);
      expect(await backend.container.crates.getById(crate.id)).not.toBeNull();
      expect(TestBed.inject(Router).url).toBe(`/crates/${crate.id}`);
    });

    it('can’t be submitted without a name', async () => {
      await setUp();
      const toast = vi.spyOn(TestBed.inject(AppState), 'toast').mockImplementation(() => undefined);
      const f = TestBed.createComponent(CreateCrateDialog);
      await f.whenStable();
      const el: HTMLElement = f.nativeElement;
      const submit = el.querySelector<HTMLButtonElement>('button[type=submit]')!;
      expect(submit.disabled).toBe(true);

      // Blank names don't count, and Enter does nothing either.
      const name = el.querySelector<HTMLInputElement>('input[matInput]')!;
      name.value = '   ';
      name.dispatchEvent(new Event('input'));
      f.detectChanges();
      expect(submit.disabled).toBe(true);
      name.form!.requestSubmit();
      await settle();
      expect(close).not.toHaveBeenCalled();
      expect(toast).not.toHaveBeenCalled();
    });
  });

  describe('JoinCrateDialog', () => {
    it('shows an error for a bad invite code and stays open', async () => {
      await setUp();
      const toast = vi.spyOn(TestBed.inject(AppState), 'toast').mockImplementation(() => undefined);
      const f = TestBed.createComponent(JoinCrateDialog);
      await f.whenStable();
      const input = (f.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input')!;
      input.value = 'nope';
      input.dispatchEvent(new Event('input'));
      expect(f.componentInstance.code()).toBe('NOPE');
      // Enter submits the form; the error shows under the field, not as a toast.
      input.form!.requestSubmit();
      await settle();
      f.detectChanges();
      expect(f.componentInstance.error()).toBe('No Crate matches that invite code.');
      expect(input.closest('mat-form-field')!.textContent).toContain(
        'No Crate matches that invite code.',
      );
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(toast).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();

      // Typing again clears it.
      input.value = 'nope2';
      input.dispatchEvent(new Event('input'));
      expect(f.componentInstance.error()).toBe('');
    });

    it('joins with a good code and opens the Crate', async () => {
      await setUp();
      const other = await backend.container.crateService.createCrate({
        ownerPeachId: 'ben',
        name: 'Ben’s Barn',
        now: new Date(),
      });
      const f = TestBed.createComponent(JoinCrateDialog);
      await f.whenStable();
      f.componentInstance.code.set(other.inviteCode.toLowerCase());
      await f.componentInstance.join();
      expect(close).toHaveBeenCalled();
      const memberships = await backend.container.crates.membershipsFor(DEMO_PEACH_ID);
      expect(memberships.some((m) => m.crateId === other.id)).toBe(true);
      expect(TestBed.inject(Router).url).toBe(`/crates/${other.id}`);
    });
  });
});
