import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

// Microwave Time Converter (#229): the package time for your wattage and power level.
test.use({ viewport: { width: 390, height: 844 } });

test('converts the package time, and remembers your microwave', async ({ page }) => {
	await gotoHydrated(page, '/utils/microwave-time');
	const time = page.getByTestId('microwave-time');
	// 3:00 for 1100 W, in the default 1000 W microwave.
	await expect(time).toHaveText('3:20');
	await expect(page.getByTestId('microwave-change')).toHaveText('0:20 more than the package');

	await page.getByLabel('Wattage (W)').fill('700');
	await expect(time).toHaveText('4:45');
	await page.getByLabel('Power level').selectOption('50');
	await expect(time).toHaveText('9:25');
	await expect(page.getByTestId('oven-warnings')).toContainText('rough');

	await page.getByLabel('Minutes').fill('');
	await page.getByLabel('Seconds').fill('');
	await expect(page.getByRole('alert')).toHaveText('The package time must be more than 0.');
	await page.getByLabel('Minutes').fill('-1');
	await page.getByLabel('Seconds').fill('90');
	await expect(page.getByRole('alert')).toHaveText('Minutes and seconds can’t be negative.');
	await page.getByLabel('Minutes').fill('');
	await expect(time).toHaveText('4:45');

	await page.getByRole('button', { name: 'Save as my microwave' }).click();
	await expect(page.getByTestId('toast')).toContainText('Saved: your microwave is 700 W.');
	await expect(page.getByRole('button', { name: 'Save as my microwave' })).toBeDisabled();

	// Settings shows it, and changing it there changes what the converter starts with.
	await gotoHydrated(page, '/settings');
	await expect(page.getByText('700 W')).toBeVisible();
	await page.getByRole('button', { name: 'More Microwave wattage' }).click();
	await expect(page.getByText('750 W')).toBeVisible();
	await gotoHydrated(page, '/utils/microwave-time');
	await expect(page.getByLabel('Wattage (W)')).toHaveValue('750');
});

test('gives a starting time by food, amount and state', async ({ page }) => {
	await gotoHydrated(page, '/utils/microwave-time');
	await page.getByRole('button', { name: 'A food' }).click();
	await expect(page.getByRole('button', { name: 'A food' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	const time = page.getByTestId('microwave-time');
	// Soup from the fridge, 1 cup at 1000 W; no package fields or power level here.
	await expect(time).toHaveText('1:30');
	await expect(page.getByLabel('Minutes')).toHaveCount(0);
	await expect(page.getByLabel('Power level')).toHaveCount(0);
	await expect(page.getByTestId('microwave-result')).toContainText('steaming hot');

	await page.getByRole('button', { name: 'More' }).click();
	await expect(page.getByTestId('microwave-amount')).toContainText('2 cups');
	await expect(time).toHaveText('2:35');
	await page.getByRole('button', { name: 'Frozen' }).click();
	await expect(page.getByTestId('microwave-result')).toContainText('at 50% power');
	await expect(time).toHaveText('8:40');

	// A weaker microwave takes longer, and a food with one way to start shows no choice.
	await page.getByLabel('Wattage (W)').fill('700');
	await expect(time).toHaveText('12:25');
	await page.getByLabel('Wattage (W)').fill('450');
	await expect(page.getByTestId('oven-warnings')).toContainText('for a 1000 W microwave');
	await expect(page.getByTestId('oven-warnings')).not.toContainText('package');
	await page.getByLabel('Wattage (W)').fill('700');
	await page.getByLabel('Food').selectOption({ label: 'Potato, whole' });
	await expect(page.getByRole('group', { name: 'Starting from' })).toHaveCount(0);
	await expect(page.getByTestId('microwave-amount')).toContainText('2 medium potatoes');
	await expect(page.getByTestId('microwave-tip')).toContainText('Prick it all over');
	await expect(page.getByTestId('microwave-result')).not.toContainText('steaming hot');

	// One plate at a time: the amount stops at the food's most.
	await page.getByLabel('Food').selectOption({ label: 'Plate of leftovers' });
	await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0);
	await expect(page.getByText('One plate at a time.')).toBeVisible();

	// Back to the package: its fields and power level return.
	await page.getByRole('button', { name: 'The package' }).click();
	await expect(page.getByLabel('Power level')).toBeVisible();
	await expect(page.getByTestId('microwave-change')).toBeVisible();
});
