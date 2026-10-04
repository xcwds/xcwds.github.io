import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

// This test "deploys" a new version by editing the service worker, so it serves its own copy of
// the build instead of the shared preview server other tests use.
let dir: string;
let server: Server;
let origin: string;

const TYPES: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.webmanifest': 'application/manifest+json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.ico': 'image/x-icon',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain'
};

async function resolveFile(pathname: string): Promise<string | null> {
	const base = join(dir, decodeURIComponent(pathname));
	for (const candidate of [base, `${base}.html`, join(base, 'index.html')]) {
		try {
			if ((await stat(candidate)).isFile()) return candidate;
		} catch {
			// Try the next candidate.
		}
	}
	return null;
}

test.beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'update-test-'));
	await cp('build', dir, { recursive: true });
	server = createServer(async (req, res) => {
		const file = await resolveFile(new URL(req.url ?? '/', 'http://x').pathname);
		if (!file) return res.writeHead(404).end();
		res.writeHead(200, {
			'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
			'cache-control': 'no-cache'
		});
		res.end(await readFile(file));
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

test.afterAll(async () => {
	await new Promise((resolve) => server?.close(resolve));
	if (dir) await rm(dir, { recursive: true, force: true });
});

const banner = (page: Page) => page.getByTestId('update-banner');

/**
 * "Deploys" a new version, then returns to the app until it notices. The app runs its own
 * update check on load; a check requested while that one is still in flight is merged into it
 * and sees the old file, so one visibilitychange isn't always enough.
 */
async function deployNewVersion(page: Page, marker: string) {
	await writeFile(join(dir, 'service-worker.js'), `\n// ${marker}\n`, { flag: 'a' });
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
