import { TestBed } from '@angular/core/testing';
import { M3Springs, springCurve, springDuration } from '../core/springs';
import { ReducedMotion } from '../core/motion';
import { signal } from '@angular/core';
import {
  blendRadius,
  EXPRESSIVE_SHAPES,
  IDENTITY_SHAPES,
  radiusAt,
  shapeForId,
  shapeHash,
  shapePath,
  initialOf,
} from './shapes';
import { ButtonGroup } from './button-group';
import { LoadingIndicator } from './loading-indicator';
import { WavyProgress, wavyGeometry } from './wavy-progress';
import { ShapedAvatar } from './shaped-avatar';

describe('M3 springs', () => {
  const all = Object.values(M3Springs);

  it('settles in a finite time and ends at 1', () => {
    for (const s of all) {
      expect(springDuration(s)).toBeGreaterThanOrEqual(50);
      expect(springDuration(s)).toBeLessThanOrEqual(3000);
      const c = springCurve(s);
      expect(c(0)).toBe(0);
      expect(c(1)).toBeCloseTo(1, 2);
    }
  });

  it('spatial springs overshoot slightly, effects springs do not', () => {
    const peak = (s: (typeof all)[number]) => {
      const c = springCurve(s);
      let max = 0;
      for (let t = 0; t <= 1; t += 0.01) max = Math.max(max, c(t));
      return max;
    };
    expect(peak(M3Springs.spatialDefault)).toBeGreaterThan(1);
    expect(peak(M3Springs.spatialDefault)).toBeLessThan(1.1);
    expect(peak(M3Springs.effectsDefault)).toBeLessThanOrEqual(1.001);
  });

  it('slow springs take longer than fast ones', () => {
    expect(springDuration(M3Springs.spatialSlow)).toBeGreaterThan(
      springDuration(M3Springs.spatialFast),
    );
  });
});

