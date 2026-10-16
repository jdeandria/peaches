import { BehaviorSubject, map, Observable } from 'rxjs';

/**
 * A tiny observable key-value store backing the in-memory repositories.
 *
 * Every mutation bumps a revision; `watch` re-runs its query against the
 * current values on subscribe and after every change, which is how the
 * repositories provide their query-shaped streams. Values are immutable
 * domain objects, so handing out references is safe.
 */
export class InMemoryStore<T> {
  private readonly items = new Map<string, T>();
  private readonly revision = new BehaviorSubject(0);

  constructor(private readonly keyOf: (item: T) => string) {}

  /** Emits on subscribe and after every mutation. */
  readonly changes: Observable<void> = this.revision.pipe(map(() => undefined));

  get values(): T[] {
    return [...this.items.values()];
  }

  get(key: string): T | null {
    return this.items.get(key) ?? null;
  }

  put(item: T): void {
    this.items.set(this.keyOf(item), item);
    this.bump();
  }

  putAll(items: Iterable<T>): void {
    for (const item of items) this.items.set(this.keyOf(item), item);
    this.bump();
  }

  remove(key: string): void {
    this.items.delete(key);
    this.bump();
  }

  where(test: (item: T) => boolean): T[] {
    return this.values.filter(test);
  }

  /** The current result of `query`, now and after every change. */
  watch<R>(query: (values: T[]) => R): Observable<R> {
    return this.changes.pipe(map(() => query(this.values)));
  }

  private bump(): void {
    this.revision.next(this.revision.value + 1);
  }
}
