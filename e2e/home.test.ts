import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test('home page links to recipes and utils', async ({ page }) => {
	await gotoHydrated(page, '/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page
		.getByRole('main')
		.getByRole('link', { name: /Recipes/ })
		.click();
	await expect(page).toHaveURL(/\/recipes$/);
	await gotoHydrated(page, '/');
	await page.getByRole('main').getByRole('link', { name: /Utils/ }).click();
	await expect(page).toHaveURL(/\/utils$/);
});
