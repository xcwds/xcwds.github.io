// Renders the app icons in static/icons/ from an emoji with headless Chromium.
// Usage: node scripts/generate-icons.mjs [path-to-chromium]
import { chromium } from '@playwright/test';

const EMOJI = '🧰';
const BACKGROUND = '#bfdbfe'; // Tailwind blue-200, the site background

const icons = [
	// Regular icons: emoji fills most of the square.
	{ file: 'icon-192.png', size: 192, scale: 0.7, radius: 0.22 },
	{ file: 'icon-512.png', size: 512, scale: 0.7, radius: 0.22 },
	// Maskable: Android crops to a circle/squircle, so keep the emoji in the inner 60% safe zone.
	{ file: 'maskable-512.png', size: 512, scale: 0.5, radius: 0 },
	// iOS applies its own rounded corners.
	{ file: 'apple-touch-icon.png', size: 180, scale: 0.65, radius: 0 }
];

const browser = await chromium.launch({ executablePath: process.argv[2] });
const page = await browser.newPage();
for (const { file, size, scale, radius } of icons) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(`<html><body style="margin:0;background:transparent">
		<div style="width:${size}px;height:${size}px;background:${BACKGROUND};border-radius:${size * radius}px;
			display:flex;align-items:center;justify-content:center;font-size:${size * scale}px;line-height:1">
			${EMOJI}
		</div></body></html>`);
	await page.screenshot({ path: `static/icons/${file}`, omitBackground: radius > 0 });
	console.log(`static/icons/${file}`);
}
await browser.close();
