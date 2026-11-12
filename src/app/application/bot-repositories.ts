import { from, Observable } from 'rxjs';

import { Commitment, COMMITMENT_OPENS_MS, MAX_COMMITMENT } from '../domain/models/commitment';
import { SharedExercise, sharedExercisesOf } from '../domain/models/crate-exercise';
import {
  botPeach,
  crateIdOfBot,
  CrateBot,
  findBot,
  isActiveBot,
  isBotId,
} from '../domain/models/bot';
import { Crate } from '../domain/models/crate';
import { Peach } from '../domain/models/peach';
import { plannedEntries } from '../domain/models/week-plan';
import { WorkoutLog } from '../domain/models/workout-log';
import {
  CrateRepository,
  PeachRepository,
  SeasonRepository,
  WorkoutLogRepository,
} from '../domain/repositories';
import { BotTrainer, parseBotLogId } from '../domain/services/bot-trainer';
import { RoundWindowService } from '../domain/services/round-window';
import { ScoringService } from '../domain/services/scoring-service';

/** How far back a Crate's activity and exercises look for bots' workouts. */
const RECENT_MS = 28 * 86_400_000;

export interface BotRepositoriesDeps {
  readonly peaches: PeachRepository;
  readonly crates: CrateRepository;
  readonly seasons: SeasonRepository;
  readonly logs: WorkoutLogRepository;
  readonly trainer: BotTrainer;
  readonly windows: RoundWindowService;
  readonly scoring: ScoringService;
  readonly clock: () => Date;
}

/**
 * Makes a Crate's bots read like any other crate-mate: their profiles come
 * back from the Peach repository, their finished workouts from the Crate's
 * shared logs (and so its activity, its exercises and every matchup) and
 * their plans' worth from its commitments. Nothing about a bot is stored
 * but its entry on the Crate; the rest is worked out by {@link BotTrainer}
 * as it's read, so every device sees the same bots doing the same things.
 *
 * Writes pass straight through: a bot never writes anything.
 */
