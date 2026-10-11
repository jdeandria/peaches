import 'package:flutter/material.dart';

import '../../domain/core/units.dart';
import '../../domain/exercises/exercise.dart';
import '../../domain/exercises/taxonomy.dart';
import '../../domain/models/training.dart';
import '../../domain/models/workout.dart';
import '../../domain/models/workout_log.dart';
import '../expressive/button_group.dart';
import '../formatting.dart';

/// Opens a bottom sheet to record every set of one workout item and
/// returns the resulting entry, or null if dismissed.
///
/// For exercises that take a load, each set also records the weight, in
/// [units], starting from [previousLoadsKg] (what was lifted last time).
Future<ExerciseLogEntry?> showSetLoggerSheet(
  BuildContext context, {
  required Exercise exercise,
  required WorkoutItem item,
  ExerciseLogEntry? existing,
  UnitSystem units = UnitSystem.metric,
  List<double>? previousLoadsKg,
}) {
  return showModalBottomSheet<ExerciseLogEntry>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => SetLoggerSheet(
      exercise: exercise,
      item: item,
      existing: existing,
      units: units,
      previousLoadsKg: previousLoadsKg,
    ),
  );
}

class SetLoggerSheet extends StatefulWidget {
  const SetLoggerSheet({
    required this.exercise,
    required this.item,
    super.key,
    this.existing,
    this.units = UnitSystem.metric,
    this.previousLoadsKg,
  });

  final Exercise exercise;
  final WorkoutItem item;
  final ExerciseLogEntry? existing;
  final UnitSystem units;
  final List<double>? previousLoadsKg;

  @override
  State<SetLoggerSheet> createState() => _SetLoggerSheetState();
}

class _SetLoggerSheetState extends State<SetLoggerSheet> {
  late final List<TextEditingController> _values;

  /// Weights in display units; empty for exercises without a load.
  late final List<TextEditingController> _loads;

  /// Last committed weight text per set, to carry edits forward.
  late final List<String> _committedLoads;
  int? _rpe;

  Prescription get _p => widget.item.prescription;
  int get _setCount => _p.sets * (_p.perSide ? 2 : 1);
  bool get _weighted => widget.exercise.takesLoad;
  String get _weightUnit => WeightUnits.label(widget.units);

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    final previous = widget.previousLoadsKg;
    _rpe = existing?.rpe;

    SetLog? setAt(int i) =>
        existing != null && i < existing.sets.length ? existing.sets[i] : null;

    _values = List.generate(_setCount, (i) {
      final set = setAt(i);
      // Pre-fill with the prescription so a set done as written is one
      // tap; only an existing entry overrides it.
      final value = set?.reps ?? set?.seconds ?? set?.meters ?? _p.targetPerSet;
      return TextEditingController(text: '$value');
    });

