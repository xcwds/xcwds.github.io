import { noMetadata } from '@xcwds/plugin-camera/image';
import { describe, expect, it } from 'vitest';
import { cleanName, findings, formatBytes, formatTaken } from './photo-cleaner';

describe('findings', () => {
	it('says what was removed, in words, without coordinates', () => {
		expect(
			findings({
				...noMetadata(),
				exif: true,
				gps: true,
				camera: 'Google Pixel 8',
				taken: '2026:10:16 08:12:00',
				xmp: true
			})
		).toEqual([
			'GPS location: removed',
			'Camera (Google Pixel 8): removed',
			'Date taken (2026-10-16 08:12): removed',
			'Editing history (XMP): removed'
		]);
	});

	it('names EXIF on its own only when nothing more specific was found', () => {
		expect(findings({ ...noMetadata(), exif: true })).toEqual([
			'Other camera details (EXIF): removed'
		]);
		expect(findings({ ...noMetadata(), other: true })).toEqual([
			'Comments, captions or other text: removed'
		]);
		expect(findings(noMetadata())).toEqual([]);
	});
});

describe('formatTaken', () => {
	it('reads EXIF dates, and leaves anything else as written', () => {
		expect(formatTaken('2026:10:16 08:12:00')).toBe('2026-10-16 08:12');
		expect(formatTaken(' last Tuesday ')).toBe('last Tuesday');
	});
});

describe('cleanName', () => {
	it('keeps the name and uses the written type', () => {
		expect(cleanName('IMG_1234.HEIC', 'image/jpeg')).toBe('IMG_1234-clean.jpg');
		expect(cleanName('beach.trip.png', 'image/png')).toBe('beach.trip-clean.png');
		expect(cleanName('noext', 'image/webp')).toBe('noext-clean.webp');
		expect(cleanName('.jpg', 'image/jpeg')).toBe('photo-clean.jpg');
		expect(cleanName('x.jpg', 'image/gif')).toBe('x-clean.jpg');
	});
});

describe('formatBytes', () => {
	it('rounds like a file browser', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(840_400)).toBe('840 KB');
		expect(formatBytes(3_210_000)).toBe('3.2 MB');
	});
});
