import { expect, test, type Locator } from '@playwright/test';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

/** Types into a field and leaves it, which is when Settings saves it. */
async function enter(field: Locator, value: string) {
	await field.fill(value);
	await field.press('Tab');
}

test('build the #82 home gym in Settings and lift with it (#84)', async ({ page }) => {
	await gotoHydrated(page, '/settings');
	await page.getByRole('button', { name: 'New set' }).click();
	await page.getByLabel('New set name').fill('Home gym');
	await page.getByRole('button', { name: 'Add set' }).click();
	await expect(page.getByTestId('toast')).toContainText('Set added');

	const home = page.getByTestId('set-set-1');
	await expect(home.locator('summary')).toContainText('Home gym (lb)');
	// A new set starts with no plates; enter what you have (35s stay at 0).
	for (const [plate, count] of [
		['45', '2'],
		['25', '2'],
		['10', '8'],
		['5', '4'],
		['2.5', '4'],
		['1.25', '4']
	])
		await enter(home.getByLabel(`${plate} lb plates`, { exact: true }), count);

	// No 45 lb barbell at home: the first bar becomes a 35, and its name follows.
	const bar = home.getByTestId('bar-bar-1');
	await enter(bar.getByLabel('Weight (lb)'), '35');
	await expect(bar.getByLabel('Name')).toHaveValue('Barbell (35 lb)');
	await expect(bar.getByRole('button', { name: 'Remove Barbell (35 lb)' })).toBeDisabled();

	await home.getByRole('button', { name: 'Add a bar' }).click();
	const handles = home.getByTestId('bar-bar-2');
	await handles.getByLabel('Type').selectOption({ label: 'Dumbbell handle' });
	await enter(handles.getByLabel('Weight (lb)'), '5');
	await enter(handles.getByLabel(/How many you have/), '2');
	await expect(home.locator('summary')).toContainText(
		'Barbell (35 lb), 2 × Dumbbell · 2 × 45, 2 × 25, 8 × 10, 4 × 5, 4 × 2.5, 4 × 1.25'
	);

	await page.getByLabel('Equipment set').selectOption({ label: 'Home gym (lb)' });
	await expect(home.locator('summary')).toContainText('· in use');

	await gotoHydrated(page, '/utils/weightlifting');
	const stations = page.getByRole('group', { name: 'Equipment' }).getByRole('button');
	await expect(stations).toHaveText(['Barbell (35 lb)', 'Dumbbell', 'Dumbbell pair']);
	await page.getByRole('button', { name: 'Target weight' }).click();
	await page.getByLabel('Target weight (lb)').fill('400');
	await expect(page.getByTestId('target-result')).toContainText('closest under is 290 lb');

	// Saved: it's all still there after a reload.
	await gotoHydrated(page, '/settings');
	await expect(page.getByTestId('set-set-1').locator('summary')).toContainText('2 × 45');
});

test('invalid numbers and names show why, keep their text, and are not saved (#84)', async ({
	page
}) => {
	await gotoHydrated(page, '/settings');
	await page.getByRole('button', { name: 'Copy Commercial gym' }).click();
	const copy = page.getByTestId('set-set-1');
	await expect(copy.locator('summary')).toContainText('Commercial gym copy (lb)');

	const tens = copy.getByLabel('10 lb plates', { exact: true });
	// The commercial gym's plates are unlimited, so the copy's fields start blank.
	await expect(tens).toHaveValue('');
	await expect(tens).toHaveAttribute('placeholder', 'Unlimited');
	await enter(tens, '2.5');
	await expect(copy.getByRole('alert')).toHaveText('Enter a whole number from 0 to 99.');
	await expect(tens).toHaveValue('2.5');
	await enter(tens, '6');
	await expect(copy.getByRole('alert')).toHaveCount(0);
	await expect(copy.locator('summary')).toContainText('6 × 10');

	const name = copy.getByLabel('Set name');
	await enter(name, '  ');
	await expect(copy.getByRole('alert')).toHaveText('Enter a name.');
	await enter(name, 'Garage');
	await expect(copy.locator('summary')).toContainText('Garage (lb)');

	const weight = copy.getByTestId('bar-barbell').getByLabel('Weight (lb)');
	await enter(weight, '');
	await expect(copy.getByRole('alert')).toHaveText('Enter a number.');
	await enter(weight, '45');
	await expect(copy.getByRole('alert')).toHaveCount(0);
});

test('deleting the set in use goes back to the commercial gym (#84)', async ({ page }) => {
	await gotoHydrated(page, '/settings');
	await page.getByRole('button', { name: 'Copy Commercial gym' }).click();
	const picker = page.getByLabel('Equipment set');
	await picker.selectOption({ label: 'Commercial gym copy (lb)' });

	const copy = page.getByTestId('set-set-1');
	await copy.getByRole('button', { name: 'Delete Commercial gym copy' }).click();
	await copy.getByRole('button', { name: 'Keep it' }).click();
	await expect(copy).toBeVisible();
	await copy.getByRole('button', { name: 'Delete Commercial gym copy' }).click();
	await copy.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByTestId('toast').filter({ hasText: 'Deleted' })).toHaveText(
		'Deleted Commercial gym copy.'
	);
	await expect(copy).toHaveCount(0);
	await expect(picker).toHaveValue('commercial');

	await gotoHydrated(page, '/utils/weightlifting');
	await expect(page.getByLabel('Equipment set').locator('option:checked')).toHaveText(
		'Commercial gym'
	);
});

test("a deleted set's errors don't come back on the next new set (#84)", async ({ page }) => {
	await gotoHydrated(page, '/settings');
	await page.getByRole('button', { name: 'New set' }).click();
	await page.getByRole('button', { name: 'Add set' }).click();
	const set = page.getByTestId('set-set-1');
	await enter(set.getByLabel('10 lb plates', { exact: true }), '2.5');
	await enter(set.getByTestId('bar-bar-1').getByLabel('Weight (lb)'), '-5');
	await expect(set.getByRole('alert')).toHaveCount(2);
	await set.getByRole('button', { name: 'Delete My equipment' }).click();
	await set.getByRole('button', { name: 'Delete', exact: true }).click();

	// Ids are reused, so the new set is set-1 again, with bar-1: it starts clean.
	await page.getByRole('button', { name: 'New set' }).click();
	await page.getByRole('button', { name: 'Add set' }).click();
	await expect(set.getByLabel('10 lb plates', { exact: true })).toHaveValue('0');
	await expect(set.getByTestId('bar-bar-1').getByLabel('Weight (lb)')).toHaveValue('45');
	await expect(set.getByRole('alert')).toHaveCount(0);
});
