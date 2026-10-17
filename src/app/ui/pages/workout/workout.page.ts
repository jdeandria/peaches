import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';

import { localDateOfLocal } from '../../../domain/core/local-date';
import { DisputeVote, SESSION_TIME } from '../../../domain/models/dispute';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { Fmt } from '../../format';
import { confirmDialog } from '../../layout/confirm-dialog';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { DisputeCard } from './dispute-card';

/** Something in the workout a member can dispute. */
interface MetricRow {
  readonly target: string;
  readonly name: string;
  readonly summary: string;
  /** Already disputed (in its current form), so no second dispute. */
  readonly disputed: boolean;
}

/**
 * A crate-mate's workout, as shared with a Crate: what they logged and for
 * how long. While its week is still open, any member can dispute an
 * exercise or the session time, and vote on disputes others raised.
 */
@Component({
  selector: 'pch-workout-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DisputeCard,
    EmptyState,
    ListCard,
    LoadingIndicator,
    MatIconButton,
    MatTooltip,
    Page,
    RouterLink,
    Section,
    Stagger,
  ],
  template: `@let d = data.value();
    @if (d === undefined) {
      <pch-page title="Workout" showBack [backLink]="backLink()">
        <div class="loading"><pch-loading-indicator /></div>
      </pch-page>
    } @else if (d === null) {
      <pch-page title="Workout" showBack [backLink]="backLink()">
        <pch-empty-state icon="search_off" title="Workout not found" />
      </pch-page>
    } @else {
      <pch-page [title]="title()" [subtitle]="subtitle()" showBack [backLink]="backLink()">
        @if (d.mine) {
          <a
            pageActions
            matIconButton
            aria-label="Edit"
            matTooltip="Edit"
            [routerLink]="['/log', d.log.id]"
          >
            <span class="material-symbols-rounded" aria-hidden="true">edit</span>
          </a>
        }
        <p class="pch-body-medium muted intro" [pchStagger]="0">
          {{
            d.canDispute
              ? 'Numbers look off? Dispute them. If more than half the Crate votes to strike, they stop scoring here.'
              : 'Its week is over, so its scores are final.'
          }}
        </p>
        <pch-list-card [pchStagger]="1">
          @for (m of metrics(); track m.target) {
            <div class="item">
              <div class="text">
                <span class="pch-title-medium">{{ m.name }}</span>
                <span class="pch-body-medium muted">{{ m.summary }}</span>
              </div>
              @if (d.canDispute && !d.mine) {
                <button
                  matIconButton
                  type="button"
                  [disabled]="m.disputed || busy()"
                  [matTooltip]="m.disputed ? 'Disputed' : 'Dispute'"
                  [attr.aria-label]="(m.disputed ? 'Disputed: ' : 'Dispute ') + m.name"
                  (click)="dispute(m)"
                >
                  <span
                    class="material-symbols-rounded"
                    [class.pch-icon-filled]="m.disputed"
                    aria-hidden="true"
                    >flag</span
                  >
                </button>
              }
            </div>
          }
        </pch-list-card>

        @if (d.disputes.length > 0) {
          <pch-section title="Disputes" />
          <div class="disputes" [pchStagger]="2">
            @for (v of d.disputes; track v.dispute.id) {
              <pch-dispute-card
                [view]="v"
                [openedBy]="nameOf(v.dispute.openedBy)"
                [canVote]="!d.mine && d.canDispute"
                [myVote]="me() ? (v.dispute.votes[me()!] ?? null) : null"
                (vote)="vote(v.dispute.id, $event)"
              />
            }
          </div>
        }
      </pch-page>
    }`,
  styles: `
    .loading {
      display: flex;
      justify-content: center;
      padding: 48px 0;
    }
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
    .intro {
      margin: 0 0 16px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 12px 8px 12px 16px;
    }
    .text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .disputes {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-bottom: 24px;
    }
  `,
})
export class WorkoutPage {
  readonly crateId = input.required<string>();
  readonly logId = input.required<string>();

  private readonly state = inject(AppState);
  private readonly dialog = inject(MatDialog);
  protected readonly me = this.state.peachId;
  protected readonly busy = signal(false);

  protected readonly data = this.state.query(
    () => {
      const me = this.me();
      return me ? { crateId: this.crateId(), logId: this.logId(), me } : undefined;
    },
    async ({ crateId, logId, me }, app) => {
      const log = await app.logs.getShared(crateId, logId);
      if (!log) return null;
      const now = this.state.now();
      const [crate, disputes, canDispute, members] = await Promise.all([
        app.crates.getById(crateId),
        app.disputeService.views(crateId, [log]),
        app.disputeService.weekOpen(crateId, log.startedAt, now),
        app.crateService.activeMembers(crateId),
      ]);
      const peaches = await app.peaches.getByIds(members.map((m) => m.peachId));
      return {
        log,
        crate,
        disputes,
        canDispute,
        mine: log.peachId === me,
        names: new Map(peaches.map((p) => [p.id, p.displayName])),
      };
    },
  );

  protected readonly backLink = computed(() => `/crates/${this.crateId()}`);

  protected nameOf(peachId: string): string {
    if (peachId === this.me()) return 'You';
    return this.data.value()?.names.get(peachId) ?? 'A crate-mate';
  }

  protected readonly title = computed(() => {
    const d = this.data.value();
    if (!d) return 'Workout';
    return d.mine ? 'Your workout' : `${this.nameOf(d.log.peachId)}’s workout`;
  });

  protected readonly subtitle = computed(() => {
    const d = this.data.value();
    if (!d) return '';
    const when = `${Fmt.day(localDateOfLocal(d.log.startedAt))}, ${Fmt.time(d.log.startedAt)}`;
    return [when, d.crate?.name, d.log.notes].filter(Boolean).join(' · ');
  });

  /** Each exercise, then the session time. */
  protected readonly metrics = computed<MetricRow[]>(() => {
    const d = this.data.value();
    if (!d) return [];
    const units = this.state.units();
    const disputed = new Set(d.disputes.filter((v) => v.applies).map((v) => v.dispute.target));
    return [
      ...d.log.entries.map((e) => ({
        target: e.exerciseId,
        name: e.exerciseName,
        summary: Fmt.entrySummary(e, units),
        disputed: disputed.has(e.exerciseId),
      })),
      {
        target: SESSION_TIME,
        name: 'Session time',
        summary: Fmt.clock(d.log.durationSeconds),
        disputed: disputed.has(SESSION_TIME),
      },
    ];
  });

  /** Asks first: a dispute can't be withdrawn, and the whole Crate sees it. */
  protected async dispute(metric: MetricRow): Promise<void> {
    const me = this.me();
    if (!me || this.busy()) return;
    const go = await confirmDialog(this.dialog, {
      title: `Dispute ${metric.name}?`,
      message:
        'Your crate-mates will be asked to vote. If more than half the Crate votes to strike, it stops scoring here. A dispute can’t be withdrawn.',
      action: 'Dispute',
    });
    if (!go) return;
    this.busy.set(true);
    await this.state.run(
      (app) =>
        app.disputeService.open({
          crateId: this.crateId(),
          logId: this.logId(),
          target: metric.target,
          peachId: me,
          now: this.state.now(),
        }),
      'Disputed. Your crate-mates can now vote.',
    );
    this.busy.set(false);
  }

  protected async vote(disputeId: string, vote: DisputeVote): Promise<void> {
    const me = this.me();
    if (!me) return;
    await this.state.run((app) =>
      app.disputeService.vote({ crateId: this.crateId(), disputeId, peachId: me, vote }),
    );
  }
}
