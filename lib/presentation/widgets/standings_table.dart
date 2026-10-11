import 'package:flutter/material.dart';

import '../../domain/models/score.dart';
import '../formatting.dart';
import 'adaptive.dart';
import 'tonal_card.dart';

/// A compact fantasy-style table: W-L-T, points for, points against.
class StandingsTable extends StatelessWidget {
  const StandingsTable({
    required this.standings,
    required this.names,
    super.key,
    this.highlightPeachId,
  });

  final List<Standing> standings;
  final Map<String, String> names;
  final String? highlightPeachId;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Form dots only fit from medium windows up; compact keeps the streak.
    final showForm = !WindowSize.of(context).isCompact;
    if (standings.isEmpty) {
      return const TonalCard(
        variant: TonalCardVariant.outlined,
        margin: EdgeInsets.symmetric(horizontal: 16),
        child: Text('No standings yet.'),
      );
    }
    return TonalCard(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: EdgeInsets.zero,
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: ConstrainedBox(
            constraints: BoxConstraints(minWidth: constraints.maxWidth),
            child: DataTable(
              columnSpacing: 20,
              headingTextStyle: theme.textTheme.labelLarge?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              dividerThickness: 0.5,
              columns: [
                const DataColumn(label: Text('#')),
                const DataColumn(label: Text('Peach')),
                const DataColumn(label: Text('W-L-T')),
                const DataColumn(label: Text('Streak')),
                if (showForm) const DataColumn(label: Text('Form')),
                const DataColumn(label: Text('PF'), numeric: true),
                const DataColumn(label: Text('PA'), numeric: true),
              ],
              rows: [
                for (final (i, s) in standings.indexed)
                  DataRow(
                    selected: s.peachId == highlightPeachId,
                    cells: [
                      DataCell(Text('${i + 1}')),
                      DataCell(Text(names[s.peachId] ?? s.peachId)),
                      DataCell(Text('${s.wins}-${s.losses}-${s.ties}')),
                      DataCell(
                        Text(
                          s.streak.isEmpty ? '–' : s.streak,
                          style: s.onWinningStreak
                              ? TextStyle(
                                  color: theme.colorScheme.primary,
                                  fontWeight: FontWeight.w600,
                                )
                              : null,
                        ),
                      ),
                      if (showForm) DataCell(_FormDots(form: s.form)),
                      DataCell(Text(Fmt.points(s.pointsFor))),
                      DataCell(Text(Fmt.points(s.pointsAgainst))),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The last five outcomes as coloured dots, oldest to newest.
class _FormDots extends StatelessWidget {
  const _FormDots({required this.form});

  final List<MatchOutcome> form;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final recent = form.length > 5 ? form.sublist(form.length - 5) : form;
    if (recent.isEmpty) return const Text('–');
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final o in recent)
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: switch (o) {
                  MatchOutcome.win => scheme.primary,
                  MatchOutcome.loss => scheme.error.withValues(alpha: 0.6),
                  MatchOutcome.tie => scheme.outline,
                },
              ),
            ),
          ),
      ],
    );
  }
}
