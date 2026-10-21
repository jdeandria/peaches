import { DomainError } from '../../application/errors';
import { HeartRateAccessLost } from '../../application/heart-rate';
import { GoogleHealthClient, HEART_RATE_SCOPE } from './google-health-client';
import { isGoogleHealthConfigured } from './google-health-config';
import { GoogleHealthHeartRateSource, GoogleOAuth2, TokenResponse } from './google-health-source';

const t = (minutes: number) => new Date(Date.UTC(2026, 9, 12, 9) + minutes * 60_000);

/** A fetch that answers each call with the next response, recording the requests. */
function fakeFetch(...responses: (object | number)[]) {
  const calls: { url: string; init: RequestInit; body: Record<string, unknown> }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: JSON.parse(init.body as string) });
    const next = responses.shift() ?? {};
    return typeof next === 'number'
      ? new Response('{}', { status: next })
      : new Response(JSON.stringify(next), { status: 200 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const point = (minute: number, avg?: number) => ({
  startTime: t(minute).toISOString(),
  endTime: t(minute + 1).toISOString(),
  ...(avg === undefined
    ? {}
    : {
        heartRate: {
          beatsPerMinuteAvg: avg,
          beatsPerMinuteMin: avg - 4,
          beatsPerMinuteMax: avg + 6,
        },
      }),
});

describe('GoogleHealthClient', () => {
  it('rolls heart rate up a minute at a time over the span', async () => {
    const fetch = fakeFetch({ rollupDataPoints: [point(1, 150), point(0, 120), point(2)] });
    const windows = await new GoogleHealthClient(fetch.fn).heartRateWindows('tok', t(0), t(3));
    const [call] = fetch.calls;
    expect(call.url).toBe(
      'https://health.googleapis.com/v4/users/me/dataTypes/heart-rate/dataPoints:rollUp',
    );
    expect(call.init.method).toBe('POST');
    expect((call.init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
    expect(call.body).toEqual({
      range: { startTime: t(0).toISOString(), endTime: t(3).toISOString() },
      windowSize: '60s',
      pageSize: 1000,
    });
    // Oldest first, and minutes without readings left out.
    expect(windows).toEqual([
      { start: t(0), end: t(1), avgBpm: 120, minBpm: 116, maxBpm: 126 },
      { start: t(1), end: t(2), avgBpm: 150, minBpm: 146, maxBpm: 156 },
    ]);
  });

  it('follows page tokens', async () => {
    const fetch = fakeFetch(
      { rollupDataPoints: [point(0, 120)], nextPageToken: 'p2' },
      { rollupDataPoints: [point(1, 130)] },
    );
    const windows = await new GoogleHealthClient(fetch.fn).heartRateWindows('tok', t(0), t(2));
    expect(windows.map((w) => w.avgBpm)).toEqual([120, 130]);
    expect(fetch.calls[1].body['pageToken']).toBe('p2');
  });

  it('asks nothing for an empty span', async () => {
    const fetch = fakeFetch();
    expect(await new GoogleHealthClient(fetch.fn).heartRateWindows('tok', t(1), t(1))).toEqual([]);
    expect(fetch.calls).toEqual([]);
  });

  it('says when access is lost, and explains other failures', async () => {
    const read = (status: number) =>
      new GoogleHealthClient(fakeFetch(status).fn).heartRateWindows('tok', t(0), t(1));
    await expect(read(401)).rejects.toBeInstanceOf(HeartRateAccessLost);
    await expect(read(403)).rejects.toBeInstanceOf(HeartRateAccessLost);
    await expect(read(429)).rejects.toThrow('busy');
    await expect(read(500)).rejects.toThrow('error 500');
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(
      new GoogleHealthClient(offline).heartRateWindows('tok', t(0), t(1)),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe('GoogleHealthHeartRateSource', () => {
  const CLIENT_ID = '123-abc.apps.googleusercontent.com';

  /** Google Identity Services that grants `response` to every request. */
  function fakeIdentity(response: TokenResponse, granted = true) {
    const requests: unknown[] = [];
    const revoked: string[] = [];
    const oauth2: GoogleOAuth2 = {
      initTokenClient: (config) => {
        expect(config).toMatchObject({ client_id: CLIENT_ID, scope: HEART_RATE_SCOPE });
        return {
          requestAccessToken: (overrides) => {
            requests.push(overrides);
            config.callback(response);
          },
        };
      },
      hasGrantedAllScopes: () => granted,
      revoke: (token, done) => {
        revoked.push(token);
        done?.();
      },
    };
    return { identity: async () => oauth2, requests, revoked };
  }

  it('connects with a token for heart rate alone, and reads with it until it expires', async () => {
    let now = t(0);
    const id = fakeIdentity({ access_token: 'tok', expires_in: 3599 });
    const fetch = fakeFetch({ rollupDataPoints: [point(0, 120)] });
    const source = new GoogleHealthHeartRateSource({
      clientId: CLIENT_ID,
      identity: id.identity,
      client: new GoogleHealthClient(fetch.fn),
      now: () => now,
    });
    expect(source.connected).toBe(false);
    await expect(source.windows(t(0), t(1))).rejects.toBeInstanceOf(HeartRateAccessLost);

    await source.connect('peach@example.com');
    expect(id.requests).toEqual([{ prompt: '', login_hint: 'peach@example.com' }]);
    expect(source.connected).toBe(true);
    expect(await source.windows(t(0), t(1))).toHaveLength(1);

    // A minute before Google's expiry, it asks to connect again.
    now = t(59);
    expect(source.connected).toBe(false);
    await expect(source.windows(t(0), t(1))).rejects.toBeInstanceOf(HeartRateAccessLost);
  });

  it('forgets a token Google stops accepting', async () => {
    const source = new GoogleHealthHeartRateSource({
      clientId: CLIENT_ID,
      identity: fakeIdentity({ access_token: 'tok', expires_in: 3600 }).identity,
      client: new GoogleHealthClient(fakeFetch(401).fn),
    });
    await source.connect();
    await expect(source.windows(t(0), t(1))).rejects.toBeInstanceOf(HeartRateAccessLost);
    expect(source.connected).toBe(false);
  });

  it('refuses access without the heart rate permission', async () => {
    const source = new GoogleHealthHeartRateSource({
      clientId: CLIENT_ID,
      identity: fakeIdentity({ access_token: 'tok', expires_in: 3600 }, false).identity,
    });
    await expect(source.connect()).rejects.toThrow('allow Peaches');
    expect(source.connected).toBe(false);
  });

  it('disconnecting revokes the token', async () => {
    const id = fakeIdentity({ access_token: 'tok', expires_in: 3600 });
    const source = new GoogleHealthHeartRateSource({ clientId: CLIENT_ID, identity: id.identity });
    await source.connect();
    await source.disconnect();
    expect(id.revoked).toEqual(['tok']);
    expect(source.connected).toBe(false);
  });

  it('is configured by a web OAuth client id', () => {
    expect(isGoogleHealthConfigured(CLIENT_ID)).toBe(true);
    expect(isGoogleHealthConfigured('')).toBe(false);
    expect(isGoogleHealthConfigured('placeholder')).toBe(false);
  });
});
