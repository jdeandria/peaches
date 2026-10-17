import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton, MatFabButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';

import { LocalDate, localDateOfLocal } from '../../../domain/core/local-date';
import { canManage, Crate } from '../../../domain/models/crate';
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
import { DisputeCard } from '../workout/dispute-card';
import { NewSeasonDialog } from './new-season-dialog';

/** A Season's week as shown in the Weeks list. */
export interface RoundView {
  readonly round: Round;
  /** "Week 2 · Oct 12 – 18" */
  readonly title: string;
  /** "Bye" / "You have a matchup", or null when the current Peach is not in it. */
  readonly subtitle: string | null;
  /** The current Peach's matchup this week once it has started, if any. */
  readonly matchupLink: readonly string[] | null;
  /** The manager's action for the week, if any. */
  readonly action: 'open' | 'close' | null;
}

/** Builds the Weeks list. */
export function roundViews(args: {
  rounds: readonly Round[];
  matchups: readonly Matchup[];
  me: string | null;
  canManage: boolean;
  today: LocalDate;
}): RoundView[] {
  const { rounds, matchups, me, canManage, today } = args;
  return rounds.map((round) => {
    const mine = me
      ? (matchups.find((m) => m.roundId === round.id && involves(m, me)) ?? null)
      : null;
    let action: RoundView['action'] = null;
    if (canManage && round.status === 'scheduled' && round.weekStart <= today) action = 'open';
    else if (canManage && round.status === 'open') action = 'close';
    return {
      round,
      title: `Week ${round.index + 1} · ${Fmt.week(round.weekStart)}`,
      subtitle: mine ? (isBye(mine) ? 'Bye' : 'You have a matchup') : null,
      matchupLink: mine && round.status !== 'scheduled' ? ['/matchups', mine.id] : null,
      action,
    };
  });
}

/**
 * A Crate: disputes waiting for your vote, the current Season's standings
 * and weeks, what members have been logging (and every exercise they've
 * logged, tagged with who), members, and manager actions.
 */
/** Exercises listed before "Show all": the most recently logged first. */
const EXERCISES_SHOWN = 6;

