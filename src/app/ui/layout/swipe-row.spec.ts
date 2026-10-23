import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwipeRow } from './swipe-row';

@Component({
  imports: [SwipeRow],
  template: `<pch-swipe-row
    [editable]="editable"
    removable
    (edit)="events.push('edit')"
    (remove)="events.push('remove')"
  >
    <button type="button" class="row" (click)="events.push('click')">Squat</button>
  </pch-swipe-row>`,
})
class Host {
  editable = true;
  readonly events: string[] = [];
}

describe('SwipeRow', () => {
  async function render(editable = true) {
    const f = TestBed.createComponent(Host);
    f.componentInstance.editable = editable;
    f.detectChanges();
    await f.whenStable();
    const content = f.nativeElement.querySelector('.content') as HTMLElement;
    return { f, host: f.componentInstance, content, el: f.nativeElement as HTMLElement };
  }

  /** A finger (or a mouse) pressing at x=200, moving by each of `moves`, then lifting. */
  function swipe(target: HTMLElement, moves: number[], pointerType = 'touch', lift = true): void {
    let t = 0;
    const fire = (type: string, x: number) => {
      const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 100, button: 0 });
      Object.defineProperties(e, {
        pointerId: { value: 1 },
        pointerType: { value: pointerType },
        timeStamp: { value: (t += 16) },
      });
      target.dispatchEvent(e);
    };
    fire('pointerdown', 200);
    for (const dx of moves) fire('pointermove', 200 + dx);
    if (lift) fire('pointerup', 200 + (moves.at(-1) ?? 0));
    TestBed.tick();
  }

  const slowly = (to: number) => Array.from({ length: 10 }, (_, i) => ((i + 1) * to) / 10);

  it('follows the finger and springs back from a short swipe', async () => {
    const { content, host, f } = await render();
    swipe(content, [-20, -40], 'touch', false);
    f.detectChanges();
    expect(content.style.transform).toBe('translateX(-40px)');
    swipe(content, [-60]);
    f.detectChanges();
    expect(content.style.transform).toBe('translateX(0px)');
    expect(host.events).toEqual([]);
  });

  it('swiping far right edits, and the release is not a tap', async () => {
    const { content, host, el } = await render();
    swipe(content, slowly(160));
    el.querySelector<HTMLButtonElement>('.row')!.click();
    expect(host.events).toEqual(['edit']);
    // A plain tap afterwards still is one.
    el.querySelector<HTMLButtonElement>('.row')!.click();
    expect(host.events).toEqual(['edit', 'click']);
  });

  it('swiping far left slides the row away, then removes', async () => {
    vi.useFakeTimers();
    try {
      const { content, host } = await render();
      swipe(content, slowly(-160));
      expect(host.events).toEqual([]);
      vi.advanceTimersByTime(200);
      expect(host.events).toEqual(['remove']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a quick flick acts from a shorter swipe', async () => {
    const { content, host } = await render();
    swipe(content, [30, 60]);
    expect(host.events).toEqual(['edit']);
  });

  it('only gives a little towards a disabled action, and a mouse drag is not a swipe', async () => {
    const { content, host, f } = await render(false);
    swipe(content, [60], 'touch', false);
    f.detectChanges();
    expect(content.style.transform).toBe('translateX(10px)');
    swipe(content, slowly(200));
    expect(host.events).toEqual([]);
    swipe(content, slowly(-200), 'mouse');
    f.detectChanges();
    expect(content.style.transform).toBe('translateX(0px)');
  });

  it('a vertical drag is left to scroll', async () => {
    const { content, f } = await render();
    const fire = (type: string, x: number, y: number) => {
      const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
      Object.defineProperties(e, { pointerId: { value: 1 }, pointerType: { value: 'touch' } });
      content.dispatchEvent(e);
    };
    fire('pointerdown', 200, 100);
    fire('pointermove', 205, 140);
    fire('pointermove', 260, 180);
    f.detectChanges();
    expect(content.style.transform).toBe('translateX(0px)');
  });
});
