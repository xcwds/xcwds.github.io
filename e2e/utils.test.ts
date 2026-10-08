import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('utils index links to each tool', async ({ page }) => {
	await gotoHydrated(page, '/utils');
	for (const name of ['Pizza Dough Calculator', 'Coffee Timer', 'Cooking Timer']) {
		await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
	}
});

test('pizza dough calculator updates weights', async ({ page }) => {
	await gotoHydrated(page, '/utils/pizza-dough');
	const result = page.getByTestId('dough-result');
	await expect(result).toContainText('Total 1120 g');
	await page.getByLabel('Dough balls').fill('2');
	await expect(result).toContainText('Total 560 g');
});

test('coffee timer counts down from 1:30 and adjusts', async ({ page }) => {
	// Freeze the clock so only runFor() moves time; otherwise real seconds leak in under load.
	await page.clock.install({ time: new Date('2026-01-01T08:00:00') });
	await gotoHydrated(page, '/utils/coffee-timer');
	await page.clock.pauseAt(new Date('2026-01-01T08:00:01'));
	const display = page.getByTestId('display');
	await expect(display).toHaveText('1:30');
	await page.getByRole('button', { name: '+30s' }).click();
	await expect(display).toHaveText('2:00');
	await page.getByRole('button', { name: 'Reset' }).click();
	await expect(display).toHaveText('2:00');
	await page.getByRole('button', { name: 'Back to 1:30' }).click();
	await expect(display).toHaveText('1:30');
	await page.getByRole('button', { name: 'Start' }).click();
	await page.clock.runFor(10_000);
	await expect(display).toHaveText('1:20');
	await page.clock.runFor(85_000);
	await expect(page.getByText('Done!')).toBeVisible();
	await expect(display).toHaveText('+0:05');

	// Stopping a finished brew resets it, so Start begins a fresh countdown (#25).
	await page.getByRole('button', { name: 'Stop' }).click();
	await expect(display).toHaveText('1:30');
	await page.getByRole('button', { name: 'Start' }).click();
	await page.clock.runFor(1_000);
	await expect(display).toHaveText('1:29');
});

test('coffee timer adjustments mid-brew keep the saved default (#26)', async ({ page }) => {
	await page.clock.install({ time: new Date('2026-01-01T08:00:00') });
	await gotoHydrated(page, '/utils/coffee-timer');
	await page.clock.pauseAt(new Date('2026-01-01T08:00:01'));
	const display = page.getByTestId('display');
	await page.getByRole('button', { name: 'Start' }).click();
	await page.clock.runFor(30_000);
	await page.getByRole('button', { name: 'Pause' }).click();
	await page.getByRole('button', { name: '+10s' }).click();
	await expect(display).toHaveText('1:10');
	await expect(page.getByText('Resets to 1:30.')).toBeVisible();
	// Even adjusted back to exactly the full length, a started brew isn't the saved length.
	await page.getByRole('button', { name: '+10s' }).click();
	await expect(display).toHaveText('1:20');
	await page.getByRole('button', { name: '+10s' }).click();
	await expect(display).toHaveText('1:30');
	await page.getByRole('button', { name: '+30s' }).click();
	await expect(display).toHaveText('2:00');
	await expect(page.getByText('Resets to 1:30.')).toBeVisible();
	await page.getByRole('button', { name: 'Reset' }).click();
	await expect(display).toHaveText('1:30');

	// Adjusting before starting still changes the default, and it's saved.
	await page.getByRole('button', { name: '+30s' }).click();
	await expect(page.getByText('Resets to 2:00.')).toBeVisible();
	await page.reload();
	await expect(display).toHaveText('2:00');

	// The length can't be taken down to 0:00 (which would finish instantly on Start).
	for (let i = 0; i < 14; i++) await page.getByRole('button', { name: '−10s' }).click();
	await expect(display).toHaveText('0:05');
	await expect(page.getByText('Resets to 0:05.')).toBeVisible();
});

test('cooking timer runs, rings, and survives a reload', async ({ page }) => {
	await page.clock.install();
	await gotoHydrated(page, '/utils/cooking-timer');
	await page.getByLabel('Label').fill('Rice');
	await page.getByLabel('Minutes').fill('2');
	await page.getByRole('button', { name: 'Start timer' }).click();
	await page.getByRole('button', { name: '5 min', exact: true }).click();

	const timers = page.getByRole('timer');
	await expect(timers).toHaveCount(2);
	await expect(timers.first()).toHaveText('2:00');

	await page.clock.runFor(60_000);
	await page.reload();
	await expect(page.getByText('Rice')).toBeVisible();
	// The restored timer keeps counting, so allow for time spent reloading.
	await expect(timers.first()).toHaveText(/^(1:00|0:[3-5]\d)$/);

	await page.clock.runFor(61_000);
	await expect(timers.first()).toHaveText('Done!');
	await page.getByRole('button', { name: 'Stop' }).click();
	await expect(timers).toHaveCount(1);
});

