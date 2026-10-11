import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../application/providers.dart';
import '../../domain/models/crate.dart';
import '../../domain/models/season.dart';
import '../../domain/models/training.dart';
import '../expressive/shapes.dart';
import '../formatting.dart';
import '../widgets/async_view.dart';
import '../widgets/motion.dart';
import '../widgets/page_scaffold.dart';
import '../widgets/tonal_card.dart';

/// The Crates the current Peach belongs to, with create / join actions.
class CratesScreen extends ConsumerWidget {
  const CratesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final crates = ref.watch(myCratesProvider);
    final fab = FloatingActionButton.extended(
      onPressed: () => _showCrateActions(context),
      icon: const Icon(Icons.add),
      label: const Text('New Crate'),
    );
    return AsyncView(
      value: crates,
      data: (list) => PageScaffold(
        title: 'Crates',
        subtitle: list.isEmpty
            ? 'Train together, compete together.'
            : '${list.length} ${list.length == 1 ? 'Crate' : 'Crates'}',
        maxWidth: 1040,
        floatingActionButton: fab,
        children: [
          if (list.isEmpty)
            const EmptyState(
              icon: Icons.inventory_2_outlined,
              title: 'No Crates yet',
              message: 'Create a Crate or join one with an invite code.',
            )
          else
            LayoutBuilder(
              builder: (context, constraints) {
                final cols = constraints.maxWidth >= 1000
                    ? 3
                    : constraints.maxWidth >= 600
                    ? 2
                    : 1;
                const gap = 16.0;
                final w = (constraints.maxWidth - gap * (cols - 1)) / cols;
                return Wrap(
                  spacing: gap,
                  runSpacing: gap,
                  children: [
                    for (final (i, c) in list.indexed)
                      SizedBox(
                        width: w,
                        child: StaggeredEntrance(
                          index: i,
                          child: _CrateCard(crate: c),
                        ),
                      ),
                  ],
                );
              },
            ),
        ],
      ),
    );
  }

  void _showCrateActions(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      builder: (sheet) {
        final theme = Theme.of(sheet);
        Widget option({
          required IconData icon,
          required String title,
          required String subtitle,
          required Widget dialog,
        }) => ListTile(
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 24,
            vertical: 4,
          ),
          leading: ShapedAvatar(child: Icon(icon)),
          title: Text(title),
          subtitle: Text(subtitle),
          onTap: () {
            Navigator.pop(sheet);
            showDialog<void>(context: context, builder: (_) => dialog);
          },
        );
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
                  child: Text('Add a Crate', style: theme.textTheme.titleLarge),
                ),
                option(
                  icon: Icons.add_rounded,
                  title: 'Create a Crate',
                  subtitle: 'Start a group and invite your Peaches',
                  dialog: const CreateCrateDialog(),
                ),
                option(
                  icon: Icons.key_outlined,
                  title: 'Join with invite code',
                  subtitle: 'Got a six-letter code from a friend?',
                  dialog: const JoinCrateDialog(),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _CrateCard extends ConsumerWidget {
  const _CrateCard({required this.crate});

  final Crate crate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final count = ref.watch(crateMembersProvider(crate.id)).value?.length;
    final seasons = ref.watch(crateSeasonsProvider(crate.id)).value ?? const [];
    final season =
        seasons.where((s) => s.isOpen).firstOrNull ?? seasons.firstOrNull;
    final rounds = season == null
        ? null
        : ref.watch(seasonRoundsProvider(season.id)).value;
    final played =
        rounds?.where((r) => r.status == RoundStatus.closed).length ?? 0;

    return TonalCard(
      padding: const EdgeInsets.all(20),
      onTap: () =>
          context.goNamed(Routes.crate, pathParameters: {'crateId': crate.id}),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ShapedAvatar(
                shape: ExpressiveShape.forId(crate.id),
                size: 52,
                color: scheme.tertiaryContainer,
                foregroundColor: scheme.onTertiaryContainer,
                child: Text(crate.name.characters.first.toUpperCase()),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(crate.name, style: theme.textTheme.titleLarge),
                    Text(
                      [
                        if (count != null)
                          '$count ${count == 1 ? 'Peach' : 'Peaches'}',
                        Fmt.goal(crate.settings.goal),
                        '${crate.settings.workoutDurationMinutes} min',
                      ].join(' · '),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (crate.description.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              crate.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodyMedium,
            ),
          ],
          const SizedBox(height: 16),
          if (season == null || rounds == null)
            Text(
              'No Season yet',
              style: theme.textTheme.labelLarge?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            )
          else ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    season.name,
                    style: theme.textTheme.labelLarge,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  season.status == SeasonStatus.scheduled
                      ? 'Starts ${Fmt.day(season.startDate!)}'
                      : 'Round ${(played + 1).clamp(1, rounds.length)} of ${rounds.length}',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            AnimatedProgress(
              value: rounds.isEmpty ? 0 : played / rounds.length,
            ),
          ],
        ],
      ),
    );
  }
}

