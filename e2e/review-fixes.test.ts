import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

// These follow the PR #24 review: open each tool *before* changing its default.

test('opening tools saves nothing until something changes', async ({ page }) => {
	for (const path of ['/utils/coffee-timer', '/utils/weightlifting', '/utils/cooking-timer']) {
		await gotoHydrated(page, path);
	}
	const keys = await page.evaluate(() =>
		Object.keys(localStorage).filter((k) => k !== 'app:version')
	);
	expect(keys).toEqual([]);
});

test('a new coffee default applies after the timer has been opened', async ({ page }) => {
	await gotoHydrated(page, '/utils/coffee-timer');
	await expect(page.getByTestId('display')).toHaveText('1:30');

	await gotoHydrated(page, '/settings');
	await page.getByRole('button', { name: '15 seconds longer' }).click();
	await gotoHydrated(page, '/utils/coffee-timer');
	await expect(page.getByTestId('display')).toHaveText('1:45');
	await expect(page.getByRole('button', { name: /^Back to/ })).toHaveCount(0);

	// A length picked in the timer is remembered...
	await page.getByRole('button', { name: '+30s' }).click();
	await gotoHydrated(page, '/utils/coffee-timer');
	await expect(page.getByTestId('display')).toHaveText('2:15');

	// ...until the default changes again.
	await gotoHydrated(page, '/settings');
	await page.getByRole('button', { name: '15 seconds shorter' }).click();
	await gotoHydrated(page, '/utils/coffee-timer');
	await expect(page.getByTestId('display')).toHaveText('1:30');
});

test('a new default equipment applies after the calculator has been opened', async ({ page }) => {
	await gotoHydrated(page, '/utils/weightlifting');
	await page.getByRole('button', { name: 'Kettlebell' }).click();
	await gotoHydrated(page, '/utils/weightlifting');
	// Your pick is remembered...
	await expect(page.getByRole('button', { name: 'Kettlebell' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// ...until you change the default.
	await gotoHydrated(page, '/settings');
	await page.getByLabel('Default equipment').selectOption({ label: 'Dumbbell pair' });
	await gotoHydrated(page, '/utils/weightlifting');
	await expect(page.getByRole('button', { name: 'Dumbbell pair' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('switching units never relabels weights already logged', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await gotoHydrated(page, '/utils/weightlifting');
	await page.getByRole('tab', { name: 'Workout' }).click();
	await page.getByLabel('Date').fill('Sun');
	await page.getByRole('button', { name: '+ Add exercise' }).click();
	await page.getByLabel('Exercise 1 name').fill('Squat');
	await page.getByLabel('Squat set 1 weight').fill('225');
	await page.getByLabel('Squat set 1 reps').fill('5');

	await page.getByRole('tab', { name: 'Plates' }).click();
	await page.getByRole('radio', { name: 'Kilograms (kg)' }).click();
	await page.getByRole('tab', { name: 'Workout' }).click();

	await expect(page.getByRole('columnheader', { name: 'Weight (lb)' })).toBeVisible();
	await expect(page.getByTestId('unit-note')).toContainText('logged in lb');
	await expect(page.getByRole('button', { name: /^\+ Set @/ })).toBeDisabled();
	await page.getByRole('button', { name: 'Copy workout' }).click();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('@ 225 lb');

	// A new workout follows the calculator.
	page.once('dialog', (d) => d.accept());
	await page.getByRole('button', { name: 'New workout' }).click();
	await page.getByRole('button', { name: '+ Add exercise' }).click();
	await expect(page.getByRole('columnheader', { name: 'Weight (kg)' })).toBeVisible();
	await expect(page.getByTestId('unit-note')).toHaveCount(0);
});

test('presets rejected by storage are rejected in Settings too', async ({ page }) => {
	await gotoHydrated(page, '/settings');
	const input = page.getByLabel('Quick-start buttons');
	await input.fill('0.05, 5, 10');
	await input.blur();
	await expect(page.getByRole('alert')).toContainText('from 0.1 to 1440');
	await gotoHydrated(page, '/utils/cooking-timer');
	await expect(page.getByRole('button', { name: '5 min', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: '1 min', exact: true })).toBeVisible();
});

test('kg barbells are drawn as long bars', async ({ page }) => {
	await gotoHydrated(page, '/utils/weightlifting');
	await page.getByRole('radio', { name: 'Kilograms (kg)' }).click();
	for (const name of ['Barbell (20 kg)', 'Barbell (15 kg)']) {
		await page.getByRole('button', { name }).click();
		expect((await page.getByTestId('bar').boundingBox())!.width).toBeGreaterThan(80);
	}
	await page.getByRole('button', { name: 'Dumbbell', exact: true }).click();
	expect((await page.getByTestId('bar').boundingBox())!.width).toBeLessThan(50);
});
