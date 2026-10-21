import { inject, Injectable, signal } from '@angular/core';

import { errorMessage } from '../application/errors';
import { HeartRateAccessLost, HeartRateService, HeartRateUpdate } from '../application/heart-rate';
import { AppState } from './app-state';
import { HEART_RATE_SOURCE } from './tokens';

/**
 * Heart rate tracking for the log screen: whether this device can read the
 * Peach's heart rate (and from where), connecting, and reading it into a
 * log. Unavailable when the build has no heart rate source.
 */
@Injectable({ providedIn: 'root' })
export class HeartRate {
  private readonly state = inject(AppState);
  private readonly source = inject(HEART_RATE_SOURCE);
  private readonly service = this.source
    ? new HeartRateService({
        source: this.source,
        logs: this.state.app.logs,
        logging: this.state.app.loggingService,
      })
    : null;

  /** Whether heart rate can be tracked at all in this build. */
  readonly available = this.source !== null;
  /** Where it comes from, e.g. "Google Health". */
  readonly sourceName = this.source?.name ?? '';
  readonly connected = signal(this.source?.connected ?? false);
  readonly connecting = signal(false);
  /** Why the last read failed, until one succeeds. */
  readonly problem = signal<string | null>(null);

  /** Loads what connecting needs ahead of the tap, so its window isn't blocked. */
  prepare(): void {
    this.source?.prepare().catch(() => undefined);
  }

  /** Asks for access; call it from a tap. Resolves whether it worked. */
  async connect(): Promise<boolean> {
    if (!this.source || this.connecting()) return false;
    this.connecting.set(true);
    try {
      await this.source.connect(this.state.authUser()?.email);
      this.problem.set(null);
      return true;
    } catch (e) {
      this.state.toast(errorMessage(e));
      return false;
    } finally {
      this.connecting.set(false);
      this.connected.set(this.source.connected);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.source) return;
    await this.source.disconnect().catch(() => undefined);
    this.connected.set(false);
    this.problem.set(null);
  }

  /**
   * Reads the log's heart rate so far and keeps it on the log. Failures are
   * kept in {@link problem} rather than shown, as this runs in the
   * background while the Peach logs; null when it failed.
   */
  async refresh(logId: string): Promise<HeartRateUpdate | null> {
    if (!this.service || !this.source?.connected) {
      this.connected.set(false);
      return null;
    }
    try {
      const update = await this.service.refresh(logId, this.state.now());
      this.problem.set(null);
      return update;
    } catch (e) {
      this.problem.set(errorMessage(e));
      if (e instanceof HeartRateAccessLost) this.connected.set(false);
      return null;
    } finally {
      this.connected.set(this.source.connected);
    }
  }
}
