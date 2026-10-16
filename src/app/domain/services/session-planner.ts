import { clamp } from '../core/math';
import { Modality, MovementPattern } from '../exercises/taxonomy';
import { SessionFocus, TrainingGoal } from '../models/training';
import { BlockType } from '../models/workout';

/**
 * A position in a session to be filled by one exercise.
 *
 * `patterns` are tried in order of preference; `fallbackPatterns` are used
 * only when nothing in `patterns` is available. `modalities` further
 * restricts candidates (for example only conditioning work in the
 * conditioning block).
 */
export interface SlotSpec {
  readonly patterns: readonly MovementPattern[];
  readonly fallbackPatterns: readonly MovementPattern[];
  readonly modalities: ReadonlySet<Modality>;
  readonly scoringWeight: number;
  /** Optional slots are dropped first when the session runs over time. */
  readonly optional: boolean;
  readonly label: string | null;
}

export interface BlockSpec {
  readonly type: BlockType;
  readonly slots: readonly SlotSpec[];
}

export interface SessionPlan {
  readonly focus: SessionFocus;
  readonly goal: TrainingGoal;
  readonly durationMinutes: number;
  readonly blocks: readonly BlockSpec[];
}

export function slotCount(plan: SessionPlan): number {
  return plan.blocks.reduce((n, b) => n + b.slots.length, 0);
}

const NO_MODALITIES: ReadonlySet<Modality> = new Set();

export function slot(init: Pick<SlotSpec, 'patterns'> & Partial<SlotSpec>): SlotSpec {
  return {
    fallbackPatterns: [],
    modalities: NO_MODALITIES,
    scoringWeight: 1.0,
    optional: false,
    label: null,
    ...init,
  };
}

const CORE: readonly MovementPattern[] = [
  'antiExtension',
  'rotation',
  'antiLateralFlexion',
  'coreFlexion',
];
const CORE_ALT: readonly MovementPattern[] = [
  'rotation',
  'antiLateralFlexion',
  'antiExtension',
  'coreFlexion',
];
const PUSH: readonly MovementPattern[] = ['horizontalPush', 'verticalPush'];
const PULL: readonly MovementPattern[] = ['horizontalPull', 'verticalPull'];
const CARDIO: readonly MovementPattern[] = ['locomotion', 'plyometric'];
const PLYO_FIRST: readonly MovementPattern[] = ['plyometric', 'locomotion'];
const CONDITIONING_MODALITIES: ReadonlySet<Modality> = new Set<Modality>(['conditioning', 'power']);

const WARM_UP = slot({
  patterns: ['mobility'],
  fallbackPatterns: ['stretch'],
  scoringWeight: 0,
  label: 'Warm-up',
});

const COOL_DOWN = slot({
  patterns: ['stretch'],
  fallbackPatterns: ['mobility'],
  scoringWeight: 0,
  label: 'Cool-down',
});

const STRENGTH_SLOTS: Record<SessionFocus, readonly SlotSpec[]> = {
  fullBody: [
    slot({ patterns: ['squat', 'lunge'], label: 'Knee dominant' }),
    slot({ patterns: PUSH, fallbackPatterns: ['isolation'], label: 'Push' }),
    slot({ patterns: ['hinge', 'lunge'], label: 'Hip dominant' }),
    slot({ patterns: PULL, fallbackPatterns: ['isolation'], label: 'Pull' }),
    slot({ patterns: CORE, label: 'Core' }),
    slot({ patterns: ['carry', 'lunge'], optional: true, label: 'Accessory' }),
    slot({ patterns: ['isolation'], optional: true, scoringWeight: 0.5, label: 'Isolation' }),
  ],
  upperBody: [
    slot({ patterns: ['horizontalPush'], fallbackPatterns: PUSH, label: 'Horizontal push' }),
    slot({ patterns: ['horizontalPull'], fallbackPatterns: PULL, label: 'Horizontal pull' }),
    slot({ patterns: ['verticalPush'], fallbackPatterns: PUSH, label: 'Vertical push' }),
    slot({ patterns: ['verticalPull'], fallbackPatterns: PULL, label: 'Vertical pull' }),
    slot({ patterns: CORE, label: 'Core' }),
    slot({
      patterns: ['isolation'],
      optional: true,
      scoringWeight: 0.5,
      label: 'Arms / shoulders',
    }),
    slot({ patterns: ['carry'], optional: true, label: 'Carry' }),
  ],
  lowerBody: [
    slot({ patterns: ['squat'], label: 'Squat' }),
    slot({ patterns: ['hinge'], label: 'Hinge' }),
    slot({ patterns: ['lunge'], fallbackPatterns: ['squat'], label: 'Single leg' }),
    slot({ patterns: CORE_ALT, label: 'Core' }),
    slot({ patterns: ['hinge', 'squat'], optional: true, label: 'Second lower' }),
    slot({
      patterns: ['isolation'],
      optional: true,
      scoringWeight: 0.5,
      label: 'Calves / glutes',
    }),
    slot({ patterns: ['carry'], optional: true, label: 'Carry' }),
  ],
  conditioning: [
    slot({ patterns: ['squat', 'hinge'], fallbackPatterns: ['lunge'], label: 'Compound' }),
    slot({ patterns: PUSH, fallbackPatterns: PULL, optional: true, label: 'Upper' }),
    slot({ patterns: CORE, optional: true, label: 'Core' }),
  ],
  coreAndMobility: [
    slot({ patterns: ['antiExtension'], fallbackPatterns: CORE, label: 'Anti-extension' }),
    slot({
      patterns: ['antiLateralFlexion'],
      fallbackPatterns: CORE,
      label: 'Anti-lateral flexion',
    }),
    slot({ patterns: ['rotation'], fallbackPatterns: CORE, label: 'Rotation' }),
    slot({ patterns: ['mobility'], scoringWeight: 0.5, label: 'Mobility flow' }),
    slot({ patterns: ['coreFlexion'], optional: true, label: 'Flexion' }),
    slot({ patterns: ['carry'], optional: true, label: 'Carry' }),
  ],
};

