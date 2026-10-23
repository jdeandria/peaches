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

test('core journey: log solo, see it score, vote on the rules', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('heading', { name: 'Start a workout' })).toBeVisible();

  // Plan a 5 km run: building your own comes first, and no clock runs yet.
  await page.getByRole('link', { name: 'Plan a workout' }).click();
  await expect(page.getByRole('heading', { name: 'Plan your workout' })).toBeVisible();
  await expect(page.getByText('Session time')).toBeHidden();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  const picker = page.getByRole('dialog');
  await expect(picker.getByRole('heading', { name: 'Recent' })).toBeVisible();
  await picker.getByRole('searchbox').fill('run');
  await picker
    .getByRole('button', { name: /^Run\b/ })
    .first()
    .click();
  // Sets are set out one at a time on dials: swipe one, or tap it to type.
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('slider', { name: 'Distance in km' }).click();
  await sheet.getByRole('textbox', { name: 'Distance in km' }).fill('5');
  await page.keyboard.press('Enter');
  await sheet.getByRole('slider', { name: 'Time in minutes' }).click();
  await sheet.getByRole('textbox', { name: 'Time in minutes' }).fill('25');
  await page.keyboard.press('Enter');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText('1 set · 5 km · 25:00')).toBeVisible();

  // Log mode: the set comes up with its target dialled in; Done, then Finish.
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { name: 'Run' })).toBeVisible();
  await expect(page.getByText('Target 5.0 km')).toBeVisible();
  await page.getByRole('button', { name: 'Done: set 1 of Run' }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();
  await page.getByRole('button', { name: /^Finish/ }).click();
  await expect(page.getByText('Workout logged. Nice work.')).toBeVisible();
  await expect(page.getByText('Session time')).toBeVisible();
  await expect(page.getByText(/pts in Weekend Warriors/)).toBeVisible();

  // It counts in this week's matchup, line by line.
  await nav(page, 'Compete').click();
  await expect(page.getByRole('heading', { name: 'vs Cho' })).toBeVisible();
  await page.getByRole('link', { name: /View matchup/ }).click();
  await expect(page.getByRole('heading', { name: 'You vs Cho' })).toBeVisible();
  await expect(page.getByText(/Live · You lead/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How the score adds up' })).toBeVisible();
  await expect(page.getByText('Battle prizes')).toBeVisible();

  // Vote on the Crate's rules.
  await nav(page, 'Crates').click();
  await page.getByRole('link', { name: /Weekend Warriors/ }).click();
  await expect(page.getByText('Autumn Kick-off')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'W-L-T' })).toBeVisible();
  await expect(page.getByText('Reservoir hill loop').first()).toBeVisible();
  await page.getByRole('link', { name: /Rules ·/ }).click();
  await page.getByRole('button', { name: 'Even split' }).click();
  await page.getByRole('button', { name: 'More: Battle prize' }).click();
  await page.getByRole('button', { name: 'Cast my vote' }).click();
  await expect(page.getByText('Vote saved. It counts from the next Season.')).toBeVisible();
});

test('make up an exercise while logging; crate-mates see it came from you', async ({ page }) => {
  await openApp(page, '/log');
  await page.getByRole('button', { name: 'Add exercise' }).click();
  const picker = page.getByRole('dialog');
  await picker.getByRole('searchbox').fill('Rucking');
  await picker.getByRole('button', { name: /Create “Rucking”/ }).click();
  await picker.getByRole('button', { name: /Reps with weight/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Rucking')).toBeVisible();
  await page.getByRole('button', { name: 'Start workout' }).click();
  for (let set = 1; set <= 3; set++) {
    await page.getByRole('button', { name: `Done: set ${set} of Rucking` }).click();
    if (set < 3) await page.getByRole('button', { name: 'Skip rest' }).click();
  }
  await page.getByRole('button', { name: /^Finish/ }).click();
  await expect(page.getByText('Workout logged. Nice work.')).toBeVisible();

  await nav(page, 'Crates').click();
  await page.getByRole('link', { name: /Weekend Warriors/ }).click();
  await page.getByRole('radio', { name: 'Activity' }).click();
  const rucking = page.locator('.exercises pch-list-row', { hasText: 'Rucking' });
  await expect(rucking).toContainText('From you');
});

test('start a routine from Train and tick it off, resting between sets', async ({ page }) => {
  await openApp(page);
  // One tap plans the routine.
  await page.getByRole('link', { name: 'Swing day' }).click();
  await expect(page.getByText('0 of 6 sets done')).toBeVisible();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByText('Exercise 1 of 2 · Set 1 of 3')).toBeVisible();
  await page.getByRole('button', { name: /^Done: set 1/ }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: 'Skip rest' }).click();
  await expect(page.getByText('Exercise 1 of 2 · Set 2 of 3')).toBeVisible();
  // Back to the plan, which shows the progress; Continue picks up there.
  await page.getByRole('button', { name: 'Back to plan' }).click();
  await expect(page.getByText('1 of 6 sets done')).toBeVisible();
  await page.getByRole('button', { name: /^Continue/ }).click();
  await expect(page.getByText('Exercise 1 of 2 · Set 2 of 3')).toBeVisible();
  // Train shows how far along it is; Continue goes straight back into the sets.
  await page.getByRole('button', { name: 'Back to plan' }).click();
  await nav(page, 'Train').click();
  await expect(page.getByRole('heading', { name: 'Workout in progress' })).toBeVisible();
  await expect(page.getByText('1 of 6 sets done.')).toBeVisible();
  await page.getByRole('link', { name: 'Continue' }).click();
  await expect(page.getByText('Exercise 1 of 2 · Set 2 of 3')).toBeVisible();
});