class CreateCrateDialog extends ConsumerStatefulWidget {
  const CreateCrateDialog({super.key});

  @override
  ConsumerState<CreateCrateDialog> createState() => _CreateCrateDialogState();
}

class _CreateCrateDialogState extends ConsumerState<CreateCrateDialog> {
  final _name = TextEditingController();
  final _description = TextEditingController();
  TrainingGoal _goal = TrainingGoal.generalFitness;
  double _minutes = 40;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final me = ref.read(currentPeachIdProvider);
    if (me == null) return;
    setState(() => _busy = true);
    try {
      final app = ref.read(appContainerProvider);
      final crate = await app.crateService.createCrate(
        ownerPeachId: me,
        name: _name.text,
        description: _description.text,
        now: ref.read(clockProvider)().toUtc(),
        settings: CrateSettings(
          goal: _goal,
          workoutDurationMinutes: _minutes.round(),
        ),
      );
      ref.read(dataRevisionProvider.notifier).bump();
      if (!mounted) return;
      Navigator.pop(context);
      context.goNamed(Routes.crate, pathParameters: {'crateId': crate.id});
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('New Crate'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _name,
              autofocus: true,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _description,
              decoration: const InputDecoration(labelText: 'Description'),
            ),
            const SizedBox(height: 16),
            DropdownMenu<TrainingGoal>(
              initialSelection: _goal,
              label: const Text('Goal'),
              expandedInsets: EdgeInsets.zero,
              onSelected: (g) => setState(() => _goal = g ?? _goal),
              dropdownMenuEntries: [
                for (final g in TrainingGoal.values)
                  DropdownMenuEntry(value: g, label: Fmt.goal(g)),
              ],
            ),
            const SizedBox(height: 16),
            Text('Workout length: ${_minutes.round()} min'),
            Slider(
              value: _minutes,
              min: 15,
              max: 90,
              divisions: 15,
              label: '${_minutes.round()} min',
              onChanged: (v) => setState(() => _minutes = v),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _busy ? null : _submit,
          child: const Text('Create'),
        ),
      ],
    );
  }
}

class JoinCrateDialog extends ConsumerStatefulWidget {
  const JoinCrateDialog({super.key});

  @override
  ConsumerState<JoinCrateDialog> createState() => _JoinCrateDialogState();
}

class _JoinCrateDialogState extends ConsumerState<JoinCrateDialog> {
  final _code = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final me = ref.read(currentPeachIdProvider);
    if (me == null) return;
    setState(() => _busy = true);
    try {
      final app = ref.read(appContainerProvider);
      final crate = await app.crateService.joinByInviteCode(
        inviteCode: _code.text,
        peachId: me,
        now: ref.read(clockProvider)().toUtc(),
      );
      ref.read(dataRevisionProvider.notifier).bump();
      if (!mounted) return;
      Navigator.pop(context);
      context.goNamed(Routes.crate, pathParameters: {'crateId': crate.id});
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Join a Crate'),
      content: TextField(
        controller: _code,
        autofocus: true,
        textCapitalization: TextCapitalization.characters,
        decoration: const InputDecoration(labelText: 'Invite code'),
        onSubmitted: (_) => _submit(),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _busy ? null : _submit,
          child: const Text('Join'),
        ),
      ],
    );
  }
}
