import 'package:animations/animations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../presentation/screens/crate_detail_screen.dart';
import '../presentation/screens/home_shell.dart';
import '../presentation/screens/matchup_screen.dart';
import '../presentation/screens/sign_in_screen.dart';
import '../presentation/widgets/motion.dart';

/// Route names, so screens navigate by name rather than by string path.
abstract final class Routes {
  static const home = 'home';
  static const crate = 'crate';
  static const matchup = 'matchup';
  static const signIn = 'signIn';
  static const signInPath = '/sign-in';
}

/// [isSignedIn] is re-read whenever [refresh] notifies; null means the
/// auth state is still unknown, in which case navigation is left alone.
GoRouter createRouter({
  String initialLocation = '/',
  Listenable? refresh,
  bool? Function()? isSignedIn,
}) => GoRouter(
  initialLocation: initialLocation,
  refreshListenable: refresh,
  redirect: (context, state) {
    final signedIn = isSignedIn?.call();
    if (signedIn == null) return null;
    final atSignIn = state.matchedLocation == Routes.signInPath;
    if (!signedIn && !atSignIn) return Routes.signInPath;
    if (signedIn && atSignIn) return '/';
    return null;
  },
  routes: [
    GoRoute(
      name: Routes.signIn,
      path: Routes.signInPath,
      pageBuilder: (context, state) =>
          FadeThroughPage(key: state.pageKey, child: const SignInScreen()),
    ),
    GoRoute(
      name: Routes.home,
      path: '/',
      pageBuilder: (context, state) => FadeThroughPage(
        key: state.pageKey,
        child: HomeShell(
          initialTab: int.tryParse(state.uri.queryParameters['tab'] ?? ''),
        ),
      ),
      routes: [
        GoRoute(
          name: Routes.crate,
          path: 'crates/:crateId',
          pageBuilder: (context, state) => SharedAxisPage(
            key: state.pageKey,
            child: CrateDetailScreen(crateId: state.pathParameters['crateId']!),
          ),
        ),
        GoRoute(
          name: Routes.matchup,
          path: 'matchups/:matchupId',
          pageBuilder: (context, state) => SharedAxisPage(
            key: state.pageKey,
            type: SharedAxisTransitionType.scaled,
            child: MatchupScreen(matchupId: state.pathParameters['matchupId']!),
          ),
        ),
      ],
    ),
  ],
  errorBuilder: (context, state) => Scaffold(
    appBar: AppBar(title: const Text('Not found')),
    body: Center(child: Text(state.error?.toString() ?? 'Unknown route')),
  ),
);
