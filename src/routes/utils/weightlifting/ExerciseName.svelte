<!--
	The exercise name field with in-page suggestions (#209): a WAI-ARIA combobox with list
	autocomplete. A native <datalist> popup is drawn by the browser outside the page and can sit over
	a phone's keyboard; this list sits in flow under the field, and opening it scrolls the field and
	the list into the visible area, above the keyboard, showing fewer options when there isn't room.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { MAX_SUGGESTIONS, suggest } from '#lib/utils/suggest.js';

	let {
		value = $bindable(''),
		label,
		suggestions,
		class: className = ''
	}: {
		value: string;
		label: string;
		suggestions: readonly string[];
		class?: string;
	} = $props();

	const id = $props.id();
	/** Each option's height: the app's 44px tap target. */
	const OPTION = 44;
	/** The list's gap above it (`mt-1`) and its top and bottom borders. */
	const EDGES = 6;

	let open = $state(false);
	/** The highlighted option, or -1 for none. */
	let active = $state(-1);
	/** How many options fit between the field and the bottom of the visible area. */
	let room = $state(MAX_SUGGESTIONS);
	let input: HTMLInputElement | undefined = $state();

	const options = $derived(open ? suggest(value, suggestions, room) : []);
	const expanded = $derived(options.length > 0);

	/** The top and bottom of what's visible: the visual viewport, less the tab bar it may hide behind. */
	function visibleArea(): { top: number; bottom: number } | undefined {
		const vv = window.visualViewport;
		if (!vv) return undefined;
		let bottom = vv.offsetTop + vv.height;
		const tabs = document.querySelector('[data-shell-nav="tabs"]')?.getBoundingClientRect();
		if (tabs && tabs.height > 0 && tabs.top < bottom) bottom = tabs.top;
		return { top: vv.offsetTop, bottom };
	}

	/** Scrolls the field and as many options as fit (up to all of them) into the visible area. */
	async function fit() {
		room = MAX_SUGGESTIONS;
		await tick();
		if (!input || !open) return;
		const area = visibleArea();
		if (!area) {
			input.parentElement?.scrollIntoView({ block: 'nearest' });
			return;
		}
		const want = suggest(value, suggestions).length * OPTION + EDGES;
		const rect = input.getBoundingClientRect();
		const overflow = rect.bottom + want - area.bottom;
		// Up far enough to show the list, never so far the field leaves the top.
		const by = Math.min(overflow, rect.top - area.top - 8);
		if (by > 0) window.scrollBy(0, by);
		else if (rect.top < area.top) window.scrollBy(0, rect.top - area.top - 8);
		const below = area.bottom - input.getBoundingClientRect().bottom - EDGES;
		room = Math.max(1, Math.min(MAX_SUGGESTIONS, Math.floor(below / OPTION)));
	}

	// Fits again when the visible area changes while the list is open: the keyboard still sliding
	// in after the first keystroke, a rotation, or the keyboard changing height.
	$effect(() => {
		const vv = window.visualViewport;
		if (!expanded || !vv) return;
		const refit = () => void fit();
		vv.addEventListener('resize', refit);
		return () => vv.removeEventListener('resize', refit);
	});

	function show() {
		open = value.trim() !== '';
		active = -1;
		if (open) void fit();
	}

	function close() {
		open = false;
		active = -1;
	}

	function pick(name: string) {
		value = name;
		close();
		input?.focus();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			if (!expanded) {
				show();
				if (!open) return;
			}
			event.preventDefault();
			const n = options.length;
			if (!n) return;
			const step = event.key === 'ArrowDown' ? 1 : -1;
			active = active < 0 ? (step === 1 ? 0 : n - 1) : (active + step + n) % n;
		} else if (event.key === 'Enter') {
			if (expanded && active >= 0 && options[active]) {
				event.preventDefault();
				pick(options[active]);
			}
		} else if (event.key === 'Escape') {
			if (expanded) {
				event.preventDefault();
				close();
			}
		} else if (event.key === 'Tab') close();
	}
</script>

<div class="min-w-0 flex-1">
	<input
		bind:this={input}
		bind:value
		aria-label={label}
		placeholder="Exercise"
		role="combobox"
		aria-expanded={expanded}
		aria-controls="{id}-list"
		aria-autocomplete="list"
		aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
		autocomplete="off"
		class={className}
		oninput={show}
		{onkeydown}
		onblur={close}
	/>
	<ul
		id="{id}-list"
		role="listbox"
		aria-label="Suggestions"
		hidden={!expanded}
		class="mt-1 overflow-hidden rounded-md border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-950"
	>
		{#each options as name, i (name)}
			<!-- Keys stay on the field (the combobox pattern), which moves the highlight. -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li
				id="{id}-option-{i}"
				role="option"
				aria-selected={i === active}
				class="flex min-h-11 cursor-pointer items-center px-3 text-gray-900 hover:bg-gray-100 active:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800 dark:active:bg-gray-800 {i ===
				active
					? 'bg-gray-100 dark:bg-gray-800'
					: ''}"
				onpointerdown={(event) => event.preventDefault()}
				onclick={() => pick(name)}
			>
				{name}
			</li>
		{/each}
	</ul>
</div>
