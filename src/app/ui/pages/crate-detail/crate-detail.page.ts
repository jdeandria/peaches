import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton, MatFabButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';

import { Crate } from '../../../domain/models/crate';
import { onWinningStreak, streak } from '../../../domain/models/score';
import {
  involves,
  isBye,
  isSeasonOpen,
  Matchup,
  Round,
  RoundStatus,
  Season,
} from '../../../domain/models/season';
import { AppState } from '../../../state/app-state';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { ShapedAvatar } from '../../expressive/shaped-avatar';
import { Fmt } from '../../format';
import { Card } from '../../layout/card';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { ListRow } from '../../layout/list-row';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { StandingsRow, StandingsTable } from '../../layout/standings-table';
import { StatusLabel } from '../../layout/status-label';
import { TwoPane } from '../../layout/two-pane';
import { NewSeasonDialog } from './new-season-dialog';

/** A Season's round as shown in the Rounds list. */
export interface RoundView {
  readonly round: Round;
  /** "Mon, Oct 12 · Full body" */
  readonly title: string;
  /** "Bye" / "You have a matchup", or null when the current Peach is not in it. */
  readonly subtitle: string | null;
  /** The current Peach's opened matchup in this round, if any. */
  readonly matchupLink: readonly string[] | null;
  /** The owner's action for the round, if any. */
  readonly action: 'open' | 'close' | null;
}

/** Builds the Rounds list (port of `_RoundTile`'s decisions). */
export function roundViews(args: {
  rounds: readonly Round[];
  matchups: readonly Matchup[];
  me: string | null;
  canManage: boolean;
  today: string;
}): RoundView[] {
  const { rounds, matchups, me, canManage, today } = args;
  return rounds.map((round) => {
    const mine = me
      ? (matchups.find((m) => m.roundId === round.id && involves(m, me)) ?? null)
      : null;
    let action: RoundView['action'] = null;
    if (canManage && round.status === 'scheduled' && round.date <= today) action = 'open';
    else if (canManage && round.status === 'open') action = 'close';
    return {
      round,
      title: `${Fmt.day(round.date)} · ${Fmt.focus(round.focus)}`,
      subtitle: mine ? (isBye(mine) ? 'Bye' : 'You have a matchup') : null,
      matchupLink: mine?.workoutId ? ['/matchups', mine.id] : null,
      action,
    };
  });
}

/** Members, the current Season's standings and rounds, and owner actions. */
@Component({
  selector: 'pch-crate-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Card,
    EmptyState,
    ListCard,
    ListRow,
    LoadingIndicator,
    MatButton,
    MatFabButton,
    MatIconButton,
    MatTooltip,
    Page,
    RouterLink,
    Section,
    ShapedAvatar,
    Stagger,
    StandingsTable,
    StatusLabel,
    TwoPane,
  ],
  templateUrl: './crate-detail.page.html',
  styleUrl: './crate-detail.page.scss',
})
export class CrateDetailPage {
  private readonly state = inject(AppState);
  private readonly dialog = inject(MatDialog);

  readonly crateId = input.required<string>();

  protected readonly fmt = Fmt;
  protected readonly me = this.state.peachId;
  protected readonly canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  /** The round whose Open/Close is running. */
  protected readonly busyRound = signal<string | null>(null);

  protected readonly crate = this.state.query(
    () => this.crateId(),
    (id, app) => app.crates.getById(id),
  );

  protected readonly members = this.state.query(
    () => this.crateId(),
    async (id, app) => {
      const memberships = await app.crateService.activeMembers(id);
      return app.peaches.getByIds(memberships.map((m) => m.peachId));
    },
  );

  private readonly seasons = this.state.watch(
    () => this.crateId(),
    (id, app) => app.seasons.watchForCrate(id),
  );

  /** The open Season, else the newest; null when there is none, undefined while loading. */
  protected readonly season = computed<Season | null | undefined>(() => {
    const list = this.seasons.value();
    if (list === undefined) return undefined;
    return list.find(isSeasonOpen) ?? list[0] ?? null;
  });

  private readonly seasonData = this.state.query(
    () => this.season()?.id,
    async (seasonId, app) => {
      const [rounds, matchups, standings] = await Promise.all([
        app.seasons.roundsOf(seasonId),
        app.seasons.matchupsOf(seasonId),
        app.seasonService.standings(seasonId),
      ]);
      return { seasonId, rounds, matchups, standings };
    },
  );

  /** Season data for the current Season only (never a previous one's). */
  private readonly data = computed(() => {
    const data = this.seasonData.value();
    return data && data.seasonId === this.season()?.id ? data : undefined;
  });

  protected readonly isOwner = computed(() => {
    const crate = this.crate.value();
    return !!crate && crate.ownerPeachId === this.me();
  });

  protected readonly standingRows = computed<StandingsRow[] | undefined>(() => {
    const data = this.data();
    if (!data) return undefined;
    const names = new Map((this.members.value() ?? []).map((p) => [p.id, p.displayName]));
    return data.standings.map((s) => ({
      peachId: s.peachId,
      name: names.get(s.peachId) ?? 'Peach',
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      streak: streak(s),
      onWinningStreak: onWinningStreak(s),
      form: s.form,
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
    }));
  });

  protected readonly rounds = computed(() => {
    const data = this.data();
    if (!data) return undefined;
    return roundViews({
      rounds: data.rounds,
      matchups: data.matchups,
      me: this.me(),
      canManage: this.isOwner(),
      today: this.state.today(),
    });
  });

  protected roundStatusColor(status: RoundStatus): string | undefined {
    return status === 'open' ? 'primary' : undefined;
  }

  protected async runRound(view: RoundView): Promise<void> {
    if (this.busyRound()) return;
    this.busyRound.set(view.round.id);
    await this.state.run((app) =>
      view.action === 'open'
        ? app.seasonService.openRound(view.round.id, this.state.now())
        : app.seasonService.closeRound(view.round.id),
    );
    this.busyRound.set(null);
  }

  protected async copyCode(crate: Crate): Promise<void> {
    try {
      await navigator.clipboard.writeText(crate.inviteCode);
      this.state.toast(`Invite code ${crate.inviteCode} copied`);
    } catch {
      // Clipboard access can be refused; still tell the Peach the code.
      this.state.toast(`Invite code ${crate.inviteCode}`);
    }
  }

  /** Native share sheet where there is one, else copy the code. */
  protected async share(crate: Crate): Promise<void> {
    if (this.canShare) {
      try {
        await navigator.share({
          title: crate.name,
          text: `Join my Crate "${crate.name}" on Peaches with invite code ${crate.inviteCode}.`,
        });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    await this.copyCode(crate);
  }

  protected newSeason(crate: Crate): void {
    this.dialog.open(NewSeasonDialog, {
      data: crate,
      width: '440px',
      maxWidth: 'calc(100vw - 32px)',
    });
  }
}
