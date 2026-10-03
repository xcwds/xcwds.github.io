// Renders the app icons in static/icons/ from scripts/icon-source.jpg (the GitHub avatar,
// https://github.com/xcwds.png) with headless Chromium.
// Usage: node scripts/generate-icons.mjs [path-to-chromium]
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const source = `data:image/jpeg;base64,${readFileSync(new URL('./icon-source.jpg', import.meta.url)).toString('base64')}`;

const icons = [
	// Regular icons get rounded corners; launchers that don't mask show them as-is.
	{ file: 'icon-192.png', size: 192, radius: 0.22 },
	{ file: 'icon-512.png', size: 512, radius: 0.22 },
	// Maskable and iOS icons are full-bleed: the OS crops them to its own shape.
	{ file: 'maskable-512.png', size: 512, radius: 0 },
	{ file: 'apple-touch-icon.png', size: 180, radius: 0 }
];

const browser = await chromium.launch({ executablePath: process.argv[2] });
const page = await browser.newPage();
for (const { file, size, radius } of icons) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(`<html><body style="margin:0;background:transparent">
		<img src="${source}" style="display:block;width:${size}px;height:${size}px;object-fit:cover;
			border-radius:${size * radius}px" />
		</body></html>`);
	await page.locator('img').evaluate((img) => img.decode());
	await page.screenshot({ path: `static/icons/${file}`, omitBackground: radius > 0 });
	console.log(`static/icons/${file}`);
}
await browser.close();
