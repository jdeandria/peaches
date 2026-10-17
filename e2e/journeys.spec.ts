import { expect, Page, test } from '@playwright/test';

/**
 * The core user journeys, end to end against the production build.
 * The clock is pinned to a Monday morning so the seeded demo is the same on
 * every run (the demo is always mid-season, in its third week).
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

test('core journey: log solo, see it score, vote, browse crates and exercises', async ({
  page,
}) => {
  await openApp(page);
  await expect(page.getByRole('heading', { name: 'Log a workout' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'vs Cho' })).toBeVisible();

  // Log a 5 km run.
  await page.getByRole('link', { name: 'Log a workout' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  const picker = page.getByRole('dialog');
  await picker.getByRole('searchbox').fill('run');
  await picker
    .getByRole('button', { name: /^Run\b/ })
    .first()
    .click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Set 1 distance in km').fill('5');
  await sheet.getByLabel('Set 1 time in minutes').fill('25');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText('1 set · 5 km · 25:00')).toBeVisible();
  await expect(page.getByText(/pts in Weekend Warriors/)).toBeVisible();

  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Workout logged. Nice work.')).toBeVisible();

  // It counts in this week's matchup.
  await page.getByRole('link', { name: /View matchup/ }).click();
  await expect(page.getByRole('heading', { name: 'You vs Cho' })).toBeVisible();
  await expect(page.getByText(/Live · You lead/)).toBeVisible();

  // Vote on what counts.
  await nav(page, 'Crates').click();
  await page.getByRole('link', { name: /Weekend Warriors/ }).click();
  await expect(page.getByText('Autumn Kick-off')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'W-L-T' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weeks' })).toBeVisible();
  await expect(page.getByText('Saturday sweat')).toBeVisible();
  await page.getByRole('link', { name: /What counts/ }).click();
  await page.getByRole('button', { name: 'Even split' }).click();
  await page.getByRole('button', { name: 'Cast my vote' }).click();
  await expect(page.getByText('Vote saved. It counts from the next Season.')).toBeVisible();

  // Add a favourite to a Crate's library.
  await nav(page, 'Exercises').click();
  const search = page.getByRole('searchbox');
  await expect(search).toHaveAttribute('placeholder', /Search 440 exercises/);
  await search.fill('Pistol');
  const toggle = page.getByRole('switch', { name: 'Pistol Squat', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
});

test('start a workout from a Crate routine', async ({ page }) => {
  await openApp(page, '/crates');
  await page.getByRole('link', { name: /Weekend Warriors/ }).click();
  await page.getByRole('link', { name: 'Start Saturday sweat' }).click();
  await expect(page.getByText('Following “Saturday sweat”')).toBeVisible();
  await page.getByRole('button', { name: 'Log sets: Burpee' }).click();
  await expect(page.getByText('Target: 3 × 15 reps')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Logged' })).toBeVisible();
});

test('profile shows the seeded Peach and switches units', async ({ page }) => {
  await openApp(page);
  await nav(page, 'Profile').click();
  await expect(page.getByRole('heading', { name: 'You' })).toBeVisible();
  await expect(page.getByText(/440 exercises/)).toBeVisible();
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
  await expect(page.getByText(/No Season yet\. Start one/)).toBeVisible();

  // The owner starts the first Season.
  await page.getByRole('button', { name: 'Season' }).click();
  const season = page.getByRole('dialog');
  await season.getByLabel('Name').fill('Block 1');
  await season.getByRole('radio', { name: /This week/ }).click();
  await season.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'Block 1' })).toBeVisible();
  await expect(page.getByText('Week 1 · Oct 12 – 18')).toBeVisible();
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

test('signed-out demo signs in from the sign-in page', async ({ page }) => {
  await openApp(page, '/?demo=signed-out');
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Log a workout' })).toBeVisible();
});

test('deep links work on a fresh load', async ({ page }) => {
  await openApp(page, '/exercises');
  await expect(page.getByRole('heading', { name: 'Exercises', level: 1 })).toBeVisible();
});

test.describe('progressive web app', () => {
  test('is installable and keeps working offline', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'service worker checks run in Chromium');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Log a workout' })).toBeVisible();

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
    await expect(page.getByRole('heading', { name: 'Log a workout' })).toBeVisible();
    await nav(page, 'Exercises').click();
    await expect(page.getByRole('heading', { name: 'Exercises', level: 1 })).toBeVisible();
  });
});

test('every icon renders as a glyph from the subset font', async ({ page }) => {
  // A name missing from src/assets/fonts/icons.json falls back to its text
  // ("inventory_2"), which is far wider than one 24px glyph.
  const pages = ['/', '/log', '/crates', '/exercises', '/profile'];
  await openApp(page);
  await page.getByRole('link', { name: /View matchup/ }).click();
  await expect(page.getByRole('heading', { name: 'Where the points came from' })).toBeVisible();
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
