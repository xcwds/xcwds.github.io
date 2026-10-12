/** The options of a segmented control: radio buttons in a radio group, or tabs in a tab list. */
const OPTIONS = '[role="radio"], [role="tab"]';

const isOn = (el: Element) =>
	el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true';
const disabled = (el: Element) =>
	(el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true';

/**
 * Svelte action for a segmented control: a `role="radiogroup"` of `role="radio"` buttons, or a
 * `role="tablist"` of `role="tab"` buttons. Gives it the keyboard behaviour those roles promise
 * (#138): the group is one Tab stop, on the selected option, and the arrow keys, Home and End move
 * to another option and select it (by clicking it, so the buttons' own handlers run). Options
 * that are disabled or hidden are skipped.
 */
export function segmented(group: HTMLElement) {
	const options = () => [...group.querySelectorAll<HTMLElement>(OPTIONS)];
	/** The options the keyboard can reach. */
	const reachable = () => options().filter((el) => !disabled(el) && el.getClientRects().length > 0);

	/** Roving tabindex: only the selected option (or the first reachable one) is a Tab stop. */
	function update() {
		const all = options();
		const stop = all.find((el) => isOn(el) && !disabled(el)) ?? reachable()[0] ?? all[0];
		for (const el of all) {
			const index = el === stop ? '0' : '-1';
			if (el.getAttribute('tabindex') !== index) el.setAttribute('tabindex', index);
		}
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
		const list = reachable();
		const from = list.indexOf(event.target as HTMLElement);
		if (from === -1) return;
		const step: Record<string, number> = {
			ArrowRight: 1,
			ArrowDown: 1,
			ArrowLeft: -1,
			ArrowUp: -1
		};
		let to: number;
		if (event.key === 'Home') to = 0;
		else if (event.key === 'End') to = list.length - 1;
		else if (event.key in step) to = (from + step[event.key]! + list.length) % list.length;
		else return;
		event.preventDefault();
		const next = list[to]!;
		next.focus();
		if (!isOn(next)) next.click();
	}

	update();
	// Selection changes (from a click, the keyboard or another tab's settings) move the Tab stop.
	const observer = new MutationObserver(update);
	observer.observe(group, {
		subtree: true,
		childList: true,
		attributes: true,
		attributeFilter: ['aria-checked', 'aria-selected', 'disabled', 'aria-disabled']
	});
	group.addEventListener('keydown', onKeydown);
	return {
		destroy() {
			observer.disconnect();
			group.removeEventListener('keydown', onKeydown);
		}
	};
}
