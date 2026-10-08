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

test('a huge target weight answers right away instead of freezing the page (#32)', async ({
	page
}) => {
	await gotoHydrated(page, '/utils/weightlifting');
	await page.getByRole('button', { name: 'Target weight' }).click();
	const started = Date.now();
	await page.getByLabel('Target weight (lb)').fill('100000001');
	await expect(page.getByTestId('target-result')).toContainText("can't be loaded exactly", {
		timeout: 2000
	});
	expect(Date.now() - started).toBeLessThan(2000);
});

test('your own equipment limits what the calculator loads (#71)', async ({ page }) => {
	await gotoHydrated(page, '/settings');
	const kettlebell = page.getByTestId('setup-kettlebell');
	await kettlebell.getByText('Kettlebell').click();
	for (const plate of [45, 35, 25, 5, 2.5, 1.25])
		await kettlebell.getByRole('button', { name: `${plate} lb fits`, exact: true }).click();
	await kettlebell.getByLabel('Max plates on the post').fill('4');
	await kettlebell.getByLabel('Max plates on the post').press('Tab');
	await expect(kettlebell.locator('summary')).toContainText(
		'5 lb handle · 4 on the post · 10 only'
	);

	const barbell = page.getByTestId('setup-barbell');
	await barbell.locator('summary').click();
	await barbell.getByLabel('Bar weight (lb)').fill('35');
	await barbell.getByLabel('Bar weight (lb)').press('Tab');
	const max = barbell.getByLabel(/Max load/);
	await max.fill('5000');
	await max.press('Tab');
	await expect(barbell.getByRole('alert')).toHaveText('Enter a weight from 0 to 2000 lb.');
	// The rejected text stays in the field next to its error, and nothing is saved.
	await expect(max).toHaveValue('5000');
	await expect(barbell.locator('summary')).toContainText('35 lb bar');
	await expect(barbell.locator('summary')).not.toContainText('max');
	await max.fill('265');
	await max.press('Tab');
	await expect(barbell.getByRole('alert')).toHaveCount(0);
	await expect(barbell.locator('summary')).toContainText('Barbell (35 lb)');
	await expect(barbell.locator('summary')).toContainText('35 lb bar · max load 265 lb');

	await gotoHydrated(page, '/utils/weightlifting');
	const total = page.getByTestId('total');
	await expect(total).toHaveText('35 lb');
	await page.getByRole('button', { name: 'Target weight' }).click();
	await page.getByLabel('Target weight (lb)').fill('400');
	await expect(page.getByTestId('target-result')).toContainText(
		"400 lb is over this bar's 265 lb max load; the most it takes is 300 lb."
	);

	// Only 10s fit the kettlebell, four at most.
	await page.getByRole('button', { name: 'Kettlebell' }).click();
	await page.getByLabel('Target weight (lb)').fill('60');
	await expect(page.getByTestId('target-result')).toContainText('On the post: 10 × 4');
	await expect(page.getByTestId('target-result')).toContainText(
		'closest under is 45 lb (at most 4 plates on the post)'
	);
	await page.getByRole('button', { name: 'Load plates' }).click();
	await expect(page.getByRole('button', { name: /^Add / })).toHaveCount(1);
	const add = page.getByRole('button', { name: 'Add 10 lb' });
	for (let i = 0; i < 4; i++) await add.click();
	await expect(total).toHaveText('45 lb');
	await expect(add).toBeDisabled();

	// Back to standard brings the commercial-gym kettlebell back.
	await gotoHydrated(page, '/settings');
	await page.getByTestId('setup-kettlebell').locator('summary').click();
	await page
		.getByTestId('setup-kettlebell')
		.getByRole('button', { name: 'Back to standard' })
		.click();
	await expect(page.getByTestId('setup-kettlebell').locator('summary')).toContainText('Standard');
	await gotoHydrated(page, '/utils/weightlifting');
	await expect(page.getByRole('button', { name: /^Add / })).toHaveCount(7);
	await expect(page.getByRole('button', { name: 'Add 10 lb' })).toBeEnabled();
});
