<script lang="ts">
	import { applyUpdate, appUpdate, busyReasons, reloadForUpdate } from './app-update.svelte';

	let busy = $derived(busyReasons());
	let reload = $derived(appUpdate.reloadNeeded);
	/** Dismissing the "new version" banner doesn't hide a later "reload" one. */
	type Kind = 'update' | 'reload';
	let dismissed = $state<Kind | null>(null);
	let kind = $derived<Kind | null>(reload ? 'reload' : appUpdate.available ? 'update' : null);

	function update() {
		const action = reload ? 'Reloading' : 'Updating reloads the app and';
		if (
			busy.length &&
			!confirm(
				`${action} will interrupt your ${busy.join(' and ')}. ${reload ? 'Reload' : 'Update'} anyway?`
			)
		)
			return;
		if (reload) reloadForUpdate();
		else applyUpdate();
	}
</script>

{#if kind && kind !== dismissed}
	<div
		role="status"
		data-testid="update-banner"
		class="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-white dark:text-gray-900"
	>
		<p class="flex-1">
			{reload
				? 'Updated in another tab. Reload to finish updating.'
				: 'A new version is available.'}
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
			{reload ? 'Reload' : 'Update'}{busy.length ? ' anyway' : ''}
		</button>
		<button
			type="button"
			aria-label="Dismiss"
			class="opacity-70"
			onclick={() => (dismissed = kind)}
		>
			✕
		</button>
	</div>
{/if}
