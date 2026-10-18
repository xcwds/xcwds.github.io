/**
 * The Photo Cleaner (#212): what a photo gave away, in words, and names for its clean copy. The
 * cleaning itself is `cleanImage` from `@xcwds/plugin-camera/image`.
 */
import type { ImageMetadata } from '@xcwds/plugin-camera/image';

/** Sizes the clean copy can be scaled down to (longest side, px); undefined keeps the size. */
export const SIZES = [
	{ label: 'Original size', maxSide: undefined },
	{ label: '2048 px', maxSide: 2048 },
	{ label: '1024 px', maxSide: 1024 }
] as const;

/** What the original carried, one line each; empty when it carried nothing. Never coordinates. */
export function findings(meta: ImageMetadata): string[] {
	const lines: string[] = [];
	if (meta.gps) lines.push('GPS location: removed');
	if (meta.camera) lines.push(`Camera (${meta.camera}): removed`);
	if (meta.taken) lines.push(`Date taken (${formatTaken(meta.taken)}): removed`);
	if (meta.exif && !meta.gps && !meta.camera && !meta.taken)
		lines.push('Other camera details (EXIF): removed');
	if (meta.xmp) lines.push('Editing history (XMP): removed');
	if (meta.other) lines.push('Comments, captions or other text: removed');
	return lines;
}

/** EXIF's `2026:10:16 08:12:00` as `2026-10-16 08:12`; anything else as written. */
export function formatTaken(taken: string): string {
	const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/.exec(taken.trim());
	return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : taken.trim();
}

const EXTENSIONS: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/png': 'png'
};

/** `IMG_1234.HEIC` → `IMG_1234-clean.jpg`, with the extension of the type that was written. */
export function cleanName(original: string, type: string): string {
	const base = original.replace(/\.[^./\\]*$/, '').trim() || 'photo';
	return `${base}-clean.${EXTENSIONS[type] ?? 'jpg'}`;
}

/** A file size the way people read it: `840 KB`, `3.2 MB`. */
export function formatBytes(bytes: number): string {
	if (bytes < 1000) return `${bytes} B`;
	if (bytes < 1000 * 1000) return `${Math.round(bytes / 1000)} KB`;
	return `${(bytes / 1000 / 1000).toFixed(1)} MB`;
}
