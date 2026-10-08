import { expect, test, type Page } from '@playwright/test';
import { HOME_GYM, gotoHydrated, seedLifting } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

const defaults = (page: Page) => page.getByTestId('tool-defaults');

test('weightlifting switches to kg plates and bars', async ({ page }) => {
	await gotoHydrated(page, '/utils/weightlifting');
	const total = page.getByTestId('total');
	await page.getByRole('button', { name: 'Add 45 lb', exact: true }).click();
	await expect(total).toHaveText('135 lb');

	await page.getByRole('radio', { name: 'Kilograms (kg)' }).click();
	// Plate counts were in lb, so they're cleared.
	await expect(total).toHaveText('20 kg');
	await expect(page.getByRole('button', { name: 'Barbell (20 kg)' })).toBeVisible();
	await page.getByRole('button', { name: 'Add 20 kg', exact: true }).click();
	await expect(total).toHaveText('60 kg');

	await page.getByRole('button', { name: 'Target weight' }).click();
	await page.getByLabel('Target weight (kg)').fill('100');
	await expect(page.getByTestId('target-result')).toContainText('Per side: 25, 15');

	await page.getByRole('tab', { name: 'Workout' }).click();
	await expect(page.getByRole('button', { name: '+ Add exercise' })).toBeVisible();
	await page.getByRole('button', { name: '+ Add exercise' }).click();
	await expect(page.getByRole('columnheader', { name: 'Weight (kg)' })).toBeVisible();

	// The unit is a saved setting, also shown in Settings.
	await gotoHydrated(page, '/settings');
	await expect(defaults(page).getByRole('radio', { name: 'Kilograms (kg)' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
});

test('the weightlifting equipment set is picked in Settings (#82)', async ({ page }) => {
	await seedLifting(page, { activeSet: 'commercial', sets: [HOME_GYM] });
	await gotoHydrated(page, '/settings');
	const picker = defaults(page).getByLabel('Equipment set');
	await expect(picker).toHaveValue('commercial');
	await picker.selectOption({ label: 'Home gym (lb)' });

	await gotoHydrated(page, '/utils/weightlifting');
	await expect(page.getByLabel('Equipment set').locator('option:checked')).toHaveText('Home gym');
	await expect(page.getByRole('button', { name: 'Barbell (35 lb)' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.getByRole('link', { name: 'Edit your equipment sets' }).click();
	await expect(page).toHaveURL(/\/settings#equipment$/);
	await page.getByLabel('Equipment set').selectOption('commercial');
	await gotoHydrated(page, '/utils/weightlifting');
	await expect(page.getByRole('button', { name: 'Barbell (45 lb)' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('coffee timer starts from the default length', async ({ page }) => {
	await gotoHydrated(page, '/settings');
	await defaults(page).getByRole('button', { name: '15 seconds longer' }).click();
	await expect(page.getByTestId('coffee-default')).toHaveText('1:45');

	await gotoHydrated(page, '/utils/coffee-timer');
	await expect(page.getByTestId('display')).toHaveText('1:45');
	await page.getByRole('button', { name: '+30s' }).click();
	await page.getByRole('button', { name: 'Back to 1:45' }).click();
	await expect(page.getByTestId('display')).toHaveText('1:45');
});

test('cooking timer presets are customizable', async ({ page }) => {
	await gotoHydrated(page, '/settings');
	const input = defaults(page).getByLabel('Quick-start buttons');
	await input.fill('abc');
	await input.blur();
	await expect(defaults(page).getByRole('alert')).toContainText('Enter 1–12 numbers');

	await input.fill('7, 2, 90, 2');
	await input.blur();
	await expect(input).toHaveValue('2, 7, 90');
	await expect(defaults(page).getByRole('alert')).toHaveCount(0);

	await gotoHydrated(page, '/utils/cooking-timer');
	for (const name of ['2 min', '7 min', '1 hr 30 min']) {
		await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
	}
	await expect(page.getByRole('button', { name: '5 min', exact: true })).toHaveCount(0);
});

test('pizza dough defaults can be saved from the calculator and restored', async ({ page }) => {
	await gotoHydrated(page, '/utils/pizza-dough');
	const result = page.getByTestId('dough-result');
	await page.getByLabel('Dough balls').fill('6');
	await expect(result).toContainText('Total 1680 g');
	await page.getByRole('button', { name: 'Save as my defaults' }).click();
	await expect(page.getByTestId('toast')).toHaveText('Saved as your pizza dough defaults.');

	await gotoHydrated(page, '/utils/pizza-dough');
	await expect(result).toContainText('Total 1680 g');

	await gotoHydrated(page, '/settings');
	await expect(page.getByTestId('pizza-defaults')).toContainText('6 × 280 g');
	await defaults(page).getByRole('button', { name: 'Restore built-in pizza defaults' }).click();
	await gotoHydrated(page, '/utils/pizza-dough');
	await expect(result).toContainText('Total 1120 g');
});

test('saved weightlifting data from before units is upgraded', async ({ page }) => {
	await page.addInitScript(() => {
		if (sessionStorage.getItem('seeded')) return;
		sessionStorage.setItem('seeded', '1');
		localStorage.setItem('app:version', '1');
		localStorage.setItem(
			'app:weightlifting:calculator',
			JSON.stringify({
				equipmentId: 'barbell-25',
				mode: 'load',
				symmetric: true,
				sides: [{ 10: 1 }, {}],
				available: [45, 25, 10, 5]
			})
		);
	});
	await gotoHydrated(page, '/utils/weightlifting');
	// v3 (#82): the owned plates make it a set of your own, with the bar you'd picked.
	await expect(page.getByLabel('Equipment set').locator('option:checked')).toHaveText(
		'My equipment'
	);
	await expect(page.getByRole('button', { name: 'Barbell (25 lb)' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByTestId('total')).toHaveText('45 lb');
	// You didn't have 35s.
	await expect(page.getByRole('button', { name: 'Add 35 lb', exact: true })).toHaveCount(0);
	expect(await page.evaluate(() => localStorage.getItem('app:version'))).toBe('3');
});
