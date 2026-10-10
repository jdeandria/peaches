import 'package:equatable/equatable.dart';

import '../exercises/taxonomy.dart';
import '../models/training.dart';
import '../models/workout.dart';

/// A position in a session to be filled by one exercise.
///
/// [patterns] are tried in order of preference; [fallbackPatterns] are used
/// only when nothing in [patterns] is available. [modalities] further
/// restricts candidates (for example only conditioning work in the
/// conditioning block).
final class SlotSpec extends Equatable {
  const SlotSpec({
    required this.patterns,
    this.fallbackPatterns = const [],
    this.modalities = const {},
    this.scoringWeight = 1.0,
    this.optional = false,
    this.label,
  });

  final List<MovementPattern> patterns;
  final List<MovementPattern> fallbackPatterns;
  final Set<Modality> modalities;
  final double scoringWeight;

  /// Optional slots are dropped first when the session runs over time.
  final bool optional;
  final String? label;

  @override
  List<Object?> get props => [
    patterns,
    fallbackPatterns,
    modalities,
    scoringWeight,
    optional,
    label,
  ];
}

final class BlockSpec extends Equatable {
  const BlockSpec({required this.type, required this.slots});

  final BlockType type;
  final List<SlotSpec> slots;

  @override
  List<Object?> get props => [type, slots];
}

final class SessionPlan extends Equatable {
  const SessionPlan({
    required this.focus,
    required this.goal,
    required this.durationMinutes,
    required this.blocks,
  });

  final SessionFocus focus;
  final TrainingGoal goal;
  final int durationMinutes;
  final List<BlockSpec> blocks;

  int get slotCount => blocks.fold(0, (n, b) => n + b.slots.length);

  @override
  List<Object?> get props => [focus, goal, durationMinutes, blocks];
}

/// Turns a focus, goal and time budget into the *shape* of a session.
///
/// The shape encodes the programming principles the generator enforces:
///
/// * every session starts with a warm-up and ends with a cool-down;
/// * strength work is organised by movement pattern, with pushing and
///   pulling always paired so that volume stays balanced;
/// * lower-body sessions include both knee- and hip-dominant work;
/// * each session includes trunk work, favouring anti-movement (bracing)
///   patterns over repeated spinal flexion;
/// * conditioning scales with the Crate's goal.
final class SessionPlanner {
  const SessionPlanner();

  static const _core = [
    MovementPattern.antiExtension,
    MovementPattern.rotation,
    MovementPattern.antiLateralFlexion,
    MovementPattern.coreFlexion,
  ];
  static const _coreAlt = [
    MovementPattern.rotation,
    MovementPattern.antiLateralFlexion,
    MovementPattern.antiExtension,
    MovementPattern.coreFlexion,
  ];
  static const _push = [
    MovementPattern.horizontalPush,
    MovementPattern.verticalPush,
  ];
  static const _pull = [
    MovementPattern.horizontalPull,
    MovementPattern.verticalPull,
  ];
  static const _cardio = [
    MovementPattern.locomotion,
    MovementPattern.plyometric,
  ];
  static const _plyoFirst = [
    MovementPattern.plyometric,
    MovementPattern.locomotion,
  ];

  SessionPlan plan({
    required SessionFocus focus,
    required TrainingGoal goal,
    required int durationMinutes,
  }) {
    final strengthSlots = _strengthSlots(focus, goal, durationMinutes);
    final conditioningSlots = _conditioningSlots(focus, goal, durationMinutes);
    final warmUpCount = durationMinutes >= 45 ? 3 : 2;
    final coolDownCount = durationMinutes >= 45 ? 3 : 2;

    return SessionPlan(
      focus: focus,
      goal: goal,
      durationMinutes: durationMinutes,
      blocks: [
        BlockSpec(
          type: BlockType.warmUp,
          slots: List.filled(
            warmUpCount,
            const SlotSpec(
              patterns: [MovementPattern.mobility],
              fallbackPatterns: [MovementPattern.stretch],
              scoringWeight: 0,
              label: 'Warm-up',
            ),
          ),
        ),
        if (strengthSlots.isNotEmpty)
          BlockSpec(type: BlockType.strength, slots: strengthSlots),
        if (conditioningSlots.isNotEmpty)
          BlockSpec(type: BlockType.conditioning, slots: conditioningSlots),
        BlockSpec(
          type: BlockType.coolDown,
          slots: List.filled(
            coolDownCount,
            const SlotSpec(
              patterns: [MovementPattern.stretch],
              fallbackPatterns: [MovementPattern.mobility],
              scoringWeight: 0,
              label: 'Cool-down',
            ),
          ),
        ),
      ],
    );
  }

  /// The number of main-block slots a session of this length can carry.
  /// Roughly one compound movement per 7-8 minutes of main work.
  int _slotBudget(int durationMinutes) =>
      ((durationMinutes - 10) / 7).floor().clamp(2, 8);

