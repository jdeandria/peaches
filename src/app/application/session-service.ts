import { peach, Peach } from '../domain/models/peach';
import { PeachRepository } from '../domain/repositories';
import { AuthUser } from './auth-service';

/**
 * Bridges authentication and the Peach profile: every signed-in user has
 * exactly one Peach whose id is the auth uid.
 */
export class SessionService {
  constructor(private readonly peaches: PeachRepository) {}

  /**
   * Returns the Peach for `user`, creating it on first sign-in. New Peaches
   * take the device's time zone so "today" means their today.
   */
  async ensurePeach(user: AuthUser, now: Date, timeZone = 'UTC'): Promise<Peach> {
    const existing = await this.peaches.getById(user.id);
    if (existing) return existing;
    const name = (user.displayName ?? '').trim();
    const created = peach({
      id: user.id,
      displayName: name || nameFromEmail(user.email),
      email: user.email,
      avatarUrl: user.photoUrl,
      timeZone,
      createdAt: now,
    });
    await this.peaches.save(created);
    return created;
  }
}

function nameFromEmail(email: string | null): string {
  const local = (email ?? '').split('@')[0].trim();
  return local || 'Peach';
}
