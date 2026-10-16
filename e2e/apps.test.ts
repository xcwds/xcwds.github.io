import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

// Apps people turn on and off (#223): Kitchen, Gym, Links, Housework and Self-Control.

const card = (page: Page, name: string) =>
	page.getByTestId('app-card').filter({ has: page.getByText(name, { exact: true }) });
const toggle = (page: Page, name: string) => card(page, name).getByRole('switch');
const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main' });

async function turn(page: Page, name: string, on: boolean) {
	await gotoHydrated(page, '/apps');
	const sw = toggle(page, name);
	await expect(sw).toBeEnabled();
	await sw.click();
	await expect(sw).toHaveAttribute('aria-checked', String(on));
	await expect(
		page.getByTestId('toast').filter({ hasText: `${name} turned ${on ? 'on' : 'off'}.` })
	).toBeVisible();
}

test('Home and Utils link to the Apps page, where every app starts on', async ({ page }) => {
	await gotoHydrated(page, '/');
	await page.getByRole('link', { name: 'Choose apps' }).click();
	await expect(page).toHaveURL(/\/apps$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Apps$/);
	for (const name of ['Kitchen', 'Gym', 'Links', 'Housework', 'Self-Control'])
		await expect(toggle(page, name)).toHaveAttribute('aria-checked', 'true');

	await gotoHydrated(page, '/utils');
	await page.getByRole('link', { name: 'Choose apps' }).click();
	await expect(page).toHaveURL(/\/apps$/);
	// Not a tab of its own.
	await expect(mainNav(page).getByRole('link')).toHaveCount(4);
});

const layouts = {
	phone: { width: 390, height: 844 },
	tablet: { width: 820, height: 1180 },
	computer: { width: 1440, height: 900 }
};

for (const [name, viewport] of Object.entries(layouts)) {
	test(`turning Kitchen off hides the Recipes tab and kitchen tools on a ${name}`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await gotoHydrated(page, '/');
		await expect(mainNav(page).getByRole('link', { name: /Recipes/ })).toHaveCount(1);
		await turn(page, 'Kitchen', false);
		await expect(mainNav(page).getByRole('link', { name: /Recipes/ })).toHaveCount(0);

		await gotoHydrated(page, '/utils');
		const tools = page.locator('main li');
		await expect(tools.filter({ hasText: 'Weightlifting Calculator' })).toBeVisible();
		for (const tool of ['Pizza Dough Calculator', 'Coffee Timer', 'Cooking Timer', 'Oven Time'])
			await expect(tools.filter({ hasText: tool })).toHaveCount(0);
		await expect(mainNav(page).getByRole('link', { name: /Recipes/ })).toHaveCount(0);

		await gotoHydrated(page, '/');
		await expect(page.getByRole('link', { name: /^Kitchen Guide/ })).toHaveCount(0);
		await expect(page.getByRole('link', { name: /^Recipes \d+ classic/ })).toHaveCount(0);

		// A link straight into Kitchen still opens, says it's off and turns it back on.
		await gotoHydrated(page, '/recipes/pizza-dough');
		await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible();
		const notice = page.getByTestId('app-off');
		await expect(notice).toContainText('Kitchen is turned off.');
		await notice.getByRole('button', { name: 'Turn on' }).click();
		await expect(notice).toHaveCount(0);
		await expect(mainNav(page).getByRole('link', { name: /Recipes/ })).toHaveCount(1);
	});
}

test('the Recipes tab stays hidden from the first paint while Kitchen is off', async ({ page }) => {
	await turn(page, 'Kitchen', false);
	await page.route('**/_app/immutable/**/*.js', (route) => route.abort());
	await page.goto('/utils');
	await expect(mainNav(page).getByRole('link', { name: /Recipes/ })).toHaveCount(0);
	await expect(page.locator('main li').filter({ hasText: 'Coffee Timer' })).toBeHidden();
	await expect(page.locator('main li').filter({ hasText: 'URL Sanitizer' })).toBeVisible();
});

