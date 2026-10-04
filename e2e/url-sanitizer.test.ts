import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

const link =
	'Check this out https://shop.example.com/item/42?color=red&utm_source=ig&utm_medium=social&fbclid=abc#reviews';

test('removes tracking params automatically and supports edits', async ({ page }) => {
	await gotoHydrated(page, '/utils/url-sanitizer');
	await page.getByLabel('Paste a link').fill(link);

	const cleaned = page.getByTestId('cleaned');
	await expect(cleaned).toHaveText('https://shop.example.com/item/42?color=red#reviews');
	await expect(page.getByTestId('param')).toHaveCount(4);
	await expect(page.getByText('3 of 4 removed')).toBeVisible();

	await page.getByLabel('Keep utm_source').check();
	await expect(cleaned).toHaveText(
		'https://shop.example.com/item/42?color=red&utm_source=ig#reviews'
	);
	await expect(page.getByText('1 known tracking param is still in the link.')).toBeVisible();

	await page.getByLabel('Value of utm_source').fill('nobody');
	await expect(cleaned).toContainText('utm_source=nobody');

	await page.getByRole('button', { name: 'Remove all' }).click();
	await expect(cleaned).toHaveText('https://shop.example.com/item/42#reviews');

	await page.getByRole('button', { name: 'Keep all' }).click();
	await expect(cleaned).toContainText('fbclid=abc');

	await page.getByRole('button', { name: 'Remove tracking' }).click();
	await expect(cleaned).toHaveText('https://shop.example.com/item/42?color=red#reviews');
});

test('unwraps redirect links and copies the result', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await gotoHydrated(page, '/utils/url-sanitizer');
	await page
		.getByLabel('Paste a link')
		.fill(
			'https://www.google.com/url?q=https%3A%2F%2Fnews.example.org%2Fstory%3Fid%3D7%26utm_campaign%3Dx&sa=D'
		);
	await page.getByRole('button', { name: /news\.example\.org/ }).click();

	const cleaned = page.getByTestId('cleaned');
	await expect(cleaned).toHaveText('https://news.example.org/story?id=7');
	await page.getByRole('button', { name: 'Copy' }).click();
	await expect(page.getByTestId('toast')).toHaveText('Link copied.');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
		'https://news.example.org/story?id=7'
	);
});

test('flags input that is not a link', async ({ page }) => {
	await gotoHydrated(page, '/utils/url-sanitizer');
	await page.getByLabel('Paste a link').fill('hello there');
	await expect(page.getByRole('alert')).toHaveText("That doesn't look like a link.");
});