@Component({
  selector: 'pch-crate-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Card,
    DisputeCard,
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

  /** Active members with their profiles, owner first. */
  protected readonly members = this.state.query(
    () => this.crateId(),
    async (id, app) => {
      const memberships = await app.crateService.activeMembers(id);
      const peaches = new Map(
        (await app.peaches.getByIds(memberships.map((m) => m.peachId))).map((p) => [p.id, p]),
      );
      const rank = { owner: 0, admin: 1, member: 2 };
      return memberships
        .filter((m) => peaches.has(m.peachId))
        .sort((a, b) => rank[a.role] - rank[b.role])
        .map((m) => ({ membership: m, peach: peaches.get(m.peachId)! }));
    },
  );

  private readonly names = computed(
    () => new Map((this.members.value() ?? []).map((m) => [m.peach.id, m.peach.displayName])),
  );

  /** Owners and admins run Seasons. */
  protected readonly canManage = computed(() => {
    const mine = this.members.value()?.find((m) => m.peach.id === this.me());
    return !!mine && canManage(mine.membership);
  });

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

  /** Ballots cast, for the "Rules" chip. */
  private readonly ballots = this.state.query(
    () => this.crateId(),
    (id, app) => app.votingService.ballotsOf(id),
  );
  protected readonly voteLine = computed(() => {
    const votes = this.ballots.value()?.length;
    const members = this.members.value()?.length;
    if (votes === undefined || members === undefined) return 'Rules';
    return `Rules · ${votes} of ${members} voted`;
  });

  /** Disputes about crate-mates' workouts that are waiting for my vote. */
  private readonly awaiting = this.state.query(
    () => {
      const me = this.me();
      return me ? { crateId: this.crateId(), me } : undefined;
    },
    ({ crateId, me }, app) => app.disputeService.awaitingVote(crateId, me, this.state.now()),
  );
  protected readonly disputes = computed(() => {
    const names = this.names();
    return (this.awaiting.value() ?? []).map((view) => ({
      view,
      owner: names.get(view.dispute.peachId) ?? 'A Peach',
      openedBy: names.get(view.dispute.openedBy) ?? 'A Peach',
      link: ['/crates', this.crateId(), 'logs', view.dispute.logId],
    }));
  });

  /** Every exercise members have logged here, tagged with who. */
  private readonly shared = this.state.query(
    () => this.crateId(),
    (id, app) => app.logs.exercisesSharedWith(id),
  );
  protected readonly exercisesShown = EXERCISES_SHOWN;
  protected readonly showAllExercises = signal(false);
  protected readonly exercises = computed(() => {
    const names = this.names();
    const byExercise = new Map<string, { name: string; from: Set<string>; last: number }>();
    for (const s of this.shared.value() ?? []) {
      const row = byExercise.get(s.exercise.id) ?? {
        name: s.exercise.name,
        from: new Set<string>(),
        last: 0,
      };
      row.from.add(s.peachId === this.me() ? 'you' : (names.get(s.peachId) ?? 'a Peach'));
      row.last = Math.max(row.last, s.lastLoggedAt.getTime());
      byExercise.set(s.exercise.id, row);
    }
    return [...byExercise.entries()]
      .sort(([, a], [, b]) => b.last - a.last)
      .map(([id, row]) => ({ id, name: row.name, from: `From ${Fmt.names([...row.from])}` }));
  });

  /** The latest workouts members shared with the Crate. */
  private readonly recentLogs = this.state.query(
    () => this.crateId(),
    (id, app) => app.logs.recentlySharedWith(id, 8),
  );
  protected readonly activity = computed(() => {
    const names = this.names();
    const units = this.state.units();
    return (this.recentLogs.value() ?? []).map((log) => ({
      id: log.id,
      peachId: log.peachId,
      name: log.peachId === this.me() ? 'You' : (names.get(log.peachId) ?? 'A Peach'),
      day: Fmt.day(localDateOfLocal(log.startedAt)),
      summary: log.entries
        .slice(0, 2)
        .map((e) => `${e.exerciseName} ${Fmt.entryHeadline(e, units)}`)
        .join(', '),
      link:
        log.peachId === this.me() ? ['/log', log.id] : ['/crates', this.crateId(), 'logs', log.id],
    }));
  });

  protected readonly standingRows = computed<StandingsRow[] | undefined>(() => {
    const data = this.data();
    if (!data) return undefined;
    const names = this.names();
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
      canManage: this.canManage(),
      today: this.state.today(),
    });
  });

  /** A new Season can start once the last one is over. */
  protected readonly canStartSeason = computed(() => {
    const s = this.season();
    return this.canManage() && s !== undefined && (s === null || !isSeasonOpen(s));
  });

  protected roundStatusColor(status: RoundStatus): string | undefined {
    return status === 'open' ? 'primary' : undefined;
  }

  protected roleLabel(role: string): string {
    return role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : 'Member';
  }

  protected async runRound(view: RoundView): Promise<void> {
    if (this.busyRound()) return;
    this.busyRound.set(view.round.id);
    await this.state.run((app) =>
      view.action === 'open'
        ? app.seasonService.openRound(view.round.id)
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

  /** The native share sheet; copies the code if sharing fails. */
  protected async share(crate: Crate): Promise<void> {
    try {
      await navigator.share({
        title: crate.name,
        text: `Join my Crate "${crate.name}" on Peaches with invite code ${crate.inviteCode}.`,
      });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) await this.copyCode(crate);
    }
  }

  protected newSeason(crate: Crate): void {
    this.dialog.open(NewSeasonDialog, {
      data: crate,
      width: '440px',
      maxWidth: 'calc(100vw - 32px)',
    });
  }
}
