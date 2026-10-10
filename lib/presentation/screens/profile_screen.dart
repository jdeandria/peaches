import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/providers.dart';
import '../../application/season_service.dart';
import '../../domain/models/peach.dart';
import '../../domain/models/training.dart';
import '../widgets/async_view.dart';

/// The current Peach's settings.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final peach = ref.watch(currentPeachProvider);
    final capabilities = ref.watch(myCapabilitiesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: AsyncView(
        value: peach,
        data: (p) => p == null
            ? const EmptyState(
                icon: Icons.person_off_outlined,
                title: 'Not signed in',
              )
            : _ProfileBody(
                peach: p,
                capabilityCount: capabilities.value?.length ?? 0,
              ),
      ),
    );
  }
}

class _ProfileBody extends ConsumerWidget {
  const _ProfileBody({required this.peach, required this.capabilityCount});

  final Peach peach;
  final int capabilityCount;

  Future<void> _save(WidgetRef ref, Peach updated) =>
      ref.read(appContainerProvider).peaches.save(updated);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return ListView(
      children: [
        const SizedBox(height: 16),
        Center(
          child: CircleAvatar(
            radius: 40,
            child: Text(
              peach.displayName[0],
              style: theme.textTheme.headlineMedium,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: Text(peach.displayName, style: theme.textTheme.titleLarge),
        ),
        const SectionHeader('Fitness level'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${peach.fitnessLevel} · ${peach.fitnessLevelLabel}',
                style: theme.textTheme.bodyLarge,
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
                'Your level caps how hard your workouts are prescribed. '
                'Matchups use the lower of the two Peaches.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        const SectionHeader('Units'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SegmentedButton<UnitSystem>(
            segments: const [
              ButtonSegment(value: UnitSystem.metric, label: Text('Metric')),
              ButtonSegment(
                value: UnitSystem.imperial,
                label: Text('Imperial'),
              ),
            ],
            selected: {peach.units},
            onSelectionChanged: (s) =>
                _save(ref, peach.copyWith(units: s.first)),
          ),
        ),
        const SectionHeader('Exercises'),
        ListTile(
          leading: const Icon(Icons.fitness_center_outlined),
          title: Text('$capabilityCount exercises you can do'),
          subtitle: const Text('Manage them in the Exercises tab'),
        ),
        if (ref.watch(authServiceProvider).availableProviders.isNotEmpty) ...[
          const SectionHeader('Account'),
          ListTile(
            leading: const Icon(Icons.logout),
            title: const Text('Sign out'),
            subtitle: Text(peach.email ?? ''),
            onTap: () => ref.read(authServiceProvider).signOut(),
          ),
        ],
        const SectionHeader('About'),
        const ListTile(
          leading: Icon(Icons.info_outline),
          title: Text('Peaches'),
          subtitle: Text('Version 0.1.0'),
        ),
      ],
    );
  }
}
