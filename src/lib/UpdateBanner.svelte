<script lang="ts">
	import { applyUpdate, appUpdate, busyReasons } from './app-update.svelte';

	let dismissed = $state(false);
	let busy = $derived(busyReasons());

	$effect(() => {
		if (!appUpdate.updated) return;
		const timeout = setTimeout(() => (appUpdate.updated = false), 4000);
		return () => clearTimeout(timeout);
	});

	function update() {
		if (
			busy.length &&
			!confirm(
				`Updating reloads the app and will interrupt your ${busy.join(' and ')}. Update anyway?`
			)
		)
			return;
		applyUpdate();
	}
</script>

{#if (appUpdate.available && !dismissed) || appUpdate.updated}
	<div
		class="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-4 md:top-4 md:bottom-auto"
		role="status"
		data-testid="update-banner"
	>
		<div
			class="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-white dark:text-gray-900"
		>
			{#if appUpdate.updated}
				<p class="flex-1">✓ App updated to the latest version.</p>
			{:else}
				<p class="flex-1">
					A new version is available.
					{#if busy.length}
						<span class="block opacity-80">Finish your {busy.join(' and ')} first.</span>
					{/if}
				</p>
				<button
					type="button"
					class="rounded-lg px-3 py-1.5 font-semibold {busy.length
						? 'bg-white/15 dark:bg-gray-900/10'
						: 'bg-blue-500 text-white'}"
					onclick={update}
				>
					{busy.length ? 'Update anyway' : 'Update'}
				</button>
				<button
					type="button"
					aria-label="Dismiss"
					class="px-1 opacity-70"
					onclick={() => (dismissed = true)}
				>
					✕
				</button>
			{/if}
		</div>
	</div>
{/if}
