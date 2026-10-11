import 'package:flutter/material.dart';

import '../widgets/adaptive.dart';
import '../widgets/motion.dart';
import 'crates_screen.dart';
import 'exercise_library_screen.dart';
import 'profile_screen.dart';
import 'today_screen.dart';

/// The top-level shell. Navigation adapts to the M3 window size class:
/// a navigation bar on compact windows, a navigation rail on medium ones,
/// and an extended rail with labels on expanded windows.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, this.initialTab});

  final int? initialTab;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late int _index = (widget.initialTab ?? 0).clamp(0, 3);

  static const _items = [
    (Icons.today_outlined, Icons.today, 'Today'),
    (Icons.inventory_2_outlined, Icons.inventory_2, 'Crates'),
    (Icons.fitness_center_outlined, Icons.fitness_center, 'Exercises'),
    (Icons.person_outline, Icons.person, 'Profile'),
  ];

  Widget get _page => switch (_index) {
    0 => const TodayScreen(key: ValueKey('today')),
    1 => const CratesScreen(key: ValueKey('crates')),
    2 => const ExerciseLibraryScreen(key: ValueKey('exercises')),
    _ => const ProfileScreen(key: ValueKey('profile')),
  };

  @override
  Widget build(BuildContext context) {
    final size = WindowSize.of(context);
    final body = FadeThroughSwitcher(child: _page);

    if (size.isCompact) {
      return Scaffold(
        body: body,
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          destinations: [
            for (final (icon, selected, label) in _items)
              NavigationDestination(
                icon: Icon(icon),
                selectedIcon: Icon(selected),
                label: label,
              ),
          ],
        ),
      );
    }

    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            extended: size == WindowSize.expanded,
            minExtendedWidth: 200,
            backgroundColor: scheme.surfaceContainer,
            indicatorColor: scheme.secondaryContainer,
            selectedIndex: _index,
            onDestinationSelected: (i) => setState(() => _index = i),
            labelType: size == WindowSize.expanded
                ? NavigationRailLabelType.none
                : NavigationRailLabelType.all,
            leading: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                '🍑',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
            ),
            destinations: [
              for (final (icon, selected, label) in _items)
                NavigationRailDestination(
                  icon: Icon(icon),
                  selectedIcon: Icon(selected),
                  label: Text(label),
                ),
            ],
          ),
          Expanded(child: body),
        ],
      ),
    );
  }
}
