import { expect, test } from '@playwright/test';
import { HOME_GYM, gotoHydrated, seedLifting, testGym } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('loads plates symmetrically, unevenly, and on dumbbells', async ({ page }) => {
	await seedLifting(page, { activeSet: 'test-lb', sets: [testGym('lb')] });
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

test("a bar's limits decide what the calculator loads (#71)", async ({ page }) => {
	const gym = testGym('lb');
	gym.bars[0] = { ...gym.bars[0], name: 'Barbell (35 lb)', weight: 35, maxLoad: 265 } as never;
	gym.bars[3] = { ...gym.bars[3], plates: [10], maxPlatesPerSide: 4 } as never;
	await seedLifting(page, { activeSet: gym.id, sets: [gym] });
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
});

test('a home gym only loads the plates it has (#82)', async ({ page }) => {
	await seedLifting(page, { activeSet: 'home', sets: [HOME_GYM] });
	await gotoHydrated(page, '/utils/weightlifting');
	await expect(page.getByTestId('active-set')).toContainText('Equipment: Home gym.');
	// Its own unit, its own bars: no unit switch, no 45 lb barbell, a dumbbell pair.
	await expect(page.getByRole('radiogroup', { name: 'Units' })).toHaveCount(0);
	const stations = page.getByRole('group', { name: 'Equipment' }).getByRole('button');
	await expect(stations).toHaveText(['Barbell (35 lb)', 'Dumbbell', 'Dumbbell pair']);

	// No 35s; one 45 a side uses both.
	await expect(page.getByRole('button', { name: 'Add 35 lb', exact: true })).toHaveCount(0);
	const add45 = page.getByRole('button', { name: 'Add 45 lb', exact: true });
	await add45.click();
	await expect(page.getByTestId('total')).toHaveText('125 lb');
	await expect(add45).toBeDisabled();

	// The heaviest it can load: 127.5 a side on the 35 lb bar.
	await page.getByRole('button', { name: 'Target weight' }).click();
	await page.getByLabel('Target weight (lb)').fill('400');
	await expect(page.getByTestId('target-result')).toContainText(
		'Per side: 45, 25, 10 × 4, 5 × 2, 2.5 × 2, 1.25 × 2'
	);
	await expect(page.getByTestId('target-result')).toContainText('closest under is 290 lb');
});

test('the commercial gym is a 45 lb barbell with every plate (#82)', async ({ page }) => {
	await gotoHydrated(page, '/utils/weightlifting');
	await expect(page.getByTestId('active-set')).toContainText('Equipment: Commercial gym.');
	const stations = page.getByRole('group', { name: 'Equipment' }).getByRole('button');
	await expect(stations).toHaveText(['Barbell (45 lb)']);
	await expect(page.getByRole('button', { name: /^Add / })).toHaveCount(7);
	await page.getByRole('button', { name: 'Target weight' }).click();
	await page.getByLabel('Target weight (lb)').fill('1005');
	await expect(page.getByTestId('target-result')).toContainText('Per side: 45 × 10, 25, 5');
});
