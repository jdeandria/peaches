import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/router.dart';
import '../../app/theme.dart';
import '../../application/providers.dart';
import '../../domain/core/local_date.dart';
import '../../domain/models/season.dart';
import '../../domain/models/workout_log.dart';
import '../formatting.dart';
import '../widgets/adaptive.dart';
import '../widgets/async_view.dart';
import '../widgets/matchup_tile.dart';
import '../widgets/motion.dart';
import '../widgets/page_scaffold.dart';
import '../widgets/tonal_card.dart';

/// What the Peach should do today: the due workout first, then the week
/// at a glance, what's coming, and recent history.
class TodayScreen extends ConsumerWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matchups = ref.watch(myMatchupsProvider);
    final today = ref.watch(todayProvider);
    ref.watch(syncSeasonsProvider);

    void open(Matchup m) =>
        context.goNamed(Routes.matchup, pathParameters: {'matchupId': m.id});

    return AsyncView(
      value: matchups,
      data: (all) {
        final open_ = all
            .where((m) => m.status == MatchupStatus.inProgress)
            .toList();
        final upcoming = all
            .where((m) => m.status == MatchupStatus.scheduled)
            .toList();
        final rounds = {
          for (final m in upcoming)
            m.id: ref.watch(roundProvider(m.roundId)).value,
        };
        upcoming.sort(
          (a, b) => (rounds[a.id]?.date.epochDay ?? 0).compareTo(
            rounds[b.id]?.date.epochDay ?? 0,
          ),
        );
        var i = 0;
        final primary = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const PageSection('Up next', top: 8),
            if (open_.isEmpty)
              StaggeredEntrance(index: i++, child: const _RestDayCard())
            else
              for (final m in open_)
                StaggeredEntrance(
                  index: i++,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: MatchupHeroCard(matchup: m, onOpen: () => open(m)),
                  ),
                ),
            StaggeredEntrance(
              index: i++,
              child: _WeekStats(matchups: all),
            ),
          ],
        );
        final secondary = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (upcoming.isNotEmpty) ...[
              const PageSection('Coming up', top: 8),
              StaggeredEntrance(
                index: i++,
                child: TonalListCard(
                  children: [
                    for (final m in upcoming.take(4))
                      MatchupListRow(matchup: m),
                  ],
                ),
              ),
            ],
            PageSection('Recent workouts', top: upcoming.isEmpty ? 8 : 24),
            StaggeredEntrance(index: i++, child: const _RecentLogs()),
          ],
        );
        return PageScaffold(
          title: 'Today',
          subtitle: DateFormat('EEEE, MMMM d').format(today.toDateTime()),
          onRefresh: () => ref.refresh(syncSeasonsProvider.future),
          maxWidth: 1080,
          children: [
            TwoPane(primary: primary, secondary: secondary, stackedGap: 16),
          ],
        );
      },
    );
  }
}

class _RestDayCard extends StatelessWidget {
  const _RestDayCard();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return TonalCard(
      variant: TonalCardVariant.outlined,
      borderRadius: BorderRadius.circular(PeachesTheme.radiusExtraLarge),
      padding: const EdgeInsets.all(24),
      child: Row(
        children: [
          const Text('🍑', style: TextStyle(fontSize: 36)),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Rest day', style: theme.textTheme.titleLarge),
                Text(
                  'No workout due. Recovery is training too.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Three headline numbers for the last seven days and the season.
class _WeekStats extends ConsumerWidget {
  const _WeekStats({required this.matchups});

  final List<Matchup> matchups;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(currentPeachIdProvider);
    final now = ref.watch(clockProvider)();
    final logs = ref.watch(myLogsProvider).value ?? const <WorkoutLog>[];
    final week = logs.where(
      (l) =>
          l.isSubmitted &&
          now.difference(l.completedAt ?? l.startedAt).inDays < 7,
    );
    final sets = week.fold<int>(
      0,
      (n, l) => n + l.entries.fold(0, (m, e) => m + e.sets.length),
    );
    var w = 0, l = 0, t = 0;
    for (final m in matchups) {
      if (m.result == null || m.isBye || me == null) continue;
      final winner = m.winnerId;
      if (winner == null) {
        t++;
      } else if (winner == me) {
        w++;
      } else {
        l++;
      }
    }
    final tiles = [
      _Stat(value: '${week.length}', label: 'Workouts this week'),
      _Stat(value: '$sets', label: 'Sets this week'),
      _Stat(value: '$w-$l${t > 0 ? '-$t' : ''}', label: 'Season record'),
    ];
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (i, tile) in tiles.indexed) ...[
              if (i > 0) const SizedBox(width: 12),
              Expanded(child: tile),
            ],
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return TonalCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 2,
            style: theme.textTheme.labelMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _RecentLogs extends ConsumerWidget {
  const _RecentLogs();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logs = ref.watch(myLogsProvider);
    return AsyncView(
      value: logs,
      compact: true,
      data: (list) => list.isEmpty
          ? const TonalCard(
              variant: TonalCardVariant.outlined,
              child: Text('Nothing logged yet.'),
            )
          : TonalListCard(
              children: [for (final log in list.take(6)) _LogRow(log: log)],
            ),
    );
  }
}

class _LogRow extends ConsumerWidget {
  const _LogRow({required this.log});

  final WorkoutLog log;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(catalogProvider);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final names = log.entries
        .map((e) => catalog.byId(e.exerciseId)?.name ?? e.exerciseId)
        .take(3)
        .join(', ');
    final sets = log.entries.fold<int>(0, (n, e) => n + e.sets.length);
    return ListTile(
      minVerticalPadding: 12,
      leading: CircleAvatar(
        backgroundColor: log.isSubmitted
            ? scheme.primaryContainer
            : scheme.surfaceContainerHigh,
        foregroundColor: log.isSubmitted
            ? scheme.onPrimaryContainer
            : scheme.onSurfaceVariant,
        child: Icon(
          log.isSubmitted ? Icons.check_rounded : Icons.edit_outlined,
          size: 20,
        ),
      ),
      title: Text(Fmt.day(LocalDate.of(log.startedAt.toLocal()))),
      subtitle: Text(
        names.isEmpty ? 'Empty log' : names,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: Text(
        '$sets sets',
        style: theme.textTheme.labelMedium?.copyWith(
          color: scheme.onSurfaceVariant,
        ),
      ),
      onTap: log.matchupId == null
          ? null
          : () => context.goNamed(
              Routes.matchup,
              pathParameters: {'matchupId': log.matchupId!},
            ),
    );
  }
}
