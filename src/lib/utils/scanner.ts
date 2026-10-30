/**
 * The Document scanner (#215): which paper its PDF starts on. The scanning itself is
 * `app.scanner` from `@xcwds/plugin-scanner`.
 */
import type { Paper } from '@xcwds/plugin-scanner/client';

/**
 * Regions where Letter is the usual paper: the United States and Canada, and the parts of Latin
 * America and the Philippines that follow them. Everywhere else uses A4.
 */
const LETTER = new Set([
	'US',
	'PR',
	'CA',
	'MX',
	'CL',
	'CO',
	'CR',
	'DO',
	'GT',
	'PA',
	'PH',
	'SV',
	'VE'
]);

/**
 * The paper a scan starts on for `locales` (the browser's languages, most preferred first): Letter
 * where the first one's region uses it, else A4. A language without a region counts as the region
 * it most likely means (`en` as `en-US`, `fr` as `fr-FR`).
 */
export function localPaper(locales: readonly string[]): Paper {
	const first = locales[0];
	if (!first) return 'a4';
	try {
		const region = new Intl.Locale(first).maximize().region;
		return region && LETTER.has(region) ? 'letter' : 'a4';
	} catch {
		// Not a locale the browser understands.
		return 'a4';
	}
}
