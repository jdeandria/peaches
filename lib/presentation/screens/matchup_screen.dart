import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/providers.dart';
import '../../domain/core/local_date.dart';
import '../../domain/exercises/exercise.dart';
import '../../domain/models/score.dart';
import '../../domain/models/season.dart';
import '../../domain/models/workout.dart';
import '../../domain/models/workout_log.dart';
import '../formatting.dart';
import '../widgets/async_view.dart';
import '../widgets/set_logger_sheet.dart';

/// The generated workout for a matchup, with per-exercise logging and a
/// live score. The same workout is shown to both Peaches.
class MatchupScreen extends ConsumerWidget {
  const MatchupScreen({required this.matchupId, super.key});

  final String matchupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matchup = ref.watch(matchupProvider(matchupId));
    return AsyncView(
      value: matchup,
      data: (m) {
        if (m == null || m.workoutId == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Matchup')),
            body: const EmptyState(
              icon: Icons.hourglass_empty,
              title: 'Not open yet',
              message: 'The workout appears once the round opens.',
            ),
          );
        }
        final workout = ref.watch(workoutProvider(m.workoutId!));
        return AsyncView(
          value: workout,
          data: (w) => w == null
              ? Scaffold(
                  appBar: AppBar(),
                  body: const EmptyState(
                    icon: Icons.error_outline,
                    title: 'Workout missing',
                  ),
                )
              : _MatchupBody(matchup: m, workout: w),
        );
      },
    );
  }
}

class _MatchupBody extends ConsumerStatefulWidget {
  const _MatchupBody({required this.matchup, required this.workout});

  final Matchup matchup;
  final Workout workout;

  @override
  ConsumerState<_MatchupBody> createState() => _MatchupBodyState();
}

class _MatchupBodyState extends ConsumerState<_MatchupBody> {
  String? _logId;

  Future<WorkoutLog> _ensureLog() async {
    final app = ref.read(appContainerProvider);
    final me = ref.read(currentPeachIdProvider)!;
    final log = await app.loggingService.logForMatchup(
      matchup: widget.matchup,
      peachId: me,
      now: ref.read(clockProvider)().toUtc(),
    );
    if (mounted && _logId != log.id) setState(() => _logId = log.id);
    return log;
  }

  Future<void> _logItem(
    WorkoutItem item,
    Exercise exercise,
    WorkoutLog? current,
  ) async {
    final existing = current?.entryForItem(item.id);
    final entry = await showSetLoggerSheet(
      context,
      exercise: exercise,
      item: item,
      existing: existing,
    );
    if (entry == null) return;
    try {
      final log = await _ensureLog();
      await ref
          .read(appContainerProvider)
          .loggingService
          .recordEntry(logId: log.id, entry: entry);
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _submit() async {
    try {
      final log = await _ensureLog();
      await ref
          .read(appContainerProvider)
          .loggingService
          .submit(logId: log.id, now: ref.read(clockProvider)().toUtc());
      ref.read(dataRevisionProvider.notifier).bump();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Workout submitted. Nice work.')),
        );
      }
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(currentPeachIdProvider);
    final catalog = ref.watch(catalogProvider);
    final matchup = widget.matchup;
    final workout = widget.workout;
    final isMine = me != null && matchup.involves(me);

    // Resolve my log lazily: look it up once, then stream it.
    final existingLogs = ref.watch(myLogsProvider);
    final logId =
        _logId ??
        existingLogs.value
            ?.where((l) => l.matchupId == matchup.id)
            .firstOrNull
            ?.id;
    final log = logId == null
        ? const AsyncValue<WorkoutLog?>.data(null)
        : ref.watch(logProvider(logId));
    final currentLog = log.value;
    final submitted = currentLog?.isSubmitted ?? false;
    final closed = matchup.status == MatchupStatus.complete;
    final editable = isMine && !submitted && !closed;

    return Scaffold(
      appBar: AppBar(
        title: Text(workout.title ?? 'Workout'),
        actions: [
          _ScoreBadge(log: currentLog, workout: workout),
          const SizedBox(width: 8),
        ],
      ),
      bottomNavigationBar: editable
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: FilledButton.icon(
                  onPressed: _submit,
                  icon: const Icon(Icons.check),
                  label: const Text('Submit workout'),
                ),
              ),
            )
          : null,
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          _Header(matchup: matchup, workout: workout, submitted: submitted),
          for (final block in workout.blocks) ...[
            SectionHeader(Fmt.block(block.type)),
            for (final item in block.items)
              _ItemTile(
                item: item,
                exercise: catalog.byId(item.exerciseId),
                entry: currentLog?.entryForItem(item.id),
                onTap: editable && catalog.byId(item.exerciseId) != null
                    ? () => _logItem(
                        item,
                        catalog.byId(item.exerciseId)!,
                        currentLog,
                      )
                    : null,
              ),
          ],
        ],
      ),
    );
  }
}

