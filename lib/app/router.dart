import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../presentation/screens/crate_detail_screen.dart';
import '../presentation/screens/home_shell.dart';
import '../presentation/screens/matchup_screen.dart';

/// Route names, so screens navigate by name rather than by string path.
abstract final class Routes {
  static const home = 'home';
  static const crate = 'crate';
  static const matchup = 'matchup';
}

GoRouter createRouter({String initialLocation = '/'}) => GoRouter(
  initialLocation: initialLocation,
  routes: [
    GoRoute(
      name: Routes.home,
      path: '/',
      builder: (context, state) => HomeShell(
        initialTab: int.tryParse(state.uri.queryParameters['tab'] ?? ''),
      ),
      routes: [
        GoRoute(
          name: Routes.crate,
          path: 'crates/:crateId',
          builder: (context, state) =>
              CrateDetailScreen(crateId: state.pathParameters['crateId']!),
        ),
        GoRoute(
          name: Routes.matchup,
          path: 'matchups/:matchupId',
          builder: (context, state) =>
              MatchupScreen(matchupId: state.pathParameters['matchupId']!),
        ),
      ],
    ),
  ],
  errorBuilder: (context, state) => Scaffold(
    appBar: AppBar(title: const Text('Not found')),
    body: Center(child: Text(state.error?.toString() ?? 'Unknown route')),
  ),
);
