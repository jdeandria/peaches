import 'package:flutter/material.dart';

import '../../domain/exercises/exercise.dart';
import '../../domain/exercises/taxonomy.dart';
import '../../domain/models/workout.dart';
import '../../domain/models/workout_log.dart';
import '../formatting.dart';

/// Opens a bottom sheet to record every set of one workout item and
/// returns the resulting entry, or null if dismissed.
Future<ExerciseLogEntry?> showSetLoggerSheet(
  BuildContext context, {
  required Exercise exercise,
  required WorkoutItem item,
  ExerciseLogEntry? existing,
}) {
  return showModalBottomSheet<ExerciseLogEntry>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) =>
        SetLoggerSheet(exercise: exercise, item: item, existing: existing),
  );
}

class SetLoggerSheet extends StatefulWidget {
  const SetLoggerSheet({
    required this.exercise,
    required this.item,
    super.key,
    this.existing,
  });

  final Exercise exercise;
  final WorkoutItem item;
  final ExerciseLogEntry? existing;

  @override
  State<SetLoggerSheet> createState() => _SetLoggerSheetState();
}

class _SetLoggerSheetState extends State<SetLoggerSheet> {
  late final List<TextEditingController> _values;
  late final List<TextEditingController> _loads;
  int? _rpe;

  Prescription get _p => widget.item.prescription;
  int get _setCount => _p.sets * (_p.perSide ? 2 : 1);
  bool get _loaded => widget.exercise.measurement == MeasurementType.loadedReps;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _rpe = existing?.rpe;
    _values = List.generate(_setCount, (i) {
      final set = existing != null && i < existing.sets.length
          ? existing.sets[i]
          : null;
      // Pre-fill with the prescription so a set done as written is one
      // tap; only an existing entry overrides it.
      final value = set?.reps ?? set?.seconds ?? set?.meters ?? _p.targetPerSet;
      return TextEditingController(text: value.toString());
    });
    _loads = List.generate(_setCount, (i) {
      final set = existing != null && i < existing.sets.length
          ? existing.sets[i]
          : null;
      return TextEditingController(text: set?.loadKg?.toString() ?? '');
    });
  }

  @override
  void dispose() {
    for (final c in [..._values, ..._loads]) {
      c.dispose();
    }
    super.dispose();
  }

  void _fillPrescribed() {
    for (final c in _values) {
      c.text = _p.targetPerSet.toString();
    }
    setState(() {});
  }

  void _save() {
    final sets = <SetLog>[];
    for (var i = 0; i < _setCount; i++) {
      final value = int.tryParse(_values[i].text.trim());
      if (value == null) continue;
      final load = double.tryParse(_loads[i].text.trim());
      sets.add(
        SetLog(
          reps: _p.reps != null ? value : null,
          seconds: _p.seconds != null ? value : null,
          meters: _p.meters != null ? value : null,
          loadKg: _loaded ? load : null,
        ),
      );
    }
    Navigator.pop(
      context,
      ExerciseLogEntry(
        exerciseId: widget.exercise.id,
        workoutItemId: widget.item.id,
        sets: sets,
        rpe: _rpe,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final unit = switch (_p.unit) {
      MeasurementType.duration => 'seconds',
      MeasurementType.distance => 'metres',
      _ => 'reps',
    };
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.exercise.name, style: theme.textTheme.titleLarge),
            Text(
              Fmt.prescription(_p),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 12),
            for (var i = 0; i < _setCount; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    SizedBox(
                      width: 72,
                      child: Text(
                        _p.perSide
                            ? 'Set ${i ~/ 2 + 1} ${i.isEven ? 'L' : 'R'}'
                            : 'Set ${i + 1}',
                      ),
                    ),
                    Expanded(
                      child: TextField(
                        controller: _values[i],
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: unit,
                          isDense: true,
                        ),
                      ),
                    ),
                    if (_loaded) ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _loads[i],
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: const InputDecoration(
                            labelText: 'kg',
                            isDense: true,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: 8),
            Text('Effort (RPE)', style: theme.textTheme.labelLarge),
            const SizedBox(height: 4),
            Wrap(
              spacing: 6,
              children: [
                for (var r = 5; r <= 10; r++)
                  ChoiceChip(
                    label: Text('$r'),
                    selected: _rpe == r,
                    onSelected: (_) => setState(() => _rpe = r),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                TextButton.icon(
                  onPressed: _fillPrescribed,
                  icon: const Icon(Icons.restart_alt, size: 18),
                  label: const Text('As prescribed'),
                ),
                const Spacer(),
                FilledButton(onPressed: _save, child: const Text('Save')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
