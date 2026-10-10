import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/providers.dart';
import '../../domain/exercises/exercise.dart';
import '../../domain/exercises/taxonomy.dart';
import '../formatting.dart';
import '../widgets/async_view.dart';

/// Browse the catalog and declare which exercises you can do.
class ExerciseLibraryScreen extends ConsumerStatefulWidget {
  const ExerciseLibraryScreen({super.key});

  @override
  ConsumerState<ExerciseLibraryScreen> createState() =>
      _ExerciseLibraryScreenState();
}

class _ExerciseLibraryScreenState extends ConsumerState<ExerciseLibraryScreen> {
  String _query = '';
  MovementPattern? _pattern;
  bool _onlyMine = false;

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(catalogProvider);
    final mine = ref.watch(myCapabilitiesProvider);
    final able = mine.value ?? const <String>{};

    var exercises = catalog.search(_query);
    if (_pattern != null) {
      exercises = exercises.where((e) => e.pattern == _pattern);
    }
    if (_onlyMine) exercises = exercises.where((e) => able.contains(e.id));
    final list = exercises.toList()..sort((a, b) => a.name.compareTo(b.name));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Exercises'),
        actions: [
          IconButton(
            tooltip: 'Quick setup',
            icon: const Icon(Icons.auto_fix_high_outlined),
            onPressed: () => showDialog<void>(
              context: context,
              builder: (_) => const QuickSetupDialog(),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(112),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: SearchBar(
                  hintText: 'Search ${catalog.length} exercises',
                  leading: const Icon(Icons.search),
                  onChanged: (q) => setState(() => _query = q),
                ),
              ),
              SizedBox(
                height: 48,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: [
                    FilterChip(
                      label: const Text('I can do'),
                      selected: _onlyMine,
                      onSelected: (v) => setState(() => _onlyMine = v),
                    ),
                    const SizedBox(width: 8),
                    for (final p in MovementPattern.values) ...[
                      FilterChip(
                        label: Text(Fmt.pattern(p)),
                        selected: _pattern == p,
                        onSelected: (v) =>
                            setState(() => _pattern = v ? p : null),
                      ),
                      const SizedBox(width: 8),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: AsyncView(
        value: mine,
        data: (_) => list.isEmpty
            ? const EmptyState(
                icon: Icons.search_off,
                title: 'No exercises match',
              )
            : ListView.builder(
                itemCount: list.length,
                itemBuilder: (context, i) => _ExerciseTile(
                  exercise: list[i],
                  able: able.contains(list[i].id),
                ),
              ),
      ),
    );
  }
}

class _ExerciseTile extends ConsumerWidget {
  const _ExerciseTile({required this.exercise, required this.able});

  final Exercise exercise;
  final bool able;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final equipment = exercise.equipment.map(Fmt.equipment).join(', ');
    return SwitchListTile(
      title: Text(exercise.name),
      subtitle: Text(
        [
          Fmt.pattern(exercise.pattern),
          'Level ${exercise.difficulty}',
          if (equipment.isNotEmpty) equipment else 'Bodyweight',
        ].join(' · '),
      ),
      value: able,
      onChanged: (v) async {
        final me = ref.read(currentPeachIdProvider);
        if (me == null) return;
        await ref
            .read(appContainerProvider)
            .capabilityService
            .setAble(
              peachId: me,
              exerciseId: exercise.id,
              able: v,
              now: ref.read(clockProvider)().toUtc(),
            );
      },
    );
  }
}

/// Marks every exercise you can do with the equipment you own.
class QuickSetupDialog extends ConsumerStatefulWidget {
  const QuickSetupDialog({super.key});

  @override
  ConsumerState<QuickSetupDialog> createState() => _QuickSetupDialogState();
}

class _QuickSetupDialogState extends ConsumerState<QuickSetupDialog> {
  final _equipment = <Equipment>{Equipment.wall, Equipment.chair};
  int _maxDifficulty = 2;

  static const _choices = [
    Equipment.dumbbell,
    Equipment.kettlebell,
    Equipment.barbell,
    Equipment.bench,
    Equipment.resistanceBand,
    Equipment.pullUpBar,
    Equipment.box,
    Equipment.jumpRope,
    Equipment.suspensionTrainer,
    Equipment.medicineBall,
    Equipment.treadmill,
    Equipment.stationaryBike,
    Equipment.rowingMachine,
    Equipment.cableMachine,
    Equipment.weightMachine,
  ];

  Future<void> _apply() async {
    final me = ref.read(currentPeachIdProvider);
    if (me == null) return;
    final count = await ref
        .read(appContainerProvider)
        .capabilityService
        .enableForEquipment(
          peachId: me,
          equipment: _equipment,
          maxDifficulty: _maxDifficulty,
          now: ref.read(clockProvider)().toUtc(),
        );
    if (!mounted) return;
    Navigator.pop(context);
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text('Enabled $count exercises')));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Quick setup'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Bodyweight exercises are always included. '
              'Pick the equipment you have access to.',
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final e in _choices)
                  FilterChip(
                    label: Text(Fmt.equipment(e)),
                    selected: _equipment.contains(e),
                    onSelected: (on) => setState(() {
                      if (on) {
                        _equipment.add(e);
                      } else {
                        _equipment.remove(e);
                      }
                    }),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Text('Up to difficulty level $_maxDifficulty'),
            Slider(
              value: _maxDifficulty.toDouble(),
              min: 1,
              max: 5,
              divisions: 4,
              label: '$_maxDifficulty',
              onChanged: (v) => setState(() => _maxDifficulty = v.round()),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(onPressed: _apply, child: const Text('Enable')),
      ],
    );
  }
}
