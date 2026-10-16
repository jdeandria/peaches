/** Source of unique identifiers. Abstracted so tests can produce stable ids. */
export interface IdGenerator {
  newId(): string;
}

/** Deterministic ids (`prefix-1`, `prefix-2`, ...) for tests and seeding. */
export class SequentialIdGenerator implements IdGenerator {
  private next = 0;

  constructor(readonly prefix = 'id') {}

  newId(): string {
    return `${this.prefix}-${++this.next}`;
  }
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Random, URL-safe ids (about 119 bits of entropy) suitable for document keys. */
export class RandomIdGenerator implements IdGenerator {
  newId(): string {
    const bytes = crypto.getRandomValues(new Uint32Array(20));
    let id = '';
    for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
    return id;
  }
}
