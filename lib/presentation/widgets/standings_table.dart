import 'package:flutter/material.dart';

import '../../domain/models/score.dart';
import '../formatting.dart';

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
    if (standings.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(horizontal: 16),
        child: Text('No standings yet.'),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Card(
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            columnSpacing: 20,
            headingTextStyle: theme.textTheme.labelLarge,
            columns: const [
              DataColumn(label: Text('#')),
              DataColumn(label: Text('Peach')),
              DataColumn(label: Text('W-L-T')),
              DataColumn(label: Text('PF'), numeric: true),
              DataColumn(label: Text('PA'), numeric: true),
            ],
            rows: [
              for (final (i, s) in standings.indexed)
                DataRow(
                  selected: s.peachId == highlightPeachId,
                  cells: [
                    DataCell(Text('${i + 1}')),
                    DataCell(Text(names[s.peachId] ?? s.peachId)),
                    DataCell(Text('${s.wins}-${s.losses}-${s.ties}')),
                    DataCell(Text(Fmt.points(s.pointsFor))),
                    DataCell(Text(Fmt.points(s.pointsAgainst))),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}
