import {
  doneCount,
  elapsedSeconds,
  entryFor,
  exerciseLogEntry,
  hasStarted,
  logPlannedSet,
  nextPlannedSet,
  pauseTimer,
  planCoveringEntries,
  plannedFor,
  planProgress,
  removePlanned,
  reorderPlan,
  resumeTimer,
  setLog,
  skipPlannedSet,
  startSession,
  unlogLastSet,
  upsertPlanned,
  workoutLog,
} from './workout-log';

describe('the workout clock', () => {
  const t = (seconds: number) => new Date(Date.UTC(2026, 9, 10, 9) + seconds * 1000);
  const log = workoutLog({ id: 'l', peachId: 'p', startedAt: t(0), timerStartedAt: t(0) });

  it('runs while the log is open and banks time when paused', () => {
    expect(elapsedSeconds(log, t(90))).toBe(90);
    const paused = pauseTimer(log, t(90));
    expect(paused).toMatchObject({ durationSeconds: 90, timerStartedAt: null });
    // Time while paused (the screen closed) doesn't count.
    expect(elapsedSeconds(paused, t(600))).toBe(90);
    const resumed = resumeTimer(paused, t(600));
    expect(elapsedSeconds(resumed, t(630))).toBe(120);
  });

  it('pausing a paused clock or resuming a running one changes nothing', () => {
    expect(resumeTimer(log, t(50))).toBe(log);
    const paused = pauseTimer(log, t(10));
    expect(pauseTimer(paused, t(20))).toBe(paused);
  });
});

describe('entries say how they are logged', () => {
  it('defaults to what the sets record', () => {
    const entry = (sets: Parameters<typeof setLog>[0][]) =>
      exerciseLogEntry({ exerciseId: 'x', sets: sets.map(setLog) });
    expect(entry([{ reps: 5, loadKg: 20 }])).toMatchObject({ track: 'reps', takesLoad: true });
    expect(entry([{ reps: 5 }])).toMatchObject({ track: 'reps', takesLoad: false });
    expect(entry([{ seconds: 30 }]).track).toBe('time');
    expect(entry([{ meters: 400, seconds: 90 }]).track).toBe('distance');
  });
});

