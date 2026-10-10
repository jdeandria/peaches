import 'dart:math';

/// Source of unique identifiers. Abstracted so tests can produce stable ids.
abstract interface class IdGenerator {
  String newId();
}

/// Deterministic ids (`prefix-1`, `prefix-2`, ...) for tests and seeding.
final class SequentialIdGenerator implements IdGenerator {
  SequentialIdGenerator({this.prefix = 'id'});

  final String prefix;
  int _next = 0;

  @override
  String newId() => '$prefix-${++_next}';
}

/// Random, URL-safe ids (120 bits of entropy) suitable for document keys.
final class RandomIdGenerator implements IdGenerator {
  RandomIdGenerator([Random? random]) : _random = random ?? Random.secure();

  static const _alphabet =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  final Random _random;

  @override
  String newId() => String.fromCharCodes(
    List.generate(
      20,
      (_) => _alphabet.codeUnitAt(_random.nextInt(_alphabet.length)),
    ),
  );
}
