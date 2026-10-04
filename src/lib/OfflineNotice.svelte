<script lang="ts">
	import { network } from './network.svelte';
</script>

{#if !network.online}
	<p
		data-testid="offline-notice"
		class="pointer-events-auto rounded-full bg-amber-200 px-4 py-1.5 text-sm font-medium text-amber-950 shadow dark:bg-amber-800 dark:text-amber-50"
	>
		Offline · everything still works
	</p>
{/if}