  List<SlotSpec> _strengthSlots(
    SessionFocus focus,
    TrainingGoal goal,
    int durationMinutes,
  ) {
    final budget = _slotBudget(durationMinutes);
    final slots = switch (focus) {
      SessionFocus.fullBody => <SlotSpec>[
        const SlotSpec(
          patterns: [MovementPattern.squat, MovementPattern.lunge],
          label: 'Knee dominant',
        ),
        const SlotSpec(
          patterns: _push,
          fallbackPatterns: [MovementPattern.isolation],
          label: 'Push',
        ),
        const SlotSpec(
          patterns: [MovementPattern.hinge, MovementPattern.lunge],
          label: 'Hip dominant',
        ),
        const SlotSpec(
          patterns: _pull,
          fallbackPatterns: [MovementPattern.isolation],
          label: 'Pull',
        ),
        const SlotSpec(patterns: _core, label: 'Core'),
        const SlotSpec(
          patterns: [MovementPattern.carry, MovementPattern.lunge],
          optional: true,
          label: 'Accessory',
        ),
        const SlotSpec(
          patterns: [MovementPattern.isolation],
          optional: true,
          scoringWeight: 0.5,
          label: 'Isolation',
        ),
      ],
      SessionFocus.upperBody => <SlotSpec>[
        const SlotSpec(
          patterns: [MovementPattern.horizontalPush],
          fallbackPatterns: _push,
          label: 'Horizontal push',
        ),
        const SlotSpec(
          patterns: [MovementPattern.horizontalPull],
          fallbackPatterns: _pull,
          label: 'Horizontal pull',
        ),
        const SlotSpec(
          patterns: [MovementPattern.verticalPush],
          fallbackPatterns: _push,
          label: 'Vertical push',
        ),
        const SlotSpec(
          patterns: [MovementPattern.verticalPull],
          fallbackPatterns: _pull,
          label: 'Vertical pull',
        ),
        const SlotSpec(patterns: _core, label: 'Core'),
        const SlotSpec(
          patterns: [MovementPattern.isolation],
          optional: true,
          scoringWeight: 0.5,
          label: 'Arms / shoulders',
        ),
        const SlotSpec(
          patterns: [MovementPattern.carry],
          optional: true,
          label: 'Carry',
        ),
      ],
      SessionFocus.lowerBody => <SlotSpec>[
        const SlotSpec(patterns: [MovementPattern.squat], label: 'Squat'),
        const SlotSpec(patterns: [MovementPattern.hinge], label: 'Hinge'),
        const SlotSpec(
          patterns: [MovementPattern.lunge],
          fallbackPatterns: [MovementPattern.squat],
          label: 'Single leg',
        ),
        const SlotSpec(patterns: _coreAlt, label: 'Core'),
        const SlotSpec(
          patterns: [MovementPattern.hinge, MovementPattern.squat],
          optional: true,
          label: 'Second lower',
        ),
        const SlotSpec(
          patterns: [MovementPattern.isolation],
          optional: true,
          scoringWeight: 0.5,
          label: 'Calves / glutes',
        ),
        const SlotSpec(
          patterns: [MovementPattern.carry],
          optional: true,
          label: 'Carry',
        ),
      ],
      SessionFocus.conditioning => <SlotSpec>[
        const SlotSpec(
          patterns: [MovementPattern.squat, MovementPattern.hinge],
          fallbackPatterns: [MovementPattern.lunge],
          label: 'Compound',
        ),
        const SlotSpec(
          patterns: _push,
          fallbackPatterns: _pull,
          optional: true,
          label: 'Upper',
        ),
        const SlotSpec(patterns: _core, optional: true, label: 'Core'),
      ],
      SessionFocus.coreAndMobility => <SlotSpec>[
        const SlotSpec(
          patterns: [MovementPattern.antiExtension],
          fallbackPatterns: _core,
          label: 'Anti-extension',
        ),
        const SlotSpec(
          patterns: [MovementPattern.antiLateralFlexion],
          fallbackPatterns: _core,
          label: 'Anti-lateral flexion',
        ),
        const SlotSpec(
          patterns: [MovementPattern.rotation],
          fallbackPatterns: _core,
          label: 'Rotation',
        ),
        const SlotSpec(
          patterns: [MovementPattern.mobility],
          scoringWeight: 0.5,
          label: 'Mobility flow',
        ),
        const SlotSpec(
          patterns: [MovementPattern.coreFlexion],
          optional: true,
          label: 'Flexion',
        ),
        const SlotSpec(
          patterns: [MovementPattern.carry],
          optional: true,
          label: 'Carry',
        ),
      ],
    };
    return _trimToBudget(slots, budget);
  }

  List<SlotSpec> _conditioningSlots(
    SessionFocus focus,
    TrainingGoal goal,
    int durationMinutes,
  ) {
    final count = switch (focus) {
      SessionFocus.conditioning => durationMinutes >= 40 ? 4 : 3,
      SessionFocus.coreAndMobility => 1,
      _ => switch (goal) {
        TrainingGoal.strength => durationMinutes >= 50 ? 1 : 0,
        TrainingGoal.hypertrophy => 1,
        TrainingGoal.endurance => 2,
        TrainingGoal.generalFitness => 1,
      },
    };
    if (count == 0) return const [];
    final preferPlyo =
        goal != TrainingGoal.endurance && focus != SessionFocus.coreAndMobility;
    return List.generate(
      count,
      (i) => SlotSpec(
        patterns: (preferPlyo && i.isOdd) ? _plyoFirst : _cardio,
        fallbackPatterns: const [MovementPattern.carry],
        modalities: const {Modality.conditioning, Modality.power},
        optional: i > 0,
        label: 'Conditioning',
      ),
    );
  }

  /// Keeps required slots first, then as many optional slots as fit.
  static List<SlotSpec> _trimToBudget(List<SlotSpec> slots, int budget) {
    if (slots.length <= budget) return slots;
    final required = slots.where((s) => !s.optional).toList();
    final optional = slots.where((s) => s.optional).toList();
    final room = (budget - required.length).clamp(0, optional.length);
    return [...required, ...optional.take(room)];
  }
}
