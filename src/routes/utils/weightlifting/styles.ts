export const button =
	'rounded-xl bg-white/70 px-3 py-2 font-medium hover:not-disabled:bg-white active:bg-white disabled:opacity-40 dark:bg-gray-800 dark:hover:not-disabled:bg-gray-700 dark:active:bg-gray-700';
export const primary =
	'rounded-xl bg-blue-600 px-3 py-2 font-semibold text-white hover:not-disabled:bg-blue-700 active:bg-blue-700 disabled:opacity-40';
export const field =
	'w-full min-w-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';
export const card = 'rounded-2xl bg-white/80 p-4 dark:bg-gray-900';
export const toggle = (on: boolean) =>
	`rounded-xl px-3 py-2 text-sm font-medium ${
		on
			? 'bg-blue-600 text-white'
			: 'bg-white/70 hover:not-disabled:bg-white active:bg-white dark:bg-gray-800 dark:hover:not-disabled:bg-gray-700 dark:active:bg-gray-700'
	}`;
