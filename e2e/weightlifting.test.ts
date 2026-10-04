import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('loads plates symmetrically, unevenly, and on dumbbells', async ({ page }) => {
	await gotoHydrated(page, '/utils/weightlifting');
	const total = page.getByTestId('total');
	await expect(total).toHaveText('45 lb');

	await page.getByRole('button', { name: 'Add 45 lb', exact: true }).click();
	await page.getByRole('button', { name: 'Add 25 lb', exact: true }).click();
	await expect(total).toHaveText('185 lb');

	await page.getByLabel('Same plates on both sides').uncheck();
	await page.getByRole('button', { name: 'Remove 25 lb right' }).click();
	await expect(total).toHaveText('160 lb');

	await page.getByRole('button', { name: 'Dumbbell pair' }).click();
	await page.getByRole('button', { name: 'Clear plates' }).click();
	await page.getByLabel('Same plates on both sides').check();
	await page.getByRole('button', { name: 'Add 10 lb', exact: true }).click();
	await expect(total).toHaveText('55 lb');
	await expect(page.getByText('2 dumbbells × 27.5 lb each')).toBeVisible();

	await page.getByRole('button', { name: 'Kettlebell' }).click();
	await expect(total).toHaveText('15 lb');
});

test('works out plates for a target weight and loads them', async ({ page }) => {
	await gotoHydrated(page, '/utils/weightlifting');
	await page.getByRole('button', { name: 'Target weight' }).click();
	await page.getByLabel('Target weight (lb)').fill('165');
	await expect(page.getByTestId('target-result')).toContainText('Per side: 35, 25');

	await page.getByRole('button', { name: '35', exact: true }).click();
	await expect(page.getByTestId('target-result')).toContainText('Per side: 45, 10, 5');

	await page.getByLabel('Target weight (lb)').fill('166');
	await expect(page.getByTestId('target-result')).toContainText('closest under is 165 lb');

	await page.getByRole('button', { name: 'Load these plates' }).click();
	await expect(page.getByTestId('total')).toHaveText('165 lb');
});

test('tracks a workout and copies it as text', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await gotoHydrated(page, '/utils/weightlifting');
	await page.getByRole('button', { name: 'Add 45 lb', exact: true }).click();

	await page.getByRole('tab', { name: 'Workout' }).click();
	await page.getByLabel('Date').fill('Sat, Oct 4, 2026');
	await page.getByRole('button', { name: '+ Add exercise' }).click();
	await page.getByLabel('Exercise 1 name').fill('Bench Press');
	await page.getByLabel('Bench Press set 1 weight').fill('95');
	await page.getByLabel('Bench Press set 1 reps').fill('8');
	await page.getByRole('button', { name: '+ Set', exact: true }).click();
	await page.getByRole('button', { name: '+ Set @ 135 lb' }).click();
	await page.getByLabel('Bench Press set 3 reps').fill('5');

	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(page.getByRole('tab', { name: 'Workout' })).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('exercise')).toHaveCount(1);

	await page.getByRole('button', { name: 'Copy workout' }).click();
	await expect(page.getByTestId('toast')).toHaveText('Workout copied.');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
		[
			'Workout – Sat, Oct 4, 2026',
			'',
			'Bench Press',
			'  2 sets × 8 reps @ 95 lb',
			'  1 set × 5 reps @ 135 lb'
		].join('\n')
	);
});
