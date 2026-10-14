/** At most this many suggestions show at once (#209): 5 × 44px stays clear of a phone keyboard. */
export const MAX_SUGGESTIONS = 5;

/**
 * The suggestions matching what's typed: a case-insensitive substring match, in the list's order,
 * at most `limit`. None for an empty field, or once it holds one of them exactly.
 */
export function suggest(
	typed: string,
	suggestions: readonly string[],
	limit = MAX_SUGGESTIONS
): string[] {
	const query = typed.trim().toLowerCase();
	if (!query || limit < 1) return [];
	if (suggestions.some((s) => s.toLowerCase() === query)) return [];
	return suggestions.filter((s) => s.toLowerCase().includes(query)).slice(0, limit);
}
