import type { Pathname } from '$app/types';

/** App-wide toasts: short confirmations like "Link copied." shown above the tab bar. */
/** A link shown next to the message: an app page, plus an optional `#hash` on it. */
export type ToastAction = { label: string; path: Pathname; hash?: string };
export type Toast = { id: number; message: string; action?: ToastAction };

export const toasts = $state<Toast[]>([]);

const MAX_VISIBLE = 3;
let nextId = 1;

/** Shows `message`; with an `action`, a link button next to it (and longer, so it can be tapped). */
export function toast(
	message: string,
	{ action, durationMs = action ? 8000 : 3000 }: { action?: ToastAction; durationMs?: number } = {}
): void {
	const id = nextId++;
	toasts.push({ id, message, action });
	while (toasts.length > MAX_VISIBLE) toasts.shift();
	setTimeout(() => dismissToast(id), durationMs);
}

export function dismissToast(id: number): void {
	const i = toasts.findIndex((t) => t.id === id);
	if (i !== -1) toasts.splice(i, 1);
}
