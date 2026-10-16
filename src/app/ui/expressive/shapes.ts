/**
 * Material 3 Expressive shapes, drawn as radial outlines.
 *
 * Each shape is a function from angle to radius: a circle modulated by
 * `lobes` smooth bumps of relative `depth`. That covers the M3 Expressive
 * "cookie", "clover", "sunny" and "burst" families, and because every shape
 * shares the parameterisation any two can be morphed by blending radii.
 */
export interface ExpressiveShape {
  readonly lobes: number;
  /** Bump depth as a fraction of the radius (0 is a circle). */
  readonly depth: number;
  /** Below 1 rounds the bumps into petals; above 1 sharpens them. */
  readonly sharpness: number;
  readonly rotation: number;
}

const shape = (lobes: number, depth: number, sharpness = 1, rotation = 0): ExpressiveShape => ({
  lobes,
  depth,
  sharpness,
  rotation,
});

export const EXPRESSIVE_SHAPES = {
  circle: shape(1, 0),
  cookie4: shape(4, 0.1),
  cookie6: shape(6, 0.09),
  cookie9: shape(9, 0.075),
  cookie12: shape(12, 0.06),
  clover4: shape(4, 0.28, 0.6, Math.PI / 4),
  clover8: shape(8, 0.16, 0.6),
  sunny: shape(8, 0.08, 2.2),
  softBurst: shape(10, 0.12, 1.6),
} as const satisfies Record<string, ExpressiveShape>;

export type ShapeName = keyof typeof EXPRESSIVE_SHAPES;

/** Shapes used for people and crates; one is picked per id. */
export const IDENTITY_SHAPES: readonly ShapeName[] = [
  'cookie9',
  'clover4',
  'sunny',
  'softBurst',
  'cookie6',
  'clover8',
];

/**
 * The identity shape for an id, so a Peach always wears the same shape.
 * A string hash over UTF-16 code units:
 * `fold(7, (h, c) => (h * 31 + c) & 0x7fffffff)`. `h * 31 + c` stays below
 * 2^36, exact in a double, and `& 0x7fffffff` keeps the low 31 bits, so the
 * result equals 64-bit integer arithmetic.
 */
export function shapeHash(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0x7fffffff;
  return h;
}

export function shapeForId(id: string): ShapeName {
  return IDENTITY_SHAPES[shapeHash(id) % IDENTITY_SHAPES.length];
}

/** Radius multiplier (0..1) at angle `theta`. */
export function radiusAt(s: ExpressiveShape, theta: number): number {
  if (s.depth === 0) return 1;
  const c = (Math.cos(s.lobes * (theta - s.rotation)) + 1) / 2;
  return 1 - s.depth + s.depth * Math.pow(c, s.sharpness);
}

/** Radius function of `a` blended towards `b` by `t` (may extrapolate). */
export function blendRadius(
  a: ExpressiveShape,
  b: ExpressiveShape,
  t: number,
): (theta: number) => number {
  return (theta) => {
    const ra = radiusAt(a, theta);
    return ra + (radiusAt(b, theta) - ra) * t;
  };
}

/**
 * A closed SVG path of the radial outline inside a `size`×`size` box,
 * starting at the top (−π/2) and going clockwise.
 */
export function shapePath(
  radius: ExpressiveShape | ((theta: number) => number),
  size: number,
  steps = 180,
): string {
  const fn = typeof radius === 'function' ? radius : (t: number) => radiusAt(radius, t);
  const c = size / 2;
  let d = '';
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI - Math.PI / 2;
    const r = c * fn(theta);
    const x = c + Math.cos(theta) * r;
    const y = c + Math.sin(theta) * r;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

const pathCache = new Map<string, string>();

/** Memoised [shapePath] for a named shape at a pixel size. */
export function namedShapePath(name: ShapeName, size: number): string {
  const key = `${name}@${size}`;
  let d = pathCache.get(key);
  if (!d) {
    d = shapePath(EXPRESSIVE_SHAPES[name], size);
    pathCache.set(key, d);
  }
  return d;
}

/** First user-perceived character (grapheme) of a name, or '?'. */
export function initialOf(name: string | null | undefined): string {
  const s = (name ?? '').trim();
  if (!s) return '?';
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) {
    const segments = new Seg(undefined, { granularity: 'grapheme' }).segment(s);
    const first = segments[Symbol.iterator]().next();
    if (!first.done) return first.value.segment;
  }
  return Array.from(s)[0];
}
