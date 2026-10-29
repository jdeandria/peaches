import { DOCUMENT, Injectable, inject } from '@angular/core';
import { ViewportScroller } from '@angular/common';

/**
 * The router's scrolling, aimed at the shell's `main`: the window never
 * scrolls in the app (the shell is fixed to the screen, like a native app,
 * and only `main` scrolls), so new pages start at the top and Back puts
 * you where you were in `main`. Falls back to the document outside the
 * shell (sign-in).
 */
@Injectable()
export class MainViewportScroller extends ViewportScroller {
  private readonly document = inject(DOCUMENT);
  private offset: () => [number, number] = () => [0, 0];

  private target(): Element {
    return (
      this.document.getElementById('main') ??
      this.document.scrollingElement ??
      this.document.documentElement
    );
  }

  override setOffset(offset: [number, number] | (() => [number, number])): void {
    this.offset = Array.isArray(offset) ? () => offset : offset;
  }

  override getScrollPosition(): [number, number] {
    const t = this.target();
    return [t.scrollLeft, t.scrollTop];
  }

  override scrollToPosition([left, top]: [number, number], options?: ScrollOptions): void {
    scroll(this.target(), left, top, options);
  }

  override scrollToAnchor(anchor: string, options?: ScrollOptions): void {
    const el = this.document.getElementById(anchor) ?? this.document.getElementsByName(anchor)[0];
    if (!el) return;
    const t = this.target();
    const [left, top] = this.offset();
    const box = el.getBoundingClientRect();
    const frame = t.getBoundingClientRect();
    scroll(
      t,
      box.left - frame.left + t.scrollLeft - left,
      box.top - frame.top + t.scrollTop - top,
      options,
    );
  }

  override setHistoryScrollRestoration(scrollRestoration: 'auto' | 'manual'): void {
    try {
      history.scrollRestoration = scrollRestoration;
    } catch {
      // Not supported here.
    }
  }
}

function scroll(t: Element, left: number, top: number, options?: ScrollOptions): void {
  if (typeof t.scrollTo === 'function') {
    t.scrollTo({ left, top, behavior: options?.behavior });
  } else {
    t.scrollLeft = left;
    t.scrollTop = top;
  }
}
