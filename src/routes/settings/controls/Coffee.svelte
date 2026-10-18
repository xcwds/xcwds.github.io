<script lang="ts">
	/** Settings → Tool defaults: the coffee timer's default length. */
	import { settings } from '#lib/settings.svelte.js';
	import { COFFEE_SECONDS, entries, remove } from '#lib/storage.js';
	import { formatDuration } from '#lib/utils/time.js';

	function adjust(deltaSeconds: number) {
		// Forget a length picked in the timer, so the new default is what it opens with.
		remove(entries.coffeeDuration);
		settings.coffeeDefaultSeconds = Math.min(
			COFFEE_SECONDS.max,
			Math.max(COFFEE_SECONDS.min, settings.coffeeDefaultSeconds + deltaSeconds)
		);
	}

	const button =
		'rounded-xl bg-white/70 px-3 py-2 font-medium hover:not-disabled:bg-white active:bg-white disabled:opacity-40 dark:bg-gray-800 dark:hover:not-disabled:bg-gray-700 dark:active:bg-gray-700';
</script>

<!-- Spaced from the tool above it in Tool defaults. -->
<div class="flex flex-col gap-3 not-first-of-type:mt-2">
	<h3 class="font-semibold">Coffee Timer</h3>
	<div class="flex items-center justify-between gap-3">
		<span>Default length</span>
		<div class="flex items-center gap-2">
			<button
				type="button"
				class={button}
				aria-label="15 seconds shorter"
				disabled={settings.coffeeDefaultSeconds <= COFFEE_SECONDS.min}
				onclick={() => adjust(-15)}>−15s</button
			>
			<span class="w-14 text-center text-lg tabular-nums" data-testid="coffee-default"
				>{formatDuration(settings.coffeeDefaultSeconds * 1000)}</span
			>
			<button
				type="button"
				class={button}
				aria-label="15 seconds longer"
				disabled={settings.coffeeDefaultSeconds >= COFFEE_SECONDS.max}
				onclick={() => adjust(15)}>+15s</button
			>
		</div>
	</div>
	<p class="text-sm text-gray-600 dark:text-gray-400">
		A length you pick in the timer is remembered; changing the default resets that.
	</p>
</div>
