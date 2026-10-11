import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/auth_service.dart';
import '../../application/providers.dart';
import '../widgets/async_view.dart';
import '../widgets/tonal_card.dart';

/// Sign in or create an account. Providers shown depend on the platform.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _creating = false;
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _run(Future<AuthUser> Function(AuthService auth) action) async {
    setState(() => _busy = true);
    try {
      await action(ref.read(authServiceProvider));
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final providers = ref.watch(authServiceProvider).availableProviders;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    '🍑',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 64),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Peaches',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineMedium,
                  ),
                  Text(
                    'Log workouts. Compete with your Crate.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 32),
                  TonalCard(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (providers.contains(AuthProvider.google))
                          FilledButton.tonalIcon(
                            onPressed: _busy
                                ? null
                                : () => _run((a) => a.signInWithGoogle()),
                            icon: const Icon(Icons.g_mobiledata),
                            label: const Text('Continue with Google'),
                          ),
                        if (providers.contains(AuthProvider.apple)) ...[
                          const SizedBox(height: 8),
                          FilledButton.tonalIcon(
                            onPressed: _busy
                                ? null
                                : () => _run((a) => a.signInWithApple()),
                            icon: const Icon(Icons.apple),
                            label: const Text('Continue with Apple'),
                          ),
                        ],
                        if (providers.contains(AuthProvider.email)) ...[
                          const SizedBox(height: 24),
                          if (_creating) ...[
                            TextField(
                              controller: _name,
                              textCapitalization: TextCapitalization.words,
                              decoration: const InputDecoration(
                                labelText: 'Display name',
                              ),
                            ),
                            const SizedBox(height: 12),
                          ],
                          TextField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            autocorrect: false,
                            decoration: const InputDecoration(
                              labelText: 'Email',
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _password,
                            obscureText: true,
                            decoration: const InputDecoration(
                              labelText: 'Password',
                            ),
                            onSubmitted: (_) => _submitEmail(),
                          ),
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: _busy ? null : _submitEmail,
                            child: Text(
                              _creating ? 'Create account' : 'Sign in',
                            ),
                          ),
                          TextButton(
                            onPressed: _busy
                                ? null
                                : () => setState(() => _creating = !_creating),
                            child: Text(
                              _creating
                                  ? 'Have an account? Sign in'
                                  : 'New here? Create an account',
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _submitEmail() => _run(
    (a) => _creating
        ? a.registerWithEmail(
            email: _email.text,
            password: _password.text,
            displayName: _name.text,
          )
        : a.signInWithEmail(email: _email.text, password: _password.text),
  );
}
