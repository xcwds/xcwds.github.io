<script lang="ts">
	import { plansForSos, type Environment } from '#lib/self-control/environment.js';
	import { settingsStatus } from '#lib/settings.svelte.js';
	import { entries, read } from '#lib/storage.js';
	import { card } from '../styles';

	/** Your starred if-then plans (#152) for the urge's habit: open, since this is the moment. */
	let { habit }: { habit?: string } = $props();

	let env = $state<Environment | undefined>();
	$effect(() => {
		if (settingsStatus.ready) env = read(entries.selfControlPlan);
	});
	const plans = $derived(plansForSos(env, habit));
</script>

{#if plans.length}
	<section
		class="{card} flex flex-col gap-2 text-sm"
		aria-label="Your plan"
		data-testid="sos-plans"
	>
		<h2 class="font-semibold">Your plan</h2>
		<ul class="flex flex-col gap-1">
			{#each plans as p (p.id)}
				<li>If <strong>{p.cue}</strong>, then I will <strong>{p.action}</strong>.</li>
			{/each}
		</ul>
	</section>
{/if}
