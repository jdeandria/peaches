import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../application/providers.dart';
import '../../domain/models/crate.dart';
import '../../domain/models/peach.dart';
import '../../domain/models/season.dart';
import '../../domain/services/round_robin_scheduler.dart';
import '../formatting.dart';
import '../widgets/async_view.dart';
import '../widgets/standings_table.dart';

/// Members, the current Season's standings and rounds, and owner actions.
class CrateDetailScreen extends ConsumerWidget {
  const CrateDetailScreen({required this.crateId, super.key});

  final String crateId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final crate = ref.watch(crateProvider(crateId));
    return AsyncView(
      value: crate,
      data: (c) => c == null
          ? Scaffold(
              appBar: AppBar(),
              body: const EmptyState(
                icon: Icons.search_off,
                title: 'Crate not found',
              ),
            )
          : _CrateBody(crate: c),
    );
  }
}

class _CrateBody extends ConsumerWidget {
  const _CrateBody({required this.crate});

  final Crate crate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final members = ref.watch(crateMembersProvider(crate.id));
    final seasons = ref.watch(crateSeasonsProvider(crate.id));
    final me = ref.watch(currentPeachIdProvider);
    final canManage = me == crate.ownerPeachId;

    return Scaffold(
      appBar: AppBar(
        title: Text(crate.name),
        actions: [
          IconButton(
            tooltip: 'Copy invite code',
            icon: const Icon(Icons.share_outlined),
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: crate.inviteCode));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Invite code ${crate.inviteCode} copied'),
                  ),
                );
              }
            },
          ),
        ],
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              onPressed: () => showDialog<void>(
                context: context,
                builder: (_) => NewSeasonDialog(crate: crate),
              ),
              icon: const Icon(Icons.emoji_events_outlined),
              label: const Text('Season'),
            )
          : null,
      body: ListView(
        padding: const EdgeInsets.only(bottom: 88),
        children: [
          if (crate.description.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(crate.description),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Wrap(
              spacing: 8,
              children: [
                Chip(label: Text(Fmt.goal(crate.settings.goal))),
                Chip(
                  label: Text('${crate.settings.workoutDurationMinutes} min'),
                ),
                Chip(label: Text('Code ${crate.inviteCode}')),
              ],
            ),
          ),
          AsyncView(
            value: seasons,
            compact: true,
            data: (list) {
              final current =
                  list.where((s) => s.isOpen).firstOrNull ?? list.firstOrNull;
              if (current == null) {
                return const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('No Season yet. The owner can start one.'),
                );
              }
              return _SeasonSection(season: current, canManage: canManage);
            },
          ),
          const SectionHeader('Peaches'),
          AsyncView(
            value: members,
            compact: true,
            data: (list) => Column(
              children: [
                for (final p in list)
                  ListTile(
                    leading: CircleAvatar(child: Text(p.displayName[0])),
                    title: Text(p.displayName),
                    subtitle: Text(
                      p.id == crate.ownerPeachId ? 'Owner' : 'Member',
                    ),
                    trailing: Text('Level ${p.fitnessLevel}'),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SeasonSection extends ConsumerWidget {
  const _SeasonSection({required this.season, required this.canManage});

  final Season season;
  final bool canManage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final standings = ref.watch(standingsProvider(season.id));
    final rounds = ref.watch(seasonRoundsProvider(season.id));
    final matchups = ref.watch(seasonMatchupsProvider(season.id));
    final members = ref.watch(crateMembersProvider(season.crateId));
    final me = ref.watch(currentPeachIdProvider);
    final today = ref.watch(todayProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          season.name,
          trailing: Chip(label: Text(Fmt.seasonStatus(season.status))),
        ),
        AsyncView(
          value: standings,
          compact: true,
          data: (rows) => StandingsTable(
            standings: rows,
            names: {
              for (final p in members.value ?? const <Peach>[])
                p.id: p.displayName,
            },
            highlightPeachId: me,
          ),
        ),
        const SectionHeader('Rounds'),
        AsyncView(
          value: rounds,
          compact: true,
          data: (list) => Column(
            children: [
              for (final r in list)
                _RoundTile(
                  round: r,
                  mine: matchups.value
                      ?.where(
                        (m) =>
                            m.roundId == r.id && me != null && m.involves(me),
                      )
                      .firstOrNull,
                  canManage: canManage,
                  isDue: !r.date.isAfter(today),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RoundTile extends ConsumerWidget {
  const _RoundTile({
    required this.round,
    required this.mine,
    required this.canManage,
    required this.isDue,
  });

  final Round round;
  final Matchup? mine;
  final bool canManage;
  final bool isDue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Future<void> run(Future<void> Function() action) async {
      try {
        await action();
        ref.read(dataRevisionProvider.notifier).bump();
      } catch (e) {
        if (context.mounted) showError(context, e);
      }
    }

    final app = ref.read(appContainerProvider);
    Widget? trailing;
    if (canManage && round.status == RoundStatus.scheduled && isDue) {
      trailing = FilledButton.tonal(
        onPressed: () => run(
          () => app.seasonService.openRound(
            roundId: round.id,
            now: ref.read(clockProvider)().toUtc(),
          ),
        ),
        child: const Text('Open'),
      );
    } else if (canManage && round.status == RoundStatus.open) {
      trailing = FilledButton.tonal(
        onPressed: () =>
            run(() => app.seasonService.closeRound(roundId: round.id)),
        child: const Text('Close'),
      );
    } else {
      trailing = Text(Fmt.roundStatus(round.status));
    }

    return ListTile(
      leading: CircleAvatar(child: Text('${round.index + 1}')),
      title: Text('${Fmt.day(round.date)} · ${Fmt.focus(round.focus)}'),
      subtitle: mine == null
          ? null
          : Text(mine!.isBye ? 'Bye' : 'You have a matchup'),
      trailing: trailing,
      onTap: mine == null || mine!.workoutId == null
          ? null
          : () => context.goNamed(
              Routes.matchup,
              pathParameters: {'matchupId': mine!.id},
            ),
    );
  }
}

/// Picks weekdays and a length; exercise days are derived ahead of time.
class NewSeasonDialog extends ConsumerStatefulWidget {
  const NewSeasonDialog({required this.crate, super.key});

  final Crate crate;

  @override
  ConsumerState<NewSeasonDialog> createState() => _NewSeasonDialogState();
}

class _NewSeasonDialogState extends ConsumerState<NewSeasonDialog> {
  final _name = TextEditingController(text: 'New Season');
  final _weekdays = {DateTime.monday, DateTime.wednesday, DateTime.friday};
  int _weeks = 4;
  bool _busy = false;

  static const _labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      final today = ref.read(todayProvider);
      final start = today.addDays(1);
      final days = const ExerciseDayPlanner().weekdaysBetween(
        start,
        start.addDays(_weeks * 7 - 1),
        _weekdays,
      );
      await ref
          .read(appContainerProvider)
          .seasonService
          .createSeason(
            crate: widget.crate,
            name: _name.text,
            exerciseDays: days,
            now: ref.read(clockProvider)().toUtc(),
          );
      ref.read(dataRevisionProvider.notifier).bump();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('New Season'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Name'),
          ),
          const SizedBox(height: 16),
          const Text('Exercise days'),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            children: [
              for (var d = 1; d <= 7; d++)
                FilterChip(
                  label: Text(_labels[d - 1]),
                  selected: _weekdays.contains(d),
                  onSelected: (on) => setState(() {
                    if (on) {
                      _weekdays.add(d);
                    } else {
                      _weekdays.remove(d);
                    }
                  }),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text('Length: $_weeks weeks'),
          Slider(
            value: _weeks.toDouble(),
            min: 1,
            max: 12,
            divisions: 11,
            label: '$_weeks',
            onChanged: (v) => setState(() => _weeks = v.round()),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _busy || _weekdays.isEmpty ? null : _submit,
          child: const Text('Start'),
        ),
      ],
    );
  }
}
