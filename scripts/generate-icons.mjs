// Renders the PNG app icons and favicon.ico from static/icons/icon.svg (the source of truth)
// with headless Chromium. The icon is deliberately neutral: no faces, photos or text, so the
// app stays discreet on a home screen.
// Usage: node scripts/generate-icons.mjs [path-to-chromium]
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync(new URL('../static/icons/icon.svg', import.meta.url));
const source = `data:image/svg+xml;base64,${svg.toString('base64')}`;

const icons = [
	// Regular icons get rounded corners; launchers that don't mask show them as-is.
	{ file: 'static/icons/icon-192.png', size: 192, radius: 0.22 },
	{ file: 'static/icons/icon-512.png', size: 512, radius: 0.22 },
	// Maskable and iOS icons are full-bleed: the OS crops them to its own shape.
	{ file: 'static/icons/maskable-512.png', size: 512, radius: 0 },
	{ file: 'static/icons/apple-touch-icon.png', size: 180, radius: 0 },
	// For favicon.ico (browsers that ask for /favicon.ico directly).
	{ file: null, size: 32, radius: 0.18 }
];

const browser = await chromium.launch({ executablePath: process.argv[2] });
const page = await browser.newPage();
for (const { file, size, radius } of icons) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(`<html><body style="margin:0;background:transparent">
		<img src="${source}" style="display:block;width:${size}px;height:${size}px;
			border-radius:${size * radius}px" />
		</body></html>`);
	await page.locator('img').evaluate((img) => img.decode());
	const png = await page.screenshot({ omitBackground: true });
	if (file) {
		writeFileSync(file, png);
		console.log(file);
	} else {
		writeFileSync('static/favicon.ico', ico(png, size));
		console.log('static/favicon.ico');
	}
}
await browser.close();

/** Wraps a PNG in a single-image .ico container (PNG payloads are valid in ICO files). */
function ico(png, size) {
	const header = Buffer.alloc(22);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // type: icon
	header.writeUInt16LE(1, 4); // image count
	header.writeUInt8(size, 6); // width
	header.writeUInt8(size, 7); // height
	header.writeUInt8(0, 8); // palette size
	header.writeUInt8(0, 9); // reserved
	header.writeUInt16LE(1, 10); // color planes
	header.writeUInt16LE(32, 12); // bits per pixel
	header.writeUInt32LE(png.length, 14); // image size
	header.writeUInt32LE(22, 18); // image offset
	return Buffer.concat([header, png]);
}
