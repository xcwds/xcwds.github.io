import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test('recipes index filters by search and links to a recipe', async ({ page }) => {
	await gotoHydrated(page, '/recipes');
	await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();

	await page.getByRole('searchbox').fill('pizza');
	const links = page.getByRole('main').getByRole('link');
	await expect(links).toHaveCount(1);

	await links.first().click();
	await expect(page).toHaveURL(/\/recipes\/pizza-dough$/);
	await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible();
});
