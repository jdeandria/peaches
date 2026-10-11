import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/providers.dart';
import '../../application/season_service.dart';
import '../../domain/models/peach.dart';
import '../../domain/models/training.dart';
import '../expressive/button_group.dart';
import '../expressive/shapes.dart';
import '../widgets/async_view.dart';
import '../widgets/motion.dart';
import '../widgets/page_scaffold.dart';
import '../widgets/tonal_card.dart';

/// The current Peach's identity and settings.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final peach = ref.watch(currentPeachProvider);
    return AsyncView(
      value: peach,
      data: (p) => p == null
          ? const Scaffold(
              body: EmptyState(
                icon: Icons.person_off_outlined,
                title: 'Not signed in',
              ),
            )
          : _ProfileBody(peach: p),
    );
  }
}

class _ProfileBody extends ConsumerWidget {
  const _ProfileBody({required this.peach});

  final Peach peach;

  Future<void> _save(WidgetRef ref, Peach updated) =>
      ref.read(appContainerProvider).peaches.save(updated);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final capabilityCount =
        ref.watch(myCapabilitiesProvider).value?.length ?? 0;
    final crateCount = ref.watch(myCratesProvider).value?.length ?? 0;
    final canSignOut = ref
        .watch(authServiceProvider)
        .availableProviders
        .isNotEmpty;
    var i = 0;

    return PageScaffold(
      title: 'Profile',
      maxWidth: 640,
      children: [
        StaggeredEntrance(
          index: i++,
          child: TonalCard(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                ShapedAvatar.person(
                  id: peach.id,
                  name: peach.displayName,
                  size: 68,
                  color: scheme.primaryContainer,
                  foregroundColor: scheme.onPrimaryContainer,
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        peach.displayName,
                        style: theme.textTheme.titleLarge,
                      ),
                      Text(
                        [
                          ?peach.email,
                          '$crateCount ${crateCount == 1 ? 'Crate' : 'Crates'}',
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
          ),
        ),
        const PageSection('Fitness level'),
        StaggeredEntrance(
          index: i++,
          child: TonalCard(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      '${peach.fitnessLevel}',
                      style: theme.textTheme.headlineSmall?.copyWith(
                        color: scheme.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      peach.fitnessLevelLabel,
                      style: theme.textTheme.titleMedium,
                    ),
                  ],
                ),
                Slider(
                  value: peach.fitnessLevel.toDouble(),
                  min: 1,
                  max: 5,
                  divisions: 4,
                  label: '${peach.fitnessLevel}',
                  onChanged: (v) =>
                      _save(ref, peach.copyWith(fitnessLevel: v.round())),
                ),
                Text(
                  'Caps how hard your workouts are prescribed. Matchups use '
                  'the lower of the two Peaches.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
        const PageSection('Units'),
        StaggeredEntrance(
          index: i++,
          child: ConnectedButtonGroup<UnitSystem>(
            options: const [
              (UnitSystem.metric, 'Metric'),
              (UnitSystem.imperial, 'Imperial'),
            ],
            selected: peach.units,
            onChanged: (u) {
              if (u != null) _save(ref, peach.copyWith(units: u));
            },
          ),
        ),
        const PageSection('More'),
        StaggeredEntrance(
          index: i++,
          child: TonalListCard(
            children: [
              ListTile(
                leading: const Icon(Icons.fitness_center_outlined),
                title: Text('$capabilityCount exercises you can do'),
                subtitle: const Text('Manage them in the Exercises tab'),
              ),
              if (canSignOut)
                ListTile(
                  leading: const Icon(Icons.logout),
                  title: const Text('Sign out'),
                  subtitle: Text(peach.email ?? ''),
                  onTap: () => ref.read(authServiceProvider).signOut(),
                ),
              const ListTile(
                leading: Text('🍑', style: TextStyle(fontSize: 22)),
                title: Text('Peaches'),
                subtitle: Text('Version 0.1.0'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
