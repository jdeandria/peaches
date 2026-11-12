import { addDays, localDate, LocalDate } from '../core/local-date';
import { UtcZoneClock } from '../core/zone-clock';
import { ExerciseCatalog } from '../exercises/exercise-catalog';
import {
  BOT_LEVELS,
  BOT_STYLES,
  botId,
  botPeach,
  BotLevel,
  BotStyle,
  crateIdOfBot,
  CrateBot,
  isBotId,
} from '../models/bot';
import { DEFAULT_WEIGHTS } from '../models/scoring';
import { plannedEntries } from '../models/week-plan';
import { BotTrainer, botLoadKg, parseBotLogId } from './bot-trainer';
import { implausibility } from './plausibility';
import { ScoringService } from './scoring-service';

describe('BotTrainer', () => {
  const catalog = ExerciseCatalog.standard();
  const trainer = new BotTrainer(catalog, new UtcZoneClock());
  const scoring = new ScoringService();
  const crate = { id: 'c1', timeZone: 'UTC' };
  /** Monday 5 October 2026. */
  const monday = localDate(2026, 10, 5);
  const utc = (date: LocalDate, hour = 0) =>
    new Date(`${date}T${String(hour).padStart(2, '0')}:00:00Z`);
  const addedAt = utc(addDays(monday, -14));

  const bot = (
    n: number,
    level: BotLevel = 'steady',
    style: BotStyle = 'allRounder',
  ): CrateBot => ({
    id: botId(crate.id, n),
    name: `Bot ${n}`,
    level,
    style,
    addedAt,
    removedAt: null,
  });

  /** Weeks to average over. */
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(monday, i * 7));

  it('bot ids say they are bots, and which Crate', () => {
    const id = botId('crate_with_underscores', 3);
    expect(isBotId(id)).toBe(true);
    expect(crateIdOfBot(id)).toBe('crate_with_underscores');
    expect(isBotId('peach-1')).toBe(false);
    expect(crateIdOfBot('peach-1')).toBeNull();
    expect(botPeach(bot(1), crate)).toEqual(
      expect.objectContaining({ id: botId('c1', 1), displayName: 'Bot 1', timeZone: 'UTC' }),
    );
  });

  it('plans the same week the same way every time, and other weeks differently', () => {
    const a = new BotTrainer(catalog, new UtcZoneClock()).plan(bot(1), monday);
    const b = new BotTrainer(catalog, new UtcZoneClock()).plan(bot(1), addDays(monday, 3));
    expect(b).toEqual(a);
    expect(trainer.plan(bot(1), addDays(monday, 7))).not.toEqual(a);
    expect(trainer.plan(bot(2), monday)).not.toEqual(a);
  });

  it('plans workouts on different days of the week, each plausible', () => {
    for (const level of BOT_LEVELS) {
      for (const style of BOT_STYLES) {
        for (const week of weeks) {
          const plan = trainer.plan(bot(1, level, style), week);
          expect(plan.weekStart).toBe(week);
          expect(plan.workouts.length).toBeGreaterThanOrEqual(2);
          expect(new Set(plan.workouts.map((w) => w.day)).size).toBe(plan.workouts.length);
          for (const w of plan.workouts) {
            expect(w.day >= week && w.day <= addDays(week, 6)).toBe(true);
            expect(w.exercises.length).toBeGreaterThan(0);
            for (const e of w.exercises) {
              expect(implausibility(e), `${level} ${style} ${e.exerciseName}`).toBeNull();
              if (e.takesLoad && e.track === 'reps') {
                expect(e.sets.every((s) => (s.loadKg ?? 0) > 0)).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it('runners run, lifters lift', () => {
    const kinds = (style: BotStyle) =>
      weeks.flatMap((w) =>
        plannedEntries(trainer.plan(bot(1, 'steady', style), w)).map((e) => e.track),
      );
    const share = (tracks: string[], track: string) =>
      tracks.filter((t) => t === track).length / tracks.length;
    expect(share(kinds('runner'), 'distance')).toBeGreaterThan(share(kinds('lifter'), 'distance'));
    expect(kinds('lifter')).not.toContain('distance');
  });

  it('stronger bots plan to earn more, and lift more', () => {
    const worth = (level: BotLevel) =>
      weeks.reduce(
        (sum, w) =>
          sum +
          scoring.scorePlan(plannedEntries(trainer.plan(bot(1, level), w)), DEFAULT_WEIGHTS).total,
        0,
      ) / weeks.length;
    expect(worth('easy')).toBeLessThan(worth('steady'));
    expect(worth('steady')).toBeLessThan(worth('strong'));
    const squat = catalog.require('bb-back-squat');
    expect(botLoadKg(squat, 'easy')).toBeLessThan(botLoadKg(squat, 'strong'));
    expect(botLoadKg(catalog.require('db-biceps-curl'), 'steady')).toBeLessThan(
      botLoadKg(squat, 'steady'),
    );
  });

  it('does most of its plan, at times on the day it planned, as shared submitted logs', () => {
    let planned = 0;
    let done = 0;
    for (const [n, week] of [1, 2, 3, 4].flatMap((n) => weeks.map((w) => [n, w] as const))) {
      const plan = trainer.plan(bot(n), week);
      const logs = trainer.weekLogs(bot(n), crate, week);
      planned += plan.workouts.length;
      done += logs.length;
      for (const log of logs) {
        const workout = plan.workouts.find((w) => w.id === log.id)!;
        expect(log.startedAt.toISOString().slice(0, 10)).toBe(workout.day);
        expect(log.status).toBe('submitted');
        expect(log.peachId).toBe(bot(n).id);
        expect(log.sharedWith).toEqual(['c1']);
        expect(log.durationSeconds).toBeGreaterThan(0);
        expect(log.completedAt!.getTime()).toBe(
          log.startedAt.getTime() + log.durationSeconds * 1000,
        );
        log.entries.forEach((e) => expect(implausibility(e)).toBeNull());
        expect(parseBotLogId(log.id)).toEqual({
          botId: bot(n).id,
          weekStart: week,
          index: expect.any(Number),
        });
      }
    }
    expect(done).toBeLessThan(planned);
    expect(done / planned).toBeGreaterThan(0.6);
  });

  it('easy bots miss their plan more often than strong ones', () => {
    const hits = (level: BotLevel) =>
      [1, 2, 3, 4, 5].reduce(
        (n, i) =>
          n +
          weeks.filter((w) => {
            const b = bot(i, level);
            const committed = scoring.scorePlan(
              plannedEntries(trainer.plan(b, w)),
              DEFAULT_WEIGHTS,
            ).total;
            const earned = scoring.scoreTotals(
              scoring.totalsOf(trainer.weekLogs(b, crate, w)),
              DEFAULT_WEIGHTS,
            ).total;
            return earned >= committed;
          }).length,
        0,
      );
    expect(hits('easy')).toBeLessThan(hits('strong'));
    expect(hits('strong')).toBeGreaterThan(0);
  });

  it('shares a workout once it is finished, and only while it was in the Crate', () => {
    const b = bot(1, 'strong');
    const all = trainer.weekLogs(b, crate, monday);
    const from = utc(monday);
    const to = utc(addDays(monday, 7));
    expect(trainer.logs(b, crate, from, to, to)).toEqual(all);
    const first = all[0];
    expect(trainer.logs(b, crate, from, to, first.startedAt)).toEqual([]);
    expect(trainer.logs(b, crate, from, to, first.completedAt!)).toEqual([first]);
    expect(trainer.log(b, crate, first.id, first.startedAt)).toBeNull();
    expect(trainer.log(b, crate, first.id, to)).toEqual(first);
    expect(trainer.log(b, crate, `${first.id}9`, to)).toBeNull();

    const joinedLate = { ...b, addedAt: first.completedAt! };
    expect(trainer.logs(joinedLate, crate, from, to, to)).toEqual(all.slice(1));
    const left = { ...b, removedAt: first.completedAt! };
    expect(trainer.logs(left, crate, from, to, to)).toEqual([first]);
    expect(trainer.log(left, crate, all[1].id, to)).toBeNull();
  });

  it('finds workouts across weeks and time zones', () => {
    const b = bot(1, 'strong');
    const from = utc(monday);
    const to = utc(addDays(monday, 21));
    const logs = trainer.logs(b, crate, from, to, to);
    const expected = [0, 7, 14].flatMap((d) => trainer.weekLogs(b, crate, addDays(monday, d)));
    expect(logs).toEqual(expected);

    // Same plans in another zone, at that zone's times of day.
    const tokyo = new BotTrainer(catalog, {
      startOfDay: (date) => new Date(utc(date).getTime() - 9 * 3_600_000),
      dateOf: (instant) =>
        new Date(instant.getTime() + 9 * 3_600_000).toISOString().slice(0, 10) as LocalDate,
    });
    const shifted = tokyo.weekLogs(b, { id: 'c1', timeZone: 'Asia/Tokyo' }, monday);
    expect(shifted.map((l) => l.id)).toEqual(trainer.weekLogs(b, crate, monday).map((l) => l.id));
  });
});