describe('Expressive shapes', () => {
  it('radius stays within the bounding circle', () => {
    for (const s of [
      ...IDENTITY_SHAPES.map((n) => EXPRESSIVE_SHAPES[n]),
      EXPRESSIVE_SHAPES.circle,
    ]) {
      for (let i = 0; i < 360; i++) {
        const r = radiusAt(s, (i * Math.PI) / 180);
        expect(r).toBeGreaterThanOrEqual(1 - s.depth - 1e-9);
        expect(r).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('forId uses the stable hash (fold 7, h * 31 + c, & 0x7fffffff)', () => {
    // Expected values computed with 64-bit BigInt arithmetic.
    const cases: [string, number, string][] = [
      ['a', 314, 'sunny'],
      ['ada', 304951, 'clover4'],
      ['e', 318, 'cookie9'],
      ['peach-123', 1103385775, 'clover4'],
      ['uid_9fKq2LxA', 1221774156, 'cookie9'],
      ['Zoë', 298703, 'clover8'],
      ['🍑', 1779932, 'sunny'], // hashed as UTF-16 code units
    ];
    for (const [id, hash, shape] of cases) {
      expect(shapeHash(id)).toBe(hash);
      expect(shapeForId(id)).toBe(shape);
    }
  });

  it('identity shape is stable per id and varies across ids', () => {
    expect(shapeForId('ada')).toBe(shapeForId('ada'));
    const shapes = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(shapeForId));
    expect(shapes.size).toBeGreaterThan(2);
  });

  it('blending interpolates radii between two shapes', () => {
    const a = EXPRESSIVE_SHAPES.circle;
    const b = EXPRESSIVE_SHAPES.clover4;
    const mid = blendRadius(a, b, 0.5);
    for (let i = 0; i < 36; i++) {
      const theta = (i * Math.PI) / 18;
      expect(mid(theta)).toBeCloseTo((radiusAt(a, theta) + radiusAt(b, theta)) / 2, 9);
    }
  });

  it('produces a closed path inside its box', () => {
    const d = shapePath(EXPRESSIVE_SHAPES.cookie9, 100);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(-0.5);
    expect(Math.max(...nums)).toBeLessThanOrEqual(100.5);
  });

  it('initialOf takes the first grapheme', () => {
    expect(initialOf('Ada')).toBe('A');
    expect(initialOf('')).toBe('?');
    expect(initialOf('🍑 Peach')).toBe('🍑');
  });
});

describe('ShapedAvatar', () => {
  it('shows the initial, picks the identity shape and is decorative', async () => {
    const f = TestBed.createComponent(ShapedAvatar);
    f.componentRef.setInput('shapeId', 'ada');
    f.componentRef.setInput('name', 'Ada');
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.textContent?.trim()).toBe('A');
    expect(el.dataset['shape']).toBe('clover4');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    f.componentRef.setInput('label', 'Ada');
    await f.whenStable();
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Ada');
  });
});

describe('ButtonGroup', () => {
  const options = [
    { value: 1, label: 'One' },
    { value: 2, label: 'Two' },
    { value: 3, label: 'Three' },
  ];

  async function setup(allowDeselect: boolean) {
    const f = TestBed.createComponent(ButtonGroup<number>);
    f.componentRef.setInput('options', options);
    f.componentRef.setInput('allowDeselect', allowDeselect);
    f.componentRef.setInput('label', 'Count');
    const changes: (number | null)[] = [];
    f.componentInstance.selectionChange.subscribe((v) => changes.push(v));
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>('button'));
    return { f, el, buttons, changes };
  }

  it('is a labelled radiogroup with one tab stop', async () => {
    const { el, buttons } = await setup(false);
    expect(el.getAttribute('role')).toBe('radiogroup');
    expect(el.getAttribute('aria-label')).toBe('Count');
    expect(buttons().map((b) => b.getAttribute('role'))).toEqual(['radio', 'radio', 'radio']);
    expect(buttons().map((b) => b.tabIndex)).toEqual([0, -1, -1]);
  });

  it('selects, and deselects when allowed', async () => {
    const { f, buttons, changes } = await setup(true);
    buttons()[1].click();
    await f.whenStable();
    expect(f.componentInstance.selected()).toBe(2);
    expect(buttons()[1].getAttribute('aria-checked')).toBe('true');
    expect(buttons()[1].tabIndex).toBe(0);
    buttons()[1].click();
    await f.whenStable();
    expect(f.componentInstance.selected()).toBeNull();
    expect(changes).toEqual([2, null]);
  });

  it('keeps the selection when deselect is not allowed', async () => {
    const { f, buttons, changes } = await setup(false);
    buttons()[0].click();
    buttons()[0].click();
    await f.whenStable();
    expect(f.componentInstance.selected()).toBe(1);
    expect(changes).toEqual([1]);
  });

  it('moves and selects with arrow keys, Home and End', async () => {
    const { f, el, buttons } = await setup(false);
    const key = async (k: string) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      await f.whenStable();
    };
    buttons()[0].focus();
    await key('ArrowRight');
    expect(f.componentInstance.selected()).toBe(2);
    expect(document.activeElement).toBe(buttons()[1]);
    await key('End');
    expect(f.componentInstance.selected()).toBe(3);
    await key('ArrowRight'); // wraps
    expect(f.componentInstance.selected()).toBe(1);
    await key('ArrowLeft');
    expect(f.componentInstance.selected()).toBe(3);
    await key('Home');
    expect(f.componentInstance.selected()).toBe(1);
  });
});

describe('WavyProgress', () => {
  it('is decorative unless labelled', async () => {
    const f = TestBed.createComponent(WavyProgress);
    f.componentRef.setInput('value', 0.4);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('role')).toBeNull();
    f.componentRef.setInput('label', 'Progress');
    await f.whenStable();
    expect(el.getAttribute('role')).toBe('progressbar');
    expect(el.getAttribute('aria-label')).toBe('Progress');
    expect(el.getAttribute('aria-valuenow')).toBe('40');
  });

  it('draws a wave, a gapped track and a stop dot; flat and dotless at 1', () => {
    const half = wavyGeometry(200, 0.5, 0);
    expect(half.wave).toMatch(/^M2 6/);
    expect(half.track).toEqual([108, 198]);
    expect(half.dot).toBe(198);
    const full = wavyGeometry(200, 1, 0.3);
    expect(full.dot).toBeNull();
    expect(full.track).toBeNull();
    // Amplitude settles to 0 at 1: every y is the midline.
    expect(full.wave!.match(/ (\d+\.\d+)/g)!.every((y) => Number(y) === 6)).toBe(true);
    expect(wavyGeometry(200, 0, 0).wave).toBeNull();
  });
});

describe('LoadingIndicator', () => {
  it('is labelled and holds still under reduced motion', async () => {
    TestBed.overrideProvider(ReducedMotion, { useValue: { reduced: signal(true) } });
    const f = TestBed.createComponent(LoadingIndicator);
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.getAttribute('role')).toBe('progressbar');
    expect(el.getAttribute('aria-label')).toBe('Loading');
    expect(f.componentInstance.animating).toBe(false);
    expect(el.querySelector('path')?.getAttribute('d')).toMatch(/^M.*Z$/);
  });
});
