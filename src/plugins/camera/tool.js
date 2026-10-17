/** The tool, as @xcwds/plugin-tools lists it (`/utils` and Home). */
/** @type {import('@xcwds/plugin-tools').Tool} */
export const tool = {
	path: '/utils/camera',
	app: 'camera',
	emoji: '📷',
	name: 'Camera',
	blurb: 'Photos that stay on this device, out of your gallery.',
	width: 'narrow',
	// Never under Recently used, never a manifest shortcut, no Share button (#210).
	private: true
};