test('set next week’s lineup', async ({ page }) => {
  await openApp(page);
  await nav(page, 'Compete').click();
  await page.getByRole('link', { name: 'Set lineup' }).first().click();
  await expect(page.getByRole('heading', { name: 'Week 4 lineup' })).toBeVisible();
  // This week's lineup carries over and fills every slot: swap minutes for reps.
  await expect(page.getByRole('checkbox', { name: 'Pledge Reps' })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Pledge Active minutes' }).click();
  await page.getByRole('checkbox', { name: 'Pledge Reps' }).click();
  await page.getByRole('button', { name: 'More Reps' }).click();
  await page.getByRole('button', { name: /Set lineup · / }).click();
  await expect(page.getByText('Lineup set. Good luck.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your lineup' })).toBeVisible();
});

test('dispute a crate-mate’s numbers and vote on them', async ({ page }) => {
  await openApp(page, '/crates');
  await page.getByRole('link', { name: /Weekend Warriors/ }).click();
  // Ben disputed one of Ada's workouts; it needs my vote.
  await expect(page.getByRole('heading', { name: 'Your vote needed' })).toBeVisible();
  await page.locator('a.dispute-link').first().click();
  await expect(page.getByRole('heading', { name: 'Ada’s workout' })).toBeVisible();
  await expect(page.getByText('1 of 3 votes to strike')).toBeVisible();
  await page.getByRole('button', { name: 'Strike' }).click();
  await expect(page.getByText('2 of 3 votes to strike')).toBeVisible();
  // And raise one of my own about the session time.
  await page.getByRole('button', { name: 'Dispute Session time' }).click();
  // It can't be withdrawn, so it asks first.
  const confirm = page.getByRole('dialog');
  await expect(confirm.getByRole('heading', { name: 'Dispute Session time?' })).toBeVisible();
  await confirm.getByRole('button', { name: 'Dispute' }).click();
  await expect(page.getByText('Disputed. Your crate-mates can now vote.')).toBeVisible();
});

test('edit a finished workout’s time', async ({ page }) => {
  await openApp(page);
  await page.locator('a[pch-list-row][href^="/log/"]').first().click();
  await page.getByRole('button', { name: 'Edit details' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Session time').fill('75');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Workout updated.')).toBeVisible();
  await expect(page.getByText('1:15:00')).toBeVisible();
});

test('profile shows the seeded Peach and switches units', async ({ page }) => {
  await openApp(page);
  await nav(page, 'Profile').click();
  await expect(page.getByRole('heading', { name: 'You', exact: true })).toBeVisible();
  await expect(page.getByText('2 Crates')).toBeVisible();
  const imperial = page.getByRole('radio', { name: 'Imperial' });
  await imperial.click();
  await expect(imperial).toHaveAttribute('aria-checked', 'true');
});

test('creating a crate opens its detail page', async ({ page }) => {
  await openApp(page, '/crates');
  await page.getByRole('button', { name: 'Add Crate' }).click();
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
  await page.getByRole('button', { name: 'Add Crate' }).click();
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
  await expect(page.getByRole('heading', { name: 'Start a workout' })).toBeVisible();
});

test('deep links work on a fresh load', async ({ page }) => {
  await openApp(page, '/profile');
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
});

test.describe('progressive web app', () => {
  test('is installable and keeps working offline', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'service worker checks run in Chromium');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Start a workout' })).toBeVisible();

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
    await expect(page.getByRole('heading', { name: 'Start a workout' })).toBeVisible();
    await nav(page, 'Crates').click();
    await expect(page.getByRole('heading', { name: 'Crates', level: 1 })).toBeVisible();
  });
});

test('every icon renders as a glyph from the subset font', async ({ page }) => {
  // A name missing from src/assets/fonts/icons.json falls back to its text
  // ("inventory_2"), which is far wider than one 24px glyph.
  const pages = ['/', '/compete', '/log', '/crates', '/profile'];
  await openApp(page, '/compete');
  await page.getByRole('link', { name: /View matchup/ }).click();
  await expect(page.getByRole('heading', { name: 'How the score adds up' })).toBeVisible();
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
  await page.goto('/compete');
  await page.getByRole('link', { name: 'Set lineup' }).first().click();
  await expect(page.getByRole('heading', { name: 'Week 4 lineup' })).toBeVisible();
  await check('lineup');
  await page.goto('/crates');
  await page.getByRole('link', { name: /Weekend Warriors/ }).click();
  await expect(page.getByRole('heading', { name: 'Your vote needed' })).toBeVisible();
  await check('crate');
  await page.locator('a.dispute-link').first().click();
  await expect(page.getByRole('heading', { name: 'Ada’s workout' })).toBeVisible();
  await check('workout');
  for (const path of pages) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await check(path);
  }
});
