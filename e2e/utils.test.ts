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
	await page.getByRole('button', { name: 'Reset' }).click();
	await expect(display).toHaveText('1:30');

	// Adjusting before starting still changes the default, and it's saved.
	await page.getByRole('button', { name: '+30s' }).click();
	await expect(page.getByText('Resets to 2:00.')).toBeVisible();
	await page.reload();
	await expect(display).toHaveText('2:00');
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
