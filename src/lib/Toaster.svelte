<script lang="ts">
	import { dismissToast, toasts } from './toast.svelte';
</script>

<!-- Always rendered so screen readers pick up new messages in this live region. -->
<div role="status" aria-live="polite" class="flex w-full max-w-md flex-col items-center gap-2">
	{#each toasts as t (t.id)}
		<button
			type="button"
			data-testid="toast"
			class="pointer-events-auto rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-gray-900"
			onclick={() => dismissToast(t.id)}
		>
			{t.message}
		</button>
	{/each}
</div>
