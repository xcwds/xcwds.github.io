<script lang="ts">
	import { applyUpdate, appUpdate, busyReasons } from './app-update.svelte';

	let dismissed = $state(false);
	let busy = $derived(busyReasons());

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

{#if appUpdate.available && !dismissed}
	<div
		role="status"
		data-testid="update-banner"
		class="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-white dark:text-gray-900"
	>
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
			class="opacity-70"
			onclick={() => (dismissed = true)}
		>
			✕
		</button>
	</div>
{/if}
