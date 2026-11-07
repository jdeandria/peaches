import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatFabButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';

import { addDays, LocalDate, localDateOfLocal, startOfWeek } from '../../../domain/core/local-date';
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
  winnerId,
} from '../../../domain/models/season';
import { AppState } from '../../../state/app-state';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { ShapedAvatar } from '../../expressive/shaped-avatar';
import { Fmt } from '../../format';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { ListRow } from '../../layout/list-row';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';
import { StandingsRow, StandingsTable } from '../../layout/standings-table';
import { StatusLabel } from '../../layout/status-label';
import { TwoPane } from '../../layout/two-pane';
import { CrateTitle, rememberCrate } from '../crates/crate-switcher';
import { DisputeCard } from '../workout/dispute-card';
import { MatchupCard } from '../matchup/matchup-card';
import { NewSeasonDialog } from './new-season-dialog';

/** A Season's week as shown in the Weeks list. */
export interface RoundView {
  readonly round: Round;
  /** "Week 2 · Oct 12 – 18" */
  readonly title: string;
  /** "vs Ada · Won 207.2–79.3", "vs Dev", "Bye", or null when the current Peach is not in it. */
  readonly subtitle: string | null;
  /** The current Peach's matchup this week once it has started, if any. */
  readonly matchupLink: readonly string[] | null;
  /** The manager's action for the week, if any. */
  readonly action: 'open' | 'close' | null;
}

/** "vs Ada · Won 207.2–79.3", "vs Dev" or "Bye": my matchup in a week, from my side. */
function matchupLine(m: Matchup, me: string, names: ReadonlyMap<string, string>): string {
  if (isBye(m)) return 'Bye';
  const them = m.homePeachId === me ? m.awayPeachId : m.homePeachId;
  const vs = `vs ${(them && names.get(them)) ?? 'your opponent'}`;
  if (m.result === null) return vs;
  const home = m.homePeachId === me;
  const mine = home ? m.result.homePoints : m.result.awayPoints;
  const theirs = home ? m.result.awayPoints : m.result.homePoints;
  const winner = winnerId(m);
  const outcome = winner === null ? 'Tie' : winner === me ? 'Won' : 'Lost';
  return `${vs} · ${outcome} ${Fmt.points(mine)}–${Fmt.points(theirs)}`;
}

/** Builds the Weeks list. */
export function roundViews(args: {
  rounds: readonly Round[];
  matchups: readonly Matchup[];
  me: string | null;
  canManage: boolean;
  today: LocalDate;
  /** Display names by Peach id, for "vs Ada". */
  names?: ReadonlyMap<string, string>;
}): RoundView[] {
  const { rounds, matchups, me, canManage, today } = args;
  const names = args.names ?? new Map<string, string>();
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
      subtitle: mine && me ? matchupLine(mine, me, names) : null,
      matchupLink: mine && round.status !== 'scheduled' ? ['/matchups', mine.id] : null,
      action,
    };
  });
}

/** What the "This week" section shows: my live matchup, or why there isn't one. */
export type ThisWeek =
  | { readonly kind: 'loading' }
  | { readonly kind: 'matchup'; readonly matchup: Matchup }
  | { readonly kind: 'note'; readonly text: string };

