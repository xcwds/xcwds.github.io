<script lang="ts">
	import { acronymParts } from './brand';

	let { phrase }: { phrase: string } = $props();
</script>

<!-- Screen readers get the plain phrase; the highlighted letters are visual only. -->
<span class="sr-only">{phrase}</span><span aria-hidden="true"
	>{#each acronymParts(phrase) as part, i (i)}{#if part.letter}<strong
				class="font-bold text-blue-700 dark:text-blue-400">{part.text}</strong
			>{:else}{part.text}{/if}{/each}</span
>
