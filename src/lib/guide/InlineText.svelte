<script lang="ts">
	import { resolve } from '$app/paths';
	import { parseInline, type Inline } from '$lib/guide';
	import type { ToolPath } from '$lib/utils/tools';

	let { text }: { text: string } = $props();

	// guide.spec.ts checks that every link points at a real article, section, recipe or tool.
	function href(part: Exclude<Inline, { kind: 'text' }>): string {
		if (part.kind === 'guide') {
			const path = resolve('/guide/[slug]', { slug: part.slug });
			return part.section ? `${path}#${part.section}` : path;
		}
		if (part.kind === 'recipe') return resolve('/recipes/[slug]', { slug: part.slug });
		if (part.kind === 'external') return part.url;
		return resolve(part.path as ToolPath);
	}
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- href() resolves every link -->
{#each parseInline(text) as part, i (i)}{#if part.kind === 'text'}{#if part.bold}<strong
				class="font-semibold">{part.text}</strong
			>{:else}{part.text}{/if}{:else}<a
			href={href(part)}
			rel={part.kind === 'external' ? 'external noopener' : undefined}
			class="text-blue-700 underline dark:text-blue-300">{part.text}</a
		>{/if}{/each}
<!-- eslint-enable svelte/no-navigation-without-resolve -->
