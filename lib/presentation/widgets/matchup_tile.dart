import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/providers.dart';
import '../../domain/models/season.dart';
import '../formatting.dart';
import 'tonal_card.dart';

/// One matchup as the current Peach sees it, as an elevated tonal card:
/// opponent, crate, date, focus, and either the result or the state.
class MatchupTile extends ConsumerWidget {
  const MatchupTile({required this.matchup, super.key, this.onTap});

  final Matchup matchup;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final me = ref.watch(currentPeachIdProvider);
    final opponentId = me == null ? null : matchup.opponentOf(me);
    final opponent = opponentId == null
        ? null
        : ref.watch(peachProvider(opponentId)).value;
    final round = ref.watch(roundProvider(matchup.roundId)).value;
    final season = ref.watch(seasonProvider(matchup.seasonId)).value;
    final crate = season == null
        ? null
        : ref.watch(crateProvider(season.crateId)).value;
    final window = ref.watch(roundWindowProvider(matchup.roundId)).value;
    final now = ref.watch(clockProvider)();

    final title = matchup.isBye
        ? 'Bye week workout'
        : 'vs ${opponent?.displayName ?? '…'}';
    final detail = [
      if (round != null) Fmt.day(round.date),
      if (round != null) Fmt.focus(round.focus),
      if (window != null && matchup.status == MatchupStatus.inProgress)
        Fmt.closesIn(window.remainingAt(now)),
    ].join(' · ');

    return TonalCard(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      onTap: onTap,
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: scheme.secondaryContainer,
            foregroundColor: scheme.onSecondaryContainer,
            child: Text(
              matchup.isBye ? '—' : (opponent?.displayName ?? '?')[0],
              style: theme.textTheme.titleMedium,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleMedium),
                if (crate != null)
                  Text(
                    crate.name,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                const SizedBox(height: 2),
                Text(
                  detail,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          _Trailing(matchup: matchup, me: me),
        ],
      ),
    );
  }
}

class _Trailing extends StatelessWidget {
  const _Trailing({required this.matchup, required this.me});

  final Matchup matchup;
  final String? me;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final result = matchup.result;
    if (result != null && me != null) {
      final home = matchup.homePeachId == me;
      final mine = home ? result.homePoints : result.awayPoints;
      final theirs = home ? result.awayPoints : result.homePoints;
      final won = matchup.winnerId == me;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            matchup.isBye
                ? Fmt.points(mine)
                : '${Fmt.points(mine)} – ${Fmt.points(theirs)}',
            style: theme.textTheme.titleMedium?.copyWith(
              color: won ? scheme.primary : null,
              fontWeight: FontWeight.w600,
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
    }
    final open = matchup.status == MatchupStatus.inProgress;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: open ? scheme.primaryContainer : scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        Fmt.matchupStatus(matchup.status),
        style: theme.textTheme.labelMedium?.copyWith(
          color: open ? scheme.onPrimaryContainer : scheme.onSurfaceVariant,
        ),
      ),
    );
  }
}
