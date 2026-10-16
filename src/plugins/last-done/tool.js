/** The tool, as @xcwds/plugin-tools lists it (`/utils` and Home). */
/** @type {import('@xcwds/plugin-tools').Tool} */
export const tool = {
	path: '/utils/last-done',
	app: 'housework',
	emoji: '✅',
	name: 'Last done',
	blurb: 'When did I last…? Track how often you do things.',
	// Tools can't be `wide` yet (xcwds/xcwds#168): two columns of cards on wide screens.
	width: 'split'
};
