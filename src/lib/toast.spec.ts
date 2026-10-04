import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissToast, toast, toasts } from './toast.svelte';

describe('toast', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		toasts.length = 0;
	});

	it('shows a message, then removes it after its duration', () => {
		toast('Link copied.', 1000);
		expect(toasts.map((t) => t.message)).toEqual(['Link copied.']);
		vi.advanceTimersByTime(1000);
		expect(toasts).toHaveLength(0);
	});

	it('keeps at most three, dropping the oldest, and can be dismissed early', () => {
		for (const m of ['a', 'b', 'c', 'd']) toast(m);
		expect(toasts.map((t) => t.message)).toEqual(['b', 'c', 'd']);
		dismissToast(toasts[0].id);
		expect(toasts.map((t) => t.message)).toEqual(['c', 'd']);
	});
});
