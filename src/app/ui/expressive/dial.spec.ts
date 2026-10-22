import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { M3Springs } from '../core/springs';
import { Dial, dialOffset, flingPlan, parseNumber, springStep } from './dial';

describe('Dial physics', () => {
  it('spreads labels out around the selection, evenly beyond it', () => {
    expect(dialOffset(0)).toBe(0);
    expect(dialOffset(-1.5)).toBe(-dialOffset(1.5));
    const gaps = [0, 1, 2, 3, 4].map((d) => dialOffset(d + 1) - dialOffset(d));
    expect(gaps[0]).toBeGreaterThan(gaps[1]);
    expect(gaps[1]).toBeCloseTo(gaps[2], 9);
    expect(gaps[2]).toBeCloseTo(gaps[3], 9);
  });

  it('settles gentle releases on the nearest step', () => {
    expect(flingPlan(10.3, 0, 0, 100)).toEqual({ target: 10, ms: 0 });
    expect(flingPlan(10.4, -2, 0, 100)).toEqual({ target: 10, ms: 0 });
  });

  it('glides further than in proportion the harder the fling', () => {
    const slow = flingPlan(50, 10, 0, 1000).target - 50;
    const fast = flingPlan(50, 40, 0, 1000).target - 50;
    const faster = flingPlan(50, 80, 0, 1000).target - 50;
    expect(slow).toBeGreaterThan(1);
    expect(fast / slow).toBeGreaterThan(4);
    expect(faster / fast).toBeGreaterThan(2);
    expect(flingPlan(50, -40, 0, 1000).target - 50).toBe(-fast);
  });

  it('lands on a whole step inside the range, in bounded time', () => {
    for (const v of [-300, -45, -8, 8, 45, 300]) {
      const plan = flingPlan(20.4, v, 0, 40);
      expect(Number.isInteger(plan.target)).toBe(true);
      expect(plan.target).toBeGreaterThanOrEqual(0);
      expect(plan.target).toBeLessThanOrEqual(40);
      expect(plan.ms).toBeLessThanOrEqual(1600);
    }
  });

  it('keeps the release speed: the glide time is twice distance over speed', () => {
    const { target, ms } = flingPlan(0, 20, 0, 1000);
    expect(ms).toBeCloseTo(((2 * target) / 20) * 1000, 6);
  });

  it('springs settle on their target', () => {
    let [x, v] = [0, 30];
    for (let i = 0; i < 120; i++) [x, v] = springStep(M3Springs.spatialDefault, x, v, 12, 1 / 60);
    expect(x).toBeCloseTo(12, 3);
    expect(Math.abs(v)).toBeLessThan(0.01);
  });

  it('reads typed numbers with a point or a comma', () => {
    expect(parseNumber(' 42.5 ')).toBe(42.5);
    expect(parseNumber('42,5')).toBe(42.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
});

@Component({
  imports: [Dial],
  template: `<pch-dial
    label="Weight in kg"
    unit="kg"
    [step]="2.5"
    [max]="200"
    [value]="value()"
    (valueChange)="changes.push($event); value.set($event)"
  />`,
})
class Host {
  readonly value = signal(60);
  readonly changes: number[] = [];
}

describe('Dial', () => {
  async function render(value = 60) {
    const f = TestBed.createComponent(Host);
    f.componentInstance.value.set(value);
    f.detectChanges();
    await f.whenStable();
    const slider = f.nativeElement.querySelector('[role="slider"]') as HTMLElement;
    return { f, host: f.componentInstance, slider, el: f.nativeElement as HTMLElement };
  }

  function press(target: HTMLElement, key: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    TestBed.tick();
  }

  it('is a labelled slider', async () => {
    const { slider } = await render();
    expect(slider.getAttribute('aria-label')).toBe('Weight in kg');
    expect(slider.getAttribute('aria-valuenow')).toBe('60');
    expect(slider.getAttribute('aria-valuetext')).toBe('60 kg');
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe('200');
    expect(slider.tabIndex).toBe(0);
  });

  it('steps with the arrow keys and jumps with Page Up/Down, Home and End', async () => {
    const { slider, host } = await render();
    press(slider, 'ArrowUp');
    press(slider, 'ArrowRight');
    press(slider, 'ArrowDown');
    press(slider, 'PageUp');
    press(slider, 'PageDown');
    press(slider, 'End');
    press(slider, 'Home');
    expect(host.changes).toEqual([62.5, 65, 62.5, 87.5, 62.5, 200, 0]);
    expect(slider.getAttribute('aria-valuenow')).toBe('0');
    // Nothing below the bottom.
    press(slider, 'ArrowDown');
    expect(host.changes).toHaveLength(7);
  });

  it('follows changes from outside without echoing them back', async () => {
    const { f, slider, host } = await render();
    host.value.set(100);
    f.detectChanges();
    expect(slider.getAttribute('aria-valuenow')).toBe('100');
    expect(host.changes).toEqual([]);
  });

  it('keeps a value between steps until it is moved, then steps to the grid', async () => {
    const { slider, host } = await render(61);
    expect(slider.getAttribute('aria-valuetext')).toBe('61 kg');
    press(slider, 'ArrowUp');
    expect(host.changes).toEqual([62.5]);
    host.changes.length = 0;
    const second = await render(61);
    press(second.slider, 'ArrowDown');
    expect(second.host.changes).toEqual([60]);
  });

  it('types an exact value: Enter (or a digit) opens the entry, Enter commits', async () => {
    const { el, slider, host } = await render();
    press(slider, 'Enter');
    const input = el.querySelector<HTMLInputElement>('input[aria-label="Weight in kg"]')!;
    expect(input.value).toBe('60');
    expect(input.getAttribute('inputmode')).toBe('decimal');
    input.value = '61.25';
    press(input, 'Enter');
    expect(host.changes).toEqual([61.25]);
    expect(el.querySelector('input')).toBeNull();

    press(slider, '7');
    const again = el.querySelector<HTMLInputElement>('input')!;
    expect(again.value).toBe('7');
    again.value = '500';
    press(again, 'Enter');
    // Clamped to the range.
    expect(host.changes).toEqual([61.25, 200]);
  });

  it('Escape and nonsense leave the value alone', async () => {
    const { el, slider, host } = await render();
    press(slider, 'Enter');
    el.querySelector<HTMLInputElement>('input')!.value = '99';
    press(el.querySelector('input')!, 'Escape');
    press(slider, 'Enter');
    el.querySelector<HTMLInputElement>('input')!.value = 'heavy';
    press(el.querySelector('input')!, 'Enter');
    expect(host.changes).toEqual([]);
    expect(slider.getAttribute('aria-valuenow')).toBe('60');
  });
});
