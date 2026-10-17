import {
  elapsedSeconds,
  exerciseLogEntry,
  pauseTimer,
  resumeTimer,
  setLog,
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
