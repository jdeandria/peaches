import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../application/providers.dart';
import '../../domain/models/season.dart';
import '../expressive/shapes.dart';
import '../formatting.dart';
import 'motion.dart';
import 'page_scaffold.dart';

/// Resolved display data for a matchup, shared by the hero and row views.
class _MatchupView {
  _MatchupView(WidgetRef ref, this.matchup) {
    me = ref.watch(currentPeachIdProvider);
    opponentId = me == null ? null : matchup.opponentOf(me!);
    final id = opponentId;
    opponentName = id == null
        ? null
        : ref.watch(peachProvider(id)).value?.displayName;
    round = ref.watch(roundProvider(matchup.roundId)).value;
    final season = ref.watch(seasonProvider(matchup.seasonId)).value;
    crateName = season == null
        ? null
        : ref.watch(crateProvider(season.crateId)).value?.name;
    final window = ref.watch(roundWindowProvider(matchup.roundId)).value;
    remaining = window?.remainingAt(ref.watch(clockProvider)());
  }

  final Matchup matchup;
  late final String? me;
  late final String? opponentId;
  late final String? opponentName;
  late final Round? round;
  late final String? crateName;
  late final Duration? remaining;

  String get title => matchup.isBye ? 'Bye round' : 'vs ${opponentName ?? '…'}';

  String get initial =>
      matchup.isBye ? '–' : (opponentName ?? '?').characters.first;
}

/// The matchup that needs doing, as an M3 hero card on the primary
/// container with a clear primary action and logging progress.
class MatchupHeroCard extends ConsumerWidget {
  const MatchupHeroCard({
    required this.matchup,
    required this.onOpen,
    super.key,
  });

  final Matchup matchup;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final v = _MatchupView(ref, matchup);
    final logs = ref.watch(myLogsProvider).value ?? const [];
    final log = logs.where((l) => l.matchupId == matchup.id).firstOrNull;
    final workout = matchup.workoutId == null
        ? null
        : ref.watch(workoutProvider(matchup.workoutId!)).value;
    final total = workout?.scoredItems.length ?? 0;
    final done = log == null || workout == null
        ? 0
        : workout.scoredItems
              .where((i) => log.entryForItem(i.id) != null)
              .length;
    final submitted = log?.isSubmitted ?? false;
    final on = scheme.onPrimaryContainer;

    return Material(
      color: scheme.primaryContainer,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(PeachesTheme.radiusExtraLarge),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      [
                        if (v.round != null) 'Round ${v.round!.index + 1}',
                        if (v.round != null) Fmt.focus(v.round!.focus),
                      ].join(' · '),
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: on.withValues(alpha: 0.8),
                      ),
                    ),
                  ),
                  if (v.remaining != null && !submitted)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: scheme.surfaceContainerLowest.withValues(
                          alpha: 0.6,
                        ),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.schedule, size: 14, color: on),
                          const SizedBox(width: 4),
                          Text(
                            Fmt.closesIn(v.remaining!),
                            style: theme.textTheme.labelMedium?.copyWith(
                              color: on,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  ShapedAvatar.person(
                    id: v.opponentId ?? matchup.id,
                    name: matchup.isBye ? '–' : (v.opponentName ?? '?'),
                    size: 52,
                    color: scheme.surfaceContainerLowest,
                    foregroundColor: scheme.primary,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          v.title,
                          style: theme.textTheme.headlineSmall?.copyWith(
                            color: on,
                          ),
                        ),
                        if (v.crateName != null)
                          Text(
                            v.crateName!,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: on.withValues(alpha: 0.8),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              if (total > 0) ...[
                Row(
                  children: [
                    Text(
                      submitted
                          ? 'Submitted'
                          : '$done of $total exercises logged',
                      style: theme.textTheme.labelLarge?.copyWith(color: on),
                    ),
                    const Spacer(),
                    if (workout != null)
                      Text(
                        '~${workout.estimatedMinutes} min',
                        style: theme.textTheme.labelLarge?.copyWith(
                          color: on.withValues(alpha: 0.8),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                ProgressIndicatorTheme(
                  data: ProgressIndicatorThemeData(
                    linearTrackColor: scheme.surfaceContainerLowest.withValues(
                      alpha: 0.6,
                    ),
                  ),
                  child: AnimatedProgress(
                    value: submitted ? 1 : (total == 0 ? 0 : done / total),
                    flowing: !submitted && done > 0,
                    color: scheme.primary,
                    trackColor: scheme.surfaceContainerLowest.withValues(
                      alpha: 0.7,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
              ],
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: onOpen,
                  icon: Icon(
                    submitted
                        ? Icons.visibility_outlined
                        : done > 0
                        ? Icons.play_arrow_rounded
                        : Icons.bolt_rounded,
                  ),
                  label: Text(
                    submitted
                        ? 'View workout'
                        : done > 0
                        ? 'Continue workout'
                        : 'Start workout',
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A matchup as a list row: opponent, crate and focus, with a calendar
/// badge for the date or the result once played.
class MatchupListRow extends ConsumerWidget {
  const MatchupListRow({required this.matchup, super.key, this.onTap});

  final Matchup matchup;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final v = _MatchupView(ref, matchup);
    final result = matchup.result;

    Widget trailing;
    if (result != null && v.me != null) {
      final home = matchup.homePeachId == v.me;
      final mine = home ? result.homePoints : result.awayPoints;
      final theirs = home ? result.awayPoints : result.homePoints;
      final won = matchup.winnerId == v.me;
      trailing = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            matchup.isBye
                ? Fmt.points(mine)
                : '${Fmt.points(mine)}–${Fmt.points(theirs)}',
            style: theme.textTheme.titleSmall?.copyWith(
              color: won ? scheme.primary : null,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          Text(
            matchup.isBye
                ? 'Bye'
                : won
                ? 'Won'
                : matchup.winnerId == null
                ? 'Tie'
                : 'Lost',
            style: theme.textTheme.labelSmall?.copyWith(
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      );
    } else if (v.round != null) {
      trailing = DateBadge(date: v.round!.date.toDateTime());
    } else {
      trailing = const SizedBox.shrink();
    }

    return ListTile(
      onTap: onTap,
      minVerticalPadding: 12,
      leading: ShapedAvatar.person(
        id: v.opponentId ?? matchup.id,
        name: matchup.isBye ? '–' : (v.opponentName ?? '?'),
      ),
      title: Text(v.title),
      subtitle: Text(
        [
          v.crateName,
          if (v.round != null) Fmt.focus(v.round!.focus),
        ].nonNulls.join(' · '),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: trailing,
    );
  }
}

/// A small calendar tile: weekday above the day of month.
class DateBadge extends StatelessWidget {
  const DateBadge({required this.date, super.key});

  final DateTime date;

  static const _days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Container(
      width: 44,
      padding: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: scheme.surfaceContainer,
        borderRadius: BorderRadius.circular(PeachesTheme.radiusMedium),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _days[date.weekday - 1].toUpperCase(),
            style: theme.textTheme.labelSmall?.copyWith(
              color: scheme.primary,
              letterSpacing: 0.6,
            ),
          ),
          Text('${date.day}', style: theme.textTheme.titleMedium),
        ],
      ),
    );
  }
}

/// Open / scheduled state for a matchup when no result exists yet.
class MatchupStatusLabel extends StatelessWidget {
  const MatchupStatusLabel({required this.status, super.key});

  final MatchupStatus status;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return StatusLabel(
      Fmt.matchupStatus(status),
      color: status == MatchupStatus.inProgress ? scheme.primary : null,
    );
  }
}