/**
 * Turns a focus, goal and time budget into the *shape* of a session.
 *
 * The shape encodes the programming principles the generator enforces:
 *
 * - every session starts with a warm-up and ends with a cool-down;
 * - strength work is organised by movement pattern, with pushing and
 *   pulling always paired so that volume stays balanced;
 * - lower-body sessions include both knee- and hip-dominant work;
 * - each session includes trunk work, favouring anti-movement (bracing)
 *   patterns over repeated spinal flexion;
 * - conditioning scales with the Crate's goal.
 */
export class SessionPlanner {
  plan(focus: SessionFocus, goal: TrainingGoal, durationMinutes: number): SessionPlan {
    const strengthSlots = trimToBudget(STRENGTH_SLOTS[focus], slotBudget(durationMinutes));
    const conditioningSlots = this.conditioningSlots(focus, goal, durationMinutes);
    const warmUpCount = durationMinutes >= 45 ? 3 : 2;
    const coolDownCount = durationMinutes >= 45 ? 3 : 2;

    const blocks: BlockSpec[] = [
      { type: 'warmUp', slots: Array<SlotSpec>(warmUpCount).fill(WARM_UP) },
    ];
    if (strengthSlots.length > 0) blocks.push({ type: 'strength', slots: strengthSlots });
    if (conditioningSlots.length > 0) {
      blocks.push({ type: 'conditioning', slots: conditioningSlots });
    }
    blocks.push({ type: 'coolDown', slots: Array<SlotSpec>(coolDownCount).fill(COOL_DOWN) });
    return { focus, goal, durationMinutes, blocks };
  }

  private conditioningSlots(
    focus: SessionFocus,
    goal: TrainingGoal,
    durationMinutes: number,
  ): SlotSpec[] {
    const count = conditioningCount(focus, goal, durationMinutes);
    const preferPlyo = goal !== 'endurance' && focus !== 'coreAndMobility';
    return Array.from({ length: count }, (_, i) =>
      slot({
        patterns: preferPlyo && i % 2 === 1 ? PLYO_FIRST : CARDIO,
        fallbackPatterns: ['carry'],
        modalities: CONDITIONING_MODALITIES,
        optional: i > 0,
        label: 'Conditioning',
      }),
    );
  }
}

function conditioningCount(
  focus: SessionFocus,
  goal: TrainingGoal,
  durationMinutes: number,
): number {
  if (focus === 'conditioning') return durationMinutes >= 40 ? 4 : 3;
  if (focus === 'coreAndMobility') return 1;
  switch (goal) {
    case 'strength':
      return durationMinutes >= 50 ? 1 : 0;
    case 'hypertrophy':
    case 'generalFitness':
      return 1;
    case 'endurance':
      return 2;
  }
}

/**
 * The number of main-block slots a session of this length can carry.
 * Roughly one compound movement per 7-8 minutes of main work.
 */
function slotBudget(durationMinutes: number): number {
  return clamp(Math.floor((durationMinutes - 10) / 7), 2, 8);
}

/** Keeps required slots first, then as many optional slots as fit. */
function trimToBudget(slots: readonly SlotSpec[], budget: number): SlotSpec[] {
  if (slots.length <= budget) return [...slots];
  const required = slots.filter((s) => !s.optional);
  const optional = slots.filter((s) => s.optional);
  const room = clamp(budget - required.length, 0, optional.length);
  return [...required, ...optional.slice(0, room)];
}
