import { expect, Page, test } from '@playwright/test';

/**
 * The core user journeys, end to end against the production build.
 * The clock is pinned to a Monday morning so the seeded demo is the same on
 * every run (the demo always has an exercise day "today").
 */
const FIXED_NOW = new Date('2026-10-12T09:00:00Z');

async function openApp(page: Page, path = '/'): Promise<void> {
  await page.clock.install({ time: FIXED_NOW });
  await page.goto(path);
}

/** Bottom bar on phones, rail on desktop: both are links in the main nav. */
function nav(page: Page, name: string) {
  return page.getByRole('navigation').getByRole('link', { name });
}

test('core journey: log a matchup, browse crates and exercises', async ({ page }) => {
  await openApp(page);
  await expect(page.getByText('Up next')).toBeVisible();

  await page.getByRole('link', { name: /Start workout/ }).click();
  await expect(page.getByRole('heading', { name: 'Main work' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit workout' })).toBeVisible();
  // The animated score renders a visual and a screen-reader copy.
  await expect(page.getByText('0 pts', { exact: true }).first()).toBeVisible();

  // Log the first scored exercise (main work; warm-ups score nothing) as prescribed.
  await page
    .getByRole('region', { name: 'Main work' })
    .getByRole('button', { name: /^Log sets/ })
    .first()
    .click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'As prescribed' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText('0 pts', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Submit workout' }).click();
  await expect(page.getByText('Workout submitted. Nice work.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit workout' })).toBeHidden();
  await expect(page.getByText('Submitted. Results arrive when the round closes.')).toBeVisible();

  await nav(page, 'Crates').click();
  await page.getByRole('link', { name: /Weekend Warriors/ }).click();
  await expect(page.getByText('Autumn Kick-off')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'W-L-T' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rounds' })).toBeVisible();

  await nav(page, 'Exercises').click();
  const search = page.getByRole('searchbox');
  await expect(search).toHaveAttribute('placeholder', /Search 440 exercises/);
  await search.fill('Pistol');
  const toggle = page.getByRole('switch', { name: 'Pistol Squat', exact: true });
  await expect(toggle).toBeVisible();
  const before = await toggle.getAttribute('aria-checked');
  await toggle.click();
  await expect(toggle).not.toHaveAttribute('aria-checked', before ?? '');
});

test('profile shows the seeded Peach and switches units', async ({ page }) => {
  await openApp(page);
  await nav(page, 'Profile').click();
  await expect(page.getByRole('heading', { name: 'You' })).toBeVisible();
  await expect(page.getByText(/exercises you can do/)).toBeVisible();
  const imperial = page.getByRole('radio', { name: 'Imperial' });
  await imperial.click();
  await expect(imperial).toHaveAttribute('aria-checked', 'true');
});

test('creating a crate opens its detail page', async ({ page }) => {
  await openApp(page, '/crates');
  await page.getByRole('button', { name: 'New Crate' }).click();
  await page.getByRole('button', { name: /Create a Crate/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Garage Gym');
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Garage Gym', level: 1 })).toBeVisible();
  await expect(page.getByText(/Code [A-Z0-9]{6}/)).toBeVisible();
  await expect(page.getByText('No Season yet. The owner can start one.')).toBeVisible();
});

test('joining with a bad invite code shows an error', async ({ page }) => {
  await openApp(page, '/crates');
  await page.getByRole('button', { name: 'New Crate' }).click();
  await page.getByRole('button', { name: /Join with invite code/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Invite code').fill('NOPE');
  await dialog.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText('No Crate matches that invite code.')).toBeVisible();
});

test('owner can start a season from the crate page', async ({ page }) => {
  await openApp(page, '/crates');
  await page.getByRole('link', { name: /Lunch Break Lifters/ }).click();
  await expect(page.getByText('Strength Block 1')).toBeVisible();
  await page.getByRole('button', { name: 'Season' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Block 2');
  await dialog.getByRole('button', { name: 'Start' }).click();
  // The newest open season is shown.
  await expect(page.getByRole('heading', { name: 'Block 2' })).toBeVisible();
});

test('signed-out demo signs in from the sign-in page', async ({ page }) => {
  await openApp(page, '/?demo=signed-out');
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByText('Up next')).toBeVisible();
});

test('deep links work on a fresh load', async ({ page }) => {
  await openApp(page, '/exercises');
  await expect(page.getByRole('heading', { name: 'Exercises', level: 1 })).toBeVisible();
});

test.describe('progressive web app', () => {
  test('is installable and keeps working offline', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'service worker checks run in Chromium');
    await page.goto('/');
    await expect(page.getByText('Up next')).toBeVisible();

    const manifest = await page.evaluate(async () => {
      const href = document.querySelector('link[rel=manifest]')?.getAttribute('href');
      return href ? (await fetch(href)).json() : null;
    });
    expect(manifest?.name).toBe('Peaches');
    expect(manifest?.display).toBe('standalone');

    // The Angular service worker registers once the app is stable, then
    // caches the app shell and lazy pages.
    await page.evaluate(() => navigator.serviceWorker.ready);
    // The first visit is not controlled; a reload is.
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30_000 })
      .toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('Up next')).toBeVisible();
    await nav(page, 'Exercises').click();
    await expect(page.getByRole('heading', { name: 'Exercises', level: 1 })).toBeVisible();
  });
});

test('every icon renders as a glyph from the subset font', async ({ page }) => {
  // A name missing from src/assets/fonts/icons.json falls back to its text
  // ("inventory_2"), which is far wider than one 24px glyph.
  const pages = ['/', '/crates', '/exercises', '/profile'];
  await openApp(page);
  await page.getByRole('link', { name: /Start workout/ }).click();
  await expect(page.getByRole('heading', { name: 'Main work' })).toBeVisible();
  const check = async (where: string) => {
    await page.evaluate(() => document.fonts.ready);
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll('.material-symbols-rounded')]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .filter((el) => el.getBoundingClientRect().width > 40)
        .map((el) => el.textContent?.trim()),
    );
    expect(wide, `icons rendered as text on ${where}`).toEqual([]);
  };
  await check('matchup');
  for (const path of pages) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await check(path);
  }
});
