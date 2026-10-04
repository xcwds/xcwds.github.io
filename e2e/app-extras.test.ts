import { expect, test } from '@playwright/test';
import { porkChopsPath } from '../src/lib/parody';
import { gotoHydrated } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('shows an offline notice and a toast when back online', async ({ page, context }) => {
	await gotoHydrated(page, '/');
	await expect(page.getByTestId('offline-notice')).toHaveCount(0);
	await context.setOffline(true);
	await expect(page.getByTestId('offline-notice')).toHaveText('Offline · everything still works');
	await context.setOffline(false);
	await expect(page.getByTestId('offline-notice')).toHaveCount(0);
	await expect(page.getByTestId('toast')).toHaveText('Back online.');
});

test('Settings offers an install button when the browser can prompt', async ({ page }) => {
	await gotoHydrated(page, '/settings');
	const section = page.getByTestId('install');
	await expect(section).toContainText('Install app');

	// Simulate Chrome's beforeinstallprompt; the user accepts.
	await page.evaluate(() => {
		const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
			prompt: async () => {
				(window as unknown as { prompted: boolean }).prompted = true;
			},
			userChoice: Promise.resolve({ outcome: 'accepted' })
		});
		window.dispatchEvent(event);
	});
	await section.getByRole('button', { name: 'Install xcwds' }).click();
	expect(await page.evaluate(() => (window as unknown as { prompted: boolean }).prompted)).toBe(
		true
	);
	await expect(section).toHaveCount(0);
});

test.describe('on an iPhone', () => {
	test.use({
		userAgent:
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
	});

	test('Settings explains Add to Home Screen', async ({ page }) => {
		await gotoHydrated(page, '/settings');
		await expect(page.getByTestId('install')).toContainText('Add to Home Screen');
	});
});

test('honors reduced motion', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await gotoHydrated(page, '/utils/coffee-timer');
	const duration = await page
		.getByTestId('display')
		.locator('..')
		.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
	expect(duration).toBeLessThan(0.001);
});

test('keyboard focus is clearly visible', async ({ page }) => {
	await gotoHydrated(page, '/');
	await page.keyboard.press('Tab');
	const outline = await page.evaluate(() => {
		const style = getComputedStyle(document.activeElement as Element);
		return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
	});
	expect(outline.style).toBe('solid');
	expect(outline.width).toBeGreaterThanOrEqual(3);
});

test('every control is at least 44×44px on a phone', async ({ page }) => {
	const pages: [string, ((p: typeof page) => Promise<void>)?][] = [
		['/'],
		['/recipes'],
		['/recipes/pizza-dough'],
		[
			'/recipes/chocolate-chip-cookies',
			async (p) => {
				await p.getByRole('button', { name: 'More cookies' }).click();
				await p.getByText('Cooking at a different temperature?').click();
			}
		],
		['/utils'],
		['/utils/pizza-dough'],
		['/utils/coffee-timer'],
		['/utils/oven-time'],
		['/utils/cooking-timer', (p) => p.getByRole('button', { name: '5 min', exact: true }).click()],
		[
			'/utils/url-sanitizer',
			(p) => p.getByLabel('Paste a link').fill('https://a.com/?utm_source=x&b=1')
		],
		['/utils/weightlifting'],
		['/settings'],
		['/no-such-page'],
		[porkChopsPath]
	];
	const problems: string[] = [];
	for (const [path, setup] of pages) {
		await gotoHydrated(page, path);
		await setup?.(page);
		const small = await page.evaluate(() =>
			[...document.querySelectorAll('a, button, input, select, textarea, summary')]
				.filter((el) => (el as HTMLElement).offsetParent !== null)
				// Inline text links are exempt (WCAG 2.5.8); checkboxes use their label's hit area.
				.filter((el) => getComputedStyle(el).display !== 'inline')
				.map((el) => {
					const target =
						(el as HTMLInputElement).type === 'checkbox' ? (el.closest('label') ?? el) : el;
					const { width, height } = target.getBoundingClientRect();
					const name = el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName;
					return { name: name.slice(0, 40), width: Math.round(width), height: Math.round(height) };
				})
				.filter(({ width, height }) => width < 44 || height < 44)
				.map(({ name, width, height }) => `${name} (${width}×${height})`)
		);
		problems.push(...small.map((s) => `${path}: ${s}`));
	}
	expect(problems).toEqual([]);
});