export function withBots(deps: BotRepositoriesDeps): {
  peaches: PeachRepository;
  seasons: SeasonRepository;
  logs: WorkoutLogRepository;
} {
  const { peaches, crates, seasons, logs, trainer, windows, scoring, clock } = deps;

  /** The Crate and its bots, or null when it has none. */
  const botsOf = async (crateId: string): Promise<{ crate: Crate; bots: CrateBot[] } | null> => {
    const crate = await crates.getById(crateId);
    return crate && crate.bots.length > 0 ? { crate, bots: [...crate.bots] } : null;
  };

  const botProfiles = async (ids: readonly string[]): Promise<Peach[]> => {
    const byCrate = new Map<string, string[]>();
    for (const id of ids) {
      const crateId = crateIdOfBot(id);
      if (crateId) byCrate.set(crateId, [...(byCrate.get(crateId) ?? []), id]);
    }
    const found: Peach[] = [];
    for (const [crateId, botIds] of byCrate) {
      const crate = await crates.getById(crateId);
      if (!crate) continue;
      for (const id of botIds) {
        const bot = findBot(crate, id);
        if (bot) found.push(botPeach(bot, crate));
      }
    }
    return found;
  };

  const botLogs = async (crateId: string, from: Date, to: Date): Promise<WorkoutLog[]> => {
    const found = await botsOf(crateId);
    if (!found) return [];
    const now = clock();
    return found.bots.flatMap((bot) => trainer.logs(bot, found.crate, from, to, now));
  };

  const peachRepository = decorate<PeachRepository>(peaches, {
    async getById(id) {
      return isBotId(id) ? ((await botProfiles([id]))[0] ?? null) : peaches.getById(id);
    },
    async getByIds(ids) {
      const all = [...ids];
      const [people, bots] = await Promise.all([
        peaches.getByIds(all.filter((id) => !isBotId(id))),
        botProfiles(all.filter(isBotId)),
      ]);
      return [...people, ...bots];
    },
    watch(id): Observable<Peach | null> {
      return isBotId(id) ? from(peachRepository.getById(id)) : peaches.watch(id);
    },
  });

  const seasonRepository = decorate<SeasonRepository>(seasons, {
    async getCommitment(seasonId, roundId, peachId) {
      if (!isBotId(peachId)) return seasons.getCommitment(seasonId, roundId, peachId);
      const [season, round] = await Promise.all([
        seasons.getById(seasonId),
        seasons.getRound(roundId),
      ]);
      const crate = season && (await crates.getById(season.crateId));
      const bot = crate && findBot(crate, peachId);
      if (!season || !round || !crate || !bot || round.seasonId !== season.id) return null;
      const locksAt = windows.windowFor(round, crate).opensAt;
      // Like a Peach, a bot commits before the week starts, at most a week
      // ahead, and only to a Season it could have planned for.
      if (locksAt.getTime() - clock().getTime() > COMMITMENT_OPENS_MS) return null;
      if (season.createdAt >= locksAt || bot.addedAt >= locksAt) return null;
      if (!isActiveBot(bot, locksAt)) return null;
      const plan = trainer.plan(bot, round.weekStart);
      const points = scoring.scorePlan(plannedEntries(plan), season.rules.weights).total;
      const commitment: Commitment = {
        seasonId,
        roundId,
        peachId,
        points: Math.min(MAX_COMMITMENT, points),
        locksAt,
        updatedAt: bot.addedAt,
      };
      return commitment;
    },
  });

  const logRepository = decorate<WorkoutLogRepository>(logs, {
    async getShared(crateId, logId) {
      const parsed = parseBotLogId(logId);
      if (!parsed) return logs.getShared(crateId, logId);
      const found = await botsOf(crateId);
      const bot = found && findBot(found.crate, parsed.botId);
      return bot ? trainer.log(bot, found.crate, logId, clock()) : null;
    },
    async sharedWith(crateId, from, to) {
      const [people, bots] = await Promise.all([
        logs.sharedWith(crateId, from, to),
        botLogs(crateId, from, to),
      ]);
      return newestFirst([...people, ...bots]);
    },
    async recentlySharedWith(crateId, limit) {
      const now = clock();
      const [people, bots] = await Promise.all([
        logs.recentlySharedWith(crateId, limit),
        botLogs(crateId, new Date(now.getTime() - RECENT_MS), now),
      ]);
      return newestFirst([...people, ...bots]).slice(0, limit);
    },
    async exercisesSharedWith(crateId) {
      const now = clock();
      const [people, bots] = await Promise.all([
        logs.exercisesSharedWith(crateId),
        botLogs(crateId, new Date(now.getTime() - RECENT_MS), now),
      ]);
      // One per exercise per bot, as last logged.
      const latest = new Map<string, SharedExercise>();
      for (const shared of bots.flatMap(sharedExercisesOf)) {
        const key = `${shared.exercise.id}__${shared.peachId}`;
        const seen = latest.get(key);
        if (!seen || seen.lastLoggedAt < shared.lastLoggedAt) latest.set(key, shared);
      }
      return [...people, ...latest.values()];
    },
  });

  return { peaches: peachRepository, seasons: seasonRepository, logs: logRepository };
}

function newestFirst(logs: WorkoutLog[]): WorkoutLog[] {
  return logs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

/**
 * `inner` with some of its methods replaced; the rest are its own, bound to
 * it (repositories are classes, so their methods live on the prototype).
 */
function decorate<T extends object>(inner: T, overrides: Partial<T>): T {
  return new Proxy(inner, {
    get(target, prop) {
      if (Object.prototype.hasOwnProperty.call(overrides, prop)) {
        return (overrides as Record<PropertyKey, unknown>)[prop];
      }
      const value: unknown = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
