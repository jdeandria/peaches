import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/providers.dart';
import '../../domain/models/season.dart';
import '../formatting.dart';

/// One matchup as the current Peach sees it: opponent, crate, date, state.
class MatchupTile extends ConsumerWidget {
  const MatchupTile({required this.matchup, super.key, this.onTap});

  final Matchup matchup;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(currentPeachIdProvider);
    final opponentId = me == null ? null : matchup.opponentOf(me);
    final opponent = opponentId == null
        ? const AsyncValue.data(null)
        : ref.watch(peachProvider(opponentId));
    final round = ref.watch(roundProvider(matchup.roundId));
    final season = ref.watch(seasonProvider(matchup.seasonId));
    final crate = season.value == null
        ? const AsyncValue.data(null)
        : ref.watch(crateProvider(season.value!.crateId));

    final title = matchup.isBye
        ? 'Bye week workout'
        : 'vs ${opponent.value?.displayName ?? '…'}';
    final r = round.value;
    final subtitle = [
      crate.value?.name,
      if (r != null) '${Fmt.day(r.date)} · ${Fmt.focus(r.focus)}',
    ].nonNulls.join(' · ');

    Widget trailing;
    final result = matchup.result;
    if (result != null && me != null) {
      final mine = matchup.homePeachId == me
          ? result.homePoints
          : result.awayPoints;
      final theirs = matchup.homePeachId == me
          ? result.awayPoints
          : result.homePoints;
      final won = matchup.winnerId == me;
      trailing = Text(
        matchup.isBye
            ? Fmt.points(mine)
            : '${Fmt.points(mine)} – ${Fmt.points(theirs)}',
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
          color: won ? Theme.of(context).colorScheme.primary : null,
        ),
      );
    } else {
      trailing = Chip(
        label: Text(Fmt.matchupStatus(matchup.status)),
        visualDensity: VisualDensity.compact,
      );
    }

    return ListTile(
      leading: CircleAvatar(
        child: Text(
          matchup.isBye ? '—' : (opponent.value?.displayName ?? '?')[0],
        ),
      ),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: trailing,
      onTap: onTap,
    );
  }
}
