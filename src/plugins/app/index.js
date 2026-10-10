/** The build entry: the app's standalone pages. */
import { definePlugin, descriptor } from '@xcwds/core';

export const NAME = 'xcwds-app';

/** The parody food-blog page, a hidden joke route (`src/lib/parody.ts` has the same path). */
const PORK_CHOPS =
	'/the-best-apple-cider-glazed-pork-chops-a-journey-home-nana-birdie-the-orchard-tyler-the-didgeridoo-kevin-ate-a-garden-hose-jump-to-recipe-this-link-does-not-work';

export default descriptor(NAME);

export const build = definePlugin(
	(app) => void app.route({ path: PORK_CHOPS, title: 'Pork Chops', emoji: '🍂', parent: '/' }),
	{ name: NAME, network: false }
);