test('timers keep counting and ring on other pages (#66)', async ({ page }) => {
	// A running fake clock: client-side navigation needs timers to keep going.
	await page.clock.install();
	await gotoHydrated(page, '/utils/cooking-timer');
	const tabs = page.getByRole('navigation', { name: 'Main' });
	const alert = page.getByTestId('timer-alert');

	// A cooking timer rings on Home, where it can be snoozed or stopped.
	await page.getByRole('button', { name: '1 min', exact: true }).click();
	await tabs.getByRole('link', { name: 'Home' }).click();
	await expect(page).toHaveURL(/\/$/);
	await page.clock.runFor(61_000);
	await expect(alert).toHaveText(/1:00 timer is done/);
	await alert.getByRole('button', { name: '+1 min' }).click();
	await expect(alert).toHaveCount(0);
	await page.clock.runFor(61_000);
	await expect(alert).toHaveCount(1);
	await alert.getByRole('button', { name: 'Stop' }).click();
	await expect(alert).toHaveCount(0);

	// A coffee brew survives leaving its page and a reload, and rings elsewhere too.
	await tabs.getByRole('link', { name: 'Utils' }).click();
	await page.getByRole('link', { name: /Coffee Timer/ }).click();
	const display = page.getByTestId('display');
	await expect(display).toHaveText('1:30');
	await page.getByRole('button', { name: 'Start' }).click();
	await tabs.getByRole('link', { name: 'Home' }).click();
	await page.clock.runFor(30_000);
	await page.goBack();
	await expect(display).toHaveText(/^(1:00|0:5\d)$/);
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await page.reload();
	// The restored brew keeps counting, so allow for time spent reloading.
	await expect(display).toHaveText(/^(1:00|0:[3-5]\d)$/);
	await tabs.getByRole('link', { name: 'Recipes' }).click();
	await page.clock.runFor(61_000);
	await expect(alert).toHaveText(/Coffee timer is done/);
	await alert.getByRole('link', { name: 'Open Coffee Timer' }).click();
	await expect(page.getByText('Done!')).toBeVisible();
	await expect(alert).toHaveCount(0);
	await page.getByRole('button', { name: 'Stop' }).click();
	await expect(display).toHaveText('1:30');
});

test('oven time converter estimates a new time, in °F or °C', async ({ page }) => {
	await gotoHydrated(page, '/utils/oven-time');
	await expect(page.getByTestId('oven-time')).toHaveText('50 min');
	await expect(page.getByTestId('oven-change')).toHaveText('10 min less than the recipe');

	await page.getByLabel('Your oven (°F)').fill('350');
	await expect(page.getByTestId('oven-change')).toHaveText('Same as the recipe');

	// Decimals aren't rounded away while typing; the field shows a rounded value after blur.
	await page.getByLabel('Your oven (°F)').fill('300.5');
	await expect(page.getByLabel('Your oven (°F)')).toHaveValue('300.5');
	await expect(page.getByTestId('oven-warnings')).toContainText('Food safety');
	await page.getByLabel('Recipe time (min)').focus();
	await expect(page.getByLabel('Your oven (°F)')).toHaveValue('301');
	await page.getByLabel('Your oven (°F)').fill('400');

	// Custom values starting at fridge temperature still get the food-safety warning.
	await page.getByLabel("What's cooking").selectOption('custom');
	await page.getByLabel('Your oven (°F)').fill('300');
	await expect(page.getByTestId('oven-warnings')).toContainText('Food safety');
	await page.getByLabel('Your oven (°F)').fill('400');

	await page.getByRole('radio', { name: 'Celsius (°C)' }).click();
	await expect(page.getByLabel('Recipe oven (°C)')).toHaveValue('177');
	await page.getByLabel('Your oven (°C)').fill('200');
	await page.getByLabel('Your oven (°C)').fill('150');
	await expect(page.getByTestId('oven-warnings')).toContainText('cook this at 163°C (325°F)');
	await page.getByLabel('Your oven (°C)').fill('200');
	await expect(page.getByTestId('oven-change')).toContainText('less than the recipe');

	await page.getByLabel('Your oven (°C)').fill('60');
	await expect(page.getByRole('alert')).toContainText('hotter');
});
