import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { latestChangelogId } from '../src/lib/changelog';
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
	// Listen before clicking: the reload can finish before a later waitForEvent starts.
	await Promise.all([
		page.waitForEvent('load'),
		banner(page).getByRole('button', { name: 'Update', exact: true }).click()
	]);
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

	await Promise.all([
		page.waitForEvent('load'),
		banner(page).getByRole('button', { name: 'Update', exact: true }).click()
	]);
	await expect(page.getByTestId('toast').first()).toContainText('App updated');
	expect(await pageVersion(page)).toBe('relaunch-test');
});

// #28: after one tab applies the update, the others are told to reload instead of getting stuck.
test('other open tabs are asked to reload after one tab updates', async ({ context }) => {
	const first = await context.newPage();
	await gotoHydrated(first, `${origin}/`);
	await waitForController(first);
	const second = await context.newPage();
	await gotoHydrated(second, `${origin}/recipes`);

	await deployNewVersion(first, 'multi-tab');
	await expect(async () => {
		await second.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
		await expect(banner(second)).toContainText('A new version is available.', { timeout: 1000 });
	}).toPass({ timeout: 15_000 });

	await Promise.all([
		first.waitForEvent('load'),
		banner(first).getByRole('button', { name: 'Update', exact: true }).click()
	]);
	expect(await pageVersion(first)).toBe('multi-tab');

	await expect(banner(second)).toContainText('Updated in another tab. Reload to finish updating.');
	expect(await pageVersion(second)).not.toBe('multi-tab');
	await Promise.all([
		second.waitForEvent('load'),
		banner(second).getByRole('button', { name: 'Reload', exact: true }).click()
	]);
	expect(await pageVersion(second)).toBe('multi-tab');
	await expect(second.getByTestId('toast').first()).toContainText('App updated');
	await expect(banner(second)).toHaveCount(0);
});

// #41: an update offers what's new since the user last looked; a fresh install shows nothing new.
test("after an update, the toast links to What's new with only the newer entries", async ({
	page
}) => {
	await gotoHydrated(page, `${origin}/settings`);
	await waitForController(page);
	// A fresh install marks nothing as new and saves nothing.
	await expect(page.getByTestId('whats-new-entry').first()).toBeVisible();
	await expect(page.getByTestId('whats-new-badge')).toHaveCount(0);
	expect(await page.evaluate(() => localStorage.getItem('app:settings:whats-new-seen'))).toBeNull();

	// Pretend the user last saw the entry before the newest one, then update from Settings
	// itself, which marks entries seen as it mounts.
	await page.evaluate(
		(id) => localStorage.setItem('app:settings:whats-new-seen', JSON.stringify(id)),
		latestChangelogId - 1
	);
	await deployNewVersion(page, 'whats-new');
	await Promise.all([
		page.waitForEvent('load'),
		banner(page).getByRole('button', { name: 'Update', exact: true }).click()
	]);
	const updated = page.getByTestId('toast').first();
	await expect(updated).toContainText('App updated.');
	// Both controls in an action toast meet the 44px tap-target baseline (it's not on the audited pages).
	for (const control of [
		updated.getByRole('button', { name: 'App updated.' }),
		updated.getByRole('link', { name: "See what's new" })
	]) {
		const box = (await control.boundingBox())!;
		expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
	}
	await updated.getByRole('link', { name: "See what's new" }).click();
	await expect(page).toHaveURL(/\/settings#whats-new$/);
	await expect(page.getByTestId('whats-new')).toBeInViewport();
	await expect(page.getByTestId('whats-new-badge')).toHaveCount(1);

	// Viewing them marks them seen.
	await gotoHydrated(page, `${origin}/settings`);
	await expect(page.getByTestId('whats-new-entry').first()).toBeVisible();
	await expect(page.getByTestId('whats-new-badge')).toHaveCount(0);
});
