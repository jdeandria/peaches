/**
 * A hash that is identical on every device, browser and run.
 *
 * Anything two clients have to agree on (such as workout seeds) must be
 * derived from a stable function of its inputs. This is 32-bit FNV-1a over
 * the UTF-16 code units of `input`, low byte then high byte, returned as a
 * non-negative 31-bit integer.
 */
export function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    const unit = input.charCodeAt(i);
    hash ^= unit & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= unit >>> 8;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash & 0x7fffffff;
}
