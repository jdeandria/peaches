import 'dart:async';

/// A tiny observable key-value store backing the in-memory repositories.
///
/// Every mutation emits the full snapshot on [changes]; repositories map
/// that into the query-shaped streams the domain expects.
final class InMemoryStore<T> {
  InMemoryStore(this._keyOf);

  final String Function(T) _keyOf;
  final Map<String, T> _items = {};
  final StreamController<Map<String, T>> _changes =
      StreamController.broadcast();

  Iterable<T> get values => _items.values;

  T? get(String key) => _items[key];

  void put(T item) {
    _items[_keyOf(item)] = item;
    _emit();
  }

  void putAll(Iterable<T> items) {
    for (final item in items) {
      _items[_keyOf(item)] = item;
    }
    _emit();
  }

  void remove(String key) {
    _items.remove(key);
    _emit();
  }

  Iterable<T> where(bool Function(T) test) => _items.values.where(test);

  /// A stream that emits the current result of [query] immediately and
  /// again after every change.
  Stream<R> watch<R>(R Function(Iterable<T> values) query) async* {
    yield query(_items.values);
    yield* _changes.stream.map((items) => query(items.values));
  }

  void _emit() {
    if (!_changes.isClosed) _changes.add(Map.unmodifiable(_items));
  }

  void dispose() => _changes.close();
}
