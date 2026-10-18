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
	await page.getByLabel('Seconds').fill('90');
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
