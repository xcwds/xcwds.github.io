// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// What the @xcwds plugins add to the app (`app.toast`, `app.update`, ...) and to its settings.
import type {} from '@xcwds/plugin-changelog/client';
import type {} from '@xcwds/plugin-install/client';
import type {} from '@xcwds/plugin-offline/client';
import type {} from '@xcwds/plugin-settings/client';
import type {} from '@xcwds/plugin-share/client';
import type {} from '@xcwds/plugin-shell/client';
import type {} from '@xcwds/plugin-theme/client';
import type {} from '@xcwds/plugin-timers/client';
import type {} from '@xcwds/plugin-tools/client';
import type {} from '@xcwds/plugin-update/client';

export {};
