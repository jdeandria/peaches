import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../application/auth_service.dart';
import '../../application/crate_service.dart';

/// [AuthService] on Firebase Auth with Google, Apple and email providers.
///
/// Web uses Firebase's popup flows directly; mobile goes through the
/// native Google / Apple SDKs and exchanges their tokens for a Firebase
/// credential.
final class FirebaseAuthService implements AuthService {
  FirebaseAuthService(this._auth, {this._googleServerClientId});

  final fb.FirebaseAuth _auth;
  final String? _googleServerClientId;
  bool _googleInitialised = false;

  @override
  Stream<AuthUser?> authState() => _auth.authStateChanges().map(_toUser);

  @override
  AuthUser? get currentUser => _toUser(_auth.currentUser);

  @override
  Set<AuthProvider> get availableProviders => {
    AuthProvider.google,
    AuthProvider.email,
    if (kIsWeb ||
        defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS)
      AuthProvider.apple,
  };

  @override
  Future<AuthUser> signInWithGoogle() => _guard(() async {
    if (kIsWeb) {
      final result = await _auth.signInWithPopup(fb.GoogleAuthProvider());
      return result.user!;
    }
    final google = GoogleSignIn.instance;
    if (!_googleInitialised) {
      await google.initialize(serverClientId: _googleServerClientId);
      _googleInitialised = true;
    }
    final account = await google.authenticate();
    final credential = fb.GoogleAuthProvider.credential(
      idToken: account.authentication.idToken,
    );
    return (await _auth.signInWithCredential(credential)).user!;
  });

  @override
  Future<AuthUser> signInWithApple() => _guard(() async {
    if (kIsWeb) {
      final provider = fb.OAuthProvider('apple.com')
        ..addScope('email')
        ..addScope('name');
      return (await _auth.signInWithPopup(provider)).user!;
    }
    final rawNonce = _randomNonce();
    final apple = await SignInWithApple.getAppleIDCredential(
      scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
      nonce: sha256.convert(utf8.encode(rawNonce)).toString(),
    );
    final credential = fb.OAuthProvider('apple.com')
        .credential(idToken: apple.identityToken, rawNonce: rawNonce);
    final user = (await _auth.signInWithCredential(credential)).user!;
    // Apple only sends the name on the very first sign-in; keep it.
    final name = [
      apple.givenName,
      apple.familyName,
    ].nonNulls.where((s) => s.isNotEmpty).join(' ');
    if (name.isNotEmpty && (user.displayName ?? '').isEmpty) {
      await user.updateDisplayName(name);
    }
    return user;
  });

  @override
  Future<AuthUser> signInWithEmail({
    required String email,
    required String password,
  }) => _guard(
    () async => (await _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    )).user!,
  );

  @override
  Future<AuthUser> registerWithEmail({
    required String email,
    required String password,
    required String displayName,
  }) => _guard(() async {
    final result = await _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    await result.user!.updateDisplayName(displayName.trim());
    return result.user!;
  });

  @override
  Future<void> signOut() async {
    await _auth.signOut();
    if (!kIsWeb && _googleInitialised) await GoogleSignIn.instance.signOut();
  }

  Future<AuthUser> _guard(Future<fb.User> Function() action) async {
    try {
      final user = await action();
      return _toUser(user)!;
    } on fb.FirebaseAuthException catch (e) {
      throw DomainException(_message(e));
    } on SignInWithAppleAuthorizationException catch (e) {
      throw DomainException(
        e.code == AuthorizationErrorCode.canceled
            ? 'Sign in cancelled.'
            : 'Apple sign in failed: ${e.message}',
      );
    } on GoogleSignInException catch (e) {
      throw DomainException(
        e.code == GoogleSignInExceptionCode.canceled
            ? 'Sign in cancelled.'
            : 'Google sign in failed: ${e.description ?? e.code.name}',
      );
    }
  }

  static AuthUser? _toUser(fb.User? user) => user == null
      ? null
      : AuthUser(
          id: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoUrl: user.photoURL,
        );

  static String _message(fb.FirebaseAuthException e) => switch (e.code) {
    'invalid-email' => 'That email address is not valid.',
    'user-disabled' => 'This account has been disabled.',
    'user-not-found' ||
    'wrong-password' ||
    'invalid-credential' => 'Email or password is incorrect.',
    'email-already-in-use' => 'An account already exists for that email.',
    'weak-password' => 'Choose a longer password (at least 6 characters).',
    'popup-closed-by-user' || 'cancelled-popup-request' => 'Sign in cancelled.',
    'network-request-failed' => 'No network connection.',
    _ => e.message ?? 'Sign in failed (${e.code}).',
  };

  static String _randomNonce([int length = 32]) {
    const chars =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return String.fromCharCodes(
      List.generate(
        length,
        (_) => chars.codeUnitAt(random.nextInt(chars.length)),
      ),
    );
  }
}
