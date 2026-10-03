import { expect, test } from '@playwright/test';

test('home page has expected h1', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();
});

test('home page links to recipes and utils', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: /Recipes/ }).click();
	await expect(page).toHaveURL(/\/recipes$/);
	await page.goto('/');
	await page.getByRole('link', { name: /Utils/ }).click();
	await expect(page).toHaveURL(/\/utils$/);
});
