/** The tool, as @xcwds/plugin-tools lists it (`/utils` and Home). */
/** @type {import('@xcwds/plugin-tools').Tool} */
export const tool = {
	path: '/utils/self-control',
	app: 'self-control',
	emoji: '🧭',
	name: 'Self-Control',
	blurb: 'Ride out cravings and redesign your triggers.',
	width: 'narrow',
	// Never under Recently used, never a manifest shortcut, no Share button (#146).
	private: true
};