test('pins survive turning their app off and on', async ({ page }) => {
	await gotoHydrated(page, '/utils');
	await page.getByRole('button', { name: 'Pin Coffee Timer to Home' }).click();
	await page.getByRole('button', { name: 'Pin URL Sanitizer to Home' }).click();
	await gotoHydrated(page, '/');
	const pinned = page.getByTestId('pinned').getByRole('link');
	await expect(pinned).toHaveText(['☕ Coffee Timer', '🧼 URL Sanitizer']);

	await turn(page, 'Kitchen', false);
	await gotoHydrated(page, '/');
	await expect(pinned).toHaveText(['🧼 URL Sanitizer']);

	await turn(page, 'Kitchen', true);
	await gotoHydrated(page, '/');
	await expect(pinned).toHaveText(['☕ Coffee Timer', '🧼 URL Sanitizer']);
});

/** Logs and finishes a one-exercise workout, so Gym has saved history. */
async function finishWorkout(page: Page) {
	await gotoHydrated(page, '/utils/weightlifting');
	await page.getByRole('tab', { name: 'Workout' }).click();
	await page.getByRole('button', { name: '+ Add exercise' }).click();
	await page.getByLabel('Exercise 1 name').fill('Squat');
	await page.getByLabel('Squat set 1 weight').fill('225');
	await page.getByLabel('Squat set 1 reps').fill('5');
	await page.getByRole('button', { name: 'Finish workout' }).click();
	await expect(page.getByTestId('toast')).toHaveText('Workout saved to history.');
}

const history = (page: Page) => page.evaluate(() => localStorage.getItem('app:workout-history'));

test("Remove data clears Gym's workout history only after confirming", async ({ page }) => {
	await page.setViewportSize(layouts.phone);
	await finishWorkout(page);
	await turn(page, 'Gym', false);

	const remove = card(page, 'Gym').getByRole('button', { name: "Remove Gym's data" });
	page.once('dialog', (dialog) => dialog.dismiss());
	await remove.click();
	expect(await history(page)).not.toBeNull();

	page.once('dialog', (dialog) => dialog.accept());
	await remove.click();
	await expect(page.getByTestId('toast').filter({ hasText: "Removed Gym's data." })).toBeVisible();
	expect(await history(page)).toBeNull();
	await expect(remove).toHaveCount(0);
	// Kitchen's data and switch are untouched.
	await expect(toggle(page, 'Kitchen')).toHaveAttribute('aria-checked', 'true');
});

test('a backup made with Gym off restores with Gym off', async ({ page }) => {
	page.on('dialog', (dialog) => dialog.accept());
	await turn(page, 'Gym', false);

	await gotoHydrated(page, '/settings');
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download backup' }).click();
	const file = (await (await download).path())!;
	const backup = JSON.parse(await readFile(file, 'utf8'));
	expect(backup.data['app:settings'].apps).toEqual({ gym: false });

	await page.getByRole('button', { name: 'Clear all data' }).click();
	await expect(page.getByTestId('toast').filter({ hasText: 'All data cleared.' })).toBeVisible();
	await gotoHydrated(page, '/apps');
	await expect(toggle(page, 'Gym')).toHaveAttribute('aria-checked', 'true');

	await gotoHydrated(page, '/settings');
	await page.getByLabel('Backup file').setInputFiles(file);
	await page.getByTestId('import-preview').getByRole('button', { name: 'Replace' }).click();
	await expect(
		page.getByTestId('toast').filter({ hasText: /^Imported \d+ items?\.$/ })
	).toBeVisible();
	await gotoHydrated(page, '/apps');
	await expect(toggle(page, 'Gym')).toHaveAttribute('aria-checked', 'false');
	await gotoHydrated(page, '/utils');
	await expect(page.locator('main li').filter({ hasText: 'Weightlifting' })).toHaveCount(0);
});

test('cooking timers keep ringing while Kitchen is off', async ({ page }) => {
	await page.clock.install();
	await gotoHydrated(page, '/utils/cooking-timer');
	await page.getByRole('button', { name: '1 min', exact: true }).click();
	await turn(page, 'Kitchen', false);
	await gotoHydrated(page, '/utils');
	await page.clock.runFor(61_000);
	await expect(page.getByTestId('timer-alert')).toHaveText(/1:00 timer is done/);
});
