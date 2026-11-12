import {
  dateTimeFromJson,
  dateTimeOrNullFromJson,
  dateTimeToJson,
  enumFromJson,
  JsonMap,
  mapListFromJson,
  requireString,
} from '../core/json';
import { Crate } from './crate';
import { Peach, peach } from './peach';

/** How hard a bot trains: how much it plans and how reliably it does it. */
export const BOT_LEVELS = ['easy', 'steady', 'strong'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

/** What a bot likes doing, so it scores in some categories more than others. */
export const BOT_STYLES = ['lifter', 'runner', 'allRounder'] as const;
export type BotStyle = (typeof BOT_STYLES)[number];

/** Most bots a Crate can keep at once. */
export const MAX_BOTS = 7;
/** Longest bot name. */
export const BOT_NAME_MAX = 20;

/** Names offered for new bots, in order. */
export const BOT_NAMES: readonly string[] = [
  'Sprocket',
  'Gizmo',
  'Rivet',
  'Servo',
  'Widget',
  'Dynamo',
  'Piston',
  'Turbo',
  'Ratchet',
  'Pixel',
  'Bolt',
  'Cog',
];

/**
 * A computer-played crate-mate, for Peaches without enough friends to fill
 * a Crate. A bot is kept on its {@link Crate}, not as a Peach: everything
 * it does is worked out from its id, level and style (see `BotTrainer`),
 * so it needs no account, no device and nothing written for it. Each week
 * it plans workouts like a Peach (its plan's worth is its commitment) and
 * then does most of them, some better than planned and some worse, on the
 * days it planned them. Its workouts are shared with the Crate as they
 * happen, so they show in Activity and count in matchups like anyone's.
 *
 * Bots join Seasons scheduled while they're in the Crate. They don't vote
 * on the rules or on disputes, and their numbers can't be disputed (they
 * are always plausible). Removing one stops it training from then on; a
 * Season it was in keeps it, and its weeks still to come are walkovers.
 */
export interface CrateBot {
  /** `bot_<crateId>_<n>`: unique, never reused, and says which Crate it's in. */
  readonly id: string;
  readonly name: string;
  readonly level: BotLevel;
  readonly style: BotStyle;
  readonly addedAt: Date;
  /** When it was taken out of the Crate; null while it's in. */
  readonly removedAt: Date | null;
}

const BOT_PREFIX = 'bot_';

/** Whether a Peach id belongs to a bot. */
export function isBotId(peachId: string): boolean {
  return peachId.startsWith(BOT_PREFIX);
}

/** The id of the `n`-th bot ever added to a Crate. */
export function botId(crateId: string, n: number): string {
  return `${BOT_PREFIX}${crateId}_${n}`;
}

/** The Crate a bot id belongs to, or null for a Peach's id. */
export function crateIdOfBot(peachId: string): string | null {
  if (!isBotId(peachId)) return null;
  const end = peachId.lastIndexOf('_');
  return end > BOT_PREFIX.length ? peachId.slice(BOT_PREFIX.length, end) : null;
}

/** Whether a bot is in its Crate at `at` (now, when not given). */
export function isActiveBot(bot: CrateBot, at?: Date): boolean {
  if (bot.removedAt === null) return true;
  return at !== undefined && at < bot.removedAt;
}

/** The bots a Crate has now. */
export function activeBots(crate: Crate): CrateBot[] {
  return crate.bots.filter((b) => isActiveBot(b));
}

export function findBot(crate: Crate, peachId: string): CrateBot | undefined {
  return crate.bots.find((b) => b.id === peachId);
}

/** The first name from {@link BOT_NAMES} no bot in the Crate has now. */
export function nextBotName(crate: Crate): string {
  const taken = new Set(activeBots(crate).map((b) => b.name.toLowerCase()));
  const free = BOT_NAMES.find((n) => !taken.has(n.toLowerCase()));
  return free ?? `Bot ${crate.bots.length + 1}`;
}

const LEVEL_FITNESS: Record<BotLevel, number> = { easy: 2, steady: 3, strong: 4 };

/** The profile a bot shows as wherever a Peach's would. */
export function botPeach(bot: CrateBot, crate: Pick<Crate, 'timeZone'>): Peach {
  return peach({
    id: bot.id,
    displayName: bot.name,
    fitnessLevel: LEVEL_FITNESS[bot.level],
    timeZone: crate.timeZone,
    createdAt: bot.addedAt,
  });
}

export function botFromJson(json: JsonMap): CrateBot {
  return {
    id: requireString(json['id'], 'id'),
    name: requireString(json['name'], 'name'),
    level: enumFromJson(BOT_LEVELS, json['level'], 'steady'),
    style: enumFromJson(BOT_STYLES, json['style'], 'allRounder'),
    addedAt: dateTimeFromJson(json['addedAt']),
    removedAt: dateTimeOrNullFromJson(json['removedAt']),
  };
}

export function botsFromJson(json: unknown): CrateBot[] {
  return mapListFromJson(json).map(botFromJson);
}

export function botToJson(b: CrateBot): JsonMap {
  return {
    id: b.id,
    name: b.name,
    level: b.level,
    style: b.style,
    addedAt: dateTimeToJson(b.addedAt),
    removedAt: b.removedAt ? dateTimeToJson(b.removedAt) : null,
  };
}
