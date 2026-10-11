/// A hash that is identical on every device, platform and run.
///
/// Dart's `Object.hash` and `String.hashCode` are deliberately not stable
/// across processes, so they must never feed anything that two clients have
/// to agree on (such as workout seeds). This is 32-bit FNV-1a over UTF-16
/// code units, returned as a non-negative int.
int stableHash(String input) {
  var hash = 0x811c9dc5;
  for (final unit in input.codeUnits) {
    hash ^= unit & 0xff;
    hash = (hash * 0x01000193) & 0xffffffff;
    hash ^= unit >> 8;
    hash = (hash * 0x01000193) & 0xffffffff;
  }
  return hash & 0x7fffffff;
}
