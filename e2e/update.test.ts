import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';
import { serveStatic } from './static-server';

test.use({ viewport: { width: 390, height: 844 } });

// This test "deploys" a new version by editing the service worker, so it serves its own copy of
// the build instead of the shared preview server other tests use.
let dir: string;
let origin: string;
let close: (() => Promise<void>) | undefined;
/** The build version baked into the copied service worker (changed by each fake deploy). */
let currentVersion: string;

test.beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'update-test-'));
	await cp('build', dir, { recursive: true });
	currentVersion = JSON.parse(await readFile(join(dir, '_app/version.json'), 'utf8')).version;
	({ origin, close } = await serveStatic(dir));
});

test.afterAll(async () => {
	await close?.();
	if (dir) await rm(dir, { recursive: true, force: true });
});

const banner = (page: Page) => page.getByTestId('update-banner');

/** Marks every page in the copied build with `marker`, like a deploy that changes page content. */
async function stampPages(marker: string) {
	const files = (await readdir(dir, { recursive: true })).filter((f) => f.endsWith('.html'));
	for (const file of files) {
		const path = join(dir, file);
		const html = (await readFile(path, 'utf8')).replace(/<meta name="test-version"[^>]*>/, '');
		await writeFile(
			path,
			html.replace('</head>', `<meta name="test-version" content="${marker}"></head>`)
		);
	}
}

/** The version of the page being shown: the deploy marker, or "original". */
const pageVersion = (page: Page) =>
	page.evaluate(
		() => document.querySelector('meta[name="test-version"]')?.getAttribute('content') ?? 'original'
	);

/**
 * "Deploys" a new version (new pages and a changed service worker), then returns to the app until it notices. The app runs its own
 * update check on load; a check requested while that one is still in flight is merged into it
 * and sees the old file, so one visibilitychange isn't always enough.
 */
async function deployNewVersion(page: Page, marker: string) {
	await stampPages(marker);
	// A real deploy has a new build version, which names the new worker's cache. Without it the
	// new worker would install into the old worker's cache and overwrite its pages.
	const worker = join(dir, 'service-worker.js');
	const next = `${currentVersion.split('-')[0]}-${marker.replace(/\W/g, '')}`;
	const source = (await readFile(worker, 'utf8')).replaceAll(currentVersion, next);
	currentVersion = next;
	await writeFile(worker, `${source}\n// ${marker}\n`);
	await expect(async () => {
		await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
		await expect(banner(page)).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 15_000 });
}

const waitForController = (page: Page) =>
	page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) {
			await new Promise((resolve) =>
				navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
			);
		}
	});

test('a new version waits for the user, respects running timers, then updates', async ({
	page
}) => {
	await gotoHydrated(page, `${origin}/utils/coffee-timer`);
	await waitForController(page);
	await expect(banner(page)).toHaveCount(0);

	// Deploy a "new version", then come back to the app (which checks for updates).
	await deployNewVersion(page, 'next version');
	await expect(banner(page)).toContainText('A new version is available.');
	// The new version is waiting, not active.
	expect(await page.evaluate(async () => !!(await navigator.serviceWorker.ready).waiting)).toBe(
		true
	);

	// A running coffee timer would be reset by the reload, so the banner holds off.
	await page.getByRole('button', { name: 'Start' }).click();
	await expect(banner(page)).toContainText('Finish your coffee timer first.');
	page.once('dialog', (dialog) => dialog.dismiss());
	await banner(page).getByRole('button', { name: 'Update anyway' }).click();
	expect(await page.evaluate(async () => !!(await navigator.serviceWorker.ready).waiting)).toBe(
		true
	);

	await page.getByRole('button', { name: 'Pause' }).click();
	await banner(page).getByRole('button', { name: 'Update', exact: true }).click();
	await page.waitForEvent('load');
	await expect(page.getByTestId('toast')).toHaveText('App updated to the latest version.');
	expect(await page.evaluate(async () => !!(await navigator.serviceWorker.ready).waiting)).toBe(
		false
	);
	await expect(banner(page)).toHaveCount(0);
	await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 8000 });
});

test('the update banner can be dismissed and comes back on the next launch', async ({ page }) => {
	await gotoHydrated(page, `${origin}/`);
	await waitForController(page);
	await deployNewVersion(page, 'another version');
	await banner(page).getByRole('button', { name: 'Dismiss' }).click();
	await expect(banner(page)).toHaveCount(0);

	await gotoHydrated(page, `${origin}/recipes`);
	await expect(banner(page)).toContainText('A new version is available.');
});

// #27: until Update is tapped, relaunching must keep serving the old version's pages and code.
test('relaunching before Update keeps the old version; Update switches to the new one', async ({
	page
}) => {
	await gotoHydrated(page, `${origin}/`);
	await waitForController(page);
	const before = await pageVersion(page);

	await deployNewVersion(page, 'relaunch-test');
	for (const path of ['/', '/recipes', '/utils/coffee-timer']) {
		await gotoHydrated(page, `${origin}${path}`);
		expect(await pageVersion(page)).toBe(before);
	}
	await expect(banner(page)).toContainText('A new version is available.');

	await banner(page).getByRole('button', { name: 'Update', exact: true }).click();
	await page.waitForEvent('load');
	await expect(page.getByTestId('toast').first()).toContainText('App updated');
	expect(await pageVersion(page)).toBe('relaunch-test');
});