describe('a session plan', () => {
  const t = (seconds: number) => new Date(Date.UTC(2026, 9, 10, 9) + seconds * 1000);
  const squat = (...reps: number[]) =>
    exerciseLogEntry({
      exerciseId: 'squat',
      exerciseName: 'Squat',
      sets: reps.map((r) => setLog({ reps: r, loadKg: 60 })),
    });
  const plank = exerciseLogEntry({
    exerciseId: 'plank',
    exerciseName: 'Plank',
    sets: [setLog({ seconds: 45 })],
  });
  const planned = workoutLog({
    id: 'l',
    peachId: 'p',
    startedAt: t(0),
    plan: [squat(5, 5), plank],
  });

  it('starts when the workout starts, and only then', () => {
    expect(hasStarted(planned)).toBe(false);
    const started = startSession(planned, t(300));
    expect(started).toMatchObject({ startedAt: t(300), timerStartedAt: t(300) });
    expect(hasStarted(started)).toBe(true);
    // Starting again only resumes: the start time stays.
    const paused = pauseTimer(started, t(360));
    expect(startSession(paused, t(900))).toMatchObject({
      startedAt: t(300),
      timerStartedAt: t(900),
    });
  });

  it('works through the planned sets in order', () => {
    expect(nextPlannedSet(planned)).toEqual({ exercise: planned.plan[0], index: 0 });
    let log = logPlannedSet(planned, 'squat', setLog({ reps: 6, loadKg: 60 }));
    expect(nextPlannedSet(log)?.index).toBe(1);
    expect(planProgress(log)).toEqual({ done: 1, total: 3 });
    // What was done is recorded as done, however it differs from the plan.
    expect(entryFor(log, 'squat')?.sets).toEqual([setLog({ reps: 6, loadKg: 60 })]);
    expect(entryFor(log, 'squat')?.exerciseName).toBe('Squat');
    log = logPlannedSet(log, 'squat', setLog({ reps: 5, loadKg: 60 }));
    expect(nextPlannedSet(log)?.exercise.exerciseId).toBe('plank');
    log = logPlannedSet(log, 'plank', setLog({ seconds: 50 }));
    expect(nextPlannedSet(log)).toBeNull();
    expect(planProgress(log)).toEqual({ done: 3, total: 3 });
  });

  it('a new working weight carries to the sets still to come at the old one', () => {
    const plan = exerciseLogEntry({
      exerciseId: 'squat',
      exerciseName: 'Squat',
      sets: [60, 60, 70, 60].map((loadKg) => setLog({ reps: 5, loadKg })),
    });
    const log = workoutLog({ id: 'l', peachId: 'p', startedAt: t(0), plan: [plan] });
    const heavier = logPlannedSet(log, 'squat', setLog({ reps: 5, loadKg: 62.5 }));
    expect(plannedFor(heavier, 'squat')?.sets.map((s) => s.loadKg)).toEqual([60, 62.5, 70, 62.5]);
    // Same weight as planned: the plan stays as it was.
    const asPlanned = logPlannedSet(log, 'squat', setLog({ reps: 4, loadKg: 60 }));
    expect(asPlanned.plan).toBe(log.plan);
    // Bodyweight exercises have no working weight to carry.
    const plankPlan = { ...plank, sets: [setLog({ seconds: 45 }), setLog({ seconds: 45 })] };
    const timed = workoutLog({ id: 'l', peachId: 'p', startedAt: t(0), plan: [plankPlan] });
    expect(logPlannedSet(timed, 'plank', setLog({ seconds: 50 })).plan).toBe(timed.plan);
  });

  it('skips and takes back sets', () => {
    let log = skipPlannedSet(planned, 'squat');
    expect(plannedFor(log, 'squat')?.sets).toHaveLength(1);
    log = skipPlannedSet(log, 'squat');
    // Nothing left of it, so it leaves the plan.
    expect(plannedFor(log, 'squat')).toBeUndefined();

    log = logPlannedSet(planned, 'squat', setLog({ reps: 5, loadKg: 60 }));
    log = logPlannedSet(log, 'squat', setLog({ reps: 4, loadKg: 60 }));
    log = unlogLastSet(log, 'squat');
    expect(doneCount(log, 'squat')).toBe(1);
    log = unlogLastSet(log, 'squat');
    expect(entryFor(log, 'squat')).toBeUndefined();
  });

  it('keeps one list: logged exercises join the plan, and plans can be edited', () => {
    const logged = workoutLog({ id: 'l', peachId: 'p', startedAt: t(0), entries: [plank] });
    expect(planCoveringEntries(logged).plan).toEqual([plank]);
    expect(planCoveringEntries(planned)).toBe(planned);
    const changed = upsertPlanned(planned, squat(8, 8, 8));
    expect(changed.plan.map((e) => e.sets.length)).toEqual([3, 1]);
    expect(removePlanned(changed, 'squat').plan).toEqual([plank]);
    // Put back where it was, as Undo does.
    const back = upsertPlanned(removePlanned(planned, 'squat'), planned.plan[0], 0);
    expect(back.plan.map((e) => e.exerciseId)).toEqual(['squat', 'plank']);
  });

  it('can be done in another order', () => {
    const ids = (log: typeof planned) => log.plan.map((e) => e.exerciseId);
    const swapped = reorderPlan(planned, ['plank', 'squat']);
    expect(ids(swapped)).toEqual(['plank', 'squat']);
    // The order decides what's next, even part way through an exercise.
    const started = logPlannedSet(planned, 'squat', setLog({ reps: 5, loadKg: 60 }));
    expect(nextPlannedSet(reorderPlan(started, ['plank', 'squat']))).toEqual({
      exercise: plank,
      index: 0,
    });
    // Unknown ids are ignored; planned ones left out keep their place after.
    expect(ids(reorderPlan(planned, ['plank', 'nope']))).toEqual(['plank', 'squat']);
    expect(ids(reorderPlan(planned, []))).toEqual(['squat', 'plank']);
  });
});
