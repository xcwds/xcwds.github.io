import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const tabBar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const guideSwitch = (page: Page) =>
	page.getByRole('navigation', { name: 'Recipes or cooking guide' });

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the Recipes tab switches between recipes and the cooking guide', async ({ page }) => {
		await gotoHydrated(page, '/recipes');
		await expect(guideSwitch(page).getByRole('link', { name: 'Recipes' })).toHaveAttribute(
			'aria-current',
			'page'
		);

		await guideSwitch(page).getByRole('link', { name: 'Cooking Guide' }).click();
		await expect(page).toHaveURL(/\/guide$/);
		await expect(heading(page)).toHaveText('Cooking Guide');
		await expect(page.getByRole('link', { name: /^Back to/ })).toHaveCount(0);
		await expect(tabBar(page).getByRole('link', { name: 'Recipes' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await expect(guideSwitch(page).getByRole('link', { name: 'Cooking Guide' })).toHaveAttribute(
			'aria-current',
			'page'
		);

		await guideSwitch(page).getByRole('link', { name: 'Recipes' }).click();
		await expect(page).toHaveURL(/\/recipes$/);
		await expect(heading(page)).toHaveText('Recipes');
	});

	test('the guide index searches articles and opens one', async ({ page }) => {
		await gotoHydrated(page, '/guide');
		await expect(page.getByRole('heading', { name: 'Cooking methods' })).toBeVisible();

		await page.getByRole('searchbox').fill('nothing-matches-this');
		await expect(page.getByText('No articles match')).toBeVisible();

		await page.getByRole('searchbox').fill('broil');
		await page.getByRole('link', { name: /Grill, Stovetop or Oven\?/ }).click();
		await expect(page).toHaveURL(/\/guide\/grill-stovetop-or-oven$/);
		await expect(heading(page)).toHaveText(/Grill, Stovetop or Oven\?/);
		await expect(tabBar(page).getByRole('link', { name: 'Recipes' })).toHaveAttribute(
			'aria-current',
			'page'
		);

		await page.getByRole('link', { name: 'Back to Cooking Guide' }).click();
		await expect(page).toHaveURL(/\/guide$/);
	});

	test('an article shows tables as cards and links to recipes and tools', async ({ page }) => {
		await gotoHydrated(page, '/guide/grill-stovetop-or-oven');
		const cards = page.getByTestId('guide-table-cards').first();
		await expect(cards).toBeVisible();
		await expect(cards).toContainText('Stovetop');
		await expect(page.getByRole('table')).toBeHidden();
		// Nothing makes the page scroll sideways.
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);

		await page.getByRole('link', { name: 'whole roast chicken' }).click();
		await expect(page).toHaveURL(/\/recipes\/roast-chicken$/);
		await page.goBack();

		const related = page.getByRole('region', { name: 'Related' });
		await related.getByRole('link', { name: 'Oven Time Converter' }).click();
		await expect(page).toHaveURL(/\/utils\/oven-time$/);
	});
});

test('on a wide screen, an article shows tables as tables', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await gotoHydrated(page, '/guide/grill-stovetop-or-oven');
	const table = page.getByRole('table').first();
	await expect(table).toBeVisible();
	await expect(table.getByRole('rowheader', { name: 'Oven' })).toBeVisible();
	await expect(page.getByTestId('guide-table-cards').first()).toBeHidden();
});
