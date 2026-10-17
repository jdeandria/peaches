import {
  Dispute,
  disputeKey,
  disputeOutcome,
  metricSnapshot,
  SESSION_TIME,
  stillApplies,
  withoutStruck,
} from './dispute';
import { exerciseLogEntry, setLog, upsertEntry, workoutLog } from './workout-log';

describe('disputes', () => {
  const run = exerciseLogEntry({
    exerciseId: 'bw-run',
    exerciseName: 'Run',
    distanceKind: 'runWalk',
    sets: [setLog({ meters: 50_000, seconds: 18_000 })],
  });
  const squat = exerciseLogEntry({ exerciseId: 'squat', sets: [setLog({ reps: 10 })] });
  const log = workoutLog({
    id: 'l',
    peachId: 'ada',
    startedAt: new Date(Date.UTC(2026, 9, 10)),
    status: 'submitted',
    durationSeconds: 3600,
    entries: [run, squat],
  });
  const dispute = (target: string, votes: Dispute['votes'] = {}): Dispute => {
    const snapshot = metricSnapshot(log, target)!;
    return {
      id: disputeKey(log.id, snapshot),
      crateId: 'c',
      logId: log.id,
      peachId: 'ada',
      target,
      label: target,
      snapshot,
      openedBy: 'ben',
      openedAt: new Date(),
      votes,
    };
  };
  const members = (...ids: string[]) => new Set(ids);

  it('is struck once more than half the Crate votes strike; the owner counts as keep', () => {
    const crate = members('ada', 'ben', 'cho', 'dev', 'eve');
    const d = dispute('bw-run', { ben: 'strike', cho: 'strike' });
    expect(disputeOutcome(d, crate)).toMatchObject({
      outcome: 'open',
      strike: 2,
      keep: 1,
      needed: 3,
    });
    expect(disputeOutcome({ ...d, votes: { ...d.votes, dev: 'strike' } }, crate).outcome).toBe(
      'struck',
    );
    // Strike can no longer reach three once three of five keep it.
    expect(
      disputeOutcome({ ...d, votes: { ben: 'strike', cho: 'keep', dev: 'keep' } }, crate).outcome,
    ).toBe('kept');
    // The owner can't vote themselves out, and leavers' votes don't count.
    expect(disputeOutcome({ ...d, votes: { ada: 'strike', ...d.votes } }, crate).strike).toBe(2);
    expect(disputeOutcome(d, members('ada', 'ben', 'dev')).strike).toBe(1);
  });

  it('a two-Peach Crate can never strike the owner’s numbers', () => {
    expect(
      disputeOutcome(dispute('bw-run', { ben: 'strike' }), members('ada', 'ben')).outcome,
    ).toBe('kept');
  });

  it('struck numbers stop scoring; editing them ends the dispute', () => {
    const struck = withoutStruck(log, [dispute('bw-run'), dispute(SESSION_TIME)]);
    expect(struck.entries).toEqual([squat]);
    expect(struck.durationSeconds).toBe(0);

    const fixed = upsertEntry(log, {
      ...run,
      sets: [setLog({ meters: 5000, seconds: 1800 })],
    });
    expect(stillApplies(dispute('bw-run'), fixed)).toBe(false);
    expect(withoutStruck(fixed, [dispute('bw-run')]).entries).toHaveLength(2);
    // Editing something else leaves the dispute standing.
    expect(stillApplies(dispute('bw-run'), upsertEntry(log, { ...squat, rpe: 7 }))).toBe(true);
  });

  it('the snapshot names the target, so keys differ per metric', () => {
    expect(metricSnapshot(log, 'bw-run')).toMatch(/^bw-run~/);
    expect(metricSnapshot(log, SESSION_TIME)).not.toBe(metricSnapshot(log, 'bw-run'));
    expect(metricSnapshot(log, 'nope')).toBeNull();
  });
});