    _loads = List.generate(_setCount, (i) {
      if (!_weighted) return TextEditingController();
      // This session's entry first, then last time's weight for the same
      // set (or its last set), else blank.
      final kg =
          setAt(i)?.loadKg ??
          (previous == null || previous.isEmpty
              ? null
              : previous[i < previous.length ? i : previous.length - 1]);
      return TextEditingController(
        text: kg == null
            ? ''
            : WeightUnits.format(WeightUnits.toDisplay(kg, widget.units)),
      );
    });
    _committedLoads = [for (final c in _loads) c.text];
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
      c.text = '${_p.targetPerSet}';
    }
    setState(() {});
  }

  /// Increment per tap: a rep, five seconds, or ten metres.
  int get _step => switch (_p.unit) {
    MeasurementType.duration => 5,
    MeasurementType.distance => 10,
    _ => 1,
  };

  void _nudgeValue(int set, int delta) {
    final current = int.tryParse(_values[set].text.trim()) ?? 0;
    setState(() => _values[set].text = '${(current + delta).clamp(0, 9999)}');
  }

  void _nudgeLoad(int set, double delta) {
    final current = double.tryParse(_loads[set].text.trim()) ?? 0;
    final next = (current + delta).clamp(0, 9999).toDouble();
    _commitLoad(set, WeightUnits.format(next));
  }

  /// Sets the weight for [set] and carries it to later sets that still
  /// held the old weight, so changing the working weight is one edit.
  void _commitLoad(int set, String text) {
    final old = _committedLoads[set];
    setState(() {
      for (var j = set; j < _setCount; j++) {
        if (j == set || _committedLoads[j] == old) {
          _loads[j].text = text;
          _committedLoads[j] = text;
        }
      }
    });
  }

  void _save() {
    final sets = <SetLog>[];
    for (var i = 0; i < _setCount; i++) {
      final value = int.tryParse(_values[i].text.trim());
      if (value == null) continue;
      final shown = double.tryParse(_loads[i].text.trim());
      sets.add(
        SetLog(
          reps: _p.reps != null ? value : null,
          seconds: _p.seconds != null ? value : null,
          meters: _p.meters != null ? value : null,
          loadKg: _weighted && shown != null && shown > 0
              ? WeightUnits.toKg(shown, widget.units)
              : null,
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

  String _setLabel(int i) => _p.perSide
      ? 'Set ${i ~/ 2 + 1} · ${i.isEven ? 'Left' : 'Right'}'
      : 'Set ${i + 1}';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final unit = switch (_p.unit) {
      MeasurementType.duration => 'sec',
      MeasurementType.distance => 'm',
      _ => 'reps',
    };
    final previous = widget.previousLoadsKg;

    Widget valueStepper(int i) => _Stepper(
      controller: _values[i],
      unit: unit,
      lessTooltip: 'Fewer $unit',
      moreTooltip: 'More $unit',
      onLess: () => _nudgeValue(i, -_step),
      onMore: () => _nudgeValue(i, _step),
    );

    Widget loadStepper(int i) => _Stepper(
      controller: _loads[i],
      unit: _weightUnit,
      decimal: true,
      hint: '–',
      lessTooltip: 'Lighter',
      moreTooltip: 'Heavier',
      onLess: () => _nudgeLoad(i, -WeightUnits.step(widget.units)),
      onMore: () => _nudgeLoad(i, WeightUnits.step(widget.units)),
      onSubmitted: (text) => _commitLoad(i, text.trim()),
    );

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
            if (_weighted && previous != null && previous.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.history, size: 16, color: scheme.primary),
                  const SizedBox(width: 6),
                  Text(
                    'Last time: ${previous.map((kg) => WeightUnits.format(WeightUnits.toDisplay(kg, widget.units))).join(' · ')} $_weightUnit',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: scheme.primary,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 20),
            for (var i = 0; i < _setCount; i++)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: EdgeInsets.fromLTRB(16, _weighted ? 12 : 8, 8, 8),
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: _weighted
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_setLabel(i), style: theme.textTheme.titleSmall),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Expanded(child: valueStepper(i)),
                              SizedBox(
                                height: 36,
                                child: VerticalDivider(
                                  width: 17,
                                  color: scheme.outlineVariant,
                                ),
                              ),
                              Expanded(child: loadStepper(i)),
                            ],
                          ),
                        ],
                      )
                    : Row(
                        children: [
                          Expanded(
                            child: Text(
                              _setLabel(i),
                              style: theme.textTheme.titleSmall,
                            ),
                          ),
                          SizedBox(width: 168, child: valueStepper(i)),
                        ],
                      ),
              ),
            const SizedBox(height: 16),
            Text('How hard was it? (RPE)', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            ConnectedButtonGroup<int>(
              options: [for (var r = 5; r <= 10; r++) (r, '$r')],
              selected: _rpe,
              allowDeselect: true,
              onChanged: (v) => setState(() => _rpe = v),
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

/// − value + with the unit under the number.
class _Stepper extends StatelessWidget {
  const _Stepper({
    required this.controller,
    required this.unit,
    required this.onLess,
    required this.onMore,
    required this.lessTooltip,
    required this.moreTooltip,
    this.decimal = false,
    this.hint = '0',
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String unit;
  final VoidCallback onLess;
  final VoidCallback onMore;
  final String lessTooltip;
  final String moreTooltip;
  final bool decimal;
  final String hint;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Row(
      children: [
        IconButton.outlined(
          tooltip: lessTooltip,
          onPressed: onLess,
          icon: const Icon(Icons.remove),
        ),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Focus(
                // Commit typed weights when focus leaves the field too.
                onFocusChange: (has) {
                  if (!has) onSubmitted?.call(controller.text);
                },
                child: TextField(
                  controller: controller,
                  textAlign: TextAlign.center,
                  keyboardType: TextInputType.numberWithOptions(
                    decimal: decimal,
                  ),
                  onSubmitted: onSubmitted,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    hintText: hint,
                    contentPadding: EdgeInsets.zero,
                  ),
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
          tooltip: moreTooltip,
          onPressed: onMore,
          icon: const Icon(Icons.add),
        ),
      ],
    );
  }
}
