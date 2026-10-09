import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const tabBar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const guideSwitch = (page: Page) =>
	page.getByRole('navigation', { name: 'Recipes or kitchen guide' });

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the Recipes tab switches between recipes and the kitchen guide', async ({ page }) => {
		await gotoHydrated(page, '/recipes');
		await expect(guideSwitch(page).getByRole('link', { name: 'Recipes' })).toHaveAttribute(
			'aria-current',
			'page'
		);

		await guideSwitch(page).getByRole('link', { name: 'Kitchen Guide' }).click();
		await expect(page).toHaveURL(/\/guide$/);
		await expect(heading(page)).toHaveText('Kitchen Guide');
		await expect(page.getByRole('link', { name: /^Back to/ })).toHaveCount(0);
		await expect(tabBar(page).getByRole('link', { name: 'Recipes' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await expect(guideSwitch(page).getByRole('link', { name: 'Kitchen Guide' })).toHaveAttribute(
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

		await page.getByRole('link', { name: 'Back to Kitchen Guide' }).click();
		await expect(page).toHaveURL(/\/guide$/);
	});

	test('the index has a Baking group that a link can open', async ({ page }) => {
		await gotoHydrated(page, '/guide#category-baking');
		const baking = page.getByRole('region', { name: 'Baking' });
		await expect(baking).toBeInViewport();
		await baking.getByRole('link', { name: /Measuring for Baking/ }).click();
		await expect(page).toHaveURL(/\/guide\/measuring-for-baking$/);
		await expect(page.getByTestId('guide-table-cards').first()).toContainText('All-purpose flour');
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
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

test('the doneness chart gives pull and done temperatures and starts a rest timer', async ({
	page
}) => {
	await gotoHydrated(page, '/guide/doneness-and-food-safety');
	const chart = page.getByTestId('doneness');
	const pull = page.getByTestId('doneness-pull');
	const done = page.getByTestId('doneness-target');

	// Beef steak, medium: at the USDA minimum, so it comes off right there.
	await expect(chart.getByRole('radio', { name: /^Medium \d/ })).toBeChecked();
	await expect(pull).toHaveText('145°F');
	await expect(page.getByTestId('doneness-overshoot')).toContainText('about 5°F higher');
	await expect(page.getByTestId('doneness-below-usda')).toHaveCount(0);

	await chart.getByRole('radio', { name: /^Rare/ }).click();
	await expect(pull).toHaveText('120°F');
	await expect(done).toHaveText('125°F');
	await expect(page.getByTestId('doneness-below-usda')).toBeVisible();

	await chart.getByRole('radio', { name: 'Celsius (°C)' }).click();
	await expect(pull).toHaveText('49°C');
	await expect(done).toHaveText('52°C');

	await chart.getByRole('radio', { name: /Chicken & turkey/ }).click();
	await expect(pull).toHaveText('74°C');
	await expect(page.getByTestId('doneness-below-usda')).toHaveCount(0);

	await chart.getByRole('button', { name: 'Start 5 min rest timer' }).click();
	await expect(page.getByTestId('toast')).toContainText('Chicken & turkey resting');
});
