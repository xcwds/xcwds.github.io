<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	// The Recipes tab holds both the recipes and the kitchen guide; this switches between them.
	const links = [
		{ path: '/recipes', label: 'Recipes' },
		{ path: '/guide', label: 'Kitchen Guide' }
	] as const;
</script>

<nav aria-label="Recipes or kitchen guide" class="grid grid-cols-2 gap-2">
	{#each links as link (link.path)}
		{@const current = page.url.pathname.replace(/\/+$/, '') === resolve(link.path)}
		<a
			href={resolve(link.path)}
			aria-current={current ? 'page' : undefined}
			class="flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-medium {current
				? 'bg-blue-600 text-white'
				: 'bg-white/70 hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700'}"
		>
			{link.label}
		</a>
	{/each}
</nav>
