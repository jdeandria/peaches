import {
  dateTimeFromJson,
  dateTimeToJson,
  JsonMap,
  mapFromJson,
  requireString,
} from '../core/json';
import { stableHash } from '../core/stable-hash';
import { entryFor, entryToJson, WorkoutLog } from './workout-log';

/** What a dispute targets: one exercise's entry (by exercise id), or the session time. */
export const SESSION_TIME = 'sessionTime';

export const DISPUTE_VOTES = ['strike', 'keep'] as const;
export type DisputeVote = (typeof DISPUTE_VOTES)[number];

export type DisputeOutcome = 'struck' | 'kept' | 'open';

/**
 * A crate-mate questioning one metric of a shared workout: an exercise's
 * sets ("50 km? That was 5.") or the session time. The Crate's members vote;
 * once more than half of them vote to strike it, it stops scoring in that
 * Crate. The workout's owner counts as a vote to keep it.
 *
 * A dispute is about the numbers as they were when it was raised
 * (`snapshot`): if the owner edits them, the dispute no longer applies.
 */
export interface Dispute {
  readonly id: string;
  readonly crateId: string;
  readonly logId: string;
  /** The workout's owner. */
  readonly peachId: string;
  /** An exercise id, or {@link SESSION_TIME}. */
  readonly target: string;
  /** What is disputed, for display ("Run", "Session time"). */
  readonly label: string;
  readonly snapshot: string;
  readonly openedBy: string;
  readonly openedAt: Date;
  /** Each voter's latest vote, by Peach id. */
  readonly votes: Readonly<Record<string, DisputeVote>>;
}

/**
 * A fingerprint of the disputed numbers in `log`, or null when the target
 * isn't in it. Includes the target, so it also makes a stable document key.
 */
export function metricSnapshot(log: WorkoutLog, target: string): string | null {
  let value: unknown;
  if (target === SESSION_TIME) value = log.durationSeconds;
  else {
    const entry = entryFor(log, target);
    if (!entry) return null;
    value = entryToJson(entry)['sets'];
  }
  return `${target}~${stableHash(JSON.stringify(value)).toString(36)}`;
}

/** Document key: one dispute per log, target and version of the numbers. */
export function disputeKey(logId: string, snapshot: string): string {
  return `${logId}~${snapshot}`;
}

/** Whether `dispute` is still about the numbers in `log` (they haven't been edited). */
export function stillApplies(dispute: Dispute, log: WorkoutLog): boolean {
  return dispute.logId === log.id && metricSnapshot(log, dispute.target) === dispute.snapshot;
}

/**
 * Where a dispute stands among the Crate's current members. It is struck
 * once more than half of them vote strike, and kept once that can no longer
 * happen; the owner always counts as keep, and votes from Peaches who left
 * don't count.
 */
export function disputeOutcome(
  dispute: Dispute,
  memberIds: ReadonlySet<string>,
): { outcome: DisputeOutcome; strike: number; keep: number; needed: number } {
  let strike = 0;
  let keep = 0;
  for (const id of memberIds) {
    const vote = id === dispute.peachId ? 'keep' : dispute.votes[id];
    if (vote === 'strike') strike++;
    else if (vote === 'keep') keep++;
  }
  const n = memberIds.size;
  const needed = Math.floor(n / 2) + 1;
  const outcome = strike >= needed ? 'struck' : n - keep < needed ? 'kept' : 'open';
  return { outcome, strike, keep, needed };
}

/**
 * `log` as it scores in a Crate: without the entries, or the session time,
 * that the Crate struck. `struck` are the Crate's struck disputes.
 */
export function withoutStruck(log: WorkoutLog, struck: readonly Dispute[]): WorkoutLog {
  const targets = new Set(struck.filter((d) => stillApplies(d, log)).map((d) => d.target));
  if (targets.size === 0) return log;
  return {
    ...log,
    entries: log.entries.filter((e) => !targets.has(e.exerciseId)),
    durationSeconds: targets.has(SESSION_TIME) ? 0 : log.durationSeconds,
  };
}

export function disputeFromJson(json: JsonMap): Dispute {
  const votes: Record<string, DisputeVote> = {};
  for (const [id, vote] of Object.entries(mapFromJson(json['votes']) ?? {})) {
    if (vote === 'strike' || vote === 'keep') votes[id] = vote;
  }
  return {
    id: requireString(json['id'], 'id'),
    crateId: requireString(json['crateId'], 'crateId'),
    logId: requireString(json['logId'], 'logId'),
    peachId: requireString(json['peachId'], 'peachId'),
    target: requireString(json['target'], 'target'),
    label: requireString(json['label'], 'label'),
    snapshot: requireString(json['snapshot'], 'snapshot'),
    openedBy: requireString(json['openedBy'], 'openedBy'),
    openedAt: dateTimeFromJson(json['openedAt']),
    votes,
  };
}

export function disputeToJson(d: Dispute): JsonMap {
  return {
    id: d.id,
    crateId: d.crateId,
    logId: d.logId,
    peachId: d.peachId,
    target: d.target,
    label: d.label,
    snapshot: d.snapshot,
    openedBy: d.openedBy,
    openedAt: dateTimeToJson(d.openedAt),
    votes: { ...d.votes },
  };
}
