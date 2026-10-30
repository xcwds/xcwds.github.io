/** The tool, as @xcwds/plugin-tools lists it (`/utils` and Home). */
/** @type {import('@xcwds/plugin-tools').Tool} */
export const tool = {
	path: '/utils/scanner',
	app: 'camera',
	emoji: '📄',
	name: 'Document scanner',
	blurb: 'Paper to a PDF, without a cloud scanning app.',
	// The camera and crop on one side, the pages on the other, from `xl`.
	width: 'split',
	// Never under Recently used, never a manifest shortcut, no Share button (#215).
	private: true
};
