import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

const pinned = (page: import('@playwright/test').Page) =>
	page.getByTestId('pinned').getByRole('link');

test('pin tools from Utils, reorder and unpin them on Home', async ({ page }) => {
	await gotoHydrated(page, '/');
	await expect(page.getByTestId('pinned')).toHaveCount(0);

	await gotoHydrated(page, '/utils');
	await page.getByRole('button', { name: 'Pin Coffee Timer to Home' }).click();
	await expect(page.getByTestId('toast')).toHaveText('Pinned to Home.');
	await page.getByRole('button', { name: 'Pin Cooking Timer to Home' }).click();
	await expect(page.getByRole('button', { name: 'Pin Coffee Timer to Home' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await gotoHydrated(page, '/');
	await expect(pinned(page)).toHaveText([/Coffee Timer$/, /Cooking Timer$/]);
	await page.getByRole('button', { name: 'Edit' }).click();
	await page.getByRole('button', { name: 'Move Cooking Timer up' }).click();
	await expect(pinned(page)).toHaveText([/Cooking Timer$/, /Coffee Timer$/]);

	// The order survives a reload.
	await page.reload();
	await expect(pinned(page)).toHaveText([/Cooking Timer$/, /Coffee Timer$/]);

	await page.getByRole('button', { name: 'Edit' }).click();
	await page.getByRole('button', { name: 'Unpin Coffee Timer' }).click();
	await expect(pinned(page)).toHaveText([/Cooking Timer$/]);

	// Pins one tap from Home.
	await pinned(page).first().click();
	await expect(page).toHaveURL(/\/utils\/cooking-timer$/);
});

test('recently used shows the last three tools opened, newest first', async ({ page }) => {
	for (const path of [
		'/utils/pizza-dough',
		'/recipes/brownies',
		'/utils/coffee-timer',
		'/utils/oven-time',
		'/utils/url-sanitizer'
	]) {
		await gotoHydrated(page, path);
	}
	await gotoHydrated(page, '/');
	await expect(page.getByTestId('recent').getByRole('link')).toHaveText([
		/URL Sanitizer$/,
		/Oven Time Converter$/,
		/Coffee Timer$/
	]);

	// A pinned tool isn't listed twice.
	await gotoHydrated(page, '/utils');
	await page.getByRole('button', { name: 'Pin URL Sanitizer to Home' }).click();
	await gotoHydrated(page, '/');
	await expect(page.getByTestId('recent').getByRole('link')).toHaveText([
		/Oven Time Converter$/,
		/Coffee Timer$/
	]);
});

test('shortcuts to tools that no longer exist are ignored', async ({ page }) => {
	await gotoHydrated(page, '/');
	await page.evaluate(() =>
		localStorage.setItem(
			'app:home:shortcuts',
			JSON.stringify({
				pins: ['/utils/retired-tool', '/utils/coffee-timer'],
				recent: ['/utils/retired-tool', '/utils/pizza-dough']
			})
		)
	);
	await page.reload();
	await expect(pinned(page)).toHaveText([/Coffee Timer$/]);
	await expect(page.getByTestId('recent').getByRole('link')).toHaveText([
		/Pizza Dough Calculator$/
	]);
});

test('clearing Home shortcuts in Settings clears them for good', async ({ page }) => {
	await gotoHydrated(page, '/utils');
	await page.getByRole('button', { name: 'Pin Coffee Timer to Home' }).click();
	await gotoHydrated(page, '/settings');
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Clear Home shortcuts' }).click();
	await expect(page.getByTestId('toast').last()).toHaveText('Cleared Home shortcuts.');

	// The same tab (no reload) shows it unpinned, and pinning something else doesn't bring it back.
	await page.getByRole('link', { name: 'Utils' }).first().click();
	await expect(page.getByRole('button', { name: 'Pin Coffee Timer to Home' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await page.getByRole('button', { name: 'Pin Cooking Timer to Home' }).click();
	await page.getByRole('link', { name: 'Home' }).first().click();
	await expect(pinned(page)).toHaveText([/Cooking Timer$/]);
});