/** Works out the "This week" section from the Season and my matchups in it. */
export function thisWeek(args: {
  season: Season | null | undefined;
  matchups: readonly Matchup[] | undefined;
  me: string | null;
  canManage: boolean;
  today: LocalDate;
}): ThisWeek {
  const { season, matchups, me, canManage, today } = args;
  if (season === undefined) return { kind: 'loading' };
  if (season === null) {
    return {
      kind: 'note',
      text: `No Season yet, so no matchup this week. ${canManage ? 'Start one with the Season button.' : 'The owner can start one.'}`,
    };
  }
  const playing = me !== null && season.participantIds.includes(me);
  if (season.status === 'scheduled') {
    const nextWeek = addDays(startOfWeek(today), 7);
    const soon = season.startWeek <= nextWeek;
    return {
      kind: 'note',
      text: `${season.name} starts ${Fmt.day(season.startWeek)}.${
        playing && soon ? ' Plan your first week on the Plan tab: your opponent sees it.' : ''
      }`,
    };
  }
  if (season.status !== 'active') {
    return {
      kind: 'note',
      text: `${season.name} is over. ${canManage ? 'Start the next one with the Season button.' : 'The next one starts when the owner starts it.'}`,
    };
  }
  if (!playing) {
    return {
      kind: 'note',
      text: 'You joined after this Season started, so you play from the next one.',
    };
  }
  if (matchups === undefined) return { kind: 'loading' };
  const live = matchups.find((m) => m.status === 'inProgress' && involves(m, me!));
  if (live) return { kind: 'matchup', matchup: live };
  return { kind: 'note', text: 'No matchup is open right now.' };
}

/** Exercises listed before "Show all": the most recently logged first. */
const EXERCISES_SHOWN = 6;

export type CrateView = 'season' | 'activity' | 'peaches';

const VIEWS: readonly ButtonGroupOption<CrateView>[] = [
  { value: 'season', label: 'Season' },
  { value: 'activity', label: 'Activity' },
  { value: 'peaches', label: 'Peaches' },
];

/**
 * A Crate's stats, the Crates tab. The headline is the Crate's name and
 * opens the Crates sheet (switch, create, join); the Season and week sit
 * under it. Then one of three views: the Season (disputes waiting for your
 * vote, this week's matchup or why there isn't one, standings, the weeks
 * with my result in each, and the rules), Activity (what members have been
 * logging, and every exercise they've logged, tagged with who) or the
 * Peaches (the invite code and members). Manager actions sit where they
 * apply.
 */

@Component({
  selector: 'pch-crate-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonGroup,
    DisputeCard,
    EmptyState,
    ListCard,
    ListRow,
    LoadingIndicator,
    CrateTitle,
    MatchupCard,
    MatButton,
    MatFabButton,
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
  /** Query param: which view shows (`season` when absent). */
  readonly view = input<string>();

  private readonly router = inject(Router);
  protected readonly views = VIEWS;
  protected readonly shown = computed<CrateView>(
    () => VIEWS.find((v) => v.value === this.view())?.value ?? 'season',
  );

  /** Switches views in place, keeping the choice in the URL for Back. */
  protected showView(view: CrateView | null): void {
    if (!view) return;
    void this.router.navigate([], {
      queryParams: { view: view === 'season' ? null : view },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected readonly fmt = Fmt;
  protected readonly me = this.state.peachId;
  protected readonly canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  /** The round whose Open/Close is running. */
  protected readonly busyRound = signal<string | null>(null);

  protected readonly crate = this.state.query(
    () => this.crateId(),
    (id, app) => app.crates.getById(id),
  );

  constructor() {
    // The Crates tab reopens the Crate last looked at.
    effect(() => {
      const c = this.crate.value();
      if (c) rememberCrate(c.id);
    });
  }

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

  protected readonly thisWeek = computed(() =>
    thisWeek({
      season: this.season(),
      matchups: this.data()?.matchups,
      me: this.me(),
      canManage: this.canManage(),
      today: this.state.today(),
    }),
  );

  /** This week's matchup, with everything the card scores it from. */
  protected readonly weekBoard = this.state.query(
    () => {
      const week = this.thisWeek();
      return week.kind === 'matchup' ? week.matchup.id : undefined;
    },
    (id, app) => app.seasonService.board(id),
  ).value;

  /** "Autumn Kick-off · Week 3 of 6": the Season and where it's got to. */
  protected readonly subtitle = computed(() => {
    const season = this.season();
    if (!season) return undefined;
    const rounds = this.data()?.rounds ?? [];
    const open = rounds.find((r) => r.status === 'open');
    if (season.status !== 'active' || !open) return season.name;
    return `${season.name} · Week ${open.index + 1} of ${rounds.length}`;
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
      names: this.names(),
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
