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
  query,
  Query,
  QuerySnapshot,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { Observable, from, map, switchMap } from 'rxjs';

import { Repositories } from '../../application/app-container';
import { JsonMap } from '../../domain/core/json';
import { LocalDate } from '../../domain/core/local-date';
import {
  capabilityFromJson,
  capabilityToJson,
  ExerciseCapability,
} from '../../domain/models/capability';
import {
  Crate,
  crateFromJson,
  CrateMembership,
  crateToJson,
  isActiveMembership,
  membershipFromJson,
  membershipToJson,
} from '../../domain/models/crate';
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
import { Workout, workoutFromJson, workoutToJson } from '../../domain/models/workout';
import { WorkoutLog, workoutLogFromJson, workoutLogToJson } from '../../domain/models/workout-log';
import {
  CapabilityRepository,
  CrateRepository,
  PeachRepository,
  SeasonRepository,
  WorkoutLogRepository,
  WorkoutRepository,
} from '../../domain/repositories';

/**
 * Firestore collection names, in one place so rules and indexes can be
 * cross-checked against the code.
 */
export const COLLECTIONS = {
  peaches: 'peaches',
  capabilities: 'capabilities',
  crates: 'crates',
  memberships: 'memberships',
  seasons: 'seasons',
  rounds: 'rounds',
  matchups: 'matchups',
  workouts: 'workouts',
  workoutLogs: 'workoutLogs',
} as const;

/** Firestore `in` filters accept at most 30 values. */
const WHERE_IN_LIMIT = 30;

/** Batches are capped at 500 writes; stay well under. */
const BATCH_LIMIT = 450;

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

export class FirestoreCapabilityRepository implements CapabilityRepository {
  constructor(private readonly db: Firestore) {}

  private col(peachId: string): CollectionReference {
    return collection(this.db, COLLECTIONS.peaches, peachId, COLLECTIONS.capabilities);
  }

  async forPeach(peachId: string): Promise<ExerciseCapability[]> {
    return decodeAll(await getDocs(this.col(peachId)), capabilityFromJson);
  }

  async forPeaches(peachIds: Iterable<string>): Promise<ExerciseCapability[]> {
    const results = await Promise.all([...new Set(peachIds)].map((id) => this.forPeach(id)));
    return results.flat();
  }

  /** Capability documents are keyed by exercise id: one per exercise per Peach. */
  save(capability: ExerciseCapability): Promise<void> {
    return setDoc(
      doc(this.col(capability.peachId), capability.exerciseId),
      capabilityToJson(capability),
    );
  }

  async saveAll(capabilities: Iterable<ExerciseCapability>): Promise<void> {
    for (const part of chunk(capabilities, BATCH_LIMIT)) {
      const batch = writeBatch(this.db);
      for (const c of part) batch.set(doc(this.col(c.peachId), c.exerciseId), capabilityToJson(c));
      await batch.commit();
    }
  }

  watchForPeach(peachId: string): Observable<ExerciseCapability[]> {
    return watchQuery(this.col(peachId), (snap) => decodeAll(snap, capabilityFromJson));
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

  /** `on` uses the denormalised `date` (composite index with `peachIds`). */
  async matchupsFor(peachId: string, on?: LocalDate): Promise<Matchup[]> {
    const base = this.peachMatchupsQuery(peachId);
    const q = on === undefined ? base : query(base, where('date', '==', on));
    return decodeAll(await getDocs(q), matchupFromJson);
  }

  /**
   * Matchup documents carry denormalised `peachIds` and `date` fields so
   * "my matchups" and "matchups on a day" are single indexed queries.
   * Updates merge so those fields survive a plain `saveMatchup`.
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
   * its Round's date. It is deliberately not chunked: a half-written
   * schedule (rounds without their matchups) would let a device open a
   * Round with nobody in it.
   */
  async saveSchedule(rounds: readonly Round[], matchups: readonly Matchup[]): Promise<void> {
    const dates = new Map(rounds.map((r) => [r.id, r.date]));
    const batch = writeBatch(this.db);
    for (const r of rounds) batch.set(doc(this.rounds(r.seasonId), r.id), roundToJson(r));
    for (const m of matchups) {
      batch.set(doc(this.matchups(m.seasonId), m.id), {
        ...matchupToJson(m),
        peachIds: matchupPeachIds(m),
        date: dates.get(m.roundId) ?? null,
      });
    }
    await batch.commit();
  }

  watchMatchupsFor(peachId: string): Observable<Matchup[]> {
    return watchQuery(this.peachMatchupsQuery(peachId), (snap) => decodeAll(snap, matchupFromJson));
  }
}

export class FirestoreWorkoutRepository implements WorkoutRepository {
  constructor(private readonly db: Firestore) {}

  private get col(): CollectionReference {
    return collection(this.db, COLLECTIONS.workouts);
  }

  async getById(id: string): Promise<Workout | null> {
    return decodeDoc(await getDoc(doc(this.col, id)), workoutFromJson);
  }

  getByIds(ids: Iterable<string>): Promise<Workout[]> {
    return getByDocumentIds(this.col, ids, workoutFromJson);
  }

  save(workout: Workout): Promise<void> {
    return setDoc(doc(this.col, workout.id), workoutToJson(workout));
  }
}

export class FirestoreWorkoutLogRepository implements WorkoutLogRepository {
  constructor(private readonly db: Firestore) {}

  private get col(): CollectionReference {
    return collection(this.db, COLLECTIONS.workoutLogs);
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

  /** Uses the (matchupId, peachId) composite index. */
  async forMatchup(matchupId: string, peachId: string): Promise<WorkoutLog | null> {
    const snap = await getDocs(
      query(
        this.col,
        where('matchupId', '==', matchupId),
        where('peachId', '==', peachId),
        limit(1),
      ),
    );
    return decodeFirst(snap, workoutLogFromJson);
  }

  async forPeach(peachId: string): Promise<WorkoutLog[]> {
    const snap = await getDocs(this.peachQuery(peachId));
    return FirestoreWorkoutLogRepository.newestFirst(decodeAll(snap, workoutLogFromJson));
  }

  save(log: WorkoutLog): Promise<void> {
    return setDoc(doc(this.col, log.id), workoutLogToJson(log));
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

/** One of each repository, all on the same database. */
export function firestoreRepositories(db: Firestore): Repositories {
  return {
    peaches: new FirestorePeachRepository(db),
    crates: new FirestoreCrateRepository(db),
    capabilities: new FirestoreCapabilityRepository(db),
    seasons: new FirestoreSeasonRepository(db),
    workouts: new FirestoreWorkoutRepository(db),
    logs: new FirestoreWorkoutLogRepository(db),
  };
}
