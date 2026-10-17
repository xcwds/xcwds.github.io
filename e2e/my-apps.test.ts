import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

// Your apps (#224): apps people build from blocks with @xcwds/plugin-blocks, at /my-apps.
test.use({ viewport: { width: 390, height: 844 } });

/** Adds a template from Your apps, which opens it; returns its id. */
async function add(page: Page, name: string): Promise<string> {
	await gotoHydrated(page, '/my-apps');
	await page.getByRole('button', { name: new RegExp(`^Add ${name}`) }).click();
	await expect(page.getByTestId('blocks-app')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(new RegExp(`${name}$`));
	return (await page.getByTestId('blocks-app').getAttribute('data-app-id'))!;
}

test('Utils leads to Your apps, and every template adds and works', async ({ page }) => {
	await gotoHydrated(page, '/utils');
	await page.getByTestId('your-apps-link').click();
	await expect(page).toHaveURL('/my-apps');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Your apps$/);
	await expect(page.getByTestId('your-apps-empty')).toBeVisible();
	await expect(page.getByTestId('templates').getByRole('button')).toHaveText([
		/Add Chores/,
		/Add Water/,
		/Add Mood/,
		/Add Weight/,
		/Add Medication.*Private/,
		/Add Symptoms.*Private/
	]);

	await add(page, 'Chores');
	await expect(page.getByTestId('checklist-progress')).toHaveText('0 of 4 done');
	await page.getByRole('checkbox', { name: /Laundry/ }).check();
	await expect(page.getByTestId('checklist-progress')).toHaveText('1 of 4 done');

	await add(page, 'Water');
	await page.getByRole('button', { name: 'One more: Glasses today' }).click();
	await expect(page.getByTestId('counter-value')).toHaveText('1 / 8 glasses');

	await add(page, 'Mood');
	await page.getByRole('group', { name: 'Mood' }).getByText('4', { exact: true }).click();
	await page.getByRole('button', { name: 'Add entry' }).click();
	await expect(page.getByTestId('log-entry').first()).toContainText(/Mood\s*4 of 5/);

	await add(page, 'Weight');
	await page.getByLabel('Weight (lb)').fill('150');
	await page.getByRole('button', { name: 'Add entry' }).click();
	await expect(page.getByTestId('log-entry').first()).toContainText(/Weight\s*150 lb/);

	// The private ones open on the private page.
	for (const name of ['Medication', 'Symptoms']) {
		const id = await add(page, name);
		await expect(page).toHaveURL(`/my-apps/private#${id}`);
	}
	await page.getByLabel('Symptom').selectOption({ label: 'Tired' });
	await page.getByRole('group', { name: 'Severity' }).getByText('7', { exact: true }).click();
	await page.getByRole('button', { name: 'Add entry' }).click();
	await expect(page.getByTestId('log-entry').first()).toContainText(/Severity\s*7 of 10/);

	// Each one is a tool in Utils.
	await gotoHydrated(page, '/utils');
	for (const name of ['Chores', 'Water', 'Mood', 'Weight', 'Medication', 'Symptoms'])
		await expect(page.getByRole('button', { name: `Pin ${name} to Home` })).toBeVisible();
});

test('private apps stay out of Recently used', async ({ page }) => {
	await add(page, 'Water');
	await add(page, 'Medication');
	await gotoHydrated(page, '/');
	await expect(page.getByTestId('recent').getByRole('link')).toHaveText([/Water/]);
});

test('a new app is built, saved and opened', async ({ page }) => {
	await gotoHydrated(page, '/my-apps');
	await page.getByRole('link', { name: 'New app' }).click();
	await expect(page).toHaveURL('/my-apps/edit');
	const builder = page.getByTestId('builder');
	await builder.getByLabel('Name').fill('Push-ups');
	await builder.getByRole('button', { name: /^Add counter/ }).click();
	await builder.getByLabel('Heading').fill('Push-ups today');
	await builder.getByLabel('Goal').fill('50');
	await builder.getByLabel('Starts again').selectOption('daily');
	await builder.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/\/my-apps\/app#/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Push-ups$/);
	await page.getByRole('button', { name: 'One more: Push-ups today' }).click();
	await expect(page.getByTestId('counter-value')).toHaveText('1 / 50');
});

test("a design shared as a link opens in someone else's app, without the data", async ({
	page,
	browser
}) => {
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await add(page, 'Chores');
	await page.getByRole('checkbox', { name: /Laundry/ }).check();
	await gotoHydrated(page, '/my-apps');
	await page.getByRole('button', { name: 'Share design of Chores' }).click();
	await page.getByTestId('share-design').getByRole('button', { name: 'Copy link' }).click();
	const link = await page.evaluate(() => navigator.clipboard.readText());
	expect(link).toMatch(/\/my-apps\/import#app=[A-Za-z0-9_-]+$/);

	const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const theirs = await other.newPage();
	await gotoHydrated(theirs, link);
	await expect(theirs).toHaveURL(/\/my-apps\/import$/);
	await expect(theirs.getByTestId('import-preview')).toContainText('Clean the bathroom');
	await theirs.getByRole('button', { name: 'Add app' }).click();
	await expect(theirs.getByTestId('checklist-progress')).toHaveText('0 of 4 done');
	await other.close();
});

test('Your apps pages have no Share button in the installed app', async ({ page }) => {
	await page.addInitScript(() => {
		const real = window.matchMedia.bind(window);
		window.matchMedia = (query: string) => {
			const list = real(query);
			if (query === '(display-mode: standalone)')
				Object.defineProperty(list, 'matches', { value: true });
			return list;
		};
		Object.defineProperty(Navigator.prototype, 'share', {
			configurable: true,
			value: async () => {}
		});
	});
	await gotoHydrated(page, '/utils');
	await expect(page.locator('header').getByRole('button', { name: /^Share / })).toBeVisible();
	const id = await add(page, 'Water');
	await expect(page.locator('header').getByRole('button', { name: /^Share / })).toHaveCount(0);
	for (const path of ['/my-apps', '/my-apps/edit', `/my-apps/edit#${id}`, '/my-apps/import']) {
		await gotoHydrated(page, path);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(page.locator('header').getByRole('button', { name: /^Share / }), path).toHaveCount(
			0
		);
	}
});

test('turning Your apps off hides it and its apps', async ({ page }) => {
	await add(page, 'Water');
	await gotoHydrated(page, '/apps');
	await page
		.getByTestId('app-card')
		.filter({ has: page.getByText('Your apps', { exact: true }) })
		.getByRole('switch')
		.click();
	await gotoHydrated(page, '/utils');
	await expect(page.getByTestId('your-apps-link')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Pin Water to Home' })).toHaveCount(0);
	// Its pages still open, saying it's off.
	await gotoHydrated(page, '/my-apps');
	await expect(page.getByText(/turned off/i)).toBeVisible();
});
