import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/app/app.dart';
import 'package:peaches/application/app_container.dart';
import 'package:peaches/application/auth_service.dart';
import 'package:peaches/application/crate_service.dart';
import 'package:peaches/application/providers.dart';
import 'package:peaches/domain/core/ids.dart';

/// An auth service that starts signed out and signs in with email only.
final class _FakeAuth implements AuthService {
  final _controller = StreamController<AuthUser?>.broadcast();
  AuthUser? _user;
  int emailAttempts = 0;

  @override
  Stream<AuthUser?> authState() async* {
    yield _user;
    yield* _controller.stream;
  }

  @override
  AuthUser? get currentUser => _user;

  @override
  Set<AuthProvider> get availableProviders => const {AuthProvider.email};

  @override
  Future<AuthUser> signInWithGoogle() => throw UnimplementedError();

  @override
  Future<AuthUser> signInWithApple() => throw UnimplementedError();

  @override
  Future<AuthUser> signInWithEmail({
    required String email,
    required String password,
  }) async {
    emailAttempts++;
    if (password != 'secret') {
      throw const DomainException('Email or password is incorrect.');
    }
    _user = AuthUser(id: 'u1', email: email, displayName: 'Uma');
    _controller.add(_user);
    return _user!;
  }

  @override
  Future<AuthUser> registerWithEmail({
    required String email,
    required String password,
    required String displayName,
  }) => signInWithEmail(email: email, password: password);

  @override
  Future<void> signOut() async {
    _user = null;
    _controller.add(null);
  }
}

void main() {
  testWidgets('signed-out users see sign in; signing in creates a Peach', (
    tester,
  ) async {
    final auth = _FakeAuth();
    final container = AppContainer.inMemory(
      ids: SequentialIdGenerator(prefix: 'a'),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appContainerProvider.overrideWithValue(container),
          authServiceProvider.overrideWithValue(auth),
        ],
        child: const PeachesApp(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('Today'), findsNothing);

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'uma@example.com');
    await tester.enterText(fields.at(1), 'wrong');
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    expect(find.text('Email or password is incorrect.'), findsOneWidget);
    expect(auth.emailAttempts, 1);

    await tester.enterText(fields.at(1), 'secret');
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    expect(find.text('Today'), findsWidgets);
    final peach = await container.peaches.getById('u1');
    expect(peach?.displayName, 'Uma');
    expect(peach?.email, 'uma@example.com');

    // Sign out from the profile tab returns to the sign-in screen.
    await tester.tap(find.byIcon(Icons.person_outline));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Sign out'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.ensureVisible(find.text('Sign out'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    expect(auth.currentUser, isNull);
    expect(find.text('Sign in'), findsOneWidget);
  });
}