class _Header extends ConsumerWidget {
  const _Header({
    required this.matchup,
    required this.workout,
    required this.submitted,
  });

  final Matchup matchup;
  final Workout workout;
  final bool submitted;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(currentPeachIdProvider);
    final opponentId = me == null ? null : matchup.opponentOf(me);
    final opponent = opponentId == null
        ? null
        : ref.watch(peachProvider(opponentId)).value;
    final theme = Theme.of(context);
    final result = matchup.result;
    final window = ref.watch(roundWindowProvider(matchup.roundId)).value;
    final now = ref.watch(clockProvider)();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                matchup.isBye
                    ? 'Bye week'
                    : 'You vs ${opponent?.displayName ?? '…'}',
                style: theme.textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              Text(
                '${Fmt.focus(workout.focus)} · ${Fmt.goal(workout.goal)} · '
                '~${workout.estimatedMinutes} min',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              if (result != null && me != null) ...[
                const SizedBox(height: 12),
                Text(
                  matchup.isBye
                      ? 'Final: ${Fmt.points(result.homePoints)} points'
                      : 'Final: ${Fmt.points(matchup.homePeachId == me ? result.homePoints : result.awayPoints)}'
                            ' – ${Fmt.points(matchup.homePeachId == me ? result.awayPoints : result.homePoints)}'
                            '${matchup.winnerId == null
                                ? ' (tie)'
                                : matchup.winnerId == me
                                ? ' · You won'
                                : ' · ${opponent?.displayName ?? 'They'} won'}',
                  style: theme.textTheme.titleMedium,
                ),
              ] else if (!submitted && window != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(
                      Icons.schedule,
                      color: theme.colorScheme.onSurfaceVariant,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Logging ${Fmt.closesIn(window.remainingAt(now))}'
                      ' · ${Fmt.day(LocalDate.of(window.closesAt.toLocal()))}'
                      ' ${Fmt.time(window.closesAt.toLocal())}',
                    ),
                  ],
                ),
              ] else if (submitted) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(
                      Icons.check_circle,
                      color: theme.colorScheme.primary,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    const Text('Submitted. Waiting for the round to close.'),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ScoreBadge extends ConsumerWidget {
  const _ScoreBadge({required this.log, required this.workout});

  final WorkoutLog? log;
  final Workout workout;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final app = ref.watch(appContainerProvider);
    final score = log == null
        ? WorkoutScore.zero
        : app.scoring.score(workout: workout, log: log);
    return Chip(
      avatar: const Icon(Icons.star_outline, size: 18),
      label: Text('${Fmt.points(score.total)} pts'),
    );
  }
}

class _ItemTile extends StatelessWidget {
  const _ItemTile({
    required this.item,
    required this.exercise,
    required this.entry,
    required this.onTap,
  });

  final WorkoutItem item;
  final Exercise? exercise;
  final ExerciseLogEntry? entry;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final target = item.prescription.totalTarget;
    final achieved = entry == null
        ? 0
        : switch (item.prescription.unit) {
            _ when item.prescription.reps != null => entry!.totalReps,
            _ when item.prescription.seconds != null => entry!.totalSeconds,
            _ => entry!.totalMeters,
          };
    final ratio = target == 0 ? 0.0 : (achieved / target).clamp(0.0, 1.0);

    return ListTile(
      title: Text(exercise?.name ?? item.exerciseId),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(Fmt.prescription(item.prescription)),
          if (exercise?.cues != null)
            Text(
              exercise!.cues!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          if (item.isScored) ...[
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(value: ratio, minHeight: 6),
            ),
          ],
        ],
      ),
      trailing: entry == null
          ? (onTap == null ? null : const Icon(Icons.add_circle_outline))
          : Icon(
              ratio >= 1 ? Icons.check_circle : Icons.edit_outlined,
              color: ratio >= 1 ? theme.colorScheme.primary : null,
            ),
      onTap: onTap,
      isThreeLine: true,
    );
  }
}
