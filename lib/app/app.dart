import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'router.dart';
import 'theme.dart';

class PeachesApp extends StatefulWidget {
  const PeachesApp({super.key});

  @override
  State<PeachesApp> createState() => _PeachesAppState();
}

class _PeachesAppState extends State<PeachesApp> {
  late final GoRouter _router = createRouter();

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Peaches',
      theme: PeachesTheme.light(),
      darkTheme: PeachesTheme.dark(),
      routerConfig: _router,
    );
  }
}
