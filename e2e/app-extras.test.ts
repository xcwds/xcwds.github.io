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
	await expect(section).toContainText('Install the app');

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
	await section.getByRole('button', { name: 'Install app' }).click();
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

// Phone, tablet portrait and landscape, and computer (#95): each layout has its own controls.
for (const [name, viewport] of [
	['a phone', { width: 390, height: 844 }],
	['a tablet in portrait', { width: 820, height: 1180 }],
	['a tablet in landscape', { width: 1180, height: 820 }],
	['a computer', { width: 1440, height: 900 }]
] as const) {
	test(`every control is at least 44×44px on ${name}`, async ({ page }) => {
		await page.setViewportSize(viewport);
		const pages: [string, ((p: typeof page) => Promise<void>)?][] = [
			['/'],
			[
				'/',
				async (p) => {
					await p.evaluate(() =>
						localStorage.setItem(
							'app:home:shortcuts',
							JSON.stringify({
								pins: ['/utils/coffee-timer', '/utils/cooking-timer'],
								recent: ['/utils/pizza-dough']
							})
						)
					);
					await p.reload();
					await p.getByRole('button', { name: 'Edit' }).click();
				}
			],
			['/recipes'],
			['/recipes/pizza-dough'],
			[
				'/recipes/banana-bread',
				(p) =>
					p
						.getByLabel('Your pan')
						.selectOption('square-9')
						.then(() => {})
			],
			[
				'/recipes/chocolate-chip-cookies',
				async (p) => {
					await p.getByRole('button', { name: 'More cookies' }).click();
					await p.getByText('Cooking at a different temperature?').click();
					await p.getByRole('button', { name: /^Start \d+ min timer/ }).click();
					await p.getByTestId('timer-tray').waitFor();
				}
			],
			['/guide'],
			['/guide/grill-stovetop-or-oven'],
			['/guide/doneness-and-food-safety'],
			['/guide/measuring-for-baking'],
			['/guide/beef'],
			['/guide/eggs'],
			['/utils'],
			['/apps'],
			['/utils/pizza-dough'],
			['/utils/coffee-timer'],
			['/utils/oven-time'],
			['/utils/microwave-time'],
			[
				'/utils/cooking-timer',
				(p) => p.getByRole('button', { name: '5 min', exact: true }).click()
			],
			[
				'/utils/url-sanitizer',
				(p) => p.getByLabel('Paste a link').fill('https://a.com/?utm_source=x&b=1')
			],
			['/utils/qr', (p) => p.getByLabel('Text or link').fill('https://example.com')],
			['/utils/weightlifting'],
			[
				'/utils/weightlifting',
				// The exercise name's suggestions, open (#209).
				async (p) => {
					await p.getByRole('tab', { name: 'Workout' }).click();
					await p.getByRole('button', { name: '+ Add exercise' }).click();
					await p.getByRole('combobox', { name: 'Exercise 1 name' }).pressSequentially('squ');
					await p.getByRole('option', { name: 'Squat', exact: true }).waitFor();
				}
			],
			[
				'/utils/self-control',
				async (p) => {
					await p.getByRole('button', { name: 'Add a habit' }).click();
					await p.getByRole('button', { name: '🍪 Snacking' }).click();
					await p.getByRole('button', { name: 'Add habit' }).click();
					await p.getByRole('button', { name: 'Add a habit' }).click();
				}
			],
			['/utils/camera', (p) => p.getByText('What stays private').click()],
			['/utils/self-control/sos'],
			['/utils/self-control/why'],
			['/utils/self-control/seesaw'],
			[
				'/utils/self-control/environment',
				// Snacking, from the hub's step before.
				async (p) => {
					await p.getByRole('checkbox', { name: 'Put fruit on the counter' }).check();
					await p.getByLabel('If…').fill('Bored');
					await p.getByRole('button', { name: 'Stand up and walk' }).click();
					await p.getByRole('button', { name: 'Add plan' }).click();
				}
			],
			['/utils/self-control/review'],
			['/my-apps'],
			[
				'/my-apps',
				// A log from a template (it opens at /my-apps/app#<id>).
				async (p) => {
					await p.getByRole('button', { name: /^Add Mood/ }).click();
					await p.getByTestId('blocks-app').waitFor();
				}
			],
			['/my-apps/edit', (p) => p.getByRole('button', { name: /^Add log/ }).click()],
			['/my-apps/import'],
			[
				'/utils/last-done',
				async (p) => {
					await p.getByRole('button', { name: 'Add something' }).click();
					await p.getByLabel('Name').fill('Vacuum');
					await p.getByRole('button', { name: 'Add', exact: true }).click();
					await p.getByRole('button', { name: 'Done: Vacuum' }).click();
					await p.getByRole('button', { name: 'Done earlier: Vacuum' }).click();
				}
			],
			[
				'/utils/last-done',
				// The thing's page, with its history, from the step before.
				async (p) => {
					await p.getByRole('link', { name: 'Vacuum' }).click();
					await p.getByTestId('history').waitFor();
				}
			],
			[
				'/utils/self-control/cues',
				async (p) => {
					await p.getByText('What was going on? (optional)').click();
				}
			],
			[
				'/utils/self-control/cues',
				async (p) => {
					await p.getByRole('button', { name: 'Gave in' }).click();
					await p.getByRole('button', { name: 'Log it' }).click();
					await p.getByRole('button', { name: /^Edit the urge/ }).click();
				}
			],
			[
				'/utils/self-control/seesaw',
				async (p) => {
					await p.getByTestId('side-give-now').getByRole('textbox').fill('Comfort');
					await p.getByTestId('side-give-now').getByRole('button', { name: 'Add' }).click();
				}
			],
			[
				'/utils/self-control/why',
				async (p) => {
					await p.getByLabel('Add a reason').fill('Sleep');
					await p.getByRole('button', { name: 'Add', exact: true }).click();
					await p.getByRole('button', { name: 'Edit: Sleep' }).click();
				}
			],
			[
				'/utils/self-control/sos',
				async (p) => {
					await p.getByRole('button', { name: 'Start surfing' }).click();
					await p.getByRole('button', { name: 'Rate it now' }).click();
				}
			],
			[
				'/utils/self-control/sos',
				// The session from the step before is still running.
				async (p) => {
					await p.getByRole('button', { name: 'It passed' }).click();
					await p.getByRole('button', { name: 'Gave in' }).click();
				}
			],
			[
				'/utils/self-control/sos',
				async (p) => {
					// Finish the session from the step before, then start a writing technique.
					await p.getByRole('button', { name: 'Gave in' }).click();
					await p.getByRole('button', { name: 'Save', exact: true }).click();
					await gotoHydrated(p, '/utils/self-control/sos');
					await p.getByRole('button', { name: 'Talk to yourself like a friend' }).click();
					await p.getByRole('button', { name: 'Start', exact: true }).click();
				}
			],
			[
				'/utils/self-control/sos',
				// Leave the writing step for the sprint's action list.
				async (p) => {
					await p.getByRole('button', { name: 'Done' }).click();
					await p.getByRole('button', { name: 'Yes' }).click();
					await gotoHydrated(p, '/utils/self-control/sos');
					await p.getByRole('button', { name: 'Sprint' }).click();
					await p.getByRole('button', { name: 'Start', exact: true }).click();
				}
			],
			['/utils/self-control/sos', (p) => p.getByRole('button', { name: 'Step outside' }).click()],
			['/settings'],
			[
				'/settings',
				async (p) => {
					await p.getByRole('button', { name: 'Copy Commercial gym' }).click();
					await p
						.getByTestId('set-set-1')
						.getByRole('button', { name: /^Delete / })
						.click();
					await p.getByRole('button', { name: 'New set' }).click();
				}
			],
			['/no-such-page'],
			[porkChopsPath]
		];
		const problems: string[] = [];
		for (const [path, setup] of pages) {
			await gotoHydrated(page, path);
			await setup?.(page);
			const small = await page.evaluate(() =>
				[
					...document.querySelectorAll(
						'a, button, input, select, textarea, summary, [role="option"]'
					)
				]
					.filter((el) => (el as HTMLElement).offsetParent !== null)
					// Inline text links are exempt (WCAG 2.5.8); checkboxes and radio buttons use their
					// label's hit area.
					.filter((el) => getComputedStyle(el).display !== 'inline')
					.map((el) => {
						const target = ['checkbox', 'radio'].includes((el as HTMLInputElement).type)
							? (el.closest('label') ?? el)
							: el;
						const { width, height } = target.getBoundingClientRect();
						const name = el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName;
						return {
							name: name.slice(0, 40),
							width: Math.round(width),
							height: Math.round(height)
						};
					})
					.filter(({ width, height }) => width < 44 || height < 44)
					.map(({ name, width, height }) => `${name} (${width}×${height})`)
			);
			problems.push(...small.map((s) => `${path}: ${s}`));
		}
		expect(problems).toEqual([]);
	});
}
