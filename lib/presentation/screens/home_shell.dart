import 'package:flutter/material.dart';

import '../widgets/motion.dart';

import 'crates_screen.dart';
import 'exercise_library_screen.dart';
import 'profile_screen.dart';
import 'today_screen.dart';

/// Bottom-navigation shell holding the four top-level destinations.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, this.initialTab});

  final int? initialTab;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late int _index = (widget.initialTab ?? 0).clamp(0, 3);

  static const _destinations = [
    NavigationDestination(
      icon: Icon(Icons.today_outlined),
      selectedIcon: Icon(Icons.today),
      label: 'Today',
    ),
    NavigationDestination(
      icon: Icon(Icons.inventory_2_outlined),
      selectedIcon: Icon(Icons.inventory_2),
      label: 'Crates',
    ),
    NavigationDestination(
      icon: Icon(Icons.fitness_center_outlined),
      selectedIcon: Icon(Icons.fitness_center),
      label: 'Exercises',
    ),
    NavigationDestination(
      icon: Icon(Icons.person_outline),
      selectedIcon: Icon(Icons.person),
      label: 'Profile',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FadeThroughSwitcher(
        child: switch (_index) {
          0 => const TodayScreen(key: ValueKey('today')),
          1 => const CratesScreen(key: ValueKey('crates')),
          2 => const ExerciseLibraryScreen(key: ValueKey('exercises')),
          _ => const ProfileScreen(key: ValueKey('profile')),
        },
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: _destinations,
      ),
    );
  }
}
