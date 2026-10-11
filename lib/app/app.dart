import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../application/providers.dart';
import '../presentation/expressive/loading_indicator.dart';
import 'router.dart';
import 'theme.dart';

class PeachesApp extends ConsumerStatefulWidget {
  const PeachesApp({super.key});

  @override
  ConsumerState<PeachesApp> createState() => _PeachesAppState();
}

class _PeachesAppState extends ConsumerState<PeachesApp> {
  final _authChanged = ValueNotifier<int>(0);
  late final GoRouter _router = createRouter(
    refresh: _authChanged,
    isSignedIn: () {
      final state = ref.read(authStateProvider);
      return state.hasValue ? state.value != null : null;
    },
  );

  @override
  void initState() {
    super.initState();
    // Only English strings ship today. Pinning the locale keeps `intl`
    // from throwing on browsers that report an unusual or empty locale.
    Intl.defaultLocale = 'en_US';
  }

  @override
  void dispose() {
    _router.dispose();
    _authChanged.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authStateProvider, (_, _) => _authChanged.value++);
    final booting =
        ref.watch(bootstrapProvider).isLoading &&
        ref.watch(authStateProvider).value != null;
    if (booting) {
      return MaterialApp(
        title: 'Peaches',
        theme: PeachesTheme.light(),
        darkTheme: PeachesTheme.dark(),
        home: const Scaffold(
          body: Center(child: ExpressiveLoadingIndicator(contained: true)),
        ),
      );
    }
    return MaterialApp.router(
      title: 'Peaches',
      theme: PeachesTheme.light(),
      darkTheme: PeachesTheme.dark(),
      routerConfig: _router,
    );
  }
}
