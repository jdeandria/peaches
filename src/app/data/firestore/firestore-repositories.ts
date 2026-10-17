/**
 * Firestore implementations of the domain repositories.
 *
 * Each method maps onto one indexed query; the collection layout, document
 * ids and denormalised fields are described in `docs/ARCHITECTURE.md`
 * ("Firestore layout"). Documents are stored in the
 * models' own JSON shape, so encoding is just `xxxToJson` / `xxxFromJson`.
 */
import {
  collection,
  collectionGroup,
  CollectionReference,
  doc,
  DocumentReference,
  DocumentSnapshot,
  documentId,
  Firestore,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Query,
  QuerySnapshot,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { Observable, from, map, switchMap } from 'rxjs';

import { Repositories } from '../../application/app-container';
import { dateTimeToJson, JsonMap } from '../../domain/core/json';
import { Ballot, ballotFromJson, ballotToJson } from '../../domain/models/ballot';
import {
  Crate,
  crateFromJson,
  CrateMembership,
  crateToJson,
  isActiveMembership,
  membershipFromJson,
  membershipToJson,
} from '../../domain/models/crate';
import {
  SharedExercise,
  sharedExerciseFromJson,
  sharedExerciseKey,
  sharedExercisesOf,
  sharedExerciseToJson,
} from '../../domain/models/crate-exercise';
import { Dispute, disputeFromJson, disputeToJson, DisputeVote } from '../../domain/models/dispute';
import { Lineup, lineupFromJson, lineupKey, lineupToJson } from '../../domain/models/lineup';
import { Peach, peachFromJson, peachToJson } from '../../domain/models/peach';
import {
  Matchup,
  matchupFromJson,
  matchupPeachIds,
  matchupToJson,
  Round,
  roundFromJson,
  roundToJson,
  Season,
  seasonFromJson,
  seasonToJson,
} from '../../domain/models/season';
import { WorkoutLog, workoutLogFromJson, workoutLogToJson } from '../../domain/models/workout-log';
import {
  BallotRepository,
  CrateRepository,
  DisputeRepository,
  PeachRepository,
  SeasonRepository,
  WorkoutLogRepository,
} from '../../domain/repositories';

/**
 * Firestore collection names, in one place so rules and indexes can be
 * cross-checked against the code.
 */
export const COLLECTIONS = {
  peaches: 'peaches',
  crates: 'crates',
  memberships: 'memberships',
  /** Copies of submitted logs, under each Crate they were shared with. */
  sharedLogs: 'logs',
  ballots: 'ballots',
  /** Exercises members have logged, shared with each of their Crates. */
  sharedExercises: 'exercises',
  disputes: 'disputes',
  seasons: 'seasons',
  rounds: 'rounds',
  matchups: 'matchups',
  lineups: 'lineups',
  workoutLogs: 'workoutLogs',
} as const;

/** Firestore `in` filters accept at most 30 values. */
const WHERE_IN_LIMIT = 30;

type Decode<T> = (json: JsonMap) => T;

function decodeDoc<T>(snap: DocumentSnapshot, decode: Decode<T>): T | null {
  return snap.exists() ? decode(snap.data()) : null;
}

function decodeAll<T>(snap: QuerySnapshot, decode: Decode<T>): T[] {
  return snap.docs.map((d) => decode(d.data()));
}

function decodeFirst<T>(snap: QuerySnapshot, decode: Decode<T>): T | null {
  const first = snap.docs[0];
  return first ? decode(first.data()) : null;
}

/** Splits `items` into lists of at most `size`. */
export function chunk<T>(items: Iterable<T>, size: number): T[][] {
  const list = [...items];
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** UTF-16 code-unit order (not locale order), so every client sorts alike. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Fetches every document in `col` whose id is in `ids`, one `in` query per
 * chunk of {@link WHERE_IN_LIMIT}. Missing ids are simply absent.
 */
async function getByDocumentIds<T>(
  col: CollectionReference,
  ids: Iterable<string>,
  decode: Decode<T>,
): Promise<T[]> {
  const snaps = await Promise.all(
    chunk(new Set(ids), WHERE_IN_LIMIT).map((part) =>
      getDocs(query(col, where(documentId(), 'in', part))),
    ),
  );
  return snaps.flatMap((snap) => decodeAll(snap, decode));
}

/**
 * Wraps a document listener in an Observable. Firestore emits the current
 * value as soon as the listener attaches (from cache when offline), then on
 * every change; unsubscribing detaches the listener.
 */
function watchDoc<T>(ref: DocumentReference, decode: Decode<T>): Observable<T | null> {
  return snapshots<DocumentSnapshot, T | null>(
    (next, error) => onSnapshot(ref, next, error),
    (snap) => decodeDoc(snap, decode),
  );
}

/** Like {@link watchDoc}, for a query. */
function watchQuery<T>(q: Query, decode: (snap: QuerySnapshot) => T): Observable<T> {
  return snapshots<QuerySnapshot, T>((next, error) => onSnapshot(q, next, error), decode);
}

function snapshots<S, T>(
  listen: (next: (snap: S) => void, error: (e: Error) => void) => () => void,
  decode: (snap: S) => T,
): Observable<T> {
  return new Observable<T>((subscriber) =>
    listen(
      (snap) => {
        // A malformed document must surface as an error, not an uncaught
        // exception inside Firestore's callback.
        let value: T;
        try {
          value = decode(snap);
        } catch (e) {
          subscriber.error(e);
          return;
        }
        subscriber.next(value);
      },
      (e) => subscriber.error(e),
    ),
  );
}

export class FirestorePeachRepository implements PeachRepository {
  constructor(private readonly db: Firestore) {}

  private get col(): CollectionReference {
    return collection(this.db, COLLECTIONS.peaches);
  }

  async getById(id: string): Promise<Peach | null> {
    return decodeDoc(await getDoc(doc(this.col, id)), peachFromJson);
  }

  getByIds(ids: Iterable<string>): Promise<Peach[]> {
    return getByDocumentIds(this.col, ids, peachFromJson);
  }

  save(peach: Peach): Promise<void> {
    return setDoc(doc(this.col, peach.id), peachToJson(peach));
  }

  watch(id: string): Observable<Peach | null> {
    return watchDoc(doc(this.col, id), peachFromJson);
  }
}

export class FirestoreCrateRepository implements CrateRepository {
  constructor(private readonly db: Firestore) {}

  private get crates(): CollectionReference {
    return collection(this.db, COLLECTIONS.crates);
  }

  private members(crateId: string): CollectionReference {
    return collection(this.crates, crateId, COLLECTIONS.memberships);
  }

  /** Every membership of `peachId`, across all Crates. */
  private membershipsQuery(peachId: string): Query {
    return query(
      collectionGroup(this.db, COLLECTIONS.memberships),
      where('peachId', '==', peachId),
    );
  }

  async getById(id: string): Promise<Crate | null> {
    return decodeDoc(await getDoc(doc(this.crates, id)), crateFromJson);
  }

  /** Invite codes are stored upper case, so lookups ignore case and spaces. */
  async getByInviteCode(inviteCode: string): Promise<Crate | null> {
    const code = inviteCode.trim().toUpperCase();
    const snap = await getDocs(query(this.crates, where('inviteCode', '==', code), limit(1)));
    return decodeFirst(snap, crateFromJson);
  }

  save(crate: Crate): Promise<void> {
    return setDoc(doc(this.crates, crate.id), crateToJson(crate));
  }

  async membershipsOf(crateId: string): Promise<CrateMembership[]> {
    return decodeAll(await getDocs(this.members(crateId)), membershipFromJson);
  }

  async membershipsFor(peachId: string): Promise<CrateMembership[]> {
    return decodeAll(await getDocs(this.membershipsQuery(peachId)), membershipFromJson);
  }

  /** Membership documents are keyed by Peach id: one per Peach per Crate. */
  saveMembership(membership: CrateMembership): Promise<void> {
    return setDoc(
      doc(this.members(membership.crateId), membership.peachId),
      membershipToJson(membership),
    );
  }

  /**
   * Watches the Peach's memberships and re-fetches the active Crates on
   * each change. `switchMap` drops a fetch that is overtaken by a newer
   * membership snapshot so results never arrive out of order.
   */
  watchCratesFor(peachId: string): Observable<Crate[]> {
    return watchQuery(this.membershipsQuery(peachId), (snap) =>
      decodeAll(snap, membershipFromJson),
    ).pipe(
      map((memberships) => memberships.filter(isActiveMembership).map((m) => m.crateId)),
      switchMap((ids) => from(getByDocumentIds(this.crates, ids, crateFromJson))),
      map((crates) => crates.sort((a, b) => compareStrings(a.name, b.name))),
    );
  }
}

export class FirestoreSeasonRepository implements SeasonRepository {
  constructor(private readonly db: Firestore) {}

  private get seasons(): CollectionReference {
    return collection(this.db, COLLECTIONS.seasons);
  }

  private rounds(seasonId: string): CollectionReference {
    return collection(this.seasons, seasonId, COLLECTIONS.rounds);
  }

  private matchups(seasonId: string): CollectionReference {
    return collection(this.seasons, seasonId, COLLECTIONS.matchups);
  }

  private lineups(seasonId: string): CollectionReference {
    return collection(this.seasons, seasonId, COLLECTIONS.lineups);
  }

  private crateQuery(crateId: string): Query {
    return query(this.seasons, where('crateId', '==', crateId));
  }

  /** Matchups involving `peachId`, via the denormalised `peachIds` field. */
  private peachMatchupsQuery(peachId: string): Query {
    return query(
      collectionGroup(this.db, COLLECTIONS.matchups),
      where('peachIds', 'array-contains', peachId),
    );
  }

  private static newestFirst(seasons: Season[]): Season[] {
    return seasons.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getById(id: string): Promise<Season | null> {
    return decodeDoc(await getDoc(doc(this.seasons, id)), seasonFromJson);
  }

  async forCrate(crateId: string): Promise<Season[]> {
    const snap = await getDocs(this.crateQuery(crateId));
    return FirestoreSeasonRepository.newestFirst(decodeAll(snap, seasonFromJson));
  }

  save(season: Season): Promise<void> {
    return setDoc(doc(this.seasons, season.id), seasonToJson(season));
  }

  watchForCrate(crateId: string): Observable<Season[]> {
    return watchQuery(this.crateQuery(crateId), (snap) =>
      FirestoreSeasonRepository.newestFirst(decodeAll(snap, seasonFromJson)),
    );
  }

  /** Round ids are globally unique, so a collection-group lookup finds the Season. */
  async getRound(id: string): Promise<Round | null> {
    const snap = await getDocs(
      query(collectionGroup(this.db, COLLECTIONS.rounds), where('id', '==', id), limit(1)),
    );
    return decodeFirst(snap, roundFromJson);
  }

  async roundsOf(seasonId: string): Promise<Round[]> {
    const rounds = decodeAll(await getDocs(this.rounds(seasonId)), roundFromJson);
    return rounds.sort((a, b) => a.index - b.index);
  }

  saveRound(round: Round): Promise<void> {
    return setDoc(doc(this.rounds(round.seasonId), round.id), roundToJson(round));
  }

  async getMatchup(id: string): Promise<Matchup | null> {
    const snap = await getDocs(
      query(collectionGroup(this.db, COLLECTIONS.matchups), where('id', '==', id), limit(1)),
    );
    return decodeFirst(snap, matchupFromJson);
  }

  async matchupsOf(seasonId: string): Promise<Matchup[]> {
    return decodeAll(await getDocs(this.matchups(seasonId)), matchupFromJson);
  }

  async matchupsInRound(roundId: string): Promise<Matchup[]> {
    const snap = await getDocs(
      query(collectionGroup(this.db, COLLECTIONS.matchups), where('roundId', '==', roundId)),
    );
    return decodeAll(snap, matchupFromJson);
  }

  async matchupsFor(peachId: string): Promise<Matchup[]> {
    return decodeAll(await getDocs(this.peachMatchupsQuery(peachId)), matchupFromJson);
  }

  /**
   * Matchup documents carry denormalised `peachIds` and `weekStart` fields
   * so "my matchups" is a single indexed query and a matchup's week is
   * readable without its round. Updates merge so those fields survive a
   * plain `saveMatchup`.
   */
  saveMatchup(matchup: Matchup): Promise<void> {
    return setDoc(
      doc(this.matchups(matchup.seasonId), matchup.id),
      { ...matchupToJson(matchup), peachIds: matchupPeachIds(matchup) },
      { merge: true },
    );
  }

  /**
   * Writes a whole schedule in one atomic batch, stamping each matchup with
   * its Round's week. It is deliberately not chunked: a half-written
   * schedule (rounds without their matchups) would let a device open a
   * Round with nobody in it.
   */
  async saveSchedule(rounds: readonly Round[], matchups: readonly Matchup[]): Promise<void> {
    const weeks = new Map(rounds.map((r) => [r.id, r.weekStart]));
    const batch = writeBatch(this.db);
    for (const r of rounds) batch.set(doc(this.rounds(r.seasonId), r.id), roundToJson(r));
    for (const m of matchups) {
      batch.set(doc(this.matchups(m.seasonId), m.id), {
        ...matchupToJson(m),
        peachIds: matchupPeachIds(m),
        weekStart: weeks.get(m.roundId) ?? null,
      });
    }
    await batch.commit();
  }

  watchMatchupsFor(peachId: string): Observable<Matchup[]> {
    return watchQuery(this.peachMatchupsQuery(peachId), (snap) => decodeAll(snap, matchupFromJson));
  }

  /**
   * The rules refuse a crate-mate's lineup until it locks, which is exactly
   * "no lineup you can see", so a refusal reads as null.
   */
  async getLineup(seasonId: string, roundId: string, peachId: string): Promise<Lineup | null> {
    try {
      const snap = await getDoc(doc(this.lineups(seasonId), lineupKey(roundId, peachId)));
      return decodeDoc(snap, lineupFromJson);
    } catch (e) {
      if ((e as { code?: string }).code === 'permission-denied') return null;
      throw e;
    }
  }

  saveLineup(lineup: Lineup): Promise<void> {
    return setDoc(
      doc(this.lineups(lineup.seasonId), lineupKey(lineup.roundId, lineup.peachId)),
      lineupToJson(lineup),
    );
  }
}

export class FirestoreWorkoutLogRepository implements WorkoutLogRepository {
  constructor(private readonly db: Firestore) {}

  private get col(): CollectionReference {
    return collection(this.db, COLLECTIONS.workoutLogs);
  }

  private shared(crateId: string): CollectionReference {
    return collection(this.db, COLLECTIONS.crates, crateId, COLLECTIONS.sharedLogs);
  }

  private exercises(crateId: string): CollectionReference {
    return collection(this.db, COLLECTIONS.crates, crateId, COLLECTIONS.sharedExercises);
  }

  private peachQuery(peachId: string): Query {
    return query(this.col, where('peachId', '==', peachId));
  }

  private static newestFirst(logs: WorkoutLog[]): WorkoutLog[] {
    return logs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  async getById(id: string): Promise<WorkoutLog | null> {
    return decodeDoc(await getDoc(doc(this.col, id)), workoutLogFromJson);
  }

  async forPeach(peachId: string): Promise<WorkoutLog[]> {
    const snap = await getDocs(this.peachQuery(peachId));
    return FirestoreWorkoutLogRepository.newestFirst(decodeAll(snap, workoutLogFromJson));
  }

  save(log: WorkoutLog): Promise<void> {
    return setDoc(doc(this.col, log.id), workoutLogToJson(log));
  }

  /**
   * The private log, its copy under each Crate and the exercises it shares
   * with them, in one batch. Crate members can read the copies but never
   * the Peach's own log collection, which also holds unsubmitted drafts.
   */
  async saveSubmitted(log: WorkoutLog): Promise<void> {
    const json = workoutLogToJson(log);
    const batch = writeBatch(this.db);
    batch.set(doc(this.col, log.id), json);
    for (const crateId of log.sharedWith) batch.set(doc(this.shared(crateId), log.id), json);
    for (const e of sharedExercisesOf(log)) {
      batch.set(
        doc(this.exercises(e.crateId), sharedExerciseKey(e.exercise.id, e.peachId)),
        sharedExerciseToJson(e),
      );
    }
    await batch.commit();
  }

  async getShared(crateId: string, logId: string): Promise<WorkoutLog | null> {
    return decodeDoc(await getDoc(doc(this.shared(crateId), logId)), workoutLogFromJson);
  }

  /** `startedAt` is an ISO string in UTC, so string order is time order. */
  async sharedWith(crateId: string, from: Date, to: Date): Promise<WorkoutLog[]> {
    const snap = await getDocs(
      query(
        this.shared(crateId),
        where('startedAt', '>=', dateTimeToJson(from)),
        where('startedAt', '<', dateTimeToJson(to)),
      ),
    );
    return FirestoreWorkoutLogRepository.newestFirst(decodeAll(snap, workoutLogFromJson));
  }

  async recentlySharedWith(crateId: string, max: number): Promise<WorkoutLog[]> {
    const snap = await getDocs(
      query(this.shared(crateId), orderBy('startedAt', 'desc'), limit(max)),
    );
    return decodeAll(snap, workoutLogFromJson);
  }

  async exercisesSharedWith(crateId: string): Promise<SharedExercise[]> {
    return decodeAll(await getDocs(this.exercises(crateId)), sharedExerciseFromJson);
  }

  watch(id: string): Observable<WorkoutLog | null> {
    return watchDoc(doc(this.col, id), workoutLogFromJson);
  }

  watchForPeach(peachId: string): Observable<WorkoutLog[]> {
    return watchQuery(this.peachQuery(peachId), (snap) =>
      FirestoreWorkoutLogRepository.newestFirst(decodeAll(snap, workoutLogFromJson)),
    );
  }
}

/** Ballots are keyed by Peach id: one per member per Crate. */
export class FirestoreBallotRepository implements BallotRepository {
  constructor(private readonly db: Firestore) {}

  private col(crateId: string): CollectionReference {
    return collection(this.db, COLLECTIONS.crates, crateId, COLLECTIONS.ballots);
  }

  async forCrate(crateId: string): Promise<Ballot[]> {
    return decodeAll(await getDocs(this.col(crateId)), ballotFromJson);
  }

  save(ballot: Ballot): Promise<void> {
    return setDoc(doc(this.col(ballot.crateId), ballot.peachId), ballotToJson(ballot));
  }
}

/** Disputes live under their Crate, keyed by log and disputed numbers. */
export class FirestoreDisputeRepository implements DisputeRepository {
  constructor(private readonly db: Firestore) {}

  private col(crateId: string): CollectionReference {
    return collection(this.db, COLLECTIONS.crates, crateId, COLLECTIONS.disputes);
  }

  async get(crateId: string, id: string): Promise<Dispute | null> {
    return decodeDoc(await getDoc(doc(this.col(crateId), id)), disputeFromJson);
  }

  async forLogs(crateId: string, logIds: Iterable<string>): Promise<Dispute[]> {
    const snaps = await Promise.all(
      chunk(new Set(logIds), WHERE_IN_LIMIT).map((part) =>
        getDocs(query(this.col(crateId), where('logId', 'in', part))),
      ),
    );
    return snaps.flatMap((snap) => decodeAll(snap, disputeFromJson));
  }

  /** `openedAt` is an ISO string in UTC, so string order is time order. */
  async openedSince(crateId: string, since: Date): Promise<Dispute[]> {
    const snap = await getDocs(
      query(
        this.col(crateId),
        where('openedAt', '>=', dateTimeToJson(since)),
        orderBy('openedAt', 'desc'),
      ),
    );
    return decodeAll(snap, disputeFromJson);
  }

  create(dispute: Dispute): Promise<void> {
    return setDoc(doc(this.col(dispute.crateId), dispute.id), disputeToJson(dispute));
  }

  /** A field update, so the rules can check each member only touches their own vote. */
  vote(crateId: string, id: string, peachId: string, vote: DisputeVote): Promise<void> {
    return updateDoc(doc(this.col(crateId), id), { [`votes.${peachId}`]: vote });
  }
}

/** One of each repository, all on the same database. */
export function firestoreRepositories(db: Firestore): Repositories {
  return {
    peaches: new FirestorePeachRepository(db),
    crates: new FirestoreCrateRepository(db),
    seasons: new FirestoreSeasonRepository(db),
    logs: new FirestoreWorkoutLogRepository(db),
    ballots: new FirestoreBallotRepository(db),
    disputes: new FirestoreDisputeRepository(db),
  };
}
