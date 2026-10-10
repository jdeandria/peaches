import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../application/providers.dart';
import '../../domain/core/local_date.dart';
import '../../domain/models/season.dart';
import '../../domain/models/workout_log.dart';
import '../formatting.dart';
import '../widgets/async_view.dart';
import '../widgets/matchup_tile.dart';
import '../widgets/motion.dart';
import '../widgets/tonal_card.dart';

/// What the Peach should do today: open matchups first, then history.
class TodayScreen extends ConsumerWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matchups = ref.watch(myMatchupsProvider);
    final logs = ref.watch(myLogsProvider);
    final today = ref.watch(todayProvider);
    ref.watch(syncSeasonsProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Today'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(24),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                Fmt.longDay(today),
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ),
        ),
      ),
      body: AsyncView(
        value: matchups,
        data: (all) {
          final open = all
              .where((m) => m.status == MatchupStatus.inProgress)
              .toList();
          final upcoming = all
              .where((m) => m.status == MatchupStatus.scheduled)
              .toList();
          return RefreshIndicator(
            onRefresh: () => ref.refresh(syncSeasonsProvider.future),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const SectionHeader('Open matchups'),
                if (open.isEmpty)
                  const TonalCard(
                    variant: TonalCardVariant.outlined,
                    margin: EdgeInsets.symmetric(horizontal: 16),
                    child: Text('No workout due. Enjoy the rest day.'),
                  )
                else
                  for (final (i, m) in open.indexed)
                    StaggeredEntrance(
                      index: i,
                      child: MatchupTile(
                        matchup: m,
                        onTap: () => context.goNamed(
                          Routes.matchup,
                          pathParameters: {'matchupId': m.id},
                        ),
                      ),
                    ),
                if (upcoming.isNotEmpty) ...[
                  const SectionHeader('Coming up'),
                  for (final (i, m) in upcoming.take(3).indexed)
                    StaggeredEntrance(
                      index: open.length + i,
                      child: MatchupTile(matchup: m),
                    ),
                ],
                const SectionHeader('Recent workouts'),
                AsyncView(
                  value: logs,
                  compact: true,
                  data: (list) => list.isEmpty
                      ? const TonalCard(
                          variant: TonalCardVariant.outlined,
                          margin: EdgeInsets.symmetric(horizontal: 16),
                          child: Text('Nothing logged yet.'),
                        )
                      : StaggeredEntrance(
                          index: open.length + upcoming.length.clamp(0, 3),
                          child: TonalListCard(
                            children: [
                              for (final log in list.take(10))
                                _LogTile(log: log),
                            ],
                          ),
                        ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _LogTile extends ConsumerWidget {
  const _LogTile({required this.log});

  final WorkoutLog log;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(catalogProvider);
    final scheme = Theme.of(context).colorScheme;
    final names = log.entries
        .map((e) => catalog.byId(e.exerciseId)?.name ?? e.exerciseId)
        .take(3)
        .join(', ');
    final date = Fmt.day(LocalDate.of(log.startedAt.toLocal()));
    return ListTile(
      leading: Icon(
        log.isSubmitted ? Icons.check_circle_outline : Icons.edit_outlined,
        color: log.isSubmitted ? scheme.primary : scheme.onSurfaceVariant,
      ),
      title: Text(date),
      subtitle: Text(
        names.isEmpty ? 'Empty log' : names,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: Text(
        log.matchupId == null
            ? 'Free'
            : log.isSubmitted
            ? 'Submitted'
            : 'In progress',
        style: Theme.of(context).textTheme.labelMedium
            ?.copyWith(color: scheme.onSurfaceVariant),
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
