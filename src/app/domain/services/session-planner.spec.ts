import { isPull, isPush, isCore } from '../exercises/taxonomy';
import { SESSION_FOCUSES, TRAINING_GOALS } from '../models/training';
import { SessionPlan, SessionPlanner, slot, slotCount } from './session-planner';

describe('SessionPlanner', () => {
  const planner = new SessionPlanner();
  const strengthOf = (p: SessionPlan) => p.blocks.find((b) => b.type === 'strength')!;
  const conditioningCount = (p: SessionPlan) =>
    p.blocks.filter((b) => b.type === 'conditioning').reduce((n, b) => n + b.slots.length, 0);

  it('every plan starts with a warm-up and ends with a cool-down', () => {
    for (const focus of SESSION_FOCUSES) {
      for (const goal of TRAINING_GOALS) {
        const plan = planner.plan(focus, goal, 40);
        expect(plan.blocks[0].type, focus).toBe('warmUp');
        expect(plan.blocks.at(-1)!.type, focus).toBe('coolDown');
        for (const s of plan.blocks[0].slots) expect(s.scoringWeight).toBe(0);
        for (const s of plan.blocks.at(-1)!.slots) expect(s.scoringWeight).toBe(0);
      }
    }
  });

  it('blocks are always in canonical order with no empty blocks', () => {
    const order = ['warmUp', 'strength', 'conditioning', 'coolDown'];
    for (const focus of SESSION_FOCUSES) {
      for (const goal of TRAINING_GOALS) {
        for (const minutes of [15, 20, 30, 40, 45, 50, 60, 90, 120]) {
          const plan = planner.plan(focus, goal, minutes);
          const idx = plan.blocks.map((b) => order.indexOf(b.type));
          expect(
            [...idx].sort((a, b) => a - b),
            `${focus} ${goal} ${minutes}`,
          ).toEqual(idx);
          expect(new Set(idx).size).toBe(idx.length);
          for (const b of plan.blocks) expect(b.slots.length).toBeGreaterThan(0);
          expect(plan.focus).toBe(focus);
          expect(plan.goal).toBe(goal);
          expect(plan.durationMinutes).toBe(minutes);
        }
      }
    }
  });

  it('full body pairs push with pull and knee with hip dominant', () => {
    const plan = planner.plan('fullBody', 'generalFitness', 45);
    const firstChoices = strengthOf(plan).slots.map((s) => s.patterns[0]);
    expect(firstChoices).toContain('squat');
    expect(firstChoices).toContain('hinge');
    expect(firstChoices.filter(isPush).length).toBe(1);
    expect(firstChoices.filter(isPull).length).toBe(1);
    expect(firstChoices.some(isCore)).toBe(true);
  });

  it('upper body has two pushes and two pulls', () => {
    const plan = planner.plan('upperBody', 'hypertrophy', 45);
    const required = strengthOf(plan).slots.filter((s) => !s.optional);
    expect(required.filter((s) => isPush(s.patterns[0])).length).toBe(2);
    expect(required.filter((s) => isPull(s.patterns[0])).length).toBe(2);
  });

  it('lower body includes squat, hinge and single-leg work', () => {
    const plan = planner.plan('lowerBody', 'strength', 40);
    const required = strengthOf(plan)
      .slots.filter((s) => !s.optional)
      .map((s) => s.patterns[0]);
    expect(required).toEqual(expect.arrayContaining(['squat', 'hinge', 'lunge']));
  });

  it('shorter sessions carry fewer slots', () => {
    const short = planner.plan('fullBody', 'generalFitness', 20);
    const long = planner.plan('fullBody', 'generalFitness', 75);
    expect(slotCount(short)).toBeLessThan(slotCount(long));
    // Required slots are never trimmed away in favour of optional ones.
    expect(strengthOf(short).slots.some((s) => s.optional)).toBe(false);
  });

  it('required slots survive trimming at every duration', () => {
    for (const focus of SESSION_FOCUSES) {
      const full = planner.plan(focus, 'generalFitness', 120);
      const requiredLabels = strengthOf(full)
        .slots.filter((s) => !s.optional)
        .map((s) => s.label);
      for (const minutes of [15, 20, 25, 30, 40, 60]) {
        const labels = strengthOf(planner.plan(focus, 'generalFitness', minutes)).slots.map(
          (s) => s.label,
        );
        expect(labels.slice(0, requiredLabels.length), `${focus} ${minutes}`).toEqual(
          requiredLabels,
        );
      }
    }
  });

  it('the strength budget grows with time and is capped', () => {
    // budget = clamp(floor((minutes - 10) / 7), 2, 8); fullBody has 7 slots, 5 required.
    const n = (m: number) => strengthOf(planner.plan('fullBody', 'generalFitness', m)).slots.length;
    expect(n(15)).toBe(5); // budget 2 < required: required kept
    expect(n(51)).toBe(5); // budget 5
    expect(n(52)).toBe(6); // budget 6
    expect(n(59)).toBe(7); // budget 7
    expect(n(120)).toBe(7); // budget 8 > slots
  });

  it('warm-up and cool-down get a third slot from 45 minutes', () => {
    expect(planner.plan('fullBody', 'generalFitness', 44).blocks[0].slots.length).toBe(2);
    expect(planner.plan('fullBody', 'generalFitness', 45).blocks[0].slots.length).toBe(3);
    expect(planner.plan('fullBody', 'generalFitness', 45).blocks.at(-1)!.slots.length).toBe(3);
  });

  it('endurance goal adds conditioning; strength goal removes it when short', () => {
    expect(conditioningCount(planner.plan('fullBody', 'endurance', 40))).toBe(2);
    expect(conditioningCount(planner.plan('fullBody', 'strength', 40))).toBe(0);
    expect(conditioningCount(planner.plan('fullBody', 'strength', 50))).toBe(1);
    expect(
      planner.plan('fullBody', 'strength', 40).blocks.some((b) => b.type === 'conditioning'),
    ).toBe(false);
  });

  it('conditioning focus is dominated by conditioning slots', () => {
    const plan = planner.plan('conditioning', 'generalFitness', 40);
    const conditioning = plan.blocks.find((b) => b.type === 'conditioning')!;
    expect(conditioning.slots.length).toBe(4);
    for (const s of conditioning.slots) {
      expect(s.modalities.has('conditioning')).toBe(true);
      expect(s.modalities.has('power')).toBe(true);
    }
    expect(conditioningCount(planner.plan('conditioning', 'generalFitness', 39))).toBe(3);
  });

  it('only the first conditioning slot is required, and plyometrics alternate in', () => {
    const slots = planner
      .plan('conditioning', 'generalFitness', 40)
      .blocks.find((b) => b.type === 'conditioning')!.slots;
    expect(slots.map((s) => s.optional)).toEqual([false, true, true, true]);
    expect(slots.map((s) => s.patterns[0])).toEqual([
      'locomotion',
      'plyometric',
      'locomotion',
      'plyometric',
    ]);
    const endurance = planner
      .plan('conditioning', 'endurance', 40)
      .blocks.find((b) => b.type === 'conditioning')!.slots;
    expect(endurance.every((s) => s.patterns[0] === 'locomotion')).toBe(true);
  });

  it('slot() applies defaults', () => {
    const s = slot({ patterns: ['squat'] });
    expect(s).toEqual({
      patterns: ['squat'],
      fallbackPatterns: [],
      modalities: new Set(),
      scoringWeight: 1,
      optional: false,
      label: null,
    });
  });
});
