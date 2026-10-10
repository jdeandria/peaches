/// Shared JSON helpers used by every serialisable domain model.
///
/// Models serialise by hand (no code generation) so the domain layer stays a
/// plain Dart package with a tiny dependency surface. These helpers keep that
/// code DRY and make enum handling consistent and forward compatible.
library;

typedef JsonMap = Map<String, Object?>;

/// Looks up an enum value by its [Enum.name], returning [fallback] (or
/// throwing a [FormatException]) when the stored name is unknown. Unknown
/// names can appear when an older client reads data written by a newer one.
T enumFromJson<T extends Enum>(List<T> values, Object? raw, {T? fallback}) {
  if (raw is String) {
    for (final value in values) {
      if (value.name == raw) return value;
    }
  }
  if (fallback != null) return fallback;
  throw FormatException('Unknown enum value "$raw" for $T');
}

/// Decodes a list of enum names, silently dropping unknown names.
List<T> enumListFromJson<T extends Enum>(List<T> values, Object? raw) {
  if (raw is! List) return const [];
  final out = <T>[];
  for (final item in raw) {
    if (item is! String) continue;
    for (final value in values) {
      if (value.name == item) {
        out.add(value);
        break;
      }
    }
  }
  return out;
}

List<String> enumListToJson(Iterable<Enum> values) =>
    values.map((e) => e.name).toList(growable: false);

List<String> stringListFromJson(Object? raw) =>
    raw is List ? raw.whereType<String>().toList(growable: false) : const [];

List<JsonMap> mapListFromJson(Object? raw) => raw is List
    ? raw
          .whereType<Map<Object?, Object?>>()
          .map((m) => m.cast<String, Object?>())
          .toList()
    : const [];

DateTime dateTimeFromJson(Object? raw) => DateTime.parse(raw as String).toUtc();

DateTime? dateTimeOrNullFromJson(Object? raw) =>
    raw == null ? null : dateTimeFromJson(raw);

String dateTimeToJson(DateTime value) => value.toUtc().toIso8601String();

double doubleFromJson(Object? raw, {double fallback = 0}) =>
    raw is num ? raw.toDouble() : fallback;

int intFromJson(Object? raw, {int fallback = 0}) =>
    raw is num ? raw.toInt() : fallback;
