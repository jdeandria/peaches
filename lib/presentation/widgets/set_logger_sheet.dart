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

  /// Increment per tap: a rep, five seconds, or ten metres.
  int get _step => switch (_p.unit) {
    MeasurementType.duration => 5,
    MeasurementType.distance => 10,
    _ => 1,
  };

  void _nudge(int set, int delta) {
    final current = int.tryParse(_values[set].text.trim()) ?? 0;
    final next = (current + delta).clamp(0, 9999);
    setState(() => _values[set].text = '$next');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final unit = switch (_p.unit) {
      MeasurementType.duration => 'sec',
      MeasurementType.distance => 'm',
      _ => 'reps',
    };
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.exercise.name, style: theme.textTheme.headlineSmall),
            const SizedBox(height: 4),
            Text(
              Fmt.prescription(_p),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 20),
            for (var i = 0; i < _setCount; i++)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _p.perSide
                            ? 'Set ${i ~/ 2 + 1} · ${i.isEven ? 'Left' : 'Right'}'
                            : 'Set ${i + 1}',
                        style: theme.textTheme.titleSmall,
                      ),
                    ),
                    if (_loaded) ...[
                      SizedBox(
                        width: 72,
                        child: TextField(
                          controller: _loads[i],
                          textAlign: TextAlign.center,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: InputDecoration(
                            hintText: 'kg',
                            suffixText: 'kg',
                            isDense: true,
                            filled: true,
                            fillColor: scheme.surfaceContainerHigh,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                    IconButton.outlined(
                      tooltip: 'Fewer',
                      onPressed: () => _nudge(i, -_step),
                      icon: const Icon(Icons.remove),
                    ),
                    SizedBox(
                      width: 72,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          TextField(
                            controller: _values[i],
                            textAlign: TextAlign.center,
                            keyboardType: TextInputType.number,
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                            decoration: const InputDecoration(
                              border: InputBorder.none,
                              isDense: true,
                              hintText: '0',
                              contentPadding: EdgeInsets.zero,
                            ),
                          ),
                          Text(
                            unit,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton.filledTonal(
                      tooltip: 'More',
                      onPressed: () => _nudge(i, _step),
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 16),
            Text('How hard was it? (RPE)', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            SegmentedButton<int>(
              showSelectedIcon: false,
              emptySelectionAllowed: true,
              segments: [
                for (var r = 5; r <= 10; r++)
                  ButtonSegment(value: r, label: Text('$r')),
              ],
              selected: {?_rpe},
              onSelectionChanged: (v) =>
                  setState(() => _rpe = v.isEmpty ? null : v.first),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: _fillPrescribed,
                  icon: const Icon(Icons.restart_alt, size: 18),
                  label: const Text('As prescribed'),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: _save,
                    child: const Text('Save'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
