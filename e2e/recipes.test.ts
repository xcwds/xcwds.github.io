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

	await expect(panel.getByTestId('oven-warnings')).toHaveCount(0);

	await panel.getByLabel('Your oven (°F)').fill('150');
	await expect(panel.getByRole('alert')).toContainText('hotter');
});

test('the oven panel warns about unsafe temperatures for meat', async ({ page }) => {
	await gotoHydrated(page, '/recipes/roast-chicken');
	await page.getByText('Cooking at a different temperature?').click();
	const panel = page.getByTestId('oven-panel');
	await expect(panel.getByLabel('Your oven (°F)')).toHaveValue('400');
	await expect(panel.getByTestId('oven-warnings')).toHaveCount(0);

	await panel.getByLabel('Your oven (°F)').fill('250');
	const warnings = panel.getByTestId('oven-warnings');
	await expect(warnings).toContainText('Food safety: cook this at 325°F (163°C) or hotter.');
	await expect(warnings).toContainText('big change');
	// Announced through a live region that was already in the page.
	await expect(panel.getByRole('status')).toContainText('Food safety');
});

test('a step timer starts in the tray, rings, and shows in the Cooking Timer', async ({ page }) => {
	await page.clock.install();
	await gotoHydrated(page, '/recipes/chocolate-chip-cookies');
	await expect(page.getByTestId('timer-tray')).toHaveCount(0);

	await page.getByRole('button', { name: 'Start 9 min timer' }).click();
	await expect(page.getByTestId('toast')).toHaveText('Started a 9 min timer: Cookies.');
	const tray = page.getByTestId('timer-tray');
	await expect(tray).toContainText('Cookies');
	await expect(tray.getByRole('timer')).toHaveText('9:00');

	await page.clock.runFor(9 * 60_000 + 1000);
	await expect(tray.getByRole('timer')).toHaveText('Done!');
	await tray.getByRole('button', { name: '+1 min' }).click();
	await expect(tray.getByRole('timer')).toHaveText(/^(1:00|0:5\d)$/);

	// The same saved timer is on the Cooking Timer page.
	await tray.getByRole('link', { name: 'All timers' }).click();
	await expect(page).toHaveURL(/\/utils\/cooking-timer$/);
	await expect(page.getByText('Cookies')).toBeVisible();
});

test('oven step timers follow the different-temperature panel while it is open', async ({
	page
}) => {
	await gotoHydrated(page, '/recipes/chocolate-chip-cookies');
	await expect(page.getByRole('button', { name: 'Start 9 min timer' })).toBeVisible();
	await page.getByText('Cooking at a different temperature?').click();
	// The pre-filled suggestion (350°F) isn't applied until you enter a temperature.
	await expect(page.getByRole('button', { name: 'Start 9 min timer' })).toBeVisible();
	await page.getByTestId('oven-panel').getByLabel('Your oven (°F)').fill('350');
	await expect(page.getByRole('button', { name: 'Start 10 min timer (at 350°F)' })).toBeVisible();
	await page.getByText('Cooking at a different temperature?').click();
	await expect(page.getByRole('button', { name: 'Start 9 min timer' })).toBeVisible();
});

test('ingredients switch between US and metric, and the choice is kept', async ({ page }) => {
	await gotoHydrated(page, '/recipes/chocolate-chip-cookies');
	const list = page.getByTestId('ingredients');
	const units = page.getByRole('radiogroup', { name: 'Recipe units' });
	await expect(units.getByRole('radio', { name: 'US' })).toHaveAttribute('aria-checked', 'true');
	await expect(page.getByTestId('units-note')).toHaveCount(0);

	await units.getByRole('radio', { name: 'Metric' }).click();
	await expect(list).toContainText('280 g all-purpose flour');
	await expect(list).toContainText('1 tsp baking soda');
	await expect(page.getByTestId('units-note')).toContainText('Converted from US measures');
	// Scaling and units combine.
	await page.getByRole('button', { name: 'Fewer cookies' }).click();
	await page.getByRole('button', { name: 'Fewer cookies' }).click();
	await expect(list).toContainText('140 g all-purpose flour');

	// The choice applies to other recipes: pizza dough (written in grams) stays metric...
	await gotoHydrated(page, '/recipes/pizza-dough');
	await expect(page.getByTestId('ingredients')).toContainText('650 g bread flour');
	// ...and US shows the recipe's own US measures.
	await page.getByRole('radio', { name: 'US' }).click();
	await expect(page.getByTestId('ingredients')).toContainText('23 oz bread flour');
	await expect(page.getByTestId('ingredients')).toContainText('2 tsp active dry yeast');
	await expect(page.getByTestId('units-note')).toContainText('Converted from metric measures');

	// Settings can go back to each recipe as written.
	await gotoHydrated(page, '/settings');
	await page.getByRole('radio', { name: 'As written' }).click();
	await gotoHydrated(page, '/recipes/pizza-dough');
	await expect(page.getByTestId('ingredients')).toContainText('650 g bread flour');
	await expect(page.getByRole('radio', { name: 'Metric' })).toHaveAttribute('aria-checked', 'true');
});

test('roast chicken scales by whole chickens', async ({ page }) => {
	await gotoHydrated(page, '/recipes/roast-chicken');
	await page.getByRole('button', { name: 'More servings' }).click();
	await expect(page.getByTestId('servings-target')).toHaveText('8 servings');
	await expect(page.getByTestId('ingredients')).toContainText('2 whole chickens (4–5 lb / 1.8–2.3 kg each)');
});
