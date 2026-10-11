import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../application/providers.dart';
import '../../domain/models/crate.dart';
import '../../domain/models/training.dart';
import '../formatting.dart';
import '../widgets/adaptive.dart';
import '../widgets/async_view.dart';
import '../widgets/motion.dart';
import '../widgets/tonal_card.dart';

/// The Crates the current Peach belongs to, with create / join actions.
class CratesScreen extends ConsumerWidget {
  const CratesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final crates = ref.watch(myCratesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Crates')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCrateActions(context),
        icon: const Icon(Icons.add),
        label: const Text('Crate'),
      ),
      body: AsyncView(
        value: crates,
        data: (list) => list.isEmpty
            ? const EmptyState(
                icon: Icons.inventory_2_outlined,
                title: 'No Crates yet',
                message: 'Create a Crate or join one with an invite code.',
              )
            : PageBody(
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
                  itemCount: list.length,
                  itemBuilder: (context, i) => StaggeredEntrance(
                    index: i,
                    child: _CrateTile(crate: list[i]),
                  ),
                ),
              ),
      ),
    );
  }

  void _showCrateActions(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.add_box_outlined),
              title: const Text('Create a Crate'),
              onTap: () {
                Navigator.pop(sheet);
                showDialog<void>(
                  context: context,
                  builder: (_) => const CreateCrateDialog(),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.key_outlined),
              title: const Text('Join with invite code'),
              onTap: () {
                Navigator.pop(sheet);
                showDialog<void>(
                  context: context,
                  builder: (_) => const JoinCrateDialog(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _CrateTile extends ConsumerWidget {
  const _CrateTile({required this.crate});

  final Crate crate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final members = ref.watch(crateMembersProvider(crate.id));
    final count = members.value?.length;
    return TonalCard(
      margin: const EdgeInsets.only(bottom: 12),
      onTap: () =>
          context.goNamed(Routes.crate, pathParameters: {'crateId': crate.id}),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: scheme.secondaryContainer,
                foregroundColor: scheme.onSecondaryContainer,
                child: const Icon(Icons.inventory_2_outlined),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(crate.name, style: theme.textTheme.titleMedium),
                    if (crate.description.isNotEmpty)
                      Text(
                        crate.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: scheme.onSurfaceVariant),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              if (count != null)
                _Tag(
                  icon: Icons.people_outline,
                  label: '$count ${count == 1 ? 'Peach' : 'Peaches'}',
                ),
              _Tag(
                icon: Icons.flag_outlined,
                label: Fmt.goal(crate.settings.goal),
              ),
              _Tag(
                icon: Icons.timer_outlined,
                label: '${crate.settings.workoutDurationMinutes} min',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A small label on a surface-container-highest pill (one tone above the
/// card it sits on).
class _Tag extends StatelessWidget {
  const _Tag({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: scheme.onSurfaceVariant),
          const SizedBox(width: 6),
          Text(
            label,
            style: theme.textTheme.labelMedium?.copyWith(
              color: scheme.onSurfaceVariant,
            ),
          ),
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
