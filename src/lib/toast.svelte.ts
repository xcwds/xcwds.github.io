/** App-wide toasts: short confirmations like "Link copied." shown above the tab bar. */
export type Toast = { id: number; message: string };

export const toasts = $state<Toast[]>([]);

const MAX_VISIBLE = 3;
let nextId = 1;

export function toast(message: string, durationMs = 3000): void {
	const id = nextId++;
	toasts.push({ id, message });
	while (toasts.length > MAX_VISIBLE) toasts.shift();
	setTimeout(() => dismissToast(id), durationMs);
}

export function dismissToast(id: number): void {
	const i = toasts.findIndex((t) => t.id === id);
	if (i !== -1) toasts.splice(i, 1);
}
