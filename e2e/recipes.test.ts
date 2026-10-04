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

test('a servings target scales the ingredients', async ({ page }) => {
	await gotoHydrated(page, '/recipes/chocolate-chip-cookies');
	const list = page.getByTestId('ingredients');
	await expect(page.getByTestId('servings-target')).toHaveText('48 cookies');
	await expect(list).toContainText('2 ¼ cups all-purpose flour');
	await expect(list).toContainText('2 large eggs');

	await page.getByRole('button', { name: 'Fewer cookies' }).click();
	await page.getByRole('button', { name: 'Fewer cookies' }).click();
	await expect(page.getByTestId('servings-target')).toHaveText('24 cookies');
	await expect(list).toContainText('1 ⅛ cups all-purpose flour');
	await expect(list).toContainText('1 large egg, room temperature');
	await expect(page.getByTestId('scaled-note')).toContainText('×0.5');

	await page.getByRole('button', { name: 'Reset to 48 cookies' }).click();
	await expect(list).toContainText('2 ¼ cups all-purpose flour');
	await expect(page.getByTestId('scaled-note')).toHaveCount(0);
});

test('the oven panel estimates the time at another temperature', async ({ page }) => {
	await gotoHydrated(page, '/recipes/chocolate-chip-cookies');
	await page.getByText('Cooking at a different temperature?').click();
	const panel = page.getByTestId('oven-panel');
	await expect(panel).toContainText('The recipe says 375°F for 9–11 min.');
	await expect(panel.getByLabel('Your oven (°F)')).toHaveValue('350');
	await expect(page.getByTestId('oven-panel-time')).toHaveText('about 10–12 min');

	await panel.getByLabel('Your oven (°F)').fill('150');
	await expect(panel.getByRole('alert')).toContainText('hotter');
});
