/**
 * Self-Control's tools, each a private sub-page of the hub (#146). A tool lands by adding itself
 * here (the build registers its route and the hub shows its card) and its page under
 * `src/routes/utils/self-control/`. Titles stay generic: never a habit's name.
 *
 * @typedef {{ slug: string; title: string; emoji: string; blurb: string; width: 'narrow' | 'wide' }} Page
 * @type {Page[]}
 */
export const pages = [
	{
		slug: 'sos',
		title: 'Urge SOS',
		emoji: '🌊',
		blurb: 'Ride out a craving, right now.',
		width: 'narrow'
	},
	{
		slug: 'why',
		title: 'Your why',
		emoji: '💡',
		blurb: 'The reasons that matter to you.',
		width: 'narrow'
	},
	{
		slug: 'seesaw',
		title: 'Decision Seesaw',
		emoji: '⚖️',
		blurb: 'Weigh now against later.',
		width: 'narrow'
	},
	{
		slug: 'cues',
		title: 'Cue Audit',
		emoji: '🔍',
		blurb: 'Log urges and spot what sets them off.',
		width: 'narrow'
	}
];
