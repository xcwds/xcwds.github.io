/** True when a key press is meant for a field (or a modifier shortcut), not for the page. */
export function typingIn(event: KeyboardEvent): boolean {
	if (event.ctrlKey || event.metaKey || event.altKey) return true;
	const el = event.target as HTMLElement | null;
	return !!el?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

/**
 * Svelte action for a search field: "/" anywhere on the page focuses it, like on most sites
 * with a search box (#95). Ignored while typing in another field.
 */
export function slashToFocus(input: HTMLInputElement) {
	input.setAttribute('aria-keyshortcuts', '/');
	const onKey = (event: KeyboardEvent) => {
		if (event.key !== '/' || typingIn(event)) return;
		event.preventDefault();
		input.focus();
		input.select();
	};
	window.addEventListener('keydown', onKey);
	return { destroy: () => window.removeEventListener('keydown', onKey) };
}
