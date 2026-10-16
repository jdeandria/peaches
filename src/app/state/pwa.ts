import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

/** The non-standard event Chromium fires when the app can be installed. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** How often an open app checks for a new deployment. */
const UPDATE_CHECK_MS = 30 * 60_000;

/**
 * Progressive-web-app plumbing: offers a reload when a new version has been
 * downloaded in the background, recovers from a broken cache, and exposes
 * the browser's install prompt so the Profile page can offer "Install app".
 */
@Injectable({ providedIn: 'root' })
export class Pwa {
  private readonly updates = inject(SwUpdate);
  private readonly snackBar = inject(MatSnackBar);
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  /** True when the browser will show an install prompt on request. */
  readonly canInstall = signal(false);

  /** True when running as an installed app rather than in a browser tab. */
  readonly installed = signal(
    typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches,
  );

  constructor() {
    const destroyRef = inject(DestroyRef);

    if (this.updates.isEnabled) {
      this.updates.versionUpdates
        .pipe(
          filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe(() => {
          this.snackBar
            .open('A new version of Peaches is ready.', 'Reload', { duration: 0 })
            .onAction()
            .subscribe(() => location.reload());
        });
      this.updates.unrecoverable.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
        this.snackBar
          .open('Peaches needs to reload to keep working offline.', 'Reload', { duration: 0 })
          .onAction()
          .subscribe(() => location.reload());
      });
      const timer = setInterval(
        () => void this.updates.checkForUpdate().catch(() => undefined),
        UPDATE_CHECK_MS,
      );
      destroyRef.onDestroy(() => clearInterval(timer));
    }

    if (typeof window !== 'undefined') {
      const onPrompt = (event: Event) => {
        // Keep the browser's mini-infobar quiet; we offer install in Profile.
        event.preventDefault();
        this.deferredPrompt = event as BeforeInstallPromptEvent;
        this.canInstall.set(true);
      };
      const onInstalled = () => {
        this.deferredPrompt = null;
        this.canInstall.set(false);
        this.installed.set(true);
      };
      window.addEventListener('beforeinstallprompt', onPrompt);
      window.addEventListener('appinstalled', onInstalled);
      destroyRef.onDestroy(() => {
        window.removeEventListener('beforeinstallprompt', onPrompt);
        window.removeEventListener('appinstalled', onInstalled);
      });
    }
  }

  /** Shows the browser's install prompt. Resolves true if the user accepted. */
  async install(): Promise<boolean> {
    const prompt = this.deferredPrompt;
    if (!prompt) return false;
    this.deferredPrompt = null;
    this.canInstall.set(false);
    await prompt.prompt();
    return (await prompt.userChoice).outcome === 'accepted';
  }
}
