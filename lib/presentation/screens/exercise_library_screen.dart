import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/providers.dart';
import '../../domain/exercises/exercise.dart';
import '../../domain/exercises/taxonomy.dart';
import '../formatting.dart';
import '../widgets/adaptive.dart';
import '../widgets/async_view.dart';
import '../widgets/motion.dart';
import '../widgets/tonal_card.dart';

/// Browse the catalog, grouped by movement pattern, and declare which
/// exercises you can do.
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

  /// Groups the user has collapsed. Everything starts expanded, and an
  /// active search always expands its matches.
  final _collapsed = <MovementPattern>{};

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(catalogProvider);
    final mine = ref.watch(myCapabilitiesProvider);
    final able = mine.value ?? const <String>{};
    final searching = _query.trim().isNotEmpty;

    var exercises = catalog.search(_query);
    if (_pattern != null) {
      exercises = exercises.where((e) => e.pattern == _pattern);
    }
    if (_onlyMine) exercises = exercises.where((e) => able.contains(e.id));

    final groups = <MovementPattern, List<Exercise>>{};
    for (final e in exercises) {
      groups.putIfAbsent(e.pattern, () => []).add(e);
    }
    final orderedPatterns = MovementPattern.values
        .where(groups.containsKey)
        .toList();
    for (final list in groups.values) {
      list.sort((a, b) => a.name.compareTo(b.name));
    }
    final ableCount = exercises.where((e) => able.contains(e.id)).length;

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
          child: PageBody(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: SearchBar(
                    hintText: 'Search ${catalog.length} exercises',
                    leading: const Icon(Icons.search),
                    elevation: const WidgetStatePropertyAll(0),
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
      ),
      body: AsyncView(
        value: mine,
        data: (_) => orderedPatterns.isEmpty
            ? const EmptyState(
                icon: Icons.search_off,
                title: 'No exercises match',
              )
            : PageBody(
                child: ListView.builder(
                  padding: const EdgeInsets.only(bottom: 24),
                  itemCount: orderedPatterns.length + 1,
                  itemBuilder: (context, i) {
                    if (i == 0) {
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                        child: Text(
                          '$ableCount of ${exercises.length} enabled',
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                              ),
                        ),
                      );
                    }
                    final pattern = orderedPatterns[i - 1];
                    final items = groups[pattern]!;
                    final expanded = searching || !_collapsed.contains(pattern);
                    return StaggeredEntrance(
                      index: i - 1,
                      child: _PatternGroup(
                        pattern: pattern,
                        exercises: items,
                        ableCount: items
                            .where((e) => able.contains(e.id))
                            .length,
                        able: able,
                        expanded: expanded,
                        onToggle: () => setState(() {
                          if (!_collapsed.remove(pattern)) {
                            _collapsed.add(pattern);
                          }
                        }),
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }
}

/// A collapsible card for one movement pattern.
class _PatternGroup extends StatelessWidget {
  const _PatternGroup({
    required this.pattern,
    required this.exercises,
    required this.ableCount,
    required this.able,
    required this.expanded,
    required this.onToggle,
  });

  final MovementPattern pattern;
  final List<Exercise> exercises;
  final int ableCount;
  final Set<String> able;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return TonalCard(
      variant: TonalCardVariant.filled,
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          InkWell(
            onTap: onToggle,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      Fmt.pattern(pattern),
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  Text(
                    '$ableCount / ${exercises.length}',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  AnimatedRotation(
                    turns: expanded ? 0.5 : 0,
                    duration: Motion.short,
                    curve: Motion.standard,
                    child: Icon(
                      Icons.expand_more,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: Motion.medium,
            curve: Motion.standard,
            alignment: Alignment.topCenter,
            child: expanded
                ? Column(
                    children: [
                      const Divider(indent: 16, endIndent: 16),
                      for (final e in exercises)
                        _ExerciseTile(exercise: e, able: able.contains(e.id)),
                      const SizedBox(height: 4),
                    ],
                  )
                : const SizedBox(width: double.infinity),
          ),
        ],
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
