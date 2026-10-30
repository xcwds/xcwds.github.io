/** The tool, as @xcwds/plugin-tools lists it (`/utils` and Home). */
/** @type {import('@xcwds/plugin-tools').Tool} */
export const tool = {
	path: '/utils/voice-memos',
	app: 'voice-memos',
	emoji: '🎙️',
	name: 'Voice memos',
	blurb: 'Recordings that stay on this device.',
	width: 'narrow',
	// Never under Recently used, never a manifest shortcut, no Share button (#214).
	private: true
};
