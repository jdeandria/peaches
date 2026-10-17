import { IdGenerator } from '../domain/core/ids';
import {
  canManage,
  Crate,
  CrateMembership,
  CrateSettings,
  crateSettings,
  DEFAULT_CRATE_SETTINGS,
  isActiveMembership,
} from '../domain/models/crate';
import { CrateRepository } from '../domain/repositories';
import { DomainError } from './errors';

/** Unambiguous characters only: no 0/O or 1/I. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface CreateCrateArgs {
  readonly ownerPeachId: string;
  readonly name: string;
  readonly now: Date;
  readonly description?: string;
  readonly timeZone?: string;
  readonly settings?: CrateSettings;
}

/** Crate lifecycle: creation, settings, joining and leaving. */
export class CrateService {
  constructor(
    private readonly crates: CrateRepository,
    private readonly ids: IdGenerator,
    private readonly randomInt: (max: number) => number = secureRandomInt,
  ) {}

  async createCrate(args: CreateCrateArgs): Promise<Crate> {
    const name = args.name.trim();
    if (!name) throw new DomainError('Give your Crate a name.');
    const crate: Crate = {
      id: this.ids.newId(),
      name,
      description: (args.description ?? '').trim(),
      ownerPeachId: args.ownerPeachId,
      inviteCode: await this.uniqueInviteCode(),
      timeZone: args.timeZone ?? 'UTC',
      settings: args.settings ?? DEFAULT_CRATE_SETTINGS,
      createdAt: args.now,
    };
    await this.crates.save(crate);
    await this.crates.saveMembership({
      crateId: crate.id,
      peachId: args.ownerPeachId,
      role: 'owner',
      status: 'active',
      joinedAt: args.now,
    });
    return crate;
  }

  /** Joins (or re-joins) a Crate by invite code. Idempotent for members. */
  async joinByInviteCode(inviteCode: string, peachId: string, now: Date): Promise<Crate> {
    const crate = await this.crates.getByInviteCode(inviteCode);
    if (!crate) throw new DomainError('No Crate matches that invite code.');
    const existing = (await this.crates.membershipsFor(peachId)).find(
      (m) => m.crateId === crate.id,
    );
    if (!existing) {
      await this.crates.saveMembership({
        crateId: crate.id,
        peachId,
        role: 'member',
        status: 'active',
        joinedAt: now,
      });
    } else if (!isActiveMembership(existing)) {
      await this.crates.saveMembership({ ...existing, status: 'active' });
    }
    return crate;
  }

  async leave(crateId: string, peachId: string): Promise<void> {
    const membership = (await this.crates.membershipsFor(peachId)).find(
      (m) => m.crateId === crateId,
    );
    if (!membership) return;
    if (membership.role === 'owner') {
      throw new DomainError('Owners cannot leave their Crate. Transfer ownership first.');
    }
    await this.crates.saveMembership({ ...membership, status: 'left' });
  }

  /** Owners and admins change a Crate's settings. */
  async updateSettings(crateId: string, peachId: string, settings: CrateSettings): Promise<Crate> {
    const crate = await this.crates.getById(crateId);
    if (!crate) throw new DomainError('Crate not found.');
    const membership = (await this.crates.membershipsOf(crateId)).find(
      (m) => m.peachId === peachId && isActiveMembership(m),
    );
    if (!membership || !canManage(membership)) {
      throw new DomainError('Only the owner can change Crate settings.');
    }
    let checked: CrateSettings;
    try {
      checked = crateSettings(settings);
    } catch (e) {
      throw new DomainError(e instanceof Error ? e.message : String(e));
    }
    const updated: Crate = { ...crate, settings: checked };
    await this.crates.save(updated);
    return updated;
  }

  async activeMembers(crateId: string): Promise<CrateMembership[]> {
    return (await this.crates.membershipsOf(crateId)).filter(isActiveMembership);
  }

  private async uniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) code += CODE_ALPHABET[this.randomInt(CODE_ALPHABET.length)];
      if ((await this.crates.getByInviteCode(code)) === null) return code;
    }
    throw new Error('Could not allocate a unique invite code');
  }
}

function secureRandomInt(max: number): number {
  // Rejection sampling keeps the distribution uniform.
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
}
