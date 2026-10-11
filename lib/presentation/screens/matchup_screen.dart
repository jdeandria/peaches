import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../application/providers.dart';
import '../../domain/core/local_date.dart';
import '../../domain/exercises/exercise.dart';
import '../../domain/models/score.dart';
import '../../domain/models/season.dart';
import '../../domain/models/workout.dart';
import '../../domain/models/workout_log.dart';
import '../formatting.dart';
import '../widgets/async_view.dart';
import '../widgets/motion.dart';
import '../widgets/page_scaffold.dart';
import '../widgets/set_logger_sheet.dart';
import '../widgets/tonal_card.dart';

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

    final opponentId = me == null ? null : matchup.opponentOf(me);
    final opponent = opponentId == null
        ? null
        : ref.watch(peachProvider(opponentId)).value;
    final headline = matchup.isBye
        ? 'Bye round'
        : 'You vs ${opponent?.displayName ?? '…'}';
    var i = 0;

    return PageScaffold(
      title: headline,
      toolbarTitle: workout.title ?? 'Workout',
      subtitle: [
        if (workout.title != null) workout.title!,
        Fmt.focus(workout.focus),
        '~${workout.estimatedMinutes} min',
      ].join(' · '),
      showBack: true,
      actions: [_ScoreBadge(log: currentLog, workout: workout)],
      bottomBar: editable
          ? SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton.icon(
                onPressed: _submit,
                icon: const Icon(Icons.check_rounded),
                label: const Text('Submit workout'),
              ),
            )
          : null,
      children: [
        StaggeredEntrance(
          index: i++,
          child: _StatusBanner(
            matchup: matchup,
            opponentName: opponent?.displayName,
            submitted: submitted,
          ),
        ),
        for (final block in workout.blocks) ...[
          PageSection(
            Fmt.block(block.type),
            trailing: block.items.any((it) => it.isScored)
                ? StatusLabel(
                    'Scored',
                    color: Theme.of(context).colorScheme.primary,
                  )
                : const StatusLabel('Not scored'),
          ),
          StaggeredEntrance(
            index: i++,
            child: TonalListCard(
              children: [
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
            ),
          ),
        ],
      ],
    );
  }
}

/// Deadline while open, confirmation once submitted, or the final score
/// as a hero once the round has closed.
class _StatusBanner extends ConsumerWidget {
  const _StatusBanner({
    required this.matchup,
    required this.opponentName,
    required this.submitted,
  });

  final Matchup matchup;
  final String? opponentName;
  final bool submitted;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(currentPeachIdProvider);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final result = matchup.result;
    final window = ref.watch(roundWindowProvider(matchup.roundId)).value;
    final now = ref.watch(clockProvider)();

    if (result != null && me != null) {
      final home = matchup.homePeachId == me;
      final mine = home ? result.homePoints : result.awayPoints;
      final theirs = home ? result.awayPoints : result.homePoints;
      final verdict = matchup.isBye
          ? 'Bye round'
          : matchup.winnerId == null
          ? 'Tie'
          : matchup.winnerId == me
          ? 'You won'
          : '${opponentName ?? 'They'} won';
      final on = scheme.onPrimaryContainer;
      return Material(
        color: scheme.primaryContainer,
        borderRadius: BorderRadius.circular(PeachesTheme.radiusExtraLarge),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Final',
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: on.withValues(alpha: 0.8),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      matchup.isBye
                          ? Fmt.points(mine)
                          : '${Fmt.points(mine)} – ${Fmt.points(theirs)}',
                      style: theme.textTheme.displaySmall?.copyWith(
                        color: on,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                verdict,
                style: theme.textTheme.titleMedium?.copyWith(color: on),
              ),
            ],
          ),
        ),
      );
    }

    final (icon, text, color) = submitted
        ? (
            Icons.check_circle_rounded,
            'Submitted. Results arrive when the round closes.',
            scheme.primary,
          )
        : (
            Icons.schedule_rounded,
            window == null
                ? 'Log each exercise as you go.'
                : 'Logging ${Fmt.closesIn(window.remainingAt(now))} · '
                      '${Fmt.day(LocalDate.of(window.closesAt.toLocal()))} '
                      '${Fmt.time(window.closesAt.toLocal())}',
            scheme.onSurfaceVariant,
          );
    return TonalCard(
      variant: TonalCardVariant.filled,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: theme.textTheme.bodyMedium)),
        ],
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
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: scheme.primaryContainer,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.star_rounded, size: 18, color: scheme.onPrimaryContainer),
          const SizedBox(width: 6),
          AnimatedNumber(
            value: score.total,
            format: (v) => '${Fmt.points(v)} pts',
            style: Theme.of(context).textTheme.labelLarge
                ?.copyWith(color: scheme.onPrimaryContainer),
          ),
        ],
      ),
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
    final scheme = theme.colorScheme;
    final target = item.prescription.totalTarget;
    final achieved = entry == null
        ? 0
        : switch (item.prescription.unit) {
            _ when item.prescription.reps != null => entry!.totalReps,
            _ when item.prescription.seconds != null => entry!.totalSeconds,
            _ => entry!.totalMeters,
          };
    final ratio = target == 0 ? 0.0 : (achieved / target).clamp(0.0, 1.0);
    final done = entry != null && ratio >= 1;

    final Widget action;
    if (entry == null) {
      action = onTap == null
          ? const SizedBox(key: ValueKey('none'), width: 40)
          : IconButton.filledTonal(
              key: const ValueKey('add'),
              tooltip: 'Log sets',
              onPressed: onTap,
              icon: const Icon(Icons.add),
            );
    } else if (done) {
      action = IconButton.filled(
        key: const ValueKey('done'),
        tooltip: 'Edit sets',
        onPressed: onTap,
        icon: const Icon(Icons.check_rounded),
      );
    } else {
      action = IconButton.outlined(
        key: const ValueKey('edit'),
        tooltip: 'Edit sets',
        onPressed: onTap,
        icon: const Icon(Icons.edit_outlined, size: 20),
      );
    }

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    exercise?.name ?? item.exerciseId,
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    Fmt.prescription(item.prescription),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  if (exercise?.cues != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      exercise!.cues!,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                  if (item.isScored) ...[
                    const SizedBox(height: 10),
                    AnimatedProgress(value: ratio),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 12),
            AnimatedSwitcher(
              duration: Motion.short,
              switchInCurve: Motion.enter,
              switchOutCurve: Motion.exit,
              transitionBuilder: (child, animation) =>
                  ScaleTransition(scale: animation, child: child),
              child: action,
            ),
          ],
        ),
      ),
    );
  }
}
