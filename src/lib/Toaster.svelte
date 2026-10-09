<script lang="ts">
	import { resolve } from '$app/paths';
	import { dismissToast, toasts } from './toast.svelte';
</script>

<!-- Always rendered so screen readers pick up new messages in this live region. -->
<div
	role="status"
	aria-live="polite"
	class="flex w-full max-w-md flex-col items-center gap-2 md:items-end"
>
	{#each toasts as t (t.id)}
		{#if t.action}
			<div
				data-testid="toast"
				class="pointer-events-auto flex items-center gap-1 rounded-full bg-gray-900 py-1 pr-1 pl-1 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-gray-900"
			>
				<button
					type="button"
					class="min-h-11 rounded-full pr-1 pl-3"
					onclick={() => dismissToast(t.id)}>{t.message}</button
				>
				<!-- The path is resolved; the lint rule just can't see through the appended #hash. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={`${resolve(t.action.path)}${t.action.hash ?? ''}`}
					class="flex min-h-11 items-center rounded-full px-3 font-semibold text-blue-300 underline dark:text-blue-700"
					onclick={() => dismissToast(t.id)}>{t.action.label}</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		{:else}
			<button
				type="button"
				data-testid="toast"
				class="pointer-events-auto rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-gray-900"
				onclick={() => dismissToast(t.id)}
			>
				{t.message}
			</button>
		{/if}
	{/each}
</div>
